import { describe, expect, it } from "vitest";
import {
  allocationError, ayLabel, ayStart, bellError, buildSchedule, initialBell, canOpenStep, classIdOfLabel, classesFor, currentTermName, firstOpenStep,
  markCompleted, profileErrors, progressPct, sectionRowsFor, sectionsError,
  termDays, termErrors, termStatus, type Bell,
} from "./logic";

describe("step progress", () => {
  it("firstOpenStep is the first unfinished step, 6 when all are done", () => {
    expect(firstOpenStep([])).toBe(1);
    expect(firstOpenStep([1, 2, 4])).toBe(3);
    expect(firstOpenStep([1, 2, 3, 4, 5, 6])).toBe(6);
    expect(firstOpenStep([1, 2, 3, 4, 5, 6, 7, 8])).toBe(6);
  });
  it("markCompleted is unique, sorted and ignores out-of-range numbers", () => {
    expect(markCompleted([3, 1], 2)).toEqual([1, 2, 3]);
    expect(markCompleted([1, 2], 2)).toEqual([1, 2]);
    expect(markCompleted([1, 9, 0], 2)).toEqual([1, 2]);
  });
  it("progress and step access", () => {
    expect(progressPct([])).toBe(0);
    expect(progressPct([1, 2, 2, 7, 9])).toBe(33);
    expect(progressPct([1, 2, 3, 4, 5, 6, 8])).toBe(100);
    expect(canOpenStep(3, [1, 2])).toBe(true);
    expect(canOpenStep(4, [1, 2])).toBe(false);
    expect(canOpenStep(7, [1, 2, 3, 4, 5, 6])).toBe(false);
    expect(canOpenStep(8, [1, 2, 3, 4, 5, 6])).toBe(false);
    expect(canOpenStep(0, [])).toBe(false);
    expect(canOpenStep(1.5, [1])).toBe(false);
  });
  it("academic year runs April to March", () => {
    expect(ayStart(new Date("2026-11-03"))).toBe(2026);
    expect(ayStart(new Date("2027-02-10"))).toBe(2026);
    expect(ayStart(new Date("2027-04-01T10:00:00"))).toBe(2027);
    expect(ayLabel(2026)).toBe("2026-27");
    expect(ayLabel(2099)).toBe("2099-00");
  });
});

describe("1 · profile", () => {
  const ok = { name: "Sunrise Academy", short: "", board: "CBSE", affiliation: "#1930281", addressLine1: "12 School Road", addressLine2: "", country: "IN", state: "IN.16", district: "IN.16.521", city: "Pune", pin: "411001", phone: "+91 20 2345 6789", email: "office@sunrise.in" };
  it("accepts a valid profile", () => { expect(profileErrors(ok)).toEqual({}); });
  it("reports each bad field", () => {
    expect(profileErrors({ ...ok, name: " ", affiliation: "12-34", city: "", phone: "98100", email: "office@" })).toEqual({
      name: "School name is required.", affiliation: "Enter the 5–7 digit affiliation number.", city: "City is required.",
      phone: "Enter a phone number with at least 10 digits.", email: "Enter a valid email address.",
    });
    expect(profileErrors({ ...ok, affiliation: "12345678" }).affiliation).toBe("Enter the 5–7 digit affiliation number.");
    expect(profileErrors({ ...ok, phone: "98100abc0000" }).phone).toBe("Enter a phone number with at least 10 digits.");
  });
});

