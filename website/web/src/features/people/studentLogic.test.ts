import { describe, expect, it } from "vitest";
import {
  buildSlots, certFileError, issueError, leaveDays, leaveStatus, nextCertRef, nextGrn, nextRoll, nextStudentId, ptmSlotId, slotStartMs, slotStamp,
  slotsOverlap, studentClassId, validMeetLink, validPhone, validateStudent, MAX_CERT_FILE, type SlotForm, type StudentFormValues,
} from "./studentLogic";
import { consentMap, consentState, normEmail, validEmail, type Consent } from "@/lib/parentAccount";

describe("nextStudentId", () => {
  it("starts at stu_001 and zero-pads to 3 digits", () => {
    expect(nextStudentId([])).toBe("stu_001");
    expect(nextStudentId(["stu_009"])).toBe("stu_010");
  });
  it("continues after the highest id, not the count (gaps after deletes stay free)", () => {
    expect(nextStudentId(["stu_001", "stu_105", "stu_003"])).toBe("stu_106");
  });
  it("grows past 3 digits and ignores ids of other shapes", () => {
    expect(nextStudentId(["stu_999"])).toBe("stu_1000");
    expect(nextStudentId(["stf_500", "stu_abc", "x_stu_900", "stu_002"])).toBe("stu_003");
  });
});

describe("studentClassId / nextRoll", () => {
  it("uses the stored classId, else derives cls_{grade}{SECTION}", () => {
    expect(studentClassId({ classId: "cls_10B", grade: "9", section: "A" })).toBe("cls_10B");
    expect(studentClassId({ grade: "10", section: "b" })).toBe("cls_10B");
    expect(studentClassId({ grade: 8, section: "D" })).toBe("cls_8D");
  });
  it("next roll is the class's highest + 1, skipping the edited and deleted students", () => {
    const rows = [
      { id: "a", classId: "cls_6A", roll: 1 }, { id: "b", grade: "6", section: "A", roll: 4 }, { id: "c", classId: "cls_6B", roll: 9 },
      { id: "d", classId: "cls_6A", roll: 7, deleted: true },
    ];
    expect(nextRoll(rows, "cls_6A")).toBe(5);
    expect(nextRoll(rows, "cls_6A", "b")).toBe(2);
    expect(nextRoll(rows, "cls_12D")).toBe(1);
  });
});

describe("validPhone / nextGrn", () => {
  it.each([["+91 98100 00025", true], ["9810000099", true], ["011-2345-6789", true], ["+1234567", false], ["12ab", false], ["", false], ["98100 0002", false], ["+91 98100 00025 1234", false]])(
    "validPhone(%s) = %s", (p, ok) => expect(validPhone(p)).toBe(ok));
  it("auto GRN skips taken numbers, case-insensitively", () => {
    expect(nextGrn([])).toBe("GIS-8801");
    expect(nextGrn([{ id: "a", grn: "gis-8802" }, { id: "b", grn: "GIS-8803" }])).toBe("GIS-8804");
    expect(nextGrn([{ id: "a", grn: "GIS-8802" }], "a")).toBe("GIS-8802");
  });
});

const form = (p: Partial<StudentFormValues> = {}): StudentFormValues => ({ name: "Riya Shah", grn: "", grade: "6", section: "A", roll: "", guardian: "Mr. Shah", relation: "Father",
  phone: "+91 98100 00011", email: "", guardianEmail: "", dob: "", address: "", status: "Active", attendance: 100, ...p });

