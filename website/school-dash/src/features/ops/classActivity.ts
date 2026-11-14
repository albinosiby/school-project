import { buildSchedule, bellError, type BellBreak } from "@/features/onboarding/bellSchedule";
import { derive, isCounted, latestRecord, PERIOD_TIMES, periodClass, subStatus, type AttRec, type Period, type Substitution } from "./logic";
import { schoolTimeZone } from "../../../../functions/schoolTime";

export type ClassActivityConfig = {
  id: string; timezone?: string; workingWeek?: string;
  gates?: string; start?: string; end?: string; periodCount?: number; periodLength?: number; breaks?: BellBreak[];
};
export type PeriodClock = {
  date: string; day: string; time: string; label: string; period?: number; from?: string; to?: string;
  state: "period" | "break" | "outside" | "unavailable";
};
export type CurrentLesson = { subject?: string; teacher?: string; teacherId?: string; substitute?: boolean; conflict?: boolean };
export type PeriodAttendance = { state: "marked"; present: number; total: number } | { state: "unavailable" };
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function workingDay(date: string, day: string, setting = "Mon – Sat") {
  const range = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*\s*(?:–|—|-|to)\s*(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\w*/i.exec(setting);
  const index = DAYS.indexOf(day);
  if (range) {
    const start = DAYS.findIndex((value) => value.toLowerCase() === range[1]!.toLowerCase());
    const end = DAYS.findIndex((value) => value.toLowerCase() === range[2]!.toLowerCase());
    if (start <= end ? index < start || index > end : index < start && index > end) return false;
  } else if (day === "Sun") return false;
  if (day === "Sat" && /2nd\s*(?:&|and|,)\s*4th\s+Saturday\s+Off/i.test(setting)) {
    const week = Math.ceil(Number(date.slice(-2)) / 7);
    if (week === 2 || week === 4) return false;
  }
  return true;
}

export type SchoolSlot = { label: string; from: string; to: string; break?: boolean; gap?: boolean };

export function teachingPeriods(schedule: SchoolSlot[] | undefined) {
  return (schedule ?? []).flatMap((slot) => {
    const match = /^Period (\d+)$/.exec(slot.label);
    return match ? [{ period: Number(match[1]), from: slot.from, to: slot.to }] : [];
  });
}

/** Keep saved period numbers intact while inserting only the school's configured breaks. */
export function withTimetableBreaks<T extends { period: number; from?: string }>(periods: T[], breaks: SchoolSlot[]) {
  return [
    ...periods.map((row) => ({ kind: "period" as const, row })),
    ...breaks.map((row) => ({ kind: "break" as const, row })),
  ].sort((a, b) => (a.row.from ?? "99:99").localeCompare(b.row.from ?? "99:99") ||
    (a.kind === "period" && b.kind === "period" ? a.row.period - b.row.period : 0));
}

/** The same validated school bells drive the class cards, daily periods and weekly timetable. */
export function schoolDaySchedule(bell?: ClassActivityConfig): SchoolSlot[] | undefined {
  let rows: { label: string; from: string; to: string; break?: boolean; gap?: boolean }[];
  const structured = bell && [bell.start, bell.end, bell.periodCount, bell.periodLength, bell.breaks].some((value) => value !== undefined);
  if (structured) {
    if (bell.breaks !== undefined && (!Array.isArray(bell.breaks) || bell.breaks.some((item) =>
      !item || typeof item.name !== "string" || typeof item.start !== "string" || typeof item.duration !== "number"))) {
      return undefined;
    }
    // Gate-opening text is not needed to determine a teaching period.
    const schedule = { gates: "00:00", start: bell.start ?? "", end: bell.end ?? "", periods: bell.periodCount ?? 0, len: bell.periodLength ?? 0, breaks: bell.breaks ?? [] };
    if (bellError(schedule)) return undefined;
    rows = buildSchedule(schedule).rows;
  } else {
    // Older schools use the same default bells shown by the existing timetable and mobile apps.
    rows = PERIOD_TIMES.map((from, index) => {
      const [hours, minutes] = from.split(":").map(Number);
      const end = hours * 60 + minutes + 45;
      return { label: `Period ${index + 1}`, from, to: `${String(Math.floor(end / 60)).padStart(2, "0")}:${String(end % 60).padStart(2, "0")}` };
    });
  }
  return rows;
}

/** Use the school's regional time, never the viewer's browser time zone. */
export function currentPeriodClock(now: number, bell?: ClassActivityConfig, regional?: ClassActivityConfig): PeriodClock {
  const unavailable: PeriodClock = { date: "", day: "", time: "", label: "Schedule unavailable", state: "unavailable" };
  const configuredZone = regional?.timezone?.trim();
  const timeZone = !configuredZone || /^[IG]ST\b|New Delhi|Dubai/i.test(configuredZone) ? schoolTimeZone(configuredZone) : configuredZone;
  let date: string, day: string, time: string;
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const part = (key: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === key)!.value;
    date = `${part("year")}-${part("month")}-${part("day")}`;
    day = part("weekday"); time = `${part("hour")}:${part("minute")}`;
  } catch { return unavailable; }
  const base = { date, day, time };
  if (!workingDay(date, day, regional?.workingWeek)) return { ...base, label: "No class now", state: "outside" };

  const rows = schoolDaySchedule(bell);
  if (!rows) return { ...unavailable, ...base };
  const row = rows.find((entry) => entry.from <= time && time < entry.to);
  if (!row) {
    const between = rows.length > 0 && rows[0]!.from <= time && time < rows.at(-1)!.to;
    return { ...base, label: between ? "Break" : "No class now", state: between ? "break" : "outside" };
  }
  if (row.break || row.gap) return { ...base, label: row.gap ? "No class now" : row.label, state: row.gap ? "outside" : "break", from: row.from, to: row.to };
  const period = Number(/^Period (\d+)$/.exec(row.label)?.[1]);
  return period ? { ...base, label: row.label, period, from: row.from, to: row.to, state: "period" } : { ...unavailable, ...base };
}

