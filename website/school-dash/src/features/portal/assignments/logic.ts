// Pure helpers of the teacher's assignments (`ops_homework`), ported from the teacher app:
//   - modules/tasks/models/homework_models.dart + homework_grading.dart (Submission, Handin, HomeworkStats),
//   - modules/tasks/screens/assignments_screen.dart (tabs, groups, hero figures),
//   - modules/classes/screens/new_homework_screen.dart (the four-step form and its validation),
//   - modules/tasks/bloc/homework_bloc.dart (grade, on paper, all handed in, close / reopen / publish now),
//   - utils/services/firebase/store_adapters.dart HomeworkAdapter (the exact Firestore shape).
// `handins.{studentId}` is written by the server only (functions/homeworkHandins.js): it is read and merged into the
// submissions here, and never written back.
import { gradeSectionOf } from "../teaching";

export type SubmissionStatus = "pending" | "submitted" | "graded";
/** a teacher attachment (the app's FileRef.toJson) */
export type FileRef = { name: string; size?: string; kind?: string; url?: string; path?: string; contentType?: string; bytes?: number; src?: string };
/** one file a guardian handed in (server copy in ops_homework.handins) */
export type HandinFile = { name?: string; url?: string; path?: string; type?: string; size?: number };
export type Handin = { files?: HandinFile[]; note?: string; submittedAt?: string; uid?: string; late?: boolean };
/** one student's submission; extra keys (gradedBy, previousMarks, late, …) ride along untouched */
export type Submission = { status: SubmissionStatus; feedback: string; marks?: number; gradedAt?: string; [extra: string]: unknown };
/** a submission as shown: with the parent hand-in merged in (never written) */
export type LiveSubmission = Submission & { handin?: Handin };
export type Homework = {
  id: string; classId: string; grade?: string; section?: string; title: string; subject: string; due: string; maxMarks?: number; description?: string;
  status?: string; createdAt?: string; assigned?: string; teacher?: string; teacherId?: string; submitted?: number; total?: number;
  submissions?: Record<string, Partial<Submission> | null>; handins?: Record<string, Handin | null>; deleted?: boolean;
  allowLate?: boolean; attachments?: FileRef[]; publishAt?: string; publishedAt?: string;
};
export type RosterStudent = { id: string; name: string; roll?: number | string };

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MAX_FILE_BYTES = 15 * 1024 * 1024;
export const DUE_QUICK: [number, string][] = [[1, "Tomorrow"], [2, "In 2 days"], [3, "In 3 days"], [7, "In a week"]];
export const MARKS_QUICK = [5, 10, 20, 25, 50, 100];
export const QUICK_FEEDBACK = ["Excellent work", "Good effort", "Neat and complete", "Needs more practice", "Incomplete — please redo", "Show your working"];
export const BAND_LABELS = ["<40%", "40–60", "60–75", "75–90", "90%+"];

// ---- dates ------------------------------------------------------------------------------------------------------
const pad = (n: number) => String(n).padStart(2, "0");
/** local YYYY-MM-DD of a Date */
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** local YYYY-MM-DDTHH:mm (a datetime-local input value) */
export const localDateTime = (d: Date) => `${isoOf(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoOf(d); };
const dayNum = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso); return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) / 86400000 : null; };
/** days from `today` to the due day (negative = overdue), null without a valid due date */
export function daysLeft(due: string | undefined, today: string) {
  const d = dayNum(String(due ?? "")), t = dayNum(today);
  return d === null || t === null ? null : d - t;
}
/** "Mon, 30 Nov" */
export function dayLabel(iso: string) {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`);
  return Number.isNaN(d.getTime()) ? "" : `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`;
}
/** "8:00 AM" */
export const time12 = (d: Date) => `${d.getHours() % 12 === 0 ? 12 : d.getHours() % 12}:${pad(d.getMinutes())} ${d.getHours() < 12 ? "AM" : "PM"}`;
/** "23 Nov, 8:00 AM" of an ISO instant, "" when invalid */
export function whenLabel(iso: string | undefined) {
  const d = new Date(String(iso ?? ""));
  return !iso || Number.isNaN(d.getTime()) ? "" : `${d.getDate()} ${MON[d.getMonth()]}, ${time12(d)}`;
}
export const monthShort = (iso: string) => { const m = /^\d{4}-(\d{2})/.exec(iso); return m ? MON[+m[1]! - 1]! : ""; };

