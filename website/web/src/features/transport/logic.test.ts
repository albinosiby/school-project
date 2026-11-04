import { describe, expect, it } from "vitest";
import {
  addDays, busStudentCounts, capacityError, crewDayBody, decisionNoteError, effectiveCrewStatus, isHHmm, isLateIn, isRegNo, leaveCovers, leaveDays,
  licenseStatus, markCounts, moveStop, nextBusId, nextStopId, regKey, stopsError, toMinutes, validateBus, validateCrew, validateCrewDay,
} from "./logic";

describe("times", () => {
  it("accepts only zero-padded 24h HH:mm", () => {
    expect(isHHmm("06:30")).toBe(true);
    expect(isHHmm("23:59")).toBe(true);
    for (const t of ["6:30", "24:00", "12:60", "", "0630", null, undefined, "06:30:00"]) expect(isHHmm(t)).toBe(false);
  });
  it("converts to minutes, tolerating a legacy unpadded hour", () => {
    expect(toMinutes("06:30")).toBe(390);
    expect(toMinutes("6:45")).toBe(405);
    expect(toMinutes("25:00")).toBeNull();
    expect(toMinutes(null)).toBeNull();
  });
  it("adds calendar days across month and leap-year boundaries", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });
});

describe("Late vs tr_settings/policy.checkInBy", () => {
  it("is Late only strictly after the deadline (driver app: hhmm(now) > checkInBy)", () => {
    expect(isLateIn("06:30", "06:30")).toBe(false);
    expect(isLateIn("06:31", "06:30")).toBe(true);
    expect(isLateIn("06:29", "06:30")).toBe(false);
    expect(isLateIn(null, "06:30")).toBe(false);
  });
  it("compares as times, not strings (a legacy 9:05 punch is not after 10:00)", () => {
    expect(isLateIn("9:05", "10:00")).toBe(false);
    expect(isLateIn("10:01", "10:00")).toBe(true);
  });
  it("falls back to the 06:30 default when the policy is not a time", () => {
    expect(isLateIn("06:40", "")).toBe(true);
    expect(isLateIn("06:20", "garbage")).toBe(false);
  });
  it("shows a Present day with a late punch as Late and leaves other statuses alone", () => {
    expect(effectiveCrewStatus({ status: "Present", in: "06:45" }, "06:30")).toBe("Late");
    expect(effectiveCrewStatus({ status: "Present", in: "06:15" }, "06:30")).toBe("Present");
    expect(effectiveCrewStatus({ status: "Late", in: "06:15" }, "06:30")).toBe("Late");
    expect(effectiveCrewStatus({ status: "Leave", in: null }, "06:30")).toBe("Leave");
  });
});

describe("crew day correction", () => {
  it("needs a check-in time for Present / Late and a check-out after it", () => {
    expect(validateCrewDay({ in: "", out: "", status: "Present" })).toEqual({ in: "Enter the check-in time" });
    expect(validateCrewDay({ in: "07:00", out: "06:00", status: "Late" })).toEqual({ out: "Check-out must be after check-in" });
    expect(validateCrewDay({ in: "07:00", out: "07:00", status: "Present" })).toEqual({ out: "Check-out must be after check-in" });
    expect(validateCrewDay({ in: "7:00", out: "", status: "Present" })).toEqual({ in: "Enter a time as HH:mm" });
    expect(validateCrewDay({ in: "06:20", out: "16:00", status: "Present" })).toEqual({});
  });
  it("needs no times for Absent / Leave and rejects unknown statuses", () => {
    expect(validateCrewDay({ in: "", out: "", status: "Absent" })).toEqual({});
    expect(validateCrewDay({ in: "", out: "", status: "Leave" })).toEqual({});
    expect(validateCrewDay({ in: "06:00", out: "", status: "present" })).toEqual({ status: "Pick a status" });
  });
  it("builds the admin doc: no punches on Absent / Leave, late Present stored as Late, source admin", () => {
    expect(crewDayBody({ in: "06:10", out: "07:00", status: "Leave", note: " ok " }, "06:30")).toEqual({ in: null, out: null, status: "Leave", note: "ok", source: "admin" });
    expect(crewDayBody({ in: "06:50", out: "", status: "Present", note: "" }, "06:30")).toEqual({ in: "06:50", out: null, status: "Late", note: "", source: "admin" });
    expect(crewDayBody({ in: "06:20", out: "16:00", status: "Present", note: "" }, "06:30")).toMatchObject({ status: "Present" });
  });
});

