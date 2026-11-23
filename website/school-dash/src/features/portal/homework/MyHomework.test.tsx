import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { ADMIN_UID, authState, dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";
import { MyHomework } from "./MyHomework";
import { editableSubmissions, gradingPatch, newHomework, ownHomework, setSubmission, validateHomework } from "./logic";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const students = [
  { id: "stu_1", name: "Aarav Mehta", grn: "GRN-1", classId: "cls_10B", roll: 1, status: "Active" },
  { id: "stu_2", name: "Bina Rao", grn: "GRN-2", classId: "cls_10B", roll: 2 },
  { id: "stu_3", name: "Left Student", grn: "GRN-3", classId: "cls_10B", roll: 3, status: "Alumni" },
];
const hw = (id: string, extra: Record<string, unknown> = {}) => ({
  id, classId: "cls_10B", grade: "10", section: "B", title: `Homework ${id}`, subject: "Mathematics", due: "2026-11-30", maxMarks: 20, description: "Ex 4.1", status: "open",
  createdAt: "2026-11-20T08:00:00.000Z", assigned: "2026-11-20", teacher: "Anita", submissions: { stu_1: { status: "pending", feedback: "" }, stu_2: { status: "submitted", feedback: "" } },
  submitted: 1, total: 2, teacherId: "stf_1", updatedAt: "2026-11-20T08:00:00.000Z", updatedBy: "uid_t", ...extra,
});
const base = {
  staff: [{ id: "stf_1", name: "Anita" }], classes: [{ id: "cls_10B", grade: "10", section: "B" }], students,
  assignments: [{ id: "asg_1", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_1" }],
  ops_periods: [{ id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Physics", teacher: "Anita", teacherId: "stf_1", room: "" }],
  ops_homework: [hw("a"), hw("gone", { deleted: true }), hw("other", { teacherId: "stf_2" }), hw("b", { createdAt: "2026-11-22T08:00:00.000Z", status: "Completed" })],
};
const row = (title: string) => screen.getByText(title, { selector: "p" }).closest("tr")!;

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("homework logic", () => {
  it("lists own, not deleted homework newest first", () => {
    expect(ownHomework(base.ops_homework as never, "stf_1").map((h) => h.id)).toEqual(["b", "a"]);
  });
  it("validates like the app and the rules (title ≤ 200, a taught subject, due after assigned)", () => {
    const ok = { classId: "cls_10B", subject: "Mathematics", title: "T", description: "", assigned: "2026-11-23", due: "2026-11-30", maxMarks: "20" };
    expect(validateHomework(ok, { subjects: ["Mathematics"], rosterSize: 2 })).toEqual({});
    expect(validateHomework({ ...ok, title: "x".repeat(201), subject: "Art", due: "2026-11-22", maxMarks: "0" }, { subjects: ["Mathematics"], rosterSize: 2 }))
      .toEqual({ title: "Title is at most 200 characters", subject: "Pick a subject you teach in this class", due: "Due date cannot be before the assigned date", maxMarks: "Max marks must be a whole number from 1 to 1000" });
    expect(validateHomework(ok, { subjects: [], rosterSize: 0 })).toEqual({ classId: "No students in this class" });
  });
  it("builds the app's document: every student pending, denormalized class fields, back-dated createdAt", () => {
    const f = { classId: "cls_11_science_A", subject: "Physics", title: " Optics ", description: " d ", assigned: "2026-11-20", due: "2026-11-30", maxMarks: "25" };
    expect(newHomework(f, { staffId: "stf_1", teacherName: "Anita", rosterIds: ["s1"], now: "2026-11-23T06:30:00.000Z", today: "2026-11-23" })).toEqual({
      classId: "cls_11_science_A", grade: "11", section: "A", title: "Optics", subject: "Physics", due: "2026-11-30", maxMarks: 25, description: "d", status: "open",
      createdAt: "2026-11-20T08:00:00", assigned: "2026-11-20", teacher: "Anita", submissions: { s1: { status: "pending", feedback: "" } }, submitted: 0, total: 1, teacherId: "stf_1",
    });
  });
  it("recounts submitted/total from the submissions map and stamps graded entries", () => {
    const subs = editableSubmissions({ submissions: { a: { status: "graded", marks: 9, feedback: "ok" } } }, ["a", "b"]);
    expect(subs).toEqual({ a: { status: "graded", feedback: "ok", marks: 9 }, b: { status: "pending", feedback: "" } });
    const graded = setSubmission(subs.b!, { status: "graded" }, "2026-11-23T06:00:00.000Z");
    expect(graded).toEqual({ status: "graded", feedback: "", gradedAt: "2026-11-23T06:00:00.000Z" });
    expect(setSubmission(graded, { marks: "7" }, "2026-11-24T06:00:00.000Z")).toEqual({ status: "graded", feedback: "", marks: 7, gradedAt: "2026-11-23T06:00:00.000Z" });
    expect(gradingPatch({ ...subs, b: graded })).toEqual({ submissions: { ...subs, b: graded }, submitted: 2, total: 2 });
  });
});

describe("Homework", () => {
  it("lists only the teacher's live homework", () => {
    teacher(); seed(base);
    renderUI(<MyHomework />);
    const table = screen.getByRole("table", { name: "My homework" });
    expect(within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0]!.textContent)).toEqual(["Homework bEx 4.1", "Homework aEx 4.1"]);
    expect(row("Homework a")).toHaveTextContent("1/2");
    expect(row("Homework b")).toHaveTextContent("closed");
    expect(within(row("Homework b")).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("creates homework the way the app's tk_homework adapter writes it", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyHomework />);
    await user.click(screen.getByRole("button", { name: "New homework" }));
    const d = dialog("New homework");
    await user.selectOptions(field("Class", d), "cls_10B");
    expect([...(field("Subject", d) as unknown as HTMLSelectElement).options].map((o) => o.value)).toEqual(["", "Mathematics", "Physics"]);
    await user.selectOptions(field("Subject", d), "Mathematics");
    await user.type(field("Title", d), "  Algebra set 5 ");
    await user.type(field("Description", d), "Q1-10");
    expect(field("Assigned on", d)).toHaveValue("2026-11-23");
    await user.click(within(d).getByRole("button", { name: "Assign homework" }));
    expect(fieldError("Due date", d)).toBe("Pick a due date");
    expect(writes).toHaveLength(0);
    fireEvent.change(field("Due date", d), { target: { value: "2026-11-30" } });
    await user.click(within(d).getByRole("button", { name: "Assign homework" }));
    expect(writes).toHaveLength(1);
    const created = rowsOf<Record<string, unknown>>("ops_homework").find((h) => h.title === "Algebra set 5")!;
    expect(created).toEqual({
      id: expect.stringMatching(/^hw_/), classId: "cls_10B", grade: "10", section: "B", title: "Algebra set 5", subject: "Mathematics", due: "2026-11-30", maxMarks: 20,
      description: "Q1-10", status: "open", createdAt: expect.any(String), assigned: "2026-11-23", teacher: "Anita",
      submissions: { stu_1: { status: "pending", feedback: "" }, stu_2: { status: "pending", feedback: "" } }, submitted: 0, total: 2, teacherId: "stf_1",
      updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(await screen.findByText('Homework "Algebra set 5" assigned to 10-B')).toBeInTheDocument();
  });

  it("grades submissions: the whole map plus recounted submitted/total", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyHomework />);
    await user.click(within(row("Homework a")).getByRole("button", { name: "Grade" }));
    const d = dialog("Grade: Homework a");
    expect(within(d).queryByText("Left Student")).not.toBeInTheDocument();
    await user.selectOptions(field("Status of Aarav Mehta", d), "submitted");
    await user.selectOptions(field("Status of Bina Rao", d), "graded");
    await user.type(field("Marks of Bina Rao", d), "17");
    await user.type(field("Feedback for Bina Rao", d), "Neat work");
    await user.click(within(d).getByRole("button", { name: "Save submissions" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "a" });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["submissions", "submitted", "total", "updatedAt", "updatedBy"]);
    expect(getRow("ops_homework", "a")).toMatchObject({
      submissions: { stu_1: { status: "submitted", feedback: "" }, stu_2: { status: "graded", feedback: "Neat work", marks: 17, gradedAt: expect.any(String) } }, submitted: 2, total: 2, title: "Homework a",
    });
    expect(await screen.findByText("Submissions saved · 2/2 turned in")).toBeInTheDocument();
  });

  it("closes and soft-deletes homework", async () => {
    teacher(); seed(base);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderUI(<MyHomework />);
    await user.click(within(row("Homework a")).getByRole("button", { name: "Close" }));
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "a", data: { status: "closed" } });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["status", "updatedAt", "updatedBy"]);
    await user.click(within(row("Homework a")).getByRole("button", { name: "Delete" }));
    expect(writes[1]).toMatchObject({ op: "update", coll: "ops_homework", id: "a", data: { deleted: true } });
    expect(Object.keys(writes[1]!.data!).sort()).toEqual(["deleted", "updatedAt", "updatedBy"]);
    expect(getRow("ops_homework", "a")).toMatchObject({ deleted: true, status: "closed", title: "Homework a" });
    expect(screen.queryByText("Homework a")).not.toBeInTheDocument();
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MyHomework />);
    expect(screen.getByText("Only teachers have homework")).toBeInTheDocument();
  });
});
