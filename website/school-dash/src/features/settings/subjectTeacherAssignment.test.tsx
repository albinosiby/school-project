import { expect, it } from "vitest";
import { GradeDetailsView } from "./GradeDetailsView";
import { newSectionRow } from "./gradeSetup";
import { canTeachSubject, saveSubjectTeacher, type SubjectTeacher, type TeachingAssignment } from "./subjectTeacherAssignment";
import { failNextWrite, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

const section = { ...newSectionRow("5", "", ["A", "B"], { A: 30, B: 30 }), subjects: ["Mathematics", "English"] };
const classes = [{ id: "cls_5A", grade: "5", section: "A" }, { id: "cls_5B", grade: "5", section: "B" }];
const math: SubjectTeacher = { id: "math", name: "Anita", category: "Teaching", status: "Active", subjectNames: ["Mathematics"] };
const additional: SubjectTeacher = { id: "additional", name: "Ravi", category: "Teaching", status: "Active", subjectNames: ["English", " mathematics "] };
const old: TeachingAssignment & { topic: string; periodsPerWeek: number } = { id: "old_assignment", classId: "cls_5A", subject: "mathematics", teacherId: "math", teacher: "Anita", topic: "Algebra", periodsPerWeek: 5 };

it("offers primary and additional subject teachers, with no department fallback or unrelated staff", async () => {
  seed({ set_sections: [section], classes, staff: [math, additional,
    { ...math, id: "office", name: "Office", category: "Non-Teaching" },
    { ...math, id: "retired", name: "Retired teacher", status: "Retired" },
    { ...math, id: "department_only", name: "Department only", subjectNames: [], department: "Mathematics" },
    { ...math, id: "substring", name: "Different subject", subjectNames: ["Advanced Mathematics"] },
  ] });
  const { user } = renderUI(<GradeDetailsView gradeId={section.id} />);
  const picker = await screen.findByRole("combobox", { name: "Mathematics teacher for 5-A" });
  expect(within(picker).getAllByRole("option").map((option) => option.textContent)).toEqual(["Not assigned", "Anita", "Ravi"]);
  const english = screen.getByRole("combobox", { name: "English teacher for 5-A" });
  expect(within(english).getAllByRole("option").map((option) => option.textContent)).toEqual(["Not assigned", "Ravi"]);
  await user.selectOptions(picker, "math");
  expect(picker).toHaveValue("math");
  expect(rowsOf("assignments")).toEqual([expect.objectContaining({ classId: "cls_5A", subject: "Mathematics", teacherId: "math", teacher: "Anita" })]);
  await user.selectOptions(screen.getByRole("combobox", { name: "Mathematics teacher for 5-B" }), "math");
  expect(rowsOf("assignments")).toHaveLength(2);
  expect(getRow("classes", "cls_5A")).not.toHaveProperty("classTeacherId");
});

it("replaces an existing assignment once, preserves its metadata, and supports unassigning", async () => {
  seed({ set_sections: [section], classes, staff: [math, additional], assignments: [old] });
  const { user } = renderUI(<GradeDetailsView gradeId={section.id} />);
  const picker = await screen.findByRole("combobox", { name: "Mathematics teacher for 5-A" });
  expect(picker).toHaveValue("math");
  await user.selectOptions(picker, "additional");
  expect(picker).toHaveValue("additional");
  expect(rowsOf("assignments")).toEqual([expect.objectContaining({ classId: "cls_5A", subject: "Mathematics", teacherId: "additional", topic: "Algebra", periodsPerWeek: 5 })]);
  expect(getRow("assignments", old.id)).toBeUndefined();
  await user.selectOptions(picker, "");
  expect(rowsOf("assignments")).toHaveLength(0);
  expect(picker).toHaveValue("");
});

it("keeps the current teacher and reports a failed save without removing the old assignment", async () => {
  seed({ set_sections: [section], classes, staff: [math, additional], assignments: [old] });
  const { user } = renderUI(<GradeDetailsView gradeId={section.id} />);
  const picker = await screen.findByRole("combobox", { name: "Mathematics teacher for 5-A" });
  failNextWrite(new Error("permission-denied"));
  await user.selectOptions(picker, "additional");
  expect(await screen.findByRole("alert")).toHaveTextContent("permission-denied");
  expect(picker).toHaveValue("math");
  expect(getRow("assignments", old.id)).toMatchObject({ teacherId: "math" });
  expect(writes).toHaveLength(0);
  await user.selectOptions(picker, "additional");
  expect(picker).toHaveValue("additional");
});

it("explains empty choices and keeps an ineligible saved teacher visible without offering them as a choice", async () => {
  seed({ set_sections: [section], classes, staff: [{ ...math, subjectNames: ["Science"] }], assignments: [old] });
  const { user } = renderUI(<GradeDetailsView gradeId={section.id} />);
  const assigned = await screen.findByRole("combobox", { name: "Mathematics teacher for 5-A" });
  expect(assigned).toHaveValue("math");
  expect(within(assigned).getAllByRole("option").map((option) => option.textContent)).toEqual(["Not assigned"]);
  expect(screen.getByRole("combobox", { name: "Mathematics teacher for 5-B" })).toBeDisabled();
  await user.selectOptions(assigned, "");
  expect(rowsOf("assignments")).toHaveLength(0);
});

it("saves a senior subject assignment only for the selected division", async () => {
  const senior = { ...newSectionRow("11", "science", ["A", "B"], { A: 30, B: 30 }), subjects: ["Physics"] };
  const physics = { ...math, subjectNames: ["Physics"] };
  seed({ set_sections: [senior], classes: [{ id: "cls_11_science_A", grade: "11", streamId: "science", section: "A" },
    { id: "cls_11_science_B", grade: "11", streamId: "science", section: "B" }], staff: [physics] });
  const { user } = renderUI(<GradeDetailsView gradeId={senior.id} />);
  await user.selectOptions(await screen.findByRole("combobox", { name: "Physics teacher for 11-Science-B" }), "math");
  expect(rowsOf("assignments")).toEqual([expect.objectContaining({ classId: "cls_11_science_B", subject: "Physics", teacherId: "math" })]);
  expect(screen.getByRole("combobox", { name: "Physics teacher for 11-Science-A" })).toHaveValue("");
});

it("supports legacy saved subject lists while ignoring stale subject fields when subjectNames is present", () => {
  expect(canTeachSubject({ id: "legacy", name: "Teacher", role: "TGT", subjects: " English, Mathematics " }, "mathematics")).toBe(true);
  expect(canTeachSubject({ ...math, subjectNames: [], subjects: "Mathematics" }, "Mathematics")).toBe(false);
});

it("rechecks profile subjects at save time and writes nothing if they were removed", async () => {
  seed({ set_sections: [section], classes, staff: [{ ...math, subjectNames: ["Science"] }], assignments: [old] });
  await expect(saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "math", expected: [old] }))
    .rejects.toThrow("no longer available for this subject");
  expect(writes).toHaveLength(0);
  expect(getRow("assignments", old.id)).toMatchObject({ teacherId: "math" });
});

