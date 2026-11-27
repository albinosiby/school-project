import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN_UID, authState, dialog, field, getRow, renderUI, screen, seed, setUrl, within, writes } from "@/test/render";
import { MarkAttendance } from "./MarkAttendance";
import type { SubStatus } from "@/features/ops/logic";
import { saveError, slotsForDate, teacherRecord } from "./logic";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const students = [
  { id: "stu_1", name: "Aarav Mehta", grn: "GRN-1", classId: "cls_10B", roll: 1, status: "Active" },
  { id: "stu_2", name: "Bina Rao", grn: "GRN-2", classId: "cls_10B", roll: 2, status: "Active" },
  { id: "stu_3", name: "Chetan Das", grn: "GRN-3", classId: "cls_10B", roll: 3 },
  { id: "stu_4", name: "Old Student", grn: "GRN-4", classId: "cls_10B", roll: 4, status: "Alumni" },
  { id: "stu_5", name: "Gone Student", grn: "GRN-5", classId: "cls_10B", roll: 5, deleted: true },
  { id: "stu_8", name: "Eight A", grn: "GRN-8", classId: "cls_8A", roll: 1 },
];
const periods = [
  { id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "" },
  { id: "per_10B_Tue_2", classId: "cls_10B", grade: "10", section: "B", day: "Tue", period: 2, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "" },
  { id: "per_7C_Mon_1", classId: "cls_7C", grade: "7", section: "C", day: "Mon", period: 1, subject: "Hindi", teacher: "Ravi", teacherId: "stf_2", room: "" },
];
const cover = { id: "sub_2026-11-23_cls_8A_4", date: "2026-11-23", day: "Mon", period: 4, classId: "cls_8A", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Accepted" as SubStatus };
const base = { staff: [{ id: "stf_1", name: "Anita" }, { id: "stf_2", name: "Ravi" }], students, ops_periods: periods, ops_substitutions: [cover], classes: [{ id: "cls_10B", grade: "10", section: "B" }] };
const group = (name: string) => screen.getByRole("group", { name: `Attendance for ${name}` });
const pressed = (name: string) => within(group(name)).getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true")?.textContent;
const REC = "2026-11-23_cls_10B_1";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("attendance logic", () => {
  it("lists the teacher's periods of the weekday plus accepted covers of the date", () => {
    const mine = periods.filter((p) => p.teacherId === "stf_1");
    expect(slotsForDate("2026-11-23", mine, [cover]).map((s) => `${s.kind}:${s.period}:${s.classId}`)).toEqual(["period:1:cls_10B", "sub:4:cls_8A"]);
    expect(slotsForDate("2026-11-24", mine, [cover]).map((s) => s.period)).toEqual([2]);
    expect(slotsForDate("2026-11-23", mine, [{ ...cover, status: "Declined" as SubStatus }])).toHaveLength(1);
  });
  it("refuses future dates and records of another teacher", () => {
    const slot = { period: 1, classId: "cls_10B", subject: "", kind: "period" as const };
    expect(saveError({ date: "2026-11-24", today: "2026-11-23", rosterSize: 3, slot, staffId: "stf_1" })).toMatch(/future/);
    expect(saveError({ date: "2026-11-23", today: "2026-11-23", rosterSize: 3, slot, staffId: "stf_1", recordedBy: "stf_2" })).toMatch(/another teacher/);
    expect(saveError({ date: "2026-11-23", today: "2026-11-23", rosterSize: 3, slot, staffId: "stf_1", recordedBy: "stf_1" })).toBe("");
  });
  it("builds the app's record: only non-present students in marks, grade/section parsed from the class id", () => {
    expect(teacherRecord({ date: "2026-11-23", classId: "cls_11_science_A", period: 3, rosterIds: ["a", "b", "c"], marks: { a: "P", b: "L", c: undefined }, staffId: "stf_1" }))
      .toEqual({ date: "2026-11-23", classId: "cls_11_science_A", grade: "11", section: "A", period: 3, total: 3, marks: { b: "L" }, submitted: true, teacherId: "stf_1" });
  });
});

describe("Class attendance", () => {
  it("submits ops_attendance/{date}_{classId}_{period} with the app's key set and only non-present students", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MarkAttendance />);
    expect(screen.getByTestId("att-date")).toHaveTextContent("Today, 23 Nov 2026");
    expect(field("Period")).toHaveValue("1_cls_10B");
    expect(screen.queryByText("Old Student")).not.toBeInTheDocument();
    expect(screen.queryByText("Gone Student")).not.toBeInTheDocument();
    expect(screen.getByText("3 registered")).toBeInTheDocument();
    await user.click(within(group("Bina Rao")).getByRole("button", { name: "Absent" }));
    await user.click(within(group("Chetan Das")).getByRole("button", { name: "Leave" }));
    await user.click(screen.getByRole("button", { name: "Submit attendance" }));
    expect(writes).toEqual([{ op: "set", coll: "ops_attendance", id: REC, merge: false, data: expect.any(Object) }]);
    const row = getRow<Record<string, unknown>>("ops_attendance", REC)!;
    expect(row).toEqual({
      id: REC, date: "2026-11-23", classId: "cls_10B", grade: "10", section: "B", period: 1, total: 3, marks: { stu_2: "A", stu_3: "E" }, submitted: true,
      teacherId: "stf_1", updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(Object.keys(row).sort()).toEqual(["classId", "date", "grade", "id", "marks", "period", "section", "submitted", "teacherId", "total", "updatedAt", "updatedBy"]);
    expect(await screen.findByText("Attendance submitted · 1/3 present")).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Attendance history" })).getByText("1/3")).toBeInTheDocument();
  });

  it("marks a substitution period for the covered class", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MarkAttendance />);
    await user.selectOptions(field("Period"), "4_cls_8A");
    expect(screen.getByText("8-A · Period 4")).toBeInTheDocument();
    await user.click(within(group("Eight A")).getByRole("button", { name: "Late" }));
    await user.click(screen.getByRole("button", { name: "Submit attendance" }));
    expect(getRow("ops_attendance", "2026-11-23_cls_8A_4")).toMatchObject({ classId: "cls_8A", grade: "8", section: "A", period: 4, total: 1, marks: { stu_8: "L" }, submitted: true, teacherId: "stf_1" });
  });

  it("updates an own saved record (preloaded marks) and lists it in the history", async () => {
    teacher();
    seed({ ...base, ops_attendance: [{ id: REC, date: "2026-11-23", classId: "cls_10B", grade: "10", section: "B", period: 1, total: 3, marks: { stu_1: "A" }, submitted: true, teacherId: "stf_1", updatedAt: "2026-11-23T03:00:00.000Z", updatedBy: "uid_t" }] });
    const { user } = renderUI(<MarkAttendance />);
    expect(pressed("Aarav Mehta")).toBe("Absent");
    expect(pressed("Bina Rao")).toBe("Present");
    await user.click(within(group("Aarav Mehta")).getByRole("button", { name: "Present" }));
    await user.click(screen.getByRole("button", { name: "Update attendance" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_attendance", id: REC });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["classId", "date", "grade", "marks", "period", "section", "submitted", "teacherId", "total", "updatedAt", "updatedBy"]);
    expect(getRow("ops_attendance", REC)).toMatchObject({ marks: {}, total: 3, teacherId: "stf_1" });
  });

  it("locks a period another teacher already recorded and offers no future date", async () => {
    teacher();
    seed({ ...base, ops_attendance: [{ id: REC, date: "2026-11-23", classId: "cls_10B", period: 1, total: 3, marks: {}, submitted: true, teacherId: "stf_2" }] });
    const { user } = renderUI(<MarkAttendance />);
    expect(screen.getByRole("alert")).toHaveTextContent("already recorded by another teacher");
    expect(screen.getByRole("button", { name: "Update attendance" })).toBeDisabled();
    expect(within(group("Aarav Mehta")).getByRole("button", { name: "Absent" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Change date/ }));
    expect(within(dialog("Attendance date")).getByRole("button", { name: /^Tue, 24 Nov 2026/ })).toBeDisabled();
    await user.click(within(dialog("Attendance date")).getByRole("button", { name: /^Tue, 17 Nov 2026/ }));
    await user.click(within(dialog("Attendance date")).getByRole("button", { name: "Open this day" }));
    expect(screen.getByTestId("att-date")).toHaveTextContent("Tue, 17 Nov 2026");
    expect(field("Period")).toHaveValue("2_cls_10B");
    expect(writes).toHaveLength(0);
  });

  it("opens a history record from the list", async () => {
    teacher();
    seed({ ...base, ops_attendance: [
      { id: "2026-11-17_cls_10B_1", date: "2026-11-17", classId: "cls_10B", period: 1, total: 3, marks: { stu_2: "A" }, submitted: true, teacherId: "stf_1" },
      { id: "2026-11-17_cls_7C_1", date: "2026-11-17", classId: "cls_7C", period: 1, total: 9, marks: {}, submitted: true, teacherId: "stf_2" },
    ] });
    const { user } = renderUI(<MarkAttendance />);
    const history = screen.getByRole("table", { name: "Attendance history" });
    expect(within(history).getAllByRole("row")).toHaveLength(2); // header + own record only
    await user.click(within(history).getByRole("button", { name: "Open" }));
    expect(screen.getByTestId("att-date")).toHaveTextContent("Tue, 17 Nov 2026");
    expect(pressed("Bina Rao")).toBe("Absent");
    expect(writes).toHaveLength(0);
  });

  it("opens the class, period and date passed by the timetable (never a future date)", () => {
    teacher(); seed(base);
    setUrl("/me/attendance?class=cls_10B&period=2&date=2026-11-17");
    renderUI(<MarkAttendance />);
    expect(screen.getByTestId("att-date")).toHaveTextContent("Tue, 17 Nov 2026");
    expect(field("Period")).toHaveValue("2_cls_10B");
    expect(screen.getByText("10-B · Period 2")).toBeInTheDocument();
  });

  it("ignores a future date in the link", () => {
    teacher(); seed(base);
    setUrl("/me/attendance?class=cls_10B&period=2&date=2026-11-24");
    renderUI(<MarkAttendance />);
    expect(screen.getByTestId("att-date")).toHaveTextContent("Today, 23 Nov 2026");
  });

  it("lists the days to mark from the academic year start and jumps to the first unmarked period", async () => {
    teacher();
    seed({ ...base, school: [{ id: "mobile", academicRange: { start: "2026-11-16", end: "2027-03-31" } }], ops_attendance: [
      { id: "2026-11-16_cls_10B_1", date: "2026-11-16", classId: "cls_10B", period: 1, total: 3, marks: {}, submitted: true, teacherId: "stf_1" },
      { id: "2026-11-23_cls_10B_1", date: "2026-11-23", classId: "cls_10B", period: 1, total: 3, marks: {}, submitted: true, teacherId: "stf_1" },
    ] });
    const { user } = renderUI(<MarkAttendance />);
    const strip = screen.getByRole("region", { name: "Days to mark" });
    expect(strip).toHaveTextContent("2 days to mark");
    expect(within(strip).getAllByRole("button").map((b) => b.textContent)).toEqual(["Mon, 23 Nov1", "Tue, 17 Nov1"]); // newest first; the 16th is marked
    // today: P1 is marked, the cover in P4 is not -> picking today opens P4
    await user.click(within(strip).getByRole("button", { name: /Mon, 23 Nov/ }));
    expect(field("Period")).toHaveValue("4_cls_8A");
    expect(screen.getByText("Not marked")).toBeInTheDocument();
    await user.click(within(strip).getByRole("button", { name: /Tue, 17 Nov/ }));
    expect(screen.getByTestId("att-date")).toHaveTextContent("Tue, 17 Nov 2026");
    expect(field("Period")).toHaveValue("2_cls_10B");
    // the calendar has the same red dots
    await user.click(screen.getByRole("button", { name: /Change date/ }));
    const cal = dialog("Attendance date");
    expect(within(cal).getByTestId("dot-2026-11-17")).toBeInTheDocument();
    expect(within(cal).queryByTestId("dot-2026-11-16")).not.toBeInTheDocument();
    expect(within(cal).queryByTestId("dot-2026-11-10")).not.toBeInTheDocument(); // before the academic year
    expect(within(cal).getByText("2 days to mark in November")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("links to the attendance trends", () => {
    teacher(); seed(base);
    renderUI(<MarkAttendance />);
    expect(screen.getByRole("link", { name: /Attendance trends/ })).toHaveAttribute("href", "/me/attendance/trends");
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MarkAttendance />);
    expect(screen.getByText("Only teachers have class attendance")).toBeInTheDocument();
  });
});
