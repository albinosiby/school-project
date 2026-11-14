"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input } from "@/components/ui";
import { schoolDaySchedule, teachingPeriods, withTimetableBreaks, type ClassActivityConfig, type PeriodClock } from "./classActivity";
import { TimetableBreakRow } from "./TimetableBreakRow";
import { classDay, teacherHref, type ClassAttendanceRecord, type ClassTeacher } from "./classDetails";
import { periodClass, type ClassRow, type Period, type Substitution } from "./logic";
import { SubstitutionsPanel } from "./SubstitutionsPanel";
import { dayOfIso } from "./shared";
import { classStream, streamFromClassId } from "@/lib/academicStreams";

const weekdayName = (date: string) => ({ Mon: "Monday", Tue: "Tuesday", Wed: "Wednesday", Thu: "Thursday", Fri: "Friday", Sat: "Saturday", Sun: "Sunday" })[dayOfIso(date)];
function dateTitle(date: string) {
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date
    ? parsed.toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }) : "Select a valid date";
}

export type ClassScheduleData = {
  classId: string; bell?: ClassActivityConfig; regional?: ClassActivityConfig; clock: PeriodClock;
  periods: Period[]; substitutions: Substitution[]; staff: ClassTeacher[]; attendance: ClassAttendanceRecord[];
};
export function TeacherName({ id, name }: { id?: string; name?: string }) {
  return id ? <Link href={teacherHref(id)} className="font-medium text-secondary hover:underline" onClick={(event) => event.stopPropagation()}>{name || "View teacher"}</Link> : <span>{name || "Not assigned"}</span>;
}
export function DailyPeriods({ data, date, onAssign }: { data: ClassScheduleData; date: string; onAssign?: (period: number) => void }) {
  const day = classDay(data.classId, date, data.bell, data.regional, data.periods, data.substitutions, data.staff, data.attendance);
  const hasLessons = day.rows.some((row) => row.lesson || row.record) || day.outsideRows.length > 0;
  const timeline = withTimetableBreaks(day.rows, day.breaks);
  return <>
    {day.nonWorkingDay && <p role="note" className="mx-4 mb-3 rounded-lg bg-surface-container-low px-3 py-2 text-sm text-on-surface-variant"><span className="font-semibold">Non-working day.</span> This date is a day off in the school settings. Saved lessons and attendance are shown for reference, using regular bell timings where available.</p>}
    {!day.scheduleAvailable && <p className="mb-3 text-sm text-warning">School bell timings are unavailable. Saved periods are shown below.</p>}
    {day.scheduleAvailable && day.rows.length > 0 && <p className="mb-3 px-4 text-xs text-on-surface-variant">{day.rows.length} periods in the configured school day. Empty lessons show “No class scheduled.”</p>}
    {hasLessons ? <div className="overflow-x-auto">
      <table aria-label="Daily periods" className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-y border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant"><tr>
          {["Period", "Time", "Subject", "Teacher", "Attendance", ...(onAssign ? ["Substitution"] : [])].map((name) => <th key={name} scope="col" className="px-4 py-3 font-medium">{name}</th>)}
        </tr></thead>
        <tbody className="divide-y divide-outline-variant/40">{timeline.map((entry) => {
          if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={onAssign ? 6 : 5}
            current={date === data.clock.date && data.clock.state === "break" && entry.row.from <= data.clock.time && data.clock.time < entry.row.to} />;
          const row = entry.row;
          const current = date === data.clock.date && data.clock.state === "period" && row.period === data.clock.period;
          return <tr key={row.id} className={current ? "bg-info-container/40" : undefined}>
            <th scope="row" className="px-4 py-3 font-medium"><div className="flex items-center gap-2">Period {row.period}{current && <Badge tone="info">Now</Badge>}</div></th>
            <td className="whitespace-nowrap px-4 py-3 text-xs tabular-nums text-on-surface-variant">{row.from && row.to ? `${row.from}–${row.to}` : "Not configured"}</td>
            <td className="px-4 py-3 font-medium">{row.lesson?.conflict ? <span className="text-warning">Timetable conflict</span> : row.lesson?.subject || "No class scheduled"}</td>
            <td className="px-4 py-3">{!row.lesson?.conflict && <TeacherName id={row.lesson?.teacherId} name={row.lesson?.teacher} />}{row.lesson?.substitute && <div className="mt-1"><Badge tone="warning">Substitute</Badge></div>}</td>
            <td className="px-4 py-3">{row.count?.state === "marked" ? <><span className="font-semibold tabular-nums">{row.count.present} / {row.count.total}</span><span className="ml-1 text-xs text-on-surface-variant">present</span></> :
              <span className="text-on-surface-variant">{row.record ? "Unavailable" : "Not marked"}</span>}</td>
            {onAssign && <td className="px-4 py-3"><Button size="sm" variant="outline" disabled={!row.lesson?.teacherId || row.lesson.conflict || date < data.clock.date}
              aria-label={`${row.lesson?.substitute ? "Reassign" : "Assign"} substitute for period ${row.period}`} onClick={() => onAssign(row.period)}>{row.lesson?.substitute ? "Reassign substitute" : "Assign substitute"}</Button></td>}
          </tr>;
        })}</tbody>
      </table>
    </div> : <EmptyState title={day.rows.length ? `No timetable configured for ${weekdayName(date) || "this day"}` : "No periods scheduled for this day"}
      hint={day.rows.length ? "Add this class’s weekly periods in Settings → Timetable. Saved lessons will appear on the matching weekday." : undefined} />}
    {!hasLessons && day.breaks.length > 0 && <p className="mt-3 px-4 text-xs text-on-surface-variant">{day.breaks.map((row) => `${row.label}: ${row.from}–${row.to}`).join(" · ")}</p>}
    {day.outsideRows.length > 0 && <section aria-label="Saved periods outside the bell schedule" className="mx-4 mt-4 rounded-lg border border-warning/30 bg-warning-container/30 p-4 text-sm">
      <h3 className="font-semibold">Saved periods outside the bell schedule</h3>
      <p className="mt-1 text-on-surface-variant">These records are kept for review. Add their timings under Settings → Timetable → School hours &amp; breaks, or correct the saved lessons.</p>
      <ul className="mt-2 space-y-1">{day.outsideRows.map((row) => <li key={row.id}>Period {row.period} · {row.lesson?.subject || "Saved attendance"}{row.lesson?.teacher ? ` · ${row.lesson.teacher}` : ""}</li>)}</ul>
    </section>}
  </>;
}

