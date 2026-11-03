// Pure setup-wizard logic (no React / Firestore): step progress, per-step validation and the contract-shaped records
// (data contract sections 2-3) the wizard writes into school, set_terms, classes, staff and students.
import { classIdOf, isEmail, nextGrn, nextRoll, nextStudentId, type StudentRow } from "@/features/admissions/logic";

export { classIdOf };
export const STEP_COUNT = 8;
/** First step not completed yet (8 when all are done: the last step stays reachable). */
export const firstOpenStep = (completed: number[]) => Array.from({ length: STEP_COUNT }, (_, i) => i + 1).find((n) => !completed.includes(n)) ?? STEP_COUNT;
/** Completed list after finishing `no` (unique, sorted, only 1..8). */
export const markCompleted = (completed: number[], no: number) => [...new Set([...completed, no])].filter((n) => n >= 1 && n <= STEP_COUNT).sort((a, b) => a - b);
export const progressPct = (completed: number[]) => Math.round((new Set(completed.filter((n) => n >= 1 && n <= STEP_COUNT)).size / STEP_COUNT) * 100);
/** Steps can be opened up to the first unfinished one. */
export const canOpenStep = (no: number, completed: number[]) => Number.isInteger(no) && no >= 1 && no <= firstOpenStep(completed);

/** current academic year start (Apr–Mar): Nov 2026 → 2026, Feb 2027 → 2026 */
export const ayStart = (d = new Date()) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
export const ayLabel = (y: number) => `${y}-${String(y + 1).slice(2)}`;

