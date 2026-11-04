"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { DAY_NAMES, GRADES, SECTIONS, SUBJECTS, classIdOf, clsLabel, teachingStaff, type StaffRef } from "./shared";
import { PERIODS, PERIOD_TIMES, findSlotTaken, findTeacherClash, periodClass, periodId, validatePeriod, type Period } from "./logic";
import { SubstitutionsPanel } from "./SubstitutionsPanel";

export { periodClass, type Period } from "./logic";
const DAYS = DAY_NAMES;
const subjectTone: Record<string, string> = { Physics: "bg-warning-container", "Remedial Lab": "bg-info-container", Mathematics: "bg-info-container", English: "bg-success-container", Science: "bg-warning-container", "Social Science": "bg-error-container", Hindi: "bg-surface-container-high", "Physical Education": "bg-surface-container" };
type Clash = (r: { id?: string; day: string; period: number; teacherId?: string; teacher: string }) => Period | undefined;

/** ops_periods (data contract section 3): one row per class, day (Mon..Sat) and period (1..8), id per_10B_Mon_3. */
export function TimetableView() {
  const toast = useToast();
  const { rows, create, update, remove } = useCollection<Period>("ops_periods");
  const staff = useCollection<StaffRef>("staff").rows;
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const [tab, setTab] = useState("grid");
  const [grade, setGrade] = useState("10"); const [section, setSection] = useState("B");
  const [edit, setEdit] = useState<{ day: string; period: number; rec?: Period } | null>(null);
  const classId = classIdOf(grade, section);
  const nameOf = (r: Period) => staff.find((s) => s.id === r.teacherId)?.name ?? r.teacher;

  const mine = rows.filter((r) => periodClass(r) === classId);
  const cell = (d: string, p: number) => mine.find((r) => r.day === d && Number(r.period) === p);
  const clash: Clash = (r) => findTeacherClash(rows, { ...r, classId });
  const conflicts = mine.filter((r) => clash(r)).length;

  return (
    <div>
      <PageHeader title="Timetable" subtitle="Weekly period grid per class with teacher clash detection, and substitute cover."
        actions={tab === "grid" ? <>
          <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32">{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
          <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-28">{SECTIONS.map((g) => <option key={g} value={g}>Sec {g}</option>)}</Select></> : undefined} />
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ id: "grid", label: "Weekly grid" }, { id: "subs", label: "Substitutions" }]} />
      {tab === "subs" ? <SubstitutionsPanel staff={staff} periods={rows} /> : <>
      {conflicts > 0 && <div className="mb-4 flex items-center gap-2 rounded-lg bg-warning-container p-3 text-sm font-medium text-warning"><AlertTriangle size={16} />{conflicts} period{conflicts > 1 ? "s" : ""} in this class have a teacher double-booked with another class.</div>}
      <Card className="overflow-x-auto p-4">
        <table className="w-full min-w-[860px] border-separate border-spacing-2 text-left">
          <thead><tr><th className="w-24" />{DAYS.map((d) => <th key={d} className="t-label-caps text-center text-on-surface-variant">{d}</th>)}</tr></thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p}>
                <td className="align-middle"><div className="text-sm font-semibold">Period {p}</div><div className="t-caption font-mono text-outline">{PERIOD_TIMES[p - 1]}</div></td>
                {DAYS.map((d) => { const c = cell(d, p); const x = c && clash(c);
                  return (
                    <td key={d} className="h-20 align-top">
                      <button onClick={() => setEdit({ day: d, period: p, rec: c })} aria-label={`${d} period ${p}${c ? ` ${c.subject}` : " empty"}`}
                        className={cn("flex h-full w-full cursor-pointer flex-col justify-between rounded-lg p-2 text-left", c ? cn(subjectTone[c.subject] ?? "bg-surface-container", "hover:opacity-80") : "border border-dashed border-outline-variant text-outline hover:bg-surface-container-low", x && "ring-2 ring-warning")}>
                        {c ? (<><span className="flex items-start justify-between gap-1 text-sm font-semibold leading-4">{c.subject}{x && <AlertTriangle size={14} className="shrink-0 text-warning" />}</span><span className="t-caption truncate text-on-surface-variant">{nameOf(c)}</span></>) : <Plus size={14} className="m-auto" />}
                      </button></td>); })}
              </tr>))}
          </tbody>
        </table>
      </Card></>}
      {edit && <PeriodModal key={`${edit.day}${edit.period}${grade}${section}`} ctx={edit} teachers={teachers} staff={staff} clash={clash} grade={grade} section={section} onClose={() => setEdit(null)}
        taken={edit.rec ? undefined : findSlotTaken(rows, { classId, day: edit.day, period: edit.period })}
        onSave={async (v) => {
          try {
            const body = { ...v, classId, grade, section };
            if (edit.rec) await update(edit.rec.id, body);
            else await create({ ...body, id: periodId(grade, section, edit.day, edit.period), day: edit.day, period: edit.period } as never);
            toast("Period saved"); setEdit(null);
          } catch { toast("Save failed", "error"); }
        }}
        onDelete={edit.rec ? async () => { try { await remove(edit.rec!.id); toast("Period cleared"); setEdit(null); } catch { toast("Could not clear the period", "error"); } } : undefined} />}
    </div>
  );
}

