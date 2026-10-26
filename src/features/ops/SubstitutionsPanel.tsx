"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, Select, Textarea, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { dayOfIso, teachingStaff, todayIso, type StaffRef } from "./shared";
import { periodClass, type Period } from "./TimetableView";

export type Substitution = {
  id: string; date: string; day: string; period: number; classId: string; subject: string; absentTeacherId: string; substituteTeacherId: string;
  status: "Assigned" | "Accepted" | "Declined"; topic?: string; note?: string;
};
type ClassRow = { id: string; grade: string; section: string };
const tone = { Assigned: "warning", Accepted: "success", Declined: "danger" } as const;
const clsLabel = (id: string) => id.replace(/^cls_(\d+)(.*)$/, "Grade $1-$2");

/** Substitute cover (ops_substitutions): admin picks the slot of an absent teacher and a free colleague. */
export function SubstitutionsPanel({ staff, periods }: { staff: StaffRef[]; periods: Period[] }) {
  const toast = useToast();
  const subs = useCollection<Substitution>("ops_substitutions");
  const [form, setForm] = useState<{ edit?: Substitution } | null>(null);
  const [upcoming, setUpcoming] = useState("upcoming");
  const [del, setDel] = useState<Substitution | null>(null);
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const today = todayIso();
  const view = useMemo(() => subs.rows.filter((s) => upcoming === "all" || (s.date ?? "") >= today).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || a.period - b.period), [subs.rows, upcoming, today]);

  const cols: Column<Substitution>[] = [
    { key: "date", header: "Date", sortValue: (s) => s.date, render: (s) => <div><div className="font-semibold">{fmtDate(s.date)}</div><div className="t-caption text-outline">{s.day} · Period {s.period}</div></div> },
    { key: "class", header: "Class", sortValue: (s) => s.classId, render: (s) => <div><span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{clsLabel(s.classId)}</span><div className="t-caption mt-0.5 text-outline">{s.subject}</div></div> },
    { key: "absent", header: "Absent teacher", sortValue: (s) => name(s.absentTeacherId), render: (s) => name(s.absentTeacherId) },
    { key: "sub", header: "Substitute", sortValue: (s) => name(s.substituteTeacherId), render: (s) => <span className="font-semibold">{name(s.substituteTeacherId)}</span> },
    { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => <Badge tone={tone[s.status] ?? "neutral"}>{s.status}</Badge> },
    { key: "act", header: "", className: "text-right", render: (s) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="outline" onClick={() => setForm({ edit: s })}>Reassign</Button>
        <Button size="sm" variant="ghost" aria-label={`Remove substitution for ${clsLabel(s.classId)} period ${s.period} on ${s.date}`} onClick={() => setDel(s)}><Trash2 size={14} className="text-error" /></Button>
      </div>) },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <h3 className="font-semibold">Substitutions</h3>
        <Select aria-label="Show" value={upcoming} onChange={(e) => setUpcoming(e.target.value)} className="w-40"><option value="upcoming">Upcoming</option><option value="all">All dates</option></Select>
        <Button className="ml-auto" onClick={() => setForm({})}><Plus size={16} />Assign substitute</Button>
      </div>
      {!subs.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading substitutions…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No substitutions" hint="Assign a colleague to cover the period of an absent teacher." />} />}
      {form && <SubForm key={form.edit?.id ?? "new"} edit={form.edit} staff={staff} periods={periods} all={subs.rows} onClose={() => setForm(null)}
        onSave={async (v) => {
          try {
            const id = form.edit?.id ?? `sub_${v.date}_${v.classId}_${v.period}`;
            const existing = subs.rows.find((r) => r.id === id);
            // a new assignment starts as "Assigned" (the substitute accepts or declines in the teacher app)
            const body = { ...v, status: "Assigned" as const };
            if (existing) await subs.update(id, body); else await subs.create({ ...body, id } as never);
            toast("Substitute assigned"); setForm(null);
          } catch { toast("Save failed", "error"); }
        }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove substitution?" subtitle={del ? `${clsLabel(del.classId)} · ${fmtDate(del.date)} · Period ${del.period}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await subs.remove(del!.id); toast("Substitution removed"); setDel(null); } catch { toast("Could not remove the substitution", "error"); } }}>Remove</Button></>}>
        <p className="text-on-surface-variant">The substitute no longer sees this period in the teacher app.</p></Modal>
    </Card>
  );
}

function SubForm({ edit, staff, periods, all, onClose, onSave }: {
  edit?: Substitution; staff: StaffRef[]; periods: Period[]; all: Substitution[]; onClose: () => void;
  onSave: (v: Omit<Substitution, "id" | "status">) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const classes = useCollection<ClassRow>("classes").rows;
  const classIds = useMemo(() => [...new Set([...classes.map((c) => c.id), ...periods.map(periodClass)])].sort((a, b) => a.localeCompare(b, "en", { numeric: true })), [classes, periods]);
  const [date, setDate] = useState(edit?.date ?? todayIso());
  const [classId, setClassId] = useState(edit?.classId ?? classIds[0] ?? "");
  const [period, setPeriod] = useState(edit?.period ?? 0);
  const [substituteId, setSubstituteId] = useState(edit?.substituteTeacherId ?? "");
  const [topic, setTopic] = useState(edit?.topic ?? ""); const [note, setNote] = useState(edit?.note ?? "");
  const day = dayOfIso(date);
  const slots = periods.filter((p) => periodClass(p) === classId && p.day === day).sort((a, b) => a.period - b.period);
  const slot = slots.find((p) => p.period === period);
  // teachers busy at that day/period: teaching a class, or already covering another slot (other than this one)
  const busyWhy = (id: string) => {
    const t = periods.find((p) => p.day === day && p.period === period && p.teacherId === id);
    if (t) return `teaching ${clsLabel(periodClass(t))}`;
    const c = all.find((s) => s.date === date && s.period === period && s.substituteTeacherId === id && s.id !== edit?.id && !(s.classId === classId));
    return c ? `covering ${clsLabel(c.classId)}` : "";
  };
  const cands = teachingStaff(staff).filter((s) => s.id !== slot?.teacherId);
  const bad = !slot || !substituteId || !!busyWhy(substituteId);
  return (
    <Modal open onClose={onClose} title={edit ? "Reassign substitute" : "Assign substitute"} width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={bad || saving} onClick={async () => {
        setSaving(true);
        try { await onSave({ date, day, period, classId, subject: slot!.subject, absentTeacherId: slot!.teacherId ?? "", substituteTeacherId: substituteId, ...(topic.trim() || edit?.topic ? { topic: topic.trim() } : {}), ...(note.trim() || edit?.note ? { note: note.trim() } : {}) }); } finally { setSaving(false); }
      }}>{saving ? "Saving…" : "Assign"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" error={day === "Sun" ? "No classes on Sunday" : undefined}><Input type="date" value={date} disabled={!!edit} onChange={(e) => { if (e.target.value) { setDate(e.target.value); setPeriod(0); setSubstituteId(""); } }} /></Field>
        <Field label="Class"><Select value={classId} disabled={!!edit} onChange={(e) => { setClassId(e.target.value); setPeriod(0); setSubstituteId(""); }}>{classIds.map((c) => <option key={c} value={c}>{clsLabel(c)}</option>)}</Select></Field>
        <Field label="Period (teacher who is absent)" className="sm:col-span-2" error={slots.length === 0 ? `No periods scheduled for ${clsLabel(classId)} on ${day}.` : undefined}>
          <Select value={period} disabled={!!edit} onChange={(e) => { setPeriod(Number(e.target.value)); setSubstituteId(""); }}>
            <option value={0}>Select a period…</option>
            {slots.map((p) => <option key={p.id} value={p.period}>P{p.period} · {p.subject} · {staff.find((s) => s.id === p.teacherId)?.name ?? p.teacher}</option>)}</Select></Field>
        <Field label="Substitute teacher" className="sm:col-span-2" error={substituteId && busyWhy(substituteId) ? `Busy: ${busyWhy(substituteId)}` : undefined}>
          <Select value={substituteId} disabled={!slot} onChange={(e) => setSubstituteId(e.target.value)}>
            <option value="">Select a free teacher…</option>
            {cands.map((s) => { const why = busyWhy(s.id); return <option key={s.id} value={s.id} disabled={!!why}>{s.name} ({s.department}){why ? ` · busy: ${why}` : ""}</option>; })}</Select></Field>
        <Field label="Topic / plan" className="sm:col-span-2"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="What the substitute should cover" /></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
