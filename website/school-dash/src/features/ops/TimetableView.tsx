"use client";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, ListToolbar, Modal, PageHeader, Select, useToast } from "@/components/ui";
import { classStream, isSeniorGrade, streamIdOf, streamsForGrade, type AcademicClass } from "@/lib/academicStreams";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { DAY_NAMES, GRADES, SECTIONS, SUBJECTS, classIdOf, clsLabel, teacherOptionLabel, teachingStaff, type StaffRef } from "./shared";
import { findSlotTaken, findTeacherClash, periodClass, periodId, validatePeriod, type Period } from "./logic";
import { schoolDaySchedule, teachingPeriods, withTimetableBreaks, type ClassActivityConfig } from "./classActivity";
import { TimetableBreakRow } from "./TimetableBreakRow";
import { SchoolTimingSettings } from "./SchoolTimingSettings";

export { periodClass, type Period } from "./logic";
const DAYS = DAY_NAMES;
const TIMETABLE_GRADES = ["LKG", "UKG", ...GRADES];
const gradeName = (grade: string) => /^\d+$/.test(grade) ? `Grade ${grade}` : grade;
const subjectTone: Record<string, string> = { Physics: "bg-warning-container", "Remedial Lab": "bg-info-container", Mathematics: "bg-info-container", English: "bg-success-container", Science: "bg-warning-container", "Social Science": "bg-error-container", Hindi: "bg-surface-container-high", "Physical Education": "bg-surface-container" };
type Clash = (r: { id?: string; day: string; period: number; teacherId?: string; teacher: string }) => Period | undefined;

