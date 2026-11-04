import { describe, expect, it } from "vitest";
import {
  allocationError, ayLabel, ayStart, bellError, buildSchedule, canOpenStep, classIdOfLabel, classesFor, currentTermName, feeError, firstOpenStep,
  inviteError, markCompleted, newStaffErrors, nextEmpId, nextStaffId, parseStudentCsv, profileErrors, progressPct, sectionRowsFor, sectionsError,
  splitCsvLine, studentDocs, termDays, termErrors, termStatus, type Bell,
} from "./logic";

describe("step progress", () => {
  it("firstOpenStep is the first unfinished step, 8 when all are done", () => {
    expect(firstOpenStep([])).toBe(1);
    expect(firstOpenStep([1, 2, 4])).toBe(3);
    expect(firstOpenStep([1, 2, 3, 4, 5, 6, 7, 8])).toBe(8);
  });
  it("markCompleted is unique, sorted and ignores out-of-range numbers", () => {
    expect(markCompleted([3, 1], 2)).toEqual([1, 2, 3]);
    expect(markCompleted([1, 2], 2)).toEqual([1, 2]);
    expect(markCompleted([1, 9, 0], 2)).toEqual([1, 2]);
  });
  it("progress and step access", () => {
    expect(progressPct([])).toBe(0);
    expect(progressPct([1, 2, 2, 9])).toBe(25);
    expect(canOpenStep(3, [1, 2])).toBe(true);
    expect(canOpenStep(4, [1, 2])).toBe(false);
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
  const ok = { name: "Sunrise Academy", short: "", board: "CBSE", affiliation: "#1930281", addressLine1: "12 School Road", addressLine2: "", country: "IN", state: "IN.16", district: "IN.16.521", city: "Pune", pin: "411001", phone: "+91 20 2345 6789", email: "office@sunrise.in", principal: "" };
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
    expect(classIdOfLabel("11-Sci-A")).toBe("cls_11A");
    expect(classIdOfLabel("LKG-A")).toBe("cls_LKGA");
  });
});

describe("4 · bell schedule", () => {
  const v: Bell = { gates: "07:45", start: "08:30", end: "14:45", periods: 8, len: 40, snackAfter: 3, snackMin: 15, lunchAfter: 5, lunchMin: 30 };
  it("builds periods with breaks after the chosen periods", () => {
    const s = buildSchedule(v);
    expect(s.rows).toHaveLength(10);
    expect(s.rows[3]).toEqual({ label: "Snack break", from: "10:30", to: "10:45", break: true });
    expect(s.endsAt).toBe(8 * 60 + 30 + 8 * 40 + 45);
  });
  it("validates times, counts, breaks and the closing time", () => {
    expect(bellError(v)).toBe("");
    expect(bellError({ ...v, start: "07:45" })).toBe("Classes must start after the gates open.");
    expect(bellError({ ...v, gates: "" })).toBe("Enter all times as HH:mm.");
    expect(bellError({ ...v, periods: 13 })).toBe("Use between 1 and 12 periods.");
    expect(bellError({ ...v, len: 15 })).toBe("Period length should be between 20 and 90 minutes.");
    expect(bellError({ ...v, lunchMin: 95 })).toBe("Breaks should be between 0 and 90 minutes.");
    expect(bellError({ ...v, snackAfter: 8 })).toBe("Breaks must come after a period and before the last one.");
    expect(bellError({ ...v, snackAfter: 8, snackMin: 0 })).toBe("");
    expect(bellError({ ...v, end: "14:00" })).toBe("The schedule runs until 14:35, past the closing time of 14:00. Shorten the periods or move closing time.");
  });
});

describe("5 · fees", () => {
  const fees = { pri: { tuition: 24000, lab: 0, activity: 2500, library: 1500 } };
  it("validates amounts, due day, late fee and payment methods", () => {
    expect(feeError(fees, 10, 2, true, false)).toBe("");
    expect(feeError({ pri: { ...fees.pri, lab: -1 } }, 10, 2, true, true)).toBe("Fees cannot be negative.");
    expect(feeError({ pri: { ...fees.pri, tuition: 0 } }, 10, 2, true, true)).toBe("Tuition must be greater than zero for every band.");
    expect(feeError({ pri: { ...fees.pri, tuition: NaN } }, 10, 2, true, true)).toBe("Fees cannot be negative.");
    expect(feeError(fees, 29, 2, true, true)).toBe("Due day should be between 1 and 28.");
    expect(feeError(fees, 0, 2, true, true)).toBe("Due day should be between 1 and 28.");
    expect(feeError(fees, 10, 11, true, true)).toBe("Late fee should be between 0% and 10%.");
    expect(feeError(fees, 10, 2, false, false)).toBe("Enable at least one online payment method.");
  });
});

