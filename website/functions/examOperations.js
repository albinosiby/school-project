// Pure operational rules shared by callable workflows, dashboard and tests.
const { assessMark, overallResult, markFingerprint } = require("./examAssessment");
const { clsLabel, labelToClassId } = require("./classIdentity");
const mins = (time) => {
  const [h, m] = String(time || "")
    .split(":")
    .map(Number);
  return h * 60 + m;
};
const end = (paper) => mins(paper.start) + Math.round(paper.duration * 60);
const timed = (p) =>
  p.date && p.start && !["Postponed", "Cancelled"].includes(p.scheduleStatus) && p.setupPlanned !== false;
const overlaps = (a, b) =>
  timed(a) && timed(b) && a.date === b.date && mins(a.start) < end(b) && mins(b.start) < end(a);
const classOf = (row) => row.classId || labelToClassId(row.cls || `${row.grade}-${row.section}`);
const covers = (paper, row) =>
  paper.classIds?.length ? paper.classIds.includes(classOf(row)) : String(paper.grade) === String(row.grade);
const participates = (paper, row) =>
  paper.scheduleStatus !== "Cancelled" &&
  covers(paper, row) &&
  (!Array.isArray(paper.studentIds) ||
    paper.studentIds.includes(row.studentId || row.id.replace(/^cand_/, "")));
const staffIds = (paper, duties) => [
  ...new Set(
    [paper.invigilatorId, ...duties.filter((d) => d.paperId === paper.id).map((d) => d.staffId)].filter(
      Boolean,
    ),
  ),
];
function scheduleErrors(changes, all, duties = [], window, events = []) {
  const errors = [];
  const merged = all.map((p) => ({ ...p, ...changes.find((c) => c.id === p.id) }));
  for (const change of changes) {
    const p = merged.find((row) => row.id === change.id);
    if (!p) {
      errors.push("Paper no longer exists.");
      continue;
    }
    if (!timed(p)) continue;
    const parsed = new Date(`${p.date}T12:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !Number.isFinite(+parsed) ||
      parsed.toISOString().slice(0, 10) !== p.date ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.start) ||
      !Number.isFinite(p.duration) ||
      p.duration <= 0 ||
      p.duration > 6 ||
      end(p) > 1440
    ) {
      errors.push(`${p.subject}: enter a valid date, start time and duration (up to six hours).`);
      continue;
    }
    if (window && (p.date < window.start || p.date > window.end))
      errors.push(`${p.subject}: date is outside the examination window.`);
    for (const event of events)
      if (
        event.blocksExams === true &&
        !event.deleted &&
        p.date >= (event.date || event.startDate || event.start) &&
        p.date <= (event.endDate || event.end || event.date || event.startDate || event.start)
      )
        errors.push(
          `${p.subject}: conflicts with academic calendar event ${event.title || event.name || p.date}.`,
        );
    for (const other of merged) {
      if (other.id === p.id || !overlaps(p, other)) continue;
      if (
        p.classIds?.length && other.classIds?.length
          ? p.classIds.some((id) => other.classIds.includes(id))
          : p.grade === other.grade
      )
        errors.push(`${p.subject}: division conflict with ${other.subject} on ${p.date}.`);
      if (p.venue?.trim() && p.venue.trim().toLowerCase() === other.venue?.trim().toLowerCase())
        errors.push(`${p.subject}: room ${p.venue} is occupied by ${other.subject}.`);
      if (staffIds(p, duties).some((id) => staffIds(other, duties).includes(id)))
        errors.push(`${p.subject}: an invigilator is already assigned to ${other.subject} at this time.`);
    }
  }
  return [...new Set(errors)];
}
function consolidated(cycle, papers, candidates, marks, classes = []) {
  const byMark = new Map(
    marks.map((m) => [m.paperId + ":" + (m.studentId || String(m.candId).replace(/^cand_/, "")), m]),
  );
  const rows = candidates
    .map((candidate) => {
      const studentId = candidate.studentId || candidate.id.replace(/^cand_/, "");
      const classId = classOf(candidate),
        section = classes.find((c) => c.id === classId);
      const entries = papers
        .filter((p) => participates(p, candidate))
        .map((paper) => {
          const mark = byMark.get(paper.id + ":" + studentId);
          return { paper, mark, result: assessMark(mark, paper) };
        });
      const result = overallResult(entries, cycle.resultRules, cycle.scale);
      const passed = !result.complete
        ? null
        : entries.some(({ result: r }) => r.passed === false || r.state === "absent")
          ? false
          : true;
      const group =
        cycle.resultRules?.rankScope === "class-course"
          ? `${candidate.grade}:${section?.streamId || section?.stream || candidate.cls?.split("-").slice(1, -1).join("-") || ""}`
          : classId;
      return {
        ...candidate,
        classGrade: candidate.grade,
        studentId,
        classId,
        cls: candidate.cls || clsLabel(classId),
        entries,
        ...result,
        passed,
        group,
        rank: null,
      };
    })
    .filter((row) => row.entries.length > 0);
  if (cycle.resultRules?.rankScope && cycle.resultRules.rankScope !== "none")
    for (const row of rows) {
      if (row.complete && row.pct !== null)
        row.rank =
          1 +
          rows.filter(
            (other) =>
              other.group === row.group && other.complete && other.pct !== null && other.pct > row.pct,
          ).length;
    }
  return rows;
}
function readyForReport(row, rules = {}) {
  return (
    row.complete &&
    row.entries.every(({ mark, paper, result }) => {
      if (result.state === "absent") return rules.absentRule === "zero";
      if (result.state === "exempt") return true;
      return (
        result.state === "verified" &&
        mark?.verified === true &&
        mark.verificationFingerprint === markFingerprint(mark, paper)
      );
    })
  );
}
module.exports = {
  scheduleErrors,
  consolidated,
  readyForReport,
  participates,
  covers,
  classOf,
  mins,
  end,
  staffIds,
  overlaps,
};
