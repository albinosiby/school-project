import { describe, expect, it } from "vitest";
import {
  adminLeaveId, approvedLeaveOn, covers, decisionPatch, findMirror, leaveBalance, leaveDays, mirrorId, mirrorRow, overlappingLeave, recordedLeave,
  toApprovalStatus, toLeaveStatus, validateRecordLeave, type StaffLeave,
} from "./leaves";
import { DEFAULT_LEAVE_TYPES } from "./checkins";

const leave = (p: Partial<StaffLeave> = {}): StaffLeave => ({ id: "lv9xk2", staffId: "stf_025", type: "Casual Leave", from: "2026-11-02", to: "2026-11-03", days: 2, reason: "Family function", status: "Pending", createdAt: "2026-10-30T09:15:00.000Z", ...p });

describe("leaveDays (inclusive, Sundays not counted)", () => {
  it.each([
    ["2026-11-02", "2026-11-02", 1], // Monday
    ["2026-11-02", "2026-11-08", 6], // Mon..Sun
    ["2026-11-08", "2026-11-08", 0], // Sunday only
    ["2026-11-03", "2026-11-02", 0], // reversed
    ["", "2026-11-02", 0],
    ["2026-12-28", "2027-01-02", 6], // across the year end, no Sunday
  ])("%s..%s = %i", (a, b, n) => { expect(leaveDays(a, b)).toBe(n); });
});

