// Pure mark-sheet rules (docs/EXAMS_SHEETS_RESULTS_CONTRACT.md section 1), shared by the callable, triggers,
// dashboard and tests. Nothing here touches Firestore.
const { assessMark } = require("./examAssessment");
const { participates } = require("./examOperations");
const { clsLabel } = require("./classIdentity");

const STATUSES = ["NotStarted", "InProgress", "Submitted", "Returned", "Approved", "Locked"];
const OPEN = ["NotStarted", "InProgress", "Returned"];
const sheetId = (paperId, classId) => `${paperId}__${classId}`;
const studentOf = (mark) => mark?.studentId || String(mark?.candId || "").replace(/^cand_/, "");
const activeStudent = (s) => !!s && s.deleted !== true && (s.status || "Active") === "Active";
const same = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** "9-A" for a class: the conventional label from the id, else grade-section from the class record. */
function classLabelOf(classId, classes = []) {
  const label = clsLabel(classId);
  if (label !== classId) return label;
  const section = classes.find((c) => c.id === classId);
  return section ? `${section.grade ?? ""}-${section.section ?? ""}`.replace(/^-|-$/g, "") || classId : classId;
}

/** paper.evaluatorIds[classId] → assignment (same class, same subject) → classes/{classId}.classTeacherId → "". */
function resolveOwner(paper, classId, assignments = [], classes = []) {
  const explicit = paper?.evaluatorIds?.[classId];
  if (typeof explicit === "string" && explicit) return explicit;
  const assignment = assignments.find(
    (a) => a && a.classId === classId && same(a.subject, paper?.subject) && a.teacherId,
  );
  if (assignment) return assignment.teacherId;
  const section = classes.find((c) => c.id === classId);
  return typeof section?.classTeacherId === "string" ? section.classTeacherId : "";
}

/** The sheet's copy of the paper's assessment components (the rules check teacher writes against these maxima). */
function componentsOf(paper) {
  const mode = paper.assessmentMode === "grade" ? "grade" : "marks";
  return {
    mode,
    theory: mode === "grade" ? 0 : Number(paper.theory ?? 80) || 0,
    practical: mode === "grade" ? 0 : Number(paper.practical ?? 0) || 0,
    internal: mode === "grade" ? 0 : Number(paper.internal ?? 20) || 0,
    passMarks: typeof paper.passMarks === "number" ? paper.passMarks : null,
    gradeOptions: Array.isArray(paper.gradeOptions) ? paper.gradeOptions.filter((g) => typeof g === "string") : [],
  };
}

/** Divisions a paper is written by: its classIds, else every class of the paper's grade (within the cycle's classes). */
function paperClasses(cycle, paper, classes = []) {
  const ids = paper.classIds?.length
    ? paper.classIds
    : classes.filter((c) => String(c.grade) === String(paper.grade)).map((c) => c.id);
  return cycle?.classIds?.length ? ids.filter((id) => cycle.classIds.includes(id)) : ids;
}

const emptySummary = (total = 0) => ({
  total,
  entered: 0,
  absent: 0,
  medical: 0,
  exempt: 0,
  outOfRange: 0,
  highest: null,
  lowest: null,
  mean: null,
});

/**
 * Sheet documents for every paper × division of the cycle that has none yet (idempotent re-runs create only the
 * missing ones). Cancelled papers are skipped. `students` are the school's student records (or candidates with a
 * classId); `options.staff` supplies owner names and `options.now` the timestamp.
 */
