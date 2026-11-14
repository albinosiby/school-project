const { test } = require("node:test");
const assert = require("node:assert/strict");
const { scheduleErrors, consolidated, readyForReport } = require("./examOperations");
const { markFingerprint, overallResult, assessMark } = require("./examAssessment");
const paper = { id: "p1", cycleId: "c1", subject: "English", grade: "11", classIds: ["home11A"], studentIds: ["s1", "s2"], date: "2026-12-02", start: "09:00", duration: 2, venue: "Hall 1", theory: 80, internal: 20, passMarks: 50, setupVersion: 1, invigilatorId: "t1" };
const candidates = ["s1", "s2"].map((id) => ({ id: "cand_" + id, studentId: id, name: id, grade: "11", section: "A", cls: "11-Home Science-A", classId: "home11A" }));
const mark = (id, theory) => { const m = { paperId: "p1", candId: "cand_" + id, studentId: id, theory, internal: 10, verified: true }; return { ...m, verificationFingerprint: markFingerprint(m, paper) }; };
test("schedule validation handles division, room and multiple invigilator conflicts", () => {
  const other = { ...paper, id: "p2", classIds: ["other"], subject: "Maths", invigilatorId: "other", venue: "Other" };
  assert.deepEqual(scheduleErrors([paper], [paper, other]), []);
  assert.match(scheduleErrors([paper], [paper, { ...other, venue: "hall 1" }]).join(), /room/);
  assert.match(scheduleErrors([paper], [paper, other], [{ paperId: "p2", staffId: "t1" }]).join(), /invigilator/);
  assert.match(scheduleErrors([paper], [paper, { ...other, classIds: ["home11A"] }]).join(), /division/);
});
test("postponed and cancelled papers release timetable reservations", () => {
  const other = { ...paper, id: "p2", scheduleStatus: "Postponed" };
  assert.deepEqual(scheduleErrors([paper], [paper, other]), []);
  assert.deepEqual(scheduleErrors([{ ...paper, scheduleStatus: "Cancelled", date: "" }], [paper, { ...other, scheduleStatus: "Scheduled" }]), []);
});
test("invalid dates, windows and explicitly blocking calendar records are rejected", () => {
  assert.match(scheduleErrors([{ ...paper, date: "2026-02-31" }], [paper]).join(), /valid date/);
  assert.match(scheduleErrors([paper], [paper], [], { start: "2026-12-03", end: "2026-12-09" }).join(), /outside/);
  assert.match(scheduleErrors([paper], [paper], [], undefined, [{ blocksExams: true, start: "2026-12-02", end: "2026-12-02", title: "School holiday" }]).join(), /School holiday/);
});
test("rank excludes incomplete students and respects real custom division IDs", () => {
  const cycle = { resultRules: { rankScope: "division" } };
  const rows = consolidated(cycle, [paper], candidates, [mark("s1", 60)]);
  assert.equal(rows[0].rank, 1); assert.equal(rows[0].classGrade, "11"); assert.equal(rows[1].rank, null);
  assert.equal(readyForReport(rows[0]), true); assert.equal(readyForReport(rows[1]), false);
});
test("a missing descriptor invalidates consolidated numeric totals and ranking", () => {
  const gradePaper = { ...paper, id: "g", assessmentMode: "grade", gradeOptions: ["Good"], theory: 0, internal: 0 };
  const results = consolidated({ resultRules: { rankScope: "division" } }, [paper, gradePaper], candidates.slice(0, 1), [mark("s1", 60)]);
  assert.equal(results[0].complete, false); assert.equal(results[0].total, null); assert.equal(results[0].rank, null);
});
test("zero is entered, pass criteria are preserved and stale verification cannot publish", () => {
  const row = consolidated({}, [paper], candidates.slice(0, 1), [mark("s1", 0)])[0];
  assert.equal(row.total, 10); assert.equal(row.passed, false); assert.equal(row.complete, true);
  const stale = { ...mark("s1", 60), theory: 61 };
  assert.equal(readyForReport(consolidated({}, [paper], candidates.slice(0, 1), [stale])[0]), false);
});
test("grade-only and exemptions stay out of numeric totals; absence follows rules", () => {
  const result = assessMark({ theory: null, internal: null, status: "Absent" }, paper);
  assert.equal(overallResult([{ paper, result }], { absentRule: "incomplete" }).complete, false);
  assert.equal(overallResult([{ paper, result }], { absentRule: "zero" }).pct, 0);
  assert.equal(assessMark({ theory: null, internal: 10, status: "Medical Slip" }, { ...paper, theory: 0 }).state, "medical");
});