describe("status mapping and mirrors (contract 9)", () => {
  it("maps leave <-> approval statuses", () => {
    expect(toApprovalStatus("Approved")).toBe("approved");
    expect(toApprovalStatus("Rejected")).toBe("rejected");
    expect(toApprovalStatus("Pending")).toBe("pending");
    expect(toLeaveStatus("approved")).toBe("Approved");
    expect(toLeaveStatus("rejected")).toBe("Rejected");
    expect(toLeaveStatus("pending")).toBe("Pending");
  });
  it("mirrorRow has id lv_{leaveId}, kind leave, source staff_leaves", () => {
    const m = mirrorRow(leave(), { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" });
    expect(m).toMatchObject({ id: "lv_lv9xk2", kind: "leave", source: "staff_leaves", sourceId: "lv9xk2", status: "pending", requester: "Mrs. Anita Sharma", dept: "Mathematics",
      title: "Casual Leave", detail: "2 days · 2026-11-02 to 2026-11-03", remark: "Family function", submitted: "2026-10-30T09:15:00" });
    expect(mirrorId("x")).toBe("lv_x");
  });
  it("mirrorRow tolerates a missing staff record, type and days", () => {
    const m = mirrorRow(leave({ type: "Medical", days: 0, from: "2026-11-02", to: "" }));
    expect(m).toMatchObject({ requester: "stf_025", dept: "Staff", title: "Medical Leave", detail: "1 day · 2026-11-02" });
  });
  it("findMirror matches by sourceId first, else by the conventional id", () => {
    expect(findMirror([{ id: "other", sourceId: "lv9xk2" }, { id: "lv_lv9xk2" }], "lv9xk2")?.id).toBe("other");
    expect(findMirror([{ id: "lv_lv9xk2" }], "lv9xk2")?.id).toBe("lv_lv9xk2");
    expect(findMirror([], "lv9xk2")).toBeUndefined();
  });
  it("decisionPatch records who and when; back to Pending clears them", () => {
    expect(decisionPatch("Approved", "admin_uid", "ok", "2026-11-04T10:00:00.000Z")).toEqual({ status: "Approved", decidedBy: "admin_uid", decidedAt: "2026-11-04T10:00:00.000Z", decisionNote: "ok" });
    expect(decisionPatch("Pending", "admin_uid")).toEqual({ status: "Pending", decidedBy: "", decidedAt: "", decisionNote: "" });
  });
});

describe("balance and overlap", () => {
  const leaves = [
    leave({ id: "a", status: "Approved", days: 2 }),
    leave({ id: "b", status: "Approved", type: "casual leave", days: 1 }),
    leave({ id: "c", status: "Pending", days: 3 }),
    leave({ id: "d", status: "Approved", type: "Medical Leave", days: 4 }),
    leave({ id: "e", status: "Approved", staffId: "stf_001", days: 5 }),
  ];
  it("leaveBalance counts approved days of the same type for that staff member", () => {
    const b = leaveBalance(DEFAULT_LEAVE_TYPES, leaves, "stf_025");
    expect(b.find((t) => t.id === "CL")).toMatchObject({ total: 12, used: 3, left: 9 });
    expect(b.find((t) => t.id === "ML")).toMatchObject({ used: 4, left: 6 });
    expect(b.find((t) => t.id === "DL")).toMatchObject({ used: 0, left: 6 });
  });
  it("left never goes below zero", () => {
    expect(leaveBalance([{ id: "X", name: "X", type: "Casual Leave", total: 1 }], leaves, "stf_025")[0]).toMatchObject({ used: 3, left: 0 });
  });
  it("covers / approvedLeaveOn / overlappingLeave", () => {
    expect(covers({ from: "2026-11-02", to: "2026-11-03" }, "2026-11-03")).toBe(true);
    expect(covers({ from: "2026-11-02", to: "" }, "2026-11-02")).toBe(true);
    expect(covers({ from: "2026-11-02", to: "2026-11-03" }, "2026-11-04")).toBe(false);
    expect(approvedLeaveOn(leaves, "stf_025", "2026-11-02")?.id).toBe("a");
    expect(approvedLeaveOn(leaves, "stf_009", "2026-11-02")).toBeUndefined();
    expect(overlappingLeave([leave({ status: "Rejected" })], "stf_025", "2026-11-01", "2026-11-02")).toBeUndefined();
    expect(overlappingLeave([leave()], "stf_025", "2026-11-03", "2026-11-05")?.id).toBe("lv9xk2");
    expect(overlappingLeave([leave()], "stf_025", "2026-11-04", "2026-11-05")).toBeUndefined();
  });
});

describe("office-recorded leave", () => {
  it("validateRecordLeave", () => {
    const v = (p: Partial<{ from: string; to: string; type: string }>, others: StaffLeave[] = []) => validateRecordLeave({ from: "2026-11-02", to: "2026-11-03", type: "Casual Leave", ...p }, others, "stf_025");
    expect(v({})).toEqual({});
    expect(v({ from: "" })).toEqual({ from: "Pick the first day of leave" });
    expect(v({ to: "" })).toEqual({ to: "Pick the last day of leave" });
    expect(v({ to: "2026-11-01" })).toEqual({ to: "End date is before start" });
    expect(v({ type: " " })).toEqual({ type: "Pick a leave type" });
    expect(v({ from: "2026-11-08", to: "2026-11-08" })).toEqual({ to: "The selected dates only include Sundays" });
    expect(v({}, [leave({ status: "Approved", from: "2026-11-03", to: "2026-11-04" })])).toEqual({ from: "This staff member already has leave on these dates" });
  });
  it("recordedLeave is an Approved staff_leaves doc with a stable id", () => {
    expect(recordedLeave({ staffId: "stf_025", type: "Medical Leave", from: "2026-11-02", to: "2026-11-04", reason: " Fever " }, "admin_uid", "2026-11-01T08:00:00.000Z")).toEqual({
      id: "sl_stf_025_2026-11-02", staffId: "stf_025", type: "Medical Leave", from: "2026-11-02", to: "2026-11-04", days: 3, reason: "Fever", status: "Approved",
      decidedBy: "admin_uid", decidedAt: "2026-11-01T08:00:00.000Z", decisionNote: "Recorded by the office", createdAt: "2026-11-01T08:00:00.000Z", source: "admin",
    });
    expect(adminLeaveId("stf_1", "2026-01-01")).toBe("sl_stf_1_2026-01-01");
  });
});