function buildSheets(cycle, papers, students, assignments = [], classes = [], existingSheetIds = [], options = {}) {
  const existing = new Set(existingSheetIds);
  const at = options.now || new Date().toISOString();
  const staff = options.staff || [];
  const excluded = new Set(cycle?.excludedStudentIds || []);
  const sheets = [];
  for (const paper of papers) {
    if (!paper || paper.cycleId !== cycle.id || paper.scheduleStatus === "Cancelled") continue;
    for (const classId of paperClasses(cycle, paper, classes)) {
      const id = sheetId(paper.id, classId);
      if (existing.has(id)) continue;
      // The division is already one of the paper's; only the frozen participant list can still exclude a student.
      const grade = classes.find((c) => c.id === classId)?.grade ?? paper.grade;
      const rosterIds = students
        .filter(
          (s) =>
            activeStudent(s) &&
            s.classId === classId &&
            !excluded.has(s.id) &&
            participates(paper, { ...s, studentId: s.id, classId, grade: s.grade ?? grade }),
        )
        .map((s) => s.id)
        .sort();
      const ownerId = resolveOwner(paper, classId, assignments, classes);
      sheets.push({
        id,
        cycleId: cycle.id,
        paperId: paper.id,
        classId,
        classLabel: classLabelOf(classId, classes),
        subject: paper.subject || "",
        code: paper.code || "",
        grade: String(paper.grade ?? ""),
        components: componentsOf(paper),
        ownerId,
        ownerName: staff.find((m) => m.id === ownerId)?.name || "",
        reviewerId: "",
        rosterIds,
        status: "NotStarted",
        version: 1,
        summary: emptySummary(rosterIds.length),
        needsRecheck: false,
        createdAt: at,
        updatedAt: at,
        updatedBy: options.updatedBy || "server",
      });
    }
  }
  return sheets;
}

/** Assessment state of every rostered student: [{ studentId, mark, result }]. */
function assessRoster(sheet, marks = [], paper) {
  const byStudent = new Map();
  for (const mark of marks) if (mark && mark.paperId === sheet.paperId) byStudent.set(studentOf(mark), mark);
  return (sheet.rosterIds || []).map((studentId) => {
    const mark = byStudent.get(studentId);
    return { studentId, mark, result: assessMark(mark, paper || sheetPaper(sheet)) };
  });
}

/** A paper-shaped view of the sheet's own components, for assessing marks without the paper record. */
function sheetPaper(sheet) {
  const c = sheet.components || {};
  return {
    id: sheet.paperId,
    assessmentMode: c.mode === "grade" ? "grade" : "marks",
    theory: c.theory ?? 80,
    internal: c.internal ?? 20,
    practical: c.practical ?? 0,
    passMarks: c.passMarks ?? undefined,
    gradeOptions: c.gradeOptions || [],
  };
}

/** Server-maintained counts for the sheet board; `entered` counts every student with a non-pending state. */
function sheetSummary(sheet, marks = [], paper) {
  const rows = assessRoster(sheet, marks, paper);
  const summary = emptySummary(rows.length);
  const totals = [];
  for (const { result } of rows) {
    if (result.state === "pending") continue;
    summary.entered++;
    if (result.state === "absent") summary.absent++;
    else if (result.state === "medical") summary.medical++;
    else if (result.state === "exempt") summary.exempt++;
    else if (result.state === "invalid") summary.outOfRange++;
    if (result.state !== "invalid" && typeof result.total === "number") totals.push(result.total);
  }
  if (totals.length) {
    summary.highest = Math.max(...totals);
    summary.lowest = Math.min(...totals);
    summary.mean = Number((totals.reduce((sum, t) => sum + t, 0) / totals.length).toFixed(2));
  }
  return summary;
}

/** Students without a usable assessment (pending or out of range); a sheet can be submitted only when 0 missing. */
function completeness(sheet, marks = [], paper) {
  const ids = assessRoster(sheet, marks, paper)
    .filter(({ result }) => ["pending", "invalid"].includes(result.state))
    .map(({ studentId }) => studentId);
  return { missing: ids.length, ids };
}

/** Transition table of section 1. `from` null/"" means the sheet does not exist yet. */
function allowedTransition(from, to, actor = "admin") {
  const start = from || "";
  if (!STATUSES.includes(to) || (start && !STATUSES.includes(start))) return false;
  if (!start) return to === "NotStarted" && actor !== "teacher";
  if (actor === "teacher") return OPEN.includes(start) && to === "Submitted";
  if (actor === "server")
    return (start === "NotStarted" && to === "InProgress") || (start === "Approved" && to === "Locked");
  if (actor !== "admin") return false;
  if (to === "Submitted") return OPEN.includes(start);
  if (to === "Returned") return ["Submitted", "Approved", "Locked"].includes(start);
  if (to === "Approved") return start === "Submitted";
  return false;
}

module.exports = {
  STATUSES,
  OPEN,
  sheetId,
  classLabelOf,
  resolveOwner,
  componentsOf,
  paperClasses,
  buildSheets,
  sheetPaper,
  assessRoster,
  sheetSummary,
  completeness,
  allowedTransition,
  studentOf,
};
