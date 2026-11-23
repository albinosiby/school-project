// Pure helpers of the teacher's homework (`ops_homework`), shaped like the teacher app's `tk_homework` adapter:
// teacher fields (classId, title, subject, due, maxMarks, description, status, createdAt, submissions) plus the
// denormalized admin fields (teacher, grade, section, assigned, submitted, total) and teacherId.
import { gradeSectionOf } from "../teaching";

export type SubmissionStatus = "pending" | "submitted" | "graded";
export type Submission = { status: SubmissionStatus; feedback: string; marks?: number; gradedAt?: string };
export type Homework = {
  id: string; classId: string; grade?: string; section?: string; title: string; subject: string; due: string; maxMarks?: number; description?: string;
  status?: string; createdAt?: string; assigned?: string; teacher?: string; teacherId?: string; submitted?: number; total?: number;
  submissions?: Record<string, Partial<Submission> | null>; deleted?: boolean;
};
export const SUBMISSION_STATUSES: SubmissionStatus[] = ["pending", "submitted", "graded"];

export type HomeworkForm = { classId: string; subject: string; title: string; description: string; assigned: string; due: string; maxMarks: string };
export const emptyForm = (today: string): HomeworkForm => ({ classId: "", subject: "", title: "", description: "", assigned: today, due: "", maxMarks: "20" });

/** own, not soft-deleted homework, newest first (the adapter's order) */
export const ownHomework = (rows: Homework[], staffId: string) => rows
  .filter((h) => h.teacherId === staffId && !!h.classId && h.deleted !== true)
  .sort((a, b) => String(b.createdAt ?? b.assigned ?? "").localeCompare(String(a.createdAt ?? a.assigned ?? "")));

/** the teacher app's status words for an admin-created homework ("Published" → open, "Completed" → closed) */
export const localStatus = (s: unknown) => {
  const v = String(s ?? "").toLowerCase();
  return v === "published" || v === "" ? "open" : v === "completed" ? "closed" : v;
};

/** submitted = submitted + graded entries (HomeworkAdapter.write) */
export const countSubmitted = (subs: Record<string, Partial<Submission> | null | undefined>) =>
  Object.values(subs).filter((s) => !!s && (s.status === "submitted" || s.status === "graded")).length;

export function validateHomework(f: HomeworkForm, ctx: { subjects: string[]; rosterSize: number }) {
  const e: Partial<Record<keyof HomeworkForm, string>> = {};
  if (!f.classId) e.classId = "Pick a class";
  else if (!ctx.rosterSize) e.classId = "No students in this class";
  if (!f.subject.trim()) e.subject = "Pick a subject";
  else if (ctx.subjects.length && !ctx.subjects.includes(f.subject)) e.subject = "Pick a subject you teach in this class";
  if (!f.title.trim()) e.title = "Enter a title";
  else if (f.title.trim().length > 200) e.title = "Title is at most 200 characters";
  if (f.description.length > 10000) e.description = "Description is at most 10000 characters";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.assigned)) e.assigned = "Pick the assigned date";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.due)) e.due = "Pick a due date";
  else if (f.assigned && f.due < f.assigned) e.due = "Due date cannot be before the assigned date";
  const mm = f.maxMarks.trim();
  if (!/^\d+$/.test(mm) || Number(mm) < 1 || Number(mm) > 1000) e.maxMarks = "Max marks must be a whole number from 1 to 1000";
  return e;
}

/** the new homework document (HomeworkAdapter.write for a fresh row): every student of the class starts pending */
export function newHomework(f: HomeworkForm, ctx: { staffId: string; teacherName: string; rosterIds: string[]; grade?: string; section?: string; now: string; today: string }) {
  const parsed = gradeSectionOf(f.classId);
  const submissions = Object.fromEntries(ctx.rosterIds.map((id) => [id, { status: "pending" as const, feedback: "" }]));
  // assigned today: created now (the app's nowIso); back-dated: the adapter's fallback time for that day
  const createdAt = f.assigned === ctx.today ? ctx.now : `${f.assigned}T08:00:00`;
  return {
    classId: f.classId, grade: ctx.grade ?? parsed.grade, section: ctx.section ?? parsed.section, title: f.title.trim(), subject: f.subject, due: f.due,
    maxMarks: Number(f.maxMarks), description: f.description.trim(), status: "open", createdAt, assigned: f.assigned, teacher: ctx.teacherName,
    submissions, submitted: 0, total: ctx.rosterIds.length, teacherId: ctx.staffId,
  };
}

/** the grading patch: the whole `submissions` map plus the recounted `submitted` / `total` */
export function gradingPatch(subs: Record<string, Submission>) {
  return { submissions: subs, submitted: countSubmitted(subs), total: Object.keys(subs).length };
}

/** per-student entries to edit: saved ones, every roster student otherwise pending */
export function editableSubmissions(h: Pick<Homework, "submissions">, rosterIds: string[]): Record<string, Submission> {
  const out: Record<string, Submission> = {};
  const saved = h.submissions ?? {};
  for (const id of new Set([...Object.keys(saved), ...rosterIds])) {
    const s = saved[id] ?? {};
    const status: SubmissionStatus = s.status === "submitted" || s.status === "graded" ? s.status : "pending";
    out[id] = { status, feedback: s.feedback ?? "", ...(typeof s.marks === "number" ? { marks: s.marks } : {}), ...(s.gradedAt ? { gradedAt: s.gradedAt } : {}) };
  }
  return out;
}

/** a grading change: graded entries get `gradedAt`; marks are kept only when a number was entered */
export function setSubmission(prev: Submission, patch: { status?: SubmissionStatus; feedback?: string; marks?: string }, now: string): Submission {
  const status = patch.status ?? prev.status;
  const marksRaw = patch.marks === undefined ? (prev.marks === undefined ? "" : String(prev.marks)) : patch.marks;
  const marks = marksRaw.trim() === "" || Number.isNaN(Number(marksRaw)) ? undefined : Number(marksRaw);
  return {
    status, feedback: patch.feedback ?? prev.feedback, ...(marks === undefined ? {} : { marks }),
    ...(status === "graded" ? { gradedAt: prev.status === "graded" && prev.gradedAt ? prev.gradedAt : now } : {}),
  };
}

export const hwTone = (status: string) => (status === "closed" ? "neutral" : status === "draft" ? "warning" : "success") as "neutral" | "warning" | "success";
