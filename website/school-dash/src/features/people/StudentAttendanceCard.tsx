"use client";

import Link from "next/link";
import { LoadingSkeleton, Button, Card } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { todayIso } from "@/features/ops/shared";
import { attendanceAcademicRange, recordedAttendance, type StudentAttendanceMonth } from "./studentAttendance";

type Term = { id: string; start?: string; end?: string };

export function StudentAttendanceCard({ student }: { student: { id: string; admissionDate?: string } }) {
  const attendance = useCollection<StudentAttendanceMonth>("par_attendance", true, [["studentId", "==", student.id]]);
  const terms = useCollection<Term>("set_terms");
  const school = useCollection<{ id: string; academicYear?: string }>("school");
  const year = school.rows.find((row) => row.id === "school")?.academicYear;
  const range = attendanceAcademicRange(terms.rows);
  const ready = attendance.ready && terms.ready && school.ready;
  const failed = attendance.error || terms.error || school.error;
  const recorded = ready && range ? recordedAttendance(attendance.rows, [student], {
    start: range.start, end: range.end < todayIso() ? range.end : todayIso(),
  }).get(student.id) ?? { days: 0, attended: 0, pct: 0 } : undefined;
  const notAttended = recorded ? recorded.days - recorded.attended : 0;
  const pct = recorded?.pct;

  return <Card className="p-5">
    <h2 className="t-label-caps text-on-surface-variant">Attendance</h2>
    <p className="mt-1 text-sm text-on-surface-variant">Overall academic attendance{year ? ` · AY ${year}` : ""}</p>
    <div className="mt-5 flex flex-wrap items-center gap-5 sm:gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 140 140" role="img" aria-label={recorded
          ? `Academic attendance: ${pct}%, ${recorded.attended} of ${recorded.days} recorded days attended`
          : "Academic attendance unavailable"} className="size-full -rotate-90">
          <circle cx="70" cy="70" r="52" fill="none" strokeWidth="18" className="stroke-surface-container" />
          {recorded && recorded.days > 0 && <circle cx="70" cy="70" r="52" fill="none" strokeWidth="18" pathLength="100"
            strokeDasharray={`${recorded.attended * 100 / recorded.days} 100`} className="stroke-success" />}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular-nums">{pct === undefined ? "—" : `${pct}%`}</span>
          <span className="mt-1 text-xs text-on-surface-variant">Attendance</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 basis-44 text-sm">
        {failed ? <div role="alert">
          <p>Could not load academic attendance.</p>
          <Button size="sm" variant="outline" className="mt-2" onClick={() => {
            if (attendance.error) attendance.reload();
            if (terms.error) terms.reload();
            if (school.error) school.reload();
          }}>Retry</Button>
        </div> : !ready ? <LoadingSkeleton variant="inline" label="Loading attendance…" /> : !range ? <>
          <p>Academic year dates are not configured.</p>
          <Link href="/settings?section=year" className="mt-2 inline-block font-semibold text-secondary hover:underline">Configure academic year</Link>
        </> : recorded ? <>
          <dl className="space-y-3">
            <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-success" />Attended</dt><dd className="font-semibold tabular-nums">{recorded.attended} {recorded.attended === 1 ? "day" : "days"}</dd></div>
            <div className="flex items-center justify-between gap-4"><dt className="flex items-center gap-2"><span className="size-2.5 rounded-full bg-surface-container" />Not attended</dt><dd className="font-semibold tabular-nums">{notAttended} {notAttended === 1 ? "day" : "days"}</dd></div>
          </dl>
          <p className="mt-4 text-on-surface-variant">{recorded.days
            ? `${recorded.attended} of ${recorded.days} recorded days attended` : "0 recorded days"}</p>
        </> : null}
      </div>
    </div>
    {ready && range && !failed && <p className="mt-4 text-xs leading-relaxed text-on-surface-variant">
      Present and late count as attended. Absent and excused count as not attended. Unmarked days are excluded.
    </p>}
  </Card>;
}