describe("2 · terms", () => {
  const t1 = { name: "Term 1", start: "2026-04-01", end: "2026-09-30" }, t2 = { name: "Term 2", start: "2026-10-01", end: "2027-03-31" };
  it("accepts ordered, non-overlapping terms", () => { expect(termErrors([t1, t2], 220)).toEqual([]); });
  it("flags missing data, bad ranges, overlaps, duplicate names and working days", () => {
    expect(termErrors([], 220)).toEqual(["Add at least one term."]);
    expect(termErrors([{ name: "", start: "", end: "" }], 220)).toEqual(["Term 1: fill in the name and both dates."]);
    expect(termErrors([{ ...t1, end: "2026-04-01" }], 220)).toEqual(["Term 1: end date must be after the start date."]);
    expect(termErrors([t1, { ...t2, start: "2026-09-30" }], 220)).toEqual(["Term 2 overlaps Term 1."]);
    expect(termErrors([t1, { ...t2, name: "term 1" }], 220)).toEqual(["Term names must be different."]);
    expect(termErrors([t1], 99)).toEqual(["Working days should be between 100 and 300."]);
    expect(termErrors([t1], 301)).toEqual(["Working days should be between 100 and 300."]);
  });
  it("term status, current term and days", () => {
    expect([t1, t2].map((t) => termStatus(t, "2026-11-03"))).toEqual(["Closed", "In Progress"]);
    expect(termStatus(t2, "2026-05-01")).toBe("Scheduled");
    expect(currentTermName([t2, t1], "2026-11-03")).toBe("Term 2");
    expect(currentTermName([t1, t2], "2026-01-15")).toBe("Term 1");
    expect(currentTermName([t1, t2], "2027-06-01")).toBe("Term 2");
    expect(currentTermName([], "2027-06-01")).toBe("");
    expect(termDays(t1, 220)).toBe(110);
  });
});

describe("3 · classes", () => {
  const cfg = [{ grade: "LKG", sections: 1, cap: 25 }, { grade: "5", sections: 2, cap: 30 }, { grade: "9", sections: 0, cap: 30 }];
  it("validates at least one grade and the seat range", () => {
    expect(sectionsError(cfg)).toBe("");
    expect(sectionsError(cfg.map((c) => ({ ...c, sections: 0 })))).toBe("Enable at least one grade by giving it one or more sections.");
    expect(sectionsError([{ grade: "5", sections: 1, cap: 9 }])).toBe("Seat capacity per section should be between 10 and 60.");
    expect(sectionsError([{ grade: "5", sections: 1, cap: 61 }])).toBe("Seat capacity per section should be between 10 and 60.");
    expect(sectionsError([{ grade: "9", sections: 0, cap: 0 }, { grade: "5", sections: 1, cap: 30 }])).toBe("");
  });
  it("creates contract class docs cls_{grade}{SECTION} with string grade and section", () => {
    expect(classesFor(cfg)).toEqual([
      { id: "cls_LKGA", grade: "LKG", section: "A" }, { id: "cls_5A", grade: "5", section: "A" }, { id: "cls_5B", grade: "5", section: "B" },
    ]);
  });
  it("keeps the Settings sections rows and maps their labels back to class ids", () => {
    expect(sectionRowsFor(cfg)).toEqual([
      { grade: "LKG", stream: "Pre-Primary", sections: ["LKG-A"], roster: 0, cap: 25 },
      { grade: "Grade 5", stream: "Primary", sections: ["5-A", "5-B"], roster: 0, cap: 60 },
    ]);
    expect(classIdOfLabel("5-B")).toBe("cls_5B");
    expect(classIdOfLabel("11-Sci-A")).toBe("cls_11_science_A");
    expect(classIdOfLabel("LKG-A")).toBe("cls_LKGA");
  });
});

