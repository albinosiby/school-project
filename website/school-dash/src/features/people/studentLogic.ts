// Pure logic of Students & Guardians (students, student_leaves, ptm_slots, certificates). No React, no Firebase, so it is
// unit tested directly (studentLogic.test.ts). Data contract sections 2, 3, 13.1, 13.3 and 13.7.
import { classIdOf, nextId } from "@/features/ops/shared";
import { normEmail, validEmail, type SchoolUser } from "@/lib/parentAccount";

// ---- students (contract 2, 3) ----------------------------------------------------------------------------------

/** Next free student id: `stu_` + the highest numeric suffix + 1, zero-padded to 3+ digits (`stu_001`, `stu_1000`). */
export const nextStudentId = (ids: string[]) => nextId("stu", ids);

type ClassRef = { classId?: string; grade?: string | number; section?: string };
/** The student's class id: the stored `classId`, else derived from grade/section (`cls_10B`) for rows written before it existed. */
export const studentClassId = (s: ClassRef) => s.classId || classIdOf(String(s.grade ?? ""), String(s.section ?? "").toUpperCase());

type RollRow = ClassRef & { id: string; roll?: unknown; deleted?: boolean };
/** Next free roll in a class (highest roll + 1), ignoring `excludeId` (the student being edited) and soft-deleted rows. */
export function nextRoll(students: RollRow[], classId: string, excludeId?: string) {
  const rolls = students.filter((s) => s.id !== excludeId && !s.deleted && studentClassId(s) === classId).map((s) => Number(s.roll) || 0);
  return Math.max(0, ...rolls) + 1;
}

/** A phone number: optional leading +, digits with spaces / hyphens, 10 to 15 digits in all. */
export const validPhone = (p: string) => /^\+?[\d\s-]+$/.test(p.trim()) && /^\d{10,15}$/.test(p.replace(/[\s+-]/g, ""));

/** Auto GRN `GIS-{n}`: the first number from 8801 + count that no other student uses (count-based ids collide after deletes). */
export function nextGrn(existing: { id: string; grn?: string }[], excludeId?: string) {
  const taken = new Set(existing.filter((s) => s.id !== excludeId).map((s) => (s.grn ?? "").trim().toLowerCase()));
  let k = 8801 + existing.length;
  while (taken.has(`gis-${k}`)) k++;
  return `GIS-${k}`;
}

export type StudentFormValues = { name: string; grn: string; grade: string; section: string; roll: string; guardian: string; relation: string; phone: string;
  email: string; guardianEmail: string; dob: string; address: string; status: string; attendance: string | number };
export type StudentRow = RollRow & { name?: string; grn?: string };
/** The fields the Add/Edit Student form owns. Everything else on the doc (guardianUids, bus*, perfGrade…) is never written back. */
export type StudentDoc = { name: string; grn: string; grade: string; section: string; classId: string; roll: number; guardian: string; relation: string;
  phone: string; email: string; guardianEmail: string; dob: string; address: string; status: string; attendance: number };

/**
 * Validates the Add/Edit Student form. Returns field errors, or the doc fields to write (contract: string grade/section,
 * classId `cls_{grade}{SECTION}`, int roll). A blank roll keeps the student's roll when the class is unchanged, else takes the
 * next free roll of the class. `existing` = every student row (soft-deleted included). `today` is YYYY-MM-DD.
 */
