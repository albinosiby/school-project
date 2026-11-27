// Pure helpers of the teacher's weekly timetable (own `ops_periods` with this week's substitutions overlaid).
import { subStatus, type Period, type Substitution } from "@/features/ops/logic";
import { activeSub, dayOfIso, periodClassId, weekOf } from "../teaching";
import { minutesOf, registerKey, type AttendanceClock } from "../attendance/logic";

export type Lesson = { key: string; kind: "period" | "sub"; day: string; period: number; classId: string; subject: string; room?: string; status?: string; subId?: string; topic?: string };

/** the week grid: own periods plus Assigned/Accepted substitutions dated inside the week of `today` */
export function weekLessons(periods: Period[], subs: Substitution[], today: string): Lesson[] {
  const week = weekOf(today);
  const own: Lesson[] = periods.map((p) => ({
    key: p.id, kind: "period", day: p.day, period: Number(p.period), classId: periodClassId(p), subject: p.subject || "", room: p.room || undefined,
  }));
  const covers: Lesson[] = subs
    .filter((s) => activeSub(s) && s.date >= week.from && s.date <= week.to)
    .map((s) => ({
      key: `sp_${s.id}`, kind: "sub", day: s.day || dayName(s.date), period: Number(s.period), classId: s.classId, subject: s.subject || "",
      status: subStatus(s.status), subId: s.id, topic: s.topic,
    }));
  return [...own, ...covers];
}

const dayName = (iso: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${iso}T12:00:00`).getDay()] ?? "";

/** lessons in one cell, substitutions first */
export const cellLessons = (lessons: Lesson[], day: string, period: number) =>
  lessons.filter((l) => l.day === day && l.period === period).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "sub" ? -1 : 1));

/** lessons of the day sorted by period (the "today" strip) */
export const dayLessons = (lessons: Lesson[], day: string) => lessons.filter((l) => l.day === day).sort((a, b) => a.period - b.period);

/** The lessons of one date (any week): own periods of that weekday plus Assigned/Accepted covers dated that day, covers
 * first when both fall in the same period and class, sorted by period (the app's daily timeline). */
export function lessonsOn(date: string, periods: Period[], subs: Substitution[]): Lesson[] {
  const day = dayOfIso(date);
  const covers: Lesson[] = subs.filter((s) => s.date === date && activeSub(s)).map((s) => ({
    key: `sp_${s.id}`, kind: "sub", day, period: Number(s.period), classId: s.classId, subject: s.subject || "", status: subStatus(s.status), subId: s.id, topic: s.topic,
  }));
  const own: Lesson[] = periods.filter((p) => p.day === day).map((p) => ({
    key: p.id, kind: "period", day, period: Number(p.period), classId: periodClassId(p), subject: p.subject || "", room: p.room || undefined,
  }));
  const seen = new Set<string>();
  return [...covers, ...own].filter((l) => { const k = `${l.period}_${l.classId}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.period - b.period);
}

export type LessonState = "done" | "live" | "upcoming";
/** where a lesson of `date` stands on the school clock (the app's `statusOf`) */
export function lessonState(date: string, bell: { from: string; to: string } | undefined, clock: Pick<AttendanceClock, "today" | "minute">): LessonState {
  if (date < clock.today) return "done";
  if (date > clock.today) return "upcoming";
  if (!bell) return "done";
  if (clock.minute >= minutesOf(bell.to)) return "done";
  return clock.minute >= minutesOf(bell.from) ? "live" : "upcoming";
}

/** a class lesson that has begun (today or earlier) and has no submitted register: show "Attendance not marked" + Mark */
export const needsMark = (date: string, lesson: Pick<Lesson, "classId" | "period">, state: LessonState, marked: Set<string>) =>
  !!lesson.classId && state !== "upcoming" && !marked.has(registerKey(date, lesson.classId, lesson.period));

/** /me/attendance with the class, period and date preselected */
export const markHref = (date: string, lesson: Pick<Lesson, "classId" | "period">) =>
  `/me/attendance?${new URLSearchParams({ class: lesson.classId, period: String(lesson.period), date }).toString()}`;