it("rejects stale edits instead of overwriting another administrator's assignment", async () => {
  seed({ set_sections: [section], classes, staff: [math, additional], assignments: [{ ...old, teacherId: "additional", teacher: "Ravi" }] });
  await expect(saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "math", expected: [old] }))
    .rejects.toThrow("assignment changed");
  expect(writes).toHaveLength(0);
});

it("rejects assignments when the subject or division has been removed", async () => {
  seed({ set_sections: [{ ...section, subjects: ["English"] }], classes, staff: [math] });
  await expect(saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "math", expected: [] }))
    .rejects.toThrow("subject is no longer configured");
  seed({ set_sections: [{ ...section, sections: ["5-B"] }] });
  await expect(saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "math", expected: [] }))
    .rejects.toThrow("division changed or was removed");
  expect(writes).toHaveLength(0);
});

it("consolidates old duplicates into one assignment and refuses a second stale creation", async () => {
  const duplicate = { ...old, id: "duplicate", teacherId: "additional", teacher: "Ravi" };
  seed({ set_sections: [section], classes, staff: [math, additional], assignments: [old, duplicate] });
  await saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "additional", expected: [old, duplicate] });
  expect(rowsOf("assignments")).toHaveLength(1);
  await expect(saveSubjectTeacher({ section, classId: "cls_5A", subject: "Mathematics", teacherId: "math", expected: [] }))
    .rejects.toThrow("assignment changed");
  expect(rowsOf("assignments")).toEqual([expect.objectContaining({ teacherId: "additional" })]);
});
