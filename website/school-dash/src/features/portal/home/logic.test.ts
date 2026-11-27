import { describe, expect, it } from "vitest";
import { attendanceHref, attentionItems, bellsOf, markedFor, markedLabel, markedMap, nowInfo, teachingSlots, todaySlots } from "./logic";

const periods = [
  { id: "p1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Maths", teacher: "A", teacherId: "stf_1", room: "R1" },
  { id: "p2", classId: "cls_9A", grade: "9", section: "A", day: "Mon", period: 2, subject: "Maths", teacher: "A", teacherId: "stf_1", room: "" },
];
const subs = [
  { id: "s3", date: "2026-11-23", day: "Mon", period: 3, classId: "cls_7A", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Accepted" },
  { id: "s4", date: "2026-11-23", day: "Mon", period: 4, classId: "cls_7B", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Assigned" },
  { id: "s5", date: "2026-11-25", day: "Wed", period: 1, classId: "cls_7B", subject: "Hindi", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Assigned" },
  { id: "s0", date: "2026-11-20", day: "Fri", period: 1, classId: "cls_7B", subject: "Old", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Assigned" },
];
const policy = { id: "mobile", schedule: [
  { label: "Period 1", start: "08:00", end: "08:40" }, { label: "Period 2", start: "08:40", end: "09:20" },
  { label: "Short Break", start: "09:20", end: "09:35", isBreak: true }, { label: "Period 3", start: "09:35", end: "10:15" }, { label: "Period 4", start: "10:15", end: "10:55" },
] };
const rec = (classId: string, period: number, extra: Record<string, unknown> = {}) => ({ id: `2026-11-23_${classId}_${period}`, date: "2026-11-23", classId, period, total: 30, marks: { a: "A", b: "L", c: "E" }, submitted: true, teacherId: "stf_1", ...extra });
const m = (h: number, min = 0) => h * 60 + min;

describe("bells and slots", () => {
  it("uses the school's published bells, else the default ones", () => {
    const bells = bellsOf(policy);
    expect(bells.periods.get(3)).toEqual({ from: "09:35", to: "10:15" });
    expect(bells.breaks).toEqual([{ label: "Short Break", from: "09:20", to: "09:35" }]);
    expect(bellsOf().periods.get(1)).toEqual({ from: "08:30", to: "09:15" });
    const slots = todaySlots(periods as never, subs as never, "2026-11-23", bells);
    expect(slots.map((s) => `${s.period}:${s.from}-${s.to}:${s.classId}${s.cover ? `:${s.status}` : ""}`)).toEqual([
      "1:08:00-08:40:cls_10B", "2:08:40-09:20:cls_9A", "3:09:35-10:15:cls_7A:Accepted", "4:10:15-10:55:cls_7B:Assigned",
    ]);
    expect(teachingSlots(slots).map((s) => s.period)).toEqual([1, 2, 3]);
  });
  it("finds the live period with progress, the break and the next period", () => {
    const bells = bellsOf(policy);
    const slots = teachingSlots(todaySlots(periods as never, subs as never, "2026-11-23", bells));
    expect(nowInfo(slots, bells, m(7, 50))).toMatchObject({ live: undefined, next: { period: 1 }, started: false });
    expect(nowInfo(slots, bells, m(8, 10))).toMatchObject({ live: { period: 1 }, next: { period: 2 }, started: true, done: 10, length: 40 });
    expect(nowInfo(slots, bells, m(9, 25))).toMatchObject({ live: undefined, brk: { label: "Short Break", to: "09:35" }, next: { period: 3 } });
    expect(nowInfo(slots, bells, m(11))).toMatchObject({ live: undefined, next: undefined, brk: undefined, started: true });
  });
});

describe("marked registers", () => {
  it("keys today's counted registers by class + period (drafts, deleted and other days never count)", () => {
    const map = markedMap([rec("cls_10B", 1), rec("cls_9A", 2, { submitted: false }), rec("cls_7A", 3, { deleted: true }), rec("cls_10B", 2, { date: "2026-11-22" }), rec("cls_7A", 3, { id: "x", submitted: undefined })] as never, "2026-11-23");
    expect(markedFor(map, "cls_10B", 1)).toEqual({ total: 30, present: 28, absent: 1, late: 1, excused: 1 });
    expect(markedFor(map, "cls_9A", 2)).toBeNull();
    expect(markedFor(map, "cls_10B", 2)).toBeNull();
    expect(markedFor(map, "cls_7A", 3)).not.toBeNull();
    expect(markedFor(map, undefined, 1)).toBeNull();
    expect(markedLabel({ total: 30, present: 28, absent: 1, late: 1, excused: 1 })).toBe("28/30 present · 1 absent");
    expect(markedLabel({ total: 30, present: 30, absent: 0, late: 0, excused: 0 })).toBe("30/30 present");
  });
  it("links to the attendance page of a class, period and date", () => {
    expect(attendanceHref("cls_10B", 2, "2026-11-23")).toBe("/me/attendance?classId=cls_10B&period=2&date=2026-11-23");
    expect(attendanceHref("cls_10B", undefined, "2026-11-23")).toBe("/me/attendance?classId=cls_10B&date=2026-11-23");
  });
});

describe("attentionItems", () => {
  const bells = bellsOf(policy);
  const slots = todaySlots(periods as never, subs as never, "2026-11-23", bells);
  const base = { today: "2026-11-23", slots, subs: subs as never, started: true, classTeacherOf: [] as string[], label: (c: string) => c, time: (t: string) => t };
  it("lists substitutions to answer, then each begun period without a register, then unmarked class-teacher classes", () => {
    const items = attentionItems({ ...base, minute: m(9, 40), marked: markedMap([rec("cls_9A", 2)] as never, "2026-11-23"), classTeacherOf: ["cls_9A", "cls_6C"] });
    expect(items.map((i) => i.id)).toEqual(["sub_s4", "sub_s5", "att_cls_10B_1", "att_cls_7A_3", "att_cls_6C"]);
    expect(items[0]).toMatchObject({ title: "Substitution: cls_7B Science", sub: "Today · Period 4 · Accept or decline", href: "/me/substitutions", tone: "warning" });
    expect(items[1]!.sub).toBe("2026-11-25 · Period 1 · Accept or decline");
    expect(items[2]).toMatchObject({ title: "Mark attendance · Period 1 · cls_10B", sub: "Maths · 08:00 · Not marked", href: "/me/attendance?classId=cls_10B&period=1&date=2026-11-23", tone: "danger" });
    expect(items[4]).toMatchObject({ title: "Mark attendance · cls_6C", href: "/me/attendance?classId=cls_6C&date=2026-11-23" });
  });
  it("lists no registers before the school day starts or on Sunday", () => {
    expect(attentionItems({ ...base, minute: m(7), started: false, marked: new Map(), classTeacherOf: ["cls_6C"] }).map((i) => i.kind)).toEqual(["sub", "sub"]);
    expect(attentionItems({ ...base, today: "2026-11-22", minute: m(10), marked: new Map(), classTeacherOf: ["cls_6C"] }).every((i) => i.kind === "sub")).toBe(true);
  });
});