/** "Due today", "Due tomorrow", "Overdue by 2 days", "Due Mon, 30 Nov" (homework_screen.dart dueLabel) */
export function dueLabel(due: string | undefined, today: string) {
  const left = daysLeft(due, today);
  if (left === null) return "No due date";
  if (left === 0) return "Due today";
  if (left === 1) return "Due tomorrow";
  if (left < 0) return `Overdue by ${-left} ${left === -1 ? "day" : "days"}`;
  return `Due ${dayLabel(String(due))}`;
}

// ---- the homework -----------------------------------------------------------------------------------------------
/** own, not soft-deleted homework, newest first (the adapter's order) */
export const ownHomework = (rows: Homework[], staffId: string) => rows
  .filter((h) => h.teacherId === staffId && !!h.classId && h.deleted !== true)
  .sort((a, b) => String(b.createdAt ?? `${b.assigned ?? ""}T08:00:00`).localeCompare(String(a.createdAt ?? `${a.assigned ?? ""}T08:00:00`)));

/** the teacher app's status words for an admin-created homework ("Published" → open, "Completed" → closed) */
export const localStatus = (s: unknown) => {
  const v = String(s ?? "").toLowerCase();
  return v === "published" || v === "" ? "open" : v === "completed" ? "closed" : v;
};
/** max marks as the adapter reads them (missing → 20); 0 = not graded */
export const maxMarksOf = (h: Pick<Homework, "maxMarks">) => (typeof h.maxMarks === "number" ? h.maxMarks : Number(h.maxMarks ?? 20) || 0);
export const isGraded = (h: Pick<Homework, "maxMarks">) => maxMarksOf(h) > 0;
export const allowsLate = (h: Pick<Homework, "allowLate">) => h.allowLate !== false;
export const attachmentsOf = (h: Pick<Homework, "attachments">) => (Array.isArray(h.attachments) ? h.attachments.filter((a) => !!a && typeof a === "object") : []);
export type Phase = "upcoming" | "closed" | "active";
/** upcoming (scheduled or draft: hidden from parents), closed, else active */
export function phaseOf(h: Pick<Homework, "status">): Phase {
  const s = localStatus(h.status);
  return s === "scheduled" || s === "draft" ? "upcoming" : s === "closed" ? "closed" : "active";
}

/** submitted = submitted + graded entries (HomeworkAdapter.write) */
export const countSubmitted = (subs: Record<string, Partial<Submission> | null | undefined>) =>
  Object.values(subs).filter((s) => !!s && (s.status === "submitted" || s.status === "graded")).length;

function normalSub(s: Partial<Submission> | null | undefined): Submission {
  const status: SubmissionStatus = s?.status === "submitted" || s?.status === "graded" ? s.status : "pending";
  return { ...(s ?? {}), status, feedback: typeof s?.feedback === "string" ? s.feedback : "" } as Submission;
}

/**
 * The submissions as the teacher app sees them (HomeworkAdapter.build): no entries yet (admin-created homework) →
 * every roster student pending; a parent hand-in rides along as `handin` and makes an ungraded entry "submitted".
 */
export function liveSubmissions(h: Pick<Homework, "submissions" | "handins">, rosterIds: string[]): Record<string, LiveSubmission> {
  const out: Record<string, LiveSubmission> = {};
  const saved = h.submissions ?? {};
  if (Object.keys(saved).length) for (const [id, s] of Object.entries(saved)) out[id] = normalSub(s);
  else for (const id of rosterIds) out[id] = { status: "pending", feedback: "" };
  for (const [id, hi] of Object.entries(h.handins ?? {})) {
    if (!hi || typeof hi !== "object") continue;
    const cur: LiveSubmission = { ...(out[id] ?? { status: "pending", feedback: "" }) };
    if (cur.status !== "graded") cur.status = "submitted";
    cur.handin = hi;
    out[id] = cur;
  }
  return out;
}

/** the map to write: the hand-in copy belongs to the server, never written back */
export function writableSubmissions(subs: Record<string, LiveSubmission>): Record<string, Submission> {
  return Object.fromEntries(Object.entries(subs).map(([id, s]) => { const { handin: _h, ...rest } = s; void _h; return [id, rest as Submission]; }));
}