/** Timetable lessons and cover for this date/period, grouped by exact class id (including senior streams). */
export function currentLessons(clock: PeriodClock, periods: Period[], substitutions: Substitution[], staff: { id: string; name: string }[]) {
  const result = new Map<string, CurrentLesson>();
  if (clock.state !== "period") return result;
  const names = new Map(staff.map((member) => [member.id, member.name]));
  for (const row of periods) {
    if (row.day !== clock.day || Number(row.period) !== clock.period) continue;
    const id = periodClass(row);
    const teacherId = row.teacherId || staff.find((member) => member.name === row.teacher)?.id;
    result.set(id, result.has(id) ? { conflict: true } : { subject: row.subject, teacher: names.get(teacherId ?? "") || row.teacher, teacherId });
  }
  const covered = new Set<string>();
  for (const row of substitutions) {
    if (row.date !== clock.date || Number(row.period) !== clock.period || subStatus(row.status) === "Declined" || !row.substituteTeacherId) continue;
    const previous = result.get(row.classId);
    result.set(row.classId, covered.has(row.classId) || previous?.conflict ? { conflict: true } : {
      subject: row.subject || previous?.subject, teacher: names.get(row.substituteTeacherId), teacherId: row.substituteTeacherId, substitute: true,
    });
    covered.add(row.classId);
  }
  return result;
}

/** Only this period's submitted roll decides its count. Never fall back to another period or the previous day. */
export function currentPeriodAttendance(clock: PeriodClock, rows: AttRec[]) {
  const result = new Map<string, PeriodAttendance>();
  if (clock.state !== "period") return result;
  const chosen = new Map<string, AttRec>();
  for (const row of rows) {
    if (row.date !== clock.date || Number(row.period) !== clock.period || !isCounted(row)) continue;
    const latest = latestRecord([...(chosen.has(row.classId) ? [chosen.get(row.classId)!] : []), row]);
    if (latest) chosen.set(row.classId, latest);
  }
  chosen.forEach((row, id) => {
    const total = Number(row.total), marks = row.marks ?? {};
    const invalid = !Number.isInteger(total) || total < 0 || typeof marks !== "object" || Array.isArray(marks)
      || Object.keys(marks).length > total || Object.values(marks).some((mark) => !["P", "A", "L", "E"].includes(mark));
    if (invalid) { result.set(id, { state: "unavailable" }); return; }
    const counts = derive(row);
    result.set(id, { state: "marked", present: counts.P + counts.L, total: counts.total });
  });
  return result;
}
