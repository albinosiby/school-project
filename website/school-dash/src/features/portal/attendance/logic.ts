// Pure helpers of class attendance marking: `ops_attendance/{date}_{classId}_{period}` exactly as the teacher app's
// `att_records` adapter writes it (marks hold only non-present students; validTeacherAttendance key set).
import { subStatus, type AttRec, type Mark, type Period, type Substitution } from "@/features/ops/logic";
import { activeSub, dayOfIso, gradeSectionOf, periodClassId } from "../teaching";

export type Slot = { period: number; classId: string; subject: string; kind: "period" | "sub"; status?: string };
export const MARKS: { v: Mark; label: string }[] = [
  { v: "P", label: "Present" }, { v: "A", label: "Absent" }, { v: "L", label: "Late" }, { v: "E", label: "Leave" },
];

/** the periods the teacher can mark on `date`: own timetable periods of that weekday + Assigned/Accepted covers dated that day */
export function slotsForDate(date: string, periods: Period[], subs: Substitution[]): Slot[] {
  const day = dayOfIso(date);
  const own: Slot[] = periods.filter((p) => p.day === day).map((p) => ({ period: Number(p.period), classId: periodClassId(p), subject: p.subject || "", kind: "period" }));
  const covers: Slot[] = subs.filter((s) => s.date === date && activeSub(s))
    .map((s) => ({ period: Number(s.period), classId: s.classId, subject: s.subject || "", kind: "sub", status: subStatus(s.status) }));
  const seen = new Set<string>();
  return [...covers, ...own].filter((s) => { const k = `${s.period}_${s.classId}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.period - b.period);
}

export const attendanceId = (date: string, classId: string, period: number) => `${date}_${classId}_${period}`;
export const slotKey = (s: Pick<Slot, "period" | "classId">) => `${s.period}_${s.classId}`;

/** marks to start editing from: the saved record (missing key = present), else everyone present */
export function initialMarks(roster: { id: string }[], saved?: Pick<AttRec, "marks">) {
  return Object.fromEntries(roster.map((s) => { const m = saved?.marks?.[s.id]; return [s.id, (m === "A" || m === "L" || m === "E" ? m : "P") as Mark]; }));
}

/** Why the record cannot be saved ("" when it can). */
export function saveError(v: { date: string; today: string; rosterSize: number; slot?: Slot; recordedBy?: string; staffId: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return "Pick a valid date";
  if (v.date > v.today) return "Attendance cannot be saved for a future date";
  if (!v.slot) return "Pick one of your periods";
  if (!v.rosterSize) return "No students in this class";
  if (v.recordedBy && v.recordedBy !== v.staffId) return "This attendance was recorded by another teacher. Contact the school office for corrections.";
  return "";
}

/** the teacher record body (AttendanceAdapter.write): only non-present students in `marks`, + teacherId; the store adds updatedAt/updatedBy */
export function teacherRecord(v: { date: string; classId: string; period: number; rosterIds: string[]; marks: Record<string, Mark | undefined>; staffId: string; grade?: string; section?: string }) {
  const nonPresent: Record<string, "A" | "L" | "E"> = {};
  v.rosterIds.forEach((id) => { const m = v.marks[id]; if (m === "A" || m === "L" || m === "E") nonPresent[id] = m; });
  const parsed = gradeSectionOf(v.classId);
  return {
    date: v.date, classId: v.classId, grade: v.grade ?? parsed.grade, section: v.section ?? parsed.section, period: v.period,
    total: v.rosterIds.length, marks: nonPresent, submitted: true, teacherId: v.staffId,
  };
}

/** own submitted records, newest date first then by period */
export const ownHistory = (rows: AttRec[], staffId: string) => rows
  .filter((r) => r.teacherId === staffId && r.deleted !== true)
  .sort((a, b) => b.date.localeCompare(a.date) || (Number(a.period) || 0) - (Number(b.period) || 0));

/** present count from total + non-present marks */
export const presentOf = (r: Pick<AttRec, "total" | "marks">) => {
  const away = Object.values(r.marks ?? {}).filter((m) => m === "A" || m === "E").length;
  return Math.max(0, (Number(r.total) || 0) - away);
};

// ---------------------------------------------------------------------------------------------------------------------
// School clock, working days and missing attendance (teacher app: `schoolNow`, `attendanceFlagsFrom`,
// `MarkAttendanceState.missingOn`, the timetable's `_unmarked`). The values come from `school/mobile`
// (functions/mobileSync.js `settings`): workingDays (1 = Mon .. 7 = Sun), academicRange, terms, timezone, utcOffsetMinutes.
// ---------------------------------------------------------------------------------------------------------------------

export type SchoolTerm = { id?: string; name?: string; start?: string; end?: string };
export type SchoolPolicy = {
  workingDays?: unknown; academicRange?: { start?: string; end?: string } | null; terms?: SchoolTerm[];
  timezone?: string; utcOffsetMinutes?: number; minimumAttendance?: number;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const validIso = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
/** `iso` moved by `n` calendar days */
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
/** 1 = Monday .. 7 = Sunday (Dart's `weekday`, as `school/mobile.workingDays` stores it) */
export const isoWeekday = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay() || 7;
/** whole days from `a` to `b` */
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86_400_000);
/** Monday of the week holding `iso` */
export const mondayOfIso = (iso: string) => addDays(iso, 1 - isoWeekday(iso));
/** "HH:MM" -> minutes since midnight */
export const minutesOf = (hhmm: string) => { const [h, m] = hhmm.split(":"); return (Number(h) || 0) * 60 + (Number(m) || 0); };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** "Mon, 23 Nov" */
export const fmtDay = (iso: string) => `${DAY_SHORT[isoWeekday(iso) - 1]}, ${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
/** "23 Nov" */
export const fmtShort = (iso: string) => `${Number(iso.slice(8, 10))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;

/** The school's working weekdays (1..7); Monday to Saturday when the office has not published any. */
export function workingDaysOf(policy?: SchoolPolicy | null): number[] {
  const raw = policy?.workingDays;
  const days = Array.isArray(raw) ? raw.filter((d): d is number => Number.isInteger(d) && d >= 1 && d <= 7) : [];
  return Array.isArray(raw) ? [...new Set(days)].sort() : [1, 2, 3, 4, 5, 6];
}

/**
 * Now on the school clock: the date and minute of the day in the school's time zone (`school/mobile.timezone`, else its
 * `utcOffsetMinutes`), else the browser's clock when the school has not published one.
 */
export function schoolClock(policy?: SchoolPolicy | null, now: Date = new Date()): { today: string; minute: number } {
  const zone = typeof policy?.timezone === "string" ? policy.timezone.trim() : "";
  if (zone) {
    try {
      const parts = new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
      const part = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
      return { today: `${part("year")}-${part("month")}-${part("day")}`, minute: Number(part("hour")) * 60 + Number(part("minute")) };
    } catch { /* unknown zone: fall through to the offset */ }
  }
  const off = policy?.utcOffsetMinutes;
  if (typeof off === "number" && Number.isFinite(off)) {
    const d = new Date(now.getTime() + off * 60_000);
    return { today: isoOf(d), minute: d.getUTCHours() * 60 + d.getUTCMinutes() };
  }
  return { today: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`, minute: now.getHours() * 60 + now.getMinutes() };
}

/** First day unmarked attendance is flagged: the academic year start, else 30 days back (`attendanceFlagsFrom`). */
export function flagsFrom(today: string, policy?: SchoolPolicy | null) {
  const start = policy?.academicRange?.start;
  return validIso(start) ? start : addDays(today, -30);
}

/** What the missing-attendance checks need about "now" and the school year. */
export type AttendanceClock = { today: string; minute: number; workingDays: number[]; flagsFrom: string; starts: Record<number, string> };

export function attendanceClock(policy: SchoolPolicy | null | undefined, periods: { period: number; from: string }[], now: Date = new Date()): AttendanceClock {
  const { today, minute } = schoolClock(policy, now);
  return { today, minute, workingDays: workingDaysOf(policy), flagsFrom: flagsFrom(today, policy), starts: Object.fromEntries(periods.map((p) => [p.period, p.from])) };
}

/** records that count as taken: not a draft and not deleted (ops `isCounted`) */
const counted = (r: Pick<AttRec, "submitted" | "deleted">) => r.submitted !== false && r.deleted !== true;
export const registerKey = (date: string, classId: string, period: number) => `${date}|${classId}|${period}`;
/** "date|classId|period" of every submitted register (whoever recorded it) */
export const markedKeys = (rows: AttRec[]) => new Set(rows.filter(counted).map((r) => registerKey(r.date, r.classId, Number(r.period))));

/** a period of `date` has begun on the school clock (any period of an earlier day has; a period without bell time counts as begun) */
export const periodBegun = (date: string, period: number, clock: Pick<AttendanceClock, "today" | "minute" | "starts">) =>
  date < clock.today || (date === clock.today && minutesOf(clock.starts[period] ?? "00:00") <= clock.minute);

/** a school day from `flagsFrom` up to today on which unmarked periods are flagged */
export const flaggable = (date: string, clock: AttendanceClock) =>
  validIso(date) && date >= clock.flagsFrom && date <= clock.today && clock.workingDays.includes(isoWeekday(date));

/** The teacher's slots of `date` that have begun and have no submitted register (empty for future, early or off days). */
export function missingSlots(date: string, slots: Slot[], marked: Set<string>, clock: AttendanceClock): Slot[] {
  if (!flaggable(date, clock)) return [];
  return slots.filter((s) => !marked.has(registerKey(date, s.classId, s.period)) && periodBegun(date, s.period, clock));
}

/** Every school day between `from` and `to` (inclusive, capped at today) with a missing register, oldest first. */
export function missingDays(from: string, to: string, slotsOf: (date: string) => Slot[], marked: Set<string>, clock: AttendanceClock): string[] {
  const out: string[] = [];
  const start = from < clock.flagsFrom ? clock.flagsFrom : from, end = to > clock.today ? clock.today : to;
  for (let d = start; d <= end; d = addDays(d, 1)) if (missingSlots(d, slotsOf(d), marked, clock).length) out.push(d);
  return out;
}

/** The days of a month grid (Monday first): `null` pads the first week. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = `${year}-${pad2(month)}-01`;
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [...Array<null>(isoWeekday(first) - 1).fill(null), ...Array.from({ length: days }, (_, i) => `${year}-${pad2(month)}-${pad2(i + 1)}`)];
}

/** Calendar taps: the first picks a day, a later second one closes the range (up to `maxDays`), any other starts over. */
export function tapRange(sel: { from: string; to?: string }, day: string, allowRange: boolean, maxDays = 31): { from: string; to?: string; error?: string } {
  if (!allowRange || sel.to || day <= sel.from) return { from: day };
  if (daysBetween(sel.from, day) >= maxDays) return { ...sel, error: `Pick up to ${maxDays} days` };
  return { from: sel.from, to: day };
}

/** the days from `from` to `to` that are working days */
export const schoolDaysIn = (from: string, to: string, workingDays: number[]) => {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) if (workingDays.includes(isoWeekday(d))) out.push(d);
  return out;
};

// ---------------------------------------------------------------------------------------------------------------------
// Attendance trends (teacher app: trends_states.dart, attendance_models.dart `dailyRecords`, `studentRate`, `averageRate`)
// ---------------------------------------------------------------------------------------------------------------------

export const TREND_RANGES = ["This week", "This month", "This term", "This year"] as const;
export type TrendRange = (typeof TREND_RANGES)[number];
export type Window = { from: string; to: string };

/** Date window of a range up to today: the week from Monday, the month, the published term holding today (else the last
 * 90 days), or the academic year (else the last 365 days). */
export function rangeWindow(range: TrendRange, today: string, policy?: SchoolPolicy | null): Window {
  let from: string;
  if (range === "This week") from = mondayOfIso(today);
  else if (range === "This term") {
    const term = (policy?.terms ?? []).find((t) => validIso(t.start) && validIso(t.end) && t.start! <= today && today <= t.end!);
    from = term?.start ?? addDays(today, -90);
  } else if (range === "This year") from = validIso(policy?.academicRange?.start) ? policy!.academicRange!.start! : addDays(today, -365);
  else from = `${today.slice(0, 8)}01`;
  return { from, to: today };
}

/** The window of the same length right before `w` (for "vs last week / month"). */
export function previousWindow(w: Window): Window {
  const len = daysBetween(w.from, w.to) + 1;
  return { from: addDays(w.from, -len), to: addDays(w.from, -1) };
}

export const previousLabel = (range: TrendRange) => range === "This week" ? "last week" : range === "This month" ? "the month before" : "the period before";

export type Counts = { total: number; present: number; absent: number; late: number; excused: number };
/** counts of one record: present = total minus absent, late and excused (the app's `AttendanceRecord.counts`) */
export function countsOf(r: Pick<AttRec, "total" | "marks">): Counts {
  let absent = 0, late = 0, excused = 0;
  Object.values(r.marks ?? {}).forEach((m) => { if (m === "A") absent++; else if (m === "L") late++; else if (m === "E") excused++; });
  const total = Number(r.total) || 0;
  return { total, present: Math.max(0, total - absent - late - excused), absent, late, excused };
}
/** present + late, in percent */
export const rateOf = (r: Pick<AttRec, "total" | "marks">) => { const c = countsOf(r); return c.total ? (c.present + c.late) * 100 / c.total : 0; };

const inYear = (date: string, policy?: SchoolPolicy | null) => {
  const range = policy?.academicRange;
  return (!validIso(range?.start) || date >= range!.start!) && (!validIso(range?.end) || date <= range!.end!);
};

/** Submitted records of `classId` (the latest one per day, inside the published academic year), oldest first. */
export function dailyRecords(rows: AttRec[], classId: string, policy?: SchoolPolicy | null): AttRec[] {
  const byDay = new Map<string, AttRec>();
  for (const r of rows) {
    if (r.classId !== classId || !counted(r) || !validIso(r.date) || !inYear(r.date, policy)) continue;
    const cur = byDay.get(r.date);
    const at = String(r.updatedAt ?? ""), curAt = String(cur?.updatedAt ?? "");
    if (!cur || at > curAt || (at === curAt && Number(r.period) > Number(cur.period))) byDay.set(r.date, r);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** submitted records of the class dated outside the academic year (not counted anywhere) */
export const recordsOutsideYear = (rows: AttRec[], classId: string, policy?: SchoolPolicy | null) =>
  rows.filter((r) => r.classId === classId && counted(r) && validIso(r.date) && !inYear(r.date, policy)).length;

export const inWindow = (records: AttRec[], w: Window) => records.filter((r) => r.date >= w.from && r.date <= w.to);
export const averageRate = (records: AttRec[]) => records.length ? records.reduce((s, r) => s + rateOf(r), 0) / records.length : 0;

/** A student's attendance % (present or late) over the records from their admission date. */
export function studentRate(records: AttRec[], studentId: string, admissionDate?: string) {
  const own = records.filter((r) => !admissionDate || r.date >= admissionDate);
  if (!own.length) return 0;
  return own.filter((r) => { const m = r.marks?.[studentId]; return m !== "A" && m !== "E"; }).length * 100 / own.length;
}

export type TrendStudent = { id: string; name: string; roll?: number | string; admissionDate?: string };
export type StudentTrend<S extends TrendStudent = TrendStudent> = { student: S; rate: number; absent: number; late: number; days: number; absentDates: string[] };

/** Every student over the records, lowest attendance first (then by roll). */
export function studentTrends<S extends TrendStudent>(records: AttRec[], roster: S[]): StudentTrend<S>[] {
  return roster.map((s) => {
    const own = records.filter((r) => !s.admissionDate || r.date >= s.admissionDate);
    const absentDates = own.filter((r) => r.marks?.[s.id] === "A").map((r) => r.date);
    return { student: s, rate: studentRate(records, s.id, s.admissionDate), absent: absentDates.length, late: own.filter((r) => r.marks?.[s.id] === "L").length, days: own.length, absentDates };
  }).sort((a, b) => a.rate - b.rate || (Number(a.student.roll) || 0) - (Number(b.student.roll) || 0));
}

/** present / late / absent / excused student-days over the records */
export function totalsOf(records: AttRec[]): Counts {
  return records.reduce<Counts>((t, r) => { const c = countsOf(r); return { total: t.total + c.total, present: t.present + c.present, absent: t.absent + c.absent, late: t.late + c.late, excused: t.excused + c.excused }; },
    { total: 0, present: 0, absent: 0, late: 0, excused: 0 });
}

/** Average rate per weekday (index 0 = Monday .. 6 = Sunday); null without data. */
export function weekdayRates(records: AttRec[]): (number | null)[] {
  const sums = Array<number>(7).fill(0), n = Array<number>(7).fill(0);
  records.forEach((r) => { const i = isoWeekday(r.date) - 1; sums[i]! += rateOf(r); n[i]!++; });
  return sums.map((s, i) => (n[i] ? s / n[i]! : null));
}

/** Lowest and highest weekday (indexes into `weekdayRates`); none with fewer than two weekdays of data. */
export function weekdayExtremes(rates: (number | null)[]): { lo?: number; hi?: number } {
  const have = rates.flatMap((r, i) => (r === null ? [] : [i]));
  if (have.length < 2) return {};
  return { lo: have.reduce((a, b) => (rates[a]! <= rates[b]! ? a : b)), hi: have.reduce((a, b) => (rates[a]! >= rates[b]! ? a : b)) };
}

export type TrendDay = { date: string; record?: AttRec; rate?: number; counts?: Counts };
/** Every school day of the window (oldest first) with its record when one was submitted: the daily bar chart. */
export const trendDays = (records: AttRec[], w: Window, workingDays: number[]): TrendDay[] => {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const days = new Set([...schoolDaysIn(w.from, w.to, workingDays), ...records.filter((r) => r.date >= w.from && r.date <= w.to).map((r) => r.date)]);
  return [...days].sort().map((date) => { const r = byDate.get(date); return r ? { date, record: r, rate: rateOf(r), counts: countsOf(r) } : { date }; });
};

/** Summary of a range compared with the period before it. */
export function trendSummary(classRecords: AttRec[], range: TrendRange, today: string, policy?: SchoolPolicy | null) {
  const window = rangeWindow(range, today, policy);
  const records = inWindow(classRecords, window);
  const prev = inWindow(classRecords, previousWindow(window));
  const avg = averageRate(records);
  const previousAvg = prev.length ? averageRate(prev) : null;
  return { window, records, avg, previousAvg, delta: previousAvg === null ? null : avg - previousAvg, totals: totalsOf(records) };
}

export const minimumOf = (policy?: SchoolPolicy | null) => {
  const m = policy?.minimumAttendance;
  return typeof m === "number" && m >= 0 && m <= 100 ? m : 75;
};

// ---------------------------------------------------------------------------------------------------------------------
// Notify parent (notify_parent_sheet.dart): a teacher notice in `att_notices`, delivered to the parent app by
// functions/parent.js `onTeacherNoticeForParents`. Same keys as the app's ParentNotice + PrivateAdapter stamp.
// ---------------------------------------------------------------------------------------------------------------------

export const NOTICE_TEMPLATES = ["Low attendance", "Monday absences", "Welfare check"] as const;
export type NoticeTemplate = (typeof NOTICE_TEMPLATES)[number];
export const NOTICE_MAX = 500;

export function noticeText(t: NoticeTemplate, v: { name: string; roll?: number | string; guardian?: string; classLabel?: string; absent: number; mondays: number; minimum: number }) {
  const g = v.guardian?.trim() || "Parent";
  const who = `${v.name} (Roll #${v.roll ?? "—"}${v.classLabel ? `, Class ${v.classLabel}` : ""})`;
  if (t === "Monday absences") return `Dear ${g}, ${who} has missed ${v.mondays || "several"} Monday classes recently. Regular attendance matters for progress — please let us know if anything is affecting Mondays.`;
  if (t === "Welfare check") return `Dear ${g}, ${who} has been absent for the last few school days. Please let us know if everything is fine.`;
  return `Dear ${g}, ${who} has attendance below the required ${v.minimum}%${v.absent > 0 ? ` with ${v.absent} absences` : ""}. Regular attendance is important for progress — please make sure they attend every day.`;
}

/** Why the message cannot be sent ("" when it can). */
export const noticeError = (text: string) => !text.trim() ? "Write a message" : text.trim().length > NOTICE_MAX ? `Keep it under ${NOTICE_MAX} characters` : "";

/** digits of a phone number for a `tel:` link ("" when none) */
export const dialDigits = (phone?: string) => String(phone ?? "").replace(/[^0-9+]/g, "");

/** An `att_notices` body: the app's ParentNotice.toJson (+ `ord`, + `teacherId`; the store stamps updatedAt/updatedBy). */
export function parentNotice(v: { studentId: string; classId: string; channels: string[]; message: string; template?: string; staffId: string; at?: Date }) {
  const at = v.at ?? new Date();
  return {
    studentId: v.studentId, classId: v.classId, channels: v.channels, message: v.message.trim(), ...(v.template ? { template: v.template } : {}),
    auto: false, ack: false, ackRequested: false, at: at.toISOString(), ord: at.getTime() * 1000, teacherId: v.staffId,
  };
}
/** the app's local id shape for a new att_notices row (`uid('att')`) */
export const noticeId = (at = new Date()) => `att_${at.getTime().toString(36)}${Math.floor(Math.random() * (1 << 20)).toString(36)}`;
