// Pure logic of the dashboard group (dashboard, approvals, calendar, notifications, setup). No React, no Firestore:
// every function takes the rows the screens already read and returns what they show, so it can be unit tested.
import { inr } from "@/lib/format";
import { addDays, CATS, parse, toIso, type Alert, type Approval, type CalEvent, type CatId, type Notif } from "./data";

/* ---------- timestamps ---------- */
/** updatedAt / createdAt may be an ISO string, epoch ms or a Firestore Timestamp; 0 when unknown */
export const tsOf = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Date.parse(v) || 0;
  const o = v as { toMillis?: () => number; seconds?: number } | null | undefined;
  return o?.toMillis?.() ?? (typeof o?.seconds === "number" ? o.seconds * 1000 : 0);
};
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "2026-11-03" -> "Tue" (the ops_periods `day` value) */
export const dayName = (iso: string) => DAY_NAMES[parse(iso).getDay()]!;

/* ---------- attendance (ops_attendance, contract 4 / 9 / 13.6) ---------- */
export type AttRec = { id: string; date: string; classId: string; period: number; total: number; marks?: Record<string, string>; submitted?: boolean; deleted?: boolean; updatedAt?: unknown };
/**
 * The record that counts for each class on `day`: drafts (`submitted: false`) and deleted records are ignored; the newest
 * `updatedAt` wins, ties go to the higher period (contract section 9, same rule as par_attendance in 13.6).
 */
export function latestDayRecords<T extends AttRec>(att: T[], day: string) {
  const byClass = new Map<string, T>();
  for (const r of att) {
    if (r.date !== day || r.submitted === false || r.deleted === true || !r.classId) continue;
    const c = byClass.get(r.classId);
    if (!c || tsOf(r.updatedAt) - tsOf(c.updatedAt) > 0 || (tsOf(r.updatedAt) === tsOf(c.updatedAt) && (Number(r.period) || 0) > (Number(c.period) || 0))) byClass.set(r.classId, r);
  }
  return byClass;
}
/** School-wide roll for a day: `absent` = "A" marks, `notIn` = "A" + "E" (L = late, present); pct null when nothing is marked. */
export function dayAttendance(att: AttRec[], day: string) {
  let total = 0, absent = 0, notIn = 0;
  latestDayRecords(att, day).forEach((r) => {
    const v = Object.values(r.marks ?? {});
    total += Number(r.total) || 0;
    absent += v.filter((x) => x === "A").length;
    notIn += v.filter((x) => x === "A" || x === "E").length;
  });
  return { total, absent, notIn, classes: latestDayRecords(att, day).size, pct: total ? ((total - notIn) / total) * 100 : null };
}

/* ---------- fees ---------- */
export type InvoiceLite = { id: string; balance: number; status: string; due?: string };
/** an invoice is overdue when marked so, or when it still has a balance after its due date */
export const isOverdue = (i: InvoiceLite, today: string) =>
  i.status === "Overdue" || (i.status !== "Paid" && (Number(i.balance) || 0) > 0 && !!i.due && i.due < today);

/* ---------- staff on leave ---------- */
export type LeaveLite = { id: string; staffId: string; from: string; to?: string; status: string; deleted?: boolean };
export type StaffLite = { id: string; name: string; status?: string; department?: string };
/** staff ids away on `day`: status "On leave", or an Approved staff_leaves row covering the day */
export function staffOnLeave(staff: StaffLite[], leaves: LeaveLite[], day: string) {
  const out = new Set(staff.filter((s) => s.status === "On leave").map((s) => s.id));
  leaves.forEach((l) => { if (l.status === "Approved" && !l.deleted && l.from <= day && day <= (l.to || l.from)) out.add(l.staffId); });
  return out;
}