describe("crew leave", () => {
  it("counts calendar days, both ends included (driver app CrewLeave.days)", () => {
    expect(leaveDays("2026-11-03", "2026-11-03")).toBe(1);
    expect(leaveDays("2026-11-03", "2026-11-05")).toBe(3);
    expect(leaveDays("2026-10-30", "2026-11-02")).toBe(4);
    expect(leaveDays("2026-11-03", "")).toBe(1);
    expect(leaveDays("2026-11-05", "2026-11-03")).toBe(0);
    expect(leaveDays("", "2026-11-03")).toBe(0);
  });
  it("knows whether a leave covers a day", () => {
    expect(leaveCovers({ from: "2026-11-01", to: "2026-11-03" }, "2026-11-03")).toBe(true);
    expect(leaveCovers({ from: "2026-11-03", to: "" }, "2026-11-03")).toBe(true);
    expect(leaveCovers({ from: "2026-11-04", to: "2026-11-05" }, "2026-11-03")).toBe(false);
  });
  it("requires a rejection reason, not an approval note", () => {
    expect(decisionNoteError("Rejected", "  no ")).toBe("Please enter at least 5 characters.");
    expect(decisionNoteError("Rejected", "Bus 14 has no cover")).toBe("");
    expect(decisionNoteError("Approved", "")).toBe("");
  });
});

describe("student bus attendance counts", () => {
  it("counts boarded / dropped / absent and ignores unknown or empty marks", () => {
    expect(markCounts({ a: { status: "boarded" }, b: { status: "dropped" }, c: { status: "dropped" }, d: { status: "absent" } })).toEqual({ boarded: 1, dropped: 2, absent: 1 });
    expect(markCounts({ a: { status: "Boarded" as never }, b: null })).toEqual({ boarded: 0, dropped: 0, absent: 0 });
    expect(markCounts(undefined)).toEqual({ boarded: 0, dropped: 0, absent: 0 });
  });
});

describe("license expiry warning", () => {
  const today = "2026-11-03";
  it("is expired before today, soon within N days (inclusive), ok after", () => {
    expect(licenseStatus("2026-11-02", today)).toBe("expired");
    expect(licenseStatus("2026-11-03", today)).toBe("soon");
    expect(licenseStatus("2026-12-03", today)).toBe("soon");
    expect(licenseStatus("2026-12-04", today)).toBeNull();
    expect(licenseStatus("2026-11-10", today, 7)).toBe("soon");
    expect(licenseStatus("2026-11-11", today, 7)).toBeNull();
  });
  it("says nothing without an expiry, a today or a valid date", () => {
    expect(licenseStatus(undefined, today)).toBeNull();
    expect(licenseStatus("2026-11-01", undefined)).toBeNull();
    expect(licenseStatus("soon", today)).toBeNull();
  });
});

describe("studentCount", () => {
  const students = [
    { id: "s1", busId: "bus_01" }, { id: "s2", busId: "bus_01" }, { id: "s3", busId: "bus_02" }, { id: "s4" }, { id: "s5", busId: "bus_01", deleted: true },
  ];
  it("counts riders per bus, skipping soft-deleted students", () => {
    expect(Object.fromEntries(busStudentCounts(students))).toEqual({ bus_01: 2, bus_02: 1 });
  });
  it("applies moves: on, off and between buses", () => {
    const moves = new Map([["s1", "bus_02"], ["s2", ""], ["s4", "bus_01"]]);
    expect(Object.fromEntries(busStudentCounts(students, moves))).toEqual({ bus_01: 1, bus_02: 2 });
  });
  it("reports when the selection does not fit", () => {
    expect(capacityError(40, 38, 3, "Bus 14")).toBe("Bus 14 has 2 seats left; 3 students selected.");
    expect(capacityError(40, 39, 2, "Bus 14")).toBe("Bus 14 has 1 seat left; 2 students selected.");
    expect(capacityError(40, 45, 1, "Bus 14")).toBe("Bus 14 has 0 seats left; 1 student selected.");
    expect(capacityError(40, 38, 2, "Bus 14")).toBe("");
  });
});

