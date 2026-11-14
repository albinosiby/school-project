import { expect, it, vi } from "vitest";
import { renderUI, screen, seed, within, writes } from "@/test/render";
import { DailyPeriods, WeeklyTimetable, type ClassScheduleData } from "./ClassTimetable";
import { TimetableView } from "./TimetableView";

const bell = { id: "bell", start: "09:00", end: "14:00", periodCount: 4, periodLength: 40,
  breaks: [{ name: "Lunch break", start: "11:20", duration: 30 }, { name: "Morning break", start: "10:20", duration: 20 }] };
const data: ClassScheduleData = {
  classId: "cls_10B", bell, regional: { id: "regional", workingWeek: "Mon – Sat" },
  clock: { date: "2026-11-11", day: "Wed", time: "11:25", label: "Lunch break", state: "break" },
  periods: [{ id: "p", classId: "cls_10B", grade: "10", section: "B", day: "Wed", period: 1, subject: "Physics", teacherId: "t", teacher: "Teacher", room: "Lab" }],
  staff: [{ id: "t", name: "Teacher" }], substitutions: [], attendance: [],
};
const rowNames = (table: HTMLElement) => within(table).getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("rowheader")[0].textContent);

it("inserts configured morning and lunch breaks between daily periods and marks the current break", () => {
  renderUI(<DailyPeriods data={data} date={data.clock.date} onAssign={vi.fn()} />);
  const table = screen.getByRole("table", { name: "Daily periods" });
  expect(rowNames(table)).toEqual(["Period 1", "Period 2", "Morning break", "Period 3", "Lunch break Now", "Period 4"]);
  const morning = within(table).getByRole("rowheader", { name: "Morning break" }).closest("tr")!;
  const lunch = within(table).getByRole("rowheader", { name: "Lunch break Now" }).closest("tr")!;
  expect(morning).toHaveTextContent("10:20–10:40");
  expect(lunch).toHaveTextContent("11:20–11:50");
  expect(within(lunch).queryByRole("button")).not.toBeInTheDocument();
  expect(within(lunch).queryByRole("link")).not.toBeInTheDocument();
  expect(within(lunch).getByRole("cell")).toHaveAttribute("colspan", "5");
  expect(writes).toHaveLength(0);
});

it("shows break rows across the weekly timetable without changing period numbering", () => {
  renderUI(<WeeklyTimetable data={data} selectedDay="Wed" />);
  const table = screen.getByRole("table", { name: "Weekly timetable" });
  expect(rowNames(table)).toEqual(["Period 109:00–09:40", "Period 209:40–10:20", "Morning break", "Period 310:40–11:20", "Lunch break", "Period 411:50–12:30"]);
  const lunch = within(table).getByRole("rowheader", { name: "Lunch break" }).closest("tr")!;
  expect(within(lunch).getByRole("cell")).toHaveAttribute("colspan", "6");
  expect(lunch).toHaveTextContent("11:20–11:50");
  expect(table).toHaveTextContent("Physics");
});

it("explains a non-working day while keeping configured times on saved lessons", () => {
  renderUI(<DailyPeriods data={{ ...data, regional: { id: "regional", workingWeek: "Mon – Sat (2nd & 4th Saturday Off)" },
    periods: data.periods.map((period) => ({ ...period, day: "Sat" })) }} date="2026-11-14" />);
  expect(screen.getByRole("note")).toHaveTextContent("Non-working day");
  const table = screen.getByRole("table", { name: "Daily periods" });
  expect(table).toHaveTextContent("09:00–09:40");
  expect(table).not.toHaveTextContent("Not configured");
  expect(within(table).getByRole("rowheader", { name: "Lunch break" })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("does not invent breaks for a school with no configured breaks or on a nonworking day", () => {
  const { unmount } = renderUI(<DailyPeriods data={{ ...data, bell: { ...bell, breaks: [] } }} date={data.clock.date} />);
  expect(screen.queryByText("Lunch break")).not.toBeInTheDocument();
  expect(screen.queryByText("Morning break")).not.toBeInTheDocument();
  unmount();
  renderUI(<DailyPeriods data={data} date="2026-11-15" />);
  expect(screen.queryByText("Lunch break")).not.toBeInTheDocument();
  expect(screen.queryByText("Morning break")).not.toBeInTheDocument();
});

it("shows configured breaks as non-editable rows in the timetable editor using matching period timings", () => {
  seed({ set_config: [bell] });
  renderUI(<TimetableView embedded />);
  const lunch = screen.getByRole("rowheader", { name: "Lunch break" }).closest("tr")!;
  expect(lunch).toHaveTextContent("11:20–11:50");
  expect(within(lunch).queryByRole("button")).not.toBeInTheDocument();
  expect(screen.getByText("11:50–12:30")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Mon period 4 empty" })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("uses the same configured count in daily and weekly grids and keeps older saved lessons separate", () => {
  const extra = { ...data.periods[0], id: "old_eighth", period: 8, subject: "Old eighth lesson" };
  const schedule = { ...data, periods: [...data.periods, extra] };
  renderUI(<><DailyPeriods data={schedule} date={data.clock.date} /><WeeklyTimetable data={schedule} /></>);
  for (const name of ["Daily periods", "Weekly timetable"]) {
    const table = screen.getByRole("table", { name });
    expect(within(table).getAllByRole("rowheader").filter((header) => header.textContent?.startsWith("Period "))).toHaveLength(4);
    expect(table).not.toHaveTextContent("Old eighth lesson");
  }
  expect(screen.getByRole("region", { name: "Saved periods outside the bell schedule" })).toHaveTextContent("Old eighth lesson");
  expect(writes).toHaveLength(0);
});
