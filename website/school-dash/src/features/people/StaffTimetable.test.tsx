import { act } from "@testing-library/react";
import { expect, it } from "vitest";
import { renderUI, screen, seed, within, writes } from "@/test/render";
import { StaffTimetable } from "./StaffTimetable";

const teacher = { id: "teacher_one", name: "Asha Fernandes" };
const bell = { id: "bell", start: "09:00", end: "14:00", periodCount: 4, periodLength: 40,
  breaks: [{ name: "Morning break", start: "10:20", duration: 20 }, { name: "Lunch", start: "11:20", duration: 30 }] };
const lesson = { id: "lesson", classId: "cls_11_science_A", grade: "11", section: "A", day: "Mon", period: 1,
  subject: "Physics", teacherId: teacher.id, teacher: "Old teacher name", room: "Lab" };
const table = () => screen.getByRole("table", { name: "Teacher weekly timetable" });

it("shows this teacher's lessons across streams with rooms, configured bells, breaks and overlaps", () => {
  seed({ set_config: [bell], classes: [
    { id: lesson.classId, grade: "11", section: "A", streamId: "science" },
    { id: "cls_11_commerce_A", grade: "11", section: "A", streamId: "commerce", room: "204" },
  ], ops_periods: [lesson,
    { ...lesson, id: "overlap", classId: "cls_11_commerce_A", subject: "Mathematics", room: "" },
    { ...lesson, id: "other", subject: "Other teacher lesson", teacherId: "another_teacher", teacher: teacher.name },
    { ...lesson, id: "outdated", period: 8, subject: "Outdated lesson" },
  ] });
  renderUI(<StaffTimetable member={teacher} staff={[teacher]} />);
  const grid = within(table());
  expect(grid.getAllByRole("rowheader").map((row) => row.textContent)).toEqual([
    "Period 109:00–09:40", "Period 209:40–10:20", "Morning break", "Period 310:40–11:20", "Lunch", "Period 411:50–12:30",
  ]);
  expect(grid.getByRole("link", { name: "Grade 11 · Science · Section A" })).toHaveAttribute("href", "/classes/cls_11_science_A");
  expect(grid.getByRole("link", { name: "Grade 11 · Commerce · Section A" })).toHaveAttribute("href", "/classes/cls_11_commerce_A");
  expect(grid.getByText("Room Lab")).toBeInTheDocument();
  expect(grid.getByText("Room 204")).toBeInTheDocument();
  expect(grid.getByText("Overlap")).toBeInTheDocument();
  expect(screen.getByText(/1 overlapping slot/)).toBeInTheDocument();
  expect(grid.getAllByText("Free")).toHaveLength(23);
  expect(table()).not.toHaveTextContent("Other teacher lesson");
  expect(table()).not.toHaveTextContent("Outdated lesson");
  expect(screen.getByText(/1 saved lesson is outside/)).toBeInTheDocument();
  const lunch = grid.getByRole("rowheader", { name: "Lunch" }).closest("tr")!;
  expect(lunch).toHaveTextContent("11:20–11:50");
  expect(within(lunch).getByRole("cell")).toHaveAttribute("colspan", "6");
  expect(writes).toHaveLength(0);
});

it("includes name-only legacy lessons only when that name uniquely identifies the teacher", () => {
  seed({ set_config: [bell], ops_periods: [
    { ...lesson, teacherId: "", teacher: teacher.name, subject: "Legacy English" },
    { ...lesson, id: "explicit_other", teacherId: "another_teacher", teacher: teacher.name, subject: "Another teacher's subject" },
    { ...lesson, id: "unassigned", teacherId: "", teacher: "", subject: "Unassigned subject" },
  ] });
  const { rerender } = renderUI(<StaffTimetable member={teacher} staff={[teacher]} />);
  expect(table()).toHaveTextContent("Legacy English");
  expect(table()).not.toHaveTextContent("Another teacher's subject");
  expect(table()).not.toHaveTextContent("Unassigned subject");
  rerender(<StaffTimetable member={teacher} staff={[teacher, { id: "duplicate_name", name: teacher.name }]} />);
  expect(table()).not.toHaveTextContent("Legacy English");
  expect(screen.getByText("No weekly lessons assigned yet.")).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("keeps ID-linked lessons when names are duplicated and changes the timetable when another profile opens", () => {
  const duplicate = { id: "other_teacher", name: teacher.name };
  seed({ set_config: [bell], ops_periods: [lesson,
    { ...lesson, id: "other", teacherId: duplicate.id, subject: "Art" },
  ] });
  const { rerender } = renderUI(<StaffTimetable member={teacher} staff={[teacher, duplicate]} />);
  expect(table()).toHaveTextContent("Physics");
  expect(table()).not.toHaveTextContent("Art");
  rerender(<StaffTimetable member={duplicate} staff={[teacher, duplicate]} />);
  expect(table()).toHaveTextContent("Art");
  expect(table()).not.toHaveTextContent("Physics");
  expect(writes).toHaveLength(0);
});

it("reacts to lesson unassignment and bell changes without retaining old periods or inventing breaks", () => {
  seed({ set_config: [bell], ops_periods: [lesson] });
  renderUI(<StaffTimetable member={teacher} staff={[teacher]} />);
  expect(table()).toHaveTextContent("Physics");
  act(() => seed({ ops_periods: [{ ...lesson, teacherId: "", teacher: "" }], set_config: [{ ...bell, periodCount: 2, breaks: [] }] }));
  expect(table()).not.toHaveTextContent("Physics");
  expect(within(table()).getAllByRole("rowheader")).toHaveLength(2);
  expect(within(table()).queryByRole("rowheader", { name: "Lunch" })).not.toBeInTheDocument();
  expect(screen.getByText("No weekly lessons assigned yet.")).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("explains invalid bell settings instead of showing misleading free periods", () => {
  seed({ set_config: [{ ...bell, periodCount: 0 }], ops_periods: [lesson] });
  renderUI(<StaffTimetable member={teacher} staff={[teacher]} />);
  expect(screen.getByRole("alert")).toHaveTextContent("School bell timings are unavailable");
  expect(screen.getByRole("link", { name: "Configure school hours & breaks" })).toHaveAttribute("href", "/settings?section=timetable#school-timings");
  expect(screen.queryByRole("table")).not.toBeInTheDocument();
  expect(screen.queryByText("Free")).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});
