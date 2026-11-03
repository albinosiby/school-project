import { describe, expect, it } from "vitest";
import {
  adminDayId, adminDayRecord, attPct, attendanceSaveError, busyReason, classTeacherElsewhere, coverCandidates, dayRecords, derive, filterLive, findSlotTaken,
  findTeacherClash, hwCounts, hwState, joinLink, latestPerDate, latestRecord, liveState, meetLinkError, nextSubStatus, normalizeMeetLink, periodClass, periodId,
  roomTakenBy, safeLink, subId, subStatus, tsMs, validateAssignment, validateClass, validateHomework, validatePeriod, validateSubstitution,
  type AttRec, type ClassRow, type HW, type LiveClass, type Period, type Substitution,
} from "./logic";

// ---------------------------------------------------------------------------------------------------------------------
describe("attendance derive()", () => {
  it("counts A/L/E from marks and the rest of total as present (absent key = present)", () => {
    expect(derive({ total: 40, marks: { s1: "A", s2: "A", s3: "L", s4: "E" } })).toEqual({ A: 2, L: 1, E: 1, P: 36, total: 40 });
  });
  it("an empty or missing marks map means everyone is present", () => {
    expect(derive({ total: 30, marks: {} })).toEqual({ A: 0, L: 0, E: 0, P: 30, total: 30 });
    expect(derive({ total: 30 })).toEqual({ A: 0, L: 0, E: 0, P: 30, total: 30 });
    expect(derive({ total: 30, marks: null })).toMatchObject({ P: 30 });
  });
  it("ignores explicit P and unknown codes", () => {
    expect(derive({ total: 3, marks: { a: "P", b: "H", c: "A" } })).toEqual({ A: 1, L: 0, E: 0, P: 2, total: 3 });
  });
  it("never reports negative present when marks exceed total", () => {
    expect(derive({ total: 1, marks: { a: "A", b: "A" } })).toEqual({ A: 2, L: 0, E: 0, P: 0, total: 1 });
  });
  it("tolerates a string / missing / negative total", () => {
    expect(derive({ total: "5", marks: { a: "L" } })).toMatchObject({ P: 4, total: 5 });
    expect(derive({ marks: { a: "A" } })).toMatchObject({ P: 0, total: 0 });
    expect(derive({ total: -3 })).toMatchObject({ total: 0, P: 0 });
  });
});

describe("attendance %", () => {
  it("present + late count as attended, rounded", () => {
    expect(attPct({ P: 30, L: 3, total: 40 })).toBe(83); // 82.5
    expect(attPct({ P: 2, L: 0, total: 3 })).toBe(67);
    expect(attPct({ P: 40, L: 0, total: 40 })).toBe(100);
  });
  it("is 0 for an empty class (no division by zero)", () => expect(attPct({ P: 0, L: 0, total: 0 })).toBe(0));
  it("works on derive() output", () => expect(attPct(derive({ total: 10, marks: { a: "A", b: "E", c: "L" } }))).toBe(80));
});

const rec = (p: Partial<AttRec>): AttRec => ({ id: "x", date: "2026-11-03", classId: "cls_10B", period: 1, total: 40, marks: {}, ...p });

