import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { AcademicsView } from "./AcademicsView";
import { ADMIN_UID, dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const staff = [{ id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" }, { id: "stf_003", name: "Ravi Kumar", department: "Science" }];
const students = [
  { id: "stu_101", name: "A", grade: "10", section: "B", classId: "cls_10B", status: "Active" },
  { id: "stu_102", name: "B", grade: "10", section: "B", classId: "cls_10B", status: "Active" },
  { id: "stu_103", name: "C", grade: "10", section: "B", classId: "cls_10B" },
  { id: "stu_104", name: "D", grade: "10", section: "B", classId: "cls_10B", status: "Alumni" },
];
const teacherHw = {
  id: "hw_t1", title: "Quadratic worksheet", classId: "cls_10B", grade: "10", section: "B", subject: "Mathematics", due: "2026-11-06", assigned: "2026-11-01",
  teacherId: "stf_025", teacher: "Mrs. Anita Sharma", description: "", maxMarks: 20, status: "open", submitted: 0, total: 0,
  submissions: { stu_101: { status: "submitted" }, stu_102: { status: "graded", marks: 18 }, stu_103: { status: "pending" }, stu_999: { status: "pending" } },
};
const extra = [
  { ...teacherHw, id: "hw_gone", title: "Deleted one", deleted: true, submissions: undefined },
  { ...teacherHw, id: "hw_draft", title: "Draft one", status: "draft", submissions: undefined },
  { ...teacherHw, id: "hw_late", title: "Overdue one", due: "2026-11-02", status: "Published", submissions: undefined, submitted: 1, total: 3 },
];

function setup(hw: Record<string, unknown>[] = []) {
  seed({ staff, students, ops_homework: hw });
  return renderUI(<AcademicsView />);
}
async function openCreate() {
  const r = setup();
  await r.user.click(screen.getByRole("button", { name: /Create Homework/ }));
  return { ...r, dlg: dialog("Create homework") };
}
async function fillValid(user: ReturnType<typeof setup>["user"], dlg: HTMLElement) {
  await user.type(field("Title", dlg), "  Algebra practice ");
  await user.selectOptions(field("Grade", dlg), "10");
  await user.selectOptions(field("Section", dlg), "B");
  await user.selectOptions(field("Subject", dlg), "Mathematics");
  await user.selectOptions(field("Teacher", dlg), "stf_025");
  fireEvent.change(field("Due date", dlg), { target: { value: "2026-11-10" } });
}
const create = (user: ReturnType<typeof setup>["user"], dlg: HTMLElement) => user.click(within(dlg).getByRole("button", { name: "Create" }));

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 9, 0)); });
afterEach(() => vi.useRealTimers());