describe("validateStudent", () => {
  const existing = [{ id: "stu_001", name: "A", grn: "GIS-1", classId: "cls_6A", grade: "6", section: "A", roll: 3 }, { id: "stu_002", name: "B", grn: "GIS-2", grade: "7", section: "B", roll: 1 }];
  const today = "2026-11-03";
  it("builds the contract doc: classId, int roll, trimmed fields, lower-case login email", () => {
    const r = validateStudent(form({ name: "  Riya Shah ", guardianEmail: " Parent@Mail.COM " }), { existing, today });
    expect(r.errors).toEqual({});
    expect(r.doc).toMatchObject({ name: "Riya Shah", grade: "6", section: "A", classId: "cls_6A", roll: 4, guardianEmail: "parent@mail.com", grn: "GIS-8803", attendance: 100 });
  });
  it("rejects a typed roll that is not a whole number 1–999 or is taken in the class", () => {
    expect(validateStudent(form({ roll: "2.5" }), { existing, today }).errors.roll).toBe("Enter a whole number from 1 to 999");
    expect(validateStudent(form({ roll: "0" }), { existing, today }).errors.roll).toBe("Enter a whole number from 1 to 999");
    expect(validateStudent(form({ roll: "3" }), { existing, today }).errors.roll).toBe("Roll 3 is already used in 6-A");
    expect(validateStudent(form({ roll: "1", grade: "7", section: "B" }), { existing, today }).errors.roll).toBe("Roll 1 is already used in 7-B");
    expect(validateStudent(form({ roll: "12" }), { existing, today }).doc?.roll).toBe(12);
  });
  it("keeps the roll when the class is unchanged and renumbers on a class change", () => {
    const edit = existing[1]!; // legacy row: no classId
    expect(validateStudent(form({ grade: "7", section: "B", grn: "GIS-2" }), { existing, edit, today }).doc).toMatchObject({ roll: 1, classId: "cls_7B" });
    expect(validateStudent(form({ grade: "6", section: "A", grn: "GIS-2" }), { existing, edit, today }).doc).toMatchObject({ roll: 4, classId: "cls_6A" });
  });
  it("flags a duplicate GRN (case-insensitive) but not the student's own", () => {
    expect(validateStudent(form({ grn: "gis-1" }), { existing, today }).errors.grn).toBe("GRN already exists");
    expect(validateStudent(form({ grn: "GIS-1" }), { existing, edit: existing[0], today }).errors.grn).toBeUndefined();
  });
  it("keeps a soft-deleted student's GRN reserved (fees are keyed by grn) but frees its roll", () => {
    const rows = [...existing, { id: "stu_003", grn: "GIS-3", classId: "cls_6A", roll: 4, deleted: true }];
    expect(validateStudent(form({ grn: "GIS-3" }), { existing: rows, today }).errors.grn).toBe("GRN already exists");
    expect(validateStudent(form({ roll: "4" }), { existing: rows, today }).doc?.roll).toBe(4);
  });
  it("checks the required fields, phone, emails, attendance and date of birth", () => {
    const r = validateStudent(form({ name: " ", guardian: "", phone: "123", email: "a@b", guardianEmail: "x@", attendance: "101", dob: "2026-11-04" }), { existing, today });
    expect(r.errors).toEqual({ name: "Name is required", guardian: "Guardian name is required", phone: "Enter a valid phone number", email: "Enter a valid email",
      guardianEmail: "Enter a valid email", attendance: "0–100", dob: "Date of birth cannot be in the future" });
    expect(r.doc).toBeUndefined();
    expect(validateStudent(form({ attendance: "" }), { existing, today }).errors.attendance).toBe("0–100");
  });
  it("refuses a login email that belongs to a staff or admin login", () => {
    const users = [{ id: "u1", schoolId: "s", role: "teacher" as const, email: "anita@school.edu" }, { id: "u2", schoolId: "s", role: "parent" as const, email: "dad@mail.com" }];
    expect(validateStudent(form({ guardianEmail: "Anita@School.edu" }), { existing, users, today }).errors.guardianEmail).toBe("This email belongs to a staff or admin login");
    expect(validateStudent(form({ guardianEmail: "dad@mail.com" }), { existing, users, today }).errors.guardianEmail).toBeUndefined();
  });
});

describe("consentState / normEmail / validEmail", () => {
  const c = (uid: string, p: Partial<Consent> = {}): Consent => ({ id: uid, uid, ...p });
  it("None without a linked login, Given when any linked login consented, else Pending", () => {
    const m = consentMap([c("p1"), c("p2", { withdrawn: true }), { id: "p3" }]);
    expect(consentState(undefined, m)).toBe("None");
    expect(consentState([], m)).toBe("None");
    expect(consentState(["p9", "p1"], m)).toBe("Given");
    expect(consentState(["p9"], m)).toBe("Pending");
    expect(consentState(["p3"], m)).toBe("Given"); // keyed by doc id when uid is missing
  });
  it("a withdrawn consent counts as not given", () => {
    expect(consentState(["p2"], consentMap([c("p2", { withdrawn: true })]))).toBe("Pending");
  });
  it("normalises and validates emails", () => {
    expect(normEmail("  Mixed@Case.COM ")).toBe("mixed@case.com");
    expect(validEmail("a@b.co")).toBe(true);
    expect(validEmail(" a@b.co ")).toBe(true);
    for (const bad of ["", "a@b", "a b@c.d", "@b.co", "a@@b.co", "a@b."]) expect(validEmail(bad)).toBe(false);
  });
});