describe("newest record per class/date", () => {
  it("picks the newest updatedAt", () => {
    const a = rec({ id: "a", period: 3, updatedAt: "2026-11-03T09:00:00Z" }), b = rec({ id: "b", period: 1, updatedAt: "2026-11-03T10:00:00Z" });
    expect(latestRecord([a, b])?.id).toBe("b");
  });
  it("ties go to the higher period", () => {
    const t = "2026-11-03T09:00:00Z";
    expect(latestRecord([rec({ id: "p2", period: 2, updatedAt: t }), rec({ id: "p5", period: 5, updatedAt: t }), rec({ id: "p0", period: 0, updatedAt: t })])?.id).toBe("p5");
    expect(latestRecord([rec({ id: "p1", period: 1 }), rec({ id: "p4", period: 4 })])?.id).toBe("p4"); // both without updatedAt
  });
  it("ignores drafts (submitted:false) and soft-deleted records, keeps records without the flag", () => {
    const rows = [
      rec({ id: "draft", period: 6, submitted: false, updatedAt: "2026-11-03T12:00:00Z" }),
      rec({ id: "gone", period: 7, deleted: true, updatedAt: "2026-11-03T13:00:00Z" }),
      rec({ id: "ok", period: 2, updatedAt: "2026-11-03T08:00:00Z" }),
    ];
    expect(latestRecord(rows)?.id).toBe("ok");
    expect(dayRecords(rows, "cls_10B", "2026-11-03").map((r) => r.id)).toEqual(["ok"]);
    expect(latestRecord([rows[0]!, rows[1]!])).toBeUndefined();
  });
  it("mixes ISO strings, epoch ms and Timestamps", () => {
    const iso = rec({ id: "iso", updatedAt: "2026-11-03T09:00:00Z" });
    const ms = rec({ id: "ms", updatedAt: Date.parse("2026-11-03T09:30:00Z") });
    const fs = rec({ id: "fs", updatedAt: { toMillis: () => Date.parse("2026-11-03T09:15:00Z") } });
    expect(latestRecord([iso, fs, ms])?.id).toBe("ms");
    expect(tsMs({ seconds: 10 })).toBe(10000);
    expect(tsMs("garbage")).toBe(0);
    expect(tsMs(new Date(5))).toBe(5);
    expect(tsMs(undefined)).toBe(0);
  });
  it("the admin day record (period 0) wins when it is newer", () => {
    const teacher = rec({ id: "2026-11-03_cls_10B_3", period: 3, updatedAt: "2026-11-03T09:00:00Z" });
    const admin = rec({ id: adminDayId("2026-11-03", "cls_10B"), period: 0, markedBy: "admin", updatedAt: "2026-11-03T11:00:00Z" });
    expect(latestRecord([teacher, admin])?.id).toBe("2026-11-03_cls_10B_0");
  });
  it("dayRecords filters by class and date", () => {
    const rows = [rec({ id: "a" }), rec({ id: "b", classId: "cls_9A" }), rec({ id: "c", date: "2026-11-02" })];
    expect(dayRecords(rows, "cls_10B", "2026-11-03").map((r) => r.id)).toEqual(["a"]);
  });
  it("latestPerDate keeps one deciding record per date, newest date first, limited", () => {
    const rows = [
      rec({ id: "d1p1", date: "2026-11-01", period: 1 }), rec({ id: "d1p4", date: "2026-11-01", period: 4 }),
      rec({ id: "d2", date: "2026-11-02" }), rec({ id: "d3draft", date: "2026-11-03", submitted: false }), rec({ id: "other", classId: "cls_8A", date: "2026-11-04" }),
    ];
    expect(latestPerDate(rows, "cls_10B").map((r) => r.id)).toEqual(["d2", "d1p4"]);
    expect(latestPerDate(rows, "cls_10B", 1).map((r) => r.id)).toEqual(["d2"]);
  });
});

