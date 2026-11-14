"use client";
import { useMemo, useState, type ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, Textarea, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { clsLabel, dayOfIso, teacherOptionLabel, teachingStaff, todayIso, type StaffRef } from "./shared";
import { busyReason, coverCandidates, nextSubStatus, periodClass, subId, subStatus, validateSubstitution, type LeaveRef, type Period, type Substitution } from "./logic";

export type { Substitution } from "./logic";
type ClassRow = { id: string; grade: string; section: string };
const tone = { Assigned: "warning", Accepted: "success", Declined: "danger" } as const;

/**
 * Substitute cover (ops_substitutions, data contract sections 3 and 9): the admin picks the slot of an absent teacher and a
 * free colleague. Id sub_{date}_{classId}_{period}; a new or reassigned cover is "Assigned", the substitute accepts or
 * declines in the teacher app (the only change the substitute may make).
 */
export function SubstitutionsPanel({ staff, periods, classId, date, today: schoolToday, renderPeriods }: {
  staff: StaffRef[]; periods: Period[]; classId?: string; date?: string; today?: string;
  renderPeriods?: (assign: (period: number) => void, ready: boolean) => ReactNode;
}) {
  const toast = useToast();
  const subs = useCollection<Substitution>("ops_substitutions");
  const leaveRecords = useCollection<LeaveRef>("staff_leaves");
  const leaves = leaveRecords.rows;
  const [form, setForm] = useState<{ edit?: Substitution; period?: number } | null>(null);
  const [upcoming, setUpcoming] = useState("upcoming");
  const [del, setDel] = useState<Substitution | null>(null);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const today = schoolToday || todayIso();
  const ready = subs.ready && leaveRecords.ready;
  const past = Boolean(classId && date && date < today);
  const view = useMemo(() => subs.rows.filter((s) => (!classId || s.classId === classId) &&
    (date ? s.date === date : upcoming === "all" || (s.date ?? "") >= today)).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || Number(a.period) - Number(b.period)), [subs.rows, upcoming, today, classId, date]);
  const assignPeriod = (period: number) => {
    if (!ready || past) return;
    const existing = subs.rows.find((row) => row.classId === classId && row.date === date && Number(row.period) === period);
    setForm(existing ? { edit: existing } : { period });
  };

  const cols: Column<Substitution>[] = [
    { key: "date", header: "Date", sortValue: (s) => s.date, render: (s) => <div><div className="font-semibold">{fmtDate(s.date)}</div><div className="t-caption text-outline">{s.day || dayOfIso(s.date)} · Period {s.period}</div></div> },
    { key: "class", header: "Class", sortValue: (s) => s.classId, render: (s) => <div><span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{clsLabel(s.classId)}</span><div className="t-caption mt-0.5 text-outline">{s.subject}</div></div> },
    { key: "absent", header: "Absent teacher", sortValue: (s) => name(s.absentTeacherId), render: (s) => name(s.absentTeacherId) },
    { key: "sub", header: "Substitute", sortValue: (s) => name(s.substituteTeacherId), render: (s) => <span className="font-semibold">{name(s.substituteTeacherId)}</span> },
    { key: "status", header: "Status", sortValue: (s) => subStatus(s.status), render: (s) => { const st = subStatus(s.status); return <Badge tone={tone[st]}>{st}</Badge>; } },
    { key: "act", header: "", className: "text-right", render: (s) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" disabled={!ready || past} onClick={() => setForm({ edit: s })}>Reassign</Button>
        <Button size="sm" variant="ghost" aria-label={`Remove substitution for ${clsLabel(s.classId)} period ${s.period} on ${s.date}`} onClick={() => setDel(s)}><Trash2 size={14} className="text-error" /></Button>
      </div>) },
  ];

  return (
    <>
    {renderPeriods?.(assignPeriod, ready)}
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <h3 className="font-semibold">Substitutions</h3>
        {date ? <span className="text-sm text-on-surface-variant">{fmtDate(date)}</span> : <Select aria-label="Show" value={upcoming} onChange={(e) => setUpcoming(e.target.value)} className="w-40"><option value="upcoming">Upcoming</option><option value="all">All dates</option></Select>}
        <Button className="ml-auto" disabled={!ready || past} onClick={() => setForm({})}><Plus size={16} />Assign substitute</Button>
      </div>
      {!subs.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading substitutions…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No substitutions" hint="Assign a colleague to cover the period of an absent teacher." />} />}
      {form && <SubForm key={form.edit?.id ?? `new:${form.period ?? 0}`} edit={form.edit} initialPeriod={form.period} initialDate={date} fixedClassId={classId} today={today} staff={staff} periods={periods} all={subs.rows} leaves={leaves} onClose={() => setForm(null)}
        onSave={async (v) => {
          try {
            const id = form.edit?.id ?? subId(v.date, v.classId, v.period);
            const existing = subs.rows.find((r) => r.id === id);
            const body = { ...v, status: nextSubStatus(existing, v.substituteTeacherId) };
            if (existing) await subs.update(id, body); else await subs.create({ ...body, id } as never);
            toast("Substitute assigned"); setForm(null);
          } catch { toast("Save failed", "error"); }
        }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove substitution?" subtitle={del ? `${clsLabel(del.classId)} · ${fmtDate(del.date)} · Period ${del.period}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await subs.remove(del!.id); toast("Substitution removed"); setDel(null); } catch { toast("Could not remove the substitution", "error"); } }}>Remove</Button></>}>
        <p className="text-on-surface-variant">The substitute no longer sees this period in the teacher app.</p></Modal>
    </Card>
    </>
  );
}

function SubForm({ edit, staff, periods, all, leaves, initialPeriod, initialDate, fixedClassId, today, onClose, onSave }: {
  edit?: Substitution; staff: StaffRef[]; periods: Period[]; all: Substitution[]; leaves: LeaveRef[]; onClose: () => void;
  initialPeriod?: number; initialDate?: string; fixedClassId?: string; today: string;
  onSave: (v: Omit<Substitution, "id" | "status">) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const classes = useCollection<ClassRow>("classes").rows;
  const classIds = useMemo(() => [...new Set([...classes.map((c) => c.id), ...periods.map(periodClass)])].sort((a, b) => a.localeCompare(b, "en", { numeric: true })), [classes, periods]);
  const [date, setDate] = useState(edit?.date ?? initialDate ?? today);
  const [classId, setClassId] = useState(edit?.classId ?? fixedClassId ?? classIds[0] ?? "");
  const [period, setPeriod] = useState(Number(edit?.period ?? initialPeriod ?? 0));
  const [substituteId, setSubstituteId] = useState(edit?.substituteTeacherId ?? "");
  const [topic, setTopic] = useState(edit?.topic ?? ""); const [note, setNote] = useState(edit?.note ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const day = dayOfIso(date);
  const slots = periods.filter((p) => periodClass(p) === classId && p.day === day).sort((a, b) => Number(a.period) - Number(b.period));
  const slot = slots.find((p) => Number(p.period) === period);
  // an edit keeps the stored absent teacher and subject even if the timetable changed since
  const absentTeacherId = edit ? edit.absentTeacherId : slot?.teacherId || staff.find((member) => member.name === slot?.teacher)?.id || "";
  const subject = edit ? edit.subject : slot?.subject ?? "";
  const why = (id: string) => busyReason(id, { date, period, classId, periods, subs: all, leaves, editId: edit?.id });
  const cands = coverCandidates(teachingStaff(staff), absentTeacherId, why);
  const existing = !edit && slot ? all.find((s) => s.classId === classId && s.date === date && Number(s.period) === period) : undefined;
  const reset = () => setErr({});

  async function submit() {
    const e = validateSubstitution({
      date, today, isNew: !edit, hasSlot: !!edit || !!slot, absentTeacherId, substituteId, busy: substituteId ? why(substituteId) : "",
      existing: existing ? { substituteName: staff.find((s) => s.id === existing.substituteTeacherId)?.name ?? existing.substituteTeacherId } : undefined,
    });
    if (!absentTeacherId && slot) e.period = "The scheduled teacher needs a staff profile before assigning cover.";
    setErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try {
      await onSave({ date, day, period, classId, subject, absentTeacherId, substituteTeacherId: substituteId,
        ...(topic.trim() || edit?.topic ? { topic: topic.trim() } : {}), ...(note.trim() || edit?.note ? { note: note.trim() } : {}) });
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={edit ? "Reassign substitute" : "Assign substitute"} subtitle={fixedClassId ? clsLabel(fixedClassId) : undefined} width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Assign"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" required error={err.date || (day === "Sun" ? "No classes on Sunday" : undefined)}><Input type="date" value={date} disabled={!!edit || !!fixedClassId} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPeriod(0); setSubstituteId(""); reset(); } }} /></Field>
        <Field label="Class" required><Select value={classId} disabled={!!edit || !!fixedClassId} onChange={(e) => { setClassId(e.target.value); setPeriod(0); setSubstituteId(""); reset(); }}>{[...new Set([...classIds, ...(fixedClassId ? [fixedClassId] : [])])].map((c) => <option key={c} value={c}>{clsLabel(c)}</option>)}</Select></Field>
        <Field label="Period (teacher who is absent)" required className="sm:col-span-2" error={err.period || (!edit && slots.length === 0 ? `No periods scheduled for ${clsLabel(classId)} on ${day}.` : undefined)}>
          <Select value={period} disabled={!!edit} onChange={(e) => { setPeriod(Number(e.target.value)); setSubstituteId(""); reset(); }}>
            <option value={0}>Select a period…</option>
            {edit && !slot && <option value={period}>P{period} · {edit.subject} · {staff.find((s) => s.id === edit.absentTeacherId)?.name ?? edit.absentTeacherId}</option>}
            {slots.map((p) => <option key={p.id} value={Number(p.period)}>P{p.period} · {p.subject} · {staff.find((s) => s.id === p.teacherId)?.name ?? p.teacher}</option>)}</Select></Field>
        <Field label="Substitute teacher" required className="sm:col-span-2" error={err.substitute || (substituteId && why(substituteId) ? `Busy: ${why(substituteId)}` : undefined)}>
          <Select value={substituteId} disabled={!edit && !slot} onChange={(e) => { setSubstituteId(e.target.value); setErr((x) => ({ ...x, substitute: "" })); }}>
            <option value="">Select a free teacher…</option>
            {substituteId && !cands.some((c) => c.id === substituteId) && <option value={substituteId}>{staff.find((s) => s.id === substituteId)?.name ?? substituteId}</option>}
            {cands.map((s) => <option key={s.id} value={s.id} disabled={!!s.busy}>{teacherOptionLabel(s)}{s.busy ? ` · busy: ${s.busy}` : ""}</option>)}</Select></Field>
        <Field label="Topic / plan" className="sm:col-span-2"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What the substitute should cover" /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
