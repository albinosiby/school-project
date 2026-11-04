"use client";
import { useMemo, useState } from "react";
import { BookText, CheckCircle2, Clock, Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, Select, Stat, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { GRADES, SECTIONS, SUBJECTS, activeStudent, classIdOf, studentClassId, teachingStaff, todayIso, type StaffRef } from "./shared";
import { hasSubmissions, hwClassId, hwCounts, hwState, hwVisible, validateHomework, type HW, type HWState } from "./logic";

const STATE_LABEL: Record<HWState, string> = { open: "Open", overdue: "Overdue", closed: "Completed", draft: "Draft" };
const STATE_TONE = { open: "info", overdue: "danger", closed: "success", draft: "warning" } as const;
type Stu = { id: string; grade: string; section: string; classId?: string; status?: string; deleted?: boolean };

/**
 * ops_homework (data contract sections 4, 11). Teachers write the teacher shape plus denormalized admin fields; admin-created
 * homework has status "Published" and no per-student data (the teacher app fills `submissions` and recomputes the counts).
 * Soft-deleted homework (deleted:true, the teacher app's delete) is hidden.
 */
export function AcademicsView() {
  const toast = useToast();
  const { rows: all, ready, create, update, remove } = useCollection<HW>("ops_homework");
  const students = useCollection<Stu>("students").rows;
  const staff = useCollection<StaffRef>("staff").rows;
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const [tab, setTab] = useState("all"); const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [subject, setSubject] = useState("");
  const [form, setForm] = useState<{ edit?: HW } | null>(null);
  const today = todayIso();
  const rows = useMemo(() => all.filter(hwVisible), [all]);
  const state = (h: HW) => hwState(h, today);

  const view = rows.filter((h) => (!grade || h.grade === grade) && (!section || h.section === section) && (!subject || h.subject === subject) && (tab === "all" || state(h) === tab))
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));
  const n = (s: HWState) => rows.filter((h) => state(h) === s).length;
  const counted = rows.filter((h) => state(h) !== "draft").map(hwCounts);
  const tot = counted.reduce((a, c) => a + c.total, 0), sub = counted.reduce((a, c) => a + c.submitted, 0);
  const subjects = useMemo(() => [...new Set([...SUBJECTS, ...rows.map((h) => h.subject).filter(Boolean)])], [rows]);

  const cols: Column<HW>[] = [
    { key: "title", header: "Assignment", sortValue: (h) => h.title, render: (h) => <div><div className="font-semibold">{h.title}</div><div className="t-caption text-outline">{h.teacher}</div></div> },
    { key: "class", header: "Class", sortValue: (h) => +h.grade, render: (h) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {h.grade}-{h.section}</span> },
    { key: "subject", header: "Subject", sortValue: (h) => h.subject, render: (h) => h.subject },
    { key: "due", header: "Due", sortValue: (h) => h.due ?? "", render: (h) => (h.due ? fmtDate(h.due) : "—") },
    { key: "sub", header: "Submissions", sortValue: (h) => { const c = hwCounts(h); return c.submitted / (c.total || 1); }, render: (h) => { const c = hwCounts(h); return <div className="w-36"><div className="mb-1 font-mono text-xs">{c.submitted}/{c.total}</div><ProgressBar value={(c.submitted / (c.total || 1)) * 100} tone={state(h) === "overdue" ? "danger" : "brand"} /></div>; } },
    { key: "status", header: "Status", render: (h) => { const s = state(h); return <Badge tone={STATE_TONE[s]}>{STATE_LABEL[s]}</Badge>; } },
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
          <Tabs value={tab} onChange={setTab} items={[{ id: "all", label: "All", count: rows.length }, { id: "open", label: "Open", count: n("open") }, { id: "overdue", label: "Overdue", count: n("overdue") }, { id: "closed", label: "Completed", count: n("closed") }, ...(n("draft") ? [{ id: "draft", label: "Drafts", count: n("draft") }] : [])]} />
          <div className="ml-auto flex flex-wrap gap-2">
            <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32"><option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
            <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-32"><option value="">All sections</option>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select>
            <Select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="w-44"><option value="">All subjects</option>{subjects.map((g) => <option key={g}>{g}</option>)}</Select>
          </div>
        </div>
        {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading homework…</p> : <DataTable rows={view} columns={cols} onRowClick={(h) => setForm({ edit: h })}
          empty={<EmptyState title={rows.length ? "No homework matches" : "No homework yet"} hint={rows.length ? "Try another tab or filter." : "Create homework, or wait for teachers to post it from the app."} />} />}
      </Card>
      {form && <HWForm key={form.edit?.id ?? "new"} edit={form.edit} teachers={teachers} staff={staff}
        classSize={(cid) => students.filter((x) => activeStudent(x) && studentClassId(x) === cid).length} onClose={() => setForm(null)}
        onDelete={form.edit ? async () => { if (!window.confirm(`Delete "${form.edit!.title}"? Teachers and students lose it too.`)) return; try { await remove(form.edit!.id); toast("Assignment deleted"); setForm(null); } catch { toast("Could not delete", "error"); } } : undefined}
        onSave={async (v) => { try { if (form.edit) await update(form.edit.id, v); else await create(v as never); toast(form.edit ? "Assignment updated" : "Homework created"); setForm(null); } catch { toast("Save failed", "error"); } }} />}
    </div>
  );
}

