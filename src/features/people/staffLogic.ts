// Pure helpers of Staff & HR (StaffView): ids, form validation, the directory's leave status. Data contract sections 1-3.
import { approvedLeaveOn, type StaffLeave } from "./leaves";

type StaffLike = { id: string; empId?: string; email?: string; status?: string; leaveTo?: string };

const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
export const emailTaken = (rows: StaffLike[], email: string, exceptId?: string) => rows.some((r) => r.id !== exceptId && !!r.email && same(r.email, email));
export const empIdTaken = (rows: StaffLike[], empId: string, exceptId?: string) => rows.some((r) => r.id !== exceptId && !!r.empId && same(r.empId, empId));

/** next EMP-#### not in use (a count-based id alone collides after deletes) */
export function nextEmpId(rows: StaffLike[]) {
  let k = 1000 + rows.length;
  while (empIdTaken(rows, `EMP-${k}`)) k++;
  return `EMP-${k}`;
}

/** next stf_NNN after the highest existing one (contract 2: ids are stable, never reused, zero-padded to 3) */
export function nextStaffId(rows: { id: string }[]) {
  const n = Math.max(0, ...rows.map((r) => Number(/^stf_(\d+)$/.exec(r.id)?.[1] ?? 0))) + 1;
  return `stf_${String(n).padStart(3, "0")}`;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
/** Indian / international phone: digits with optional +, spaces and dashes; 10 to 13 digits. */
export const validPhone = (p: string) => /^\+?[\d\s-]+$/.test(p.trim()) && (() => { const n = p.replace(/\D/g, "").length; return n >= 10 && n <= 13; })();

export type StaffDraft = { name: string; empId: string; department: string; role: string; phone: string; email: string; designation: string; subjects: string; joined: string };

/** Add / edit staff validation. `today` is YYYY-MM-DD (a joining date cannot be in the future). */
export function validateStaff(f: StaffDraft, rows: StaffLike[], editId: string | undefined, today: string) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Name is required";
  else if (f.name.trim().length < 2) e.name = "Enter the full name";
  if (!validPhone(f.phone)) e.phone = "Enter a valid phone number";
  if (!EMAIL_RE.test(f.email.trim())) e.email = "A valid email is required (it is the teacher's login)";
  else if (emailTaken(rows, f.email, editId)) e.email = "Another staff member already uses this email";
  const emp = f.empId.trim();
  if (emp && !/^[A-Za-z0-9][A-Za-z0-9/-]{1,19}$/.test(emp)) e.empId = "Use 2-20 letters, digits, - or /";
  else if (emp && empIdTaken(rows, emp, editId)) e.empId = "Another staff member has this employee ID";
  if (f.joined && !/^\d{4}-\d{2}-\d{2}$/.test(f.joined)) e.joined = "Pick a valid date";
  else if (f.joined && f.joined > today) e.joined = "The joining date cannot be in the future";
  return e;
}

/** The doc fields a valid form writes (trimmed, email lower-cased, empty optional fields dropped, empId generated). */
export function staffBody(f: StaffDraft, rows: StaffLike[]) {
  const body: Record<string, string> = { ...f, name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim().replace(/\s+/g, " "), empId: f.empId.trim() || nextEmpId(rows),
    designation: f.designation.trim(), subjects: f.subjects.trim() };
  for (const k of ["designation", "subjects", "joined"]) if (!body[k]) delete body[k];
  return body;
}

/**
 * Leave status shown in the directory: the office's "On leave" (until its end date), or an approved staff_leaves request
 * that includes today (teacher app leave). Returns the status and the leave end date when on leave.
 */
export function effectiveStatus(s: StaffLike, leaves: Pick<StaffLeave, "staffId" | "status" | "from" | "to">[], today: string): { status: string; until?: string } {
  if (s.status === "On leave" && (!s.leaveTo || s.leaveTo >= today)) return { status: "On leave", until: s.leaveTo };
  const l = approvedLeaveOn(leaves, s.id, today);
  if (l) return { status: "On leave", until: l.to || l.from };
  return { status: s.status === "On leave" || !s.status ? "Active" : s.status };
}
