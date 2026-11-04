import { describe, expect, it } from "vitest";
import { effectiveStatus, emailTaken, empIdTaken, nextEmpId, nextStaffId, staffBody, validPhone, validateStaff, type StaffDraft } from "./staffLogic";

const rows = [
  { id: "stf_001", empId: "EMP-1000", email: "a@school.test", status: "Active" },
  { id: "stf_009", empId: "EMP-1002", email: "B@School.test", status: "On leave", leaveTo: "2026-11-10" },
];
const draft = (p: Partial<StaffDraft> = {}): StaffDraft => ({ name: "Ravi Kumar", empId: "", department: "Science", role: "TGT", phone: "+91 98100 00001", email: "ravi@school.test", designation: "", subjects: "", joined: "", ...p });

describe("staff ids", () => {
  it("nextStaffId takes the highest stf_NNN + 1, zero-padded, ignoring other ids", () => {
    expect(nextStaffId([])).toBe("stf_001");
    expect(nextStaffId(rows)).toBe("stf_010");
    expect(nextStaffId([{ id: "stf_999" }, { id: "legacy" }])).toBe("stf_1000");
  });
  it("nextEmpId skips employee ids already in use", () => {
    expect(nextEmpId([])).toBe("EMP-1000");
    expect(nextEmpId(rows)).toBe("EMP-1003"); // EMP-1002 is taken
  });
  it("emailTaken / empIdTaken are case-insensitive and skip the edited row", () => {
    expect(emailTaken(rows, " b@school.TEST ")).toBe(true);
    expect(emailTaken(rows, "b@school.test", "stf_009")).toBe(false);
    expect(empIdTaken(rows, "emp-1000")).toBe(true);
    expect(empIdTaken(rows, "EMP-1000", "stf_001")).toBe(false);
  });
});

describe("validPhone", () => {
  it.each([["+91 98100 00001", true], ["9810000001", true], ["011-2345-6789", true], ["12345", false], ["98100abc01", false], ["+91 98100 00001 2345", false]])("%s -> %s", (p, ok) => {
    expect(validPhone(p)).toBe(ok);
  });
});

describe("validateStaff", () => {
  const today = "2026-11-04";
  it("accepts a complete draft", () => { expect(validateStaff(draft(), rows, undefined, today)).toEqual({}); });
  it("requires name, phone and a valid email", () => {
    expect(validateStaff(draft({ name: " ", phone: "", email: "x@y" }), rows, undefined, today)).toEqual({
      name: "Name is required", phone: "Enter a valid phone number", email: "A valid email is required (it is the teacher's login)",
    });
  });
  it("flags a one-letter name, a duplicate email/employee id and a malformed employee id", () => {
    expect(validateStaff(draft({ name: "R" }), rows, undefined, today).name).toBe("Enter the full name");
    expect(validateStaff(draft({ email: "A@school.test" }), rows, undefined, today).email).toBe("Another staff member already uses this email");
    expect(validateStaff(draft({ empId: "emp-1002" }), rows, undefined, today).empId).toBe("Another staff member has this employee ID");
    expect(validateStaff(draft({ empId: "EMP 1" }), rows, undefined, today).empId).toBe("Use 2-20 letters, digits, - or /");
  });
  it("lets an edited row keep its own email and employee id", () => {
    expect(validateStaff(draft({ email: "a@school.test", empId: "EMP-1000" }), rows, "stf_001", today)).toEqual({});
  });
  it("refuses a joining date in the future", () => {
    expect(validateStaff(draft({ joined: "2026-11-05" }), rows, undefined, today).joined).toBe("The joining date cannot be in the future");
    expect(validateStaff(draft({ joined: "2026-11-04" }), rows, undefined, today).joined).toBeUndefined();
  });
});

describe("staffBody", () => {
  it("trims, lower-cases the email, drops empty optional fields and generates the employee id", () => {
    expect(staffBody(draft({ name: "  Ravi Kumar ", email: " Ravi@School.TEST ", phone: " +91  98100 00001 " }), rows)).toEqual({
      name: "Ravi Kumar", empId: "EMP-1003", department: "Science", role: "TGT", phone: "+91 98100 00001", email: "ravi@school.test",
    });
  });
  it("keeps a given employee id and the optional fields", () => {
    expect(staffBody(draft({ empId: " T-9 ", designation: " HOD ", subjects: "Physics", joined: "2020-06-01" }), rows)).toMatchObject({ empId: "T-9", designation: "HOD", subjects: "Physics", joined: "2020-06-01" });
  });
});

describe("effectiveStatus", () => {
  const today = "2026-11-04";
  it("shows the office's On leave until its end date, then Active again", () => {
    expect(effectiveStatus(rows[1]!, [], today)).toEqual({ status: "On leave", until: "2026-11-10" });
    expect(effectiveStatus({ ...rows[1]!, leaveTo: "2026-11-01" }, [], today)).toEqual({ status: "Active" });
  });
  it("shows an approved teacher-app leave that includes today", () => {
    const leaves = [{ staffId: "stf_001", status: "Approved" as const, from: "2026-11-03", to: "2026-11-05" }];
    expect(effectiveStatus(rows[0]!, leaves, today)).toEqual({ status: "On leave", until: "2026-11-05" });
    expect(effectiveStatus(rows[0]!, [{ ...leaves[0]!, status: "Pending" as const }], today)).toEqual({ status: "Active" });
  });
});
