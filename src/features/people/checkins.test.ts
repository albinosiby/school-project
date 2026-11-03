import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CHECK_IN_BY, DEFAULT_LEAVE_TYPES, attId, dayStatus, isHHmm, isLate, localDate, localToday, normalizeCheckInBy, normalizeLeaveTypes,
  orphanMirrors, regMirrorId, regularizationPatch, t12, toMins, validateCorrection, validateLeavePolicy,
} from "./checkins";

afterEach(() => { vi.useRealTimers(); });

describe("time helpers", () => {
  it("toMins / isHHmm", () => {
    expect(toMins("08:15")).toBe(495);
    expect(toMins("8:05")).toBe(485);
    expect(toMins("")).toBeNaN();
    expect(toMins(null)).toBeNaN();
    expect(isHHmm("08:15")).toBe(true);
    expect(isHHmm("8:15")).toBe(false);
    expect(isHHmm("24:00")).toBe(false);
    expect(isHHmm("12:60")).toBe(false);
  });
  it("t12 formats 24h times and shows a dash for missing ones", () => {
    expect(t12("14:05")).toBe("02:05 PM");
    expect(t12("00:30")).toBe("12:30 AM");
    expect(t12("12:00")).toBe("12:00 PM");
    expect(t12(null)).toBe("—");
    expect(t12("bad")).toBe("—");
  });
  it("isLate compares minutes, strictly after the threshold", () => {
    expect(isLate("08:16", "08:15")).toBe(true);
    expect(isLate("08:15", "08:15")).toBe(false);
    expect(isLate("9:05", "10:00")).toBe(false); // a string compare would say "9:05" > "10:00"
    expect(isLate(null, "08:15")).toBe(false);
  });
  it("localDate / localToday use the local calendar day, not UTC", () => {
    expect(localDate(new Date(2026, 0, 5, 0, 30))).toBe("2026-01-05");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 4, 6, 0));
    expect(localToday()).toBe("2026-11-04");
  });
  it("attId / regMirrorId follow the contract ids", () => {
    expect(attId("2026-11-04", "stf_025")).toBe("2026-11-04_stf_025");
    expect(regMirrorId("reg_1")).toBe("rg_reg_1");
  });
});

describe("leave policy", () => {
  it("normalizeCheckInBy accepts H:mm like the teacher app and falls back to the default", () => {
    expect(normalizeCheckInBy("8:05")).toBe("08:05");
    expect(normalizeCheckInBy("07:45")).toBe("07:45");
    expect(normalizeCheckInBy("25:00")).toBe(DEFAULT_CHECK_IN_BY);
    expect(normalizeCheckInBy(undefined)).toBe("08:15");
  });
  it("normalizeLeaveTypes coerces totals and falls back to the built-in types", () => {
    expect(normalizeLeaveTypes(undefined)).toBe(DEFAULT_LEAVE_TYPES);
    expect(normalizeLeaveTypes([])).toBe(DEFAULT_LEAVE_TYPES);
    expect(normalizeLeaveTypes([{ id: "CL", name: "Casual", type: "Casual Leave", total: "12.7" }, "junk"])).toEqual([{ id: "CL", name: "Casual", type: "Casual Leave", total: 12 }]);
  });
  const ok = { types: [{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 }, { id: "ML", name: "Medical (ML)", type: "Medical Leave", total: 10 }], checkInBy: "08:15" };
  it("validateLeavePolicy", () => {
    expect(validateLeavePolicy(ok)).toBe("");
    expect(validateLeavePolicy({ ...ok, types: [] })).toBe("Add at least one leave type");
    expect(validateLeavePolicy({ ...ok, types: [{ ...ok.types[0]!, name: " " }] })).toBe("Every leave type needs a code, a label and a leave type");
    expect(validateLeavePolicy({ ...ok, types: [ok.types[0]!, { ...ok.types[1]!, id: "cl" }] })).toBe("Leave codes must be unique");
    expect(validateLeavePolicy({ ...ok, types: [ok.types[0]!, { ...ok.types[1]!, name: "casual (cl)" }] })).toBe("Leave labels must be unique");
    expect(validateLeavePolicy({ ...ok, types: [ok.types[0]!, { ...ok.types[1]!, type: "Casual Leave" }] })).toBe("Each leave type can appear only once");
    expect(validateLeavePolicy({ ...ok, types: [{ ...ok.types[0]!, total: 1.5 }] })).toBe("Yearly totals must be whole numbers between 0 and 365");
    expect(validateLeavePolicy({ ...ok, types: [{ ...ok.types[0]!, total: -1 }] })).toBe("Yearly totals must be whole numbers between 0 and 365");
    expect(validateLeavePolicy({ ...ok, types: [{ ...ok.types[0]!, total: 366 }] })).toBe("Yearly totals must be whole numbers between 0 and 365");
    expect(validateLeavePolicy({ ...ok, checkInBy: "8:15" })).toBe("Enter the check-in time as HH:mm (24-hour)");
  });
});

