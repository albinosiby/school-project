"use client";
import { useMemo, useState } from "react";
import { BookText, CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, Select, Stat, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { GRADES, SECTIONS, SUBJECTS, classIdOf, teachingStaff, todayIso, type StaffRef } from "./shared";

type HW = { id: string; title: string; classId?: string; teacherId?: string; grade: string; section: string; subject: string; due: string; assigned: string; teacher: string; description: string; submitted: number; total: number };

export function AcademicsView() {
  const toast = useToast();
  const { rows, ready, create, update, remove } = useCollection<HW>("ops_homework");
  const students = useCollection<{ id: string; grade: string; section: string; classId?: string }>("students").rows;
  const staff = useCollection<StaffRef>("staff").rows;
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const [tab, setTab] = useState("all"); const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [subject, setSubject] = useState("");
  const [form, setForm] = useState<{ edit?: HW } | null>(null);
  const today = todayIso();
  // total 0 (empty class / not yet counted by the teacher app) is not "completed"
  const state = (h: HW) => ((h.total || 0) > 0 && (h.submitted || 0) >= h.total ? "closed" : h.due && h.due < today ? "overdue" : "open");

  const view = useMemo(() => rows.filter((h) => (!grade || h.grade === grade) && (!section || h.section === section) && (!subject || h.subject === subject) && (tab === "all" || state(h) === tab))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? "")), [rows, grade, section, subject, tab]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = (s: string) => rows.filter((h) => state(h) === s).length;
  const tot = rows.reduce((a, h) => a + (Number(h.total) || 0), 0), sub = rows.reduce((a, h) => a + (Number(h.submitted) || 0), 0);

  const cols: Column<HW>[] = [
    { key: "title", header: "Assignment", sortValue: (h) => h.title, render: (h) => <div><div className="font-semibold">{h.title}</div><div className="t-caption text-outline">{h.teacher}</div></div> },
    { key: "class", header: "Class", sortValue: (h) => +h.grade, render: (h) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {h.grade}-{h.section}</span> },
    { key: "subject", header: "Subject", sortValue: (h) => h.subject, render: (h) => h.subject },
    { key: "due", header: "Due", sortValue: (h) => h.due ?? "", render: (h) => (h.due ? fmtDate(h.due) : "—") },
    { key: "sub", header: "Submissions", sortValue: (h) => (h.submitted || 0) / (h.total || 1), render: (h) => <div className="w-36"><div className="mb-1 font-mono text-xs">{h.submitted || 0}/{h.total || 0}</div><ProgressBar value={((h.submitted || 0) / (h.total || 1)) * 100} tone={state(h) === "overdue" ? "danger" : "brand"} /></div> },
    { key: "status", header: "Status", render: (h) => { const s = state(h); return <Badge tone={s === "closed" ? "success" : s === "overdue" ? "danger" : "info"}>{s === "closed" ? "Completed" : s === "overdue" ? "Overdue" : "Open"}</Badge>; } },
  ];

  return (
    <div>
      <PageHeader title="Academics & Homework" subtitle="Assignments per class and subject with due dates and submission tracking." actions={<Button onClick={() => setForm({})}><Plus size={16} />Create Homework</Button>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Assignments" value={rows.length} icon={<BookText size={16} />} />
        <Stat label="Open" value={n("open")} icon={<Clock size={16} />} />
        <Stat label="Overdue" value={n("overdue")} subTone="danger" sub={n("overdue") ? "Chase" : undefined} />
        <Stat label="Overall submission rate" value={`${tot ? Math.round((sub / tot) * 100) : 0}%`} icon={<CheckCircle2 size={16} />} />
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <Tabs value={tab} onChange={setTab} items={[{ id: "all", label: "All", count: rows.length }, { id: "open", label: "Open", count: n("open") }, { id: "overdue", label: "Overdue", count: n("overdue") }, { id: "closed", label: "Completed", count: n("closed") }]} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32"><option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
            <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-32"><option value="">All sections</option>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select>
            <Select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-44"><option value="">All subjects</option>{SUBJECTS.map((g) => <option key={g}>{g}</option>)}</Select>
          </div>
        </div>
        {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading homework…</p> : <DataTable rows={view} columns={cols} onRowClick={(h) => setForm({ edit: h })}
          empty={<EmptyState title={rows.length ? "No homework matches" : "No homework yet"} hint={rows.length ? "Try another tab or filter." : "Create homework, or wait for teachers to post it from the app."} />} />}
      </Card>
      {form && <HWForm key={form.edit?.id ?? "new"} edit={form.edit} teachers={teachers} staff={staff} classSize={(g, s) => students.filter((x) => (x.classId ?? classIdOf(x.grade, x.section)) === classIdOf(g, s)).length} onClose={() => setForm(null)}
        onDelete={form.edit ? async () => { if (!window.confirm(`Delete "${form.edit!.title}"? Teachers and students lose it too.`)) return; try { await remove(form.edit!.id); toast("Assignment deleted"); setForm(null); } catch { toast("Could not delete", "error"); } } : undefined}
        onSave={async (v) => { try { if (form.edit) await update(form.edit.id, v); else await create(v as never); toast(form.edit ? "Assignment updated" : "Homework created"); setForm(null); } catch { toast("Save failed", "error"); } }} />}
    </div>
  );
}

function HWForm({ edit, teachers, staff, classSize, onClose, onSave, onDelete }: { edit?: HW; teachers: StaffRef[]; staff: StaffRef[]; classSize: (g: string, s: string) => number; onClose: () => void; onSave: (v: Omit<HW, "id">) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [f, setF] = useState({ title: edit?.title ?? "", grade: edit?.grade ?? "8", section: edit?.section ?? "A", subject: edit?.subject ?? SUBJECTS[0]!, due: edit?.due ?? "", teacherId: edit?.teacherId ?? staff.find((s) => s.name === edit?.teacher)?.id ?? teachers[0]?.id ?? "",
    description: edit?.description ?? "", submitted: edit?.submitted ?? 0, total: edit?.total ?? 0 });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  // the class roster size (no invented default); an edit keeps its stored total unless the class changes
  const size = edit && edit.grade === f.grade && edit.section === f.section ? Number(edit.total) || 0 : classSize(f.grade, f.section);
  async function submit() {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = "Title is required";
    if (!f.due) e.due = "Due date is required"; else if (!edit && f.due < todayIso()) e.due = "Due date cannot be in the past";
    if (!f.teacherId) e.teacherId = "Pick a teacher";
    if (!size && (!edit || edit.grade !== f.grade || edit.section !== f.section)) e.grade = "No students in this class";
    const sb = Number(f.submitted); if (!Number.isInteger(sb) || sb < 0 || sb > size) e.submitted = `Whole number, 0–${size}`;
    setErr(e); if (Object.keys(e).length) return;
    const { teacherId, ...rest } = f;
    setSaving(true);
    try { await onSave({ ...rest, title: f.title.trim(), classId: classIdOf(f.grade, f.section), teacherId, teacher: staff.find((s) => s.id === teacherId)?.name ?? edit?.teacher ?? "", assigned: edit?.assigned ?? todayIso(), submitted: sb, total: size }); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={edit ? "Edit homework" : "Create homework"} width="max-w-xl"
      footer={<>{onDelete && <Button variant="danger" className="mr-auto" disabled={saving} onClick={onDelete}><Trash2 size={14} />Delete</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save" : "Create"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required error={err.title} className="sm:col-span-2"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Grade" error={err.grade}><Select value={f.grade} onChange={(e) => set("grade", e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section"><Select value={f.section} onChange={(e) => set("section", e.target.value)}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Subject"><Select value={f.subject} onChange={(e) => set("subject", e.target.value)}>{[...new Set([f.subject, ...SUBJECTS])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Teacher" error={err.teacherId}><Select value={f.teacherId} onChange={(e) => set("teacherId", e.target.value)}>
          {!f.teacherId && <option value="">Select a teacher…</option>}
          {f.teacherId && !teachers.some((t) => t.id === f.teacherId) && <option value={f.teacherId}>{staff.find((s) => s.id === f.teacherId)?.name ?? edit?.teacher ?? f.teacherId}</option>}
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Due date" required error={err.due}><Input type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label={`Submissions (of ${size})`} error={err.submitted}><Input type="number" value={f.submitted} onChange={(e) => set("submitted", e.target.value)} /></Field>
        <Field label="Instructions" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