export function validateStudent(f: StudentFormValues, ctx: { existing: StudentRow[]; edit?: StudentRow; users?: SchoolUser[]; today: string }):
  { errors: Record<string, string>; doc?: StudentDoc } {
  const { existing, edit, users = [], today } = ctx;
  const e: Record<string, string> = {};
  const others = existing.filter((s) => s.id !== edit?.id && !s.deleted);
  // GRNs stay unique across soft-deleted rows too: fee_invoices / fee_payments are keyed by grn (13.2)
  const grnTaken = (g: string) => existing.some((s) => s.id !== edit?.id && (s.grn ?? "").trim().toLowerCase() === g.toLowerCase());
  if (!f.name.trim()) e.name = "Name is required";
  if (!f.guardian.trim()) e.guardian = "Guardian name is required";
  if (!validPhone(f.phone)) e.phone = "Enter a valid phone number";
  if (f.email.trim() && !validEmail(f.email)) e.email = "Enter a valid email";
  const gEmail = normEmail(f.guardianEmail ?? "");
  if (gEmail && !validEmail(gEmail)) e.guardianEmail = "Enter a valid email";
  else if (gEmail && users.some((u) => u.role !== "parent" && normEmail(u.email ?? "") === gEmail)) e.guardianEmail = "This email belongs to a staff or admin login";
  const attRaw = String(f.attendance ?? "").trim();
  const att = Number(attRaw);
  if (!attRaw || isNaN(att) || att < 0 || att > 100) e.attendance = "0–100";
  if (f.dob && f.dob > today) e.dob = "Date of birth cannot be in the future";

  let grn = f.grn.trim();
  if (!grn) grn = nextGrn(existing, edit?.id);
  else if (grnTaken(grn)) e.grn = "GRN already exists";

  const grade = String(f.grade), section = String(f.section).toUpperCase();
  const classId = classIdOf(grade, section);
  const rollRaw = String(f.roll ?? "").trim();
  let roll: number;
  if (rollRaw) {
    roll = Number(rollRaw);
    if (!/^\d+$/.test(rollRaw) || roll < 1 || roll > 999) e.roll = "Enter a whole number from 1 to 999";
    else if (others.some((s) => studentClassId(s) === classId && Number(s.roll) === roll)) e.roll = `Roll ${roll} is already used in ${grade}-${section}`;
  } else {
    const kept = edit && studentClassId(edit) === classId ? Number(edit.roll) : NaN;
    roll = Number.isInteger(kept) && kept > 0 && !others.some((s) => studentClassId(s) === classId && Number(s.roll) === kept) ? kept : nextRoll(existing, classId, edit?.id);
  }
  if (Object.keys(e).length) return { errors: e };
  return { errors: {}, doc: { name: f.name.trim(), grn, grade, section, classId, roll, guardian: f.guardian.trim(), relation: f.relation, phone: f.phone.trim(),
    email: f.email.trim(), guardianEmail: gEmail, dob: f.dob, address: f.address.trim(), status: f.status, attendance: att } };
}

// ---- student_leaves (contract 4, 13.3) -------------------------------------------------------------------------

/** Inclusive day count of a leave (`from`..`to`, YYYY-MM-DD; `to` defaults to `from`). 0 when a date is missing/invalid or `to` < `from`. */
export function leaveDays(from?: string, to?: string) {
  if (!from) return 0;
  const d = (Date.parse(`${to || from}T12:00:00`) - Date.parse(`${from}T12:00:00`)) / 864e5;
  return isNaN(d) || d < 0 ? 0 : Math.round(d) + 1;
}

/** Leave status in the contract spelling ("Pending" | "Approved" | "Rejected"); tolerant of lower-case writers. Missing = Pending. */
export function leaveStatus(s?: string) {
  const v = String(s ?? "").trim().toLowerCase();
  return v === "approved" ? "Approved" : v === "rejected" ? "Rejected" : v === "pending" || !v ? "Pending" : String(s);
}