describe("dayStatus", () => {
  it("derives Late from a Present punch after the threshold", () => {
    expect(dayStatus({ in: "08:20", out: null, status: "Present" }, false, "08:15")).toBe("Late");
    expect(dayStatus({ in: "08:10", out: null, status: "Present" }, false, "08:15")).toBe("Present");
    expect(dayStatus({ in: "08:10", out: null, status: "Irregular" }, false, "08:15")).toBe("Irregular");
    expect(dayStatus({ in: null, out: null, status: "Leave" }, false, "08:15")).toBe("Leave");
  });
  it("without a punch: On leave when an approved leave covers the day, else Not checked in", () => {
    expect(dayStatus(undefined, true, "08:15")).toBe("On leave");
    expect(dayStatus(undefined, false, "08:15")).toBe("Not checked in");
    expect(dayStatus({ in: null, out: null, status: "Present" }, false, "08:15")).toBe("Not checked in");
  });
});

describe("validateCorrection", () => {
  const v = (p: Partial<{ in: string; out: string; status: string; note: string }>) => validateCorrection({ in: "08:00", out: "15:00", status: "Present", note: "", ...p }, "08:15");
  it("returns the doc fields, deriving Present/Late from the check-in", () => {
    expect(v({ note: " ok " })).toEqual({ errors: {}, value: { in: "08:00", out: "15:00", status: "Present", note: "ok" } });
    expect(v({ in: "08:40" }).value?.status).toBe("Late");
    expect(v({ in: "08:00", status: "Late" }).value?.status).toBe("Present");
  });
  it("Leave clears both punches", () => {
    expect(v({ status: "Leave" }).value).toEqual({ in: null, out: null, status: "Leave", note: "" });
  });
  it("errors", () => {
    expect(v({ in: "" }).errors).toEqual({ in: "Enter the check-in time" });
    expect(v({ in: "8:00" }).errors).toEqual({ in: "Use the HH:mm format" });
    expect(v({ out: "07:00" }).errors).toEqual({ out: "Check-out must be after check-in" });
    expect(v({ out: "08:00" }).errors).toEqual({ out: "Check-out must be after check-in" });
    expect(v({ status: "Irregular", in: "", out: "" }).errors).toEqual({ in: "Enter at least one punch" });
    expect(v({ status: "Absent" }).errors).toEqual({ status: "Pick a status" });
  });
  it("Irregular may have only a check-out", () => {
    expect(v({ status: "Irregular", in: "", out: "15:00" }).value).toEqual({ in: null, out: "15:00", status: "Irregular", note: "" });
  });
});

describe("regularizationPatch (contract 12.1: approving fixes the day, status Present)", () => {
  it("Check-in sets in and keeps the existing out", () => {
    expect(regularizationPatch({ type: "Check-in", time: "08:05", reason: "Forgot" }, { in: null, out: "15:30" })).toEqual({ in: "08:05", out: "15:30", status: "Present", note: "Regularized (Check-in: Forgot)" });
  });
  it("Check-out sets out and keeps the existing in", () => {
    expect(regularizationPatch({ type: "Check-out", time: "15:40", reason: "" }, { in: "08:00", out: null })).toEqual({ in: "08:00", out: "15:40", status: "Present", note: "Regularized (Check-out)" });
  });
  it("Both Punches with no day yet sets in", () => {
    expect(regularizationPatch({ type: "Both Punches", time: "08:00", reason: "" }, null)).toMatchObject({ in: "08:00", out: null });
  });
});

describe("orphanMirrors", () => {
  const now = Date.parse("2026-11-04T10:00:00Z");
  const a = (id: string, p: Record<string, unknown> = {}) => ({ id, status: "pending", source: "staff_leaves", sourceId: id.replace("lv_", ""), updatedAt: "2026-11-04T09:00:00Z", ...p });
  it("finds pending mirrors whose source doc is gone, after the grace period", () => {
    const rows = [a("lv_1"), a("lv_2"), a("lv_3", { status: "approved" }), a("lv_4", { source: "staff_regularizations" }), a("lv_5", { updatedAt: "2026-11-04T09:59:30Z" })];
    expect(orphanMirrors(rows, "staff_leaves", new Set(["1"]), now).map((x) => x.id)).toEqual(["lv_2"]);
  });
});
