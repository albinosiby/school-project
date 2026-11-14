// Pure class-result compilation (docs/EXAMS_SHEETS_RESULTS_CONTRACT.md section 2). No Firestore access.
const { createHash } = require("node:crypto");
const { consolidated } = require("./examOperations");
const { clsLabel } = require("./classIdentity");

const LIVE = ["Compiled", "Approved", "Published"];
const hash = (v) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const resultId = (cycleId, studentId) => `${cycleId}__${studentId}`;
const classResultId = (cycleId, classId) => `${cycleId}__${classId}`;
/** Superseded copies keep the canonical id plus a version suffix; the canonical doc is always the current version. */
const archivedId = (id, version) => `${id}__v${version}`;
const isCanonical = (doc) => !/__v\d+$/.test(String(doc?.id || ""));
const round = (value, rule) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const places = { whole: 0, "one-decimal": 1, "two-decimal": 2 }[rule] ?? 2;
  return Number(value.toFixed(places));
};

/** Candidate row for `consolidated` from a students/{id} record. */
const candidateOf = (s) => ({
  studentId: s.id,
  id: `cand_${s.id}`,
  name: s.name || "",
  classId: s.classId || "",
  grade: s.grade || "",
  section: s.section || "",
  roll: String(s.roll ?? ""),
  cls: clsLabel(s.classId || ""),
  grn: s.grn || s.admissionNumber || "",
});

/**
 * Weighted mean of a student's live results of one term. `results` are exm_results docs (any cycle, any status);
 * `examTypes` maps examTypeId → set_exam_types doc. Only Compiled/Approved/Published rows whose exam type counts in
 * the term contribute, one per cycle (the canonical doc wins over archived copies). Null when nothing contributes.
 */
function termAggregate(results = [], examTypes = {}, rounding) {
  const byCycle = new Map();
  for (const row of results) {
    if (!row || !LIVE.includes(row.status) || !row.cycleId) continue;
    const current = byCycle.get(row.cycleId);
    if (!current || (isCanonical(row) && !isCanonical(current))) byCycle.set(row.cycleId, row);
  }
  const contributions = [];
  let termId = "";
  for (const row of byCycle.values()) {
    const type = examTypes[row.examTypeId] || null;
    if (type?.countsInTerm === false || typeof row.pct !== "number" || !Number.isFinite(row.pct)) continue;
    const weight = Number(type?.weight) > 0 ? Number(type.weight) : 1;
    termId = termId || row.termId || "";
    contributions.push({
      cycleId: row.cycleId,
      examTypeId: row.examTypeId || "",
      short: type?.short || "",
      weight,
      pct: row.pct,
    });
  }
  if (!contributions.length) return null;
  contributions.sort((a, b) => a.cycleId.localeCompare(b.cycleId));
  const divisor = contributions.reduce((sum, c) => sum + c.weight, 0);
  const pct = round(contributions.reduce((sum, c) => sum + c.weight * c.pct, 0) / divisor, rounding);
  return { termId, contributions, pct };
}

/** Compiled → same version (recompile); Published → next version; nothing yet → 1. */
function nextVersion(previous) {
  if (!previous) return 1;
  const current = Number.isInteger(previous.version) && previous.version > 0 ? previous.version : 1;
  return previous.status === "Published" ? current + 1 : current;
}

/**
 * Builds the exm_results rows of one division plus its exm_class_results summary. `candidates` may cover more than
 * the division (course-wide ranking needs the whole cohort); rows are restricted to `classId` afterwards.
 * Returned docs carry no status/version/stamps: the caller adds them inside its transaction.
 */
function compileClass(cycle, papers, candidates, marks, classes, classId, options = {}) {
  const { examType = null, examTypes = {}, previousResults = [], termResultsOfStudents = {} } = options;
  const live = papers.filter((p) => p.scheduleStatus !== "Cancelled");
  const rows = consolidated(cycle, live, candidates, marks, classes).filter((row) => row.classId === classId);
  const types = { ...examTypes };
  if (cycle.examTypeId && examType && !types[cycle.examTypeId]) types[cycle.examTypeId] = examType;
  const classLabel = rows[0]?.cls || clsLabel(classId);
  const results = rows.map((row) => {
    const subjects = row.entries.map(({ paper, mark, result }) => {
      const mode = paper.assessmentMode === "grade" ? "grade" : "marks";
      const max = mode === "grade" ? 0 : (paper.theory ?? 80) + (paper.internal ?? 20) + (paper.practical ?? 0);
      return {
        paperId: paper.id,
        subject: paper.subject || "",
        code: paper.code || "",
        mode,
        theory: typeof mark?.theory === "number" ? mark.theory : null,
        practical: typeof mark?.practical === "number" ? mark.practical : null,
        internal: typeof mark?.internal === "number" ? mark.internal : null,
        gradeValue: mark?.gradeValue || "",
        total: result.total ?? null,
        max,
        pct: result.pct ?? null,
        grade: result.grade ?? "--",
        state: result.state,
        passed: result.passed ?? null,
        weight: paper.weight ?? 1,
      };
    });
    const base = {
      id: resultId(cycle.id, row.studentId),
      cycleId: cycle.id,
      studentId: row.studentId,
      classId,
      classLabel,
      name: row.name || "",
      grn: row.grn || "",
      roll: String(row.roll ?? ""),
      termId: cycle.termId || "",
      examTypeId: cycle.examTypeId || "",
      subjects,
      total: row.total ?? null,
      maximum: row.maximum ?? null,
      pct: row.pct ?? null,
      grade: row.grade ?? "--",
      passed: row.passed ?? null,
      complete: row.complete === true,
      rank: cycle.resultRules?.rankScope && cycle.resultRules.rankScope !== "none" ? (row.rank ?? null) : null,
    };
    const others = (termResultsOfStudents[row.studentId] || []).filter(
      (r) => r && r.cycleId !== cycle.id && (r.termId || "") === (cycle.termId || ""),
    );
    base.term = cycle.termId
      ? termAggregate([...others, { ...base, status: "Compiled" }], types, cycle.resultRules?.rounding)
      : null;
    base.stale = false;
    return base;
  });
  const sourceHash = hash([
    cycle.resultRules || {},
    cycle.scale || "",
    results.map((r) => [r.studentId, r.subjects, r.total, r.maximum, r.pct, r.grade, r.passed, r.rank]),
  ]);
  for (const r of results) r.sourceHash = sourceHash;
  const incomplete = results.filter((r) => !r.complete).length;
  const passed = results.filter((r) => r.passed === true).length;
  const failed = results.filter((r) => r.passed === false).length;
  const decided = passed + failed;
  const previous = previousResults.find((p) => p && p.classId === classId && isCanonical(p)) || null;
  return {
    results,
    classResult: {
      id: classResultId(cycle.id, classId),
      cycleId: cycle.id,
      classId,
      classLabel,
      students: results.length,
      passed,
      failed,
      incomplete,
      passPct: decided ? round((passed / decided) * 100, "one-decimal") : null,
      stale: false,
      sourceHash,
    },
    sourceHash,
    version: nextVersion(previous),
  };
}

module.exports = {
  LIVE,
  candidateOf,
  compileClass,
  termAggregate,
  nextVersion,
  resultId,
  classResultId,
  archivedId,
  isCanonical,
};