// ---------- 1 · school profile ----------
export type Profile = { name: string; short: string; board: string; affiliation: string; address: string; city: string; phone: string; email: string; principal: string };
export function profileErrors(v: Profile) {
  const x: Record<string, string> = {};
  if (!v.name.trim()) x.name = "School name is required.";
  if (!/^\d{5,7}$/.test(v.affiliation.trim().replace(/^#/, ""))) x.affiliation = "Enter the 5–7 digit affiliation number.";
  if (!v.city.trim()) x.city = "City is required.";
  const digits = v.phone.replace(/\D/g, "");
  if (!/^[+\d][\d\s()-]*$/.test(v.phone.trim()) || digits.length < 10 || digits.length > 13) x.phone = "Enter a phone number with at least 10 digits.";
  if (!isEmail(v.email)) x.email = "Enter a valid email address.";
  return x;
}

// ---------- 2 · academic year & terms ----------
export type Term = { name: string; start: string; end: string };
export function termErrors(list: Term[], workingDays: number) {
  const x: string[] = [];
  if (list.length === 0) x.push("Add at least one term.");
  list.forEach((t, i) => {
    if (!t.name.trim() || !t.start || !t.end) x.push(`Term ${i + 1}: fill in the name and both dates.`);
    else if (t.end <= t.start) x.push(`${t.name}: end date must be after the start date.`);
  });
  const names = list.map((t) => t.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) x.push("Term names must be different.");
  const sorted = list.filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((t, i) => { if (i && t.start <= sorted[i - 1]!.end) x.push(`${t.name} overlaps ${sorted[i - 1]!.name}.`); });
  if (!Number.isInteger(workingDays) || workingDays < 100 || workingDays > 300) x.push("Working days should be between 100 and 300.");
  return x;
}
/** set_terms status of a term on `today` (same strings as Settings: Closed / In Progress / Scheduled). */
export const termStatus = (t: Term, today: string) => (t.end < today ? "Closed" : t.start <= today ? "In Progress" : "Scheduled");
/** `school.term` (contract section 3): the term running today, else the next one, else the last. */
export function currentTermName(list: Term[], today: string) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  return (sorted.find((t) => t.start <= today && today <= t.end) ?? sorted.find((t) => t.start > today) ?? sorted[sorted.length - 1])?.name.trim() ?? "";
}
/** Teaching days of a term: its share of the statutory working days by calendar length. */
export const termDays = (t: Term, workingDays: number) => Math.round((Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / 864e5) * workingDays) / 365);

// ---------- 3 · classes & sections ----------
export const SETUP_GRADES = ["LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => String(i + 1))];
export type GradeCfg = { grade: string; sections: number; cap: number };
export const gradeName = (g: string) => (isNaN(Number(g)) ? g : `Grade ${g}`);
export const sectionLetters = (n: number) => Array.from({ length: Math.max(0, Math.min(8, n)) }, (_, i) => String.fromCharCode(65 + i));
export function sectionsError(cfg: GradeCfg[]) {
  const active = cfg.filter((c) => c.sections > 0);
  if (!active.length) return "Enable at least one grade by giving it one or more sections.";
  if (active.some((c) => !Number.isInteger(c.cap) || c.cap < 10 || c.cap > 60)) return "Seat capacity per section should be between 10 and 60.";
  return "";
}
export const bandOf = (g: string) => (g === "LKG" || g === "UKG" ? "Pre-Primary" : Number(g) <= 5 ? "Primary" : Number(g) <= 8 ? "Middle" : "Secondary");
/** The `classes` docs for the enabled sections (contract: id cls_{grade}{SECTION}, grade + section strings). */
export const classesFor = (cfg: GradeCfg[]) => cfg.filter((c) => c.sections > 0).flatMap((c) => sectionLetters(c.sections).map((s) => ({ id: classIdOf(c.grade, s), grade: c.grade, section: s })));
/** Settings > sections rows ("Grade 5", ["5-A", …], seat capacity) that the Settings and Dashboard screens read. */
export const sectionRowsFor = (cfg: GradeCfg[]) => cfg.filter((c) => c.sections > 0).map((c) => ({ grade: gradeName(c.grade), stream: bandOf(c.grade), sections: sectionLetters(c.sections).map((s) => `${c.grade}-${s}`), roster: 0, cap: c.sections * c.cap }));
/** "5-A" / "11-Sci-A" section label → class id (first part = grade, last part = section). */
export const classIdOfLabel = (label: string) => { const p = label.split("-"); return classIdOf(p[0] ?? "", p.length > 1 ? p[p.length - 1]! : ""); };

// ---------- 4 · bell schedule ----------
export type Bell = { gates: string; start: string; end: string; periods: number; len: number; snackAfter: number; snackMin: number; lunchAfter: number; lunchMin: number };
export const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
export const fmtMin = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export function buildSchedule(v: Bell) {
  let t = toMin(v.start); const rows: { label: string; from: string; to: string; break?: boolean }[] = [];
  for (let p = 1; p <= Math.min(v.periods, 12); p++) {
    rows.push({ label: `Period ${p}`, from: fmtMin(t), to: fmtMin(t + v.len) }); t += v.len;
    if (p === v.snackAfter && v.snackMin) { rows.push({ label: "Snack break", from: fmtMin(t), to: fmtMin(t + v.snackMin), break: true }); t += v.snackMin; }
    if (p === v.lunchAfter && v.lunchMin) { rows.push({ label: "Lunch break", from: fmtMin(t), to: fmtMin(t + v.lunchMin), break: true }); t += v.lunchMin; }
  }
  return { rows, endsAt: t };
}
export function bellError(v: Bell) {
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (![v.gates, v.start, v.end].every((x) => time.test(x))) return "Enter all times as HH:mm.";
  if (toMin(v.start) <= toMin(v.gates)) return "Classes must start after the gates open.";
  if (!Number.isInteger(v.periods) || v.periods < 1 || v.periods > 12) return "Use between 1 and 12 periods.";
  if (!Number.isInteger(v.len) || v.len < 20 || v.len > 90) return "Period length should be between 20 and 90 minutes.";
  if ([v.snackMin, v.lunchMin].some((m) => !Number.isInteger(m) || m < 0 || m > 90)) return "Breaks should be between 0 and 90 minutes.";
  if ((v.snackMin && (v.snackAfter < 1 || v.snackAfter >= v.periods)) || (v.lunchMin && (v.lunchAfter < 1 || v.lunchAfter >= v.periods))) return "Breaks must come after a period and before the last one.";
  const endsAt = buildSchedule(v).endsAt;
  if (endsAt > toMin(v.end)) return `The schedule runs until ${fmtMin(endsAt)}, past the closing time of ${v.end}. Shorten the periods or move closing time.`;
  return "";
}

// ---------- 5 · fees ----------
export type FeeBand = { tuition: number; lab: number; activity: number; library: number };
export function feeError(fees: Record<string, FeeBand>, dueDay: number, late: number, upi: boolean, card: boolean) {
  const all = Object.values(fees);
  if (all.some((f) => Object.values(f).some((x) => !Number.isFinite(x) || x < 0))) return "Fees cannot be negative.";
  if (all.some((f) => f.tuition <= 0)) return "Tuition must be greater than zero for every band.";
  if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) return "Due day should be between 1 and 28.";
  if (late < 0 || late > 10) return "Late fee should be between 0% and 10%.";
  if (!upi && !card) return "Enable at least one online payment method.";
  return "";
}

// ---------- 6 · staff ----------
type StaffLite = { id: string; email?: string; empId?: string };
/** contract section 2: `stf_001`… above the highest numeric id */
export const nextStaffId = (ids: string[]) => `stf_${String(Math.max(0, ...ids.map((i) => Number(/^stf_(\d+)$/.exec(i)?.[1] ?? 0))) + 1).padStart(3, "0")}`;
export function nextEmpId(staff: StaffLite[]) {
  const used = new Set(staff.map((r) => String(r.empId ?? "").toLowerCase()));
  let n = 1001 + staff.length; while (used.has(`emp-${n}`)) n++;
  return `EMP-${n}`;
}
/** Quick-add staff rule: name, and the unique login email (contract section 1). */
export function newStaffErrors(v: { name: string; email: string }, staff: StaffLite[]) {
  const e: Record<string, string> = {};
  if (!v.name.trim()) e.name = "Enter the new staff member's name.";
  if (!isEmail(v.email)) e.email = "Enter a valid email (it is the teacher's login).";
  else if (staff.some((s) => (s.email ?? "").trim().toLowerCase() === v.email.trim().toLowerCase())) e.email = "Another staff member already uses this email.";
  return e;
}
/** Class-teacher coverage rule: staff must exist and at least half of the sections need a class teacher. */
export function allocationError(staffCount: number, sections: string[], assign: Record<string, string>) {
  if (staffCount === 0) return "Add at least one staff member before continuing.";
  const chosen = Object.values(assign).filter(Boolean);
  if (new Set(chosen).size !== chosen.length) return "A section can have only one class teacher.";
  const unassigned = sections.filter((s) => !chosen.includes(s));
  if (unassigned.length > sections.length * 0.5) return `${unassigned.length} of ${sections.length} sections have no class teacher yet. Assign at least half to continue.`;
  return "";
}

// ---------- 7 · student import ----------
export const CSV_HEADER = "name,grade,section,guardian,phone";
export type ParsedRow = { line: number; name: string; grade: string; section: string; guardian: string; phone: string; error?: string };
/** Splits one CSV line, honouring "quoted, values" and doubled quotes. */
export function splitCsvLine(l: string) {
  const out: string[] = []; let cur = "", q = false;
  for (let i = 0; i < l.length; i++) {
    const ch = l[i]!;
    if (q) { if (ch === '"' && l[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; }
    else if (ch === '"') q = true; else if (ch === ",") { out.push(cur); cur = ""; } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}
/**
 * Parses pasted / uploaded rows. `classIds` (when non-empty) are the classes that exist: a row for another class is refused.
 * Rows duplicating an earlier line or a student already in the system (same name, class and phone digits) are refused.
 */
export function parseStudentCsv(text: string, classIds: string[] = [], existing: { name: string; grade: string; section: string; phone?: string; classId?: string }[] = []): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const start = /^name\s*,/i.test(lines[0]!) ? 1 : 0;
  const key = (n: string, cls: string, p: string) => `${n.trim().toLowerCase()}|${cls}|${p.replace(/\D/g, "").slice(-10)}`;
  const have = new Set(existing.map((s) => key(s.name, s.classId ?? classIdOf(String(s.grade), String(s.section ?? "")), s.phone ?? "")));
  const seen = new Map<string, number>();
  return lines.slice(start).map((l, i) => {
    const [name = "", grade0 = "", section0 = "", guardian = "", phone = ""] = splitCsvLine(l);
    const grade = /^(lkg|ukg)$/i.test(grade0) ? grade0.toUpperCase() : grade0.replace(/^grade\s*/i, "");
    const section = section0.toUpperCase();
    const line = i + start + 1;
    let error: string | undefined;
    if (!name) error = "Missing name"; else if (!SETUP_GRADES.includes(grade)) error = `Unknown grade "${grade0}"`;
    else if (!/^[A-H]$/.test(section)) error = "Section must be A–H";
    else if (classIds.length && !classIds.includes(classIdOf(grade, section))) error = `No class ${grade}-${section} (add it in step 3)`;
    else if (!guardian) error = "Missing guardian";
    else if (phone.replace(/\D/g, "").length < 10 || phone.replace(/\D/g, "").length > 13) error = "Phone needs 10–13 digits";
    if (!error) {
      const k = key(name, classIdOf(grade, section), phone);
      if (have.has(k)) error = "Already in the system";
      else if (seen.has(k)) error = `Duplicate of line ${seen.get(k)}`;
      else seen.set(k, line);
    }
    return { line, name, grade, section, guardian, phone, error };
  });
}
/** `students` docs for valid rows (contract: stu_NNN ids, classId, int roll per class, string grade/section, status Active). */
export function studentDocs(rows: ParsedRow[], existing: (StudentRow & { grn?: string })[]) {
  const all: (StudentRow & { grn?: string })[] = [...existing];
  return rows.filter((r) => !r.error).map((r) => {
    const classId = classIdOf(r.grade, r.section);
    const doc = { id: nextStudentId(all.map((s) => s.id)), name: r.name, grn: nextGrn(all, "GRN"), grade: r.grade, section: r.section, classId, roll: nextRoll(all, classId), guardian: r.guardian, phone: r.phone, status: "Active", attendance: 100 };
    all.push(doc);
    return doc;
  });
}

// ---------- 8 · parent invite ----------
export function inviteError(ch: Record<string, boolean>, msg: string, when: string, date: string, verified: boolean, today: string) {
  if (!Object.values(ch).some(Boolean)) return "Choose at least one channel.";
  if (!msg.trim()) return "Write the invitation message.";
  if (!msg.includes("{link}")) return "The message must include the {link} variable so parents can sign in.";
  if (when === "later" && !date) return "Pick the date to send the invitations.";
  if (when === "later" && date < today) return "Pick today or a later date.";
  if (!verified) return "Confirm the parent contact data has been verified.";
  return "";
}
