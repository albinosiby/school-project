// Pure logic of the communication hub (notices composer, scheduled notices, audiences). No React, no Firestore.
import { AUDIENCES, type Notice } from "./types";

/* ---------- who a notice reaches (the exact tests the backend and the apps apply to `audience`) ---------- */
/** functions/index.js onNoticePublished + teacher app CircularsAdapter */
export const STAFF_AUDIENCE = /staff|teacher|faculty|all school/i;
/** functions/parent.js noticeVisible (sets parentVisible) */
export const PARENT_AUDIENCE = /parent|guardian|all school|whole school|everyone/i;
/** contract 14.6 + driver app notice_models.dart `forCrew` */
export const CREW_AUDIENCE = /transport|staff|driver|bus|all|everyone|whole/i;
/** which apps show a Published notice with this audience */
export const audienceReach = (audience: string) => ({ staff: STAFF_AUDIENCE.test(audience), parents: PARENT_AUDIENCE.test(audience), crew: CREW_AUDIENCE.test(audience) });
export const reachLabel = (audience: string) => {
  const r = audienceReach(audience);
  const apps = [r.parents && "Parent app", r.staff && "Teacher app", r.crew && "Driver app"].filter(Boolean);
  return apps.length ? `Shown in: ${apps.join(" · ")}` : "Not shown in any app";
};

/* ---------- recipient counts from the live roster (replaces the fixed AUDIENCES counts) ---------- */
export type AudienceCtx = {
  students: { id: string; grade?: string; status?: string; busId?: string }[];
  staff: { id: string; status?: string }[];
  crew?: { id: string; status?: string }[];
};
const activeStudent = (s: { status?: string }) => !s.status || s.status === "Active";
const activeStaff = (s: { status?: string }) => !/^(left|inactive|resigned|relieved)$/i.test(s.status ?? "");
/** "Grade 8" — the `grades` label the parent app and the notice function both match ("8" or "Grade 8") */
export const gradeLabel = (g: string) => `Grade ${g}`;
export const gradeOfLabel = (l: string) => l.replace(/^Grade\s+/i, "").replace(/-.*$/, "").trim();
/**
 * Recipients of an audience: one per active student (their guardians share the household), active staff, bus crew.
 * "Parents by Grade" counts only the chosen grades (all students when none is chosen).
 */
export function audienceCount(audience: string, ctx: AudienceCtx, grades: string[] = []) {
  const stu = ctx.students.filter(activeStudent);
  const staff = ctx.staff.filter(activeStaff).length;
  const crew = (ctx.crew ?? []).filter((c) => c.status !== "Inactive").length;
  switch (audience) {
    case "All School": return stu.length + staff;
    case "Parents by Grade": { const gs = new Set(grades.map(gradeOfLabel)); return gs.size ? stu.filter((s) => gs.has(String(s.grade ?? ""))).length : stu.length; }
    case "Staff & Teachers": return staff;
    case "Transport Routes": return stu.filter((s) => !!s.busId).length + crew;
    default: return 0;
  }
}

/* ---------- composer ---------- */
export type ComposeMode = "now" | "schedule" | "draft";
export type NoticeForm = { title: string; body: string; audience: string; grades: string[]; channels: string[]; when: string };
/** the stored status strings the functions and apps match on (contract 10 / 13.6) */
export const statusOf = (mode: ComposeMode): Notice["status"] => (mode === "now" ? "Published" : mode === "schedule" ? "Scheduled" : "Draft");
/** field errors of the composer ({} when valid). A draft needs only a title. */
export function validateNotice(f: NoticeForm, mode: ComposeMode, now = Date.now()) {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = "Title is required";
  if (!AUDIENCES.some((a) => a.label === f.audience)) e.audience = "Choose an audience";
  if (mode !== "draft") {
    if (!f.body.trim()) e.body = "Message body is required";
    if (f.channels.length === 0) e.channels = "Select at least one channel";
    if (f.audience === "Parents by Grade" && f.grades.length === 0) e.grades = "Select at least one grade";
  }
  if (mode === "schedule") {
    const t = f.when ? new Date(f.when).getTime() : NaN;
    if (Number.isNaN(t) || t <= now) e.when = "Pick a future date and time";
  }
  return e;
}

/** Scheduled notices whose time has come (published by the admin web on open; there is no scheduler function yet). */
export const dueScheduled = <T extends Pick<Notice, "id" | "status" | "sentAt">>(rows: T[], now = Date.now()) =>
  rows.filter((n) => n.status === "Scheduled" && !!n.sentAt && !Number.isNaN(Date.parse(n.sentAt)) && Date.parse(n.sentAt) <= now);

/** percentage with one decimal; 0 when the denominator is 0 */
export const pct1 = (a: number, b: number) => (b ? Math.round(((Number(a) || 0) / b) * 1000) / 10 : 0);
