import { expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { GradeDetailsView } from "./GradeDetailsView";
import { field, getRow, renderUI, router, rowsOf, screen, seed, within, writes } from "@/test/render";

it("shows a regular grade's sections and the same subject-teacher table as senior secondary, with legacy scheme subjects", async () => {
  seed({
    set_sections: [{ id: "sec_grade9", grade: "Grade 9", stream: "Secondary", sections: ["9-A", "9-B"], roster: 0, cap: 80 }],
    classes: [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_1", room: "R-12", capacity: 40 }],
    staff: [{ id: "stf_1", name: "Anita Sharma" }],
    students: [{ id: "s1", grade: "9", section: "A", classId: "cls_9A", status: "Active" }, { id: "s2", grade: "9", section: "A", classId: "cls_9A", status: "Transferred" }],
    set_config: [{ id: "subjects", subjects: [{ name: "Mathematics", active: true }] }],
    set_subject_schemes: [{ id: "scheme_9", groupKey: "9:", subjects: [{ subject: "Mathematics", theory: 70 }, { subject: "English", theory: 80 }] }],
    assignments: [{ id: "a1", classId: "cls_9A", subject: "mathematics", teacherId: "stf_1" },
      { id: "a2", classId: "cls_9B", subject: "Mathematics", teacher: "Ravi Kumar" }],
  });
  renderUI(<GradeDetailsView gradeId="sec_grade9" />);
  expect(await screen.findByRole("heading", { name: "Grade 9" })).toBeInTheDocument();
  const sections = screen.getByRole("table", { name: "Sections" });
  const rowA = within(sections).getByText("9-A").closest("tr")!;
  expect(within(rowA).getByText("Anita Sharma")).toBeInTheDocument();
  expect(within(rowA).getByText("1 / 40")).toBeInTheDocument();
  expect(within(rowA).getByRole("link", { name: "Open class" })).toHaveAttribute("href", "/classes/cls_9A");
  const rowB = within(sections).getByText("9-B").closest("tr")!;
  expect(within(rowB).getByText("No class record")).toBeInTheDocument();
  expect(within(rowB).queryByRole("link", { name: "Open class" })).not.toBeInTheDocument();
  const subjects = screen.getByRole("table", { name: "Subjects and teachers" });
  expect(within(subjects).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Subject", "9-A", "9-B"]);
  const maths = within(subjects).getByText("Mathematics").closest("tr")!;
  expect(within(maths).getByText("Anita Sharma")).toBeInTheDocument();
  expect(within(maths).getByText("Ravi Kumar")).toBeInTheDocument();
  const english = within(subjects).getByText("English").closest("tr")!;
  expect(within(english).getAllByText("Not assigned")).toHaveLength(2);
  expect(within(subjects).getByRole("combobox", { name: "Mathematics teacher for 9-A" })).toBeInTheDocument();
  expect(within(subjects).getByRole("combobox", { name: "Mathematics teacher for 9-B" })).toBeDisabled();
  expect(screen.queryByText("Subjects and assessment")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Theory maximum")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /scheme/ })).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("explains when the grade does not exist", async () => {
  seed({ set_sections: [] });
  renderUI(<GradeDetailsView gradeId="sec_grade3" />);
  expect(await screen.findByText("Grade not found")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /Back to Classes/ })).toHaveAttribute("href", "/settings?section=capacity");
});

it("edits sections and capacity on the grade page and creates class records for new sections", async () => {
  seed({
    set_sections: [{ id: "sec_grade9", grade: "Grade 9", stream: "Secondary", sections: ["9-A", "9-B"], roster: 0, cap: 80 }],
    classes: [{ id: "cls_9A", grade: "9", section: "A", capacity: 40 }, { id: "cls_9B", grade: "9", section: "B", capacity: 40 }],
    students: [{ id: "s1", grade: "9", section: "B", classId: "cls_9B", status: "Active" }],
  });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade9" />);
  await user.click(await screen.findByRole("button", { name: "Edit sections and capacity" }));
  const dlg = screen.getByRole("dialog", { name: "Edit sections and capacity" });
  expect(within(dlg).getByRole("button", { name: "Section B" })).toHaveAttribute("aria-pressed", "true");
  await user.click(within(dlg).getByRole("button", { name: "Section B" }));
  await user.click(within(dlg).getByRole("button", { name: "Save" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("9-B still has 1 student");
  await user.click(within(dlg).getByRole("button", { name: "Section B" }));
  await user.click(within(dlg).getByRole("button", { name: "Section C" }));
  fireEvent.change(field("Capacity for section C", dlg), { target: { value: "25" } });
  fireEvent.change(field("Capacity for section A", dlg), { target: { value: "45" } });
  await user.click(within(dlg).getByRole("button", { name: "Save" }));
  expect(getRow("set_sections", "sec_grade9")).toMatchObject({ sections: ["9-A", "9-B", "9-C"], cap: 110 });
  expect(getRow("classes", "cls_9A")).toMatchObject({ capacity: 45 });
  expect(getRow("classes", "cls_9C")).toMatchObject({ grade: "9", section: "C", capacity: 25, classTeacherId: "" });
  expect(getRow("adm_seats", "adm_seat_9")).toMatchObject({ grade: "9", capacity: 110 });
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("shows an error before reducing a section below its enrolled count", async () => {
  seed({ set_sections: [{ id: "sec_grade9", grade: "Grade 9", stream: "Secondary", sections: ["9-A"], roster: 2, cap: 40 }],
    classes: [{ id: "cls_9A", grade: "9", section: "A", capacity: 40 }],
    students: [{ id: "s1", grade: "9", section: "A", classId: "cls_9A" }, { id: "s2", grade: "9", section: "A" }] });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade9" />);
  await user.click(await screen.findByRole("button", { name: "Edit sections and capacity" }));
  const dlg = screen.getByRole("dialog", { name: "Edit sections and capacity" });
  fireEvent.change(field("Capacity for section A", dlg), { target: { value: "1" } });
  await user.click(within(dlg).getByRole("button", { name: "Save" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("cannot be below its 2 enrolled students");
  expect(writes).toHaveLength(0);
});

it("cleans an empty section's linked records and synchronizes its existing admission row", async () => {
  seed({ set_sections: [{ id: "sec_grade3", grade: "Grade 3", stream: "Primary", sections: ["3-A", "3-B"], roster: 0, cap: 80 }],
    classes: [{ id: "cls_3A", grade: "3", section: "A", capacity: 40 }, { id: "cls_3B", grade: "3", section: "B", capacity: 40 }],
    assignments: [{ id: "a", classId: "cls_3B" }], ops_periods: [{ id: "p", classId: "cls_3B" }],
    adm_seats: [{ id: "seat_primary_3", grade: "3", group: "primary", capacity: 80, rteSeats: 4, block: "Primary", reservationRevision: 2 }] });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade3" />);
  await user.click(await screen.findByRole("button", { name: "Edit sections and capacity" }));
  const dlg = screen.getByRole("dialog", { name: "Edit sections and capacity" });
  await user.click(within(dlg).getByRole("button", { name: "Section B" }));
  await user.click(within(dlg).getByRole("button", { name: "Save" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getRow("classes", "cls_3B")).toBeUndefined();
  expect(rowsOf("assignments")).toHaveLength(0);
  expect(rowsOf("ops_periods")).toHaveLength(0);
  expect(rowsOf("adm_seats")).toHaveLength(1);
  expect(getRow("adm_seats", "seat_primary_3")).toMatchObject({ capacity: 40, rteSeats: 4, block: "Primary", reservationRevision: 2 });
});

it("removes a senior department with its classes, seats, scheme and timetable, and soft-deletes its students after a typed confirmation", async () => {
  seed({
    set_sections: [{ id: "sec_grade11_science", grade: "Grade 11", stream: "Science", streamId: "science", sections: ["11-Science-A", "11-Science-B"], roster: 0, cap: 30, subjects: ["Physics", "Chemistry"] },
      { id: "sec_grade9", grade: "Grade 9", stream: "Secondary", sections: ["9-A"], roster: 0, cap: 40 }],
    classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science", capacity: 30 }, { id: "cls_11_science_B", grade: "11", section: "B", streamId: "science", capacity: 30 }, { id: "cls_9A", grade: "9", section: "A" }],
    staff: [{ id: "t1", name: "Anita Sharma" }],
    students: [{ id: "s1", grade: "11", section: "A", classId: "cls_11_science_A", status: "Active" }, { id: "s9", grade: "9", section: "A", classId: "cls_9A", status: "Active" }],
    assignments: [{ id: "a1", classId: "cls_11_science_A", subject: "Physics", teacherId: "t1" }, { id: "a2", classId: "cls_11_science_B", subject: "physics", teacherId: "t1" }, { id: "a9", classId: "cls_9A", subject: "Maths", teacherId: "t1" }],
    ops_periods: [{ id: "p1", classId: "cls_11_science_A", day: "Mon", period: 1 }],
    adm_seats: [{ id: "seat_11_science", grade: "11-science", streamId: "science", capacity: 30 }, { id: "adm_seat_9", grade: "9", capacity: 40 }],
    set_subject_schemes: [{ id: "scheme_11_science", groupKey: "11:science", grade: "11", streamId: "science", scaleId: "default", subjects: [], coScholastic: [] }],
  });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade11_science" />);
  const table = await screen.findByRole("table", { name: "Subjects and teachers" });
  expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Subject", "11-Science-A", "11-Science-B"]);
  const physics = within(table).getByText("Physics").closest("tr")!;
  expect(within(physics).getAllByText("Anita Sharma")).toHaveLength(2);
  const chemistry = within(table).getByText("Chemistry").closest("tr")!;
  expect(within(chemistry).getAllByText("Not assigned")).toHaveLength(2);
  expect(within(table).getByRole("combobox", { name: "Physics teacher for 11-Science-A" })).toBeInTheDocument();
  expect(screen.queryByLabelText(/Add subject to/)).not.toBeInTheDocument();
  expect(screen.queryByText("Subjects and assessment")).not.toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove department" }));
  const dlg = screen.getByRole("dialog", { name: "Remove Grade 11 · Science?" });
  expect(within(dlg).getByText(/1 student, marked as removed/)).toBeInTheDocument();
  const confirm = within(dlg).getByRole("button", { name: "Remove department" });
  expect(confirm).toBeDisabled();
  await user.type(field(/Type "Grade 11 · Science" to confirm/, dlg), "Grade 11 · Science");
  await user.click(confirm);
  expect(getRow("students", "s1")).toMatchObject({ deleted: true });
  expect(getRow("students", "s9")).not.toMatchObject({ deleted: true });
  expect(rowsOf("classes").map((row) => row.id)).toEqual(["cls_9A"]);
  expect(rowsOf("assignments").map((row) => row.id)).toEqual(["a9"]);
  expect(getRow("students", "s1")).toMatchObject({ deleted: true });
  expect(rowsOf("ops_periods")).toHaveLength(0);
  expect(rowsOf("adm_seats").map((row) => row.id)).toEqual(["adm_seat_9"]);
  expect(rowsOf("set_subject_schemes")).toHaveLength(0);
  expect(rowsOf("set_sections").map((row) => row.id)).toEqual(["sec_grade9"]);
  expect(router.push).toHaveBeenCalledWith("/settings?section=capacity");
});

it("opens the department form from a department's grade page and saves its changes", async () => {
  const row = { stream: "Science", streamId: "science", roster: 0, cap: 30, subjects: ["Physics"], sectionSeats: [30] };
  seed({
    set_sections: [{ ...row, id: "sec_grade11_science", grade: "Grade 11", sections: ["11-Science-A"] }, { ...row, id: "sec_grade12_science", grade: "Grade 12", sections: ["12-Science-A"] }],
    set_config: [{ id: "subjects", subjects: [{ name: "Physics", active: true }, { name: "Chemistry", active: true }], departments: [{ id: "science", name: "Science", hodId: "" }] }],
  });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade12_science" />);
  expect(screen.queryByRole("button", { name: "Edit sections and capacity" })).not.toBeInTheDocument();
  await user.click(await screen.findByRole("button", { name: "Edit department" }));
  const dlg = screen.getByRole("dialog", { name: "Edit Science" });
  fireEvent.change(field("Total seats", dlg), { target: { value: "40" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Add subject to Grade 12", dlg), "Chemistry");
  await user.click(within(dlg).getByRole("button", { name: "Save department" }));
  expect(await screen.findByText("Department saved")).toBeInTheDocument();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getRow("set_sections", "sec_grade12_science")).toMatchObject({ cap: 40, sectionSeats: [40], subjects: ["Physics", "Chemistry"] });
  expect(getRow("set_sections", "sec_grade11_science")).toMatchObject({ cap: 40, subjects: ["Physics"] });
  expect(getRow("classes", "cls_12_science_A")).toMatchObject({ capacity: 40, subjects: ["Physics", "Chemistry"] });
  const table = screen.getByRole("table", { name: "Subjects and teachers" });
  expect(within(table).getByText("Chemistry")).toBeInTheDocument();
});

it("removes a regular grade with its classes, seats and scheme after a typed confirmation, leaving other grades alone", async () => {
  seed({
    set_sections: [{ id: "sec_grade1", grade: "Grade 1", stream: "Primary", sections: ["1-A"], roster: 0, cap: 40 }, { id: "sec_grade10", grade: "Grade 10", stream: "Secondary", sections: ["10-A"], roster: 0, cap: 40 }],
    classes: [{ id: "cls_1A", grade: "1", section: "A" }, { id: "cls_10A", grade: "10", section: "A" }],
    students: [{ id: "s1", grade: "1", section: "A", classId: "cls_1A", status: "Active" }, { id: "s10", grade: "10", section: "A", classId: "cls_10A", status: "Active" }],
    adm_seats: [{ id: "adm_seat_1", grade: "1", capacity: 40 }, { id: "adm_seat_10", grade: "10", capacity: 40 }, { id: "seat_11_science", grade: "11-science", streamId: "science", capacity: 30 }],
    set_subject_schemes: [{ id: "scheme_1", groupKey: "1:", grade: "1", streamId: "", scaleId: "default", subjects: [], coScholastic: [] }, { id: "scheme_10", groupKey: "10:", grade: "10", streamId: "", scaleId: "default", subjects: [], coScholastic: [] }],
  });
  const { user } = renderUI(<GradeDetailsView gradeId="sec_grade1" />);
  expect(await screen.findByRole("button", { name: "Edit sections and capacity" })).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Remove grade" }));
  const dlg = screen.getByRole("dialog", { name: "Remove Grade 1?" });
  expect(within(dlg).getByText("Removing this grade deletes:")).toBeInTheDocument();
  await user.type(field(/Type "Grade 1" to confirm/, dlg), "Grade 1");
  await user.click(within(dlg).getByRole("button", { name: "Remove grade" }));
  expect(getRow("students", "s1")).toMatchObject({ deleted: true, deletedReason: "Grade removed: Grade 1" });
  expect(getRow("students", "s10")).not.toMatchObject({ deleted: true });
  expect(rowsOf("classes").map((row) => row.id)).toEqual(["cls_10A"]);
  expect(rowsOf("adm_seats").map((row) => row.id).sort()).toEqual(["adm_seat_10", "seat_11_science"]);
  expect(rowsOf("set_subject_schemes").map((row) => row.id)).toEqual(["scheme_10"]);
  expect(rowsOf("set_sections").map((row) => row.id)).toEqual(["sec_grade10"]);
  expect(router.push).toHaveBeenCalledWith("/settings?section=capacity");
});