/** the grading patch: the whole `submissions` map (no hand-ins) plus the recounted `submitted` / `total` */
export function gradingPatch(subs: Record<string, LiveSubmission>) {
  const w = writableSubmissions(subs);
  return { submissions: w, submitted: countSubmitted(w), total: Object.keys(w).length };
}

export const isLate = (s: LiveSubmission) => s.handin?.late === true || s.late === true;
/** handed in on paper: marked by the teacher, nothing uploaded */
export const onPaper = (s: LiveSubmission) => s.status !== "pending" && !s.handin;

/** HomeworkGradeSaved: graded, marks (graded homework only), feedback, gradedAt, gradedBy, previousMarks on a re-grade */
export function gradeSubmission(old: LiveSubmission, input: { marks?: number; feedback: string; by: string; now: string }): LiveSubmission {
  const { marks: oldMarks, gradedAt: _g, status: oldStatus, ...extra } = old; void _g;
  const out: LiveSubmission = {
    ...extra, ...(input.by ? { gradedBy: input.by } : {}),
    ...(oldStatus === "graded" && oldMarks !== input.marks ? { previousMarks: oldMarks ?? null } : {}),
    status: "graded", feedback: input.feedback.trim(), gradedAt: input.now,
  };
  if (input.marks !== undefined) out.marks = input.marks;
  return out;
}

/** HomeworkSubmissionMarked: handed in on paper (keeps marks / feedback), or back to not handed in */
export function markOnPaper(old: LiveSubmission, handedIn: boolean): LiveSubmission {
  if (handedIn) return { ...old, status: "submitted" };
  const { status: _s, marks: _m, feedback: _f, gradedAt: _g, gradedBy: _b, ...extra } = old; void _s; void _m; void _f; void _g; void _b;
  return { ...extra, status: "pending", feedback: "" };
}

/** HomeworkAllMarkedIn: every roster student still pending is handed in on paper */
export function markAllIn(subs: Record<string, LiveSubmission>, rosterIds: string[]) {
  const out = { ...subs };
  for (const id of rosterIds) {
    const cur = out[id] ?? { status: "pending" as const, feedback: "" };
    if (cur.status === "pending") {
      const { status: _s, marks: _m, feedback: _f, gradedAt: _g, ...extra } = cur; void _s; void _m; void _f; void _g;
      out[id] = { ...extra, status: "submitted", feedback: "" };
    }
  }
  return out;
}

/** HomeworkStatusToggled: closed → reopened, scheduled (or draft) → published now, open → closed */
export const toggledStatus = (status: unknown) => { const s = localStatus(status); return s === "closed" || s === "scheduled" || s === "draft" ? "open" : "closed"; };

// ---- figures (HomeworkStats) ------------------------------------------------------------------------------------
export type StudentRow = { id: string; name: string; roll: number; sub: LiveSubmission };
export type Stats = ReturnType<typeof homeworkStats>;
const pctOf = (marks: number, max: number) => (max === 0 ? 0 : Math.round((marks * 100) / max));

/** hand-in and grading figures of one homework over its class roster (plus anyone else holding a submission) */
export function homeworkStats(h: Homework, roster: RosterStudent[], everyone: RosterStudent[] = roster) {
  const subs = liveSubmissions(h, roster.map((s) => s.id));
  const max = maxMarksOf(h);
  const ids = new Set(roster.map((s) => s.id));
  const rollOf = (r: RosterStudent) => Number(r.roll) || 0;
  const rows: StudentRow[] = [
    ...roster.map((s) => ({ id: s.id, name: s.name, roll: rollOf(s), sub: subs[s.id] ?? { status: "pending" as const, feedback: "" } })),
    ...Object.entries(subs).filter(([id]) => !ids.has(id)).map(([id, sub]) => {
      const s = everyone.find((x) => x.id === id);
      return { id, name: s?.name ?? id, roll: 0, sub };
    }),
  ].sort((a, b) => (a.roll <= 0 ? 9999 : a.roll) - (b.roll <= 0 ? 9999 : b.roll) || a.name.localeCompare(b.name));
  const total = rows.length;
  const graded = rows.filter((r) => r.sub.status === "graded").length;
  const toGrade = rows.filter((r) => r.sub.status === "submitted").length;
  const turnedIn = graded + toGrade;
  const late = rows.filter((r) => r.sub.status !== "pending" && isLate(r.sub)).length;
  const uploaded = rows.filter((r) => !!r.sub.handin).length;
  const gradedRows = rows.filter((r) => r.sub.status === "graded" && typeof r.sub.marks === "number");
  const avg = gradedRows.length ? gradedRows.reduce((a, r) => a + (r.sub.marks ?? 0), 0) / gradedRows.length : null;
  const bands = [0, 0, 0, 0, 0];
  for (const r of gradedRows) { const p = pctOf(r.sub.marks ?? 0, max); bands[p < 40 ? 0 : p < 60 ? 1 : p < 75 ? 2 : p < 90 ? 3 : 4]!++; }
  return { subs, rows, max, total, graded, toGrade, turnedIn, notSubmitted: total - turnedIn, late, uploaded, avg, bands };
}