describe("4 · bell schedule", () => {
  const v: Bell = initialBell();
  const custom: Bell = { ...v, end: "16:00", breaks: [
    { name: "Afternoon break", start: "15:00", duration: 10 },
    { name: "Morning break", start: "11:00", duration: 10 },
    { name: "Lunch", start: "12:00", duration: 60 },
  ] };

  it("preserves the timing of existing period-relative schedules", () => {
    const legacy = { gates: "07:45", start: "08:30", end: "14:45", periods: 8, len: 40, snackAfter: 3, snackMin: 15, lunchAfter: 5, lunchMin: 30 };
    expect(initialBell(legacy).breaks).toEqual([
      { name: "Morning break", start: "10:30", duration: 15 }, { name: "Lunch", start: "12:05", duration: 30 },
    ]);
    const s = buildSchedule(initialBell(legacy));
    expect(s.rows).toHaveLength(10);
    expect(s.rows[3]).toEqual({ label: "Morning break", from: "10:30", to: "10:45", break: true });
    expect(s.endsAt).toBe(14 * 60 + 35);
    expect(initialBell({ ...legacy, snackMin: 0, lunchMin: 0 }).breaks).toEqual([]);
    expect(initialBell({ ...legacy, breaks: [] }).breaks).toEqual([]);
  });

  it("keeps all three breaks at exact times and moves full lessons past them", () => {
    const schedule = buildSchedule(custom);
    expect(bellError(custom)).toBe("");
    expect(schedule.rows.filter((row) => row.break)).toEqual([
      { label: "Morning break", from: "11:00", to: "11:10", break: true },
      { label: "Lunch", from: "12:00", to: "13:00", break: true },
      { label: "Afternoon break", from: "15:00", to: "15:10", break: true },
    ]);
    expect(schedule.rows.filter((row) => row.gap)).toEqual([
      { label: "Unallocated time", from: "10:30", to: "11:00", gap: true },
      { label: "Unallocated time", from: "11:50", to: "12:00", gap: true },
    ]);
    expect(schedule.rows.at(-1)).toEqual({ label: "Period 8", from: "15:10", to: "15:50" });
    expect(schedule.endsAt).toBe(15 * 60 + 50);
    expect(custom.breaks[0]?.name).toBe("Afternoon break"); // sorting never changes the editor's row order
  });

  it("handles no breaks, adjacent breaks, and breaks after the final lesson", () => {
    expect(buildSchedule({ ...v, breaks: [] }).endsAt).toBe(13 * 60 + 50);
    const day = { ...v, periods: 1, breaks: [
      { name: "Assembly break", start: "08:30", duration: 10 },
      { name: "Morning break", start: "08:40", duration: 10 },
      { name: "Lunch", start: "12:00", duration: 60 },
    ] };
    expect(bellError(day)).toBe("");
    expect(buildSchedule(day).rows[2]).toEqual({ label: "Period 1", from: "08:50", to: "09:30" });
    expect(buildSchedule(day).endsAt).toBe(13 * 60);
  });

  it("validates school times, period limits and closing time", () => {
    expect(bellError(v)).toBe("");
    expect(bellError({ ...v, start: "07:45" })).toBe("Classes must start after the gates open.");
    expect(bellError({ ...v, gates: "" })).toBe("Enter all times as HH:mm.");
    expect(bellError({ ...v, end: "08:00" })).toBe("School must close after the first period starts.");
    expect(bellError({ ...v, periods: 13 })).toBe("Use between 1 and 12 periods.");
    expect(bellError({ ...v, len: 15 })).toBe("Period length should be between 20 and 90 minutes.");
    expect(bellError({ ...v, end: "14:00" })).toBe("The schedule runs until 14:35, past the closing time of 14:00. Shorten the periods or move closing time.");
  });

  it("refuses unnamed, incomplete, overlapping and out-of-day breaks", () => {
    const withBreak = (patch: Partial<Bell["breaks"][number]>) => ({ ...v, breaks: [{ name: "Lunch", start: "12:00", duration: 60, ...patch }] });
    expect(bellError(withBreak({ name: " " }))).toBe("Break 1: enter a name of up to 80 characters.");
    expect(bellError(withBreak({ start: "" }))).toBe("Lunch: enter a valid start time.");
    expect(bellError(withBreak({ start: "24:00" }))).toBe("Lunch: enter a valid start time.");
    for (const duration of [0, -10, 181, 1.5, NaN]) expect(bellError(withBreak({ duration }))).toBe("Lunch: duration must be between 1 and 180 minutes.");
    expect(bellError(withBreak({ start: "08:00" }))).toBe("Lunch: the entire break must be within the school day.");
    expect(bellError(withBreak({ start: "14:00" }))).toBe("Lunch: the entire break must be within the school day.");
    expect(bellError({ ...custom, breaks: [...custom.breaks, { name: "Another break", start: "11:05", duration: 10 }] })).toBe("Another break overlaps Morning break.");
    expect(bellError({ ...custom, breaks: [...custom.breaks, { name: "Another lunch", start: "12:00", duration: 10 }] })).toBe("Another lunch overlaps Lunch.");
  });
});

describe("6 · staff", () => {
  it("accepts optional assignments and rejects two class teachers for the same section", () => {
    expect(allocationError({})).toBe("");
    expect(allocationError({ s1: "5-A" })).toBe("");
    expect(allocationError({ s1: "5-A", s2: "5-B" })).toBe("");
    expect(allocationError({ s1: "5-A", s2: "5-A" })).toBe("A section can have only one class teacher.");
  });
});
