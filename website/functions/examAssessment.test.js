const test = require("node:test");
const assert = require("node:assert/strict");
const { assessMark, overallResult, markFingerprint } = require("./examAssessment");
const mark = { theory: 40, practical: 10, internal: 10, verified: false, medical: false };
const paper = { theory: 50, practical: 30, internal: 20, passMarks: 50, scale: "Percentage only" };
test("uses practical and per-subject pass marks rather than a fixed percentage", () => {
  assert.equal(assessMark(mark, paper).total, 60);
  assert.equal(assessMark(mark, { ...paper, passMarks: 70 }).state, "failed");
  assert.equal(assessMark(mark, { ...paper, practicalPass: 15, resultRules: { passCriteria: "components" } }).state, "failed");
  assert.equal(assessMark({ ...mark, practical: null }, paper).state, "pending");
  assert.equal(assessMark({ ...mark, status: "Exempt" }, paper).state, "exempt");
});
test("records descriptors without treating them as zero and handles absence separately", () => {
  const graded = { ...paper, assessmentMode: "grade", gradeOptions: ["Developing", "Secure"] };
  assert.equal(assessMark({ ...mark, gradeValue: "Secure" }, graded).grade, "Secure");
  assert.equal(assessMark({ ...mark, gradeValue: "A" }, graded).state, "invalid");
  assert.equal(assessMark({ ...mark, status: "Absent" }, graded).grade, "AB");
  assert.equal(assessMark(undefined, { ...paper, theory: 0, internal: 0, practical: 20 }).state, "pending");
});
test("applies total, average and weighted calculation with explicit rounding", () => {
  const p1 = { theory: 100, internal: 0, weight: 3 };
  const p2 = { theory: 50, internal: 0, weight: 1 };
  const entries = [
    { paper: p1, result: assessMark({ ...mark, theory: 80 }, p1) },
    { paper: p2, result: assessMark({ ...mark, theory: 20 }, p2) },
  ];
  assert.equal(overallResult(entries, { calculation: "total", rounding: "one-decimal" }).pct, 66.7);
  assert.equal(overallResult(entries, { calculation: "average" }).pct, 60);
  assert.equal(overallResult(entries, { calculation: "weighted" }).pct, 70);
});
test("invalidates verification when a teacher changes reviewed marks", () => {
  const configured = { ...paper, setupVersion: 2 };
  const reviewed = { ...mark, verified: true, verificationFingerprint: markFingerprint(mark, configured) };
  assert.equal(assessMark(reviewed, configured).state, "verified");
  assert.equal(assessMark({ ...reviewed, theory: 30 }, configured).state, "passed");
});