/** ops_periods: one row per class, weekday and configured teaching period (up to 12), id per_10B_Mon_3. */
export function TimetableView({ embedded = false }: { embedded?: boolean } = {}) {
  const toast = useToast();
  const params = useSearchParams();
  const { rows, create, update, remove } = useCollection<Period>("ops_periods");
  const classes = useCollection<AcademicClass>("classes").rows;
  const staff = useCollection<StaffRef>("staff").rows;
  const config = useCollection<ClassActivityConfig>("set_config");
  const bell = config.rows.find((row) => row.id === "bell");
  const schedule = schoolDaySchedule(bell);
  const configuredPeriods = teachingPeriods(schedule);
  const timeline = withTimetableBreaks(configuredPeriods, schedule?.filter((slot) => slot.break) ?? []);
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const [grade, setGrade] = useState(() => TIMETABLE_GRADES.includes(params.get("grade") || "") ? params.get("grade")! : "10");
  const [section, setSection] = useState(() => SECTIONS.includes(params.get("division") || "") ? params.get("division")! : "B");
  const [edit, setEdit] = useState<{ day: string; period: number; rec?: Period } | null>(null);
  const [stream, setStream] = useState<string>(() => streamIdOf(params.get("stream") || ""));
  const streams = streamsForGrade(classes, grade);
  const configured = classes.filter((row) => row.grade === grade && classStream(row) === stream);
  const sections = stream ? configured.map((row) => row.section).sort() : SECTIONS;
  const classId = classIdOf(grade, section, stream);
  const subjectOptions = configured.find((row) => row.section === section)?.subjects ?? SUBJECTS;
  const nameOf = (r: Period) => staff.find((s) => s.id === r.teacherId)?.name ?? r.teacher;

  const mine = rows.filter((r) => periodClass(r) === classId);
  const outside = schedule ? mine.filter((row) => !configuredPeriods.some((slot) => slot.period === Number(row.period))) : mine;
  const cell = (d: string, p: number) => mine.find((r) => r.day === d && Number(r.period) === p);
  const clash: Clash = (r) => findTeacherClash(rows, { ...r, classId });
  const conflicts = mine.filter((r) => clash(r)).length;

  const actions = <ListToolbar filters={<>
          <Select aria-label="Grade" value={grade} onChange={(e) => { setGrade(e.target.value); setStream(""); setEdit(null); }} className="w-32">{TIMETABLE_GRADES.map((g) => <option key={g} value={g}>{gradeName(g)}</option>)}</Select>
          {isSeniorGrade(grade) && streams.length > 0 && <Select aria-label="Stream" value={stream} onChange={(e) => {
            const id = e.target.value; setStream(id); setEdit(null);
            setSection(classes.filter((row) => row.grade === grade && classStream(row) === id).map((row) => row.section).sort()[0] ?? "A");
          }} className="w-44"><option value="">No stream</option>{streams.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</Select>}
          <Select aria-label="Section" value={section} onChange={(e) => { setSection(e.target.value); setEdit(null); }} className="w-28">{sections.map((g) => <option key={g} value={g}>Sec {g}</option>)}</Select></>} />;

  return (
    <div>
      {embedded ? <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-xl font-semibold">Timetable</h2><p className="mt-1 text-sm text-on-surface-variant">Set recurring weekly periods and subject teachers. Assign dated substitutions from Class Details → Timetable.</p></div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div> : <PageHeader title="Timetable" subtitle="Set recurring weekly periods and subject teachers. Assign dated substitutions from Class Details → Timetable." actions={actions} />}
      {conflicts > 0 && <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning-container p-3 text-sm font-medium text-warning"><AlertTriangle size={16} />{conflicts} period{conflicts > 1 ? "s" : ""} in this class have a teacher double-booked with another class.</div>}
      <p className="mb-3 text-sm text-on-surface-variant">{schedule ? `${configuredPeriods.length} periods per day, using the school bell schedule.` : "School bell timings are unavailable. Configure school hours and breaks below."}</p>
      <Card className="overflow-x-auto p-4">
        <table aria-label="Timetable editor" className="w-full min-w-[860px] border-separate border-spacing-2 text-left">
          <thead><tr><th className="w-24" />{DAYS.map((d) => <th key={d} className="t-label-caps text-center text-on-surface-variant">{d}</th>)}</tr></thead>
          <tbody>
            {timeline.map((entry) => {
              if (entry.kind === "break") return <TimetableBreakRow key={`break:${entry.row.from}`} slot={entry.row} columns={DAYS.length + 1} />;
              const { period: p, from, to } = entry.row;
              return <tr key={p}>
                <td className="align-middle"><div className="text-sm font-semibold">Period {p}</div><div className="t-caption font-mono text-outline">{from && to ? `${from}–${to}` : "Time unavailable"}</div></td>
                {DAYS.map((d) => { const c = cell(d, p); const x = c && clash(c);
                  return (
                    <td key={d} className="h-20 align-top">
                      <button onClick={() => setEdit({ day: d, period: p, rec: c })} aria-label={`${d} period ${p}${c ? ` ${c.subject}` : " empty"}`}
                        className={cn("flex h-full w-full cursor-pointer flex-col justify-between rounded-lg p-2 text-left", c ? cn(subjectTone[c.subject] ?? "bg-surface-container", "hover:opacity-80") : "border border-dashed border-outline-variant text-outline hover:bg-surface-container-low", x && "ring-2 ring-warning")}>
                        {c ? (<><span className="flex items-start justify-between gap-1 text-sm font-semibold leading-4">{c.subject}{x && <AlertTriangle size={14} className="shrink-0 text-warning" />}</span><span className="t-caption truncate text-on-surface-variant">{nameOf(c)}</span></>) : <Plus size={14} className="m-auto" />}
                      </button></td>); })}
              </tr>; })}
          </tbody>
        </table>
      </Card>
      {outside.length > 0 && <Card className="mt-4 p-5">
        <h3 className="font-semibold">Saved lessons outside the bell schedule</h3>
        <p className="mt-1 text-sm text-on-surface-variant">These lessons are kept for review. Extend the daily period count below to include them, or review and clear any outdated lessons.</p>
        <ul className="mt-3 divide-y divide-outline-variant/40">{outside.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
          <span>{row.day} · Period {row.period} · {row.subject} · {nameOf(row) || "Not assigned"}</span>
          <Button size="sm" variant="outline" aria-label={`Review saved ${row.day} period ${row.period}`} onClick={() => setEdit({ day: row.day, period: Number(row.period), rec: row })}>Review lesson</Button>
        </li>)}</ul>
      </Card>}
      <SchoolTimingSettings bell={bell} ready={config.ready} />
      {edit && <PeriodModal periodCount={configuredPeriods.length} subjectOptions={subjectOptions} key={`${edit.day}${edit.period}${grade}${section}`} ctx={edit} teachers={teachers} staff={staff} clash={clash} grade={grade} section={section} onClose={() => setEdit(null)}
        taken={edit.rec ? undefined : findSlotTaken(rows, { classId, day: edit.day, period: edit.period })}
        onSave={async (v) => {
          try {
            const body = { ...v, classId, grade, section };
            if (edit.rec) await update(edit.rec.id, body);
            else await create({ ...body, id: stream ? `per_${classId.slice(4)}_${edit.day}_${edit.period}` : periodId(grade, section, edit.day, edit.period), day: edit.day, period: edit.period } as never);
            toast("Period saved"); setEdit(null);
          } catch { toast("Save failed", "error"); }
        }}
        onDelete={edit.rec ? async () => { try { await remove(edit.rec!.id); toast("Period cleared"); setEdit(null); } catch { toast("Could not clear the period", "error"); } } : undefined} />}
    </div>
  );
}

function PeriodModal({ periodCount, subjectOptions, ctx, teachers, staff, clash, taken, grade, section, onClose, onSave, onDelete }: {
  periodCount: number;
  subjectOptions: string[]; ctx: { day: string; period: number; rec?: Period }; teachers: StaffRef[]; staff: StaffRef[]; clash: Clash; taken?: Period;
  grade: string; section: string; onClose: () => void; onSave: (v: { subject: string; teacher: string; teacherId: string; room: string }) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  // a new period starts without a subject: the admin picks one (subject is required)
  const [subject, setSubject] = useState(ctx.rec?.subject ?? "");
  const [teacherId, setTeacherId] = useState(ctx.rec?.teacherId ?? staff.find((s) => s.name === ctx.rec?.teacher)?.id ?? "");
  const [room, setRoom] = useState(ctx.rec?.room ?? `R-${grade}${section}`);
  const [err, setErr] = useState<Record<string, string>>({});
  const name = staff.find((s) => s.id === teacherId)?.name ?? ctx.rec?.teacher ?? "";
  const other = teacherId ? clash({ id: ctx.rec?.id, day: ctx.day, period: ctx.period, teacherId, teacher: name }) : undefined;
  const subjects = !subject || subjectOptions.includes(subject) ? subjectOptions : [subject, ...subjectOptions];
  const takenBy = taken ? `${taken.subject} (${staff.find((s) => s.id === taken.teacherId)?.name ?? taken.teacher})` : "";
  function save() {
    const e = validatePeriod({ day: ctx.day, period: ctx.period, subject, teacherId }, periodCount);
    if (taken) e.slot = `This slot already has ${takenBy}. Edit or clear that period instead.`;
    setErr(e); if (Object.keys(e).length) return;
    void run(() => onSave({ subject, teacher: name, teacherId, room: room.trim() }));
  }
  return (
    <Modal open onClose={onClose} title={ctx.rec ? "Edit period" : "Add period"} subtitle={`${gradeName(grade)}-${section} · ${ctx.day} · Period ${ctx.period}`}
      footer={<>{onDelete && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => run(onDelete)}>Clear period</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy || ctx.period > periodCount}>{other ? "Save anyway" : "Save"}</Button></>}>
      <div className="space-y-4">
        {ctx.period > periodCount && <p role="note" className="text-sm text-warning">This saved period is outside the configured school day. Extend the period count under School hours &amp; breaks, or clear this outdated lesson.</p>}
        {(err.day || err.period || err.slot) && <div role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{[err.day, err.period, err.slot].filter(Boolean).join(" ")}</div>}
        <Field label="Subject" required error={err.subject}><Select value={subject} onChange={(e) => { setSubject(e.target.value); setErr((x) => ({ ...x, subject: "" })); }}>
          {!subject && <option value="">Select a subject…</option>}
          {subjects.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Teacher" required error={err.teacherId}><Select value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setErr((x) => ({ ...x, teacherId: "" })); }}>
          {!teacherId && <option value="">Select a teacher…</option>}
          {!teachers.some((t) => t.id === teacherId) && teacherId && <option value={teacherId}>{name || teacherId}</option>}
          {teachers.map((t) => <option key={t.id} value={t.id}>{teacherOptionLabel(t)}</option>)}</Select></Field>
        <Field label="Room"><Input value={room} onChange={(e) => setRoom(e.target.value)} /></Field>
        {other && <div role="alert" className="flex items-start gap-2 rounded-lg bg-warning-container p-3 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span><b>{name}</b> is already teaching {other.subject} in {clsLabel(periodClass(other))} at this time. Saving creates a double-booking.</span></div>}
        {!other && teacherId && <Badge tone="success">No clash</Badge>}
      </div>
    </Modal>
  );
}