/** the next handed-in paper still to grade after `afterId` (wraps), null when none */
export function nextToGrade(rows: StudentRow[], afterId?: string) {
  const todo = rows.filter((r) => r.sub.status === "submitted");
  if (!todo.length) return null;
  const i = todo.findIndex((r) => r.id === afterId);
  return i < 0 ? todo[0]! : todo.length === 1 ? null : todo[(i + 1) % todo.length]!;
}

export type StudentFilter = "all" | "toGrade" | "graded" | "missing" | "late";
export const STUDENT_FILTERS: [StudentFilter, string][] = [["all", "All"], ["toGrade", "To grade"], ["graded", "Graded"], ["missing", "Not handed in"], ["late", "Late"]];
export function filterRows(rows: StudentRow[], f: StudentFilter) {
  return rows.filter((r) => f === "all" ? true : f === "toGrade" ? r.sub.status === "submitted" : f === "graded" ? r.sub.status === "graded"
    : f === "missing" ? r.sub.status === "pending" : r.sub.status !== "pending" && isLate(r.sub));
}
export const filterCounts = (st: Stats): Record<StudentFilter, number> => ({ all: st.total, toGrade: st.toGrade, graded: st.graded, missing: st.notSubmitted, late: st.late });

// ---- the list page ----------------------------------------------------------------------------------------------
export type Item = { hw: Homework; phase: Phase; stats: Stats };
export type Tab = "active" | "review" | "upcoming" | "closed";
export const TABS: [Tab, string][] = [["active", "Active"], ["review", "To review"], ["upcoming", "Upcoming"], ["closed", "Closed"]];
export const GROUPS = ["Overdue", "Due today", "This week", "Later"] as const;

/** items by due day (AssignmentsState.items) */
export function assignmentItems(hw: Homework[], rosterOf: (classId: string) => RosterStudent[], everyone: RosterStudent[] = []): Item[] {
  return hw.map((h) => ({ hw: h, phase: phaseOf(h), stats: homeworkStats(h, rosterOf(h.classId), everyone) }))
    .sort((a, b) => String(a.hw.due ?? "").localeCompare(String(b.hw.due ?? "")));
}

/** the tabs' lists and the hero figures (assignments_screen.dart) */
export function assignmentBoard(items: Item[], today: string) {
  const active = items.filter((a) => a.phase === "active");
  const review = items.filter((a) => a.phase !== "upcoming" && a.stats.toGrade > 0).sort((a, b) => b.stats.toGrade - a.stats.toGrade);
  const pub = (a: Item) => { const t = Date.parse(a.hw.publishAt ?? ""); return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER; };
  const upcoming = items.filter((a) => a.phase === "upcoming").sort((a, b) => pub(a) - pub(b));
  const closed = items.filter((a) => a.phase === "closed").sort((a, b) => String(b.hw.due ?? "").localeCompare(String(a.hw.due ?? "")));
  const lists: Record<Tab, Item[]> = { active, review, upcoming, closed };
  const toReview = review.reduce((n, a) => n + a.stats.toGrade, 0);
  const dueWeek = active.filter((a) => { const d = daysLeft(a.hw.due, today); return d !== null && d >= 0 && d < 7; }).length;
  const late = items.filter((a) => a.phase !== "upcoming").reduce((n, a) => n + a.stats.late, 0);
  return { lists, toReview, dueWeek, late, active: active.length };
}