/* ---------- operational alerts derived from live collections ---------- */
export type PeriodLite = { id: string; classId?: string; grade: string; section: string; day: string; period: number; subject: string; teacherId?: string; teacher?: string };
export type SubLite = { id: string; date: string; classId: string; period: number; status?: string; substituteTeacherId?: string };
export type BusLite = { id: string; number?: string; routeName?: string; status?: string; studentCount?: number };
export type LiveAlert = Alert & { href: string; derived: true };
const clsOf = (p: PeriodLite) => p.classId ?? `cls_${p.grade}${p.section}`;
const clsLabel = (id: string) => id.replace(/^cls_(\d+)(\w)$/, "$1-$2");

/**
 * Alerts the office should act on today, computed from the real records (replaces the seed-only `dash_alerts`):
 * - substitute: a teacher on leave today still has periods with no (non-declined) ops_substitutions row,
 * - fee: invoices overdue,
 * - transit: buses under maintenance.
 */
export function deriveAlerts(ctx: { today: string; staff: StaffLite[]; leaves: LeaveLite[]; periods: PeriodLite[]; subs: SubLite[]; invoices: InvoiceLite[]; buses: BusLite[] }): LiveAlert[] {
  const { today } = ctx;
  const out: LiveAlert[] = [];
  const away = staffOnLeave(ctx.staff, ctx.leaves, today);
  const dn = dayName(today);
  const covered = (p: PeriodLite) => ctx.subs.some((s) => s.date === today && s.classId === clsOf(p) && Number(s.period) === Number(p.period) && s.status !== "Declined" && !!s.substituteTeacherId);
  for (const id of away) {
    const mine = ctx.periods.filter((p) => p.day === dn && p.teacherId === id && !covered(p)).sort((a, b) => a.period - b.period);
    if (!mine.length) continue;
    const name = ctx.staff.find((s) => s.id === id)?.name ?? mine[0]!.teacher ?? id;
    out.push({ id: `sub_${id}`, kind: "substitute", title: "SUBSTITUTE REQUIRED", tag: mine.map((p) => `P${p.period}`).join(", "), status: "open", substitute: "", derived: true, href: "/timetable",
      body: `${name} is on leave: ${mine.map((p) => `Gr ${clsLabel(clsOf(p))} ${p.subject}`).join(", ")} ${mine.length === 1 ? "needs" : "need"} cover.` });
  }
  const overdue = ctx.invoices.filter((i) => isOverdue(i, today));
  if (overdue.length) {
    const amt = overdue.reduce((a, i) => a + (Number(i.balance) || 0), 0);
    out.push({ id: "fee_overdue", kind: "fee", title: "FEE OVERDUE", tag: `${overdue.length} Account${overdue.length === 1 ? "" : "s"}`, status: "open", substitute: "", derived: true, href: "/fees",
      body: `${inr(amt)} is overdue across ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}.` });
  }
  ctx.buses.filter((b) => b.status === "Maintenance").forEach((b) => out.push({
    id: `bus_${b.id}`, kind: "transit", title: "BUS IN MAINTENANCE", tag: b.number ? `Bus ${b.number}` : b.id, status: "open", substitute: "", derived: true, href: "/transport",
    body: `${b.routeName || "Route"}: ${Number(b.studentCount) || 0} student${Number(b.studentCount) === 1 ? " needs" : "s need"} another bus.` }));
  return out;
}