describe("leaveDays / leaveStatus", () => {
  it("counts inclusive days, one day without `to`", () => {
    expect(leaveDays("2026-10-28", "2026-10-29")).toBe(2);
    expect(leaveDays("2026-10-28")).toBe(1);
    expect(leaveDays("2026-10-28", "2026-10-28")).toBe(1);
    expect(leaveDays("2026-02-27", "2026-03-02")).toBe(4);
  });
  it("is 0 for missing / invalid dates and a reversed range", () => {
    expect(leaveDays("")).toBe(0);
    expect(leaveDays("bad")).toBe(0);
    expect(leaveDays("2026-10-29", "2026-10-28")).toBe(0);
  });
  it("is stable across a DST change (noon-based)", () => expect(leaveDays("2026-03-28", "2026-03-30")).toBe(3));
  it("normalises status", () => {
    expect(leaveStatus("approved")).toBe("Approved");
    expect(leaveStatus("REJECTED")).toBe("Rejected");
    expect(leaveStatus(undefined)).toBe("Pending");
    expect(leaveStatus("Clarify")).toBe("Clarify");
  });
});

describe("PTM slots", () => {
  it("slot id pts_{staffId}_{YYYYMMDDHHmm} in local time, startMs ↔ ISO", () => {
    const d = new Date(2026, 10, 9, 7, 5);
    expect(slotStamp(d)).toBe("202611090705");
    expect(ptmSlotId("stf_025", d)).toBe("pts_stf_025_202611090705");
    const ms = slotStartMs("2026-11-09", "07:05");
    expect(ms).toBe(d.getTime());
    expect(new Date(new Date(ms).toISOString()).getTime()).toBe(ms);
    expect(slotStartMs("", "07:05")).toBeNaN();
    expect(slotStartMs("2026-11-09", "")).toBeNaN();
    expect(slotStartMs("09/11/2026", "07:05")).toBeNaN();
  });
  it("overlap: same teacher and intersecting ranges only", () => {
    const a = { teacherId: "t1", startMs: 0, mins: 15 };
    expect(slotsOverlap(a, { teacherId: "t1", startMs: 14 * 6e4, mins: 15 })).toBe(true);
    expect(slotsOverlap(a, { teacherId: "t1", startMs: 15 * 6e4, mins: 15 })).toBe(false); // back to back
    expect(slotsOverlap(a, { teacherId: "t1", startMs: -10 * 6e4, mins: 30 })).toBe(true); // contains
    expect(slotsOverlap(a, { teacherId: "t2", startMs: 0, mins: 15 })).toBe(false);
  });
  it("meeting links must be https URLs", () => {
    expect(validMeetLink("https://meet.google.com/abc-defg-hij")).toBe(true);
    for (const bad of ["http://meet.google.com/x", "meet.google.com/x", "https://", "javascript:alert(1)", "https://localhost"]) expect(validMeetLink(bad)).toBe(false);
  });

  const staff = [{ id: "stf_025", name: "Mrs. Anita Sharma" }];
  const now = new Date(2026, 10, 3, 10, 0).getTime();
  const f = (p: Partial<SlotForm> = {}): SlotForm => ({ teacherId: "stf_025", date: "2026-11-10", from: "15:00", count: "3", mins: "15", gap: "5", room: "Room 204", link: "", inPerson: true, virtual: false, ...p });
  const when = (ms: number) => String(ms);
  const err = (p: Partial<SlotForm>, existing: { teacherId: string; startMs: number; mins: number }[] = []) => {
    const r = buildSlots(f(p), { staff, existing, now, when });
    return "error" in r ? r.error : "";
  };
  it("builds consecutive slots with gap, ids and contract fields", () => {
    const r = buildSlots(f({ virtual: true, link: " https://meet.google.com/x-y-z " }), { staff, existing: [], now, when });
    if ("error" in r) throw new Error(r.error);
    expect(r.rows.map((s) => s.id)).toEqual(["pts_stf_025_202611101500", "pts_stf_025_202611101520", "pts_stf_025_202611101540"]);
    expect(r.rows[1]).toEqual({ id: "pts_stf_025_202611101520", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", start: new Date(2026, 10, 10, 15, 20).toISOString(),
      startMs: new Date(2026, 10, 10, 15, 20).getTime(), mins: 15, modes: ["In-Person", "Virtual"], room: "Room 204", link: "https://meet.google.com/x-y-z", booked: false });
  });
  it("drops room / link of a mode that is not offered", () => {
    const r = buildSlots(f({ inPerson: false, virtual: true, room: "Room 1", link: "" }), { staff, existing: [], now, when });
    expect("rows" in r && r.rows[0]).toMatchObject({ modes: ["Virtual"], room: "", link: "" });
  });
  it("validates teacher, date/time, future start, integer bounds, modes, room and link", () => {
    expect(err({ teacherId: "" })).toBe("Choose a teacher.");
    expect(err({ date: "" })).toBe("Choose a date and a start time.");
    expect(err({ date: "2026-11-03", from: "10:00" })).toBe("The first slot must be in the future.");
    expect(err({ date: "2026-11-02" })).toBe("The first slot must be in the future.");
    const bounds = "Use 1–20 slots of 5–120 minutes, with a 0–60 minute gap.";
    for (const p of [{ count: "0" }, { count: "21" }, { mins: "4" }, { mins: "121" }, { mins: "12.5" }, { gap: "-1" }, { gap: "61" }, { count: "" }]) expect(err(p)).toBe(bounds);
    expect(err({ mins: "5", count: "20", gap: "0" })).toBe("");
    expect(err({ mins: "120", gap: "60" })).toBe("");
    expect(err({ inPerson: false, virtual: false })).toBe("Offer at least one mode.");
    expect(err({ room: "  " })).toBe("Enter the room for in-person meetings.");
    expect(err({ virtual: true, link: "meet.google.com/abc" })).toBe("Enter a valid meeting link starting with https://.");
  });
  it("refuses slots that overlap the teacher's existing ones", () => {
    const at = new Date(2026, 10, 10, 15, 30).getTime();
    expect(err({}, [{ teacherId: "stf_025", startMs: at, mins: 10 }])).toBe(`Mrs. Anita Sharma already has a slot around ${new Date(2026, 10, 10, 15, 20).getTime()}.`);
    expect(err({}, [{ teacherId: "stf_099", startMs: at, mins: 10 }])).toBe("");
    expect(err({}, [{ teacherId: "stf_025", startMs: new Date(2026, 10, 10, 14, 45).getTime(), mins: 15 }])).toBe(""); // ends at 15:00
  });
});

