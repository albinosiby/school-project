// Pure rules behind the OPS screens (classes, attendance, timetable, substitutions, live classes, homework).
// Kept free of React so they can be unit tested; the views call these and only render.
import { DAY_NAMES, GRADES, SECTIONS, classIdOf, clsLabel, dayOfIso, studentClassId } from "./shared";

type Errors = Record<string, string>;

/** updatedAt may be an ISO string, epoch ms, a Date or a Firestore Timestamp ({toMillis} / {seconds}) */
export const tsMs = (v: unknown): number => {
  if (typeof v === "string") return Date.parse(v) || 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (v instanceof Date) return v.getTime() || 0;
  const o = v as { toMillis?: () => number; seconds?: number } | null | undefined;
  if (o && typeof o.toMillis === "function") return o.toMillis();
  if (o && typeof o.seconds === "number") return o.seconds * 1000;
  return 0;
};

// ---------------------------------------------------------------------------------------------------------------------
// Classes and assignments (contract sections 3, 10, 13.1)
// ---------------------------------------------------------------------------------------------------------------------

export type ClassRow = { id: string; grade: string; section: string; classTeacherId?: string; classTeacher?: string; room?: string; wing?: string; studentCount?: number };
export type Assignment = { id: string; classId: string; subject: string; teacherId: string; topic?: string; periodsPerWeek?: number };

/** the other class this teacher is already class teacher of (a teacher is class teacher of one class) */
export const classTeacherElsewhere = (classes: ClassRow[], teacherId: string, classId: string) =>
  teacherId ? classes.find((c) => c.id !== classId && c.classTeacherId === teacherId) : undefined;

/** the other class whose home room this is (case/space-insensitive) */
export const roomTakenBy = (classes: ClassRow[], room: string, classId: string) => {
  const k = room.trim().toLowerCase().replace(/\s+/g, " ");
  return k ? classes.find((c) => c.id !== classId && (c.room ?? "").trim().toLowerCase().replace(/\s+/g, " ") === k) : undefined;
};

/** Add / edit class. `editId` is the class being edited (its grade and section are fixed then). */
export function validateClass(v: { grade: string; section: string; classTeacherId: string; room: string }, classes: ClassRow[], nameOf: (id: string) => string, editId?: string): Errors {
  const e: Errors = {};
  const grade = String(v.grade ?? "").trim(), section = String(v.section ?? "").trim();
  if (!GRADES.includes(grade)) e.grade = "Grade must be 1–12";
  if (!SECTIONS.includes(section)) e.section = "Section must be A–D";
  const id = editId ?? classIdOf(grade, section);
  if (!editId && !e.grade && !e.section && classes.some((c) => c.id === id)) e.section = "This class already exists";
  const ct = classTeacherElsewhere(classes, v.classTeacherId, id);
  if (ct) e.classTeacherId = `${nameOf(v.classTeacherId) || v.classTeacherId} is already class teacher of ${clsLabel(ct.id)}`;
  if (v.room.trim().length > 20) e.room = "Room is at most 20 characters";
  else { const r = roomTakenBy(classes, v.room, id); if (r) e.room = `Room ${v.room.trim()} is already used by ${clsLabel(r.id)}`; }
  return e;
}

/** Subject -> teacher assignment for a class. */
export function validateAssignment(all: Assignment[], v: { classId: string; subject: string; teacherId: string; periodsPerWeek?: string }): Errors {
  const e: Errors = {};
  if (!v.classId) e.classId = "Pick a class";
  if (!v.subject) e.subject = "Pick a subject";
  else if (all.some((a) => a.classId === v.classId && a.subject.toLowerCase() === v.subject.toLowerCase())) e.subject = `${v.subject} is already assigned in this class`;
  if (!v.teacherId) e.teacherId = "Pick a teacher";
  const p = (v.periodsPerWeek ?? "").trim();
  if (p !== "" && !(/^\d+$/.test(p) && Number(p) <= 48)) e.periodsPerWeek = "Whole number, 0–48";
  return e;
}

// ---------------------------------------------------------------------------------------------------------------------
// Attendance: ops_attendance (contract sections 4, 9, 11, 13.6)
// ---------------------------------------------------------------------------------------------------------------------

