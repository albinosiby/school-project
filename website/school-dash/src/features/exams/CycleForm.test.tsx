import { fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CycleForm } from "./CycleForm";
import { field, renderUI, router, rowsOf, screen, seed, within, writesTo } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-12T10:00:00Z")); });
afterEach(() => vi.useRealTimers());
const classA = { id: "cls_11_course_home_science_A", grade: "11", section: "A", streamId: "course_home_science", stream: "Home Science", subjects: ["Food and Nutrition"] };
const classB = { ...classA, id: "cls_11_course_home_science_B", section: "B" };
const student = (id: string, classId = classA.id) => ({ id, name: id, grade: "11", section: classId === classA.id ? "A" : "B", classId, streamId: "course_home_science", grn: id, status: "Active", roll: 1 });
const staff = [{ id: "teacher_1", name: "Teacher One", department: "Home Science", status: "Active" }];
const change = (label: string, value: string, root?: HTMLElement) => fireEvent.change(field(label, root), { target: { value } });
async function open() {
  seed({ classes: [classA, classB], students: [student("Included"), student("Excluded", classB.id)], staff,
    school: [{ id: "profile", academicYear: "2026–27" }], assignments: [{ id: "a1", classId: classA.id, subject: "Food and Nutrition", teacherId: "teacher_1" }] });
  return renderUI(<CycleForm />);
}
async function fill(user: ReturnType<typeof renderUI>["user"]) {
  change("Examination name", "Term 1");
  change("Exam start date", "2026-12-01"); change("Exam end date", "2026-12-10");
  await user.click(screen.getByRole("button", { name: "2. Classes & Divisions" }));
  await user.click(screen.getByRole("button", { name: "Select all Grade 11 · Home Science" }));
  change("Find student to exclude", "Excl");
  await user.click(screen.getByRole("button", { name: "Exclude Excluded · Excluded" }));
  await user.click(screen.getByRole("button", { name: "3. Subjects & Assessment" }));
  await user.selectOptions(field("Add subject for Grade 11 · Home Science"), "Food and Nutrition");
  expect(field("Marks entry teacher · 11-Home Science-A")).toHaveValue("teacher_1");
  await user.click(screen.getByRole("button", { name: "4. Timetable" }));
  change("Paper date", "2026-12-02"); change("Start time", "09:00");
  expect(field("End time")).toHaveValue("11:00");
  await user.click(screen.getByRole("button", { name: "6. Review & Publish" }));
}

