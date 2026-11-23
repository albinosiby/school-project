"use client";
// /me/timetable: the teacher's weekly grid (Mon–Sat × bell periods) of own `ops_periods` with this week's
// substitution duties (`ops_substitutions`, substituteTeacherId == me, Assigned/Accepted) overlaid.
import Link from "next/link";
import { Badge, Card, CardHeader, EmptyState, LoadingSkeleton, PageHeader } from "@/components/ui";
import { TimetableBreakRow } from "@/features/ops/TimetableBreakRow";
import { bellTimeline, classIdLabel, dayOfIso, todayIso, useTeachingData, weekOf } from "../teaching";
import { cellLessons, dayLessons, weekLessons, type Lesson } from "./logic";

function LessonItem({ lesson, room }: { lesson: Lesson; room?: string }) {
  return <li className="space-y-1 break-words">
    <p className="font-semibold">{lesson.subject || "Subject not assigned"}</p>
    <p className="text-xs font-medium text-secondary">{classIdLabel(lesson.classId)}</p>
    {lesson.kind === "sub" && <Badge tone={lesson.status === "Accepted" ? "success" : "warning"}>Substitution · {lesson.status}</Badge>}
    {(lesson.room || room) && <p className="text-xs text-on-surface-variant">Room {lesson.room || room}</p>}
  </li>;
}

export function MyTimetable() {
  const data = useTeachingData();
  const today = todayIso();
  const week = weekOf(today);
  const todayDay = dayOfIso(today);
  if (!data.teaching) return <EmptyState title="Only teachers have a timetable" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready) return <LoadingSkeleton variant="table" label="Loading your timetable…" />;
  const lessons = weekLessons(data.periods, data.subs, today);
  const { periods, timeline } = bellTimeline(data.policy);
  const outside = lessons.filter((l) => !periods.some((slot) => slot.period === l.period) || !week.days.includes(l.day as never));
  const todays = dayLessons(lessons, todayDay);
  const covers = lessons.filter((l) => l.kind === "sub").length;

  return <div className="space-y-5">
    <PageHeader title="My timetable" subtitle={`Week of ${week.from} · ${lessons.length - covers} lessons${covers ? ` · ${covers} substitution${covers === 1 ? "" : "s"}` : ""}`} />
    <Card>
      <CardHeader title={`Today · ${todayDay} ${today}`} subtitle={todays.length ? `${todays.length} ${todays.length === 1 ? "lesson" : "lessons"}` : "No lessons today"} />
      {todays.length > 0 && <ul className="flex flex-wrap gap-2 px-5 pb-5" aria-label="Today's lessons">
        {todays.map((l) => <li key={l.key} className="rounded-lg border border-outline-variant/60 px-3 py-2 text-sm">
          <span className="font-semibold">P{l.period}</span> · {l.subject || "—"} · {classIdLabel(l.classId)}{l.kind === "sub" && <Badge tone="warning" className="ml-2">Sub</Badge>}
        </li>)}
      </ul>}
    </Card>
    <Card className="min-w-0 overflow-hidden" role="region" aria-label="Weekly timetable">
      {!lessons.length && <EmptyState title="No lessons this week" hint="Your periods appear here once the school publishes the master timetable." />}
      {lessons.length > 0 && <div className="overflow-x-auto">
        <table aria-label="My weekly timetable" className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
          <thead className="border-y border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant">
            <tr><th scope="col" className="w-32 p-3">Period / time</th>
              {week.days.map((day) => <th key={day} scope="col" className={`p-3 ${day === todayDay ? "text-secondary" : ""}`}>{day}<div className="font-normal tabular-nums">{week.dates[day]}</div></th>)}</tr>
          </thead>
          <tbody>{timeline.map((entry) => {
            if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={week.days.length + 1} />;
            const { period, from, to } = entry.row;
            return <tr key={period} className="border-b border-outline-variant/40 last:border-0">
              <th scope="row" className="p-3 align-top font-medium">Period {period}<div className="mt-1 text-xs font-normal tabular-nums text-on-surface-variant">{from}–{to}</div></th>
              {week.days.map((day) => {
                const rows = cellLessons(lessons, day, period);
                return <td key={day} className={`border-l border-outline-variant/30 p-3 align-top ${day === todayDay ? "bg-info-container/20" : ""}`}>
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
  </div>;
}
