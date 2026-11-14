"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, DataTable, Field, Input, type Column, type Tone } from "@/components/ui";
import { attendanceHistory, classDay, studentHref, studentPeriodMark, type ClassStudent, type StudentPeriodMark } from "./classDetails";
import { DailyPeriods, type ClassScheduleData } from "./ClassTimetable";

const markNames: Record<StudentPeriodMark, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused", "Not marked": "Not marked", "Not enrolled": "Not enrolled", Unavailable: "Unavailable" };
const tones: Partial<Record<StudentPeriodMark, Tone>> = { P: "success", A: "danger", L: "warning", E: "info" };
export function ClassAttendance({ data, roster }: { data: ClassScheduleData; roster: ClassStudent[] }) {
  const [pickedDate, setDate] = useState("");
  const [pickedMonth, setMonth] = useState("");
  const date = pickedDate || data.clock.date;
  const month = pickedMonth || date.slice(0, 7);
  const day = useMemo(() => classDay(data.classId, date, data.bell, data.regional, data.periods, data.substitutions, data.staff, data.attendance), [data, date]);
  const history = useMemo(() => attendanceHistory(data.attendance, data.classId, month), [data.attendance, data.classId, month]);
  const columns: Column<ClassStudent>[] = [
    { key: "name", header: "Student", sortValue: (student) => student.name, render: (student) => <div className="min-w-40"><Link href={studentHref(student.id)} className="font-medium text-secondary hover:underline">{student.name}</Link><p className="mt-0.5 text-xs text-on-surface-variant">{student.admissionNumber || student.grn || "Admission number not recorded"}</p></div> },
    ...[...day.rows, ...day.outsideRows.filter((row) => row.record)].map((period): Column<ClassStudent> => ({ key: `p${period.period}`, header: `Period ${period.period}${day.outsideRows.includes(period) ? " (saved)" : ""}`, render: (student) => {
      const mark = studentPeriodMark(student, period.record, data.clock.date, roster);
      return <span aria-label={`${student.name}, period ${period.period}: ${markNames[mark]}`}><Badge tone={tones[mark] ?? "neutral"}>{markNames[mark]}</Badge></span>;
    } })),
  ];
  const historyColumns: Column<(typeof history)[number]>[] = [
    { key: "date", header: "Date", render: (row) => <Button size="sm" variant="ghost" className="text-secondary" onClick={() => setDate(row.id)} aria-label={`View attendance for ${row.id}`}>{row.id}</Button> },
    { key: "periods", header: "Periods marked" },
    { key: "attendance", header: "Period attendance", render: (row) => row.invalid || !row.total ? "Unavailable" : `${Math.round(row.present * 1000 / row.total) / 10}%` },
    { key: "records", header: "Records", render: (row) => row.invalid ? <Badge tone="warning">{row.invalid} unavailable</Badge> : <Badge tone="success">Submitted</Badge> },
  ];
  return <div className="grid min-w-0 gap-5">
    <Card className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="text-lg font-semibold">Attendance by period</h2><p className="mt-1 text-sm text-on-surface-variant">Submitted attendance for each lesson on the selected date.</p></div>
        <Field label="Attendance date"><Input type="date" value={date} max={data.clock.date} onChange={(event) => { if (event.target.value && event.target.value <= data.clock.date) setDate(event.target.value); }} /></Field>
      </div>
      <div className="pb-4"><DailyPeriods data={data} date={date} /></div>
    </Card>
    <Card role="region" aria-label="Student period attendance" className="min-w-0 overflow-hidden">
      <div className="p-5"><h2 className="text-lg font-semibold">Student attendance · {date}</h2><p className="mt-1 text-sm text-on-surface-variant">Present and late count as attended. Unsubmitted periods show “Not marked.”</p></div>
      {day.rows.length > 0 || day.outsideRows.some((row) => row.record) ? <DataTable key={date} rows={roster} columns={columns} pageSize={10} searchText={(student) => `${student.name} ${student.grn || ""} ${student.admissionNumber || ""}`} /> : <p className="px-5 pb-5 text-sm text-on-surface-variant">No period records for this date.</p>}
      {date !== data.clock.date && <p className="px-5 pb-4 text-xs text-on-surface-variant">Older records without a saved student list show only explicitly recorded marks. Period totals remain available.</p>}
    </Card>
    <Card role="region" aria-label="Attendance history" className="min-w-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-lg font-semibold">Attendance history</h2><p className="mt-1 text-sm text-on-surface-variant">Open a date to view its periods and student marks. Percentages combine submitted periods only.</p></div>
        <Field label="History month"><Input type="month" value={month} max={data.clock.date.slice(0, 7)} onChange={(event) => { if (event.target.value) setMonth(event.target.value); }} /></Field></div>
      <DataTable rows={history} columns={historyColumns} pageSize={10} empty={<p className="p-5 text-sm text-on-surface-variant">No period attendance recorded for this month.</p>} />
    </Card>
  </div>;
}