/* ---------- approvals ---------- */
/** hours between submission and decision (null when either timestamp is missing or out of order) */
export const turnaround = (r: Pick<Approval, "submitted" | "decidedAt">) => {
  const a = Date.parse(r.submitted ?? ""), b = Date.parse(r.decidedAt ?? "");
  return Number.isNaN(a) || Number.isNaN(b) || b < a ? null : (b - a) / 36e5;
};
export const fmtHrs = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} hrs`);
export const avg = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null);
/** the ids of `ids` that are still pending (a decision never touches an already decided row) */
export const pendingOnly = (rows: Approval[], ids: string[]) => ids.filter((id) => rows.find((r) => r.id === id)?.status === "pending");
/** the staff_leaves patch written when an approval mirror is decided (contract 9); reopening clears the decision */
export function leaveDecisionPatch(status: Approval["status"], uid: string, note = "", at = new Date().toISOString()) {
  const s = status === "approved" ? "Approved" : status === "rejected" ? "Rejected" : "Pending";
  return s === "Pending" ? { status: s, decidedBy: "", decidedAt: "", decisionNote: "" } : { status: s, decidedBy: uid, decidedAt: at, decisionNote: note };
}

/* ---------- notifications (schools/{sid}/notifications, contract 10 / 12.1 / 14.5) ---------- */
type NotifLike = Notif & { at?: string };
/** function rows carry createdAt (IST wall clock); tolerate `at` for older rows */
export const notifAt = (n: NotifLike) => n.createdAt ?? n.at ?? "";
export type NotifGroup = "TODAY" | "YESTERDAY" | "EARLIER";
export const notifGroup = (n: NotifLike, today: string): NotifGroup => {
  const d = notifAt(n).slice(0, 10);
  return d === today ? "TODAY" : d === addDays(today, -1) ? "YESTERDAY" : "EARLIER";
};
export const unreadCount = (rows: { read?: boolean }[]) => rows.filter((r) => !r.read).length;
export const sortNotifs = <T extends NotifLike>(rows: T[]) => [...rows].sort((a, b) => notifAt(b).localeCompare(notifAt(a)));
/** newest first, narrowed to a category tab ("all" = every row) and a case-insensitive search over title + body */
export const filterNotifs = <T extends NotifLike>(rows: T[], tab: string, q: string) =>
  sortNotifs(rows).filter((r) => (tab === "all" || r.category === tab) && (!q || `${r.title ?? ""} ${r.body ?? ""}`.toLowerCase().includes(q.toLowerCase())));
/** groups in display order, empty ones dropped */
export const groupNotifs = <T extends NotifLike>(rows: T[], today: string) =>
  (["TODAY", "YESTERDAY", "EARLIER"] as const).map((g) => ({ g, items: rows.filter((n) => notifGroup(n, today) === g) })).filter((x) => x.items.length);

/* ---------- calendar ---------- */
/** academic year Apr–Mar containing `day` (Term 2 starts 1 Nov) */
export const ayOf = (day: string) => { const d = parse(day); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return { y, start: `${y}-04-01`, t2: `${y}-11-01`, end: `${y + 1}-03-31` }; };
/** Mon–Sat days in [from, to] not covered by a holiday event */
export const workingDaysIn = (from: string, to: string, holidays: Pick<CalEvent, "start" | "end">[]) => {
  let n = 0; const d = parse(from), end = parse(to);
  for (; d <= end; d.setDate(d.getDate() + 1)) { const iso = toIso(d); if (d.getDay() !== 0 && !holidays.some((h) => h.start <= iso && iso <= h.end)) n++; }
  return n;
};
/** inclusive length of an event in days (at least 1) */
export const spanDays = (e: Pick<CalEvent, "start" | "end">) => Math.max(1, Math.round((parse(e.end).getTime() - parse(e.start).getTime()) / 864e5) + 1);
/** Apr–Oct is Term 1, Nov–Mar Term 2 (the stored `term` value) */
export const termOf = (date: string): "Term 1" | "Term 2" => { const m = parse(date).getMonth(); return m >= 3 && m <= 9 ? "Term 1" : "Term 2"; };

export type EventForm = { title: string; category: CatId | ""; start: string; end: string; allDay: boolean; startTime: string; endTime: string };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
/** field errors of the add / edit event form ({} when valid) */
export function validateEvent(f: EventForm) {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = "Event title is required";
  if (!CATS.some((c) => c.id === f.category)) e.category = "Choose a classification";
  if (!f.start) e.start = "Start date is required";
  if (!f.end) e.end = "End date is required";
  else if (f.start && f.end < f.start) e.end = "End date must be on or after start date";
  if (!f.allDay) {
    if (!HHMM.test(f.startTime)) e.startTime = "Start time is required";
    if (!HHMM.test(f.endTime)) e.endTime = "End time is required";
    else if (HHMM.test(f.startTime) && f.start === f.end && f.endTime <= f.startTime) e.endTime = "End time must be after start time";
  }
  return e;
}
/** published events sharing a non-default venue or the faculty lead on overlapping dates (the event itself excluded) */
export function eventClashes(events: CalEvent[], f: { id?: string; start: string; end: string; venue: string; lead: string }, sharedVenue = "Main Campus") {
  return events.filter((e) => e.id !== f.id && e.status === "published" && e.start <= f.end && e.end >= f.start
    && ((e.venue === f.venue && e.venue !== sharedVenue) || (!!f.lead && e.lead === f.lead)));
}
/** "08:30 – 14:30", or "All day" */
export const timeRange = (e: Pick<CalEvent, "startTime" | "endTime"> & { allDay?: boolean }) =>
  e.allDay || (!e.startTime && !e.endTime) ? "All day" : `${e.startTime} – ${e.endTime}`;

/* ---------- setup wizard: data-quality exceptions from the student roster ---------- */
export type StuLite = { id: string; name: string; grn?: string; grade?: string; section?: string; classId?: string; guardian?: string; phone?: string; status?: string };
export type DataException = { id: string; name: string; guardian: string; grade: string; grn: string; status: string; tone: Approval["tone"]; kind: string; issue: string; action: string; resolved: false; href: string; derived: true };
export const EXC_KIND_LABEL: Record<string, string> = {
  uid: "Missing Aadhaar / UID", sibling: "Sibling Link Broken", address: "Address & Transport Mismatch",
  contact: "Guardian Contact", guardian: "Missing Guardian", class: "Class Placement", grn: "GRN Issues",
};
/**
 * Records of active students that would break the roll-forward / parent invite, computed from `students` (replaces the
 * seed-only `setup_exceptions`): missing or duplicate GRN, no class, no guardian, no valid 10-digit guardian phone.
 * Each one is fixed in the student record itself, so it disappears on its own once corrected.
 */
export function dataExceptions(students: StuLite[]): DataException[] {
  const act = students.filter((s) => !s.status || s.status === "Active");
  const grnCount = new Map<string, number>();
  act.forEach((s) => { const g = (s.grn ?? "").trim().toUpperCase(); if (g) grnCount.set(g, (grnCount.get(g) ?? 0) + 1); });
  const out: DataException[] = [];
  for (const s of act) {
    const base = { name: s.name || s.id, guardian: s.guardian || "—", grade: s.grade ? `${s.grade}${s.section ? `-${s.section}` : ""}` : "—", grn: s.grn || "—", resolved: false as const, derived: true as const,
      href: `/students?q=${encodeURIComponent(s.name || s.id)}` };
    const add = (kind: string, status: string, tone: Approval["tone"], issue: string) => out.push({ ...base, id: `dx_${kind}_${s.id}`, kind, status, tone, issue, action: "Fix in Students" });
    const grn = (s.grn ?? "").trim().toUpperCase();
    if (!grn) add("grn", "GRN Missing", "danger", "No GRN / admission number on the record");
    else if ((grnCount.get(grn) ?? 0) > 1) add("grn", "Duplicate GRN", "danger", `GRN ${s.grn} is used by ${grnCount.get(grn)} active students`);
    if (!s.classId && !(s.grade && s.section)) add("class", "Not Placed", "warning", "Not placed in a class and section");
    if (!(s.guardian ?? "").trim()) add("guardian", "No Guardian", "warning", "No guardian name on record");
    const digits = (s.phone ?? "").replace(/\D/g, "");
    if (digits.length < 10) add("contact", digits ? "Invalid Phone" : "No Phone", "info", digits ? `Guardian phone has only ${digits.length} digits` : "No guardian phone number");
  }
  return out;
}
/** the setup phase gated by the flagged exceptions ("Data Sync & Ingestion", phase 7) */
export const isIngestionPhase = (s: { no: number; title?: string }) => /ingestion|import/i.test(s.title ?? "") || s.no === 7;