describe("Six-step examination setup", () => {
  it("offers the school's active subject catalog for classes without their own subject list", async () => {
    seed({ classes: [{ id: "cls_5A", grade: "5", section: "A" }], set_config: [{ id: "subjects", subjects: [{ name: "Mathematics", active: true }, { name: "Archived subject", active: false }] }] });
    const { user } = renderUI(<CycleForm />);
    await user.click(screen.getByRole("button", { name: "2. Classes & Divisions" }));
    await user.click(screen.getByRole("button", { name: "5-A" }));
    await user.click(screen.getByRole("button", { name: "3. Subjects & Assessment" }));
    expect(screen.getByRole("option", { name: "Mathematics" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Archived subject" })).not.toBeInTheDocument();
  });
  it("selects divisions from the matrix with presets, shows scheme readiness and excludes students by search", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "2. Classes & Divisions" }));
    expect(screen.getByText(", no subject scheme")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Senior secondary 11 and 12" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Classes LKG to 10" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Senior 11–12" }));
    expect(screen.getByRole("button", { name: "Senior 11–12" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "11-Home Science-A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "11-Home Science-B" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/no scheme, add subjects manually/)).toBeInTheDocument();
    change("Find student to exclude", "excl");
    await user.click(screen.getByRole("button", { name: "Exclude Excluded · Excluded" }));
    expect(screen.getByText("1 excluded")).toBeInTheDocument();
    expect(screen.getByText("Participating students").nextSibling).toHaveTextContent("1");
    await user.click(screen.getByRole("button", { name: "Remove exclusion Excluded" }));
    expect(screen.getByText("0 excluded")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "11-Home Science-B" }));
    expect(screen.getByRole("button", { name: "11-Home Science-B" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(screen.getByText("Nothing selected yet.")).toBeInTheDocument();
  });
  it("combines stage presets instead of replacing the selection", async () => {
    seed({ classes: [{ id: "cls_5A", grade: "5", section: "A" }, { id: "cls_9A", grade: "9", section: "A" }, { id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" }] });
    const { user } = renderUI(<CycleForm />);
    await user.click(screen.getByRole("button", { name: "2. Classes & Divisions" }));
    await user.click(screen.getByRole("button", { name: "Primary 1–5" }));
    await user.click(screen.getByRole("button", { name: "Secondary 9–10" }));
    expect(screen.getByRole("button", { name: "5-A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "9-A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "11-Science-A" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Primary 1–5" }));
    expect(screen.getByRole("button", { name: "5-A" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "9-A" })).toHaveAttribute("aria-pressed", "true");
  });
  it("saves a resumable draft from the first step with only a name", async () => {
    const { user } = await open();
    change("Examination name", "Annual examination");
    await user.click(screen.getByRole("button", { name: "Save as Draft" }));
    expect(rowsOf("exm_cycles")[0]).toMatchObject({ title: "Annual examination", status: "Draft", publicationState: "draft" });
    expect(writesTo("exm_candidates")).toHaveLength(0);
    expect(router.push).toHaveBeenCalledWith("/exams");
  });
  it("publishes exact divisions, course subjects and participants with independent assessment settings", async () => {
    const { user } = await open();
    await fill(user);
    await user.click(screen.getByRole("button", { name: "Publish Exam" }));
    const cycle = rowsOf("exm_cycles")[0];
    expect(cycle).toMatchObject({ title: "Term 1", classIds: [classA.id, classB.id], excludedStudentIds: ["Excluded"], publicationState: "published", status: "Scheduled" });
    expect(rowsOf("exm_papers")[0]).toMatchObject({ cycleId: cycle.id, classIds: [classA.id, classB.id], studentIds: ["Included"], subject: "Food and Nutrition", theory: 80, internal: 20, practical: 0, passMarks: 33, evaluatorIds: { [classA.id]: "teacher_1" }, locked: false, published: [] });
    expect(rowsOf("exm_candidates").map((row) => row.id)).toEqual(["cand_Included"]);
  });
  it("keeps scheduled examinations locked until the school-time publication instant", async () => {
    const { user } = await open(); await fill(user);
    change("Schedule publication", "2026-11-20T09:00");
    await user.click(screen.getByRole("button", { name: "Schedule Publication" }));
    expect(rowsOf("exm_cycles")[0]).toMatchObject({ publishAt: "2026-11-20T03:30:00.000Z", publicationState: "scheduled", status: "Draft" });
    expect(rowsOf("exm_papers")[0]).toMatchObject({ locked: true, setupPublished: false });
  });
  it("reviews missing subjects and dates without publishing a partial exam", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: "6. Review & Publish" }));
    await user.click(screen.getByRole("button", { name: "Publish Exam" }));
    expect(within(screen.getByRole("alert")).getByText("Select at least one class and division")).toBeInTheDocument();
    expect(writesTo("exm_cycles")).toHaveLength(0);
  });
  it("loads old published cycles for inspection without permitting destructive reconfiguration", async () => {
    seed({ classes: [classA], exm_cycles: [{ id: "old", title: "Legacy exam", status: "Live", grades: ["11"] }] });
    renderUI(<CycleForm cycleId="old" />);
    expect(field("Examination name")).toHaveValue("Legacy exam");
    expect(field("Examination name")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save as Draft" })).not.toBeInTheDocument();
  });
});

describe("Assessment scheme pre-fill", () => {
  const cls9 = { id: "cls_9A", grade: "9", section: "A" };
  const scheme9 = { id: "scheme_9", groupKey: "9:", grade: "9", streamId: "", scaleId: "default", coScholastic: [], subjects: [
    { subject: "Mathematics", code: "041", mode: "marks", theory: 80, practical: 0, internal: 20, passMarks: 33, theoryPass: 0, practicalPass: 0, internalPass: 0, weight: 1, gradeOptions: [], duration: 3, enteredBy: "subjectTeacher" }] };
  const examType = (id: string, name: string, pattern: string, weight: number) => ({ id, name, short: id, termId: "term_1", weight, pattern, singleMax: 20, shareSubjectWise: pattern === "single", countsInTerm: true, order: weight, active: true });
  const seedScheme = () => seed({
    classes: [cls9], staff, school: [{ id: "profile", academicYear: "2026–27" }],
    students: [{ id: "S1", name: "S1", grade: "9", section: "A", classId: cls9.id, grn: "S1", status: "Active", roll: 1 }],
    assignments: [{ id: "a9", classId: cls9.id, subject: "Mathematics", teacherId: "teacher_1" }],
    set_terms: [{ id: "term_1", name: "Term 1", start: "2026-04-01", end: "2026-09-30", days: 183, status: "In Progress" }],
    set_exam_types: [examType("ext_pt1", "Periodic Test 1", "single", 10), examType("ext_hy", "Half-Yearly", "scheme", 80)],
    set_subject_schemes: [scheme9],
  });
  const selectGrade9 = async (user: ReturnType<typeof renderUI>["user"]) => {
    await user.click(screen.getByRole("button", { name: "2. Classes & Divisions" }));
    await user.click(screen.getByRole("button", { name: "9-A" }));
    await user.click(screen.getByRole("button", { name: "3. Subjects & Assessment" }));
    return screen.getByRole("region", { name: "Mathematics assessment" });
  };
  it("pre-fills a selected class group from its scheme, scaled to the exam type, and stores the type and term", async () => {
    seedScheme();
    const { user } = renderUI(<CycleForm />);
    change("Examination name", "PT1");
    await user.selectOptions(field("Exam type"), "ext_pt1");
    change("Exam start date", "2026-12-01"); change("Exam end date", "2026-12-10");
    const section = await selectGrade9(user);
    expect(field("Theory maximum", section)).toHaveValue(20);
    expect(field("Internal maximum", section)).toHaveValue(0);
    expect(field("Pass marks", section)).toHaveValue(7);
    expect(field("Marks entry teacher · 9-A", section)).toHaveValue("teacher_1");
    await user.click(screen.getByRole("button", { name: "4. Timetable" }));
    change("Paper date", "2026-12-02"); change("Start time", "09:00");
    await user.click(screen.getByRole("button", { name: "6. Review & Publish" }));
    await user.click(screen.getByRole("button", { name: "Publish Exam" }));
    expect(rowsOf("exm_cycles")[0]).toMatchObject({ examType: "Periodic Test 1", examTypeId: "ext_pt1", termId: "term_1" });
    expect(rowsOf("exm_papers")[0]).toMatchObject({ subject: "Mathematics", code: "041", theory: 20, internal: 0, passMarks: 7, evaluatorIds: { cls_9A: "teacher_1" } });
  });
  it("uses the full scheme components for a scheme-pattern exam and can reset manual edits to the scheme", async () => {
    seedScheme();
    const { user } = renderUI(<CycleForm />);
    await user.selectOptions(field("Exam type"), "ext_hy");
    const section = await selectGrade9(user);
    expect(field("Theory maximum", section)).toHaveValue(80);
    expect(field("Internal maximum", section)).toHaveValue(20);
    change("Theory maximum", "70", section);
    expect(field("Theory maximum", section)).toHaveValue(70);
    await user.click(screen.getByRole("button", { name: "Reset to Grade 9 scheme" }));
    expect(field("Theory maximum", screen.getByRole("region", { name: "Mathematics assessment" }))).toHaveValue(80);
  });
});
