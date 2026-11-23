import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { LeaveView } from "./LeaveView";
import { authState, dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const clerk = { ...teacher, id: "uid_c", email: "c@s.in", role: "staff" as const, staffId: "stf_9", staffRole: "accountant", name: "Ravi" };
const staff = [
  { id: "stf_1", name: "Anita Sharma", department: "Mathematics", designation: "Teacher" },
  { id: "stf_9", name: "Ravi Menon", department: "Accounts", designation: "Accountant" },
];
const policy = { id: "policy", types: [{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 }, { id: "ML", name: "Medical (ML)", type: "Medical Leave", total: 10 }], checkInBy: "08:15" };
const approved = { id: "lv_old", staffId: "stf_1", type: "Casual Leave", from: "2026-10-05", to: "2026-10-06", days: 2, reason: "Family function", status: "Approved", createdAt: "2026-10-01T09:15:00.000Z", decidedBy: "admin_uid", decidedAt: "2026-10-02T09:00:00.000Z", decisionNote: "Approved" };
const pending = { id: "lv_pend", staffId: "stf_1", teacherId: "stf_1", type: "Medical Leave", from: "2026-12-01", to: "2026-12-01", start: "2026-12-01", end: "2026-12-01", days: 1, coverage: "Full Day", reason: "Dentist appointment", handovers: [], status: "Pending", createdAt: "2026-11-20T09:15:00.000Z", updatedAt: "2026-11-20T09:15:00.000Z", updatedBy: "uid_t" };
const other = { id: "lv_other", staffId: "stf_2", type: "Casual Leave", from: "2026-11-24", to: "2026-11-24", days: 1, reason: "Other teacher", status: "Pending", createdAt: "2026-11-21T09:15:00.000Z" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 9, 0, 0)); authState.user = teacher; });
afterEach(() => vi.useRealTimers());

