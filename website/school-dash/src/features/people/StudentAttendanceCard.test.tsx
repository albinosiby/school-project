import { describe, expect, it, vi } from "vitest";
import { renderUI, screen, seed } from "@/test/render";
import { StudentAttendanceCard } from "./StudentAttendanceCard";
import { attendanceAcademicRange, recordedAttendance } from "./studentAttendance";

const calendar = {
  school: [{ id: "school", academicYear: "2026-27" }],
  set_terms: [{ id: "first", start: "2026-08-01", end: "2026-12-31" }, { id: "second", start: "2027-01-01", end: "2027-07-31" }],
};

describe("academic attendance", () => {
  it("uses configured calendar boundaries and rejects invalid dates", () => {
    expect(attendanceAcademicRange(calendar.set_terms)).toEqual({ start: "2026-08-01", end: "2027-07-31" });
    expect(attendanceAcademicRange([{ start: "2026-02-30", end: "2027-03-31" }, { start: "2027-04-01", end: "2026-04-01" }])).toBeUndefined();
  });

  it("counts each marked date once within the calendar and after admission", () => {
    const totals = recordedAttendance([
      { id: "month", studentId: "student", days: { "2026-07-31": "P", "2026-08-01": "P", "2026-08-02": "P", "2026-08-03": "L", "2026-08-04": "A", "2026-08-05": "E", "2027-08-01": "P" } },
      { id: "duplicate", studentId: "student", days: { "2026-08-02": "P" } },
      { id: "other", studentId: "other", days: { "2026-08-02": "A" } },
    ], [{ id: "student", admissionDate: "2026-08-02" }], attendanceAcademicRange(calendar.set_terms));
    expect(totals.get("student")).toEqual({ days: 4, attended: 2, pct: 50 });
    expect(totals.has("other")).toBe(false);
  });

  it.each([
    ["P", 100, 1, 0], ["L", 100, 1, 0], ["A", 0, 0, 1], ["E", 0, 0, 1],
  ] as const)("renders %s correctly, including genuine zero attendance", (status, pct, attended, notAttended) => {
    seed({ ...calendar, par_attendance: [{ id: "month", studentId: "student", days: { "2026-08-02": status } }] });
    renderUI(<StudentAttendanceCard student={{ id: "student" }} />);
    expect(screen.getByRole("img", { name: `Academic attendance: ${pct}%, ${attended} of 1 recorded days attended` })).toBeInTheDocument();
    expect(screen.getByText(`${pct}%`)).toBeInTheDocument();
    expect(screen.getAllByText(`${notAttended} ${notAttended === 1 ? "day" : "days"}`).length).toBeGreaterThan(0);
  });

  it("excludes future marks and shows the academic year", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-16T12:00:00"));
    try {
      seed({ ...calendar, par_attendance: [{ id: "month", studentId: "student", days: { "2026-11-16": "P", "2026-11-17": "A" } }] });
      renderUI(<StudentAttendanceCard student={{ id: "student" }} />);
      expect(screen.getByText("100%")).toBeInTheDocument();
      expect(screen.getByText("Overall academic attendance · AY 2026-27")).toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it("shows zero percent and zero day counts when there are no marks in the year", () => {
    seed({ ...calendar, par_attendance: [{ id: "old", studentId: "student", days: { "2026-07-31": "P" } }] });
    renderUI(<StudentAttendanceCard student={{ id: "student" }} />);
    expect(screen.getByText("0%")).toBeInTheDocument();
    expect(screen.getByText("0 recorded days")).toBeInTheDocument();
    expect(screen.getAllByText("0 days")).toHaveLength(2);
    expect(screen.getByRole("img", { name: "Academic attendance: 0%, 0 of 0 recorded days attended" })).toBeInTheDocument();
  });

  it("requires configured academic dates instead of mixing years", () => {
    seed({ school: calendar.school, par_attendance: [{ id: "month", studentId: "student", days: { "2026-08-02": "P" } }] });
    renderUI(<StudentAttendanceCard student={{ id: "student" }} />);
    expect(screen.getByRole("link", { name: "Configure academic year" })).toHaveAttribute("href", "/settings?section=year");
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });
});
