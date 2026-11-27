"use client";
// /me/classes/[classId]/manage: the class teacher's class management (the teacher app's class_management_screen.dart
// and ClassManagementState): overall performance with charts, every student's attendance and marks, the attendance
// history of every period, and parent leave requests to approve or reject with a note.
import Link from "next/link";
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Avatar, Badge, Button, EmptyState, Field, LoadingSkeleton, Modal, PageHeader, SearchBox, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { classIdLabel, todayIso } from "../teaching";
import { Columns, Donut, HBars, TrendChart } from "./charts";
import { useClassData } from "./data";
import {
  classDays, classSubjects, countsOf, dayMonth, dayRate, decidedLeaves, decisionNoteError, decisionPatch, examAverages, leaveRange, MARK_BANDS,
  markedLabel, marksAverage, marksBands, monthCells, monthLabel, needsSupport, overallRate, pct0, pct1, pendingLeaves, rateOf, shiftMonth, shortDay,
  standings, subjectAttendance, subjectMarks, subjectOf, topPerformers, type ClassDay, type Decision, type Standing, type StudentLeave,
} from "./logic";
import { BackLink, Hero, HeroStat, Notice, Section } from "./ui";

type Tab = "overview" | "students" | "attendance" | "leaves";
type Model = ReturnType<typeof useClassData>;

export function ClassManagement({ classId }: { classId: string }) {
  const c = useClassData(classId, { marks: true, leaves: true });
  const [tab, setTab] = useState<Tab>("overview");
  const label = classIdLabel(classId);
  const back = { href: "/me/classes", label: "My classes" };

  if (!c.data.teaching) return <Notice title="Only teachers have classes" hint="Your account is not a teaching account." />;
  if (!c.data.ready || (c.mine && c.classTeacher && !c.ready)) return <LoadingSkeleton variant="page" label="Loading class management…" />;
  if (!c.cls || !c.classTeacher) {
    return <Notice back={back} title="Only the class teacher manages this class"
      hint={c.mine ? `You teach class ${label}; its subject page has your students and assignments.` : "Class management is open to the class teacher of the division."} />;
  }
  const pending = pendingLeaves(c.leaves, [classId]).length;

  return <div className="space-y-5">
    <BackLink href={back.href}>{back.label}</BackLink>
    <PageHeader title={`Class ${label}`} subtitle={`Class management · ${c.roster.length} students${c.cls.room ? ` · Room ${c.cls.room}` : ""}`} />
    <Tabs variant="underline" value={tab} onChange={(v) => setTab(v as Tab)}
      items={[{ id: "overview", label: "Overview" }, { id: "students", label: "Students" }, { id: "attendance", label: "Attendance" }, { id: "leaves", label: "Leaves", ...(pending ? { count: pending } : {}) }]} />
    {tab === "overview" && <Overview c={c} classId={classId} onStudents={() => setTab("students")} />}
    {tab === "students" && <Students c={c} classId={classId} />}
    {tab === "attendance" && <AttendanceHistory c={c} />}
    {tab === "leaves" && <Leaves c={c} classId={classId} />}
  </div>;
}

// ---- overview ------------------------------------------------------------------------------------------------------

