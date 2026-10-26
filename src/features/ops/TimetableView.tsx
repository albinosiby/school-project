"use client";
import { useMemo, useState } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { GRADES, SECTIONS, SUBJECTS, classIdOf, teachingStaff, type StaffRef } from "./shared";
import { SubstitutionsPanel } from "./SubstitutionsPanel";

export type Period = { id: string; classId?: string; grade: string; section: string; day: string; period: number; subject: string; teacher: string; teacherId?: string; room: string };
/** rows written before the contract have no classId; derive it */
export const periodClass = (r: Period) => r.classId ?? classIdOf(r.grade, r.section);
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const PERIODS = [1, 2, 3, 4, 5, 6, 7, 8];
const TIMES = ["08:00", "08:45", "09:30", "10:30", "11:15", "12:00", "13:00", "13:45"];
const subjectTone: Record<string, string> = { Physics: "bg-warning-container", "Remedial Lab": "bg-info-container", Mathematics: "bg-info-container", English: "bg-success-container", Science: "bg-warning-container", "Social Science": "bg-error-container", Hindi: "bg-surface-container-high", "Physical Education": "bg-surface-container" };

export function TimetableView() {
  const toast = useToast();
  const { rows, create, update, remove } = useCollection<Period>("ops_periods");
  const staff = useCollection<StaffRef>("staff").rows;
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const [tab, setTab] = useState("grid");
  const [grade, setGrade] = useState("10"); const [section, setSection] = useState("B");
  const [edit, setEdit] = useState<{ day: string; period: number; rec?: Period } | null>(null);
  const classId = classIdOf(grade, section);
  // teacher identity is the staff id; legacy rows that only carry a name are matched by name
  const key = (r: { teacherId?: string; teacher: string }) => r.teacherId || `n:${r.teacher}`;
  const nameOf = (r: Period) => staff.find((s) => s.id === r.teacherId)?.name ?? r.teacher;

  const mine = rows.filter((r) => periodClass(r) === classId);
  const cell = (d: string, p: number) => mine.find((r) => r.day === d && r.period === p);
  const clash = (r: { id?: string; day: string; period: number; teacherId?: string; teacher: string }) =>
    rows.find((o) => o.id !== r.id && o.day === r.day && o.period === r.period && key(o) === key(r) && periodClass(o) !== classId);
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
                <td className="align-middle"><div className="text-sm font-semibold">Period {p}</div><div className="t-caption font-mono text-outline">{TIMES[p - 1]}</div></td>
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
        onSave={async (v) => {
          try {
            const body = { ...v, classId, grade, section };
            if (edit.rec) await update(edit.rec.id, body);
            else await create({ ...body, id: `per_${grade}${section}_${edit.day}_${edit.period}`, day: edit.day, period: edit.period } as never);
            toast("Period saved"); setEdit(null);
          } catch { toast("Save failed", "error"); }
        }}
        onDelete={edit.rec ? async () => { try { await remove(edit.rec!.id); toast("Period cleared"); setEdit(null); } catch { toast("Could not clear the period", "error"); } } : undefined} />}
    </div>
  );
}

function PeriodModal({ ctx, teachers, staff, clash, grade, section, onClose, onSave, onDelete }: {
  ctx: { day: string; period: number; rec?: Period }; teachers: StaffRef[]; staff: StaffRef[]; clash: (r: { id?: string; day: string; period: number; teacherId?: string; teacher: string }) => Period | undefined;
  grade: string; section: string; onClose: () => void; onSave: (v: { subject: string; teacher: string; teacherId: string; room: string }) => Promise<void>; onDelete?: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<void>) => { setBusy(true); try { await fn(); } finally { setBusy(false); } };
  const [subject, setSubject] = useState(ctx.rec?.subject ?? SUBJECTS[0]!);
  const [teacherId, setTeacherId] = useState(ctx.rec?.teacherId ?? staff.find((s) => s.name === ctx.rec?.teacher)?.id ?? teachers[0]?.id ?? "");
  const [room, setRoom] = useState(ctx.rec?.room ?? `R-${grade}${section}`);
  const name = staff.find((s) => s.id === teacherId)?.name ?? "";
  const other = teacherId ? clash({ id: ctx.rec?.id, day: ctx.day, period: ctx.period, teacherId, teacher: name }) : undefined;
  const subjects = SUBJECTS.includes(subject) ? SUBJECTS : [subject, ...SUBJECTS];
  return (
    <Modal open onClose={onClose} title={ctx.rec ? "Edit period" : "Add period"} subtitle={`Grade ${grade}-${section} · ${ctx.day} · Period ${ctx.period}`}
      footer={<>{onDelete && <Button variant="danger" className="mr-auto" disabled={busy} onClick={() => run(onDelete)}>Clear period</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button onClick={() => run(() => onSave({ subject, teacher: name, teacherId, room: room.trim() }))} disabled={!teacherId || busy}>{other ? "Save anyway" : "Save"}</Button></>}>
      <div className="space-y-4">
        <Field label="Subject"><Select value={subject} onChange={(e) => setSubject(e.target.value)}>{subjects.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Teacher"><Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)}>
          {!teachers.some((t) => t.id === teacherId) && teacherId && <option value={teacherId}>{name || teacherId}</option>}
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.department})</option>)}</Select></Field>
        <Field label="Room"><Input value={room} onChange={(e) => setRoom(e.target.value)} /></Field>
        {other && <div role="alert" className="flex items-start gap-2 rounded-lg bg-warning-container p-3 text-sm text-warning"><AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span><b>{name}</b> is already teaching {other.subject} in Grade {other.grade}-{other.section} at this time. Saving creates a double-booking.</span></div>}
        {!other && <Badge tone="success">No clash</Badge>}
      </div>
    </Modal>
  );
}
