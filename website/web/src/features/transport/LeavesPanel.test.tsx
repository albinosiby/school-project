import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LeavesPanel } from "./LeavesPanel";
import { dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes } from "@/test/render";

const crew = [{ id: "crw_002", name: "Suresh Yadav", role: "attendant", empId: "TR-1002", phone: "2", email: "a@x.test", status: "Active", busId: "bus_01", bus: "Bus 14" }];
// as the driver app writes it (lv_{crewId}_{millis}, no decision fields)
const leave = { id: "lv_crw_002_1730600000000", crewId: "crw_002", name: "Suresh Yadav", role: "attendant", busId: "bus_01", type: "Sick", from: "2026-11-02", to: "2026-11-04", days: 3,
  reason: "Fever", status: "Pending", appliedAt: "2026-11-01T08:00:00.000Z" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

describe("Crew leave decisions", () => {
  it("lists the pending request with its days", () => {
    seed({ tr_crew: crew, tr_crew_leaves: [{ ...leave, days: undefined }] });
    renderUI(<LeavesPanel />);
    expect(screen.getByText("Fever")).toBeInTheDocument();
    expect(screen.getByText("3 days")).toBeInTheDocument();
  });

  it("approves: Approved + decidedBy/decidedAt/decisionNote, and marks the crew member On leave for today", async () => {
    seed({ tr_crew: crew, tr_crew_leaves: [leave] });
    const { user } = renderUI(<LeavesPanel />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    const d = dialog("Approve leave");
    await user.type(field("Note (optional)", d), "Get well soon");
    await user.click(within(d).getByRole("button", { name: "Approve" }));
    const l = getRow<Record<string, unknown>>("tr_crew_leaves", leave.id)!;
    expect(l).toMatchObject({ status: "Approved", decidedBy: "admin_uid", decisionNote: "Get well soon", updatedBy: "admin_uid" });
    expect(String(l.decidedAt)).toMatch(/^2026-11-03T/);
    expect(getRow("tr_crew", "crw_002")).toMatchObject({ status: "On leave", leaveFrom: "2026-11-02", leaveTo: "2026-11-04", leaveReason: "Sick: Fever" });
    expect(await screen.findByText("Leave approved")).toBeInTheDocument();
  });

  it("does not mark the crew On leave for a leave that starts later", async () => {
    seed({ tr_crew: crew, tr_crew_leaves: [{ ...leave, from: "2026-11-10", to: "2026-11-11" }] });
    const { user } = renderUI(<LeavesPanel />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(within(dialog("Approve leave")).getByRole("button", { name: "Approve" }));
    expect(getRow("tr_crew_leaves", leave.id)).toMatchObject({ status: "Approved" });
    expect(getRow<Record<string, unknown>>("tr_crew_leaves", leave.id)).not.toHaveProperty("decisionNote");
    expect(getRow("tr_crew", "crw_002")).toMatchObject({ status: "Active" });
  });

  it("requires a reason to reject, then writes Rejected", async () => {
    seed({ tr_crew: crew, tr_crew_leaves: [leave] });
    const { user } = renderUI(<LeavesPanel />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const d = dialog("Reject leave");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(fieldError("Reason for rejection", d)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
    await user.type(field("Reason for rejection", d), "No cover on Bus 14");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(getRow("tr_crew_leaves", leave.id)).toMatchObject({ status: "Rejected", decidedBy: "admin_uid", decisionNote: "No cover on Bus 14" });
    expect(getRow("tr_crew", "crw_002")).toMatchObject({ status: "Active" });
  });

  it("reopens an approved leave: back to Pending, decision fields removed, crew member Active again", async () => {
    seed({ tr_crew: [{ ...crew[0]!, status: "On leave", leaveFrom: "2026-11-02", leaveTo: "2026-11-04", leaveReason: "Sick: Fever" }],
      tr_crew_leaves: [{ ...leave, status: "Approved", decidedBy: "admin_uid", decidedAt: "2026-11-02T05:00:00.000Z", decisionNote: "ok" }] });
    const { user } = renderUI(<LeavesPanel />);
    await user.click(screen.getByRole("tab", { name: /^Approved/ }));
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    const l = getRow<Record<string, unknown>>("tr_crew_leaves", leave.id)!;
    expect(l.status).toBe("Pending");
    for (const k of ["decidedBy", "decidedAt", "decisionNote"]) expect(l).not.toHaveProperty(k);
    expect(getRow("tr_crew", "crw_002")).toMatchObject({ status: "Active", leaveFrom: "", leaveTo: "" });
    expect(await screen.findByText("Moved back to pending")).toBeInTheDocument();
  });
});
