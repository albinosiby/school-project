import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays, admissionsReport, ageOn, avg, buildOffer, campaignErrors, capacityError, classIdOf, computeSeatRows, csvText, daysLeft, docPatch,
  docsComplete, enquiryErrors, enrolmentStudent, intakeStats, isEmail, isPhone, nextGrn, nextRef, nextRoll, nextStudentId, offerBlocker,
  overviewStats, pct, rankValue, reenrolRows, resultPatch, scoreError, sectionFor, slotBatch, slotEligible, slotError, slug, stageMoveError,
  submissionBlocker, tokenFor, validateAnswers, validateFieldDef, wingOf,
} from "./logic";
import { downloadCsv } from "./lib";
import type { Application, Enquiry, FormSection, Offer, Seat } from "./types";

const app = (p: Partial<Application> = {}): Application => ({
  id: "a1", ref: "APP-2026-0001", enquiryId: "", name: "Riya Sen", gender: "Female", dob: "2019-05-01", guardian: "Mr. Sen", phone: "9810000001", email: "sen@x.in",
  grade: "1", tag: "general", status: "verified", submittedAt: "2026-10-01", feePaid: true, feeMode: "UPI",
  docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "na" }, testSlotId: "", interviewSlotId: "", writtenScore: null,
  panelStatus: null, panelist: "", waitlistNo: 0, offerId: "", notes: "", ...p,
});
const offer = (p: Partial<Offer> = {}): Offer => ({
  id: "o1", ref: "OFF-2026-0801", applicationId: "a1", name: "Riya Sen", guardian: "Mr. Sen", phone: "9810000001", grade: "1",
  issuedAt: "2026-10-10", expiresAt: "2026-10-17", status: "pending", tokenPaid: 0, tokenPaidAt: "", studentId: "", reason: "", ...p,
});
const enq = (p: Partial<Enquiry> = {}): Enquiry => ({
  id: "e1", ref: "ENQ-2026-0001", name: "Riya Sen", grade: "1", dob: "2019-05-01", prevSchool: "", guardian: "Mr. Sen", relation: "Father", phone: "9810000001",
  email: "sen@x.in", area: "", source: "Walk-In", stage: "new", assignee: "", followUp: "", note: "", sibling: false, createdAt: "2026-10-01", applicationId: "", lostReason: "", ...p,
});
const seat = (p: Partial<Seat> = {}): Seat => ({ id: "s1", grade: "1", group: "primary", capacity: 2, rteSeats: 1, block: "B", ...p });

afterEach(() => { vi.useRealTimers(); });

