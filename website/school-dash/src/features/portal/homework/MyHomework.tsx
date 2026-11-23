"use client";
// /me/homework: the teacher's `ops_homework` — create, grade submissions, close, soft delete — written the way the
// teacher app's `tk_homework` adapter writes it (rules: classId, title ≤ 200, a subject the teacher teaches in the class).
import { useState } from "react";
import { Badge, Button, Card, EmptyState, Field, Input, LoadingSkeleton, Modal, PageHeader, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, classRoster, todayIso, useTeachingData } from "../teaching";
import {
  SUBMISSION_STATUSES, countSubmitted, editableSubmissions, emptyForm, gradingPatch, hwTone, localStatus, newHomework, ownHomework, setSubmission, validateHomework,
  type Homework, type HomeworkForm, type Submission,
} from "./logic";

export function MyHomework() {
  const toast = useToast();
  const data = useTeachingData();
  const hw = useCollection<Homework>("ops_homework", data.teaching, [["teacherId", "==", data.staffId]]);
  const today = todayIso();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<HomeworkForm>(() => emptyForm(today));
  const [errors, setErrors] = useState<Partial<Record<keyof HomeworkForm, string>>>({});
  const [grading, setGrading] = useState<Homework | null>(null);
  const [subs, setSubs] = useState<Record<string, Submission>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof HomeworkForm, v: string) => { setForm((f) => ({ ...f, [k]: v, ...(k === "classId" ? { subject: "" } : {}) })); setErrors((e) => ({ ...e, [k]: undefined })); };

  if (!data.teaching) return <EmptyState title="Only teachers have homework" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !hw.ready) return <LoadingSkeleton variant="table" label="Loading homework…" />;
  const rows = ownHomework(hw.rows, data.staffId);
  const subjects = form.classId ? data.subjectsFor(form.classId) : [];
  const studentName = (id: string) => data.students.find((s) => s.id === id)?.name ?? id;

  async function create() {
    const roster = classRoster(data.students, form.classId);
    const e = validateHomework(form, { subjects, rosterSize: roster.length });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const cls = data.classOf(form.classId);
      const body = newHomework(form, { staffId: data.staffId, teacherName: data.name, rosterIds: roster.map((s) => s.id), grade: cls?.grade, section: cls?.section, now: new Date().toISOString(), today });
      await hw.create({ id: `hw_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ...body });
      toast(`Homework "${body.title}" assigned to ${classIdLabel(form.classId)}`);
      setCreating(false); setForm(emptyForm(today));
    } catch { toast("Could not create the homework", "error"); } finally { setBusy(false); }
  }
  function openGrading(h: Homework) {
    setSubs(editableSubmissions(h, classRoster(data.students, h.classId).map((s) => s.id)));
    setGrading(h);
  }
  async function saveGrading() {
    if (!grading) return;
    setBusy(true);
    try {
      await hw.update(grading.id, gradingPatch(subs));
      toast(`Submissions saved · ${countSubmitted(subs)}/${Object.keys(subs).length} turned in`);
      setGrading(null);
    } catch { toast("Could not save the submissions", "error"); } finally { setBusy(false); }
  }
  async function close(h: Homework) {
    try { await hw.update(h.id, { status: "closed" }); toast(`"${h.title}" closed`); } catch { toast("Could not close the homework", "error"); }
  }
  async function remove(h: Homework) {
    if (!window.confirm(`Delete "${h.title}"? Parents will no longer see it.`)) return;
    try { await hw.update(h.id, { deleted: true }); toast(`"${h.title}" deleted`); } catch { toast("Could not delete the homework", "error"); }
  }

  return <div className="space-y-5">
    <PageHeader title="Homework" subtitle={`${rows.length} assignment${rows.length === 1 ? "" : "s"}`}
      actions={<Button onClick={() => { setForm(emptyForm(today)); setErrors({}); setCreating(true); }} disabled={!data.classIds.length}>New homework</Button>} />
    <Card>
      {!rows.length ? <EmptyState title="No homework yet" hint={data.classIds.length ? "Create the first assignment for one of your classes." : "You have no classes to assign homework to."} /> : <div className="overflow-x-auto">
        <table aria-label="My homework" className="w-full text-left text-sm">
          <thead className="border-b border-outline-variant/50 text-xs text-on-surface-variant"><tr>
            <th className="p-3">Title</th><th className="p-3">Class</th><th className="p-3">Subject</th><th className="p-3">Due</th><th className="p-3">Submitted</th><th className="p-3">Status</th><th className="p-3"></th>
          </tr></thead>
          <tbody>{rows.map((h) => {
            const status = localStatus(h.status);
            const subsOf = h.submissions ?? {};
            const turnedIn = Object.keys(subsOf).length ? countSubmitted(subsOf) : Number(h.submitted) || 0;
            const total = Object.keys(subsOf).length || Number(h.total) || 0;
            return <tr key={h.id} className="border-b border-outline-variant/40 last:border-0" aria-label={`Homework ${h.title}`}>
              <td className="p-3"><p className="font-medium">{h.title}</p>{h.description && <p className="line-clamp-1 text-xs text-on-surface-variant">{h.description}</p>}</td>
              <td className="p-3">{classIdLabel(h.classId)}</td><td className="p-3">{h.subject}</td><td className="p-3 tabular-nums">{h.due}</td>
              <td className="p-3 tabular-nums">{turnedIn}/{total}</td>
              <td className="p-3"><Badge tone={hwTone(status)}>{status}</Badge></td>
              <td className="p-3"><div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" onClick={() => openGrading(h)}>Grade</Button>
                {status !== "closed" && <Button size="sm" variant="ghost" onClick={() => close(h)}>Close</Button>}
                <Button size="sm" variant="ghost" className="text-error" onClick={() => remove(h)}>Delete</Button>
              </div></td>
            </tr>;
          })}</tbody>
        </table>
      </div>}
    </Card>

    <Modal open={creating} onClose={() => setCreating(false)} title="New homework" width="max-w-2xl"
      footer={<><Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button><Button onClick={create} disabled={busy}>Assign homework</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" required error={errors.classId}>
          <Select value={form.classId} onChange={(e) => set("classId", e.target.value)}>
            <option value="">Pick a class</option>
            {data.classIds.map((id) => <option key={id} value={id}>{classIdLabel(id)}</option>)}
          </Select>
        </Field>
        <Field label="Subject" required error={errors.subject} hint={form.classId && !subjects.length ? "No subject assigned to you in this class" : undefined}>
          {subjects.length ? <Select value={form.subject} onChange={(e) => set("subject", e.target.value)}>
            <option value="">Pick a subject</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select> : <Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Subject" />}
        </Field>
        <Field label="Title" required error={errors.title} className="sm:col-span-2"><Input value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Quadratic Equations — Practice Set 5" /></Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2"><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Assigned on" required error={errors.assigned}><Input type="date" value={form.assigned} onChange={(e) => set("assigned", e.target.value)} /></Field>
        <Field label="Due date" required error={errors.due}><Input type="date" value={form.due} min={form.assigned} onChange={(e) => set("due", e.target.value)} /></Field>
        <Field label="Max marks" required error={errors.maxMarks}><Input type="number" min={1} max={1000} value={form.maxMarks} onChange={(e) => set("maxMarks", e.target.value)} /></Field>
      </div>
    </Modal>

    <Modal open={!!grading} onClose={() => setGrading(null)} title={grading ? `Grade: ${grading.title}` : ""} width="max-w-3xl"
      subtitle={grading ? `${classIdLabel(grading.classId)} · ${grading.subject} · max ${grading.maxMarks ?? "—"} marks` : undefined}
      footer={<><Button variant="outline" onClick={() => setGrading(null)}>Cancel</Button><Button onClick={saveGrading} disabled={busy}>Save submissions</Button></>}>
      {!Object.keys(subs).length ? <EmptyState title="No students in this class" /> : <ul className="divide-y divide-outline-variant/40">
        {Object.entries(subs).sort(([a], [b]) => studentName(a).localeCompare(studentName(b))).map(([id, s]) => <li key={id} className="grid gap-2 py-3 sm:grid-cols-[1fr_8rem_6rem_1fr] sm:items-center" aria-label={`Submission of ${studentName(id)}`}>
          <p className="font-medium">{studentName(id)}</p>
          <Select aria-label={`Status of ${studentName(id)}`} value={s.status} onChange={(e) => setSubs((x) => ({ ...x, [id]: setSubmission(x[id]!, { status: e.target.value as Submission["status"] }, new Date().toISOString()) }))}>
            {SUBMISSION_STATUSES.map((v) => <option key={v} value={v}>{v}</option>)}
          </Select>
          <Input aria-label={`Marks of ${studentName(id)}`} type="number" min={0} max={grading?.maxMarks} value={s.marks ?? ""} placeholder="Marks"
            onChange={(e) => setSubs((x) => ({ ...x, [id]: setSubmission(x[id]!, { marks: e.target.value }, new Date().toISOString()) }))} />
          <Input aria-label={`Feedback for ${studentName(id)}`} value={s.feedback} placeholder="Feedback"
            onChange={(e) => setSubs((x) => ({ ...x, [id]: setSubmission(x[id]!, { feedback: e.target.value }, new Date().toISOString()) }))} />
        </li>)}
      </ul>}
    </Modal>
  </div>;
}
