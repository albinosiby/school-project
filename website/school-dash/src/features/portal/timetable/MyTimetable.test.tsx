import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authState, dialog, renderUI, screen, seed, within, writes } from "@/test/render";
import { MyTimetable } from "./MyTimetable";
import { cellLessons, lessonState, lessonsOn, markHref, needsMark, weekLessons } from "./logic";
import { weekOf } from "../teaching";
import type { SubStatus } from "@/features/ops/logic";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const periods = [
  { id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "" },
  { id: "per_9A_Tue_2", classId: "cls_9A", grade: "9", section: "A", day: "Tue", period: 2, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "Lab 2" },
  { id: "per_7C_Mon_1", classId: "cls_7C", grade: "7", section: "C", day: "Mon", period: 1, subject: "Hindi", teacher: "Ravi", teacherId: "stf_2", room: "" },
];
const sub = (date: string, day: string, period: number, classId: string, status: SubStatus, extra: Record<string, unknown> = {}) => ({
  id: `sub_${date}_${classId}_${period}`, date, day, period, classId, subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status, ...extra,
});
const subs = [
  sub("2026-11-25", "Wed", 3, "cls_8A", "Assigned"),
  sub("2026-11-26", "Thu", 4, "cls_8B", "Declined"),
  sub("2026-12-02", "Wed", 3, "cls_8A", "Accepted"),
  sub("2026-11-24", "Tue", 5, "cls_6A", "Assigned", { substituteTeacherId: "stf_9" }),
];
const row = (name: RegExp) => within(screen.getByRole("table", { name: "My weekly timetable" })).getByRole("rowheader", { name }).closest("tr")!;
const cell = (name: RegExp, dayIndex: number) => within(row(name)).getAllByRole("cell")[dayIndex]!;

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("weekly timetable logic", () => {
  it("frames Monday to Saturday around today", () => {
    expect(weekOf("2026-11-23")).toMatchObject({ from: "2026-11-23", to: "2026-11-28", dates: { Mon: "2026-11-23", Sat: "2026-11-28" } });
    expect(weekOf("2026-11-29")).toMatchObject({ from: "2026-11-23", to: "2026-11-28" }); // Sunday belongs to the week before
    expect(weekOf("2026-11-26")).toMatchObject({ from: "2026-11-23" });
  });
  it("overlays only this week's Assigned/Accepted substitutions of the teacher", () => {
    const lessons = weekLessons(periods.filter((p) => p.teacherId === "stf_1"), subs.filter((s) => s.substituteTeacherId === "stf_1"), "2026-11-23");
    expect(lessons.map((l) => l.key)).toEqual(["per_10B_Mon_1", "per_9A_Tue_2", "sp_sub_2026-11-25_cls_8A_3"]);
    expect(cellLessons(lessons, "Wed", 3)[0]).toMatchObject({ kind: "sub", classId: "cls_8A", status: "Assigned", subId: "sub_2026-11-25_cls_8A_3" });
  });
});

describe("daily timeline logic", () => {
  it("lists any date's own periods and covers, covers first", () => {
    const mine = periods.filter((p) => p.teacherId === "stf_1");
    const active = subs.filter((s) => s.substituteTeacherId === "stf_1");
    expect(lessonsOn("2026-11-30", mine, active).map((l) => l.key)).toEqual(["per_10B_Mon_1"]);
    expect(lessonsOn("2026-12-02", mine, active).map((l) => `${l.kind}:${l.period}:${l.classId}`)).toEqual(["sub:3:cls_8A"]);
    expect(lessonsOn("2026-11-26", mine, active)).toEqual([]); // the declined cover is gone
  });
  it("places a lesson on the school clock and asks for attendance once it has begun", () => {
    const clock = { today: "2026-11-23", minute: 9 * 60 };
    const bell = { from: "08:30", to: "09:15" };
    expect(lessonState("2026-11-23", bell, clock)).toBe("live");
    expect(lessonState("2026-11-23", { from: "09:15", to: "10:00" }, clock)).toBe("upcoming");
    expect(lessonState("2026-11-20", bell, clock)).toBe("done");
    expect(lessonState("2026-11-24", bell, clock)).toBe("upcoming");
    const marked = new Set(["2026-11-20|cls_10B|1"]);
    expect(needsMark("2026-11-23", { classId: "cls_10B", period: 1 }, "live", marked)).toBe(true);
    expect(needsMark("2026-11-20", { classId: "cls_10B", period: 1 }, "done", marked)).toBe(false);
    expect(needsMark("2026-11-24", { classId: "cls_10B", period: 1 }, "upcoming", marked)).toBe(false);
    expect(markHref("2026-11-23", { classId: "cls_10B", period: 1 })).toBe("/me/attendance?class=cls_10B&period=1&date=2026-11-23");
  });
});