describe("buses and stops", () => {
  it("next ids follow bus_NN / stp_NN", () => {
    expect(nextBusId([])).toBe("bus_01");
    expect(nextBusId(["bus_01", "bus_09", "legacy"])).toBe("bus_10");
    expect(nextStopId([{ id: "stp_02" }, { id: "stp_01" }])).toBe("stp_03");
  });
  it("moves a stop up / down and ignores moves past either end", () => {
    const s = ["a", "b", "c"];
    expect(moveStop(s, 0, 1)).toEqual(["b", "a", "c"]);
    expect(moveStop(s, 2, -1)).toEqual(["a", "c", "b"]);
    expect(moveStop(s, 0, -1)).toBe(s);
    expect(moveStop(s, 2, 1)).toBe(s);
  });
  it("recognises Indian registration numbers and compares them without separators", () => {
    for (const r of ["DL-01-AB-4092", "dl01ab4092", "MH 12 DE 1433", "KA-05-4092", "22-BH-1234-AA"]) expect(isRegNo(r)).toBe(true);
    for (const r of ["", "BUS 14", "DL-01-AB-40921", "1234"]) expect(isRegNo(r)).toBe(false);
    expect(regKey("dl 01-ab 4092")).toBe(regKey("DL-01-AB-4092"));
  });
  const st = (name: string, pickupTime: string, dropTime: string) => ({ name, pickupTime, dropTime });
  it("accepts stops in route order (equal times allowed)", () => {
    expect(stopsError([st("A", "06:45", "15:40"), st("B", "06:58", "15:55"), st("C", "06:58", "16:05")], "06:45", "15:30")).toBe("");
    expect(stopsError([], "06:45", "15:30")).toBe("");
  });
  it("names the first problem with the stops", () => {
    expect(stopsError([st("A", "06:45", "15:40"), st(" ", "06:50", "15:50")], "06:45", "15:30")).toBe("Every stop needs a name");
    expect(stopsError([st("Nehru Place", "06:45", "15:40"), st("nehru place ", "06:50", "15:50")], "06:45", "15:30")).toBe('Two stops are named "nehru place"');
    expect(stopsError([st("A", "06:45", "")], "06:45", "15:30")).toBe("Stop 1 (A) needs pickup and drop times (HH:mm)");
    expect(stopsError([st("A", "06:40", "15:40")], "06:45", "15:30")).toBe("Stop 1 (A): pickup time is before the pickup start (06:45)");
    expect(stopsError([st("A", "06:50", "15:40"), st("B", "06:48", "15:50")], "06:45", "15:30")).toBe("Stop 2 (B): pickup time is earlier than the stop before it");
    expect(stopsError([st("A", "06:50", "15:20")], "06:45", "15:30")).toBe("Stop 1 (A): drop time is before the drop start (15:30)");
    expect(stopsError([st("A", "06:50", "15:50"), st("B", "06:55", "15:45")], "06:45", "15:30")).toBe("Stop 2 (B): drop time is earlier than the stop before it");
  });
  const ok = { number: "15", regNo: "DL-01-AB-5000", capacity: "40", routeName: "Route 5", pickupStart: "06:45", dropStart: "15:30" };
  const existing = [{ id: "bus_01", number: "14", regNo: "DL-01-AB-4092" }];
  it("validates a bus: required, formats, duplicates, capacity bounds", () => {
    expect(validateBus(ok, [], existing)).toEqual({});
    expect(validateBus({ ...ok, number: " ", regNo: "", capacity: "", routeName: "" }, [], existing)).toEqual({
      number: "Bus number is required", regNo: "Registration number is required", capacity: "Enter the seat count (a whole number, 1 to 120)", routeName: "Route name is required" });
    expect(validateBus({ ...ok, number: "14", regNo: "dl01ab4092" }, [], existing)).toEqual({ number: "Another bus has this number", regNo: "Another bus has this registration number" });
    expect(validateBus({ ...ok, regNo: "BUS-14" }, [], existing).regNo).toBe("Enter a registration number like DL-01-AB-4092");
    for (const c of ["0", "-3", "40.5", "121", "abc"]) expect(validateBus({ ...ok, capacity: c }, [], existing).capacity).toBe("Enter the seat count (a whole number, 1 to 120)");
    expect(validateBus({ ...ok, number: "Bus 14!" }, [], existing).number).toBe("Use up to 8 letters or digits (e.g. 14)");
  });
  it("lets a bus keep its own number and registration, but not shrink below its riders", () => {
    expect(validateBus({ ...ok, number: "14", regNo: "DL-01-AB-4092" }, [], existing, "bus_01")).toEqual({});
    expect(validateBus({ ...ok, capacity: "4" }, [], existing, "bus_01", 5).capacity).toBe("5 students are on this bus; capacity cannot be lower");
  });
  it("checks the start times and the stops", () => {
    expect(validateBus({ ...ok, pickupStart: "", dropStart: "06:00" }, [], existing)).toEqual({ pickupStart: "Enter a time as HH:mm" });
    expect(validateBus({ ...ok, dropStart: "06:00" }, [], existing)).toEqual({ dropStart: "The drop must start after the pickup" });
    expect(validateBus(ok, [st("", "06:50", "15:40")], existing)).toEqual({ stops: "Every stop needs a name" });
  });
});