describe("6 · staff", () => {
  const staff = [{ id: "stf_003", email: "a@s.in", empId: "EMP-1002" }, { id: "legacy", email: "", empId: "EMP-1003" }];
  it("ids and employee numbers", () => {
    expect(nextStaffId([])).toBe("stf_001");
    expect(nextStaffId(staff.map((s) => s.id))).toBe("stf_004");
    expect(nextEmpId(staff)).toBe("EMP-1004");
    expect(nextEmpId([])).toBe("EMP-1001");
  });
  it("new staff need a name and a unique valid email", () => {
    expect(newStaffErrors({ name: "Ravi", email: "ravi@s.in" }, staff)).toEqual({});
    expect(newStaffErrors({ name: " ", email: "ravi" }, staff)).toEqual({ name: "Enter the new staff member's name.", email: "Enter a valid email (it is the teacher's login)." });
    expect(newStaffErrors({ name: "Ravi", email: " A@S.in " }, staff)).toEqual({ email: "Another staff member already uses this email." });
  });
  it("class-teacher coverage needs staff and half of the sections", () => {
    const secs = ["5-A", "5-B", "5-C"];
    expect(allocationError(0, secs, {})).toBe("Add at least one staff member before continuing.");
    expect(allocationError(2, secs, { s1: "5-A" })).toBe("2 of 3 sections have no class teacher yet. Assign at least half to continue.");
    expect(allocationError(2, secs, { s1: "5-A", s2: "5-B" })).toBe("");
    expect(allocationError(2, secs, { s1: "5-A", s2: "5-A" })).toBe("A section can have only one class teacher.");
    expect(allocationError(1, [], {})).toBe("");
  });
});

describe("7 · student import", () => {
  it("splits quoted CSV values", () => {
    expect(splitCsvLine('"Nair, Aarav",5,A,"Mr. ""Raj"" Nair",+91 98100')).toEqual(["Nair, Aarav", "5", "A", 'Mr. "Raj" Nair', "+91 98100"]);
  });
  it("validates each row and skips the header", () => {
    const text = "name,grade,section,guardian,phone\nAarav,5,a,Mr. Nair,+91 9810011223\n,5,A,G,9810011223\nB,13,A,G,9810011223\nC,5,J,G,9810011223\nD,5,A,,9810011223\nE,5,A,G,98100\nF,Grade 3,B,G,9810011224\nG,lkg,A,G,9810011225";
    const rows = parseStudentCsv(text);
    expect(rows.map((r) => [r.line, r.error ?? "OK"])).toEqual([
      [2, "OK"], [3, "Missing name"], [4, 'Unknown grade "13"'], [5, "Section must be A–H"], [6, "Missing guardian"], [7, "Phone needs 10–13 digits"], [8, "OK"], [9, "OK"],
    ]);
    expect(rows[0]).toMatchObject({ section: "A", grade: "5" });
    expect(rows[6]).toMatchObject({ grade: "3" });
    expect(rows[7]).toMatchObject({ grade: "LKG" });
  });
  it("refuses classes that do not exist, duplicates and students already in the system", () => {
    const text = "A,5,A,G,9810011223\nA,5,A,G,+91 98100 11223\nB,5,C,G,9810011224\nC,5,B,G,9810011225";
    const rows = parseStudentCsv(text, ["cls_5A", "cls_5B"], [{ name: "c", grade: "5", section: "B", phone: "9810011225" }]);
    expect(rows.map((r) => r.error ?? "OK")).toEqual(["OK", "Duplicate of line 1", "No class 5-C (add it in step 3)", "Already in the system"]);
  });
  it("builds contract student docs with stu ids, classId and per-class rolls", () => {
    const existing = [{ id: "stu_004", name: "X", grn: "GRN-9001", grade: "5", section: "A", classId: "cls_5A", roll: 7 }];
    const docs = studentDocs(parseStudentCsv("A,5,A,G,9810011223\nB,5,B,G,9810011224\nC,5,A,G,9810011225\nbad,,,,"), existing);
    expect(docs).toEqual([
      { id: "stu_005", name: "A", grn: "GRN-9002", grade: "5", section: "A", classId: "cls_5A", roll: 8, guardian: "G", phone: "9810011223", status: "Active", attendance: 100 },
      { id: "stu_006", name: "B", grn: "GRN-9003", grade: "5", section: "B", classId: "cls_5B", roll: 1, guardian: "G", phone: "9810011224", status: "Active", attendance: 100 },
      { id: "stu_007", name: "C", grn: "GRN-9004", grade: "5", section: "A", classId: "cls_5A", roll: 9, guardian: "G", phone: "9810011225", status: "Active", attendance: 100 },
    ]);
  });
  it("is empty for empty input", () => { expect(parseStudentCsv(" \n \n")).toEqual([]); });
});

describe("8 · parent invite", () => {
  const ch = { app: true, sms: false };
  it("validates channel, message, schedule and confirmation", () => {
    expect(inviteError(ch, "Hi {link}", "now", "", true, "2026-11-03")).toBe("");
    expect(inviteError({ app: false }, "Hi {link}", "now", "", true, "2026-11-03")).toBe("Choose at least one channel.");
    expect(inviteError(ch, "  ", "now", "", true, "2026-11-03")).toBe("Write the invitation message.");
    expect(inviteError(ch, "Hi", "now", "", true, "2026-11-03")).toBe("The message must include the {link} variable so parents can sign in.");
    expect(inviteError(ch, "Hi {link}", "later", "", true, "2026-11-03")).toBe("Pick the date to send the invitations.");
    expect(inviteError(ch, "Hi {link}", "later", "2026-11-02", true, "2026-11-03")).toBe("Pick today or a later date.");
    expect(inviteError(ch, "Hi {link}", "later", "2026-11-03", true, "2026-11-03")).toBe("");
    expect(inviteError(ch, "Hi {link}", "now", "", false, "2026-11-03")).toBe("Confirm the parent contact data has been verified.");
  });
});
