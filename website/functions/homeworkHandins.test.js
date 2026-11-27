const test = require("node:test");
const assert = require("node:assert/strict");
const { handinFrom, homeworkOpen, mergedSubmission } = require("./homeworkHandins");

const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const ctx = { sid: "S1", homeworkId: "hw1", studentId: "stu1", due: "2026-11-26", today: "2026-11-26" };
const file = (name, type = "image/jpeg", path = `schools/S1/homework/hw1/stu1/1_${name}`) => ({ name, type, path, url: `https://x/${name}`, size: 10 });

test("only the student's own uploads of allowed types are kept; late after the due day", () => {
  const h = handinFrom({
    studentId: "stu1", homeworkId: "hw1", uid: "p1", note: "  page 2 is the diagram  ", submittedAt: "2026-11-26T10:00:00Z",
    files: [file("a.jpg"), file("b.pdf", "application/pdf"), file("c.exe", "application/x-msdownload"),
      file("d.jpg", "image/jpeg", "schools/S1/homework/hw1/stu2/1_d.jpg"), file("e.jpg", "image/jpeg", "schools/S1/homework/hw1/stu1/sub/e.jpg")],
  }, ctx);
  assert.deepEqual(h.files.map((f) => f.name), ["a.jpg", "b.pdf"]);
  assert.equal(h.note, "page 2 is the diagram");
  assert.equal(h.late, false);
  assert.equal(handinFrom({ studentId: "stu1", homeworkId: "hw1", files: [file("a.jpg")] }, { ...ctx, today: "2026-11-27" }).late, true);
  assert.equal(handinFrom({ studentId: "stu1", homeworkId: "hw1", files: [] }, ctx), null);
  assert.equal(handinFrom({ studentId: "stu9", homeworkId: "hw1", files: [file("a.jpg")] }, ctx), null);
});

test("open homework accepts hand-ins; closed, completed, draft and deleted do not", () => {
  assert.equal(homeworkOpen({ status: "open" }), true);
  assert.equal(homeworkOpen({ status: "Published" }), true);
  for (const h of [{ status: "closed" }, { status: "Completed" }, { status: "Draft" }, { deleted: true }, null]) assert.equal(homeworkOpen(h), false);
});

test("parents see the hand-in merged with the teacher's grading", () => {
  const hi = { files: [file("a.jpg")], note: "n", submittedAt: "2026-11-26T10:00:00Z", late: false };
  assert.deepEqual(mergedSubmission({ submissions: {}, handins: { stu1: hi } }, "stu1", clean),
    { status: "submitted", files: hi.files, note: "n", submittedAt: hi.submittedAt, late: false });
  const graded = mergedSubmission({ submissions: { stu1: { status: "graded", marks: 18, feedback: "Good" } }, handins: { stu1: hi } }, "stu1", clean);
  assert.equal(graded.status, "graded");
  assert.equal(graded.marks, 18);
  assert.equal(graded.files.length, 1);
  assert.deepEqual(mergedSubmission({}, "stu1", clean), { status: "pending" });
  assert.equal(mergedSubmission({ submissions: { stu1: { status: "submitted" } } }, "stu1", clean).status, "submitted", "paper hand-in marked by the teacher");
});