describe("Leave requests", () => {
  it("lists only my requests, newest first, with withdrawn copies from lm_withdrawn", async () => {
    seed({ staff, set_leave_policy: [policy], staff_leaves: [approved, pending, other], lm_withdrawn: [{ id: "lv_gone", teacherId: "stf_1", staffId: "stf_1", type: "Casual Leave", from: "2026-09-01", to: "2026-09-01", days: 1, reason: "Withdrawn one", status: "Cancelled", createdAt: "2026-08-30T09:00:00.000Z", withdrawnAt: "2026-08-31T09:00:00.000Z" }] });
    renderUI(<LeaveView />);
    const cells = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(cells).toHaveLength(3);
    expect(cells[0]).toContain("Dentist appointment");
    expect(cells[1]).toContain("Family function");
    expect(cells[2]).toContain("Withdrawn one");
    expect(cells[2]).toContain("Cancelled");
    expect(screen.queryByText("Other teacher")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Leave requests/ })).toHaveTextContent("(1)");
  });

  it("Apply for leave writes the app-shaped staff_leaves doc and the approvals mirror", async () => {
    seed({ staff, set_leave_policy: [policy], staff_leaves: [approved] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("button", { name: "Apply for leave" }));
    const dlg = dialog("Apply for leave");
    expect(field("Leave type", dlg)).toHaveValue("Casual Leave");
    expect(within(dlg).getByRole("option", { name: "Casual (CL) · 10 left" })).toBeInTheDocument();
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-24" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-25" } });
    await user.type(field("Reason", dlg), "Cousin's wedding out of town");
    await user.type(field("Handover note", dlg), "Grade 10-B worksheets are in the staff room");
    await user.click(within(dlg).getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Leave application submitted for approval")).toBeInTheDocument();
    const leave = rowsOf<{ id: string }>("staff_leaves").find((l) => l.id !== "lv_old")!;
    expect(leave.id).toMatch(/^lr_/);
    expect(leave).toEqual({
      id: leave.id, staffId: "stf_1", teacherId: "stf_1", from: "2026-11-24", to: "2026-11-25", start: "2026-11-24", end: "2026-11-25", type: "Casual Leave", days: 2, coverage: "Full Day",
      reason: "Cousin's wedding out of town", handovers: [], note: "Grade 10-B worksheets are in the staff room", status: "Pending", createdAt: expect.stringMatching(ISO), updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t",
    });
    expect(getRow("approvals", `lv_${leave.id}`)).toEqual({
      id: `lv_${leave.id}`, requester: "Anita Sharma", ref: `LV-${leave.id.slice(-6).toUpperCase()}`, kind: "leave", dept: "Mathematics", title: "Casual Leave", detail: "2 days · 2026-11-24 to 2026-11-25",
      remark: "Cousin's wedding out of town", submitted: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/), urgency: "Standard", tone: "neutral", status: "pending", source: "staff_leaves", sourceId: leave.id,
      updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t",
    });
    expect(writes.every((w) => !("_o" in (w.data ?? {})))).toBe(true);
  });

  it("validates like the app and writes nothing until the form is right", async () => {
    seed({ staff, set_leave_policy: [policy], staff_leaves: [{ ...approved, days: 12, from: "2026-10-05", to: "2026-10-19" }] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("button", { name: "Apply for leave" }));
    const dlg = dialog("Apply for leave");
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-29" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-29" } });
    await user.type(field("Reason", dlg), "short");
    await user.click(within(dlg).getByRole("button", { name: "Submit request" }));
    expect(fieldError("Reason", dlg)).toBe("Please give a reason (at least 10 characters)");
    expect(fieldError("To", dlg)).toBe("Selected dates only include Sundays");
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-30" } });
    await user.type(field("Reason", dlg), " reason that is long enough");
    await user.click(within(dlg).getByRole("button", { name: "Submit request" }));
    expect(fieldError("To", dlg)).toBe("Only 0 day(s) of Casual Leave available");
    expect(writes).toHaveLength(0);
    await user.selectOptions(field("Leave type", dlg), "Medical Leave");
    await user.click(within(dlg).getByRole("button", { name: "Submit request" }));
    expect(await screen.findByText("Leave application submitted for approval")).toBeInTheDocument();
    expect(rowsOf("staff_leaves")).toHaveLength(2);
  });

  it("Withdraw moves a pending request to lm_withdrawn (Cancelled + withdrawnAt) and deletes it", async () => {
    seed({ staff, set_leave_policy: [policy], staff_leaves: [pending, approved] });
    const { user } = renderUI(<LeaveView />);
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    const dlg = dialog("Withdraw leave request");
    await user.click(within(dlg).getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText("Leave request withdrawn")).toBeInTheDocument();
    expect(getRow("staff_leaves", "lv_pend")).toBeUndefined();
    expect(getRow("lm_withdrawn", "lv_pend")).toEqual({ ...pending, status: "Cancelled", withdrawnAt: expect.stringMatching(ISO), teacherId: "stf_1", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t" });
    expect(writes.map((w) => `${w.op}:${w.coll}`)).toEqual(["set:lm_withdrawn", "delete:staff_leaves"]);
    expect(screen.getByText("Dentist appointment").closest("tr")).toHaveTextContent("Cancelled");
  });

  it("non-teaching staff withdraw the same way, keeping a cancelled copy in lm_withdrawn", async () => {
    authState.user = clerk;
    seed({ staff, set_leave_policy: [policy], staff_leaves: [{ ...pending, staffId: "stf_9", teacherId: "stf_9" }] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    await user.click(within(dialog("Withdraw leave request")).getByRole("button", { name: "Withdraw" }));
    expect(await screen.findByText("Leave request withdrawn")).toBeInTheDocument();
    expect(writes.map((w) => `${w.op}:${w.coll}`)).toEqual(["set:lm_withdrawn", "delete:staff_leaves"]);
    expect(getRow("lm_withdrawn", "lv_pend")).toMatchObject({ status: "Cancelled", teacherId: "stf_9" });
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});

describe("Leave balance, check-ins and regularizations", () => {
  it("shows the policy entitlement minus approved days", async () => {
    seed({ staff, set_leave_policy: [policy], staff_leaves: [approved, pending] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("tab", { name: "Leave balance" }));
    expect(screen.getByRole("group", { name: "Casual (CL)" })).toHaveTextContent("10 of 12 days left");
    expect(screen.getByRole("group", { name: "Casual (CL)" })).toHaveTextContent("2 days used");
    expect(screen.getByRole("group", { name: "Medical (ML)" })).toHaveTextContent("10 of 10 days left");
  });

  it("Check-ins tab records today's check-in with source web and lists my days", async () => {
    seed({ staff, set_leave_policy: [policy], staff_attendance: [
      { id: "2026-11-20_stf_1", staffId: "stf_1", date: "2026-11-20", in: "08:05", out: "15:30", status: "Present", note: "", source: "app" },
      { id: "2026-11-20_stf_2", staffId: "stf_2", date: "2026-11-20", in: "08:05", out: "15:30", status: "Present", note: "", source: "app" },
    ] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("tab", { name: "Check-ins" }));
    expect(screen.getAllByRole("row")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(getRow("staff_attendance", "2026-11-23_stf_1")).toEqual({ id: "2026-11-23_stf_1", staffId: "stf_1", date: "2026-11-23", in: "09:00", out: null, status: "Late", note: "", source: "web", teacherId: "stf_1", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t" });
    await user.click(screen.getByRole("button", { name: "Check out" }));
    expect(await screen.findByText("Checked out")).toBeInTheDocument();
    expect(getRow("staff_attendance", "2026-11-23_stf_1")).toMatchObject({ in: "09:00", out: "09:00", status: "Late" });
    expect(writes[1]).toMatchObject({ op: "update", coll: "staff_attendance", id: "2026-11-23_stf_1", data: { out: "09:00", teacherId: "stf_1", updatedBy: "uid_t" } });
    expect(screen.getByText("Day complete")).toBeInTheDocument();
    expect(screen.getAllByRole("row")).toHaveLength(3);
  });

  it("Request correction writes a Pending staff_regularizations doc as the app does", async () => {
    authState.user = clerk;
    seed({ staff, set_leave_policy: [policy], staff_regularizations: [{ id: "rg_other", staffId: "stf_1", date: "2026-11-10", type: "Check-in", time: "08:00", reason: "x", status: "Pending", at: "2026-11-10T09:00:00.000Z" }] });
    const { user } = renderUI(<LeaveView />);
    await user.click(screen.getByRole("tab", { name: "Regularizations" }));
    expect(screen.getByText("No correction requests")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Request correction" })).toHaveLength(2);
    await user.click(screen.getAllByRole("button", { name: "Request correction" })[0]!);
    const dlg = dialog("Request correction");
    await user.click(within(dlg).getByRole("button", { name: "Send request" }));
    expect(fieldError("Correct time", dlg)).toBe("Enter the time as HH:mm (24-hour)");
    expect(fieldError("Reason", dlg)).toBe("Give a reason for the correction");
    expect(writes).toHaveLength(0);
    fireEvent.change(field("Date", dlg), { target: { value: "2026-11-21" } });
    await user.selectOptions(field("Punch", dlg), "Check-out");
    fireEvent.change(field("Correct time", dlg), { target: { value: "16:10" } });
    await user.type(field("Reason", dlg), "Forgot to punch out");
    await user.type(field("Note", dlg), "Left after the audit meeting");
    await user.click(within(dlg).getByRole("button", { name: "Send request" }));
    expect(await screen.findByText("Correction request sent")).toBeInTheDocument();
    const row = rowsOf<{ id: string }>("staff_regularizations").find((r) => r.id !== "rg_other")!;
    expect(row.id).toMatch(/^rg_/);
    expect(row).toEqual({ id: row.id, staffId: "stf_9", date: "2026-11-21", type: "Check-out", time: "16:10", reason: "Forgot to punch out", note: "Left after the audit meeting", status: "Pending", at: expect.stringMatching(ISO), teacherId: "stf_9", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_c" });
    expect(screen.getByText("Forgot to punch out").closest("tr")).toHaveTextContent("Pending");
  });
});
