const { test } = require("node:test");
const assert = require("node:assert/strict");
const { compileClass, termAggregate, nextVersion, candidateOf } = require("./examResults");
const { markFingerprint } = require("./examAssessment");
const cycle = { id: "c1", termId: "term1", examTypeId: "pt1", resultRules: { rankScope: "division", absentRule: "incomplete", rounding: "one-decimal" }, scale: "Percentage only" };
const papers = [
  { id: "p1", cycleId: "c1", subject: "Maths", code: "MAT", grade: "9", classIds: ["cls_9A"], theory: 80, internal: 20, passMarks: 33, weight: 1 },
  { id: "p2", cycleId: "c1", subject: "Art", grade: "9", classIds: ["cls_9A"], assessmentMode: "grade", gradeOptions: ["A", "B"], theory: 0, internal: 0 },
  { id: "p3", cycleId: "c1", subject: "Gone", grade: "9", classIds: ["cls_9A"], scheduleStatus: "Cancelled", theory: 50, internal: 0 },
];
const students = [
  { id: "s1", name: "One", grade: "9", section: "A", classId: "cls_9A", roll: 1, grn: "G1" },
  { id: "s2", name: "Two", grade: "9", section: "A", classId: "cls_9A", roll: 2 },
  { id: "s3", name: "Other", grade: "9", section: "B", classId: "cls_9B", roll: 1 },
];
const mark = (studentId, data) => ({ paperId: "p1", studentId, candId: "cand_" + studentId, ...data });
const marks = [mark("s1", { theory: 70, internal: 15 }), mark("s2", { theory: 10, internal: 5 }), { paperId: "p2", studentId: "s1", gradeValue: "A" }, { paperId: "p2", studentId: "s2", gradeValue: "B" }];
test("compileClass restricts rows to the division, keeps subject detail, ranks and summarises", () => {
  const { results, classResult, sourceHash, version } = compileClass(cycle, papers, students.map(candidateOf), marks, [], "cls_9A", { examType: { short: "PT1", weight: 10, countsInTerm: true } });
  assert.deepEqual(results.map((r) => r.id), ["c1__s1", "c1__s2"]);
  const one = results[0];
  assert.equal(one.classLabel, "9-A"); assert.equal(one.termId, "term1"); assert.equal(one.examTypeId, "pt1"); assert.equal(one.grn, "G1");
  assert.deepEqual(one.subjects.map((s) => s.paperId), ["p1", "p2"]);
  assert.deepEqual(one.subjects[0], { paperId: "p1", subject: "Maths", code: "MAT", mode: "marks", theory: 70, practical: null, internal: 15, gradeValue: "", total: 85, max: 100, pct: 85, grade: "A2", state: "passed", passed: true, weight: 1 });
  assert.equal(one.subjects[1].mode, "grade"); assert.equal(one.subjects[1].grade, "A"); assert.equal(one.subjects[1].max, 0);
  assert.equal(one.total, 85); assert.equal(one.pct, 85); assert.equal(one.passed, true); assert.equal(one.rank, 1); assert.equal(one.complete, true);
  assert.deepEqual(one.term, { termId: "term1", contributions: [{ cycleId: "c1", examTypeId: "pt1", short: "PT1", weight: 10, pct: 85 }], pct: 85 });
  assert.equal(results[1].passed, false); assert.equal(results[1].rank, 2);
  assert.deepEqual(classResult, { id: "c1__cls_9A", cycleId: "c1", classId: "cls_9A", classLabel: "9-A", students: 2, passed: 1, failed: 1, incomplete: 0, passPct: 50, stale: false, sourceHash });
  assert.equal(version, 1); assert.equal(one.sourceHash, sourceHash); assert.equal(one.status, undefined);
  assert.equal(compileClass(cycle, papers, students.map(candidateOf), marks, [], "cls_9A").sourceHash, sourceHash);
  assert.notEqual(compileClass(cycle, papers, students.map(candidateOf), [marks[0], ...marks.slice(2)], [], "cls_9A").sourceHash, sourceHash);
});
test("incomplete students, no term and rank scope none", () => {
  const plain = { id: "c2", resultRules: { rankScope: "none" } };
  const { results, classResult } = compileClass(plain, papers, students.map(candidateOf), [marks[0]], [], "cls_9A");
  assert.equal(results[0].complete, false); assert.equal(results[0].rank, null); assert.equal(results[0].term, null);
  assert.equal(classResult.incomplete, 2); assert.equal(classResult.passPct, null);
});
test("termAggregate weights live results of the term, one per cycle, skipping types that do not count", () => {
  const types = { pt1: { short: "PT1", weight: 10, countsInTerm: true }, half: { short: "HY", weight: 30, countsInTerm: true }, mock: { short: "Mock", weight: 50, countsInTerm: false } };
  const rows = [
    { id: "a__s1", cycleId: "a", examTypeId: "pt1", termId: "term1", status: "Published", pct: 80 },
    { id: "a__s1__v1", cycleId: "a", examTypeId: "pt1", termId: "term1", status: "Published", pct: 10 },
    { id: "b__s1", cycleId: "b", examTypeId: "half", termId: "term1", status: "Compiled", pct: 60 },
    { id: "c__s1", cycleId: "c", examTypeId: "mock", termId: "term1", status: "Published", pct: 1 },
    { id: "d__s1", cycleId: "d", examTypeId: "half", termId: "term1", status: "Superseded", pct: 1 },
    { id: "e__s1", cycleId: "e", examTypeId: "half", termId: "term1", status: "Approved", pct: null },
  ];
  const term = termAggregate(rows, types, "one-decimal");
  assert.deepEqual(term.contributions.map((c) => [c.cycleId, c.weight, c.pct]), [["a", 10, 80], ["b", 30, 60]]);
  assert.equal(term.pct, 65); assert.equal(term.termId, "term1");
  assert.equal(termAggregate([], types), null);
  assert.equal(termAggregate([{ id: "x", cycleId: "x", status: "Published", pct: 50 }], {}).pct, 50);
});
test("versions advance only after a publication", () => {
  assert.equal(nextVersion(null), 1);
  assert.equal(nextVersion({ status: "Compiled", version: 2 }), 2);
  assert.equal(nextVersion({ status: "Approved", version: 2 }), 2);
  assert.equal(nextVersion({ status: "Published", version: 2 }), 3);
  assert.equal(nextVersion({ status: "Published" }), 2);
  const previous = [{ id: "c1__cls_9A", classId: "cls_9A", status: "Published", version: 3 }];
  assert.equal(compileClass(cycle, papers, students.map(candidateOf), marks, [], "cls_9A", { previousResults: previous }).version, 4);
});