export type Mark = "P" | "A" | "L" | "E";
export type AttRec = {
  id: string; date: string; classId: string; grade?: string; section?: string; period: number; total: number;
  marks?: Record<string, string>; submitted?: boolean; deleted?: boolean; teacherId?: string; markedBy?: string; updatedAt?: unknown;
};

/** P/A/L/E counts from `total` and `marks` (only non-present students are listed; a missing key means present) */
export const derive = (r: { total?: unknown; marks?: Record<string, unknown> | null }) => {
  const v = Object.values(r.marks ?? {});
  const A = v.filter((x) => x === "A").length, L = v.filter((x) => x === "L").length, E = v.filter((x) => x === "E").length;
  const total = Math.max(0, Math.trunc(Number(r.total) || 0));
  return { A, L, E, P: Math.max(0, total - A - L - E), total };
};

/** attendance %: present + late count as attended; 0 for an empty class */
export const attPct = (d: { P: number; L: number; total: number }) => (d.total > 0 ? Math.round(((d.P + d.L) / d.total) * 100) : 0);

/** drafts (submitted:false) and soft-deleted records never decide a day (section 13.6) */
export const isCounted = (r: Pick<AttRec, "submitted" | "deleted">) => r.submitted !== false && r.deleted !== true;

/** > 0 when `a` wins over `b`: newest updatedAt, ties the higher period (section 9) */
export const newer = (a: AttRec, b: AttRec) => tsMs(a.updatedAt) - tsMs(b.updatedAt) || (Number(a.period) || 0) - (Number(b.period) || 0);

/** submitted records of one class and day */
export const dayRecords = (rows: AttRec[], classId: string, date: string) => rows.filter((r) => r.classId === classId && r.date === date && isCounted(r));

/** the record that decides a class's day */
export const latestRecord = (recs: AttRec[]) => recs.reduce<AttRec | undefined>((best, r) => (!isCounted(r) ? best : !best || newer(r, best) > 0 ? r : best), undefined);

