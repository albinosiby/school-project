"use client";
// /me/classes/[classId]/students/[studentId]: a student's profile from real records (the teacher app's
// student_profile_screen.dart + StudentProfileState). Every teacher of the class sees Overview, Attendance (a month
// calendar with one dot per period, a day opens its periods with subject, teacher and mark) and Academics (marks per
// subject and exam, assignments); the class teacher also gets Details (the admission record, via callables).
import { useState } from "react";
import { ChevronLeft, ChevronRight, Phone } from "lucide-react";
import { Avatar, Badge, Button, Card, LoadingSkeleton, Modal, Tabs } from "@/components/ui";
import { cn } from "@/lib/cn";
import { classIdLabel, todayIso } from "../teaching";
import { HBars, TrendChart } from "./charts";
import { useClassData } from "./data";
import { DetailsTab } from "./DetailsTab";
import {
  attendanceSummary, classSubjects, codeOf, dailyRecords, dayState, daySummary, leaveCovers, leaveRange, monthCells, monthLabel, pct0, pct1, shiftMonth,
  shortDay, slotsOn, studentExamProgress, studentHomework, studentSubjectAttendance, studentSubjectMarks, type ClassPeriod, type DaySlot,
} from "./logic";
import { BackLink, DOT, MarkBadge, Notice, Section } from "./ui";

type Tab = "overview" | "attendance" | "academics" | "details";
type Model = ReturnType<typeof useClassData>;