function Overview({ c, classId, onStudents }: { c: Model; classId: string; onStudents: () => void }) {
  const days = classDays(c.records);
  const recent = days.slice(-30);
  const latest = days.at(-1);
  const rate = overallRate(days);
  const avg = marksAverage(c.marks);
  const rows = standings(c.roster, c.records, c.marks);
  const support = needsSupport(rows, c.minimum);
  const top = topPerformers(rows);
  const subjects = classSubjects(c.timetable, c.marks, c.records);
  const exams = examAverages(c.marks);
  const scored = c.marks.some((m) => m.pct != null);
  const today = todayIso();

  return <div className="space-y-5">
    <Hero>
      <p className="t-label-caps text-white/75">Class performance</p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <HeroStat label="Attendance" value={pct1(rate)} warn={rate != null && rate < c.minimum} />
        <HeroStat label="Marks average" value={pct1(avg)} warn={avg != null && avg < 40} />
        <HeroStat label="Need support" value={String(support.length)} warn={support.length > 0} />
      </div>
    </Hero>

    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Attendance trend" subtitle={recent.length ? `All subjects · last ${recent.length} school days` : "No registers yet"} className="lg:col-span-2">
        <TrendChart label="Class attendance by day" threshold={c.minimum}
          points={recent.map((d) => ({ label: dayMonth(d.date), value: dayRate(d), detail: `${shortDay(d.date)} · ${markedLabel(d, c.timetable)} · ${d.absentees.length} absent` }))} />
      </Section>

      {latest && <Section title={latest.date === today ? "Today's attendance" : "Last school day"} subtitle={`${shortDay(latest.date)} · ${markedLabel(latest, c.timetable)}, counted per period`}>
        <Donut label="Attendance of the day" centre={pct0(dayRate(latest))} caption="present"
          segments={[{ label: "Present", value: latest.present, tone: "success" }, { label: "Late", value: latest.late, tone: "warning" }, { label: "Absent", value: latest.absent, tone: "danger" }, { label: "Excused", value: latest.excused, tone: "info" }]} />
      </Section>}

      <Section title="Attendance by subject" subtitle={`All ${subjects.length} subjects · average register of each subject's periods`}>
        <HBars label="Attendance by subject" threshold={c.minimum} tone="success" empty="No registers yet"
          items={subjectAttendance(c.records, c.timetable, subjects).map((s) => ({ label: s.subject, value: s.rate, caption: [s.weekly ? `${s.weekly}/wk` : "", s.registers ? `${s.registers} reg.` : ""].filter(Boolean).join(" · ") }))} />
      </Section>

      <Section title="Subject performance" subtitle={scored ? "Class average of every exam mark" : "No marks entered yet — every subject is listed"}>
        <HBars label="Subject performance" threshold={40} empty="No marks yet"
          items={subjectMarks(c.marks, subjects).map((s) => ({ label: s.subject, value: s.avg, caption: s.exams ? `${s.exams} ${s.exams === 1 ? "exam" : "exams"}` : "" }))} />
      </Section>

      {scored && <Section title="Marks distribution" subtitle="Students by their average">
        <Columns label="Students per marks band" values={marksBands(rows)} labels={MARK_BANDS} tones={["danger", "warning", "info", "brand", "success"]} />
      </Section>}

      {exams.length > 1 && <Section title="Progress across exams" subtitle="Class average per exam">
        <TrendChart label="Class average per exam" threshold={40} tone="success" points={exams.map((e) => ({ label: e.exam, value: e.avg }))} />
      </Section>}

      {top.length > 0 && <Section title="Top performers">
        <ul className="divide-y divide-outline-variant/40">{top.map((t) => <StandingRow key={t.student.id} t={t} classId={classId} minimum={c.minimum} />)}</ul>
      </Section>}

      <Section title="Needs support" subtitle={`Attendance under ${c.minimum}% or marks under 40%`}
        actions={support.length > 5 ? <Button size="sm" variant="ghost" onClick={onStudents}>All students</Button> : undefined}>
        {support.length ? <ul className="divide-y divide-outline-variant/40">{support.slice(0, 5).map((t) => <StandingRow key={t.student.id} t={t} classId={classId} minimum={c.minimum} />)}</ul>
          : <p className="text-sm font-semibold text-success">Everyone is on track.</p>}
      </Section>
    </div>
  </div>;
}

function Metric({ label, value, low }: { label: string; value: number | null; low: boolean }) {
  return <div className="w-16 text-right">
    <p className="text-[11px] text-on-surface-variant">{label}</p>
    <p className={cn("text-sm font-semibold tabular-nums", value == null ? "text-outline" : low ? "text-error" : "text-on-surface")}>{pct0(value)}</p>
  </div>;
}

