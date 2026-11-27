// Pure helpers of the staff portal home, mirroring the teacher app's home (modules/home): today's periods on the school
// bells, the "now" card (live period / break / next), today's registers per class + period (`HomeState.markedFor`) and
// the "Needs your attention" list (`attentionItems`: substitutions to answer, begun periods without a register, class
// teacher classes not marked today).
import { PERIOD_TIMES, derive, isCounted, periodClass, subStatus, type AttRec, type Period, type Substitution } from "@/features/ops/logic";
import { dayOfIso } from "@/features/ops/shared";
import { todayIso } from "../shared";
import { bellSlots, bellTimeline, type MobilePolicy } from "../teaching";

export type Slot = { id: string; period: number; time: string; from: string; to: string; classId: string; subject: string; room?: string; cover?: boolean; status?: string };
export type Bells = { periods: Map<number, { from: string; to: string }>; breaks: { label: string; from: string; to: string }[] };

/** the local day, minutes since midnight and hour of a moment (plain values for render code) */
export const clockOf = (ms: number) => { const d = new Date(ms); return { today: todayIso(d), minute: d.getHours() * 60 + d.getMinutes(), hour: d.getHours() }; };

export const toMin = (hhmm: string) => { const m = /^(\d{1,2}):(\d{2})/.exec(hhmm ?? ""); return m ? Number(m[1]) * 60 + Number(m[2]) : NaN; };
const plus45 = (from: string) => { const t = toMin(from) + 45; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

/** the school bells (`school/mobile.schedule`, else the default bells): period → from/to, and the breaks */
export function bellsOf(policy?: MobilePolicy): Bells {
  const { periods } = bellTimeline(policy);
  return {
    periods: new Map(periods.map((p) => [p.period, { from: p.from, to: p.to }])),
    breaks: bellSlots(policy).filter((slot) => slot.break).map((slot) => ({ label: slot.label, from: slot.from, to: slot.to })),
  };
}

/** Today's periods: own `ops_periods` of the weekday, with the substitutions the teacher covers today laid over. */
export function todaySlots(periods: Period[], subs: Substitution[], today: string, bells: Bells = bellsOf()): Slot[] {
  const day = dayOfIso(today);
  const at = (n: number) => bells.periods.get(n) ?? { from: PERIOD_TIMES[n - 1] ?? "", to: PERIOD_TIMES[n - 1] ? plus45(PERIOD_TIMES[n - 1]!) : "" };
  const own: Slot[] = periods.filter((p) => p.day === day).map((p) => {
    const t = at(Number(p.period));
    return { id: p.id, period: Number(p.period), time: t.from, from: t.from, to: t.to, classId: periodClass(p), subject: p.subject, room: p.room };
  });
  const covers: Slot[] = subs.filter((s) => s.date === today && subStatus(s.status) !== "Declined").map((s) => {
    const t = at(Number(s.period));
    return { id: s.id, period: Number(s.period), time: t.from, from: t.from, to: t.to, classId: s.classId, subject: s.subject, cover: true, status: subStatus(s.status) };
  });
  return [...own, ...covers].sort((a, b) => a.period - b.period || Number(!!a.cover) - Number(!!b.cover));
}

/** the periods the teacher actually takes: own ones and accepted covers */
export const teachingSlots = (slots: Slot[]) => slots.filter((s) => !s.cover || s.status === "Accepted");

export type Marked = { total: number; present: number; absent: number; late: number; excused: number };
export const markKey = (classId: string, period: number) => `${classId}|${period}`;

/** today's counted registers (drafts and deleted ones never count) by class + period */
export function markedMap(records: AttRec[], date: string) {
  const out = new Map<string, Marked>();
  for (const r of records) {
    if (r.date !== date || !isCounted(r) || !r.classId) continue;
    const d = derive(r);
    out.set(markKey(r.classId, Number(r.period) || 0), { total: d.total, present: d.P + d.L, absent: d.A, late: d.L, excused: d.E });
  }
  return out;
}
/** today's register of a class + period (null = not marked yet) — `HomeState.markedFor` */
export const markedFor = (map: Map<string, Marked>, classId: string | undefined, period: number) => (classId ? map.get(markKey(classId, period)) ?? null : null);
export const markedLabel = (m: Marked) => `${m.present}/${m.total} present${m.absent > 0 ? ` · ${m.absent} absent` : ""}`;

/** the attendance page for a class + period + date (built by /me/attendance) */
export const attendanceHref = (classId: string, period: number | undefined, date: string) =>
  `/me/attendance?${new URLSearchParams({ classId, ...(period ? { period: String(period) } : {}), date }).toString()}`;

export type NowInfo = { live?: Slot; next?: Slot; brk?: { label: string; to: string }; started: boolean; done: number; length: number };
/** what is happening at `minute` (minutes since midnight): the live period, the break, and the next period */
export function nowInfo(slots: Slot[], bells: Bells, minute: number): NowInfo {
  const live = slots.find((s) => toMin(s.from) <= minute && minute < toMin(s.to));
  const next = slots.find((s) => toMin(s.from) > minute);
  const b = bells.breaks.find((x) => toMin(x.from) <= minute && minute < toMin(x.to));
  const first = Math.min(...[...bells.periods.values()].map((p) => toMin(p.from)).filter((n) => !Number.isNaN(n)));
  const length = live ? Math.max(1, toMin(live.to) - toMin(live.from)) : 0;
  return { live, next, brk: b ? { label: b.label, to: b.to } : undefined, started: Number.isFinite(first) && minute >= first, done: live ? Math.min(length, Math.max(0, minute - toMin(live.from))) : 0, length };
}

export type AttentionItem = { id: string; kind: "sub" | "period" | "class"; title: string; sub: string; href: string; tone: "warning" | "danger" };

/**
 * "Needs your attention": substitutions waiting for a reply (today and later), then — once the school day has started —
 * each of today's begun periods without a register, then class-teacher classes with no register today.
 */
export function attentionItems(v: {
  today: string; minute: number; slots: Slot[]; subs: Substitution[]; marked: Map<string, Marked>; started: boolean; classTeacherOf: string[];
  label: (classId: string) => string; time: (hhmm: string) => string;
}): AttentionItem[] {
  const items: AttentionItem[] = [];
  for (const s of [...v.subs].filter((x) => subStatus(x.status) === "Assigned" && x.date >= v.today).sort((a, b) => a.date.localeCompare(b.date) || Number(a.period) - Number(b.period))) {
    items.push({
      id: `sub_${s.id}`, kind: "sub", tone: "warning", title: `Substitution: ${v.label(s.classId)} ${s.subject}`.trim(),
      sub: `${s.date === v.today ? "Today" : s.date} · Period ${s.period} · Accept or decline`, href: "/me/substitutions",
    });
  }
  if (!v.started || dayOfIso(v.today) === "Sun") return items;
  const flagged = new Set<string>();
  for (const s of teachingSlots(v.slots)) {
    if (!s.classId || toMin(s.from) > v.minute || markedFor(v.marked, s.classId, s.period)) continue;
    flagged.add(s.classId);
    items.push({
      id: `att_${s.classId}_${s.period}`, kind: "period", tone: "danger", title: `Mark attendance · Period ${s.period} · ${v.label(s.classId)}`,
      sub: [s.subject, s.from ? v.time(s.from) : "", "Not marked"].filter(Boolean).join(" · "), href: attendanceHref(s.classId, s.period, v.today),
    });
  }
  const markedClasses = new Set([...v.marked.keys()].map((k) => k.split("|")[0]));
  for (const c of v.classTeacherOf) {
    if (markedClasses.has(c) || flagged.has(c)) continue;
    items.push({ id: `att_${c}`, kind: "class", tone: "danger", title: `Mark attendance · ${v.label(c)}`, sub: "Class teacher · Not marked today", href: attendanceHref(c, undefined, v.today) });
  }
  return items;
}