/** one deciding record per date for a class, newest date first */
export function latestPerDate(rows: AttRec[], classId: string, limit = 5) {
  const byDate = new Map<string, AttRec>();
  rows.filter((r) => r.classId === classId && isCounted(r)).forEach((r) => { const c = byDate.get(r.date); if (!c || newer(r, c) > 0) byDate.set(r.date, r); });
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

/** contract section 9: the admin's day-level record */
export const adminDayId = (date: string, classId: string) => `${date}_${classId}_0`;

/** Why the admin cannot save the roll yet ("" when it can). */
export function attendanceSaveError(v: { date: string; today: string; rosterSize: number; marked: number }) {
  if (!v.rosterSize) return "No students in this class";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return "Pick a valid date";
  if (v.date > v.today) return "Attendance cannot be saved for a future date";
  if (v.marked < v.rosterSize) return `Mark all ${v.rosterSize} students before saving (${v.rosterSize - v.marked} left)`;
  return "";
}

/** the admin day record body (section 9): only non-present students are listed in `marks` */
export function adminDayRecord(v: { date: string; grade: string; section: string; rosterIds: string[]; marks: Record<string, Mark | undefined> }) {
  const nonPresent: Record<string, "A" | "L" | "E"> = {};
  v.rosterIds.forEach((id) => { const m = v.marks[id]; if (m === "A" || m === "L" || m === "E") nonPresent[id] = m; });
  return { date: v.date, classId: classIdOf(v.grade, v.section), grade: v.grade, section: v.section, period: 0, total: v.rosterIds.length, marks: nonPresent, submitted: true, teacherId: "", markedBy: "admin" };
}

// ---------------------------------------------------------------------------------------------------------------------
// Timetable: ops_periods (contract sections 2, 3)
// ---------------------------------------------------------------------------------------------------------------------

export type Period = { id: string; classId?: string; grade: string; section: string; day: string; period: number; subject: string; teacher: string; teacherId?: string; room: string };
export const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
/** bell times shared with the teacher and parent apps (P1 08:30 ... 45 minutes each, recess after P2, lunch after P4) */
export const PERIOD_TIMES = ["08:30", "09:15", "10:15", "11:00", "12:30", "13:15", "14:00", "14:45"];
/** rows written before the contract have no classId; derive it */
export const periodClass = (r: Pick<Period, "classId" | "grade" | "section">) => r.classId || classIdOf(r.grade, r.section);
/** contract section 2: per_10B_Mon_3 */
export const periodId = (grade: string, section: string, day: string, period: number) => `per_${grade}${section.toUpperCase()}_${day}_${period}`;
/** teacher identity is the staff id; legacy rows that only carry a name are matched by name ("" = nobody) */
export const teacherKey = (r: { teacherId?: string; teacher?: string }) => r.teacherId || (r.teacher ? `n:${r.teacher}` : "");

type Slot = { id?: string; classId: string; day: string; period: number };
/** another class's period at the same time with the same teacher (a double-booking) */
export const findTeacherClash = (rows: Period[], c: Slot & { teacherId?: string; teacher?: string }) => {
  const k = teacherKey(c);
  return k ? rows.find((o) => o.id !== c.id && o.day === c.day && Number(o.period) === c.period && teacherKey(o) === k && periodClass(o) !== c.classId) : undefined;
};
/** another period of the same class in the same slot */
export const findSlotTaken = (rows: Period[], c: Slot) => rows.find((o) => o.id !== c.id && periodClass(o) === c.classId && o.day === c.day && Number(o.period) === c.period);

export function validatePeriod(v: { day: string; period: number; subject: string; teacherId: string }): Errors {
  const e: Errors = {};
  if (!DAY_NAMES.includes(v.day)) e.day = "Day must be Mon–Sat";
  if (!(Number.isInteger(v.period) && v.period >= 1 && v.period <= 8)) e.period = "Period must be 1–8";
  if (!v.subject.trim()) e.subject = "Pick a subject";
  if (!v.teacherId) e.teacherId = "Pick a teacher";
  return e;
}

// ---------------------------------------------------------------------------------------------------------------------
// Substitutions: ops_substitutions (contract sections 3, 9, 10)
// ---------------------------------------------------------------------------------------------------------------------

export type SubStatus = "Assigned" | "Accepted" | "Declined";
export type Substitution = {
  id: string; date: string; day: string; period: number; classId: string; subject: string; absentTeacherId: string; substituteTeacherId: string;
  status: SubStatus; topic?: string; note?: string;
};
export type LeaveRef = { id: string; staffId: string; from: string; to?: string; status: string };

/** contract section 9: sub_{date}_{classId}_{period} */
export const subId = (date: string, classId: string, period: number) => `sub_${date}_${classId}_${period}`;
/** stored status in the contract's words (tolerates lower-case and the teacher app's local "pending") */
export const subStatus = (s: unknown): SubStatus => {
  const v = String(s ?? "").toLowerCase();
  return v === "accepted" ? "Accepted" : v === "declined" ? "Declined" : "Assigned";
};
/** a reassignment to someone else starts over as "Assigned"; editing the note/topic of an accepted cover keeps it accepted */
export const nextSubStatus = (prev: Pick<Substitution, "substituteTeacherId" | "status"> | undefined, substituteId: string): SubStatus =>
  prev && prev.substituteTeacherId === substituteId && subStatus(prev.status) === "Accepted" ? "Accepted" : "Assigned";

/** Why teacher `id` cannot cover period `period` on `date` ("" = free). */
export function busyReason(id: string, ctx: { date: string; period: number; classId: string; periods: Period[]; subs: Substitution[]; leaves?: LeaveRef[]; editId?: string }) {
  const day = dayOfIso(ctx.date);
  const t = ctx.periods.find((p) => p.day === day && Number(p.period) === ctx.period && p.teacherId === id);
  if (t) return `teaching ${clsLabel(periodClass(t))}`;
  const others = ctx.subs.filter((s) => s.id !== ctx.editId && s.date === ctx.date);
  const c = others.find((s) => Number(s.period) === ctx.period && s.substituteTeacherId === id && s.classId !== ctx.classId && subStatus(s.status) !== "Declined");
  if (c) return `covering ${clsLabel(c.classId)}`;
  if (others.some((s) => s.absentTeacherId === id)) return "absent that day";
  const l = (ctx.leaves ?? []).find((x) => x.staffId === id && x.status === "Approved" && x.from <= ctx.date && ctx.date <= (x.to || x.from));
  if (l) return "on approved leave";
  return "";
}

/** teachers who could cover the slot (everyone but the absent teacher), each with the reason they are busy */
export const coverCandidates = <T extends { id: string }>(teachers: T[], absentTeacherId: string, why: (id: string) => string) =>
  teachers.filter((t) => t.id !== absentTeacherId).map((t) => ({ ...t, busy: why(t.id) }));

export function validateSubstitution(v: {
  date: string; today: string; isNew: boolean; hasSlot: boolean; absentTeacherId: string; substituteId: string; busy: string; existing?: { substituteName: string };
}): Errors {
  const e: Errors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) e.date = "Pick a date";
  else if (dayOfIso(v.date) === "Sun") e.date = "No classes on Sunday";
  else if (v.isNew && v.date < v.today) e.date = "Date cannot be in the past";
  if (!v.hasSlot) e.period = "Pick a period";
  else if (v.isNew && v.existing) e.period = `This period already has a substitute (${v.existing.substituteName}). Use Reassign.`;
  if (!v.substituteId) e.substitute = "Pick a substitute teacher";
  else if (v.substituteId === v.absentTeacherId) e.substitute = "The substitute must be someone other than the absent teacher";
  else if (v.busy) e.substitute = `Busy: ${v.busy}`;
  return e;
}