function PeriodModal({ ctx, teachers, staff, clash, taken, grade, section, onClose, onSave, onDelete }: {
  ctx: { day: string; period: number; rec?: Period }; teachers: StaffRef[]; staff: StaffRef[]; clash: Clash; taken?: Period;
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
  const subjects = !subject || SUBJECTS.includes(subject) ? SUBJECTS : [subject, ...SUBJECTS];
  const takenBy = taken ? `${taken.subject} (${staff.find((s) => s.id === taken.teacherId)?.name ?? taken.teacher})` : "";
  function save() {
    const e = validatePeriod({ day: ctx.day, period: ctx.period, subject, teacherId });
    if (taken) e.slot = `This slot already has ${takenBy}. Edit or clear that period instead.`;
    setErr(e); if (Object.keys(e).length) return;
    void run(() => onSave({ subject, teacher: name, teacherId, room: room.trim() }));
  }
  return (
    <Modal open onClose={onClose} title={ctx.rec ? "Edit period" : "Add period"} subtitle={`Grade ${grade}-${section} · ${ctx.day} · Period ${ctx.period}`}
      footer={<>{onDelete && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => run(onDelete)}>Clear period</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={save} disabled={busy}>{other ? "Save anyway" : "Save"}</Button></>}>
      <div className="space-y-4">
        {(err.day || err.period || err.slot) && <div role="alert" className="rounded-lg bg-error-container p-3 text-sm text-on-error-container">{[err.day, err.period, err.slot].filter(Boolean).join(" ")}</div>}
        <Field label="Subject" required error={err.subject}><Select value={subject} onChange={(e) => { setSubject(e.target.value); setErr((x) => ({ ...x, subject: "" })); }}>
          {!subject && <option value="">Select a subject…</option>}
          {subjects.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Teacher" required error={err.teacherId}><Select value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setErr((x) => ({ ...x, teacherId: "" })); }}>
          {!teacherId && <option value="">Select a teacher…</option>}
          {!teachers.some((t) => t.id === teacherId) && teacherId && <option value={teacherId}>{name || teacherId}</option>}
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.department})</option>)}</Select></Field>
        <Field label="Room"><Input value={room} onChange={(e) => setRoom(e.target.value)} /></Field>
        {other && <div role="alert" className="flex items-start gap-2 rounded-lg bg-warning-container p-3 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span><b>{name}</b> is already teaching {other.subject} in {clsLabel(periodClass(other))} at this time. Saving creates a double-booking.</span></div>}
        {!other && teacherId && <Badge tone="success">No clash</Badge>}
      </div>
    </Modal>
  );
}