export function ClassTimetable({ data, initialDate, cls }: { data: ClassScheduleData; initialDate?: string; cls: ClassRow }) {
  const [pickedDate, setDate] = useState(initialDate || "");
  const date = pickedDate || data.clock.date;
  const staff = data.staff.map((member) => ({ ...member, department: member.department ?? "" }));
  const periods = data.periods.map((row) => row.teacherId ? row : { ...row, teacherId: data.staff.find((member) => member.name === row.teacher)?.id });
  const stream = classStream(cls) || streamFromClassId(cls.id);
  const settingsHref = `/settings?${new URLSearchParams({ section: "timetable", grade: cls.grade, division: cls.section, ...(stream ? { stream } : {}) })}`;
  return <div className="grid min-w-0 gap-5">
    <SubstitutionsPanel key={`${data.classId}:${date}`} classId={data.classId} date={date} today={data.clock.date} staff={staff} periods={periods}
      renderPeriods={(assign, ready) => <Card className="min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-lg font-semibold">Daily timetable & substitutions</h2>
          <p className="mt-1 text-sm text-on-surface-variant">Choose a date, then assign a substitute for the required period.</p></div>
          <Field label="Timetable date"><Input type="date" value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} /></Field></div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-outline-variant/40 px-5 py-3 text-sm">
          <p role="status" className="font-medium">{dateTitle(date)}</p><Link href={settingsHref} className="font-semibold text-secondary hover:underline">Configure weekly timetable</Link>
        </div>
        <div className="pb-4"><DailyPeriods data={data} date={date} onAssign={ready ? assign : undefined} /></div>
      </Card>} />
    <WeeklyTimetable data={data} selectedDay={dayOfIso(date)} />
  </div>;
}

