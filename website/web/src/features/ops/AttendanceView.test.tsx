import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { AttendanceView } from "./AttendanceView";
import { ADMIN_UID, field, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const students = [
  { id: "stu_101", name: "Aarav Mehta", grn: "GRN-101", grade: "10", section: "B", classId: "cls_10B", roll: 1, status: "Active" },
  { id: "stu_102", name: "Bina Rao", grn: "GRN-102", grade: "10", section: "B", classId: "cls_10B", roll: 2, status: "Active" },
  { id: "stu_103", name: "Chetan Das", grn: "GRN-103", grade: "10", section: "B", classId: "cls_10B", roll: 3 },
  { id: "stu_104", name: "Old Student", grn: "GRN-104", grade: "10", section: "B", classId: "cls_10B", roll: 4, status: "Alumni" },
  { id: "stu_201", name: "Other Class", grn: "GRN-201", grade: "9", section: "A", classId: "cls_9A", roll: 1 },
];
const staff = [{ id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" }];
const teacherRec = (period: number, extra: Record<string, unknown> = {}) => ({
  id: `2026-11-03_cls_10B_${period}`, date: "2026-11-03", classId: "cls_10B", grade: "10", section: "B", period, total: 3, marks: {}, submitted: true,
  teacherId: "stf_025", updatedAt: `2026-11-03T0${period}:00:00.000Z`, ...extra,
});
const ADMIN_ID = "2026-11-03_cls_10B_0";

const group = (name: string) => screen.getByRole("group", { name: `Attendance for ${name}` });
const pressed = (name: string) => within(group(name)).getAllByRole("button").find((b) => b.getAttribute("aria-pressed") === "true")?.textContent;
const mark = async (user: ReturnType<typeof renderUI>["user"], name: string, label: string) => user.click(within(group(name)).getByRole("button", { name: label }));

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 15, 0)); });
afterEach(() => vi.useRealTimers());

describe("Attendance view", () => {
  it("shows the newest submitted record of the day; drafts and deleted records are ignored; inactive students are not on the roll", () => {
    seed({ students, staff, ops_attendance: [
      teacherRec(2, { marks: { stu_101: "A" } }),
      teacherRec(4, { marks: { stu_102: "A", stu_103: "A" }, submitted: false }),
      teacherRec(5, { marks: { stu_103: "L" }, deleted: true }),
    ] });
    renderUI(<AttendanceView />);
    expect(screen.getByText(/Period 2 · Mrs\. Anita Sharma · latest submitted/)).toBeInTheDocument();
    expect(pressed("Aarav Mehta")).toBe("Absent");
    expect(pressed("Bina Rao")).toBe("Present");
    expect(pressed("Chetan Das")).toBe("Present");
    expect(screen.queryByText("Old Student")).not.toBeInTheDocument();
    expect(screen.queryByText("Other Class")).not.toBeInTheDocument();
    expect(screen.getByText("2P · 1A · 0L")).toBeInTheDocument(); // derived from total + marks
    expect(screen.queryByText(/^P4$/)).not.toBeInTheDocument();
  });

  it("refuses to save a partly marked roll and writes nothing", async () => {
    seed({ students, staff });
    const { user } = renderUI(<AttendanceView />);
    await mark(user, "Aarav Mehta", "Present");
    await user.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(await screen.findByText("Mark all 3 students before saving (2 left)")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("refuses a future date", async () => {
    seed({ students, staff });
    const { user } = renderUI(<AttendanceView />);
    fireEvent.change(field("Date"), { target: { value: "2026-11-04" } });
    expect(field("Date")).toHaveValue("2026-11-04");
    await user.click(screen.getByRole("button", { name: "Mark all present" }));
    await user.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(await screen.findByText("Attendance cannot be saved for a future date")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("writes the admin day record {date}_{classId}_0 with only non-present students", async () => {
    seed({ students, staff });
    const { user } = renderUI(<AttendanceView />);
    await user.click(screen.getByRole("button", { name: "Mark all present" }));
    await mark(user, "Bina Rao", "Absent");
    await mark(user, "Chetan Das", "Late");
    await user.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(writesTo("ops_attendance")).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "set", coll: "ops_attendance", id: ADMIN_ID });
    expect(getRow("ops_attendance", ADMIN_ID)).toMatchObject({
      date: "2026-11-03", classId: "cls_10B", grade: "10", section: "B", period: 0, total: 3, marks: { stu_102: "A", stu_103: "L" },
      submitted: true, teacherId: "", markedBy: "admin", updatedBy: ADMIN_UID,
    });
    expect(Object.keys((getRow<{ marks: object }>("ops_attendance", ADMIN_ID))!.marks)).toHaveLength(2);
    expect(await screen.findByText("Attendance saved for Grade 10-B, 2026-11-03")).toBeInTheDocument();
  });

  it("corrects a teacher's record with a newer admin record that then decides the day", async () => {
    seed({ students, staff, ops_attendance: [teacherRec(3, { marks: { stu_101: "A" } })] });
    const { user } = renderUI(<AttendanceView />);
    expect(pressed("Aarav Mehta")).toBe("Absent");
    await mark(user, "Aarav Mehta", "Present");
    await user.click(screen.getByRole("button", { name: "Save Attendance" }));
    expect(getRow("ops_attendance", ADMIN_ID)).toMatchObject({ period: 0, total: 3, marks: {}, markedBy: "admin" });
    expect(getRow("ops_attendance", "2026-11-03_cls_10B_3")).toMatchObject({ marks: { stu_101: "A" } }); // the teacher's record is untouched
    expect(await screen.findByText(/Day record · Admin · latest submitted/)).toBeInTheDocument();
    expect(pressed("Aarav Mehta")).toBe("Present");
  });

  it("updates an existing admin record in place", async () => {
    seed({ students, staff, ops_attendance: [{ ...teacherRec(0, { marks: { stu_102: "E" }, teacherId: "", markedBy: "admin" }), id: ADMIN_ID }] });
    const { user } = renderUI(<AttendanceView />);
    expect(pressed("Bina Rao")).toBe("Excused");
    await mark(user, "Chetan Das", "Absent");
    await user.click(screen.getByRole("button", { name: "Update Attendance" }));
    expect(writes).toEqual([expect.objectContaining({ op: "update", coll: "ops_attendance", id: ADMIN_ID })]);
    expect(getRow("ops_attendance", ADMIN_ID)).toMatchObject({ marks: { stu_102: "E", stu_103: "A" }, total: 3, period: 0 });
  });
});
