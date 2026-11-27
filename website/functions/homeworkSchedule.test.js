const test = require("node:test");
const assert = require("node:assert/strict");
const { live, notHandedIn, reminderFor, publishDue } = require("./homeworkSchedule");

const at = (iso) => Date.parse(iso); // UTC instants; India is +05:30
const hw = (extra = {}) => ({ status: "open", due: "2026-11-30", classId: "c", ...extra });

test("two days before the due day the parents are reminded, on the day the teacher; never before 08:00 India time", () => {
  assert.equal(reminderFor(hw(), at("2026-11-28T03:00:00Z")), "parents2d"); // 08:30 IST on the 28th
  assert.equal(reminderFor(hw(), at("2026-11-28T01:00:00Z")), null, "06:30 IST is too early");
  assert.equal(reminderFor(hw(), at("2026-11-30T04:00:00Z")), "teacherDue");
  assert.equal(reminderFor(hw(), at("2026-11-29T04:00:00Z")), null, "the day before: nothing");
  assert.equal(reminderFor(hw({ status: "closed" }), at("2026-11-30T04:00:00Z")), null);
  assert.equal(reminderFor(hw({ status: "scheduled" }), at("2026-11-28T03:00:00Z")), null);
});

test("only students who have not handed in are reminded", () => {
  const roster = [{ id: "a" }, { id: "b" }, { id: "c" }, { id: "d" }];
  const h = hw({ submissions: { a: { status: "graded" }, b: { status: "pending" }, c: { status: "submitted" } }, handins: { b: { files: [] } } });
  assert.deepEqual(notHandedIn(h, roster).map((s) => s.id), ["d"]);
});

test("scheduled homework is published once its time has come", () => {
  const h = { status: "scheduled", publishAt: "2026-11-27T08:00:00+05:30" };
  assert.equal(publishDue(h, at("2026-11-27T02:29:00Z")), false);
  assert.equal(publishDue(h, at("2026-11-27T02:30:00Z")), true);
  assert.equal(publishDue({ ...h, deleted: true }, at("2026-11-28T00:00:00Z")), false);
  assert.equal(publishDue({ status: "open", publishAt: h.publishAt }, at("2026-11-28T00:00:00Z")), false);
  assert.equal(live({ status: "Published" }), true);
  assert.equal(live({ status: "scheduled" }), false);
});
