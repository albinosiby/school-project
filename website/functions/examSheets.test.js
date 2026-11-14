const { test } = require("node:test");
const assert = require("node:assert/strict");
const { sheetId, resolveOwner, buildSheets, sheetSummary, completeness, allowedTransition, classLabelOf } = require("./examSheets");
const cycle = { id: "c1", classIds: ["cls_9A", "cls_9B"] };
const paper = { id: "p1", cycleId: "c1", subject: "Maths", code: "MAT", grade: "9", classIds: ["cls_9A", "cls_9B"], theory: 80, internal: 20, passMarks: 33, evaluatorIds: { cls_9A: "t_eval" } };
const classes = [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "t_ct" }, { id: "cls_9B", grade: "9", section: "B", classTeacherId: "t_ctB" }];
const assignments = [{ classId: "cls_9B", subject: "maths", teacherId: "t_asg" }, { classId: "cls_9B", subject: "Science", teacherId: "t_sci" }];
const students = [
  { id: "s1", classId: "cls_9A", status: "Active" }, { id: "s2", classId: "cls_9A" }, { id: "s3", classId: "cls_9A", status: "Left" },
  { id: "s4", classId: "cls_9B" }, { id: "s5", classId: "cls_9B", deleted: true },
];
test("sheet ids and owner resolution follow evaluator → assignment → class teacher → unassigned", () => {
  assert.equal(sheetId("p1", "cls_9A"), "p1__cls_9A");
  assert.equal(resolveOwner(paper, "cls_9A", assignments, classes), "t_eval");
  assert.equal(resolveOwner(paper, "cls_9B", assignments, classes), "t_asg");
  assert.equal(resolveOwner({ ...paper, evaluatorIds: {} }, "cls_9B", [], classes), "t_ctB");
  assert.equal(resolveOwner({ ...paper, evaluatorIds: {} }, "cls_9C", [], classes), "");
  assert.equal(classLabelOf("cls_9A", classes), "9-A");
  assert.equal(classLabelOf("custom", [{ id: "custom", grade: "11", section: "C" }]), "11-C");
});
test("buildSheets creates one sheet per live paper × division, rosters active participants and is idempotent", () => {
  const cancelled = { ...paper, id: "p2", scheduleStatus: "Cancelled" };
  const restricted = { ...paper, id: "p3", studentIds: ["s4"], classIds: [] };
  const sheets = buildSheets(cycle, [paper, cancelled, restricted], students, assignments, classes, [], { now: "2026-11-12T00:00:00.000Z", staff: [{ id: "t_eval", name: "Eva" }] });
  assert.deepEqual(sheets.map((s) => s.id), ["p1__cls_9A", "p1__cls_9B", "p3__cls_9A", "p3__cls_9B"]);
  const first = sheets[0];
  assert.deepEqual(first.rosterIds, ["s1", "s2"]);
  assert.equal(first.ownerId, "t_eval"); assert.equal(first.ownerName, "Eva"); assert.equal(first.status, "NotStarted");
  assert.equal(first.classLabel, "9-A"); assert.equal(first.summary.total, 2); assert.equal(first.components.theory, 80);
  assert.deepEqual(sheets[3].rosterIds, ["s4"]); assert.deepEqual(sheets[2].rosterIds, []);
  assert.deepEqual(buildSheets(cycle, [paper], students, assignments, classes, ["p1__cls_9A"]).map((s) => s.id), ["p1__cls_9B"]);
  const graded = buildSheets(cycle, [{ ...paper, assessmentMode: "grade", gradeOptions: ["A", "B"] }], students, [], classes)[0];
  assert.deepEqual(graded.components, { mode: "grade", theory: 0, practical: 0, internal: 0, passMarks: 33, gradeOptions: ["A", "B"] });
});
test("summary and completeness count states against the roster", () => {
  const sheet = { paperId: "p1", rosterIds: ["s1", "s2", "s3", "s4"], components: { mode: "marks", theory: 80, internal: 20, practical: 0 } };
  const marks = [
    { paperId: "p1", studentId: "s1", theory: 60, internal: 10 },
    { paperId: "p1", candId: "cand_s2", status: "Absent" },
    { paperId: "p1", studentId: "s3", theory: 99, internal: 5 },
    { paperId: "other", studentId: "s4", theory: 1, internal: 1 },
  ];
  assert.deepEqual(sheetSummary(sheet, marks, paper), { total: 4, entered: 3, absent: 1, medical: 0, exempt: 0, outOfRange: 1, highest: 70, lowest: 70, mean: 70 });
  assert.deepEqual(completeness(sheet, marks, paper), { missing: 2, ids: ["s3", "s4"] });
  assert.deepEqual(completeness(sheet, [...marks, { paperId: "p1", studentId: "s4", status: "Medical Slip" }, { paperId: "p1", studentId: "s3", theory: 20, internal: 5 }]), { missing: 0, ids: [] });
  assert.equal(sheetSummary({ ...sheet, rosterIds: [] }, [], paper).mean, null);
});
test("transition table by actor", () => {
  assert.equal(allowedTransition("", "NotStarted", "admin"), true);
  assert.equal(allowedTransition(null, "NotStarted", "teacher"), false);
  for (const from of ["NotStarted", "InProgress", "Returned"]) {
    assert.equal(allowedTransition(from, "Submitted", "teacher"), true);
    assert.equal(allowedTransition(from, "Submitted", "admin"), true);
    assert.equal(allowedTransition(from, "Approved", "admin"), false);
  }
  assert.equal(allowedTransition("Submitted", "Submitted", "teacher"), false);
  assert.equal(allowedTransition("Submitted", "Approved", "teacher"), false);
  assert.equal(allowedTransition("Submitted", "Approved", "admin"), true);
  assert.equal(allowedTransition("Submitted", "Returned", "admin"), true);
  assert.equal(allowedTransition("Approved", "Returned", "admin"), true);
  assert.equal(allowedTransition("Locked", "Returned", "admin"), true);
  assert.equal(allowedTransition("Locked", "Approved", "admin"), false);
  assert.equal(allowedTransition("NotStarted", "InProgress", "server"), true);
  assert.equal(allowedTransition("Approved", "Locked", "server"), true);
  assert.equal(allowedTransition("Submitted", "Locked", "server"), false);
  assert.equal(allowedTransition("Approved", "Bogus", "admin"), false);
});