describe("small helpers", () => {
  it("pct rounds to one decimal and guards a zero denominator", () => {
    expect(pct(1, 3)).toBe(33.3);
    expect(pct(2, 3)).toBe(66.7);
    expect(pct(5, 0)).toBe(0);
  });
  it("addDays crosses month and year ends", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
  it("nextRef goes one above the highest suffix, ignores junk and pads to 4", () => {
    expect(nextRef("ENQ", [])).toBe("ENQ-2026-0001");
    expect(nextRef("ENQ", [{ ref: "ENQ-2026-0009" }, { ref: "ENQ-2026-0003" }, { ref: "bad" }])).toBe("ENQ-2026-0010");
    expect(nextRef("OFF", [], 801)).toBe("OFF-2026-0801");
    expect(nextRef("OFF", [{ ref: "OFF-2026-0805" }], 801, 2027)).toBe("OFF-2027-0806");
  });
  it("isPhone accepts 10–13 digits with +, spaces and dashes only", () => {
    expect(isPhone("+91 98452 31209")).toBe(true);
    expect(isPhone("98452-31209")).toBe(true);
    expect(isPhone("----------")).toBe(false);
    expect(isPhone("98452")).toBe(false);
    expect(isPhone("98452a31209")).toBe(false);
    expect(isPhone("12345678901234")).toBe(false);
  });
  it("isEmail needs a local part, an @ and a dotted domain", () => {
    expect(isEmail(" a@b.co ")).toBe(true);
    expect(isEmail("a@b")).toBe(false);
    expect(isEmail("a b@c.de")).toBe(false);
    expect(isEmail("")).toBe(false);
  });
  it("ageOn counts completed months and rejects bad dates", () => {
    expect(ageOn("2020-04-15", new Date("2026-03-31"))).toEqual({ years: 5, months: 11, total: 71 });
    expect(ageOn("2020-03-31", new Date("2026-03-31"))).toEqual({ years: 6, months: 0, total: 72 });
    expect(ageOn("not-a-date")).toBeNull();
    expect(ageOn("")).toBeNull();
  });
  it("avg rounds to one decimal and is 0 for no values", () => {
    expect(avg([])).toBe(0);
    expect(avg([1, 2, 2])).toBe(1.7);
  });
  it("slug makes a lowercase identifier", () => {
    expect(slug("Blood Group (optional)")).toBe("blood_group_optional");
    expect(slug("!!!")).toBe("field");
  });
});

describe("CSV", () => {
  it("quotes commas, quotes and newlines and blanks nullish values", () => {
    expect(csvText([["a", 'He said "hi"', "x,y", "line1\nline2", null, undefined, 3, false]]))
      .toBe('a,"He said ""hi""","x,y","line1\nline2",,,3,false');
    expect(csvText([["h1", "h2"], ["1", "2"]])).toBe("h1,h2\n1,2");
    expect(csvText([["cr\r"]])).toBe('"cr\r"');
  });
  it("downloadCsv saves exactly that text as a CSV blob", async () => {
    let blob: Blob | null = null;
    vi.spyOn(URL, "createObjectURL").mockImplementation((b) => { blob = b as Blob; return "blob:x"; });
    downloadCsv("t.csv", [["Name", "Note"], ["A, B", 'say "x"']]);
    expect(blob!.type).toBe("text/csv;charset=utf-8");
    expect(await blob!.text()).toBe('Name,Note\n"A, B","say ""x"""');
  });
});

describe("seat maths", () => {
  it("counts enrolled + live offers as held and never counts an enrolled offer twice", () => {
    const apps = [app({ id: "a1", status: "enrolled", tag: "rte" }), app({ id: "a2", status: "offered", tag: "sibling" }), app({ id: "a3", status: "waitlisted" }), app({ id: "a4", status: "offered" })];
    const offers = [offer({ id: "o1", applicationId: "a1", status: "enrolled" }), offer({ id: "o2", applicationId: "a2", status: "pending" }), offer({ id: "o4", applicationId: "a4", status: "declined" })];
    const [r] = computeSeatRows([seat({ capacity: 3 })], apps, offers);
    expect(r).toMatchObject({ enrolled: 1, held: 2, free: 1, rte: 1, sib: 1, gen: 0, waitlisted: 1 });
  });
  it("orders rows like GRADES, skips unconfigured grades and allows a negative free count", () => {
    const rows = computeSeatRows([seat({ id: "s5", grade: "5", capacity: 1 }), seat({ id: "sN", grade: "Nursery", capacity: 0 })], [app({ grade: "5", status: "enrolled" }), app({ id: "a2", grade: "5", status: "enrolled" })], []);
    expect(rows.map((r) => r.grade)).toEqual(["Nursery", "5"]);
    expect(rows[1]!.free).toBe(-1);
    expect(computeSeatRows([], [app()], [])).toEqual([]);
  });
  it("capacityError: whole numbers, not below held, RTE within capacity", () => {
    expect(capacityError(5, "10", "2")).toBe("");
    expect(capacityError(5, "5", "5")).toBe("");
    expect(capacityError(5, "4", "0")).toBe("Capacity cannot be below 5 (enrolled + live offers)");
    expect(capacityError(0, "", "0")).toBe("Capacity must be a whole number");
    expect(capacityError(0, "-1", "0")).toBe("Capacity must be a whole number");
    expect(capacityError(0, "2.5", "0")).toBe("Capacity must be a whole number");
    expect(capacityError(0, "10", "-1")).toBe("RTE seats must be a whole number");
    expect(capacityError(0, "10", "11")).toBe("RTE seats cannot exceed capacity");
  });
  it("rankValue puts RTE > sibling > staff > general, then score", () => {
    const xs = [app({ id: "g", tag: "general", writtenScore: 99 }), app({ id: "s", tag: "staff", writtenScore: 10 }), app({ id: "r", tag: "rte", writtenScore: 0 }), app({ id: "b", tag: "sibling", writtenScore: 50 })];
    expect(xs.sort((a, b) => rankValue(b) - rankValue(a)).map((a) => a.id)).toEqual(["r", "b", "s", "g"]);
  });
});

describe("applications", () => {
  it("docsComplete treats verified and na as done", () => {
    expect(docsComplete(app())).toBe(true);
    expect(docsComplete(app({ docs: { birth: "pending", idProof: "verified", immunisation: "verified", tc: "na" } }))).toBe(false);
  });
  it("docPatch moves submitted → docs_pending → verified and back", () => {
    const pending = { birth: "pending", idProof: "pending", immunisation: "pending", tc: "na" } as const;
    expect(docPatch(app({ status: "submitted", docs: { ...pending } }), "birth", "verified")).toMatchObject({ status: "docs_pending" });
    expect(docPatch(app({ status: "submitted", docs: { ...pending } }), "birth", "rejected").status).toBeUndefined();
    expect(docPatch(app({ status: "docs_pending", docs: { ...pending, birth: "verified", idProof: "verified" } }), "immunisation", "verified")).toMatchObject({ status: "verified" });
    expect(docPatch(app({ status: "verified" }), "birth", "rejected")).toMatchObject({ status: "docs_pending" });
    // later stages are not touched
    expect(docPatch(app({ status: "shortlisted" }), "birth", "rejected").status).toBeUndefined();
  });
  it("stageMoveError guards verified / test / scored stages and offer-managed applications", () => {
    expect(stageMoveError(app({ status: "submitted", docs: { birth: "pending", idProof: "verified", immunisation: "verified", tc: "na" } }), "verified")).toBe("Verify every required document first");
    expect(stageMoveError(app({ status: "submitted" }), "verified")).toBe("");
    expect(stageMoveError(app(), "test_scheduled")).toBe("Assign a test slot under Tests & Interviews first");
    expect(stageMoveError(app({ testSlotId: "slot1" }), "test_scheduled")).toBe("");
    expect(stageMoveError(app(), "shortlisted")).toBe("Enter the written score under Tests & Interviews first");
    expect(stageMoveError(app({ writtenScore: 70 }), "shortlisted")).toBe("");
    expect(stageMoveError(app(), "rejected")).toBe("");
    expect(stageMoveError(app({ status: "offered" }), "rejected")).toBe("This application is managed in Offer & Enrolment");
    expect(stageMoveError(app(), "enrolled")).toBe("This stage is set by the offer flow");
  });
});

describe("offers", () => {
  const rows = computeSeatRows([seat({ capacity: 1 })], [], []);
  it("offerBlocker: no matrix, active offer, no free seat", () => {
    expect(offerBlocker(app({ grade: "9" }), rows, [])).toBe("No seat matrix configured for this grade");
    expect(offerBlocker(app(), rows, [offer({ status: "accepted" })])).toBe("An active offer already exists");
    expect(offerBlocker(app(), computeSeatRows([seat({ capacity: 0 })], [], []), [])).toBe("No free seat in Grade 1 — increase capacity or release an offer");
    expect(offerBlocker(app(), rows, [offer({ status: "declined" })])).toBe("");
  });
  it("buildOffer: ref from 801, expiry = issue + validity (default 7), pending with no token", () => {
    expect(buildOffer(app(), [], "2026-10-28")).toEqual({ ref: "OFF-2026-0801", applicationId: "a1", name: "Riya Sen", guardian: "Mr. Sen", phone: "9810000001", grade: "1",
      issuedAt: "2026-10-28", expiresAt: "2026-11-04", status: "pending", tokenPaid: 0, tokenPaidAt: "", studentId: "", reason: "" });
    expect(buildOffer(app(), [{ ref: "OFF-2026-0810" }], "2026-10-28", 14)).toMatchObject({ ref: "OFF-2026-0811", expiresAt: "2026-11-11" });
    expect(buildOffer(app(), [], "2026-10-28", 0).expiresAt).toBe("2026-11-04");
    expect(buildOffer(app(), [], "2026-10-28", -3).expiresAt).toBe("2026-11-04");
  });
  it("tokenFor uses the configured amount, 0 included, else 50,000", () => {
    expect(tokenFor(25000)).toBe(25000);
    expect(tokenFor(0)).toBe(0);
    expect(tokenFor(undefined)).toBe(50000);
    expect(tokenFor(-1)).toBe(50000);
  });
  it("daysLeft is negative once expired", () => {
    expect(daysLeft("2026-11-05", "2026-11-03")).toBe(2);
    expect(daysLeft("2026-11-03", "2026-11-03")).toBe(0);
    expect(daysLeft("2026-11-01", "2026-11-03")).toBe(-2);
  });
});

describe("tests & interviews", () => {
  it("scoreError bounds 0–100 and requires a value", () => {
    expect(scoreError("")).toBe("Enter the written score");
    expect(scoreError("0")).toBe("");
    expect(scoreError("100")).toBe("");
    expect(scoreError("72.5")).toBe("");
    expect(scoreError("100.5")).toBe("Enter a number between 0 and 100");
    expect(scoreError("-1")).toBe("Enter a number between 0 and 100");
    expect(scoreError("abc")).toBe("Enter a number between 0 and 100");
    expect(scoreError("1e2")).toBe("Enter a number between 0 and 100");
  });
  it("resultPatch maps panel outcome to the stage and numbers the waitlist per grade", () => {
    const others = [app({ id: "w1", status: "waitlisted", waitlistNo: 3 }), app({ id: "w2", grade: "2", status: "waitlisted", waitlistNo: 9 })];
    expect(resultPatch(app(), 88, "cleared", others)).toEqual({ writtenScore: 88, panelStatus: "cleared", status: "shortlisted" });
    expect(resultPatch(app(), 40, "rejected", others)).toMatchObject({ status: "rejected" });
    expect(resultPatch(app(), 60, "in_review", others)).toMatchObject({ status: "tested" });
    expect(resultPatch(app(), 61, "waitlisted", others)).toMatchObject({ status: "waitlisted", waitlistNo: 4 });
    expect(resultPatch(app({ waitlistNo: 2 }), 61, "waitlisted", others).waitlistNo).toBeUndefined();
    expect(resultPatch(app({ status: "offered" }), 90, "cleared", others)).toEqual({ writtenScore: 90, panelStatus: "cleared" });
  });
  it("slotError checks required fields, past dates, time and capacity", () => {
    const ok = { title: "G1 test", type: "test", date: "2026-11-10", time: "09:30", venue: "Hall", capacity: "40", invigilator: "" };
    expect(slotError(ok, "2026-11-03")).toBe("");
    expect(slotError({ ...ok, title: " " }, "2026-11-03")).toBe("Title, date and venue are required");
    expect(slotError({ ...ok, date: "2026-11-02" }, "2026-11-03")).toBe("Date cannot be in the past");
    expect(slotError({ ...ok, date: "2026-11-03" }, "2026-11-03")).toBe("");
    expect(slotError({ ...ok, time: "" }, "2026-11-03")).toBe("Enter a start time (HH:mm)");
    expect(slotError({ ...ok, capacity: "0" }, "2026-11-03")).toBe("Capacity must be a whole number of at least 1");
    expect(slotError({ ...ok, capacity: "2.5" }, "2026-11-03")).toBe("Capacity must be a whole number of at least 1");
  });
  it("slotBatch numbers tests and interview panels separately", () => {
    expect(slotBatch("test", [])).toBe("BATCH #01");
    expect(slotBatch("test", [{ type: "test" }, { type: "interview" }])).toBe("BATCH #02");
    expect(slotBatch("interview", [{ type: "test" }, { type: "interview" }])).toBe("PANEL B");
  });
  it("slotEligible: tests take fee-paid verified/doc-pending without a test; interviews take tested/shortlisted", () => {
    const xs = [app({ id: "ok" }), app({ id: "unpaid", feePaid: false }), app({ id: "booked", testSlotId: "x" }), app({ id: "dp", status: "docs_pending" }), app({ id: "t", status: "tested" }), app({ id: "sl", status: "shortlisted", interviewSlotId: "p" })];
    expect(slotEligible({ type: "test" }, xs).map((a) => a.id)).toEqual(["ok", "dp"]);
    expect(slotEligible({ type: "interview" }, xs).map((a) => a.id)).toEqual(["t"]);
  });
});

describe("enrolment → students (contract section 3)", () => {
  const students = [
    { id: "stu_001", name: "A", grn: "GIS-8801", grade: "1", section: "A", classId: "cls_1A", roll: 1 },
    { id: "stu_009", name: "B", grn: "GIS-8809", grade: "1", section: "A", roll: 4 },
    { id: "legacy_x", name: "C", grn: "GIS-8805", grade: "1", section: "B", classId: "cls_1B", roll: 2 },
  ];
  it("ids, rolls and GRNs go one above the highest in use", () => {
    expect(nextStudentId([])).toBe("stu_001");
    expect(nextStudentId(students.map((s) => s.id))).toBe("stu_010");
    expect(nextStudentId(["stu_1234"])).toBe("stu_1235");
    expect(nextRoll(students, "cls_1A")).toBe(5);
    expect(nextRoll(students, "cls_9C")).toBe(1);
    expect(nextGrn(students)).toBe("GIS-8810");
    expect(nextGrn([])).toBe("GIS-8801");
    expect(classIdOf("10", "b")).toBe("cls_10B");
  });
  it("sectionFor picks the smallest existing class of the grade, else A", () => {
    const classes = [{ id: "cls_1A", grade: "1", section: "A" }, { id: "cls_1B", grade: "1", section: "B" }, { id: "cls_1C", grade: "1", section: "C" }];
    expect(sectionFor("1", classes, students)).toBe("C");
    expect(sectionFor("1", classes.slice(0, 2), students)).toBe("B");
    expect(sectionFor("7", classes, students)).toBe("A");
  });
  it("builds the contract-exact student doc from the offer, application and enquiry", () => {
    const d = enrolmentStudent(offer({ status: "accepted", grade: "11-Science", name: " Riya Sen " }), app({ email: " sen@x.in " }), enq({ relation: "Mother" }), students, [], "2026-11-03");
    expect(d).toEqual({
      id: "stu_010", name: "Riya Sen", grn: "GIS-8810", grade: "11", section: "A", classId: "cls_11A", roll: 1, guardian: "Mr. Sen", phone: "9810000001",
      status: "Active", attendance: 100, admissionDate: "2026-11-03", offerId: "o1", dob: "2019-05-01", gender: "Female", relation: "Mother", guardianEmail: "sen@x.in",
    });
    expect(typeof d.roll).toBe("number");
    expect(typeof d.grade).toBe("string");
  });
  it("omits optional fields that are unknown", () => {
    const d = enrolmentStudent(offer(), undefined, undefined, [], [], "2026-11-03");
    expect(d).not.toHaveProperty("dob");
    expect(d).not.toHaveProperty("guardianEmail");
    expect(d).toMatchObject({ id: "stu_001", classId: "cls_1A", roll: 1, grade: "1", section: "A" });
  });
});

describe("form builder field rule", () => {
  it("requires a label", () => {
    expect(validateFieldDef({ label: "  ", type: "text", key: "" }, "", [], true)).toEqual({ error: "Label is required" });
  });
  it("needs two distinct options for dropdowns and radios", () => {
    expect(validateFieldDef({ label: "House", type: "select", key: "" }, "Red", [], true)).toEqual({ error: "Add at least two options (one per line)" });
    expect(validateFieldDef({ label: "House", type: "radio", key: "" }, "Red\n red \nRed", [], true)).toEqual({ error: "Add at least two options (one per line)" });
    expect(validateFieldDef({ label: "House", type: "select", key: "" }, " Red \n\nBlue", [], true)).toEqual({ label: "House", key: "house", options: ["Red", "Blue"] });
  });
  it("slugs the key, suffixes a generated duplicate and refuses an explicit duplicate", () => {
    expect(validateFieldDef({ label: "Blood Group", type: "text", key: "" }, "", ["name"], true)).toEqual({ label: "Blood Group", key: "blood_group", options: undefined });
    expect(validateFieldDef({ label: "Name", type: "text", key: "" }, "", ["name", "name_2"], true)).toMatchObject({ key: "name_3" });
    expect(validateFieldDef({ label: "Other", type: "text", key: "name" }, "", ["name"], true)).toEqual({ error: 'Another field already uses the key "name"' });
    expect(validateFieldDef({ label: "Other", type: "text", key: "9lives" }, "", [], true)).toEqual({ error: "Key must start with a letter and use only letters, digits and _" });
    // editing keeps its own key (callers pass the other fields' keys)
    expect(validateFieldDef({ label: "Renamed", type: "text", key: "phone" }, "", ["name"], false)).toMatchObject({ key: "phone", label: "Renamed" });
  });
});

describe("dynamic form answers", () => {
  const sections: FormSection[] = [{ id: "s", title: "S", description: "", mandatory: true, fields: [
    { id: "1", key: "name", label: "Student Full Name", type: "text", required: true },
    { id: "2", key: "phone", label: "WhatsApp Number", type: "tel", required: true },
    { id: "3", key: "email", label: "Email", type: "email", required: false },
    { id: "4", key: "aadhaar", label: "Aadhaar", type: "text", required: false },
    { id: "5", key: "dob", label: "DOB", type: "date", required: false },
    { id: "6", key: "siblings", label: "Siblings", type: "number", required: false },
    { id: "7", key: "grade", label: "Grade", type: "select", required: false, options: ["Grade 1", "Grade 2"] },
  ] }];
  const now = new Date("2026-11-03T10:00:00");
  it("reports required fields with the field label", () => {
    expect(validateAnswers(sections, {}, now)).toEqual({ name: "Student Full Name is required", phone: "WhatsApp Number is required" });
    expect(validateAnswers(sections, { name: "  ", phone: "9810000001" }, now)).toEqual({ name: "Student Full Name is required" });
  });
  it("checks formats only when a value is given", () => {
    expect(validateAnswers(sections, { name: "A", phone: "123", email: "x@", aadhaar: "1234", dob: "2026-11-04", siblings: "two", grade: "Grade 9" }, now)).toEqual({
      phone: "Enter a valid mobile number", email: "Enter a valid email address", aadhaar: "Aadhaar must be 12 digits", dob: "Date cannot be in the future", siblings: "Enter a number", grade: "Choose one of the options",
    });
    expect(validateAnswers(sections, { name: "A", phone: "+91 98100 00001", email: "a@b.in", aadhaar: "1234 5678 9012", dob: "2026-11-03", siblings: "1", grade: "Grade 2" }, now)).toEqual({});
    expect(validateAnswers(sections, { name: "A", phone: "9810000001", dob: "31/12/2020" }, now)).toEqual({ dob: "Enter a valid date" });
  });
});

describe("public form submissions", () => {
  const web = (p: Partial<Enquiry>) => enq({ source: "Website Form", ...p });
  it("closes the form at the cap", () => {
    expect(submissionBlocker({ name: "X" }, [web({ id: "w1" }), web({ id: "w2" }), enq({ id: "walk" })], 2, false)).toBe("Online submissions are closed for now (cap reached). Please contact the admissions office.");
    expect(submissionBlocker({ name: "X" }, [web({ id: "w1" }), enq({ id: "walk" })], 2, false)).toBe("");
  });
  it("dedupe matches DOB + Aadhaar digits, or DOB + name + phone digits (case/space-insensitive)", () => {
    const rows = [web({ ref: "ENQ-2026-0007", name: "Riya Sen", phone: "+91 98100-00001", dob: "2019-05-01", answers: { aadhaar: "1234 5678 9012" } })];
    expect(submissionBlocker({ name: "Other", phone: "1", dob: "2019-05-01", aadhaar: "123456789012" }, rows, 10, true)).toBe("An enquiry for this child already exists (ENQ-2026-0007).");
    expect(submissionBlocker({ name: " riya sen ", phone: "9810000001", dob: "2019-05-01" }, rows, 10, true)).toBe("An enquiry for this child already exists (ENQ-2026-0007).");
    expect(submissionBlocker({ name: "Riya Sen", phone: "9810000001", dob: "2019-05-02" }, rows, 10, true)).toBe("");
    expect(submissionBlocker({ name: "Riya Sen", phone: "9810000001", dob: "2019-05-01" }, rows, 10, false)).toBe("");
  });
  it("intakeStats counts website submissions today and by hour", () => {
    const s = intakeStats([web({ id: "1", createdAt: "2026-11-03", submittedTs: "2026-11-03T09:15:00.000Z" }), web({ id: "2", createdAt: "2026-11-02", submittedTs: "2026-11-02T09:59:00Z" }), enq({ id: "3", createdAt: "2026-11-03", submittedTs: "2026-11-03T09:00:00Z" }), web({ id: "4", createdAt: "2026-11-03" })], "2026-11-03");
    expect(s.web).toBe(3);
    expect(s.today).toBe(2);
    expect(s.hourly[9]).toBe(2);
    expect(s.hourly.reduce((a, b) => a + b, 0)).toBe(2);
  });
});

describe("re-enrolment rows", () => {
  it("maps grades to wings", () => {
    expect(["Nursery", "LKG", "5", "6", "8", "9", "10", "11", "11-Science", "12"].map(wingOf)).toEqual(["pre-primary", "pre-primary", "pre-primary", "middle", "middle", "secondary", "secondary", "senior", "senior", "senior"]);
  });
  it("lists active students with defaults, applies overlays and keeps orphan legacy rows", () => {
    const students = [
      { id: "stu_001", name: "A", grn: "GIS-1", grade: "9", section: "B", guardian: "G", phone: "1", status: "Active", bus: "Bus 14" },
      { id: "stu_002", name: "B", grade: "3", section: "A", status: "Active" },
      { id: "stu_003", name: "Left", grade: "3", section: "A", status: "Inactive" },
    ];
    const overlays = [
      { id: "stu_002", studentId: "stu_002", status: "confirmed" as const, fee: "paid" as const, stream: "Primary Core" },
      { id: "stu_003", status: "exit" as const },
      { id: "adm_re_1", name: "Old", admNo: "GIS-0", grade: "5", section: "A", wing: "pre-primary" as const, stream: "", transport: "Self / Walker", status: "pending" as const, fee: "due" as const, guardian: "", phone: "", reason: "", confirmedAt: "" },
    ];
    const rows = reenrolRows(students, overlays);
    expect(rows.map((r) => r.id)).toEqual(["stu_001", "stu_002", "adm_re_1"]);
    expect(rows[0]).toMatchObject({ admNo: "GIS-1", wing: "secondary", status: "pending", fee: "due", transport: "Bus 14", stream: "" });
    expect(rows[1]).toMatchObject({ status: "confirmed", fee: "paid", stream: "Primary Core", transport: "Self / Walker", wing: "pre-primary" });
  });
  it("campaignErrors: name, dates in order, whole fee", () => {
    expect(campaignErrors({ name: "Drive", opensAt: "2026-11-01", closesAt: "2026-12-01", fee: "0" })).toEqual({});
    expect(campaignErrors({ name: " ", opensAt: "", closesAt: "", fee: "" })).toEqual({ name: "Required", opensAt: "Required", closesAt: "Required", fee: "Enter a whole amount of 0 or more" });
    expect(campaignErrors({ name: "D", opensAt: "2026-11-02", closesAt: "2026-11-01", fee: "-5" })).toEqual({ closesAt: "Must be after opening", fee: "Enter a whole amount of 0 or more" });
    expect(campaignErrors({ name: "D", opensAt: "2026-11-02", closesAt: "2026-11-02", fee: "12.5" })).toEqual({ fee: "Enter a whole amount of 0 or more" });
  });
});

describe("report and overview figures", () => {
  const E = [enq({ id: "e1", createdAt: "2026-10-01", source: "Referral", stage: "enrolled" }), enq({ id: "e2", createdAt: "2026-10-05", source: "Referral" }), enq({ id: "e3", createdAt: "2026-09-01", source: "Fair X" })];
  const A = [app({ id: "a1", enquiryId: "e1", submittedAt: "2026-10-03", status: "enrolled", testSlotId: "t", writtenScore: 70, gender: "Male", tag: "sibling", docs: { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } }),
    app({ id: "a2", enquiryId: "e2", submittedAt: "2026-10-09", status: "waitlisted", testSlotId: "t", writtenScore: 50, tag: "sibling" })];
  const O = [offer({ id: "o1", applicationId: "a1", issuedAt: "2026-10-13", tokenPaidAt: "2026-10-15", status: "enrolled", tokenPaid: 50000 })];
  const rows = computeSeatRows([seat({ capacity: 4, rteSeats: 1 })], A, O);
  it("computes the funnel and stage velocity", () => {
    const d = admissionsReport(E, A, O, rows, { Referral: 10000 });
    expect(d.funnel.map((f) => f.v)).toEqual([3, 2, 2, 1, 1]);
    expect(d.funnel[1]!.sub).toBe("66.7% of enquiries");
    expect(d.funnel[2]!.sub).toBe("1 pass (≥60)");
    expect([d.e2a, d.a2o, d.o2e]).toEqual([3, 10, 2]);
    expect(d.sources[0]).toEqual({ s: "Referral", leads: 2, enr: 1, conv: 50, cac: 10000, sp: 10000 });
    expect(d.sources.some((s) => s.s === "Fair X" && s.leads === 1)).toBe(true);
    expect(d.months).toEqual([["2026-10", 2]]);
    expect(d).toMatchObject({ cap: 4, conf: 1, spendTotal: 10000, rteQuota: 1, boys: 1, girls: 0, sib: 1, sibApps: 2, enrolledN: 1, tcN: 1 });
    expect(d.wings.find((w) => w.id === "primary")).toMatchObject({ cap: 4, conf: 1, held: 1, wl: 1, yield: 25 });
  });
  it("is all zeros for an empty school", () => {
    const d = admissionsReport([], [], [], []);
    expect(d.funnel.map((f) => f.v)).toEqual([0, 0, 0, 0, 0]);
    expect(d.funnel[0]!.sub).toBe("Avg 0d to apply");
    expect(d.cap).toBe(0);
  });
  it("overviewStats: growth vs the previous 30 days, conversion, fees and tokens", () => {
    const s = overviewStats(E, A, O, rows, 2500, "2026-10-20");
    expect(s).toMatchObject({ total: 3, growth: 100, unassigned: 2, apps: 2, conv: 66.7, fees: 5000, tested: 2, avgScore: 60, offers: 1, accept: 100, waitlist: 1, enrolled: 1, cap: 4, token: 50000 });
    expect(overviewStats(E, A, O, rows, 2500, "2026-11-25").growth).toBe(-100);
  });
});

describe("enquiry form rule", () => {
  const ok = { name: "Riya", grade: "1", dob: "2019-05-01", guardian: "Mr. Sen", phone: "9810000001", email: "a@b.in", followUp: "" };
  it("accepts a complete enquiry", () => { expect(enquiryErrors(ok, "2026-11-03")).toEqual({}); });
  it("lists every problem at once", () => {
    expect(enquiryErrors({ name: "", grade: "13", dob: "", guardian: " ", phone: "12", email: "x", followUp: "2026-11-02" }, "2026-11-03")).toEqual({
      name: "Student name is required", grade: "Choose a grade", dob: "Date of birth is required", guardian: "Guardian name is required",
      phone: "Enter a valid mobile number", email: "Enter a valid email", followUp: "Follow-up date cannot be in the past",
    });
    expect(enquiryErrors({ ...ok, dob: "2026-11-04" }, "2026-11-03")).toEqual({ dob: "DOB cannot be in the future" });
    expect(enquiryErrors({ ...ok, followUp: "2026-11-03" }, "2026-11-03")).toEqual({});
  });
});
