// Pure helpers of the teacher's weekly timetable (own `ops_periods` with this week's substitutions overlaid).
import { subStatus, type Period, type Substitution } from "@/features/ops/logic";
import { activeSub, periodClassId, weekOf } from "../teaching";

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