describe("crew validation", () => {
  const today = "2026-11-03";
  const ctx = { today, emailTaken: (e: string) => e.trim().toLowerCase() === "ramesh@school.test", empIdTaken: (x: string) => x.trim().toLowerCase() === "tr-1001" };
  const base = { name: "Vijay Singh", empId: "", phone: "+91 98100 00031", email: "vijay@school.test", licenseNo: "DL-0420110099999", licenseExpiry: "2029-01-31", emergencyPhone: "" };
  it("passes a valid driver and a valid attendant without a license", () => {
    expect(validateCrew(base, "driver", ctx)).toEqual({});
    expect(validateCrew({ ...base, licenseNo: "", licenseExpiry: "" }, "attendant", ctx)).toEqual({});
  });
  it("requires the license number and a future expiry for drivers", () => {
    expect(validateCrew({ ...base, licenseNo: "", licenseExpiry: "" }, "driver", ctx)).toEqual({
      licenseNo: "License number is required for a driver", licenseExpiry: "License expiry is required for a driver" });
    expect(validateCrew({ ...base, licenseExpiry: "2026-11-02" }, "driver", ctx)).toEqual({ licenseExpiry: "The license has expired; enter the renewed expiry date" });
    expect(validateCrew({ ...base, licenseExpiry: today }, "driver", ctx)).toEqual({});
    expect(validateCrew({ ...base, licenseNo: "DL#1" }, "driver", ctx)).toEqual({ licenseNo: "Enter a valid license number" });
  });
  it("checks name, phone, email format and uniqueness, employee id", () => {
    expect(validateCrew({ ...base, name: " ", phone: "12ab", email: "x@y" }, "attendant", ctx)).toEqual({
      name: "Name is required", phone: "Enter a valid phone number", email: "A valid email is required (it is the driver-app login)" });
    expect(validateCrew({ ...base, email: " Ramesh@School.test", empId: "tr-1001" }, "driver", ctx)).toEqual({
      email: "Another crew member already uses this email", empId: "Another crew member has this employee ID" });
    expect(validateCrew({ ...base, empId: "TR 10/01" }, "driver", ctx)).toEqual({ empId: "Use letters, digits and hyphens (e.g. TR-1001)" });
    expect(validateCrew({ ...base, emergencyPhone: "123" }, "driver", ctx)).toEqual({ emergencyPhone: "Enter a valid phone number" });
  });
});