describe("My timetable", () => {
  it("shows the teacher's own periods with substitutions of the current week and never another teacher's lessons", () => {
    teacher();
    seed({ staff: [{ id: "stf_1", name: "Anita" }], ops_periods: periods, ops_substitutions: subs, classes: [{ id: "cls_10B", grade: "10", section: "B", room: "12" }] });
    renderUI(<MyTimetable />);
    expect(screen.getByRole("heading", { name: "My timetable" })).toBeInTheDocument();
    expect(screen.getByText("Week of 2026-11-23 · 2 lessons · 1 substitution")).toBeInTheDocument();
    expect(cell(/Period 1/, 0)).toHaveTextContent("Mathematics");
    expect(cell(/Period 1/, 0)).toHaveTextContent("10-B");
    expect(cell(/Period 1/, 0)).toHaveTextContent("Room 12");
    expect(cell(/Period 1/, 0)).not.toHaveTextContent("Hindi");
    expect(cell(/Period 2/, 1)).toHaveTextContent("Lab 2");
    expect(cell(/Period 3/, 2)).toHaveTextContent("Science");
    expect(cell(/Period 3/, 2)).toHaveTextContent("Substitution · Assigned");
    expect(cell(/Period 4/, 3)).toHaveTextContent("Free"); // declined cover is gone
    expect(cell(/Period 5/, 1)).toHaveTextContent("Free"); // someone else's cover
    expect(screen.getByRole("list", { name: "Today's lessons" })).toHaveTextContent("P1 · Mathematics · 10-B");
    expect(writes).toHaveLength(0);
  });

  it("asks for attendance on begun classes, links to the marking page and dots the days to mark", async () => {
    teacher();
    seed({ staff: [{ id: "stf_1", name: "Anita" }], ops_periods: periods, ops_substitutions: subs, classes: [{ id: "cls_10B", grade: "10", section: "B" }],
      school: [{ id: "mobile", academicRange: { start: "2026-11-16", end: "2027-03-31" } }],
      ops_attendance: [{ id: "2026-11-16_cls_10B_1", date: "2026-11-16", classId: "cls_10B", period: 1, total: 3, marks: { stu_1: "A" }, submitted: true, teacherId: "stf_1" }] });
    const { user } = renderUI(<MyTimetable />);
    const todays = screen.getByRole("list", { name: "Today's lessons" });
    expect(todays).toHaveTextContent("Attendance not marked");
    expect(within(todays).getByRole("link", { name: "Mark attendance for 10-B period 1" })).toHaveAttribute("href", "/me/attendance?class=cls_10B&period=1&date=2026-11-23");
    const week = screen.getByRole("list", { name: "Week" });
    expect(within(week).getByRole("button", { name: /^Mon, 23 Nov, 1 periods, today, attendance not marked/ })).toBeInTheDocument();
    expect(within(week).getByRole("button", { name: "Tue, 24 Nov, 1 periods" })).toBeInTheDocument(); // the future is never flagged
    await user.click(screen.getByRole("button", { name: "Previous week" }));
    expect(screen.queryByTestId("missing-2026-11-16")).not.toBeInTheDocument(); // marked
    expect(screen.getByTestId("missing-2026-11-17")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Mon, 16 Nov/ }));
    const day = screen.getByRole("list", { name: "Lessons on Mon, 16 Nov" });
    expect(day).toHaveTextContent("Present 2/3");
    expect(within(day).queryByRole("link")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("opens a range of days from the calendar", async () => {
    teacher();
    seed({ staff: [{ id: "stf_1", name: "Anita" }], ops_periods: periods, ops_substitutions: subs, school: [{ id: "mobile", academicRange: { start: "2026-11-16" } }] });
    const { user } = renderUI(<MyTimetable />);
    await user.click(screen.getByRole("button", { name: /^Calendar: Today, 23 Nov/ }));
    const cal = dialog("Calendar");
    expect(within(cal).getByTestId("dot-2026-11-17")).toBeInTheDocument();
    expect(within(cal).queryByTestId("dot-2026-11-10")).not.toBeInTheDocument(); // before the academic year
    expect(within(cal).queryByTestId("dot-2026-11-25")).not.toBeInTheDocument(); // future
    await user.click(within(cal).getByRole("button", { name: /^Mon, 16 Nov 2026/ }));
    await user.click(within(cal).getByRole("button", { name: /^Sat, 21 Nov 2026/ }));
    expect(within(cal).getByText("6 school days")).toBeInTheDocument();
    await user.click(within(cal).getByRole("button", { name: "Show these days" }));
    const region = screen.getByRole("region", { name: "Selected days" });
    expect(region).toHaveTextContent("6 school days");
    expect(region).toHaveTextContent("2 days have attendance to mark");
    expect(within(region).getByRole("list", { name: "Lessons on Tue, 17 Nov" })).toHaveTextContent("Attendance not marked");
    await user.click(within(region).getByRole("button", { name: /^Tue, 17 Nov/ }));
    expect(screen.getByRole("list", { name: "Lessons on Tue, 17 Nov" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Selected days" })).not.toBeInTheDocument();
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MyTimetable />);
    expect(screen.getByText("Only teachers have a timetable")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
