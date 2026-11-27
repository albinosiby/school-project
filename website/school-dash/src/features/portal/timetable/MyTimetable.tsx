"use client";
// /me/timetable: the teacher's day (teacher app timetable_screen.dart) and weekly grid (Mon–Sat × bell periods) of own
// `ops_periods` with substitution duties (`ops_substitutions`, substituteTeacherId == me, Assigned/Accepted) overlaid.
// Each class of today or an earlier day without a submitted register shows "Attendance not marked" and a Mark button
// (to /me/attendance with class, period and date preselected); the week strip and the calendar put a red dot on school
// days with attendance still to mark; the calendar picks one day or a range of days.
import { useState } from "react";
import Link from "next/link";
import { AlertCircle, CalendarDays, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, UserCheck, X } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, LoadingSkeleton, PageHeader } from "@/components/ui";
import type { AttRec } from "@/features/ops/logic";
import { TimetableBreakRow } from "@/features/ops/TimetableBreakRow";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { bellTimeline, classIdLabel, dayOfIso, useTeachingData, weekOf } from "../teaching";
import { CalendarDialog, type CalendarPick } from "../attendance/AttendanceCalendar";
import { addDays, countsOf, fmtDay, isoWeekday, mondayOfIso, schoolDaysIn, attendanceId } from "../attendance/logic";
import { useAttendanceFlags } from "../attendance/useAttendanceFlags";
import { cellLessons, lessonState, lessonsOn, markHref, needsMark, weekLessons, type Lesson } from "./logic";

function LessonItem({ lesson, room }: { lesson: Lesson; room?: string }) {
  return <li className="space-y-1 break-words">
    <p className="font-semibold">{lesson.subject || "Subject not assigned"}</p>
    <p className="text-xs font-medium text-secondary">{classIdLabel(lesson.classId)}</p>
    {lesson.kind === "sub" && <Badge tone={lesson.status === "Accepted" ? "success" : "warning"}>Substitution · {lesson.status}</Badge>}
    {(lesson.room || room) && <p className="text-xs text-on-surface-variant">Room {lesson.room || room}</p>}
  </li>;
}

type Data = ReturnType<typeof useTeachingData>;
type Flags = ReturnType<typeof useAttendanceFlags>;

