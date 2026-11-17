"use client";

import Link from "next/link";
import { LoadingSkeleton, Badge, Button, Card } from "@/components/ui";
import { schoolDaySchedule, teachingPeriods, withTimetableBreaks, type ClassActivityConfig } from "@/features/ops/classActivity";
import { classDetailsHref, classTitle } from "@/features/ops/classDetails";
import { periodClass, type ClassRow, type Period } from "@/features/ops/logic";
import { DAY_NAMES } from "@/features/ops/shared";
import { TimetableBreakRow } from "@/features/ops/TimetableBreakRow";
import { classIdLabel } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";

type Teacher = { id: string; name: string };

export function StaffTimetable({ member, staff }: { member: Teacher; staff: Teacher[] }) {
  const identified = useCollection<Period>("ops_periods", true, [["teacherId", "==", member.id]]);
  // Older lessons have only a name. Never attribute them to two staff with the same name.
  const allowLegacy = Boolean(member.name) && staff.filter((row) => row.name === member.name).length === 1;
  const legacy = useCollection<Period>("ops_periods", allowLegacy, [["teacher", "==", member.name]]);
  const classes = useCollection<ClassRow>("classes");
  const config = useCollection<ClassActivityConfig>("set_config");
  const sources = [identified, classes, config, ...(allowLegacy ? [legacy] : [])];
  const error = sources.find((source) => source.error)?.error;
  const ready = sources.every((source) => source.ready);
  const lessons = [...new Map([
    ...identified.rows.filter((row) => row.teacherId === member.id),
    ...legacy.rows.filter((row) => allowLegacy && !row.teacherId && row.teacher === member.name),
  ].map((row) => [row.id, row])).values()];
  const schedule = schoolDaySchedule(config.rows.find((row) => row.id === "bell"));
  const periods = teachingPeriods(schedule);
  const days = [...DAY_NAMES, ...(lessons.some((row) => row.day === "Sun") ? ["Sun"] : [])];
  const active = lessons.filter((row) => periods.some((slot) => slot.period === Number(row.period)) && days.includes(row.day));
  const outside = lessons.filter((row) => !active.includes(row));
  const timeline = withTimetableBreaks(periods, schedule?.filter((slot) => slot.break) ?? []);
  const slots = (day: string, period: number) => active.filter((row) => row.day === day && Number(row.period) === period);
  const overlaps = days.reduce((count, day) => count + periods.filter((slot) => slots(day, slot.period).length > 1).length, 0);

  return <Card className="mb-5 min-w-0 overflow-hidden" role="region" aria-label="Teacher timetable">
    <div className="p-5">
      <h2 className="text-lg font-semibold">Teacher timetable</h2>
      <p className="mt-1 text-sm text-on-surface-variant">Recurring weekly lessons. Dated substitutions are shown on the class timetable.</p>
      {ready && !error && schedule && <p className="mt-2 text-sm text-on-surface-variant">{active.length} lessons per week · {periods.length} periods per day</p>}
    </div>
    {error ? <div className="px-5 pb-5">
      <p role="alert" className="mb-3 text-sm text-error">Could not load this teacher’s timetable. {error.message}</p>
      <Button size="sm" variant="outline" onClick={() => sources.forEach((source) => source.reload())}>Reload timetable</Button>
    </div> : !ready ? <LoadingSkeleton variant="table" label="Loading teacher timetable…" className="px-5 pb-5 text-sm text-on-surface-variant" />
      : !schedule ? <p role="alert" className="px-5 pb-5 text-sm text-warning">School bell timings are unavailable. <Link href="/settings?section=timetable#school-timings" className="font-semibold text-secondary hover:underline">Configure school hours &amp; breaks</Link>.</p>
        : <>
          {!active.length && <p className="px-5 pb-4 text-sm text-on-surface-variant">No weekly lessons assigned yet.</p>}
          {overlaps > 0 && <p role="note" className="mx-5 mb-4 rounded-lg bg-warning-container/40 p-3 text-sm text-warning">{overlaps} overlapping {overlaps === 1 ? "slot" : "slots"}. Review the lessons assigned at the same time.</p>}
          <div className="overflow-x-auto">
            <table aria-label="Teacher weekly timetable" className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
              <thead className="border-y border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant">
                <tr><th scope="col" className="w-32 p-3">Period / time</th>{days.map((day) => <th key={day} scope="col" className="p-3">{day}</th>)}</tr>
              </thead>
              <tbody>{timeline.map((entry) => {
                if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={days.length + 1} />;
                const { period, from, to } = entry.row;
                return <tr key={period} className="border-b border-outline-variant/40 last:border-0">
                  <th scope="row" className="p-3 align-top font-medium">Period {period}<div className="mt-1 text-xs font-normal tabular-nums text-on-surface-variant">{from}–{to}</div></th>
                  {days.map((day) => {
                    const rows = slots(day, period);
                    return <td key={day} className={`border-l border-outline-variant/30 p-3 align-top ${rows.length > 1 ? "bg-warning-container/20" : ""}`}>
                      {rows.length > 1 && <div className="mb-2"><Badge tone="warning">Overlap</Badge></div>}
                      {rows.length ? <ul className="space-y-3">{rows.map((row) => {
                        const classId = periodClass(row);
                        const cls = classes.rows.find((item) => item.id === classId);
                        const room = row.room || cls?.room;
                        return <li key={row.id} className="space-y-1 break-words">
                          <p className="font-semibold">{row.subject || "Subject not assigned"}</p>
                          <Link href={classDetailsHref(classId)} className="block text-xs font-medium text-secondary hover:underline">{cls ? classTitle(cls) : classIdLabel(classId)}</Link>
                          {room && <p className="text-xs text-on-surface-variant">Room {room}</p>}
                        </li>;
                      })}</ul> : <span className="text-xs text-outline">Free</span>}
                    </td>;
                  })}
                </tr>;
              })}</tbody>
            </table>
          </div>
          {outside.length > 0 && <p role="note" className="m-5 rounded-lg bg-warning-container/30 p-3 text-sm text-on-surface-variant">{outside.length} saved {outside.length === 1 ? "lesson is" : "lessons are"} outside the configured timetable. <Link href="/settings?section=timetable" className="font-semibold text-secondary hover:underline">Review in Settings → Timetable</Link>.</p>}
        </>}
  </Card>;
}
