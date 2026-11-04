import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { CrewAttendancePanel } from "./CrewAttendancePanel";
import { dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const crew = [
  { id: "crw_001", name: "Ramesh Kumar", role: "driver", empId: "TR-1001", phone: "1", email: "d@x.test", status: "Active", busId: "bus_01", bus: "Bus 14" },
  { id: "crw_002", name: "Suresh Yadav", role: "attendant", empId: "TR-1002", phone: "2", email: "a@x.test", status: "Active", busId: "bus_01", bus: "Bus 14" },
];
const day = (date: string, crewId: string, v: Record<string, unknown>) => ({ id: `${date}_${crewId}`, crewId, name: crewId === "crw_001" ? "Ramesh Kumar" : "Suresh Yadav", role: crewId === "crw_001" ? "driver" : "attendant", busId: "bus_01", date, source: "app", ...v });
/** status badges in the table rows (the summary table also has a "Late" column header) */
const badges = (t: string) => screen.queryAllByText(t).filter((e) => !e.closest("th"));
const setVal = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

describe("Late vs check-in policy", () => {
  it("uses the 06:30 default without tr_settings and counts a late Present day as Late", () => {
    seed({ tr_crew: crew, tr_crew_attendance: [day("2026-11-02", "crw_001", { in: "06:40", out: "16:00", status: "Present" }), day("2026-11-02", "crw_002", { in: "06:20", out: "16:00", status: "Present" })] });
    renderUI(<CrewAttendancePanel />);
    expect(field("Crew must check in by")).toHaveValue("06:30");
    expect(badges("Late")).toHaveLength(1);
    expect(badges("Present")).toHaveLength(1);
  });

  it("follows tr_settings/policy.checkInBy when present", () => {
    seed({ tr_settings: [{ id: "policy", checkInBy: "06:45" }], tr_crew: crew, tr_crew_attendance: [day("2026-11-02", "crw_001", { in: "06:40", out: "16:00", status: "Present" })] });
    renderUI(<CrewAttendancePanel />);
    expect(field("Crew must check in by")).toHaveValue("06:45");
    expect(badges("Late")).toHaveLength(0);
  });

  it("validates and saves the check-in policy", async () => {
    const { user } = renderUI(<CrewAttendancePanel />);
    setVal(field("Crew must check in by"), "");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(fieldError("Crew must check in by")).toBe("Enter a time as HH:mm");
    expect(writes).toHaveLength(0);
    setVal(field("Crew must check in by"), "06:40");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(getRow("tr_settings", "policy")).toMatchObject({ checkInBy: "06:40", updatedBy: "admin_uid" });
    expect(await screen.findByText("Check-in time saved")).toBeInTheDocument();
  });
});

describe("Crew attendance correction", () => {
  async function openCorrect() {
    seed({ tr_crew: crew, tr_crew_attendance: [day("2026-11-02", "crw_001", { in: "06:20", out: "16:00", status: "Present" })] });
    const r = renderUI(<CrewAttendancePanel />);
    await r.user.click(screen.getByRole("button", { name: "Correct" }));
    const d = dialog("Correct check-in");
    return { ...r, d, save: () => r.user.click(within(d).getByRole("button", { name: "Save" })) };
  }

  it("requires a check-in time and a check-out after it, writing nothing when invalid", async () => {
    const { d, save } = await openCorrect();
    setVal(field("Check-in", d), "");
    await save();
    expect(fieldError("Check-in", d)).toBe("Enter the check-in time");
    setVal(field("Check-in", d), "07:00"); setVal(field("Check-out", d), "06:59");
    await save();
    expect(fieldError("Check-out", d)).toBe("Check-out must be after check-in");
    setVal(field("Check-out", d), "07:00");
    await save();
    expect(fieldError("Check-out", d)).toBe("Check-out must be after check-in");
    expect(writes).toHaveLength(0);
  });

  it("saves a late punch as Late with source admin on the {date}_{crewId} doc", async () => {
    const { user, d, save } = await openCorrect();
    setVal(field("Check-in", d), "06:50");
    expect(field("Status", d)).toHaveValue("Late");
    await user.selectOptions(field("Status", d), "Present"); // still late: stored as Late
    await user.type(field("Note", d), "Traffic jam, verified");
    await save();
    expect(getRow("tr_crew_attendance", "2026-11-02_crw_001")).toMatchObject({ crewId: "crw_001", name: "Ramesh Kumar", role: "driver", busId: "bus_01", date: "2026-11-02",
      in: "06:50", out: "16:00", status: "Late", source: "admin", note: "Traffic jam, verified", updatedBy: "admin_uid" });
    expect(await screen.findByText("Day saved")).toBeInTheDocument();
  });

  it("stores Leave without punch times", async () => {
    const { user, d, save } = await openCorrect();
    await user.selectOptions(field("Status", d), "Leave");
    await save();
    expect(getRow("tr_crew_attendance", "2026-11-02_crw_001")).toMatchObject({ in: null, out: null, status: "Leave", source: "admin" });
  });

  it("records a missed day for a crew member by hand, refusing future dates", async () => {
    seed({ tr_crew: crew });
    const { user } = renderUI(<CrewAttendancePanel />);
    await user.click(screen.getByRole("button", { name: /Add day/ }));
    const pick = dialog("Add a day");
    await user.selectOptions(field("Crew member", pick), "crw_002");
    setVal(field("Date", pick), "2026-11-04");
    expect(fieldError("Date", pick)).toBe("The date cannot be in the future");
    expect(within(pick).getByRole("button", { name: "Continue" })).toBeDisabled();
    setVal(field("Date", pick), "2026-11-03");
    await user.click(within(pick).getByRole("button", { name: "Continue" }));
    const d = dialog("Record a day");
    setVal(field("Check-in", d), "06:25"); setVal(field("Check-out", d), "15:50");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(writesTo("tr_crew_attendance")).toHaveLength(1);
    expect(getRow("tr_crew_attendance", "2026-11-03_crw_002")).toMatchObject({ crewId: "crw_002", role: "attendant", date: "2026-11-03", in: "06:25", out: "15:50", status: "Present", source: "admin" });
  });
});