describe("certificates", () => {
  it("refNo CERT/{year}/{0001}: highest of the year + 1, other years ignored", () => {
    expect(nextCertRef([], 2026)).toBe("CERT/2026/0001");
    expect(nextCertRef(["CERT/2026/0007", "CERT/2026/0002", undefined, "CERT/2025/0050", "cert/2026/0099", "X"], 2026)).toBe("CERT/2026/0008");
    expect(nextCertRef(["CERT/2026/9999"], 2026)).toBe("CERT/2026/10000");
  });
  it("file: PDF/PNG/JPG strictly under 10 MB (storage.rules)", () => {
    expect(certFileError({ type: "application/pdf", size: 1000 })).toBe("");
    expect(certFileError({ type: "image/png", size: MAX_CERT_FILE - 1 })).toBe("");
    expect(certFileError({ type: "image/jpeg", size: 5 })).toBe("");
    expect(certFileError({ type: "image/jpeg", size: MAX_CERT_FILE })).toBe("The file must be smaller than 10 MB.");
    expect(certFileError({ type: "image/gif", size: 5 })).toBe("Upload a PDF, PNG or JPG file.");
    expect(certFileError({ type: "", size: 5 })).toBe("Upload a PDF, PNG or JPG file.");
    expect(certFileError({ type: "application/pdf", size: 0 })).toBe("The file is empty.");
  });
  it("issue validation", () => {
    const f = { studentId: "stu_001", type: "bonafide", purpose: "", refNo: "CERT/2026/0002", issuedOn: "2026-11-03", validTill: "", issuer: "Principal", note: "" };
    const certs = [{ id: "c1", refNo: "CERT/2026/0001" }];
    expect(issueError(f, { isNew: true, studentOk: false, certs })).toBe("Choose a student.");
    expect(issueError({ ...f, refNo: " " }, { isNew: true, studentOk: true, certs })).toBe("Reference number and issue date are required.");
    expect(issueError({ ...f, issuedOn: "" }, { isNew: false, studentOk: false, certs })).toBe("Reference number and issue date are required.");
    expect(issueError({ ...f, refNo: "cert/2026/0001" }, { isNew: true, studentOk: true, certs })).toBe("This reference number is already used by another certificate.");
    expect(issueError({ ...f, refNo: "CERT/2026/0001" }, { isNew: false, studentOk: false, certId: "c1", certs })).toBe("");
    expect(issueError({ ...f, validTill: "2026-11-02" }, { isNew: true, studentOk: true, certs })).toBe("Valid till must be on or after the issue date.");
    expect(issueError({ ...f, validTill: "2026-11-03" }, { isNew: true, studentOk: true, certs })).toBe("");
    expect(issueError({ ...f, issuer: "  " }, { isNew: true, studentOk: true, certs })).toBe("Enter who signs the certificate.");
  });
});