/** a student with attendance and marks; opens their profile */
function StandingRow({ t, classId, minimum }: { t: Standing; classId: string; minimum: number }) {
  const s = t.student;
  return <li>
    <Link href={`/me/classes/${classId}/students/${s.id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 transition hover:bg-surface-container-low" aria-label={s.name}>
      <Avatar name={s.name} size={34} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.name}</p>
        <p className="text-xs text-on-surface-variant">{s.roll ? `Roll ${s.roll}` : "No roll no."}{t.absences ? ` · ${t.absences} ${t.absences === 1 ? "day" : "days"} absent` : ""}</p>
      </div>
      <Metric label="Attend." value={t.attendance} low={t.attendance != null && t.attendance < minimum} />
      <Metric label="Marks" value={t.marks} low={t.marks != null && t.marks < 40} />
    </Link>
  </li>;
}

// ---- students ------------------------------------------------------------------------------------------------------

const SORTS = ["Roll", "Attendance ↑", "Marks ↑", "Marks ↓"] as const;

function Students({ c, classId }: { c: Model; classId: string }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Roll");
  const needle = q.trim().toLowerCase();
  const rows = standings(c.roster, c.records, c.marks)
    .filter(({ student: s }) => !needle || [s.name, String(s.roll ?? ""), s.grn, s.admissionNumber].some((v) => String(v ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => sort === "Attendance ↑" ? (a.attendance ?? 101) - (b.attendance ?? 101)
      : sort === "Marks ↑" ? (a.marks ?? 101) - (b.marks ?? 101) : sort === "Marks ↓" ? (b.marks ?? -1) - (a.marks ?? -1) : 0);
  return <Section title="Students" subtitle={`${c.roster.length} students · attendance across every period, marks across every exam`}>
    <div className="mb-3 flex flex-col gap-2 sm:flex-row">
      <SearchBox value={q} onChange={setQ} placeholder="Search name, roll or admission no." className="flex-1" />
      <Select aria-label="Sort students" value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="sm:w-44">{SORTS.map((s) => <option key={s}>{s}</option>)}</Select>
    </div>
    {rows.length ? <ul className="divide-y divide-outline-variant/40" aria-label={`Students of ${classIdLabel(classId)}`}>
      {rows.map((t) => <StandingRow key={t.student.id} t={t} classId={classId} minimum={c.minimum} />)}
    </ul> : <p className="py-6 text-center text-sm text-on-surface-variant">{c.roster.length ? "No one matches" : "No students yet"}</p>}
  </Section>;
}

// ---- attendance history --------------------------------------------------------------------------------------------

const heat = (rate: number | undefined, minimum: number) => rate == null ? "bg-surface-container-low text-outline"
  : rate >= 95 ? "bg-success text-white" : rate >= 85 ? "bg-success/60 text-white" : rate >= minimum ? "bg-warning/80 text-white" : "bg-error text-white";

function AttendanceHistory({ c }: { c: Model }) {
  const days = classDays(c.records);
  const [month, setMonth] = useState(() => (days.at(-1)?.date ?? todayIso()).slice(0, 7));
  const [open, setOpen] = useState<ClassDay | null>(null);
  const byDate = new Map(days.map((d) => [d.date, d]));
  const inMonth = days.filter((d) => d.date.startsWith(month));
  const monthAvg = overallRate(inMonth);
  const nameOf = (id: string) => c.roster.find((s) => s.id === id)?.name ?? c.data.students.find((s) => s.id === id)?.name ?? id;
  const regs = open ? c.records.filter((r) => r.date === open.date) : [];

  return <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
    <Section title="Monthly view" subtitle="Class attendance of each day, all periods combined">
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" aria-label="Previous month" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft size={18} /></Button>
        <div className="text-center"><p className="font-semibold">{monthLabel(month)}</p><p className="text-xs text-on-surface-variant">{monthAvg == null ? "No registers" : `${inMonth.length} days · average ${pct1(monthAvg)}`}</p></div>
        <Button variant="ghost" size="sm" aria-label="Next month" onClick={() => setMonth(shiftMonth(month, 1))}><ChevronRight size={18} /></Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-on-surface-variant">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthCells(month).map((date, i) => {
          if (!date) return <span key={`pad${i}`} />;
          const d = byDate.get(date), rate = d ? dayRate(d) : undefined;
          return <button key={date} type="button" disabled={!d} onClick={() => d && setOpen(d)} aria-label={`${date}${d ? `, ${Math.round(rate!)}%` : ", no register"}`}
            className={cn("flex aspect-square flex-col items-center justify-center rounded-md text-xs font-semibold transition enabled:cursor-pointer enabled:hover:ring-2 enabled:hover:ring-secondary/40", heat(rate, c.minimum))}>
            <span>{Number(date.slice(8))}</span>{d && <span className="text-[9px] font-normal opacity-90">{Math.round(rate!)}</span>}
          </button>;
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
        {[["95%+", "bg-success"], ["85–95", "bg-success/60"], [`${c.minimum}–85`, "bg-warning/80"], ["Below", "bg-error"]].map(([l, cls]) => <span key={l} className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-sm", cls)} />{l}</span>)}
      </div>
    </Section>

    <Section title="Recent registers" subtitle="Open a day for each period and who was absent">
      {!days.length ? <p className="text-sm text-on-surface-variant">No registers submitted yet.</p>
        : <ul className="divide-y divide-outline-variant/40" aria-label="Recent registers">
          {[...days].reverse().slice(0, 20).map((d) => <li key={d.date}>
            <button type="button" onClick={() => setOpen(d)} className="flex w-full cursor-pointer items-center gap-3 py-2.5 text-left">
              <div className="min-w-0 flex-1"><p className="font-medium">{shortDay(d.date)}</p><p className="text-xs text-on-surface-variant">{markedLabel(d, c.timetable)}</p></div>
              <span className={cn("text-sm font-semibold tabular-nums", dayRate(d) < c.minimum ? "text-error" : "text-success")}>{pct0(dayRate(d))}</span>
              <span className={cn("w-20 text-right text-xs", d.absentees.length ? "text-error" : "text-on-surface-variant")}>{d.absentees.length} absent</span>
              <ChevronRight size={16} className="text-outline" />
            </button>
          </li>)}
        </ul>}
    </Section>

    <Modal open={!!open} onClose={() => setOpen(null)} title={open ? shortDay(open.date) : ""} subtitle={open ? markedLabel(open, c.timetable) : undefined}>
      <ul className="space-y-3">
        {regs.map((r) => {
          const n = countsOf(r);
          const absent = Object.entries(r.marks ?? {}).filter(([, m]) => m === "A").map(([id]) => nameOf(id));
          return <li key={r.id} className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-info-container text-xs font-semibold text-secondary">P{r.period}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2"><p className="font-medium">{subjectOf(r, c.timetable)}</p>
                <span className={cn("text-sm font-semibold tabular-nums", rateOf(r) < c.minimum ? "text-error" : "text-success")}>{n.present + n.late}/{n.total}</span></div>
              <p className="text-xs text-on-surface-variant">{absent.length ? `Absent: ${absent.join(", ")}` : "No one absent"}{n.late ? ` · ${n.late} late` : ""}</p>
            </div>
          </li>;
        })}
      </ul>
    </Modal>
  </div>;
}

// ---- leaves --------------------------------------------------------------------------------------------------------

function Leaves({ c, classId }: { c: Model; classId: string }) {
  const toast = useToast();
  const [tab, setTab] = useState("pending");
  const [decide, setDecide] = useState<{ leave: StudentLeave; status: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = pendingLeaves(c.leaves, [classId]);
  const decided = decidedLeaves(c.leaves, [classId]);
  const list = tab === "pending" ? pending : decided;
  const studentName = (l: StudentLeave) => l.name || c.roster.find((s) => s.id === l.studentId)?.name || l.studentId;
  const open = (leave: StudentLeave, status: Decision) => { setNote(""); setDecide({ leave, status }); };

  async function confirm() {
    if (!decide || busy) return;
    const why = decisionNoteError(note);
    if (why) { toast(why, "error"); return; }
    setBusy(true);
    try {
      await c.updateLeave(decide.leave.id, decisionPatch(decide.status, note, c.data.staffId));
      toast(`Leave ${decide.status.toLowerCase()} for ${studentName(decide.leave)}`);
      setDecide(null); setNote("");
    } catch { toast("Could not save the decision", "error"); } finally { setBusy(false); }
  }

  return <Section title="Leave requests" subtitle="Requests from parents. Your decision and note show in the parent app.">
    <Tabs items={[{ id: "pending", label: "Pending", count: pending.length }, { id: "decided", label: "Decided", count: decided.length }]} value={tab} onChange={setTab} className="mb-3" />
    {!list.length && <EmptyState title={tab === "pending" ? "No leave requests waiting" : "No decisions yet"} />}
    <ul className="space-y-3">
      {list.map((l) => <li key={l.id} className="rounded-md border border-outline-variant/50 p-4" aria-label={`Leave request of ${studentName(l)}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={studentName(l)} size={36} />
            <div className="min-w-0">
              <p className="truncate font-medium">{studentName(l)}{l.roll ? <span className="ml-1 text-xs font-normal text-on-surface-variant">· Roll {l.roll}</span> : null}</p>
              <p className="text-sm">{leaveRange(l)}{l.type ? ` · ${l.type}` : ""}{l.by ? ` · by ${l.by}` : ""}</p>
            </div>
          </div>
          {l.status === "Approved" || l.status === "Rejected" ? <Badge tone={l.status === "Approved" ? "success" : "danger"}>{l.status}</Badge> : null}
        </div>
        {l.reason && <p className="mt-2 text-sm text-on-surface-variant">{l.reason}</p>}
        {l.decisionNote && <p className="mt-1 text-xs text-on-surface-variant italic">Note: {l.decisionNote}</p>}
        {l.status !== "Approved" && l.status !== "Rejected" && <div className="mt-3 flex gap-2">
          <Button size="sm" variant="outline" onClick={() => open(l, "Rejected")}>Reject</Button>
          <Button size="sm" onClick={() => open(l, "Approved")}>Approve</Button>
        </div>}
      </li>)}
    </ul>

    <Modal open={!!decide} onClose={() => setDecide(null)} title={decide ? `${decide.status === "Approved" ? "Approve" : "Reject"} leave` : ""}
      subtitle={decide ? `${studentName(decide.leave)} · ${leaveRange(decide.leave)}` : undefined}
      footer={<>
        <Button variant="outline" onClick={() => setDecide(null)}>Cancel</Button>
        <Button variant={decide?.status === "Rejected" ? "danger" : "primary"} disabled={busy} onClick={confirm}>{decide?.status === "Rejected" ? "Reject" : "Approve"}</Button>
      </>}>
      <Field label="Note to parent" hint="Optional. Shown with the decision in the parent app." error={decisionNoteError(note) || undefined}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  </Section>;
}