/** active items under Overdue / Due today / This week / Later (empty groups left out) */
export function groupActive(items: Item[], today: string) {
  const groups: Record<(typeof GROUPS)[number], Item[]> = { Overdue: [], "Due today": [], "This week": [], Later: [] };
  for (const a of items) {
    const d = daysLeft(a.hw.due, today) ?? 999;
    groups[d < 0 ? "Overdue" : d === 0 ? "Due today" : d < 7 ? "This week" : "Later"].push(a);
  }
  return GROUPS.map((g) => ({ group: g, items: groups[g] })).filter((g) => g.items.length > 0);
}

/** the card's status line */
export function cardLine(a: Item, today: string) {
  if (a.phase === "upcoming") {
    const p = a.hw.publishAt ? new Date(a.hw.publishAt) : null;
    return !p || Number.isNaN(p.getTime()) ? "Draft — not published" : `Publishes ${p.getDate()} ${MON[p.getMonth()]}, ${time12(p)}`;
  }
  return a.phase === "closed" ? "Closed" : dueLabel(a.hw.due, today);
}
/** the date badge tone: upcoming, closed, overdue, due within a day, else brand */
export function badgeTone(a: Item, today: string): "upcoming" | "closed" | "overdue" | "soon" | "brand" {
  if (a.phase === "upcoming") return "upcoming";
  if (a.phase === "closed") return "closed";
  const left = daysLeft(a.hw.due, today);
  return left === null ? "brand" : left < 0 ? "overdue" : left <= 1 ? "soon" : "brand";
}

// ---- the form ---------------------------------------------------------------------------------------------------
export type AssignmentForm = {
  classId: string; subject: string; title: string; description: string; due: string;
  schedule: boolean; publishAt: string; graded: boolean; maxMarks: string; allowLate: boolean; attachments: FileRef[];
};
export type FormErrors = Partial<Record<"classId" | "subject" | "title" | "description" | "due" | "publishAt" | "maxMarks", string>>;

/** a new assignment: due tomorrow, 10 marks, late hand-ins on, publish now (else tomorrow 8 AM) */
export function emptyForm(now: Date, classId = ""): AssignmentForm {
  const today = isoOf(now);
  return {
    classId, subject: "", title: "", description: "", due: addDays(today, 1), schedule: false, publishAt: `${addDays(today, 1)}T08:00`,
    graded: true, maxMarks: "10", allowLate: true, attachments: [],
  };
}

/** the form filled from the assignment being edited (_FormState._fill) */
export function formOf(h: Homework, now: Date): AssignmentForm {
  const base = emptyForm(now, h.classId);
  const graded = isGraded(h);
  const p = h.publishAt ? new Date(h.publishAt) : null;
  return {
    ...base, subject: h.subject ?? "", title: h.title ?? "", description: h.description ?? "", graded, maxMarks: graded ? String(maxMarksOf(h)) : "10",
    allowLate: allowsLate(h), attachments: attachmentsOf(h), due: /^\d{4}-\d{2}-\d{2}/.test(h.due ?? "") ? h.due.slice(0, 10) : base.due,
    schedule: localStatus(h.status) === "scheduled", publishAt: p && !Number.isNaN(p.getTime()) ? localDateTime(p) : base.publishAt,
  };
}

/** the app's messages (title, marks, publish time) plus the class / subject / due checks the rules need */
export function validateAssignment(f: AssignmentForm, ctx: { subjects: string[]; now: Date; editing: boolean }): FormErrors {
  const e: FormErrors = {};
  if (!f.classId) e.classId = "Pick a class";
  if (!f.subject.trim()) e.subject = "Pick a subject";
  else if (ctx.subjects.length && !ctx.subjects.includes(f.subject)) e.subject = "Pick a subject you teach in this class";
  if (f.title.trim().length < 3) e.title = "Give the assignment a title (at least 3 characters)";
  else if (f.title.trim().length > 200) e.title = "Title is at most 200 characters";
  if (f.description.length > 10000) e.description = "Description is at most 10000 characters";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due)) e.due = "Pick a due date";
  else if (!ctx.editing && f.due < isoOf(ctx.now)) e.due = "Pick a due date from today on";
  const m = f.maxMarks.trim();
  if (f.graded && (!/^\d+$/.test(m) || Number(m) < 1 || Number(m) > 1000)) e.maxMarks = "Enter marks from 1 to 1000";
  if (f.schedule) {
    const at = new Date(f.publishAt);
    if (Number.isNaN(at.getTime()) || at.getTime() <= ctx.now.getTime()) e.publishAt = "Pick a publish time in the future";
    else if (!e.due && at.getTime() > new Date(`${f.due}T23:59:00`).getTime()) e.publishAt = "Publish on or before the due day";
  }
  return e;
}