export function StudentProfile({ classId, studentId }: { classId: string; studentId: string }) {
  const c = useClassData(classId, { marks: true, homework: true, leaves: true });
  const [tab, setTab] = useState<Tab>("overview");
  const back = { href: `/me/classes/${classId}`, label: `Class ${classIdLabel(classId)}` };

  if (!c.data.teaching) return <Notice title="Only teachers have classes" hint="Your account is not a teaching account." />;
  if (!c.ready) return <LoadingSkeleton variant="details" label="Loading the student…" />;
  if (!c.mine || !c.cls) return <Notice back={{ href: "/me/classes", label: "My classes" }} title="This class is not one of yours" hint="You can open students of classes you teach or are class teacher of." />;
  const student = c.roster.find((s) => s.id === studentId);
  if (!student) return <Notice back={back} title="Student not found" hint={`This student is not on the active roster of class ${classIdLabel(classId)}.`} />;

  const from = student.admissionDate ?? "";
  const records = c.records.filter((r) => !from || r.date >= from);
  const daily = dailyRecords(records);
  const summary = attendanceSummary(daily, studentId);
  const tabs = [{ id: "overview", label: "Overview" }, { id: "attendance", label: "Attendance" }, { id: "academics", label: "Academics" }, ...(c.classTeacher ? [{ id: "details", label: "Details" }] : [])];
  const low = summary.rate != null && summary.rate < c.minimum;
  const phone = String(student.phone ?? "").replace(/[^\d+]/g, "");

  return <div className="space-y-5">
    <BackLink href={back.href}>{back.label}</BackLink>
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar name={student.name} size={64} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="t-headline-md truncate">{student.name}</h1>{c.classTeacher && <Badge tone="brand">Your class</Badge>}</div>
          <p className="text-sm text-on-surface-variant">{[`Class ${classIdLabel(classId)}`, student.roll ? `Roll ${String(student.roll).padStart(2, "0")}` : "No roll no.", student.grn || student.admissionNumber ? `Adm ${student.grn || student.admissionNumber}` : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <div className={cn("grid size-20 shrink-0 place-content-center rounded-full border-4 text-center", low ? "border-error/70" : "border-success/70")}>
          <span className={cn("text-lg font-semibold tabular-nums", low ? "text-error" : "text-success")}>{pct0(summary.rate)}</span>
          <span className="text-[10px] text-on-surface-variant">attendance</span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-md bg-surface-container-low px-4 py-3 text-sm">
        <div className="min-w-0 flex-1"><p className="text-xs text-on-surface-variant">Guardian</p><p className="truncate font-medium">{student.guardian || "Guardian not recorded"}</p></div>
        {phone && <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 rounded-full bg-success-container px-3 py-1.5 text-xs font-semibold text-success"><Phone size={14} />{student.phone}</a>}
      </div>
    </Card>

    <Tabs variant="underline" items={tabs} value={tab} onChange={(v) => setTab(v as Tab)} />
    {tab === "overview" && <Overview c={c} studentId={studentId} admissionDate={from} summary={summary} onTab={setTab} />}
    {tab === "attendance" && <AttendanceTab c={c} studentId={studentId} admissionDate={from} />}
    {tab === "academics" && <Academics c={c} studentId={studentId} />}
    {tab === "details" && c.classTeacher && <DetailsTab studentId={studentId} />}
  </div>;
}

function Num({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className="rounded-md bg-surface-container-low px-3 py-2 text-center"><p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p><p className="text-[11px] text-on-surface-variant">{label}</p></div>;
}
function Counts({ s }: { s: ReturnType<typeof attendanceSummary> }) {
  return <div className="grid grid-cols-4 gap-2">
    <Num value={s.present} label="Present" tone="text-success" /><Num value={s.absent} label="Absent" tone="text-error" />
    <Num value={s.late} label="Late" tone="text-warning" /><Num value={s.excused} label="Excused" tone="text-secondary" />
  </div>;
}

// ---- overview ------------------------------------------------------------------------------------------------------

function Overview({ c, studentId, admissionDate, summary, onTab }: { c: Model; studentId: string; admissionDate: string; summary: ReturnType<typeof attendanceSummary>; onTab: (t: Tab) => void }) {
  const subjects = classSubjects(c.timetable, c.marks, c.records);
  const bySubject = studentSubjectAttendance({ id: studentId, admissionDate }, c.records, c.timetable, subjects);
  const progress = studentExamProgress(c.marks, studentId);
  const homework = studentHomework(c.homework, studentId);
  const leaves = c.leaves.filter((l) => l.studentId === studentId).sort((a, b) => b.from.localeCompare(a.from));
  return <div className="grid gap-5 lg:grid-cols-2">
    <Section title="Attendance" subtitle={`${pct1(summary.rate)} of ${summary.days} school days · minimum ${c.minimum}%`} actions={<Button size="sm" variant="ghost" onClick={() => onTab("attendance")}>Calendar</Button>}>
      <Counts s={summary} />
    </Section>
    <Section title="Attendance by subject" subtitle="Periods attended out of periods marked">
      <HBars label="Attendance by subject" threshold={c.minimum} tone="success" empty="Not marked"
        items={bySubject.map((s) => ({ label: s.subject, value: s.rate, caption: s.total ? `${s.attended}/${s.total}` : "" }))} />
    </Section>
    <Section title="Academics" subtitle={progress.length ? "Average per exam against the class" : "No marks entered yet"} actions={<Button size="sm" variant="ghost" onClick={() => onTab("academics")}>All marks</Button>}>
      {progress.length ? <ul className="divide-y divide-outline-variant/40">{progress.slice(-4).reverse().map((e) => <li key={e.exam} className="flex items-center justify-between gap-3 py-2 text-sm">
        <span className="font-medium">{e.exam}</span>
        <span className="text-on-surface-variant">class {pct0(e.classAvg)}</span>
        <span className={cn("w-12 text-right font-semibold tabular-nums", e.avg != null && e.avg < 40 ? "text-error" : "")}>{pct0(e.avg)}</span>
      </li>)}</ul> : <p className="text-sm text-on-surface-variant">Marks appear here once exam marks are entered.</p>}
    </Section>
    <Section title="Assignments" subtitle={homework.length ? `${homework.filter((h) => h.status === "pending").length} pending of ${homework.length}` : "None set yet"}>
      {homework.length ? <HomeworkList rows={homework.slice(0, 4)} /> : <p className="text-sm text-on-surface-variant">No assignments for this student yet.</p>}
    </Section>
    {leaves.length > 0 && <Section title="Leave requests" className="lg:col-span-2">
      <ul className="divide-y divide-outline-variant/40">{leaves.slice(0, 5).map((l) => <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
        <div className="min-w-0"><p className="font-medium">{l.type || "Leave"} · {leaveRange(l)}</p>{l.reason && <p className="truncate text-xs text-on-surface-variant">{l.reason}</p>}</div>
        <Badge tone={l.status === "Approved" ? "success" : l.status === "Rejected" ? "danger" : "warning"}>{l.status || "Pending"}</Badge>
      </li>)}</ul>
    </Section>}
  </div>;
}

function HomeworkList({ rows }: { rows: ReturnType<typeof studentHomework> }) {
  return <ul className="divide-y divide-outline-variant/40" aria-label="Assignments">
    {rows.map(({ h, status, marks }) => <li key={h.id} className="flex items-center justify-between gap-3 py-2 text-sm">
      <div className="min-w-0"><p className="truncate font-medium">{h.title}</p><p className="text-xs text-on-surface-variant">{h.subject}{h.due ? ` · due ${h.due.slice(0, 10)}` : ""}</p></div>
      {status === "graded" ? <Badge tone="success">{marks != null && h.maxMarks ? `${marks}/${h.maxMarks}` : "Graded"}</Badge>
        : status === "submitted" ? <Badge tone="brand">Turned in</Badge> : <Badge tone="warning">Pending</Badge>}
    </li>)}
  </ul>;
}

// ---- attendance ----------------------------------------------------------------------------------------------------

const CELL_BG = { none: "", unmarked: "", absent: "bg-error-container/60", present: "bg-success-container/60" };

function AttendanceTab({ c, studentId, admissionDate }: { c: Model; studentId: string; admissionDate: string }) {
  const records = c.records.filter((r) => !admissionDate || r.date >= admissionDate);
  const daily = dailyRecords(records);
  const summary = attendanceSummary(daily, studentId);
  const [month, setMonth] = useState(() => (daily.at(-1)?.date ?? todayIso()).slice(0, 7));
  const [open, setOpen] = useState<string | null>(null);
  const today = todayIso();
  const teacherOf = (p: ClassPeriod) => p.teacher || (p.teacherId ? c.data.staffName(p.teacherId) : "");
  const slots = (date: string) => slotsOn(date, c.timetable, records, studentId, teacherOf);
  const inMonth = daily.filter((r) => r.date.startsWith(month));
  const absentInMonth = inMonth.filter((r) => codeOf(r, studentId) === "A").length;
  const leaves = c.leaves.filter((l) => l.studentId === studentId);
  const absences = [...daily].reverse().filter((r) => codeOf(r, studentId) === "A");
  const openSlots: DaySlot[] = open ? slots(open) : [];

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
    <Section title="Attendance calendar" subtitle="One dot per period · open a day for its periods">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></Button>
        <div className="text-center"><p className="font-semibold">{monthLabel(month)}</p><p className="text-xs text-on-surface-variant">{inMonth.length ? `${inMonth.length} days · ${absentInMonth} absent` : "No registers"}</p></div>
        <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-on-surface-variant">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1" role="group" aria-label={`Attendance in ${monthLabel(month)}`}>
        {monthCells(month).map((date, i) => {
          if (!date) return <span key={`pad${i}`} />;
          const day = slots(date), state = dayState(day);
          const absent = day.filter((s) => s.code === "A").length;
          return <button key={date} type="button" onClick={() => setOpen(date)}
            aria-label={`${date}, ${state === "absent" ? `absent in ${absent} ${absent === 1 ? "period" : "periods"}` : state === "present" ? "present" : state === "unmarked" ? "not marked" : "no periods"}`}
            className={cn("flex h-16 cursor-pointer flex-col items-center rounded-md px-0.5 pt-1.5 pb-1 transition hover:ring-2 hover:ring-secondary/40", CELL_BG[state], date === today && "ring-2 ring-secondary")}>
            <span className={cn("text-xs font-semibold", state === "none" ? "text-outline" : state === "absent" ? "text-error" : "text-on-surface")}>{Number(date.slice(8))}</span>
            <span className="mt-auto flex flex-wrap justify-center gap-[3px] pb-0.5">
              {day.map((s) => <span key={s.period} className={cn("size-1.5 rounded-full", DOT[s.code ?? "none"])} />)}
            </span>
          </button>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
        {([["Present", DOT.P], ["Absent", DOT.A], ["Late", DOT.L], ["Excused", DOT.E], ["Not marked", DOT.none]] as const).map(([l, cls]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={cn("size-2 rounded-full", cls)} />{l}</span>)}
      </div>
    </Section>

    <div className="space-y-5">
      <Section title="This year" subtitle={`${pct1(summary.rate)} of ${summary.days} school days · minimum ${c.minimum}%`}><Counts s={summary} /></Section>
      <Section title="Absences" subtitle={absences.length ? `${absences.length} ${absences.length === 1 ? "day" : "days"}, latest first` : undefined}>
        {absences.length ? <ul className="divide-y divide-outline-variant/40" aria-label="Absences">
          {absences.slice(0, 12).map((r) => <li key={r.date}><button type="button" onClick={() => setOpen(r.date)} className="flex w-full cursor-pointer items-center justify-between gap-2 py-2 text-left text-sm">
            <span>{shortDay(r.date)}</span>{leaves.some((l) => leaveCovers(l, r.date)) ? <Badge tone="info">Leave</Badge> : <Badge tone="danger">Absent</Badge>}
          </button></li>)}
        </ul> : <p className="text-sm font-semibold text-success">No absences recorded.</p>}
        {absences.length > 12 && <p className="mt-2 text-xs text-on-surface-variant">+{absences.length - 12} more</p>}
      </Section>
    </div>

    <Modal open={!!open} onClose={() => setOpen(null)} title={open ? shortDay(open) : ""} subtitle={open ? daySummary(openSlots) : undefined}>
      {!openSlots.length ? <p className="text-sm text-on-surface-variant">Nothing scheduled or marked on this day.</p>
        : <ul className="space-y-3" aria-label="Periods of the day">{openSlots.map((s) => <li key={s.period} className="flex items-center gap-3">
          <span className={cn("grid size-9 shrink-0 place-items-center rounded-md text-xs font-semibold", s.code ? "bg-surface-container text-on-surface" : "bg-surface-container-low text-outline")}>P{s.period}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-medium">{s.subject}</p>{s.teacher && <p className="truncate text-xs text-on-surface-variant">{s.teacher}</p>}</div>
          <MarkBadge code={s.code} />
        </li>)}</ul>}
    </Modal>
  </div>;
}

// ---- academics -----------------------------------------------------------------------------------------------------

function Academics({ c, studentId }: { c: Model; studentId: string }) {
  const progress = studentExamProgress(c.marks, studentId);
  const subjects = studentSubjectMarks(c.marks, studentId);
  const homework = studentHomework(c.homework, studentId);
  return <div className="space-y-5">
    {progress.length > 1 && <Section title="Progress across exams" subtitle="Average of every subject in each exam">
      <TrendChart label="Average per exam" threshold={40} points={progress.map((e) => ({ label: e.exam, value: e.avg, detail: `${e.exam} · class average ${pct0(e.classAvg)}` }))} />
    </Section>}
    <Section title="Marks" subtitle={subjects.length ? `${subjects.length} ${subjects.length === 1 ? "subject" : "subjects"} · every exam` : "No marks entered yet"}>
      {!subjects.length ? <p className="text-sm text-on-surface-variant">Marks appear here once exam marks are entered.</p>
        : <div className="grid gap-3 md:grid-cols-2">{subjects.map((s) => <div key={s.subject} className="rounded-md border border-outline-variant/50 p-4" aria-label={`Marks in ${s.subject}`} role="group">
          <div className="mb-2 flex items-center justify-between gap-2"><p className="font-semibold">{s.subject}</p>
            <span className={cn("text-sm font-semibold tabular-nums", s.avg != null && s.avg < 40 ? "text-error" : "text-secondary")}>{pct0(s.avg)}</span></div>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-on-surface-variant"><tr><th className="py-1 pr-2 font-normal">Exam</th><th className="py-1 pr-2 text-right font-normal">Score</th><th className="py-1 text-right font-normal">%</th></tr></thead>
            <tbody>{s.rows.map((m) => <tr key={m.id} className="border-t border-outline-variant/30">
              <td className="py-1.5 pr-2">{m.exam}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{m.status !== "Present" && m.score == null ? <Badge tone="warning">{m.status}</Badge> : m.score != null && m.max ? `${m.score}/${m.max}` : m.grade || "—"}</td>
              <td className={cn("py-1.5 text-right tabular-nums", m.pct != null && m.pct < 40 && "text-error")}>{pct0(m.pct)}</td>
            </tr>)}</tbody>
          </table>
        </div>)}</div>}
    </Section>
    <Section title="Assignments" subtitle={homework.length ? `${homework.filter((h) => h.status !== "pending").length} of ${homework.length} turned in` : "None set yet"}>
      {homework.length ? <HomeworkList rows={homework} /> : <p className="text-sm text-on-surface-variant">No assignments for this student yet.</p>}
    </Section>
  </div>;
}