describe("admin attendance record and save checks", () => {
  it("lists only non-present students of the roster, period 0, markedBy admin", () => {
    const body = adminDayRecord({ date: "2026-11-03", grade: "10", section: "B", rosterIds: ["s1", "s2", "s3", "s4"], marks: { s1: "P", s2: "A", s3: "L", s4: "E", ghost: "A" } });
    expect(body).toEqual({ date: "2026-11-03", classId: "cls_10B", grade: "10", section: "B", period: 0, total: 4, marks: { s2: "A", s3: "L", s4: "E" }, submitted: true, teacherId: "", markedBy: "admin" });
    expect(adminDayId("2026-11-03", "cls_10B")).toBe("2026-11-03_cls_10B_0");
  });
  it("explains why the roll cannot be saved", () => {
    const base = { date: "2026-11-03", today: "2026-11-03", rosterSize: 3, marked: 3 };
    expect(attendanceSaveError(base)).toBe("");
    expect(attendanceSaveError({ ...base, rosterSize: 0, marked: 0 })).toBe("No students in this class");
    expect(attendanceSaveError({ ...base, date: "2026-11-04" })).toBe("Attendance cannot be saved for a future date");
    expect(attendanceSaveError({ ...base, date: "" })).toBe("Pick a valid date");
    expect(attendanceSaveError({ ...base, marked: 1 })).toBe("Mark all 3 students before saving (2 left)");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const per = (p: Partial<Period>): Period => ({ id: "p", grade: "10", section: "B", classId: "cls_10B", day: "Mon", period: 1, subject: "Mathematics", teacher: "A", teacherId: "stf_1", room: "", ...p });

describe("timetable clash detection", () => {
  const rows = [
    per({ id: "per_10B_Mon_1", teacherId: "stf_1" }),
    per({ id: "per_10A_Mon_2", classId: "cls_10A", grade: "10", section: "A", period: 2, teacherId: "stf_1" }),
    per({ id: "legacy", classId: undefined, grade: "9", section: "A", period: 3, teacherId: undefined, teacher: "Mr. Old" }),
  ];
  it("finds the teacher double-booked in another class at the same time", () => {
    expect(findTeacherClash(rows, { classId: "cls_10B", day: "Mon", period: 2, teacherId: "stf_1" })?.id).toBe("per_10A_Mon_2");
  });
  it("no clash in another slot, with another teacher, or with the row itself", () => {
    expect(findTeacherClash(rows, { classId: "cls_10B", day: "Tue", period: 2, teacherId: "stf_1" })).toBeUndefined();
    expect(findTeacherClash(rows, { classId: "cls_10B", day: "Mon", period: 2, teacherId: "stf_2" })).toBeUndefined();
    expect(findTeacherClash(rows, { id: "per_10A_Mon_2", classId: "cls_10A", day: "Mon", period: 2, teacherId: "stf_1" })).toBeUndefined();
  });
  it("the same class in the same slot is a slot conflict, not a teacher clash", () => {
    expect(findTeacherClash(rows, { classId: "cls_10B", day: "Mon", period: 1, teacherId: "stf_1" })).toBeUndefined();
    expect(findSlotTaken(rows, { classId: "cls_10B", day: "Mon", period: 1 })?.id).toBe("per_10B_Mon_1");
    expect(findSlotTaken(rows, { id: "per_10B_Mon_1", classId: "cls_10B", day: "Mon", period: 1 })).toBeUndefined();
    expect(findSlotTaken(rows, { classId: "cls_10B", day: "Mon", period: 4 })).toBeUndefined();
  });
  it("matches legacy rows by teacher name and derives their class", () => {
    expect(periodClass(rows[2]!)).toBe("cls_9A");
    expect(findTeacherClash(rows, { classId: "cls_10B", day: "Mon", period: 3, teacher: "Mr. Old" })?.id).toBe("legacy");
    expect(findSlotTaken(rows, { classId: "cls_9A", day: "Mon", period: 3 })?.id).toBe("legacy");
  });
  it("a slot without any teacher never clashes", () => {
    expect(findTeacherClash([per({ id: "n", classId: "cls_9A", teacherId: "", teacher: "" })], { classId: "cls_10B", day: "Mon", period: 1, teacherId: "", teacher: "" })).toBeUndefined();
  });
  it("tolerates string period numbers", () => {
    expect(findSlotTaken([per({ id: "s", period: "5" as unknown as number })], { classId: "cls_10B", day: "Mon", period: 5 })?.id).toBe("s");
  });
  it("builds per_10B_Mon_3 ids", () => expect(periodId("10", "b", "Mon", 3)).toBe("per_10B_Mon_3"));
  it("validates day, period, subject and teacher", () => {
    expect(validatePeriod({ day: "Mon", period: 1, subject: "Maths", teacherId: "stf_1" })).toEqual({});
    expect(validatePeriod({ day: "Sat", period: 8, subject: "Maths", teacherId: "stf_1" })).toEqual({});
    expect(validatePeriod({ day: "Sun", period: 0, subject: " ", teacherId: "" })).toEqual({ day: "Day must be Mon–Sat", period: "Period must be 1–8", subject: "Pick a subject", teacherId: "Pick a teacher" });
    expect(validatePeriod({ day: "mon", period: 9, subject: "x", teacherId: "t" })).toEqual({ day: "Day must be Mon–Sat", period: "Period must be 1–8" });
    expect(validatePeriod({ day: "Mon", period: 2.5, subject: "x", teacherId: "t" }).period).toBe("Period must be 1–8");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const sub = (p: Partial<Substitution>): Substitution => ({ id: "s", date: "2026-11-09", day: "Mon", period: 2, classId: "cls_9A", subject: "Science", absentTeacherId: "stf_9", substituteTeacherId: "stf_2", status: "Assigned", ...p });

describe("substitutions", () => {
  it("builds sub_{date}_{classId}_{period} ids", () => expect(subId("2026-11-09", "cls_10B", 3)).toBe("sub_2026-11-09_cls_10B_3"));
  it("normalises status strings to Assigned/Accepted/Declined", () => {
    expect(subStatus("Accepted")).toBe("Accepted");
    expect(subStatus("declined")).toBe("Declined");
    expect(subStatus("pending")).toBe("Assigned");
    expect(subStatus(undefined)).toBe("Assigned");
  });
  it("a reassignment starts over as Assigned; the same accepted substitute stays Accepted", () => {
    expect(nextSubStatus(undefined, "stf_2")).toBe("Assigned");
    expect(nextSubStatus({ substituteTeacherId: "stf_2", status: "Accepted" }, "stf_2")).toBe("Accepted");
    expect(nextSubStatus({ substituteTeacherId: "stf_2", status: "Accepted" }, "stf_3")).toBe("Assigned");
    expect(nextSubStatus({ substituteTeacherId: "stf_2", status: "Declined" }, "stf_2")).toBe("Assigned");
  });

  describe("free-teacher calculation (2026-11-09 is a Monday)", () => {
    const periods = [per({ id: "t1", classId: "cls_8A", day: "Mon", period: 2, teacherId: "stf_1" }), per({ id: "t2", classId: "cls_8A", day: "Tue", period: 2, teacherId: "stf_3" })];
    const ctx = { date: "2026-11-09", period: 2, classId: "cls_10B", periods, subs: [] as Substitution[] };
    it("busy when teaching another class in that period on that weekday", () => {
      expect(busyReason("stf_1", ctx)).toBe("teaching Grade 8-A");
      expect(busyReason("stf_3", ctx)).toBe(""); // teaches on Tuesday only
      expect(busyReason("stf_1", { ...ctx, period: 3 })).toBe("");
    });
    it("busy when already covering another class then, unless that cover was declined or is the one being edited", () => {
      const subs = [sub({ id: "c1", substituteTeacherId: "stf_4", classId: "cls_9A" })];
      expect(busyReason("stf_4", { ...ctx, subs })).toBe("covering Grade 9-A");
      expect(busyReason("stf_4", { ...ctx, subs: [{ ...subs[0]!, status: "Declined" }] })).toBe("");
      expect(busyReason("stf_4", { ...ctx, subs, editId: "c1" })).toBe("");
      expect(busyReason("stf_4", { ...ctx, subs: [{ ...subs[0]!, date: "2026-11-10" }] })).toBe("");
    });
    it("busy when absent that day or on approved leave", () => {
      expect(busyReason("stf_9", { ...ctx, subs: [sub({ id: "c2", period: 5, absentTeacherId: "stf_9" })] })).toBe("absent that day");
      const leaves = [{ id: "l1", staffId: "stf_5", from: "2026-11-08", to: "2026-11-10", status: "Approved" }, { id: "l2", staffId: "stf_6", from: "2026-11-09", to: "2026-11-09", status: "Pending" }];
      expect(busyReason("stf_5", { ...ctx, leaves })).toBe("on approved leave");
      expect(busyReason("stf_6", { ...ctx, leaves })).toBe("");
      expect(busyReason("stf_5", { ...ctx, date: "2026-11-11", leaves })).toBe("");
    });
    it("candidates exclude the absent teacher and carry the busy reason", () => {
      const t = [{ id: "stf_1" }, { id: "stf_3" }, { id: "stf_9" }];
      expect(coverCandidates(t, "stf_9", (id) => busyReason(id, ctx))).toEqual([{ id: "stf_1", busy: "teaching Grade 8-A" }, { id: "stf_3", busy: "" }]);
    });
  });

  it("validates the form", () => {
    const ok = { date: "2026-11-09", today: "2026-11-03", isNew: true, hasSlot: true, absentTeacherId: "stf_9", substituteId: "stf_2", busy: "" };
    expect(validateSubstitution(ok)).toEqual({});
    expect(validateSubstitution({ ...ok, date: "2026-11-08" }).date).toBe("No classes on Sunday");
    expect(validateSubstitution({ ...ok, date: "2026-11-02" }).date).toBe("Date cannot be in the past");
    expect(validateSubstitution({ ...ok, date: "2026-11-02", isNew: false })).toEqual({});
    expect(validateSubstitution({ ...ok, hasSlot: false }).period).toBe("Pick a period");
    expect(validateSubstitution({ ...ok, existing: { substituteName: "Mr. X" } }).period).toBe("This period already has a substitute (Mr. X). Use Reassign.");
    expect(validateSubstitution({ ...ok, substituteId: "" }).substitute).toBe("Pick a substitute teacher");
    expect(validateSubstitution({ ...ok, substituteId: "stf_9" }).substitute).toBe("The substitute must be someone other than the absent teacher");
    expect(validateSubstitution({ ...ok, busy: "teaching Grade 8-A" }).substitute).toBe("Busy: teaching Grade 8-A");
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const live = (p: Partial<LiveClass>): LiveClass => ({ id: "l", title: "T", classId: "cls_10B", subject: "Maths", teacherId: "stf_1", date: "2026-11-03", time: "10:00", mins: 40, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", ...p });
const at = (hhmm: string, date = "2026-11-03") => new Date(`${date}T${hhmm}:00`);

describe("live class status from the clock", () => {
  it("Upcoming until 10 minutes before start", () => {
    expect(liveState(live({}), at("09:49"))).toBe("Upcoming");
    expect(liveState(live({}), at("09:50"))).toBe("Live");
  });
  it("Live through the session, Ended at start + mins", () => {
    expect(liveState(live({}), at("10:39"))).toBe("Live");
    expect(liveState(live({}), at("10:40"))).toBe("Ended");
    expect(liveState(live({}), at("09:00", "2026-11-04"))).toBe("Ended");
  });
  it("ignores a stale stored status, except draft / cancelled / deleted", () => {
    expect(liveState(live({ status: "upcoming" }), at("11:00"))).toBe("Ended");
    expect(liveState(live({ status: "past" }), at("09:55"))).toBe("Live");
    expect(liveState(live({ status: "draft" }), at("10:00"))).toBe("Draft");
    expect(liveState(live({ status: "cancelled" }), at("10:00"))).toBe("Cancelled");
    expect(liveState(live({ deleted: true }), at("10:00"))).toBe("Cancelled");
  });
  it("0 minutes: live only in the lead-in window", () => {
    expect(liveState(live({ mins: 0 }), at("09:55"))).toBe("Live");
    expect(liveState(live({ mins: 0 }), at("10:00"))).toBe("Ended");
  });
  it("an unparseable date/time is Upcoming (Ended when stored as past)", () => {
    expect(liveState(live({ time: "" }), at("10:00"))).toBe("Upcoming");
    expect(liveState(live({ date: "soon", status: "past" }), at("10:00"))).toBe("Ended");
  });
  it("filters by class, teacher, date and derived status, newest first", () => {
    const rows = [live({ id: "a", classId: "cls_9A", time: "08:00" }), live({ id: "b", teacherId: "stf_2", time: "10:00" }), live({ id: "c", date: "2026-11-04", time: "09:00" })];
    const now = at("10:05");
    expect(filterLive(rows, {}, now).map((r) => r.id)).toEqual(["c", "b", "a"]);
    expect(filterLive(rows, { classId: "cls_9A" }, now).map((r) => r.id)).toEqual(["a"]);
    expect(filterLive(rows, { teacherId: "stf_2" }, now).map((r) => r.id)).toEqual(["b"]);
    expect(filterLive(rows, { date: "2026-11-04" }, now).map((r) => r.id)).toEqual(["c"]);
    expect(filterLive(rows, { status: "Live" }, now).map((r) => r.id)).toEqual(["b"]);
    expect(filterLive(rows, { status: "Ended" }, now).map((r) => r.id)).toEqual(["a"]);
    expect(filterLive(rows, { classId: "cls_10B", status: "Upcoming" }, now).map((r) => r.id)).toEqual(["c"]);
  });
});

describe("Meet link validation (contract section 6)", () => {
  it("accepts meeting codes with or without scheme and normalises them", () => {
    expect(normalizeMeetLink("https://meet.google.com/abc-defg-hij")).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeMeetLink("meet.google.com/ABC-DEFG-HIJ?authuser=0")).toBe("https://meet.google.com/abc-defg-hij");
    expect(normalizeMeetLink("  http://meet.google.com/abc-defg-hij  ")).toBe("https://meet.google.com/abc-defg-hij");
  });
  it("accepts lookup links", () => expect(normalizeMeetLink("meet.google.com/lookup/abcDEF_12-x")).toBe("https://meet.google.com/lookup/abcDEF_12-x"));
  it("rejects other hosts, malformed codes and scripts", () => {
    for (const bad of ["https://zoom.us/j/123", "https://meet.google.com/abcdefghij", "https://meet.google.com/ab-defg-hij", "https://evil.com/meet.google.com/abc-defg-hij", "javascript:alert(1)", "https://meet.google.com.evil.com/abc-defg-hij", ""]) {
      expect(normalizeMeetLink(bad)).toBeNull();
    }
  });
  it("field error messages", () => {
    expect(meetLinkError("")).toBe("Paste the Google Meet link");
    expect(meetLinkError("https://zoom.us/j/1")).toBe("Use a Google Meet link like https://meet.google.com/abc-defg-hij");
    expect(meetLinkError("meet.google.com/abc-defg-hij")).toBeNull();
  });
  it("joinLink: Meet sessions need a Meet link, other media any http(s) link", () => {
    expect(joinLink({ medium: "Google Meet", link: "https://zoom.us/j/1" })).toBeNull();
    expect(joinLink({ medium: "Zoom", link: "https://zoom.us/j/edu-cls-10B" })).toBe("https://zoom.us/j/edu-cls-10B");
    expect(joinLink({ medium: "Zoom", link: "javascript:alert(1)" })).toBeNull();
    expect(joinLink({ link: "meet.google.com/abc-defg-hij" })).toBe("https://meet.google.com/abc-defg-hij");
    expect(safeLink("")).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------------------------------
const hw = (p: Partial<HW>): HW => ({ id: "h", title: "T", grade: "10", section: "B", subject: "Maths", due: "2026-11-10", assigned: "2026-11-01", teacher: "", description: "", submitted: 0, total: 0, ...p });

describe("homework counts and state", () => {
  it("uses the stored counts when there is no per-student data", () => {
    expect(hwCounts(hw({ submitted: 12, total: 40 }))).toEqual({ submitted: 12, total: 40 });
    expect(hwCounts(hw({ submitted: undefined as unknown as number, total: "30" as unknown as number }))).toEqual({ submitted: 0, total: 30 });
  });
  it("counts submitted + graded entries of the teacher's submissions map (overrides stale counts)", () => {
    const h = hw({ submitted: 0, total: 99, submissions: { a: { status: "submitted" }, b: { status: "graded" }, c: { status: "pending" }, d: null } });
    expect(hwCounts(h)).toEqual({ submitted: 2, total: 4 });
  });
  it("state: draft / closed / overdue / open", () => {
    const today = "2026-11-03";
    expect(hwState(hw({ status: "draft" }), today)).toBe("draft");
    expect(hwState(hw({ status: "closed", due: "2026-10-01" }), today)).toBe("closed");
    expect(hwState(hw({ status: "Completed" }), today)).toBe("closed");
    expect(hwState(hw({ submitted: 40, total: 40 }), today)).toBe("closed");
    expect(hwState(hw({ submitted: 0, total: 0, due: "2026-11-02" }), today)).toBe("overdue"); // total 0 is never complete
    expect(hwState(hw({ submitted: 3, total: 40, due: "2026-11-03" }), today)).toBe("open"); // due today is not overdue
    expect(hwState(hw({ status: "Published", due: "" }), today)).toBe("open");
  });
  it("validates create fields", () => {
    const f = { title: "Algebra", subject: "Mathematics", classId: "cls_10B", due: "2026-11-10", teacherId: "stf_1", maxMarks: "20", submitted: "0" };
    const ctx = { assigned: "2026-11-03", size: 40, classChanged: true, countsLocked: false };
    expect(validateHomework(f, ctx)).toEqual({});
    expect(validateHomework({ ...f, title: " ", subject: "", due: "", teacherId: "" }, ctx)).toEqual({ title: "Title is required", subject: "Pick a subject", due: "Due date is required", teacherId: "Pick a teacher" });
    expect(validateHomework({ ...f, due: "2026-11-02" }, ctx).due).toBe("Due date cannot be before the assigned date");
    expect(validateHomework({ ...f, due: "2026-11-03" }, ctx)).toEqual({}); // due on the assigned day is fine
    expect(validateHomework({ ...f, due: "2026-11-02" }, { ...ctx, assigned: "" })).toEqual({});
    for (const mm of ["0", "-5", "2.5", "abc", "", "1001"]) expect(validateHomework({ ...f, maxMarks: mm }, ctx).maxMarks).toBe("Max marks must be a whole number from 1 to 1000");
    expect(validateHomework({ ...f, classId: "cls_10" }, ctx).grade).toBe("Pick a class");
    expect(validateHomework(f, { ...ctx, size: 0 }).grade).toBe("No students in this class");
    expect(validateHomework(f, { ...ctx, size: 0, classChanged: false, countsLocked: true })).toEqual({});
    expect(validateHomework({ ...f, submitted: "41" }, ctx).submitted).toBe("Whole number, 0–40");
    expect(validateHomework({ ...f, submitted: "41" }, { ...ctx, countsLocked: true })).toEqual({});
  });
});

// ---------------------------------------------------------------------------------------------------------------------
describe("class and assignment validation", () => {
  const classes: ClassRow[] = [{ id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_025", room: "R-204" }, { id: "cls_9A", grade: "9", section: "A", room: "" }];
  const nameOf = (id: string) => ({ stf_025: "Mrs. Anita Sharma" } as Record<string, string>)[id] ?? "";
  const v = { grade: "8", section: "A", classTeacherId: "", room: "" };
  it("accepts a new class", () => expect(validateClass(v, classes, nameOf)).toEqual({}));
  it("grade 1–12 and section A–D", () => {
    expect(validateClass({ ...v, grade: "13" }, classes, nameOf).grade).toBe("Grade must be 1–12");
    expect(validateClass({ ...v, grade: "0" }, classes, nameOf).grade).toBe("Grade must be 1–12");
    expect(validateClass({ ...v, section: "E" }, classes, nameOf).section).toBe("Section must be A–D");
    expect(validateClass({ ...v, section: "a" }, classes, nameOf).section).toBe("Section must be A–D");
  });
  it("rejects a duplicate class id", () => expect(validateClass({ ...v, grade: "10", section: "B" }, classes, nameOf).section).toBe("This class already exists"));
  it("a teacher is class teacher of one class", () => {
    expect(validateClass({ ...v, classTeacherId: "stf_025" }, classes, nameOf).classTeacherId).toBe("Mrs. Anita Sharma is already class teacher of Grade 10-B");
    expect(validateClass({ grade: "10", section: "B", classTeacherId: "stf_025", room: "" }, classes, nameOf, "cls_10B")).toEqual({});
    expect(classTeacherElsewhere(classes, "", "cls_8A")).toBeUndefined();
  });
  it("rooms are unique per class (case and spacing ignored) and at most 20 characters", () => {
    expect(validateClass({ ...v, room: " r-204 " }, classes, nameOf).room).toBe("Room r-204 is already used by Grade 10-B");
    expect(validateClass({ grade: "10", section: "B", classTeacherId: "", room: "R-204" }, classes, nameOf, "cls_10B")).toEqual({});
    expect(validateClass({ ...v, room: "x".repeat(21) }, classes, nameOf).room).toBe("Room is at most 20 characters");
    expect(roomTakenBy(classes, "", "cls_8A")).toBeUndefined(); // empty rooms never collide
  });
  it("assignments need class, subject and teacher, and no duplicate subject", () => {
    const all = [{ id: "asg_001", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025" }];
    expect(validateAssignment(all, { classId: "cls_10B", subject: "English", teacherId: "stf_1" })).toEqual({});
    expect(validateAssignment(all, { classId: "", subject: "", teacherId: "" })).toEqual({ classId: "Pick a class", subject: "Pick a subject", teacherId: "Pick a teacher" });
    expect(validateAssignment(all, { classId: "cls_10B", subject: "mathematics", teacherId: "stf_1" }).subject).toBe("mathematics is already assigned in this class");
    expect(validateAssignment(all, { classId: "cls_9A", subject: "Mathematics", teacherId: "stf_1" })).toEqual({});
    expect(validateAssignment(all, { classId: "cls_9A", subject: "Hindi", teacherId: "stf_1", periodsPerWeek: "49" }).periodsPerWeek).toBe("Whole number, 0–48");
    expect(validateAssignment(all, { classId: "cls_9A", subject: "Hindi", teacherId: "stf_1", periodsPerWeek: "1.5" }).periodsPerWeek).toBe("Whole number, 0–48");
    expect(validateAssignment(all, { classId: "cls_9A", subject: "Hindi", teacherId: "stf_1", periodsPerWeek: "6" })).toEqual({});
  });
});