/** publish → reminder (2 days before the due day, 8 AM, only after publishing) → due */
export function timeline(f: Pick<AssignmentForm, "schedule" | "publishAt" | "due">, today: string) {
  const at = new Date(f.publishAt);
  const publishDay = f.schedule && !Number.isNaN(at.getTime()) ? isoOf(at) : today;
  const reminderDay = addDays(f.due, -2);
  const hasReminder = reminderDay > publishDay || (reminderDay === publishDay && !f.schedule);
  return [
    { kind: "publish" as const, title: f.schedule ? "Published" : "Published now", detail: f.schedule && !Number.isNaN(at.getTime()) ? `${dayLabel(publishDay)}, ${time12(at)}` : "Parents notified" },
    hasReminder
      ? { kind: "reminder" as const, title: "Reminder", detail: `${dayLabel(reminderDay)}, 8 AM • only to those not handed in` }
      : { kind: "none" as const, title: "No reminder", detail: "Due too soon for the 2-day reminder" },
    { kind: "due" as const, title: "Due", detail: `${dayLabel(f.due)} • you get a hand-in summary at 8 AM` },
  ];
}

/** "due today" / "due tomorrow" / "due Mon, 30 Nov" of the form's summary bar */
export function dueSummary(due: string, today: string) {
  const left = daysLeft(due, today) ?? 0;
  return left <= 0 ? "due today" : left === 1 ? "due tomorrow" : `due ${dayLabel(due)}`;
}

/** status on save: scheduled until its time, else open; a closed assignment stays closed when edited */
export function statusOnSave(f: Pick<AssignmentForm, "schedule">, existing?: Pick<Homework, "status">) {
  if (f.schedule) return "scheduled";
  const s = existing ? localStatus(existing.status) : "";
  return !existing || s === "scheduled" ? "open" : s;
}

/** the fields the form owns (title, work, timing, grading), as the app writes them */
export function formFields(f: AssignmentForm, existing?: Homework) {
  return {
    title: f.title.trim(), subject: f.subject, due: f.due, maxMarks: f.graded ? Number(f.maxMarks.trim()) : 0, description: f.description.trim(),
    status: statusOnSave(f, existing), allowLate: f.allowLate, attachments: f.attachments,
    ...(f.schedule ? { publishAt: new Date(f.publishAt).toISOString() } : {}),
  };
}

/** the new assignment document (HomeworkAdapter.write of a fresh row): every roster student starts pending */
export function newAssignment(f: AssignmentForm, ctx: { staffId: string; teacherName: string; rosterIds: string[]; grade?: string; section?: string; now: Date }) {
  const parsed = gradeSectionOf(f.classId);
  const submissions = Object.fromEntries(ctx.rosterIds.map((id) => [id, { status: "pending" as const, feedback: "" }]));
  return {
    classId: f.classId, grade: ctx.grade ?? parsed.grade, section: ctx.section ?? parsed.section, ...formFields(f),
    createdAt: ctx.now.toISOString(), assigned: isoOf(ctx.now), teacher: ctx.teacherName,
    submissions, submitted: 0, total: ctx.rosterIds.length, teacherId: ctx.staffId,
  };
}

// ---- files ------------------------------------------------------------------------------------------------------
const TYPES: Record<string, string> = {
  pdf: "application/pdf", doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel", xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", heic: "image/heic",
};
/** the content type of an upload: the browser's, else by extension (the storage rules allow image/*, application/*, text/plain) */
export const contentTypeOf = (name: string, type = "") => type || TYPES[name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";
export const ACCEPT = "image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
/** FileRef.sizeLabel */
export const sizeLabel = (bytes?: number) => (!bytes || bytes <= 0 ? "" : bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`);
export const isImageRef = (f: { kind?: string; contentType?: string; type?: string }) => f.kind === "image" || String(f.contentType ?? f.type ?? "").startsWith("image/");
/** files within the 15 MB limit, and how many were skipped */
export function splitBySize<T extends { size: number }>(files: T[]) {
  const ok = files.filter((f) => f.size <= MAX_FILE_BYTES);
  return { ok, skipped: files.length - ok.length };
}
/** a marks number without a trailing .0 */
export const marksText = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
/** a new `ops_homework` id */
export const newHomeworkId = () => `hw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
