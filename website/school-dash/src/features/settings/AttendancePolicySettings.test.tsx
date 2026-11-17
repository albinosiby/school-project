import { expect, it } from "vitest";
import { AttendancePolicySettings } from "./AttendancePolicySettings";
import { SettingsPage } from "./SettingsPage";
import { attendanceThresholdInput, minimumAttendance } from "@/lib/attendancePolicy";
import { field, getRow, renderUI, screen, seed, setUrl, writesTo } from "@/test/render";

it("places the threshold editor under Academic Year", () => {
  setUrl("/settings?section=year");
  renderUI(<SettingsPage />);
  expect(field("Minimum attendance (%)")).toHaveValue(75);
  expect(screen.getByRole("tabpanel", { name: "Academic Year" })).toContainElement(field("Minimum attendance (%)"));
});

it("saves and restores the school threshold while preserving other policy fields", async () => {
  seed({ set_config: [{ id: "attendance_policy", minimumPercent: 75, note: "Keep" }] });
  const { user, unmount } = renderUI(<AttendancePolicySettings />);
  await user.clear(field("Minimum attendance (%)"));
  await user.type(field("Minimum attendance (%)"), "82.5");
  await user.click(screen.getByRole("button", { name: "Save attendance settings" }));
  expect(getRow("set_config", "attendance_policy")).toMatchObject({ minimumPercent: 82.5, note: "Keep" });
  expect(writesTo("students")).toHaveLength(0);
  unmount(); renderUI(<AttendancePolicySettings />);
  expect(field("Minimum attendance (%)")).toHaveValue(82.5);
});

it.each(["", "-1", "100.1", "NaN", "Infinity"])("rejects invalid threshold %s", (input) => {
  expect(attendanceThresholdInput(input)).toBeUndefined();
});

it("accepts zero, a decimal and 100 while safely reading missing or invalid saved data", () => {
  for (const value of [0, 50.5, 100]) {
    expect(attendanceThresholdInput(String(value))).toBe(value);
    expect(minimumAttendance(value)).toBe(value);
  }
  expect(minimumAttendance(undefined)).toBe(75);
  expect(minimumAttendance(101)).toBe(75);
});

it("blocks invalid saves and detects a concurrent edit before overwriting it", async () => {
  const { user } = renderUI(<AttendancePolicySettings />);
  await user.clear(field("Minimum attendance (%)"));
  await user.type(field("Minimum attendance (%)"), "101");
  await user.click(screen.getByRole("button", { name: "Save attendance settings" }));
  expect(screen.getByText("Enter a percentage from 0 to 100.")).toBeInTheDocument();
  expect(writesTo("set_config")).toHaveLength(0);
  await user.clear(field("Minimum attendance (%)"));
  await user.type(field("Minimum attendance (%)"), "80");
  seed({ set_config: [{ id: "attendance_policy", minimumPercent: 90 }] });
  await user.click(screen.getByRole("button", { name: "Save attendance settings" }));
  expect(screen.getByText(/changed in another window/)).toBeInTheDocument();
  expect(getRow("set_config", "attendance_policy")).toMatchObject({ minimumPercent: 90 });
  await user.click(screen.getByRole("button", { name: "Reload saved value" }));
  expect(field("Minimum attendance (%)")).toHaveValue(90);
});