export function WeeklyTimetable({ data, selectedDay }: { data: ClassScheduleData; selectedDay?: string }) {
  const schedule = schoolDaySchedule(data.bell);
  const rows = data.periods.filter((row) => periodClass(row) === data.classId);
  const numbers = schedule ? teachingPeriods(schedule).map((slot) => slot.period) : [...new Set(rows.map((row) => Number(row.period)))].sort((a, b) => a - b);
  const outside = schedule ? rows.filter((row) => !numbers.includes(Number(row.period))) : [];
  const timeline = withTimetableBreaks(numbers.map((period) => {
    const time = schedule?.find((slot) => slot.label === `Period ${period}`);
    return { period, from: time?.from, to: time?.to };
  }), schedule?.filter((slot) => slot.break) ?? []);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", ...(rows.some((row) => row.day === "Sun") ? ["Sun"] : [])];
  return <Card role="region" aria-label="Weekly timetable" className="min-w-0 overflow-hidden">
    <div className="p-5"><h2 className="text-lg font-semibold">Weekly timetable</h2><p className="mt-1 text-sm text-on-surface-variant">{numbers.length} periods per day. Recurring subjects and teachers for this class. Daily substitutions appear in the day view.</p></div>
    {!rows.length ? <EmptyState title="No timetable saved" hint="Add this class’s weekly periods in Settings → Timetable." /> :
      <div className="overflow-x-auto"><table aria-label="Weekly timetable" className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
        <thead className="border-y border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant"><tr><th scope="col" className="w-32 p-3">Period</th>{days.map((day) => <th key={day} scope="col" className={`p-3 ${selectedDay === day ? "bg-info-container text-secondary" : ""}`}>{day}{selectedDay === day && <span className="mt-1 block text-xs font-normal">Selected day</span>}</th>)}</tr></thead>
        <tbody>{timeline.map((entry) => {
          if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={days.length + 1} />;
          const { period, from, to } = entry.row;
          return <tr key={period} className="border-b border-outline-variant/40 last:border-0">
            <th scope="row" className="p-3 align-top font-medium">Period {period}<div className="mt-1 text-xs font-normal tabular-nums text-on-surface-variant">{from && to ? `${from}–${to}` : "Time unavailable"}</div></th>
            {days.map((day) => {
              const slots = rows.filter((row) => row.day === day && Number(row.period) === period);
              const row = slots[0];
              const member = data.staff.find((member) => row?.teacherId ? member.id === row.teacherId : member.name === row?.teacher);
              return <td key={day} className={`border-l border-outline-variant/30 p-3 align-top ${selectedDay === day ? "bg-info-container/30" : ""}`}>
                {slots.length > 1 ? <span className="text-warning">Timetable conflict</span> : row ? <div className="space-y-2 break-words">
                  <p className="font-semibold">{row.subject}</p><p className="text-xs"><TeacherName id={member?.id || row.teacherId} name={member?.name || row.teacher} /></p>
                  {row.room && <p className="text-xs text-on-surface-variant">Room {row.room}</p>}
                </div> : <span className="text-outline">—</span>}
              </td>;
            })}
          </tr>;
        })}</tbody>
      </table></div>}
    {outside.length > 0 && <div role="note" className="m-4 rounded-lg bg-warning-container/30 p-3 text-sm text-on-surface-variant">{outside.length} saved lesson{outside.length === 1 ? " uses" : "s use"} periods outside the current bell schedule ({[...new Set(outside.map((row) => row.period))].sort((a, b) => a - b).join(", ")}). Review these in Settings → Timetable; they are kept separately from the configured periods.</div>}
  </Card>;
}
