import { describe, expect, it } from "vitest";
import type { AttRec } from "@/features/ops/logic";
import {
  attendanceClock, dailyRecords, flagsFrom, markedKeys, missingDays, missingSlots, monthGrid, noticeError, noticeText, parentNotice, previousWindow, rangeWindow,
  recordsOutsideYear, schoolClock, studentRate, studentTrends, tapRange, trendDays, trendSummary, weekdayExtremes, weekdayRates, workingDaysOf, type Slot,
} from "./logic";

const rec = (date: string, marks: Record<string, string> = {}, extra: Partial<AttRec> = {}): AttRec =>
  ({ id: `${date}_cls_10B_1`, date, classId: "cls_10B", period: 1, total: 4, marks, submitted: true, teacherId: "stf_1", updatedAt: `${date}T05:00:00.000Z`, ...extra });

describe("school clock and working days", () => {
  it("reads the school's time zone, else its UTC offset, else the browser clock", () => {
    const at = new Date("2026-11-23T20:00:00Z"); // 01:30 next day in India
    expect(schoolClock({ timezone: "Asia/Kolkata" }, at)).toEqual({ today: "2026-11-24", minute: 90 });
    expect(schoolClock({ utcOffsetMinutes: 240 }, at)).toEqual({ today: "2026-11-24", minute: 0 });
    expect(schoolClock({ timezone: "Not/AZone", utcOffsetMinutes: 330 }, at)).toEqual({ today: "2026-11-24", minute: 90 });
    const local = new Date(2026, 10, 23, 9, 5);
    expect(schoolClock(undefined, local)).toEqual({ today: "2026-11-23", minute: 545 });
  });
  it("uses the published working days (1 = Mon) and defaults to Monday–Saturday", () => {
    expect(workingDaysOf(undefined)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(workingDaysOf({ workingDays: [5, 1, 2, 3, 4, 9] })).toEqual([1, 2, 3, 4, 5]);
  });
  it("flags from the academic year start, else 30 days back", () => {
    expect(flagsFrom("2026-11-23", { academicRange: { start: "2026-06-01", end: "2027-03-31" } })).toBe("2026-06-01");
    expect(flagsFrom("2026-11-23", null)).toBe("2026-10-24");
  });
});

describe("missing attendance", () => {
  const slots: Slot[] = [{ period: 1, classId: "cls_10B", subject: "Maths", kind: "period" }, { period: 4, classId: "cls_8A", subject: "Science", kind: "sub" }];
  const clock = { ...attendanceClock({ academicRange: { start: "2026-11-01" }, workingDays: [1, 2, 3, 4, 5] }, [{ period: 1, from: "08:30" }, { period: 4, from: "11:00" }], new Date(2026, 10, 23, 10, 0)), today: "2026-11-23", minute: 600 };
  const marked = markedKeys([rec("2026-11-20"), rec("2026-11-23", {}, { submitted: false }), rec("2026-11-19", {}, { deleted: true })]);

  it("lists begun periods without a submitted register", () => {
    expect(missingSlots("2026-11-23", slots, marked, clock).map((s) => s.period)).toEqual([1]); // P4 has not begun at 10:00; a draft does not count
    expect(missingSlots("2026-11-20", slots, marked, clock).map((s) => s.period)).toEqual([4]);
    expect(missingSlots("2026-11-19", slots, marked, clock).map((s) => s.period)).toEqual([1, 4]); // a deleted register does not count
  });
  it("never flags future days, days before the year start or non-working days", () => {
    expect(missingSlots("2026-11-24", slots, marked, clock)).toEqual([]);
    expect(missingSlots("2026-10-30", slots, marked, clock)).toEqual([]);
    expect(missingSlots("2026-11-21", slots, marked, clock)).toEqual([]); // Saturday is off
  });
  it("collects the flagged days of a range", () => {
    const slotsOf = (d: string) => (d === "2026-11-18" ? [] : slots);
    expect(missingDays("2026-11-16", "2026-11-30", slotsOf, marked, clock)).toEqual(["2026-11-16", "2026-11-17", "2026-11-19", "2026-11-20", "2026-11-23"]);
  });
});

describe("calendar helpers", () => {
  it("lays out a Monday-first month", () => {
    const g = monthGrid(2026, 11); // 1 Nov 2026 is a Sunday
    expect(g.slice(0, 7)).toEqual([null, null, null, null, null, null, "2026-11-01"]);
    expect(g.at(-1)).toBe("2026-11-30");
  });
  it("picks a day, then a later day for a range, up to 31 days", () => {
    expect(tapRange({ from: "2026-11-10" }, "2026-11-12", true)).toEqual({ from: "2026-11-10", to: "2026-11-12" });
    expect(tapRange({ from: "2026-11-10" }, "2026-11-12", false)).toEqual({ from: "2026-11-12" });
    expect(tapRange({ from: "2026-11-10" }, "2026-11-05", true)).toEqual({ from: "2026-11-05" });
    expect(tapRange({ from: "2026-11-10", to: "2026-11-12" }, "2026-11-20", true)).toEqual({ from: "2026-11-20" });
    expect(tapRange({ from: "2026-11-01" }, "2026-12-15", true).error).toMatch(/31 days/);
  });
});

describe("trend windows", () => {
  const policy = { academicRange: { start: "2026-06-01", end: "2027-03-31" }, terms: [{ name: "Term 1", start: "2026-06-01", end: "2026-09-30" }, { name: "Term 2", start: "2026-10-01", end: "2027-03-31" }] };
  it("frames the week, month, term and year up to today", () => {
    expect(rangeWindow("This week", "2026-11-26", policy)).toEqual({ from: "2026-11-23", to: "2026-11-26" });
    expect(rangeWindow("This month", "2026-11-26", policy)).toEqual({ from: "2026-11-01", to: "2026-11-26" });
    expect(rangeWindow("This term", "2026-11-26", policy)).toEqual({ from: "2026-10-01", to: "2026-11-26" });
    expect(rangeWindow("This year", "2026-11-26", policy)).toEqual({ from: "2026-06-01", to: "2026-11-26" });
    expect(rangeWindow("This term", "2026-11-26", null)).toEqual({ from: "2026-08-28", to: "2026-11-26" });
    expect(rangeWindow("This year", "2026-11-26", null)).toEqual({ from: "2025-11-26", to: "2026-11-26" });
  });
  it("compares with the window of the same length right before", () => {
    expect(previousWindow({ from: "2026-11-23", to: "2026-11-26" })).toEqual({ from: "2026-11-19", to: "2026-11-22" });
    expect(previousWindow({ from: "2026-11-01", to: "2026-11-26" })).toEqual({ from: "2026-10-06", to: "2026-10-31" });
  });
});

describe("trend statistics", () => {
  const rows: AttRec[] = [
    rec("2026-11-23", { s1: "A" }), // 75%
    rec("2026-11-24", { s1: "A", s2: "L", s3: "E" }), // 50%
    { ...rec("2026-11-24", {}), id: "2026-11-24_cls_10B_3", period: 3, updatedAt: "2026-11-24T09:00:00.000Z" }, // later register of the day wins: 100%
    rec("2026-11-25", { s2: "A" }, { submitted: false }), // draft
    rec("2026-11-16", { s1: "A", s2: "A" }), // last week: 50%
    rec("2026-05-20", {}), // outside the academic year
    { ...rec("2026-11-23", {}), classId: "cls_9A", id: "x" },
  ];
  const policy = { academicRange: { start: "2026-06-01", end: "2027-03-31" } };

  it("keeps the latest submitted register per day inside the academic year", () => {
    expect(dailyRecords(rows, "cls_10B", policy).map((r) => `${r.date}:${r.period}`)).toEqual(["2026-11-16:1", "2026-11-23:1", "2026-11-24:3"]);
    expect(recordsOutsideYear(rows, "cls_10B", policy)).toBe(1);
  });
  it("averages the range and compares it with the period before", () => {
    const s = trendSummary(dailyRecords(rows, "cls_10B", policy), "This week", "2026-11-29", policy); // Mon 23 – Sun 29 vs Mon 16 – Sun 22
    expect(s.records).toHaveLength(2);
    expect(s.avg).toBe(87.5);
    expect(s.previousAvg).toBe(50);
    expect(s.delta).toBe(37.5);
    expect(s.totals).toEqual({ total: 8, present: 7, absent: 1, late: 0, excused: 0 });
    expect(trendSummary([], "This week", "2026-11-25").previousAvg).toBeNull();
  });
  it("rates students from their admission, lowest first", () => {
    const recs = dailyRecords(rows, "cls_10B", policy);
    expect(studentRate(recs, "s1")).toBeCloseTo(33.33, 1);
    expect(studentRate(recs, "s1", "2026-11-20")).toBe(50);
    expect(studentRate([rec("2026-11-23", { s1: "L" })], "s1")).toBe(100); // late counts as present
    expect(studentRate([rec("2026-11-23", { s1: "E" })], "s1")).toBe(0); // excused does not
    const t = studentTrends(recs, [{ id: "s3", name: "C", roll: 3 }, { id: "s2", name: "B", roll: 2 }, { id: "s1", name: "A", roll: 1 }]);
    expect(t.map((x) => `${x.student.id}:${Math.round(x.rate)}:${x.absent}`)).toEqual(["s1:33:2", "s2:67:1", "s3:100:0"]);
    expect(t[0]!.absentDates).toEqual(["2026-11-16", "2026-11-23"]);
  });
  it("averages each weekday and finds the lowest and highest", () => {
    const r = weekdayRates(dailyRecords(rows, "cls_10B", policy));
    expect(r.slice(0, 3)).toEqual([62.5, 100, null]);
    expect(weekdayExtremes(r)).toEqual({ lo: 0, hi: 1 });
    expect(weekdayExtremes([50, null, null, null, null, null, null])).toEqual({});
  });
  it("lists every school day of the window for the daily chart, recorded or not", () => {
    const days = trendDays(dailyRecords(rows, "cls_10B", policy), { from: "2026-11-21", to: "2026-11-25" }, [1, 2, 3, 4, 5, 6]);
    expect(days.map((d) => `${d.date}:${d.rate ?? "-"}`)).toEqual(["2026-11-21:-", "2026-11-23:75", "2026-11-24:100", "2026-11-25:-"]);
  });
});

describe("parent notice", () => {
  it("writes the app's ParentNotice keys", () => {
    const at = new Date("2026-11-23T06:00:00.000Z");
    expect(parentNotice({ studentId: "stu_1", classId: "cls_10B", channels: ["App", "Chat"], message: " Hello ", template: "Low attendance", staffId: "stf_1", at })).toEqual({
      studentId: "stu_1", classId: "cls_10B", channels: ["App", "Chat"], message: "Hello", template: "Low attendance", auto: false, ack: false, ackRequested: false,
      at: "2026-11-23T06:00:00.000Z", ord: at.getTime() * 1000, teacherId: "stf_1",
    });
    expect(parentNotice({ studentId: "s", classId: "c", channels: ["Call"], message: "Phone call placed", staffId: "stf_1", at })).not.toHaveProperty("template");
  });
  it("fills the presets and checks the length", () => {
    const v = { name: "Bina Rao", roll: 2, guardian: "Mr Rao", classLabel: "10-B", absent: 3, mondays: 2, minimum: 75 };
    expect(noticeText("Low attendance", v)).toBe("Dear Mr Rao, Bina Rao (Roll #2, Class 10-B) has attendance below the required 75% with 3 absences. Regular attendance is important for progress — please make sure they attend every day.");
    expect(noticeText("Monday absences", { ...v, guardian: "" })).toMatch(/^Dear Parent, .* has missed 2 Monday classes/);
    expect(noticeError("  ")).toBe("Write a message");
    expect(noticeError("x".repeat(501))).toMatch(/under 500/);
    expect(noticeError("ok")).toBe("");
  });
});