function HWForm({ edit, teachers, staff, classSize, onClose, onSave, onDelete }: { edit?: HW; teachers: StaffRef[]; staff: StaffRef[]; classSize: (classId: string) => number; onClose: () => void; onSave: (v: Partial<HW>) => Promise<void>; onDelete?: () => Promise<void> }) {
  const [f, setF] = useState({ title: edit?.title ?? "", grade: edit?.grade ?? "8", section: edit?.section ?? "A", subject: edit?.subject ?? "", due: edit?.due ?? "", teacherId: edit?.teacherId ?? staff.find((s) => s.name === edit?.teacher)?.id ?? "",
    description: edit?.description ?? "", maxMarks: String(edit?.maxMarks ?? 20), submitted: String(edit ? hwCounts(edit).submitted : 0) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErr((e) => ({ ...e, [k]: "", ...(k === "section" ? { grade: "" } : {}) })); };
  const classId = classIdOf(f.grade, f.section);
  const classChanged = !edit || hwClassId(edit) !== classId;
  // the teacher app owns per-student submissions: their counts are read-only here and the class cannot move
  const locked = !!edit && hasSubmissions(edit);
  // the class roster size (no invented default); an edit keeps its stored total unless the class changes
  const size = !classChanged && edit ? hwCounts(edit).total : classSize(classId);
  // a new homework is assigned today; an edit keeps its stored date (older rows without one skip the order check)
  const assigned = edit ? edit.assigned || "" : todayIso();
  async function submit() {
    const e = validateHomework({ ...f, classId }, { assigned, size, classChanged, countsLocked: locked });
    setErr(e); if (Object.keys(e).length) return;
    const teacher = staff.find((s) => s.id === f.teacherId)?.name ?? edit?.teacher ?? "";
    const base = { title: f.title.trim(), grade: f.grade, section: f.section, classId, subject: f.subject, due: f.due, teacherId: f.teacherId, teacher, description: f.description.trim(), maxMarks: Number(f.maxMarks) };
    const counts = locked ? {} : { submitted: Number(f.submitted), total: size };
    setSaving(true);
    try {
      // contract section 11: admin-created homework is "Published" with no per-student data
      if (edit) await onSave({ ...base, ...counts });
      else await onSave({ ...base, ...counts, assigned, status: "Published", createdAt: new Date().toISOString() });
    } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={edit ? "Edit homework" : "Create homework"} width="max-w-xl"
      footer={<>{onDelete && <Button variant="danger" className="mr-auto" disabled={saving} onClick={onDelete}><Trash2 size={14} />Delete</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save" : "Create"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required error={err.title} className="sm:col-span-2"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Grade" required error={err.grade}><Select value={f.grade} disabled={locked} onChange={(e) => set("grade", e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section" required><Select value={f.section} disabled={locked} onChange={(e) => set("section", e.target.value)}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Subject" required error={err.subject}><Select value={f.subject} onChange={(e) => set("subject", e.target.value)}>
          {!f.subject && <option value="">Select a subject…</option>}
          {[...new Set([...(f.subject ? [f.subject] : []), ...SUBJECTS])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Teacher" required error={err.teacherId}><Select value={f.teacherId} onChange={(e) => set("teacherId", e.target.value)}>
          {!f.teacherId && <option value="">Select a teacher…</option>}
          {f.teacherId && !teachers.some((t) => t.id === f.teacherId) && <option value={f.teacherId}>{staff.find((s) => s.id === f.teacherId)?.name ?? edit?.teacher ?? f.teacherId}</option>}
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Due date" required error={err.due} hint={edit && assigned ? `Assigned ${fmtDate(assigned)}` : undefined}><Input type="date" value={f.due} min={assigned || undefined} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label="Max marks" required error={err.maxMarks}><Input type="number" min={1} value={f.maxMarks} onChange={(e) => set("maxMarks", e.target.value)} /></Field>
        <Field label={`Submissions (of ${size})`} error={err.submitted} hint={locked ? "Counted by the teacher app" : undefined}><Input type="number" min={0} max={size} value={f.submitted} disabled={locked} onChange={(e) => set("submitted", e.target.value)} /></Field>
        <Field label="Instructions" className="sm:col-span-2"><Textarea value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}
