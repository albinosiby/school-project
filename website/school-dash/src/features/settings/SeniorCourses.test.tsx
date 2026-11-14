import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";
import { EnquirySlideOver } from "@/features/admissions/EnquirySlideOver";
import { computeSeatRows, enrolmentStudent, type ClassRef } from "@/features/admissions/logic";
import type { Offer, Seat } from "@/features/admissions/types";
import { AdmissionForm } from "@/features/admissions/AdmissionForm";
import { ClassesView } from "@/features/ops/ClassesView";
import { SeniorCourses } from "./SeniorCourses";
import { StaffProfileForm } from "@/features/people/StaffProfileForm";
import { departmentError, departmentId, gradeSubjects, splitSeats, stepError, unionSubjects } from "./DepartmentForm";

const catalog = { id: "subjects", subjects: [{ name: "English", active: true }, { name: "Physics", active: true }], departments: [] };
const staff = [{ id: "stf_hod", name: "Meera Nair", department: "Science", category: "Teaching", status: "Active" }];

describe("Senior secondary departments", () => {
  it("splits seats and validates a department draft", () => {
    expect(splitSeats(55, 2)).toEqual([28, 27]);
    expect(splitSeats(30, 4)).toEqual([8, 8, 7, 7]);
    expect(departmentId("Science")).toBe("science");
    expect(departmentId("Home Science")).toBe("course_home_science");
    const draft = { name: "Home Science", total: 55, seats: [30, 25], subjects: [["English"], ["English", "Physics"]] };
    expect(departmentError(draft, [], "")).toBe("");
    expect(stepError(2, { ...draft, seats: [30, 20] }, [], "")).toContain("add up to 50");
    expect(stepError(3, { ...draft, subjects: [["English"], []] }, [], "")).toBe("Grade 12 needs at least one subject.");
    expect(stepError(3, { ...draft, subjects: [["English"]] }, [], "")).toBe("Grade 12 needs at least one subject.");
    expect(unionSubjects([["English", "Physics"], ["english", "Chemistry"]])).toEqual(["English", "Physics", "Chemistry"]);
    const row = { id: "a", grade: "Grade 11", stream: "Science", cap: 30, subjects: ["Physics", "Biology"] };
    expect(gradeSubjects([row, { ...row, id: "b", grade: "Grade 12", subjects: ["Biology"] }])).toEqual([["Physics", "Biology"], ["Biology"]]);
    expect(gradeSubjects([row])).toEqual([["Physics", "Biology"], ["Physics", "Biology"]]);
    expect(departmentError(draft, ["course_home_science"], "")).toContain("already exists");
    expect(departmentError(draft, ["course_home_science"], "course_home_science")).toBe("");
    expect(departmentError(draft, ["course_home_science", "science"], "science")).toContain("already exists");
  });

  it("creates a department for Grades 11 and 12 with its head, catalog subjects, new subject, divisions and seats", async () => {
    const commerce = { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce", stream: "Commerce" };
    seed({ classes: [commerce], set_config: [catalog], staff });
    const editor = renderUI(<SeniorCourses />);
    const user = editor.user;
    await user.click(screen.getByRole("button", { name: "Add department" }));
    const dlg = dialog("Add department");
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(within(dlg).getByRole("alert")).toHaveTextContent("department name");
    await user.type(field("Department name", dlg), "Home Science");
    await user.selectOptions(field("Head of department", dlg), "stf_hod");
    fireEvent.change(field("Total seats", dlg), { target: { value: "55" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(within(dlg).getByRole("listitem", { current: "step" })).toHaveTextContent("Step 2");
    fireEvent.change(field("Divisions", dlg), { target: { value: "2" } });
    expect(field("Division A seats", dlg)).toHaveValue(28);
    fireEvent.change(field("Division A seats", dlg), { target: { value: "30" } });
    fireEvent.change(field("Division B seats", dlg), { target: { value: "20" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(within(dlg).getByRole("alert")).toHaveTextContent("add up to 50");
    fireEvent.change(field("Division B seats", dlg), { target: { value: "25" } });
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    const grade11 = within(dlg).getByRole("region", { name: "Grade 11 subjects" });
    const grade12 = within(dlg).getByRole("region", { name: "Grade 12 subjects" });
    await user.selectOptions(field("Add subject to Grade 11", dlg), "English");
    await user.selectOptions(field("Add subject to Grade 11", dlg), "__new__");
    await user.type(field("New subject name", dlg), "food and nutrition");
    await user.click(within(grade11).getByRole("button", { name: "Add subject" }));
    expect(await screen.findByText("Food And Nutrition added to the subject list")).toBeInTheDocument();
    expect(getRow("set_config", "subjects")?.subjects).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Food And Nutrition", active: true })]));
    await user.click(within(dlg).getByRole("button", { name: "Add department" }));
    expect(within(dlg).getByRole("alert")).toHaveTextContent("Grade 12 needs at least one subject");
    await user.click(within(grade12).getByRole("button", { name: "Copy subjects from Grade 11" }));
    await user.click(within(grade12).getByRole("button", { name: "Remove Food And Nutrition from Grade 12" }));
    expect(within(grade12).getByRole("option", { name: "Food And Nutrition" })).toBeInTheDocument();
    await user.selectOptions(field("Add subject to Grade 12", dlg), "Physics");
    await user.click(within(dlg).getByRole("button", { name: "Add department" }));
    expect(await screen.findByText("Department saved")).toBeInTheDocument();
    expect(getRow("classes", commerce.id)).toEqual(commerce);
    expect(getRow("classes", "cls_11_course_home_science_A")).toMatchObject({ capacity: 30, subjects: ["English", "Food And Nutrition"], stream: "Home Science" });
    expect(getRow("classes", "cls_12_course_home_science_B")).toMatchObject({ capacity: 25, subjects: ["English", "Physics"] });
    expect(getRow("set_sections", "sec_grade11_course_home_science")).toMatchObject({ grade: "Grade 11", stream: "Home Science", hodId: "stf_hod", hod: "Meera Nair", sections: ["11-Home Science-A", "11-Home Science-B"], sectionSeats: [30, 25], cap: 55, subjects: ["English", "Food And Nutrition"] });
    expect(getRow("set_sections", "sec_grade12_course_home_science")).toMatchObject({ grade: "Grade 12", cap: 55, subjects: ["English", "Physics"] });
    const schemeSubjects = (id: string) => (getRow("set_subject_schemes", id)?.subjects as { subject: string }[]).map((s) => s.subject);
    expect(schemeSubjects("scheme_11_course_home_science")).toEqual(["English", "Food And Nutrition"]);
    expect(schemeSubjects("scheme_12_course_home_science")).toEqual(["English", "Physics"]);
    expect(getRow("set_config", "subjects")).toMatchObject({ departments: [{ id: "course_home_science", name: "Home Science", hodId: "stf_hod" }] });
    expect(getRow("set_config", "subjects")?.subjects).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "English", departmentIds: ["course_home_science"] }),
      expect.objectContaining({ name: "Physics", departmentIds: ["course_home_science"] }),
      expect.objectContaining({ name: "Food And Nutrition", departmentIds: ["course_home_science"] }),
    ]));
    expect(computeSeatRows(rowsOf("adm_seats") as Seat[], [], [])).toEqual([
      expect.objectContaining({ grade: "11-course_home_science", free: 55 }),
      expect.objectContaining({ grade: "12-course_home_science", free: 55 }),
    ]);

    const offer = { id: "off_1", name: "Riya", grade: "12-course_home_science" } as Offer;
    const student = enrolmentStudent(offer, undefined, undefined, [], rowsOf("classes") as ClassRef[], "2026-11-06");
    expect(student).toMatchObject({ classId: "cls_12_course_home_science_A", stream: "Home Science" });
    expect(computeSeatRows(rowsOf("adm_seats") as Seat[], [], [{ ...offer, status: "accepted" }], [student])).toEqual([
      expect.objectContaining({ grade: "11-course_home_science", free: 55 }),
      expect.objectContaining({ grade: "12-course_home_science", enrolled: 1, held: 1, free: 54 }),
    ]);

    editor.unmount();
    const teacher = renderUI(<StaffProfileForm staff={[]} permittedRoles={["teacher"]} onClose={() => {}} />);
    const teacherForm = dialog("Add Staff");
    await teacher.user.selectOptions(field("Staff category", teacherForm), "Teaching");
    const primary = field("Subject", teacherForm);
    const newSubject = within(primary).getByRole("option", { name: "Food And Nutrition" });
    expect(within(primary).getAllByRole("option", { name: "Food And Nutrition" })).toHaveLength(1);
    await teacher.user.selectOptions(primary, newSubject);
    expect(primary).toHaveDisplayValue("Food And Nutrition");
    const additional = within(teacherForm).getByRole("group", { name: "Additional subjects" });
    expect(within(additional).getByRole("checkbox", { name: "Physics" })).toBeInTheDocument();
    teacher.unmount();
    const admissions = renderUI(<EnquirySlideOver open onClose={() => {}} />);
    expect(screen.getByRole("option", { name: /Grade 11 \(Home Science\)/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Grade 12 \(Home Science\)/ })).toBeInTheDocument();
    admissions.unmount();

    const admission = renderUI(<AdmissionForm mode="direct" onClose={() => {}} />);
    await admission.user.selectOptions(field("Grade", dialog("New Admission")), "11");
    expect(screen.getByRole("option", { name: "Home Science" })).toBeInTheDocument();
    admission.unmount();

    renderUI(<ClassesView />);
    expect(screen.getByRole("link", { name: "View Grade 11 · Home Science · A details" }))
      .toHaveAttribute("href", "/classes/cls_11_course_home_science_A");
  });

  it("keeps a built-in stream's class ids and edits Grade 11 and Grade 12 subjects separately, dropping a removed subject from that grade's scheme", async () => {
    const row = { stream: "Science", streamId: "science", roster: 0, cap: 60, subjects: ["Physics", "Biology"], sectionSeats: [30, 30] };
    const scheme = { groupKey: "12:science", grade: "12", streamId: "science", scaleId: "default", coScholastic: [], subjects: [{ subject: "Physics", code: "", theory: 70, internal: 30, passMark: 33, gradeOptions: [] }, { subject: "Biology", code: "", theory: 70, internal: 30, passMark: 33, gradeOptions: [] }] };
    seed({ set_config: [{ ...catalog, subjects: [...catalog.subjects, { name: "Biology", active: true }] }],
      set_sections: [{ ...row, id: "sec_grade11_science", grade: "Grade 11", sections: ["11-Science-A", "11-Science-B"] }, { ...row, id: "sec_grade12_science", grade: "Grade 12", sections: ["12-Science-A", "12-Science-B"] }],
      classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science", subjects: ["Physics", "Biology"] }],
      set_subject_schemes: [{ ...scheme, id: "scheme_11_science", groupKey: "11:science", grade: "11" }, { ...scheme, id: "scheme_12_science" }] });
    const { user } = renderUI(<SeniorCourses />);
    await user.click(screen.getByRole("button", { name: "Edit Science" }));
    const dlg = dialog("Edit Science");
    expect(field("Department name", dlg)).toBeEnabled();
    expect(field("Total seats", dlg)).toHaveValue(60);
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    expect(field("Divisions", dlg)).toHaveAttribute("min", "2");
    expect(field("Division B seats", dlg)).toHaveValue(30);
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    const grade12 = within(dlg).getByRole("region", { name: "Grade 12 subjects" });
    expect(within(grade12).getByText("Biology")).toBeInTheDocument();
    await user.selectOptions(field("Add subject to Grade 11", dlg), "English");
    await user.click(within(grade12).getByRole("button", { name: "Remove Biology from Grade 12" }));
    await user.click(within(dlg).getByRole("button", { name: "Save department" }));
    expect(await screen.findByText("Department saved")).toBeInTheDocument();
    expect(getRow("classes", "cls_11_science_A")).toMatchObject({ subjects: ["Physics", "Biology", "English"], capacity: 30 });
    expect(getRow("classes", "cls_11_science_B")).toMatchObject({ subjects: ["Physics", "Biology", "English"], capacity: 30 });
    expect(getRow("classes", "cls_12_science_B")).toMatchObject({ subjects: ["Physics"], capacity: 30 });
    const schemeRows = (id: string) => (getRow("set_subject_schemes", id)?.subjects as { subject: string; theory: number }[]).map((s) => [s.subject, s.theory]);
    expect(schemeRows("scheme_11_science")).toEqual([["Physics", 70], ["Biology", 70], ["English", 80]]);
    expect(schemeRows("scheme_12_science")).toEqual([["Physics", 70]]);
    expect(getRow("set_sections", "sec_grade12_science")).toMatchObject({ subjects: ["Physics"] });
    expect(getRow("set_config", "subjects")?.subjects).toEqual(expect.arrayContaining([expect.objectContaining({ name: "Biology", departmentIds: ["science"] })]));
  });

  it("renames an empty department, moving its classes, seats, scheme, timetable and catalog entry to the new id", async () => {
    const row = { stream: "Science", streamId: "science", roster: 0, cap: 30, subjects: ["Physics"], sectionSeats: [30], hodId: "stf_hod", hod: "Meera Nair" };
    const scheme = { grade: "11", streamId: "science", scaleId: "cbse", coScholastic: ["Art"], subjects: [{ subject: "Physics", code: "042", theory: 70, internal: 30, passMark: 33, gradeOptions: [] }] };
    seed({ staff,
      set_config: [{ id: "subjects", subjects: [{ name: "Physics", active: true, departmentIds: ["science"] }], departments: [{ id: "science", name: "Science", hodId: "stf_hod" }] }],
      set_sections: [{ ...row, id: "sec_grade11_science", grade: "Grade 11", sections: ["11-Science-A"] }, { ...row, id: "sec_grade12_science", grade: "Grade 12", sections: ["12-Science-A"] }],
      classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science", capacity: 30, subjects: ["Physics"] }, { id: "cls_12_science_A", grade: "12", section: "A", streamId: "science", capacity: 30 }],
      adm_seats: [{ id: "seat_11_science", grade: "11-science", group: "senior", streamId: "science", capacity: 30, rteSeats: 0, block: "" }, { id: "seat_12_science", grade: "12-science", group: "senior", streamId: "science", capacity: 30, rteSeats: 0, block: "" }],
      set_subject_schemes: [{ ...scheme, id: "scheme_11_science", groupKey: "11:science" }, { ...scheme, id: "scheme_12_science", groupKey: "12:science", grade: "12" }],
      assignments: [{ id: "a1", classId: "cls_11_science_A", subject: "Physics", teacherId: "stf_hod" }, { id: "a9", classId: "cls_9A", subject: "Maths", teacherId: "stf_hod" }],
      ops_periods: [{ id: "p1", classId: "cls_12_science_A", day: "Mon", period: 1, subject: "Physics" }] });
    const { user } = renderUI(<SeniorCourses />);
    await user.click(screen.getByRole("button", { name: "Edit Science" }));
    const dlg = dialog("Edit Science");
    expect(field("Department name", dlg)).toBeEnabled();
    await user.clear(field("Department name", dlg));
    await user.type(field("Department name", dlg), "Pure Science");
    expect(within(dlg).getByText(/Renaming moves its classes/)).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    await user.click(within(dlg).getByRole("button", { name: "Save department" }));
    expect(await screen.findByText("Department saved")).toBeInTheDocument();
    expect(rowsOf("set_sections").map((r) => r.id).sort()).toEqual(["sec_grade11_course_pure_science", "sec_grade12_course_pure_science"]);
    expect(getRow("set_sections", "sec_grade11_course_pure_science")).toMatchObject({ stream: "Pure Science", streamId: "course_pure_science", hod: "Meera Nair", sections: ["11-Pure Science-A"], subjects: ["Physics"], cap: 30 });
    expect(rowsOf("classes").map((r) => r.id).sort()).toEqual(["cls_11_course_pure_science_A", "cls_12_course_pure_science_A"]);
    expect(getRow("classes", "cls_11_course_pure_science_A")).toMatchObject({ stream: "Pure Science", streamId: "course_pure_science", capacity: 30, subjects: ["Physics"] });
    expect(rowsOf("adm_seats").map((r) => r.id).sort()).toEqual(["seat_11_course_pure_science", "seat_12_course_pure_science"]);
    expect(rowsOf("set_subject_schemes").map((r) => r.id).sort()).toEqual(["scheme_11_course_pure_science", "scheme_12_course_pure_science"]);
    expect(getRow("set_subject_schemes", "scheme_12_course_pure_science")).toMatchObject({ groupKey: "12:course_pure_science", grade: "12", streamId: "course_pure_science", scaleId: "cbse", coScholastic: ["Art"], subjects: [expect.objectContaining({ subject: "Physics", code: "042", theory: 70 })] });
    expect(getRow("assignments", "a1")).toMatchObject({ classId: "cls_11_course_pure_science_A" });
    expect(getRow("assignments", "a9")).toMatchObject({ classId: "cls_9A" });
    expect(getRow("ops_periods", "p1")).toMatchObject({ classId: "cls_12_course_pure_science_A" });
    expect(getRow("set_config", "subjects")).toMatchObject({ departments: [{ id: "course_pure_science", name: "Pure Science", hodId: "stf_hod" }], subjects: [expect.objectContaining({ name: "Physics", departmentIds: ["course_pure_science"] })] });
  });

  it("locks the name of a department that has students", async () => {
    seed({ set_config: [catalog],
      set_sections: [{ id: "sec_grade11_science", grade: "Grade 11", stream: "Science", streamId: "science", sections: ["11-Science-A"], roster: 1, cap: 30, subjects: ["Physics"], sectionSeats: [30] }],
      students: [{ id: "s1", name: "Riya", grade: "11", section: "A", classId: "cls_11_science_A", status: "Active" }] });
    const { user } = renderUI(<SeniorCourses />);
    await user.click(screen.getByRole("button", { name: "Edit Science" }));
    const dlg = dialog("Edit Science");
    expect(field("Department name", dlg)).toBeDisabled();
    expect(within(dlg).getByText("Locked while the department has students or admissions")).toBeInTheDocument();
  });

  it("keeps the records unchanged if a department save cannot commit", async () => {
    seed({ set_config: [catalog] });
    const { user } = renderUI(<SeniorCourses />);
    await user.click(screen.getByRole("button", { name: "Add department" }));
    const dlg = dialog("Add department");
    await user.type(field("Department name", dlg), "Home Science");
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    await user.click(within(dlg).getByRole("button", { name: "Next" }));
    await user.selectOptions(field("Add subject to Grade 11", dlg), "English");
    await user.selectOptions(field("Add subject to Grade 12", dlg), "English");
    const { failNextWrite } = await import("@/test/render");
    failNextWrite();
    await user.click(within(dlg).getByRole("button", { name: "Add department" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