// ---- ptm_slots (contract 13.7) ---------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
/** `YYYYMMDDHHmm` of a date in local (school) time. */
export const slotStamp = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}`;
/** Slot id `pts_{staffId}_{YYYYMMDDHHmm}` (local time of the start). */
export const ptmSlotId = (staffId: string, start: Date) => `pts_${staffId}_${slotStamp(start)}`;
/** Epoch ms of a local date (`YYYY-MM-DD`) + time (`HH:mm`); NaN when either is missing or invalid. */
export function slotStartMs(date: string, time: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return NaN;
  return new Date(`${date}T${time}`).getTime();
}

type Span = { teacherId: string; startMs: number; mins: number };
/** Same teacher and the time ranges intersect (touching end-to-start is not an overlap). */
export const slotsOverlap = (a: Span, b: Span) =>
  a.teacherId === b.teacherId && a.startMs < b.startMs + b.mins * 6e4 && b.startMs < a.startMs + a.mins * 6e4;

/** A meeting link the parent app can open: an absolute https URL with a host. */
export function validMeetLink(v: string) {
  try { const u = new URL(v.trim()); return u.protocol === "https:" && !!u.hostname && u.hostname.includes("."); } catch { return false; }
}

export type SlotForm = { teacherId: string; date: string; from: string; count: string; mins: string; gap: string; room: string; link: string; inPerson: boolean; virtual: boolean };
export type SlotDoc = { id: string; teacherId: string; teacher: string; start: string; startMs: number; mins: number; modes: string[]; room: string; link: string; booked: boolean };
const int = (v: string) => (/^\d+$/.test(v.trim()) ? Number(v) : NaN);

/** Validates Publish slots and builds the ptm_slots docs, or returns the error to show. */
export function buildSlots(f: SlotForm, ctx: { staff: { id: string; name: string }[]; existing: Span[]; now: number; when: (ms: number) => string }):
  { error: string } | { rows: SlotDoc[] } {
  const t = ctx.staff.find((s) => s.id === f.teacherId);
  const count = int(f.count), mins = int(f.mins), gap = int(f.gap);
  const firstMs = slotStartMs(f.date, f.from);
  const modes = [f.inPerson && "In-Person", f.virtual && "Virtual"].filter(Boolean) as string[];
  if (!t) return { error: "Choose a teacher." };
  if (isNaN(firstMs)) return { error: "Choose a date and a start time." };
  if (firstMs <= ctx.now) return { error: "The first slot must be in the future." };
  if (!(count >= 1 && count <= 20) || !(mins >= 5 && mins <= 120) || !(gap >= 0 && gap <= 60)) return { error: "Use 1–20 slots of 5–120 minutes, with a 0–60 minute gap." };
  if (!modes.length) return { error: "Offer at least one mode." };
  if (f.inPerson && !f.room.trim()) return { error: "Enter the room for in-person meetings." };
  if (f.virtual && f.link.trim() && !validMeetLink(f.link)) return { error: "Enter a valid meeting link starting with https://." };
  const rows = Array.from({ length: count }, (_, i) => {
    const d = new Date(firstMs + i * (mins + gap) * 6e4);
    return { id: ptmSlotId(t.id, d), teacherId: t.id, teacher: t.name, start: d.toISOString(), startMs: d.getTime(), mins, modes,
      room: f.inPerson ? f.room.trim() : "", link: f.virtual ? f.link.trim() : "", booked: false };
  });
  const clash = rows.find((r) => ctx.existing.some((s) => slotsOverlap(r, s)));
  if (clash) return { error: `${t.name} already has a slot around ${ctx.when(clash.startMs)}.` };
  return { rows };
}

// ---- certificates (contract 13.7, storage.rules) ---------------------------------------------------------------

/** Next reference number of `year`: `CERT/{year}/{0001}` = highest used number of that year + 1 (other years are ignored). */
export function nextCertRef(refs: (string | undefined)[], year: number) {
  const re = new RegExp(`^CERT/${year}/(\\d+)$`);
  const used = refs.map((r) => re.exec((r ?? "").trim())?.[1]).filter(Boolean).map(Number);
  return `CERT/${year}/${String(Math.max(0, ...used) + 1).padStart(4, "0")}`;
}

/** storage.rules: `request.resource.size < 10 MB` and contentType PDF / PNG / JPEG. */
export const MAX_CERT_FILE = 10 * 1024 * 1024;
export function certFileError(file: { type: string; size: number }) {
  if (!/^(application\/pdf|image\/(png|jpeg))$/.test(file.type)) return "Upload a PDF, PNG or JPG file.";
  if (file.size >= MAX_CERT_FILE) return "The file must be smaller than 10 MB.";
  if (file.size === 0) return "The file is empty.";
  return "";
}

export type IssueForm = { studentId: string; type: string; purpose: string; refNo: string; issuedOn: string; validTill: string; issuer: string; note: string };
/** Validation of Issue certificate ("" when valid). `isNew` = issued directly (a student must be chosen). */
export function issueError(f: IssueForm, ctx: { isNew: boolean; studentOk: boolean; certId?: string; certs: { id: string; refNo?: string }[] }) {
  if (ctx.isNew && !ctx.studentOk) return "Choose a student.";
  if (!f.refNo.trim() || !f.issuedOn) return "Reference number and issue date are required.";
  const ref = f.refNo.trim().toLowerCase();
  if (ctx.certs.some((c) => c.id !== ctx.certId && (c.refNo ?? "").trim().toLowerCase() === ref)) return "This reference number is already used by another certificate.";
  if (f.validTill && f.validTill < f.issuedOn) return "Valid till must be on or after the issue date.";
  if (!f.issuer.trim()) return "Enter who signs the certificate.";
  return "";
}