/** One day's lessons as a timeline with the attendance state of each class. */
function DayTimeline({ date, data, flags, records, label }: { date: string; data: Data; flags: Flags; records: AttRec[]; label: string }) {
  const lessons = lessonsOn(date, data.periods, data.subs);
  const bells = bellTimeline(data.policy).periods;
  if (!lessons.length) return <p className="px-5 pb-5 text-sm text-on-surface-variant">No periods on this day.</p>;
  return <ol className="space-y-2.5 px-5 pb-5" aria-label={label}>
    {lessons.map((l) => {
      const bell = bells.find((b) => b.period === l.period);
      const state = lessonState(date, bell, flags.clock);
      const rec = records.find((r) => r.id === attendanceId(date, l.classId, l.period));
      const submitted = !!rec && rec.submitted !== false && rec.deleted !== true;
      const todo = needsMark(date, l, state, flags.marked);
      const draft = todo && !!rec && rec.submitted === false;
      const c = submitted ? countsOf(rec) : undefined;
      const room = l.room || data.classOf(l.classId)?.room;
      return <li key={l.key} className={cn("relative rounded-xl border bg-surface-container-lowest p-3.5 pl-4 transition-colors",
        state === "live" ? "border-secondary/50 bg-info-container/25" : "border-outline-variant/60")}>
        <span aria-hidden className={cn("absolute inset-y-3 left-0 w-1 rounded-r", l.kind === "sub" ? "bg-warning" : "bg-secondary/70")} />
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
          <div className="w-14 shrink-0 text-xs tabular-nums text-on-surface-variant">
            <p className="font-semibold text-on-surface">P{l.period}</p>{bell && <p>{bell.from}</p>}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{l.subject || "Subject not assigned"}</p>
            <p className="text-xs text-on-surface-variant">
              <span>P{l.period} · {l.subject || "—"} · {classIdLabel(l.classId)}</span>{room ? ` · Room ${room}` : ""}{c ? ` · Present ${c.present + c.late}/${c.total}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {l.kind === "sub" && <Badge tone="warning">Sub duty</Badge>}
            {state === "live" ? <Badge tone="brand">Now</Badge> : state === "done" ? <Badge tone="success">Done</Badge> : <Badge tone="neutral">Upcoming</Badge>}
          </div>
        </div>
        {todo && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-outline-variant/40 pt-3">
          <AlertCircle size={15} className={draft ? "text-warning" : "text-error"} />
          <span className={cn("flex-1 text-xs font-semibold", draft ? "text-warning" : "text-error")}>{draft ? "Draft saved · not submitted" : "Attendance not marked"}</span>
          <Link href={markHref(date, l)} aria-label={`Mark attendance for ${classIdLabel(l.classId)} period ${l.period}`}
            className="inline-flex h-8 items-center gap-1.5 rounded bg-secondary px-3 text-xs font-semibold text-on-secondary shadow-card hover:bg-secondary-container">
            <UserCheck size={14} />{draft ? "Finish" : "Mark attendance"}
          </Link>
        </div>}
      </li>;
    })}
  </ol>;
}

export function MyTimetable() {
  const data = useTeachingData();
  const att = useCollection<AttRec>("ops_attendance", data.teaching);
  const flags = useAttendanceFlags(data, att.rows);
  const today = flags.clock.today;
  const [picked, setPicked] = useState<string | null>(null);
  const [range, setRange] = useState<{ from: string; to: string } | null>(null);
  const [calendar, setCalendar] = useState(false);
  const date = picked ?? today;
  if (!data.teaching) return <EmptyState title="Only teachers have a timetable" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !att.ready) return <LoadingSkeleton variant="table" label="Loading your timetable…" />;

  const week = weekOf(date);
  const todayDay = dayOfIso(today);
  const lessons = weekLessons(data.periods, data.subs, date);
  const { periods, timeline } = bellTimeline(data.policy);
  const outside = lessons.filter((l) => !periods.some((slot) => slot.period === l.period) || !week.days.includes(l.day as never));
  const covers = lessons.filter((l) => l.kind === "sub").length;
  const workingDays = flags.clock.workingDays;
  const monday = mondayOfIso(date);
  const strip = workingDays.filter((d) => d <= 7).map((d) => addDays(monday, d - 1));
  const isToday = date === today;
  const missingOn = (d: string) => flags.missingOn(d).length > 0;
  const pick = (p: CalendarPick) => {
    setPicked(p.from);
    setRange(p.to ? { from: p.from, to: p.to } : null);
  };
  const dateLabel = range ? `${fmtDay(range.from)} – ${fmtDay(range.to)} ${range.to.slice(0, 4)}` : isToday ? `Today, ${fmtDay(date).slice(5)}` : `${fmtDay(date)} ${date.slice(0, 4)}`;
  const rangeDays = range ? schoolDaysIn(range.from, range.to, workingDays) : [];
  const rangeMissing = rangeDays.filter(missingOn).length;

  return <div className="space-y-5">
    <PageHeader title="My timetable" subtitle={`Week of ${week.from} · ${lessons.length - covers} lessons${covers ? ` · ${covers} substitution${covers === 1 ? "" : "s"}` : ""}`} />

    <div className="flex flex-wrap items-center gap-2">
      <button type="button" aria-haspopup="dialog" onClick={() => setCalendar(true)} aria-label={`Calendar: ${dateLabel}`}
        className="flex h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 text-left shadow-card hover:bg-surface-container-low sm:max-w-sm">
        <CalendarDays size={18} className="shrink-0 text-secondary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{dateLabel}</span>
        <ChevronDown size={16} className="text-outline" />
      </button>
      {(range || !isToday) && <Button variant="outline" onClick={() => { setPicked(null); setRange(null); }}>Today</Button>}
      {flags.allMissing.length > 0 && <span className="inline-flex items-center gap-1.5 rounded-full bg-error-container/50 px-3 py-1 text-xs font-semibold text-error">
        <span aria-hidden className="size-1.5 rounded-full bg-error" />{flags.allMissing.length} {flags.allMissing.length === 1 ? "day" : "days"} to mark
      </span>}
    </div>

    {range ? <Card role="region" aria-label="Selected days">
      <CardHeader title={`${rangeDays.length} school ${rangeDays.length === 1 ? "day" : "days"}`}
        subtitle={<span className={rangeMissing ? "font-semibold text-error" : "font-semibold text-success"}>{rangeMissing ? `${rangeMissing} ${rangeMissing === 1 ? "day has" : "days have"} attendance to mark` : "All attendance marked"}</span>}
        actions={<Button variant="ghost" size="sm" onClick={() => setRange(null)}><X size={14} />Clear</Button>} />
      <div className="space-y-1">
        {rangeDays.map((d) => <section key={d} aria-label={fmtDay(d)}>
          <button type="button" onClick={() => { setRange(null); setPicked(d); }}
            className="flex w-full cursor-pointer items-center gap-2 border-t border-outline-variant/40 px-5 py-3 text-left hover:bg-surface-container-low">
            <span className={cn("font-semibold", d === today && "text-secondary")}>{fmtDay(d)}{d === today ? " · Today" : ""}</span>
            <span className="text-xs text-on-surface-variant">{lessonsOn(d, data.periods, data.subs).length} periods</span>
            <span className="flex-1" />
            {missingOn(d) && <Badge tone="danger">To mark</Badge>}
            <ChevronRight size={16} className="text-outline" />
          </button>
          <DayTimeline date={d} data={data} flags={flags} records={att.rows} label={`Lessons on ${fmtDay(d)}`} />
        </section>)}
      </div>
    </Card> : <Card role="region" aria-label="Daily view">
      <div className="flex items-center gap-1 px-3 pt-3 sm:px-5">
        <Button variant="ghost" size="sm" aria-label="Previous week" onClick={() => setPicked(addDays(date, -7))}><ChevronLeft size={16} /></Button>
        <ul className="grid min-w-0 flex-1 gap-1" style={{ gridTemplateColumns: `repeat(${strip.length || 1}, minmax(0, 1fr))` }} aria-label="Week">
          {strip.map((d) => {
            const on = d === date, dot = missingOn(d), count = lessonsOn(d, data.periods, data.subs).length;
            return <li key={d}>
              <button type="button" onClick={() => setPicked(d)} aria-pressed={on}
                aria-label={`${fmtDay(d)}, ${count} periods${d === today ? ", today" : ""}${dot ? ", attendance not marked" : ""}`}
                className={cn("relative flex w-full cursor-pointer flex-col items-center rounded-xl py-2 transition-colors",
                  on ? "bg-secondary text-on-secondary shadow-card" : d === today ? "bg-info-container/50 text-secondary" : "hover:bg-surface-container")}>
                <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">{fmtDay(d).slice(0, 3)}</span>
                <span className="text-lg font-bold tabular-nums leading-6">{Number(d.slice(8))}</span>
                <span className="text-[10px] opacity-75">{count}p</span>
                {dot && <span data-testid={`missing-${d}`} aria-hidden className={cn("absolute right-1.5 top-1.5 size-2 rounded-full ring-2", on ? "bg-error-container ring-secondary" : "bg-error ring-surface-container-lowest")} />}
              </button>
            </li>;
          })}
        </ul>
        <Button variant="ghost" size="sm" aria-label="Next week" onClick={() => setPicked(addDays(date, 7))}><ChevronRight size={16} /></Button>
      </div>
      <CardHeader title={isToday ? `Today · ${todayDay} ${today}` : `${fmtDay(date)} ${date.slice(0, 4)}`}
        subtitle={workingDays.includes(isoWeekday(date)) ? (() => { const n = lessonsOn(date, data.periods, data.subs).length; return n ? `${n} ${n === 1 ? "lesson" : "lessons"}` : "No lessons"; })() : "Not a school day"}
        actions={missingOn(date) ? <Badge tone="danger">Attendance to mark</Badge> : date <= today && lessonsOn(date, data.periods, data.subs).length ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-success"><CheckCircle2 size={14} />Marked</span> : undefined} />
      <DayTimeline date={date} data={data} flags={flags} records={att.rows} label={isToday ? "Today's lessons" : `Lessons on ${fmtDay(date)}`} />
    </Card>}

    <Card className="min-w-0 overflow-hidden" role="region" aria-label="Weekly timetable">
      <CardHeader title="Weekly grid" subtitle={`${week.from} – ${week.to}`} />
      {!lessons.length && <EmptyState title="No lessons this week" hint="Your periods appear here once the school publishes the master timetable." />}
      {lessons.length > 0 && <div className="overflow-x-auto">
        <table aria-label="My weekly timetable" className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
          <thead className="border-y border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant">
            <tr><th scope="col" className="w-32 p-3">Period / time</th>
              {week.days.map((day) => <th key={day} scope="col" className={`p-3 ${week.dates[day] === today ? "text-secondary" : ""}`}>
                <span className="inline-flex items-center gap-1">{day}{missingOn(week.dates[day]) && <span aria-label="attendance not marked" className="size-1.5 rounded-full bg-error" />}</span>
                <div className="font-normal tabular-nums">{week.dates[day]}</div></th>)}</tr>
          </thead>
          <tbody>{timeline.map((entry) => {
            if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={week.days.length + 1} />;
            const { period, from, to } = entry.row;
            return <tr key={period} className="border-b border-outline-variant/40 last:border-0">
              <th scope="row" className="p-3 align-top font-medium">Period {period}<div className="mt-1 text-xs font-normal tabular-nums text-on-surface-variant">{from}–{to}</div></th>
              {week.days.map((day) => {
                const rows = cellLessons(lessons, day, period);
                return <td key={day} className={`border-l border-outline-variant/30 p-3 align-top ${week.dates[day] === today ? "bg-info-container/20" : ""}`}>
                  {rows.length ? <ul className="space-y-3">{rows.map((l) => <LessonItem key={l.key} lesson={l} room={data.classOf(l.classId)?.room} />)}</ul> : <span className="text-xs text-outline">Free</span>}
                </td>;
              })}
            </tr>;
          })}</tbody>
        </table>
      </div>}
      {outside.length > 0 && <p role="note" className="m-5 rounded-lg bg-warning-container/30 p-3 text-sm text-on-surface-variant">
        {outside.length} {outside.length === 1 ? "lesson is" : "lessons are"} outside the school bell schedule: {outside.map((l) => `${l.day} P${l.period} ${l.subject}`).join(", ")}.
      </p>}
    </Card>
    <p className="text-sm text-on-surface-variant">Substitution duties can be accepted or declined under <Link href="/me/substitutions" className="font-semibold text-secondary hover:underline">Substitutions</Link>.</p>
    <CalendarDialog open={calendar} onClose={() => setCalendar(false)} from={range?.from ?? date} to={range?.to} today={today}
      workingDays={workingDays} missing={missingOn} onApply={pick} />
  </div>;
}
