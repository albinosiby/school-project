import { describe, expect, it } from "vitest";
import { currentLessons, currentPeriodAttendance, currentPeriodClock, type ClassActivityConfig } from "./classActivity";
import type { AttRec, Period, Substitution } from "./logic";

const bell: ClassActivityConfig = { id: "bell", gates: "08:00", start: "09:00", end: "13:00", periodCount: 4, periodLength: 40,
  breaks: [{ name: "Morning break", start: "10:20", duration: 20 }] };
const regional = { id: "regional", timezone: "Asia/Kolkata", workingWeek: "Mon – Sat" };
const at = (time: string) => currentPeriodClock(Date.parse(`2026-11-11T${time}:00+05:30`), bell, regional);
const clock = at("09:55");
const lesson = (patch: Partial<Period> = {}): Period => ({ id: "math", classId: "cls_10B", grade: "10", section: "B", day: "Wed", period: 2,
  subject: "Mathematics", teacherId: "teacher", teacher: "Old teacher name", room: "", ...patch });
const attendance = (patch: Partial<AttRec> = {}): AttRec => ({ id: "roll", classId: "cls_10B", date: "2026-11-11", period: 2,
  total: 5, marks: { absent: "A", late: "L", excused: "E" }, submitted: true, ...patch });

describe("Current school period", () => {
  it("uses the school's time zone and configured period boundaries", () => {
    expect(at("08:59")).toMatchObject({ state: "outside" });
    expect(at("09:00")).toMatchObject({ state: "period", period: 1, from: "09:00", to: "09:40" });
    expect(at("09:40")).toMatchObject({ state: "period", period: 2, date: "2026-11-11", day: "Wed", time: "09:40" });
    expect(currentPeriodClock(Date.parse("2026-11-11T04:25:00Z"), bell, { ...regional, timezone: "IST · UTC+05:30 (New Delhi)" })).toEqual(clock);
    expect(currentPeriodClock(Date.parse("2026-11-11T04:25:00Z"), bell, { ...regional, timezone: "UTC" })).toMatchObject({ state: "outside", time: "04:25" });
  });

  it("shows breaks and after-school time without retaining the previous lesson", () => {
    expect(at("10:20")).toMatchObject({ state: "break", label: "Morning break" });
    expect(at("10:39")).toMatchObject({ state: "break" });
    expect(at("10:40")).toMatchObject({ state: "period", period: 3 });
    expect(at("12:00")).toMatchObject({ state: "outside", label: "No class now" });
  });

  it("respects non-working days and configured alternate Saturdays", () => {
    const time = (date: string) => Date.parse(`${date}T09:55:00+05:30`);
    expect(currentPeriodClock(time("2026-11-15"), bell, regional)).toMatchObject({ state: "outside", day: "Sun" });
    expect(currentPeriodClock(time("2026-11-14"), bell, { ...regional, workingWeek: "Mon – Fri" })).toMatchObject({ state: "outside" });
    const alternate = { ...regional, workingWeek: "Mon – Sat (2nd & 4th Saturday Off)" };
    expect(currentPeriodClock(time("2026-11-14"), bell, alternate)).toMatchObject({ state: "outside" });
    expect(currentPeriodClock(time("2026-11-07"), bell, alternate)).toMatchObject({ state: "period", period: 2 });
  });

  it("uses existing timetable bells for legacy schools and refuses invalid structured schedules", () => {
    expect(currentPeriodClock(Date.parse("2026-11-11T09:20:00+05:30"), undefined, regional)).toMatchObject({ state: "period", period: 2, from: "09:15", to: "10:00" });
    expect(currentPeriodClock(Date.parse("2026-11-11T10:05:00+05:30"), undefined, regional)).toMatchObject({ state: "break" });
    const now = Date.parse("2026-11-11T09:55:00+05:30");
    expect(currentPeriodClock(now, { ...bell, periodLength: 0 }, regional)).toMatchObject({ state: "unavailable" });
    expect(currentPeriodClock(now, bell, { ...regional, timezone: "Unknown time zone" })).toMatchObject({ state: "unavailable" });
    expect(currentPeriodClock(now, { ...bell, gates: "07:45 AM" }, regional)).toMatchObject({ state: "period", period: 2 });
    expect(currentPeriodClock(now, { ...bell, breaks: [{ start: "10:20", duration: 20 } as never] }, regional)).toMatchObject({ state: "unavailable" });
  });
});

