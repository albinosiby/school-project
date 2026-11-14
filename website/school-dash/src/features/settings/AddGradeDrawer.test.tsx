import { expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { AddGradeDrawer } from "./AddGradeDrawer";
import { StaffProfileForm } from "@/features/people/StaffProfileForm";
import { dialog, failNextWrite, field, getRow, renderUI, rowsOf, seed, within, writes } from "@/test/render";

function openGrade() {
  const onCreated = vi.fn();
  const ui = renderUI(<AddGradeDrawer open onClose={vi.fn()} onCreated={onCreated} />);
  return { ...ui, onCreated, dlg: dialog("Add grade") };
}

it("requires a positive whole total, exact section allocation and subjects in that order", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ name: "Mathematics", active: true }] }] });
  const { user, dlg, onCreated } = openGrade();
  await user.selectOptions(field("Grade", dlg), "8");
  expect(within(dlg).queryByLabelText("Sections")).not.toBeInTheDocument();
  expect(within(dlg).queryByRole("button", { name: "Create grade" })).not.toBeInTheDocument();
  fireEvent.change(field("Total seats", dlg), { target: { value: "0" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("Enter the total seats");
  fireEvent.change(field("Total seats", dlg), { target: { value: "60" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Sections", dlg), "2");
  expect(field("Section A seats", dlg)).toHaveValue(30);
  expect(field("Section B seats", dlg)).toHaveValue(30);
  await user.type(field("Section A room number", dlg), " 204 ");
  await user.type(field("Section B room number", dlg), "205");
  fireEvent.change(field("Section B seats", dlg), { target: { value: "20" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("add up to 50, not the 60 total seats");
  expect(writes).toHaveLength(0);
  fireEvent.change(field("Section A seats", dlg), { target: { value: "40" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("Add at least one subject");
  expect(writes).toHaveLength(0);
  await user.selectOptions(field("Add subject to Grade 8", dlg), "Mathematics");
  await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
  expect(getRow("set_sections", "sec_grade8")).toMatchObject({ cap: 60, sections: ["8-A", "8-B"], subjects: ["Mathematics"] });
  expect(getRow("classes", "cls_8A")).toMatchObject({ capacity: 40, room: "204", subjects: ["Mathematics"] });
  expect(getRow("classes", "cls_8B")).toMatchObject({ capacity: 20, room: "205", subjects: ["Mathematics"] });
  expect(getRow("adm_seats", "adm_seat_8")).toMatchObject({ capacity: 60 });
  expect(getRow("set_subject_schemes", "scheme_8")).toMatchObject({ subjects: [expect.objectContaining({ subject: "Mathematics" })] });
  expect(onCreated).toHaveBeenCalledWith("sec_grade8", "Grade 8");
});

it("preserves the section allocation and subjects when navigating back", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ name: "English", active: true }] }] });
  const { user, dlg } = openGrade();
  fireEvent.change(field("Total seats", dlg), { target: { value: "41" } });
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Sections", dlg), "2");
  expect(field("Section A seats", dlg)).toHaveValue(21);
  expect(field("Section B seats", dlg)).toHaveValue(20);
  fireEvent.change(field("Section A seats", dlg), { target: { value: "25" } });
  fireEvent.change(field("Section B seats", dlg), { target: { value: "16" } });
  await user.type(field("Section A room number", dlg), "101");
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Add subject to LKG", dlg), "English");
  await user.click(within(dlg).getByRole("button", { name: "Back" }));
  expect(field("Section A seats", dlg)).toHaveValue(25);
  expect(field("Section B seats", dlg)).toHaveValue(16);
  expect(field("Section A room number", dlg)).toHaveValue("101");
  await user.click(within(dlg).getByRole("button", { name: "Back" }));
  expect(field("Total seats", dlg)).toHaveValue(41);
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  expect(within(dlg).getByRole("button", { name: "Remove English from LKG" })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("adds a new shared subject from grade setup and offers it in the teacher dropdown", async () => {
  const { user, dlg, unmount } = openGrade();
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Add subject to LKG", dlg), "__new__");
  await user.type(field("New subject name", dlg), "  environmental   studies ");
  await user.click(within(dlg).getByRole("button", { name: "Add subject" }));
  expect(within(dlg).getByRole("button", { name: "Remove Environmental Studies from LKG" })).toBeInTheDocument();
  expect(getRow("set_config", "subjects")).toMatchObject({ subjects: [expect.objectContaining({ name: "Environmental Studies", active: true })] });
  await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
  expect(getRow("set_subject_schemes", "scheme_LKG")).toMatchObject({ subjects: [expect.objectContaining({ subject: "Environmental Studies" })] });
  unmount();
  const teacher = renderUI(<StaffProfileForm staff={[]} permittedRoles={["teacher"]} onClose={() => {}} />);
  const form = dialog("Add Staff");
  await teacher.user.selectOptions(field("Staff category", form), "Teaching");
  const primary = field("Subject", form);
  const choice = within(primary).getByRole("option", { name: "Environmental Studies" });
  await teacher.user.selectOptions(primary, choice);
  expect(primary).toHaveDisplayValue("Environmental Studies");
});

it("reuses a matching shared subject and preserves existing department links", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ id: "eng", name: "English", active: true, departmentIds: ["science"] }], departments: [{ id: "science", name: "Science" }] }] });
  const { user, dlg } = openGrade();
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Add subject to LKG", dlg), "__new__");
  await user.type(field("New subject name", dlg), "english");
  await user.click(within(dlg).getByRole("button", { name: "Add subject" }));
  expect(within(dlg).getByRole("button", { name: "Remove English from LKG" })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
  expect(getRow("set_config", "subjects")).toMatchObject({ subjects: [{ id: "eng", name: "English", departmentIds: ["science"] }], departments: [{ id: "science", name: "Science" }] });
});

it("keeps the subject step and user input available for retry after a failed save", async () => {
  seed({ set_config: [{ id: "subjects", subjects: [{ name: "English", active: true }] }] });
  const { user, dlg, onCreated } = openGrade();
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.click(within(dlg).getByRole("button", { name: "Next" }));
  await user.selectOptions(field("Add subject to LKG", dlg), "English");
  failNextWrite(new Error("permission-denied"));
  await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
  expect(within(dlg).getByRole("alert")).toHaveTextContent("Could not create the grade");
  expect(onCreated).not.toHaveBeenCalled();
  expect(rowsOf("set_sections")).toHaveLength(0);
  expect(rowsOf("classes")).toHaveLength(0);
  expect(rowsOf("adm_seats")).toHaveLength(0);
  expect(within(dlg).getByRole("button", { name: "Remove English from LKG" })).toBeInTheDocument();
  await user.click(within(dlg).getByRole("button", { name: "Create grade" }));
  expect(onCreated).toHaveBeenCalledWith("sec_lkg", "LKG");
});