// ---------------------------------------------------------------------------------------------------------------------
// Live classes: live_classes (contract section 6)
// ---------------------------------------------------------------------------------------------------------------------

export type LiveClass = {
  id: string; title: string; classId: string; subject: string; teacherId: string; date: string; time: string; mins: number; medium?: string; link?: string;
  status?: string; deleted?: boolean;
};
export type LiveState = "Draft" | "Upcoming" | "Live" | "Ended" | "Cancelled";
export const JOIN_LEAD_MIN = 10;

const MEET_CODE = /^(?:https?:\/\/)?meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?:[?#/].*)?$/i;
const MEET_LOOKUP = /^(?:https?:\/\/)?meet\.google\.com\/lookup\/([A-Za-z0-9_-]+)(?:[?#].*)?$/i;
/** the https form of a valid Meet link (same rule as the teacher app's live_class_rules.dart), else null */
export function normalizeMeetLink(input: string | null | undefined) {
  const s = String(input ?? "").trim();
  const code = MEET_CODE.exec(s);
  if (code) return `https://meet.google.com/${code[1]!.toLowerCase()}`;
  const look = MEET_LOOKUP.exec(s);
  if (look) return `https://meet.google.com/lookup/${look[1]}`;
  return null;
}
/** inline error for a Meet link field (null = valid) */
export const meetLinkError = (input: string | null | undefined) =>
  !String(input ?? "").trim() ? "Paste the Google Meet link" : normalizeMeetLink(input) ? null : "Use a Google Meet link like https://meet.google.com/abc-defg-hij";

/** any other teacher-entered link -> safe absolute http(s) URL (never javascript: etc.) */
export const safeLink = (raw?: string) => {
  const v = (raw ?? "").trim(); if (!v) return null;
  try { const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v}`); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
};
/** the link the admin may open: Google Meet sessions only with a valid Meet link */
export const joinLink = (c: Pick<LiveClass, "medium" | "link">) => (!c.medium || /google meet/i.test(c.medium) ? normalizeMeetLink(c.link) : safeLink(c.link));

/** start of a session (local time), or null when date/time do not parse */
export const liveStart = (c: Pick<LiveClass, "date" | "time">) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date ?? "") || !/^\d{2}:\d{2}$/.test(c.time ?? "")) return null;
  const t = new Date(`${c.date}T${c.time}:00`).getTime();
  return Number.isNaN(t) ? null : t;
};

/** status derived from the clock (never from a stale stored field): Live = Join enabled, 10 min before start until start + mins */
export function liveState(c: LiveClass, now = new Date()): LiveState {
  const st = String(c.status ?? "").toLowerCase();
  if (c.deleted === true || st === "cancelled") return "Cancelled";
  if (st === "draft") return "Draft";
  const start = liveStart(c);
  if (start === null) return st === "past" || st === "ended" ? "Ended" : "Upcoming";
  const end = start + (Number(c.mins) || 0) * 60000, t = now.getTime();
  if (t >= end) return "Ended";
  return t >= start - JOIN_LEAD_MIN * 60000 ? "Live" : "Upcoming";
}

export function filterLive(rows: LiveClass[], f: { classId?: string; teacherId?: string; date?: string; status?: string }, now = new Date()) {
  return rows.filter((r) => (!f.classId || r.classId === f.classId) && (!f.teacherId || r.teacherId === f.teacherId) && (!f.date || r.date === f.date) && (!f.status || liveState(r, now) === f.status))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
}

// ---------------------------------------------------------------------------------------------------------------------
// Homework: ops_homework (contract sections 4, 11, 13.6)
// ---------------------------------------------------------------------------------------------------------------------

export type HW = {
  id: string; title: string; classId?: string; teacherId?: string; grade: string; section: string; subject: string; due: string; assigned: string; teacher: string;
  description: string; submitted: number; total: number; maxMarks?: number; status?: string; createdAt?: string; deleted?: boolean;
  submissions?: Record<string, { status?: string } | null>;
};
export type HWState = "draft" | "open" | "overdue" | "closed";

/** the class of a homework (`classId`, else grade + section) */
export const hwClassId = (h: Pick<HW, "classId" | "grade" | "section">) => studentClassId(h);
/** the teacher app keeps per-student entries in `submissions`; counts come from there when present */
export const hasSubmissions = (h: Pick<HW, "submissions">) => !!h.submissions && typeof h.submissions === "object" && Object.keys(h.submissions).length > 0;
export function hwCounts(h: Pick<HW, "submissions" | "submitted" | "total">) {
  if (hasSubmissions(h)) {
    const v = Object.values(h.submissions!);
    return { submitted: v.filter((s) => !!s && (s.status === "submitted" || s.status === "graded")).length, total: v.length };
  }
  return { submitted: Math.max(0, Number(h.submitted) || 0), total: Math.max(0, Number(h.total) || 0) };
}
/** soft-deleted homework is gone for everyone (the teacher app deletes with deleted:true) */
export const hwVisible = (h: Pick<HW, "deleted">) => h.deleted !== true;
export function hwState(h: HW, today: string): HWState {
  const st = String(h.status ?? "").toLowerCase();
  if (st.includes("draft")) return "draft";
  if (st === "closed" || st === "completed") return "closed";
  const c = hwCounts(h);
  // total 0 (empty class / not yet counted by the teacher app) is not "completed"
  if (c.total > 0 && c.submitted >= c.total) return "closed";
  return h.due && h.due < today ? "overdue" : "open";
}

export function validateHomework(f: { title: string; subject: string; classId: string; due: string; teacherId: string; maxMarks: string; submitted: string },
  ctx: { assigned: string; size: number; classChanged: boolean; countsLocked: boolean }): Errors {
  const e: Errors = {};
  if (!f.title.trim()) e.title = "Title is required";
  else if (f.title.trim().length > 120) e.title = "Title is at most 120 characters";
  if (!f.subject.trim()) e.subject = "Pick a subject";
  if (!/^cls_\d+[A-D]$/.test(f.classId)) e.grade = "Pick a class";
  else if (ctx.classChanged && !ctx.size) e.grade = "No students in this class";
  if (!f.due) e.due = "Due date is required";
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due)) e.due = "Enter a valid date";
  else if (ctx.assigned && f.due < ctx.assigned) e.due = "Due date cannot be before the assigned date";
  if (!f.teacherId) e.teacherId = "Pick a teacher";
  const mm = String(f.maxMarks ?? "").trim();
  if (!/^\d+$/.test(mm) || Number(mm) < 1 || Number(mm) > 1000) e.maxMarks = "Max marks must be a whole number from 1 to 1000";
  if (!ctx.countsLocked) {
    const sb = String(f.submitted ?? "").trim();
    if (!/^\d+$/.test(sb) || Number(sb) > ctx.size) e.submitted = `Whole number, 0–${ctx.size}`;
  }
  return e;
}
