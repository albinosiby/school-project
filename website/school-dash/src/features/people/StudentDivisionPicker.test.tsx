import { describe, expect, it } from "vitest";
import { StudentDetailsView } from "./StudentDetailsView";
import { StudentDivisionAssignment } from "./StudentDivisionPicker";
import { assignStudentDivision, type DivisionClass } from "./studentDivisionAssignment";
import type { Student } from "./StudentsView";
import { dialog, failNextWrite, field, getRow, renderUI, screen, seed, within, writes } from "@/test/render";

const student: Student = { id: "stu_001", name: "Riya", grn: "GIS-1", grade: "5", section: "", classId: "", roll: 0,
  guardian: "Parent", phone: "9000000000", attendance: 100, status: "Active", guardianUids: ["parent_uid"], busId: "bus_1", busStopId: "stop_1" };
const a: DivisionClass = { id: "cls_5A", grade: "5", section: "A", capacity: 2, studentCount: 0 };
const b: DivisionClass = { id: "cls_5B", grade: "5", section: "B", capacity: 2, studentCount: 0 };

describe("Student division assignment", () => {
  it("assigns a division from Student Details and updates the displayed class", async () => {
    seed({ students: [student], classes: [a, b, { ...a, id: "cls_6A", grade: "6" }] });
    const { user } = renderUI(<StudentDetailsView studentId={student.id} />);
    await user.click(await screen.findByRole("button", { name: "Assign division" }));
    const form = dialog("Assign division");
    const choices = field("Division", form) as unknown as HTMLSelectElement;
    expect([...choices.options].map((option) => option.value)).toEqual(["", a.id, b.id]);
    await user.selectOptions(choices, a.id);
    await user.click(within(form).getByRole("button", { name: "Save division" }));
    expect(screen.queryByRole("dialog", { name: "Assign division" })).not.toBeInTheDocument();
    expect(screen.getByText(/Grade 5 · Division A/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change division" })).toBeInTheDocument();
    expect(getRow("students", student.id)).toMatchObject({ grade: "5", classId: a.id, section: "A", roll: 0,
      guardianUids: ["parent_uid"], busId: "bus_1", busStopId: "stop_1" });
    expect(getRow("classes", a.id)).toMatchObject({ studentCount: 1, divisionAssignmentRevision: 1 });
  });

  it("offers only the student's senior department and grade", async () => {
    const senior = { ...student, grade: "11", streamId: "course_home_science", stream: "Home Science" };
    const home = { ...a, id: "cls_11_course_home_science_A", grade: "11", streamId: "course_home_science", stream: "Home Science" };
    seed({ students: [senior], classes: [home, { ...home, id: "cls_12_course_home_science_A", grade: "12" },
      { ...home, id: "cls_11_science_A", streamId: "science", stream: "Science" }] });
    const { user } = renderUI(<StudentDivisionAssignment student={senior} students={[senior]} />);
    await user.click(screen.getByRole("button", { name: "Assign division" }));
    const form = dialog("Assign division");
    const choices = field("Division", form) as unknown as HTMLSelectElement;
    expect([...choices.options].map((option) => option.value)).toEqual(["", home.id]);
    await user.selectOptions(choices, home.id);
    await user.click(within(form).getByRole("button", { name: "Save division" }));
    expect(getRow("students", senior.id)).toMatchObject({ grade: "11", streamId: "course_home_science", stream: "Home Science", section: "A", classId: home.id });
  });

  it("disables full divisions and keeps a failed save available for retry", async () => {
    const other = { ...student, id: "other", section: "A", classId: a.id };
    const full = { ...a, capacity: 1, studentCount: 1 };
    seed({ students: [student, other], classes: [full, b] });
    const { user } = renderUI(<StudentDivisionAssignment student={student} students={[student, other]} />);
    await user.click(screen.getByRole("button", { name: "Assign division" }));
    const form = dialog("Assign division");
    expect(within(form).getByRole("option", { name: "Division A · Full" })).toBeDisabled();
    await user.selectOptions(field("Division", form), b.id);
    failNextWrite(new Error("permission-denied"));
    await user.click(within(form).getByRole("button", { name: "Save division" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("permission-denied");
    expect(getRow("students", student.id)).toMatchObject({ classId: "", section: "" });
    expect(writes).toHaveLength(0);
    await user.click(within(form).getByRole("button", { name: "Save division" }));
    expect(getRow("students", student.id)).toMatchObject({ classId: b.id, section: "B" });
  });

  it("explains how to configure missing divisions", async () => {
    const { user } = renderUI(<StudentDivisionAssignment student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign division" }));
    const form = dialog("Assign division");
    expect(within(form).getByRole("link", { name: "Classes & Sections" })).toHaveAttribute("href", "/settings?section=capacity");
    expect(within(form).getByRole("button", { name: "Save division" })).toBeDisabled();
  });

  it("does not offer assignment to a transferred student", () => {
    renderUI(<StudentDivisionAssignment student={{ ...student, status: "Transferred" }} students={[]} />);
    expect(screen.getByRole("button", { name: "Assign division" })).toBeDisabled();
  });

  it("moves divisions, releases the old seat and resets the class-specific roll only", async () => {
    const assigned = { ...student, section: "A", classId: a.id, roll: 7, rollAcademicYear: "2026-27" };
    const oldClass = { ...a, studentCount: 1 };
    seed({ students: [assigned], classes: [oldClass, b], ops_attendance: [{ id: "history", classId: a.id, studentId: student.id }] });
    await assignStudentDivision(assigned, b.id, [oldClass, b]);
    expect(getRow("students", student.id)).toMatchObject({ grade: "5", section: "B", classId: b.id, roll: 0, rollAcademicYear: "",
      guardianUids: ["parent_uid"], busId: "bus_1", busStopId: "stop_1" });
    expect(getRow("classes", a.id)).toMatchObject({ studentCount: 0, divisionAssignmentRevision: 1 });
    expect(getRow("classes", b.id)).toMatchObject({ studentCount: 1, divisionAssignmentRevision: 1 });
    expect(getRow("ops_attendance", "history")).toMatchObject({ classId: a.id });
  });

  it("keeps the roll when the class is unchanged", async () => {
    const assigned = { ...student, section: "A", classId: a.id, roll: 7, rollAcademicYear: "2026-27" };
    seed({ students: [assigned], classes: [a] });
    await assignStudentDivision(assigned, a.id, [a]);
    expect(writes).toHaveLength(0);
    expect(getRow("students", student.id)).toMatchObject({ roll: 7, rollAcademicYear: "2026-27" });
  });

  it("rejects a different grade before writing", async () => {
    const wrong = { ...a, id: "cls_6A", grade: "6" };
    seed({ students: [student], classes: [wrong] });
    await expect(assignStudentDivision(student, wrong.id, [wrong])).rejects.toThrow("grade and department");
    expect(writes).toHaveLength(0);
  });

  it("rejects a changed student, a removed division and stale seat availability", async () => {
    seed({ students: [{ ...student, grade: "6" }], classes: [a] });
    await expect(assignStudentDivision(student, a.id, [a])).rejects.toThrow("grade or division changed");
    seed({ students: [student] });
    await expect(assignStudentDivision(student, b.id, [b])).rejects.toThrow("division is no longer available");
    seed({ classes: [{ ...a, divisionAssignmentRevision: 1 }] });
    await expect(assignStudentDivision(student, a.id, [a])).rejects.toThrow("availability changed");
    expect(writes).toHaveLength(0);
  });

  it("rechecks the stored seat limit even when the loaded class had more seats", async () => {
    const other = { ...student, id: "other", section: "A", classId: a.id };
    seed({ students: [student, other], classes: [{ ...a, capacity: 1 }] });
    await expect(assignStudentDivision(student, a.id, [a])).rejects.toThrow("no available seats");
    expect(writes).toHaveLength(0);
  });

  it("recounts the live roster instead of blocking on an outdated cached class total", async () => {
    const staleTotal = { ...a, studentCount: 8 };
    seed({ students: [student], classes: [staleTotal] });
    await assignStudentDivision(student, a.id, [staleTotal]);
    expect(getRow("students", student.id)).toMatchObject({ classId: a.id, section: "A" });
    expect(getRow("classes", a.id)).toMatchObject({ studentCount: 1 });
  });
});