describe("Current lesson and teacher", () => {
  it("keeps classes and streams separate and resolves the current teacher by staff id", () => {
    const lessons = currentLessons(clock, [lesson(), lesson({ id: "other", classId: "cls_11_science_A" }),
      lesson({ id: "other_period", period: 1 }), lesson({ id: "other_day", day: "Thu" })], [], [{ id: "teacher", name: "Ravi Kumar" }]);
    expect(lessons.get("cls_10B")).toEqual({ subject: "Mathematics", teacher: "Ravi Kumar", teacherId: "teacher" });
    expect(lessons.has("cls_11_commerce_A")).toBe(false);
    expect(lessons.size).toBe(2);
  });

  it("uses assigned substitute cover and ignores declined or old cover", () => {
    const cover: Substitution = { id: "cover", date: clock.date, day: "Wed", period: 2, classId: "cls_10B", subject: "Mathematics",
      absentTeacherId: "teacher", substituteTeacherId: "cover_teacher", status: "Assigned" };
    const staff = [{ id: "cover_teacher", name: "Anita Sharma" }];
    expect(currentLessons(clock, [lesson()], [cover], staff).get("cls_10B")).toEqual({ subject: "Mathematics", teacher: "Anita Sharma", teacherId: "cover_teacher", substitute: true });
    expect(currentLessons(clock, [lesson()], [{ ...cover, status: "Declined" }, { ...cover, date: "2026-11-10" }], staff).get("cls_10B")?.substitute).toBeUndefined();
  });

  it("flags duplicate timetable slots instead of selecting a teacher arbitrarily", () => {
    expect(currentLessons(clock, [lesson(), lesson({ id: "duplicate", teacherId: "other" })], [], []).get("cls_10B")).toEqual({ conflict: true });
    expect(currentLessons(at("10:25"), [lesson()], [], []).size).toBe(0);
  });
});

describe("Current period attendance", () => {
  it("counts late students as present and excludes absent and excused students", () => {
    expect(currentPeriodAttendance(clock, [attendance()]).get("cls_10B")).toEqual({ state: "marked", present: 3, total: 5 });
  });

  it("never falls back to another period, day, draft or deleted roll", () => {
    const rows = [attendance({ period: 0 }), attendance({ period: 1 }), attendance({ date: "2026-11-10" }),
      attendance({ submitted: false }), attendance({ deleted: true })];
    expect(currentPeriodAttendance(clock, rows).has("cls_10B")).toBe(false);
  });

  it("takes the newest submitted roll for the exact class and period", () => {
    const rolls = [attendance({ id: "old", updatedAt: "2026-11-11T04:00:00Z" }),
      attendance({ id: "new", marks: { a: "A" }, updatedAt: "2026-11-11T04:10:00Z" })];
    expect(currentPeriodAttendance(clock, rolls).get("cls_10B")).toEqual({ state: "marked", present: 4, total: 5 });
    expect(currentPeriodAttendance(at("10:25"), rolls).size).toBe(0);
  });

  it("distinguishes a saved zero roll from invalid data and an unmarked class", () => {
    expect(currentPeriodAttendance(clock, [attendance({ total: 0, marks: {} })]).get("cls_10B")).toEqual({ state: "marked", present: 0, total: 0 });
    expect(currentPeriodAttendance(clock, [attendance({ total: 2 })]).get("cls_10B")).toEqual({ state: "unavailable" });
    expect(currentPeriodAttendance(clock, []).has("cls_10B")).toBe(false);
  });
});