describe("Create homework", () => {
  it("shows every required-field error and writes nothing", async () => {
    const { user, dlg } = await openCreate();
    await create(user, dlg);
    expect(fieldError("Title", dlg)).toBe("Title is required");
    expect(fieldError("Subject", dlg)).toBe("Pick a subject");
    expect(fieldError("Teacher", dlg)).toBe("Pick a teacher");
    expect(fieldError("Due date", dlg)).toBe("Due date is required");
    expect(fieldError("Grade", dlg)).toBe("No students in this class"); // default Grade 8-A has no roster
    expect(writes).toHaveLength(0);
  });

  it("rejects a due date before the assigned date (today)", async () => {
    const { user, dlg } = await openCreate();
    await fillValid(user, dlg);
    fireEvent.change(field("Due date", dlg), { target: { value: "2026-11-02" } });
    await create(user, dlg);
    expect(fieldError("Due date", dlg)).toBe("Due date cannot be before the assigned date");
    expect(writes).toHaveLength(0);
  });

  it("max marks must be a positive whole number", async () => {
    const { user, dlg } = await openCreate();
    await fillValid(user, dlg);
    for (const bad of ["0", "2.5", "-3"]) {
      await user.clear(field("Max marks", dlg));
      await user.type(field("Max marks", dlg), bad);
      await create(user, dlg);
      expect(fieldError("Max marks", dlg)).toBe("Max marks must be a whole number from 1 to 1000");
    }
    expect(writes).toHaveLength(0);
  });

  it("submissions cannot exceed the class size (active students only)", async () => {
    const { user, dlg } = await openCreate();
    await fillValid(user, dlg);
    await user.clear(field(/^Submissions/, dlg));
    await user.type(field(/^Submissions/, dlg), "4");
    await create(user, dlg);
    expect(fieldError(/^Submissions/, dlg)).toBe("Whole number, 0–3");
    expect(writes).toHaveLength(0);
  });

  it("writes the admin shape: status Published, maxMarks, assigned today, class counts, no per-student data", async () => {
    const { user, dlg } = await openCreate();
    await fillValid(user, dlg);
    await user.clear(field("Max marks", dlg));
    await user.type(field("Max marks", dlg), "25");
    await create(user, dlg);
    expect(writesTo("ops_homework")).toHaveLength(1);
    const w = writes[0]!;
    const row = getRow<Record<string, unknown>>("ops_homework", w.id)!;
    expect(row).toMatchObject({
      title: "Algebra practice", classId: "cls_10B", grade: "10", section: "B", subject: "Mathematics", due: "2026-11-10", assigned: "2026-11-03",
      teacherId: "stf_025", teacher: "Mrs. Anita Sharma", description: "", maxMarks: 25, status: "Published", submitted: 0, total: 3, updatedBy: ADMIN_UID,
    });
    expect(typeof row.createdAt).toBe("string");
    expect(row).not.toHaveProperty("submissions");
    expect(await screen.findByText("Homework created")).toBeInTheDocument();
  });
});

describe("Homework list and edit", () => {
  it("hides deleted homework, counts from the teacher's submissions map, and shows drafts / overdue", async () => {
    const { user } = setup([teacherHw, ...extra]);
    expect(screen.queryByText("Deleted one")).not.toBeInTheDocument();
    const row = (t: string) => screen.getByText(t).closest("tr") as HTMLElement;
    expect(within(row("Quadratic worksheet")).getByText("2/4")).toBeInTheDocument();
    expect(within(row("Quadratic worksheet")).getByText("Open")).toBeInTheDocument();
    expect(within(row("Draft one")).getByText("Draft")).toBeInTheDocument();
    expect(within(row("Overdue one")).getByText("Overdue")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Overdue/ }));
    expect(screen.getAllByRole("row").slice(1).map((r) => r.textContent)).toEqual([expect.stringContaining("Overdue one")]);
    await user.click(screen.getByRole("tab", { name: /Drafts/ }));
    expect(screen.getAllByRole("row").slice(1)).toHaveLength(1);
  });

  it("editing teacher homework keeps the class and the teacher app's counts; status is not overwritten", async () => {
    const { user } = setup([teacherHw]);
    await user.click(screen.getByText("Quadratic worksheet"));
    const dlg = dialog("Edit homework");
    expect(field("Grade", dlg)).toBeDisabled();
    expect(field(/^Submissions/, dlg)).toBeDisabled();
    expect(field(/^Submissions/, dlg)).toHaveValue(2);
    await user.clear(field("Title", dlg));
    await user.type(field("Title", dlg), "Quadratics worksheet");
    fireEvent.change(field("Due date", dlg), { target: { value: "2026-10-30" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(fieldError("Due date", dlg)).toBe("Due date cannot be before the assigned date"); // assigned 2026-11-01
    expect(writes).toHaveLength(0);
    fireEvent.change(field("Due date", dlg), { target: { value: "2026-11-01" } });
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(writes).toHaveLength(1);
    const data = writes[0]!.data!;
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "hw_t1" });
    expect(data).toMatchObject({ title: "Quadratics worksheet", due: "2026-11-01", maxMarks: 20, classId: "cls_10B" });
    expect(data).not.toHaveProperty("submitted");
    expect(data).not.toHaveProperty("total");
    expect(data).not.toHaveProperty("status");
    expect(getRow<{ submissions: object }>("ops_homework", "hw_t1")!.submissions).toEqual(teacherHw.submissions);
  });
});
