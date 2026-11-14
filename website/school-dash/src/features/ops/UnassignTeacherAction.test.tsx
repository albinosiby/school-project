import { act } from "@testing-library/react";
import { expect, it } from "vitest";
import { dialog, failNextWrite, getRow, renderUI, router, rowsOf, screen, seed, within, writes } from "@/test/render";
import { ClassDetailsView } from "./ClassDetailsView";
import { classTeachers } from "./classDetails";
import { unassignClassTeaching } from "./unassignClassTeaching";

const cls = { id: "cls_11_science_A", grade: "11", streamId: "science", section: "A", classTeacherId: "teacher", classTeacher: "Teacher One" };
const teacher = { id: "teacher", name: "Teacher One", category: "Teaching" };
const assignment = { id: "a", classId: cls.id, subject: "Physics", teacherId: teacher.id };
const period = { id: "p", classId: cls.id, grade: "11", section: "A", day: "Mon", period: 1, subject: "Physics", teacherId: teacher.id, teacher: teacher.name, room: "Lab" };

async function setup() {
  seed({ classes: [cls], staff: [teacher, { id: "other", name: "Other Teacher" }], assignments: [assignment], ops_periods: [period] });
  const result = renderUI(<ClassDetailsView classId={cls.id} />);
  await result.user.click(screen.getByRole("tab", { name: /^Teachers/ }));
  return result;
}

it("reviews and cancels unassignment without opening the staff profile or changing data", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  const form = dialog("Unassign Teacher One");
  expect(form).toHaveTextContent("1 subject assignment");
  expect(form).toHaveTextContent("1 weekly timetable slot");
  expect(within(form).getByRole("button", { name: "Unassign class teacher" })).toBeInTheDocument();
  await user.click(within(form).getByRole("button", { name: "Cancel" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(router.push).not.toHaveBeenCalled();
  expect(writes).toHaveLength(0);
});

it("removes subject and timetable teaching together while preserving the class teacher, slots, history and other classes", async () => {
  seed({ assignments: [{ ...assignment, id: "other_class", classId: "cls_11_science_B" }, { ...assignment, id: "other_teacher", teacherId: "other", subject: "English" }],
    ops_periods: [{ ...period, id: "other_period", classId: "cls_11_science_B" }],
    ops_attendance: [{ id: "roll", classId: cls.id, period: 1, teacherId: teacher.id, marks: { student: "P" } }] });
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(getRow("assignments", "a")).toBeUndefined();
  expect(getRow("ops_periods", "p")).toMatchObject({ teacherId: "", teacher: "", subject: "Physics", day: "Mon", period: 1, room: "Lab" });
  expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: teacher.id });
  expect(getRow("assignments", "other_class")).toMatchObject({ teacherId: teacher.id });
  expect(getRow("assignments", "other_teacher")).toMatchObject({ teacherId: "other" });
  expect(getRow("ops_periods", "other_period")).toMatchObject({ teacherId: teacher.id });
  expect(getRow("ops_attendance", "roll")).toMatchObject({ teacherId: teacher.id, marks: { student: "P" } });
  const panel = screen.getByRole("tabpanel", { name: "Teachers" });
  expect(within(panel).getByRole("link", { name: teacher.name }).closest("tr")).toHaveTextContent("No subject assigned in this class");
  expect(within(panel).queryByText("Not assigned")).not.toBeInTheDocument();
  expect(router.push).not.toHaveBeenCalled();
});

it("unassigns the class teacher role separately and removes the row after teaching duties are also removed", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign class teacher" }));
  expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "", classTeacher: "" });
  expect(getRow("assignments", "a")).toEqual(assignment);
  expect(getRow("ops_periods", "p")).toEqual(period);
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  expect(within(dialog("Unassign Teacher One")).queryByRole("button", { name: "Unassign class teacher" })).not.toBeInTheDocument();
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(screen.getByRole("tab", { name: /^Teachers\(0\)/ })).toBeInTheDocument();
});

it("keeps teaching assignments intact on failure and supports retry", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  failNextWrite(new Error("Could not save changes"));
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(within(dialog("Unassign Teacher One")).getByRole("alert")).toHaveTextContent("Could not save changes");
  expect(getRow("assignments", "a")).toEqual(assignment);
  expect(getRow("ops_periods", "p")).toEqual(period);
  expect(writes).toHaveLength(0);
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("refuses stale removals when another administrator reassigns a reviewed lesson", async () => {
  const { user } = await setup();
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  act(() => seed({ ops_periods: [{ ...period, teacherId: "other", teacher: "Other Teacher" }] }));
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(within(dialog("Unassign Teacher One")).getByRole("alert")).toHaveTextContent("These assignments changed");
  expect(getRow("assignments", "a")).toEqual(assignment);
  expect(getRow("ops_periods", "p")).toMatchObject({ teacherId: "other" });
  expect(writes).toHaveLength(0);
});

it("supports a unique legacy teacher name and timetable rows without a classId", async () => {
  const legacy = { ...period, id: "legacy", classId: "", grade: "8", section: "A", teacherId: "" };
  seed({ classes: [{ id: "cls_8A", grade: "8", section: "A" }], staff: [teacher], ops_periods: [legacy] });
  const { user } = renderUI(<ClassDetailsView classId="cls_8A" />);
  await user.click(screen.getByRole("tab", { name: /^Teachers/ }));
  await user.click(screen.getByRole("button", { name: "Unassign Teacher One" }));
  await user.click(within(dialog("Unassign Teacher One")).getByRole("button", { name: "Unassign teaching" }));
  expect(getRow("ops_periods", "legacy")).toMatchObject({ teacher: "", teacherId: "", subject: "Physics" });
  expect(screen.getByRole("tab", { name: /^Teachers\(0\)/ })).toBeInTheDocument();
});

it("does not attribute ambiguous name-only timetable rows to one of two same-name staff members", () => {
  const result = classTeachers(cls, [assignment], [{ ...period, teacherId: "" }], [teacher, { ...teacher, id: "duplicate" }]);
  expect(result.find((row) => row.id === teacher.id)?.subjects).toEqual(["Physics"]);
  expect(result.find((row) => row.id === `legacy:${teacher.name}`)?.staff).toBeUndefined();
  expect(result).toHaveLength(2);
});

it("rejects mixed-class removals and missing classes without writing", async () => {
  seed({ classes: [cls], assignments: [assignment], ops_periods: [period] });
  await expect(unassignClassTeaching("cls_11_science_B", [assignment], [period])).rejects.toThrow("Only assignments for this class");
  await expect(unassignClassTeaching("missing", [{ ...assignment, classId: "missing" }], [])).rejects.toThrow("class was removed");
  expect(writes).toHaveLength(0);
  expect(rowsOf("assignments")).toHaveLength(1);
});
