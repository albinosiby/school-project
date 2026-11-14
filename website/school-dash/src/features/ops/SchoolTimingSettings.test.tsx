import { act, fireEvent } from "@testing-library/react";
import { expect, it } from "vitest";
import { dialog, failNextWrite, field, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { TimetableView } from "./TimetableView";
import { classDay } from "./classDetails";

const bell = { id: "bell", gates: "08:00", start: "09:00", end: "14:00", periodCount: 4, periodLength: 40,
  breaks: [{ name: "Morning break", start: "10:20", duration: 20 }, { name: "Lunch", start: "11:20", duration: 30 }] };
const lesson = { id: "saved_four", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 4, subject: "Physics", teacherId: "t", teacher: "Teacher", room: "Lab" };

it("saves structured school timings, updates the grid count and retains lessons outside a reduced schedule", async () => {
  seed({ set_config: [bell], ops_periods: [lesson] });
  const { user } = renderUI(<TimetableView embedded />);
  await user.click(screen.getByRole("button", { name: "Edit school timings" }));
  expect(field("First period starts")).toHaveValue("09:00");
  expect(field("Periods per day")).toHaveValue(4);
  expect(screen.getByText("Total school hours").nextSibling).toHaveTextContent("5h 0m");
  fireEvent.change(field("Periods per day"), { target: { value: "3" } });
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(getRow("set_config", "bell")).toMatchObject({ periodCount: 3, periodLength: 40, periods: "3 Periods × 40 min", breaks: bell.breaks });
  expect(screen.getAllByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat) period \d+ / })).toHaveLength(18);
  expect(screen.queryByRole("button", { name: "Mon period 4 Physics" })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Review saved Mon period 4" })).toBeInTheDocument();
  expect(getRow("ops_periods", lesson.id)).toEqual(lesson);
  const day = classDay("cls_10B", "2026-11-16", getRow("set_config", "bell") as typeof bell, undefined, [lesson], [], [], []);
  expect(day.rows.map((row) => row.period)).toEqual([1, 2, 3]);
  expect(day.outsideRows).toMatchObject([{ period: 4, lesson: { subject: "Physics" } }]);
});

it("rejects overlapping breaks and preserves the original bells on failed saves, then allows retry", async () => {
  seed({ set_config: [bell] });
  const { user } = renderUI(<TimetableView embedded />);
  await user.click(screen.getByRole("button", { name: "Edit school timings" }));
  const lunch = screen.getByRole("group", { name: "Break 2" });
  fireEvent.change(field("Start time", lunch), { target: { value: "10:30" } });
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("overlaps");
  expect(writes).toHaveLength(0);
  fireEvent.change(field("Start time", lunch), { target: { value: "11:30" } });
  failNextWrite(new Error("permission-denied"));
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("permission-denied");
  expect(getRow("set_config", "bell")).toEqual(bell);
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(getRow("set_config", "bell")).toMatchObject({ breaks: [bell.breaks[0], { name: "Lunch", start: "11:30", duration: 30 }] });
});

it.each([
  { change: "period count", saved: { ...bell, periodCount: 5 } },
  { change: "break duration", saved: { ...bell, breaks: [{ ...bell.breaks[0], duration: 25 }, bell.breaks[1]] } },
])("rejects a stale timing draft when another administrator changes $change", async ({ saved }) => {
  seed({ set_config: [bell] });
  const { user } = renderUI(<TimetableView embedded />);
  await user.click(screen.getByRole("button", { name: "Edit school timings" }));
  act(() => seed({ set_config: [saved] }));
  fireEvent.change(field("School closes"), { target: { value: "15:00" } });
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(screen.getByRole("alert")).toHaveTextContent("changed in another window");
  expect(getRow("set_config", "bell")).toEqual(saved);
  expect(writes).toHaveLength(0);
});

it("saves when a database read returns the same break values with a different map key order", async () => {
  seed({ set_config: [bell] });
  const { user } = renderUI(<TimetableView embedded />);
  await user.click(screen.getByRole("button", { name: "Edit school timings" }));
  act(() => seed({ set_config: [{ ...bell, breaks: bell.breaks.map(({ name, start, duration }) => ({ duration, start, name })) }] }));
  fireEvent.change(field("School closes"), { target: { value: "15:00" } });
  await user.click(screen.getByRole("button", { name: "Save school timings" }));
  expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  expect(getRow("set_config", "bell")).toMatchObject({ end: "15:00", breaks: bell.breaks });
});

it("supports configured periods above eight when assigning lessons", async () => {
  seed({ set_config: [{ ...bell, periodCount: 12, periodLength: 20, end: "18:00", breaks: [] }],
    staff: [{ id: "t", name: "Teacher", department: "Academics" }] });
  const { user } = renderUI(<TimetableView embedded />);
  await user.click(screen.getByRole("button", { name: "Mon period 12 empty" }));
  const form = dialog("Add period");
  await user.selectOptions(field("Subject", form), "English");
  await user.selectOptions(field("Teacher", form), "t");
  await user.click(within(form).getByRole("button", { name: "Save" }));
  expect(getRow("ops_periods", "per_10B_Mon_12")).toMatchObject({ period: 12, subject: "English", teacherId: "t" });
});
