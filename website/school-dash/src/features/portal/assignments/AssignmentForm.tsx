"use client";
// /me/assignments/new and /me/assignments/{id}/edit (new_homework_screen.dart): a new assignment for a class, or an
// edit of one, in four steps: class & subject, the work (title, description, files), publish now or later with the
// due day and the reminder timeline, and grading. Written the way the teacher app's HomeworkAdapter writes it.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, BellOff, BellRing, CalendarDays, FileText, Flag, Image as ImageIcon, Megaphone, Send, Timer, Upload, X } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, LoadingSkeleton, Switch, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { classIdLabel, classRoster } from "../teaching";
import { useAssignments } from "./useAssignments";
import { uploadMaterial } from "./upload";
import {
  ACCEPT, DUE_QUICK, MARKS_QUICK, addDays, daysLeft, dayLabel, dueSummary, emptyForm, formFields, formOf, isImageRef, isoOf, newAssignment, newHomeworkId,
  sizeLabel, splitBySize, time12, timeline, validateAssignment, type AssignmentForm as Form, type FileRef, type FormErrors, type Homework,
} from "./logic";

export function AssignmentForm({ editId, classId }: { editId?: string; classId?: string }) {
  const { data, hw, rows, ready } = useAssignments();
  if (!data.teaching) return <EmptyState title="Only teachers have assignments" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!ready) return <LoadingSkeleton variant="form" label="Loading…" />;
  const editing = editId ? rows.find((h) => h.id === editId) : undefined;
  if (editId && !editing) return <Card><EmptyState title="Assignment not found" hint="It may have been deleted." action={<Link href="/me/assignments" className="text-sm font-semibold text-secondary">Back to assignments</Link>} /></Card>;
  if (!editing && !data.classIds.length) return <Card><EmptyState title="No classes assigned" hint="You have no classes to set assignments for." /></Card>;
  const initialClass = editing?.classId ?? (classId && data.classIds.includes(classId) ? classId : data.classIds[0]!);
  return <FormBody key={editing?.id ?? "new"} editing={editing} initialClass={initialClass} data={data} hw={hw} />;
}

type Data = ReturnType<typeof useAssignments>["data"];
type Store = ReturnType<typeof useAssignments>["hw"];

function FormBody({ editing, initialClass, data, hw }: { editing?: Homework; initialClass: string; data: Data; hw: Store }) {
  const toast = useToast();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState<Form>(() => (editing ? formOf(editing, new Date()) : emptyForm(new Date(), initialClass)));
  const [picked, setPicked] = useState<File[]>([]);
  const [errors, setErrors] = useState<FormErrors>({});
  const [busy, setBusy] = useState(false);

  const now = new Date();
  const today = isoOf(now);
  const subjects = data.subjectsFor(form.classId);
  const subject = form.subject || subjects[0] || "";
  const roster = classRoster(data.students, form.classId);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === "classId" ? { subject: "" } : {}) }));
    setErrors((e) => ({ ...e, [k]: undefined, ...(k === "schedule" || k === "due" ? { publishAt: undefined } : {}) }));
  };
  const dueLeft = daysLeft(form.due, today);
  const steps = timeline(form, today);
  const publishAt = new Date(form.publishAt);

  function addFiles(list: FileList | null) {
    const { ok, skipped } = splitBySize([...(list ?? [])]);
    setPicked((p) => [...p, ...ok]);
    if (skipped) toast(`${skipped} file(s) over 15 MB were skipped`, "error");
    if (fileInput.current) fileInput.current.value = "";
  }

  async function save() {
    const f = { ...form, subject };
    const e = validateAssignment(f, { subjects, now: new Date(), editing: !!editing });
    setErrors(e);
    const first = Object.values(e).find(Boolean);
    if (first) { toast(first, "error"); return; }
    setBusy(true);
    try {
      const added: FileRef[] = [];
      for (const file of picked) added.push(await uploadMaterial(file, data.user?.id));
      const withFiles = { ...f, attachments: [...f.attachments, ...added] };
      if (editing) {
        await hw.update(editing.id, formFields(withFiles, editing));
        toast("Assignment updated");
        router.push(`/me/assignments/${editing.id}`);
      } else {
        const cls = data.classOf(f.classId);
        const body = newAssignment(withFiles, { staffId: data.staffId, teacherName: data.name, rosterIds: roster.map((s) => s.id), grade: cls?.grade, section: cls?.section, now: new Date() });
        const id = newHomeworkId();
        await hw.create({ id, ...body });
        toast(body.status === "scheduled" ? "Assignment scheduled — parents are notified when it is published" : `Assignment posted to ${roster.length} students — parents are notified`);
        router.push(`/me/assignments/${id}`);
      }
    } catch (err) {
      toast(err instanceof Error && /^Sign in/.test(err.message) ? err.message : "Could not save the assignment. Check your connection.", "error");
      setBusy(false);
    }
  }

  const backHref = editing ? `/me/assignments/${editing.id}` : "/me/assignments";
  const title = editing ? "Edit assignment" : "New assignment";
  return <div className="mx-auto max-w-3xl space-y-4 pb-4">
    <div className="flex items-start gap-3">
      <Link href={backHref} aria-label="Back" className="mt-1 rounded p-1.5 text-on-surface-variant hover:bg-surface-container"><ArrowLeft size={20} /></Link>
      <div className="min-w-0"><h1 className="t-headline-lg">{title}</h1><p className="text-on-surface-variant">Class {classIdLabel(form.classId)}{subject ? ` • ${subject}` : ""}</p></div>
    </div>

    <Step n={1} title={editing ? "Subject" : "Class & subject"}>
      {!editing && data.classIds.length > 1 && <div role="group" aria-label="Class" className="mb-3 flex gap-2 overflow-x-auto pb-1">
        {data.classIds.map((id) => {
          const on = id === form.classId;
          return <button key={id} type="button" aria-pressed={on} aria-label={`Class ${classIdLabel(id)}`} onClick={() => set("classId", id)}
            className={cn("w-28 shrink-0 cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors", on ? "border-secondary bg-secondary text-on-secondary" : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low")}>
            <span className={cn("block text-[11px]", on ? "opacity-80" : "text-on-surface-variant")}>Class</span>
            <span className="block truncate text-lg leading-tight font-semibold">{classIdLabel(id)}</span>
            <span className={cn("block text-[11px]", on ? "opacity-80" : "text-on-surface-variant")}>{classRoster(data.students, id).length} students</span>
          </button>;
        })}
      </div>}
      {errors.classId && <p className="mb-2 text-xs text-error">{errors.classId}</p>}
      {subjects.length > 1 ? <div role="group" aria-label="Subject" className="flex flex-wrap gap-2">
        {subjects.map((s) => <Chip key={s} on={s === subject} onClick={() => set("subject", s)}>{s}</Chip>)}
      </div> : subjects.length === 1 ? <p className="flex items-center gap-2 font-semibold"><FileText size={18} className="text-secondary" /><span className="flex-1">{subject} • Class {classIdLabel(form.classId)}</span><span className="text-xs font-normal text-on-surface-variant">{roster.length} students</span></p>
        : <Field label="Subject" required error={errors.subject} hint="No subject assigned to you in this class"><Input value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Subject" /></Field>}
      {subjects.length > 0 && errors.subject && <p className="mt-2 text-xs text-error">{errors.subject}</p>}
    </Step>

    <Step n={2} title="The work">
      <div className="space-y-4">
        <Field label="Title" required error={errors.title}><Input value={form.title} maxLength={100} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Fractions — exercise 4.2" className="text-base font-semibold" /></Field>
        <Field label="Description" error={errors.description}><Textarea value={form.description} rows={4} onChange={(e) => set("description", e.target.value)} placeholder="What to do, pages, questions, how to hand in…" /></Field>
        <div>
          <div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs font-semibold text-on-surface-variant">Documents</span>
            <span className="text-xs text-on-surface-variant">{form.attachments.length + picked.length ? `${form.attachments.length + picked.length} attached` : "Optional • 15 MB each"}</span></div>
          <button type="button" onClick={() => fileInput.current?.click()} disabled={busy}
            className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-lg border border-dashed border-outline-variant bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant hover:border-secondary hover:text-secondary disabled:opacity-50">
            <Upload size={22} className="text-secondary" /><span className="font-semibold">Add photos, PDFs or documents</span><span className="text-xs">Images, PDF, Word, Excel, PowerPoint • up to 15 MB each</span>
          </button>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} aria-label="Attach files" className="hidden" onChange={(e) => addFiles(e.target.files)} />
          {(form.attachments.length > 0 || picked.length > 0) && <ul className="mt-2 space-y-1.5">
            {form.attachments.map((f, i) => <AttachRow key={`k${i}`} name={f.name} size={f.size || sizeLabel(f.bytes)} image={isImageRef(f)} disabled={busy}
              onRemove={() => set("attachments", form.attachments.filter((_, j) => j !== i))} />)}
            {picked.map((f, i) => <AttachRow key={`p${i}`} name={f.name} size={sizeLabel(f.size)} image={f.type.startsWith("image/")} isNew disabled={busy}
              onRemove={() => setPicked((p) => p.filter((_, j) => j !== i))} />)}
          </ul>}
        </div>
      </div>
    </Step>

    <Step n={3} title="Publish & due date">
      <div role="group" aria-label="When to publish" className="grid grid-cols-2 gap-1 rounded-lg bg-surface-container p-1">
        {([[false, "Publish now"], [true, "Schedule"]] as const).map(([v, label]) =>
          <button key={label} type="button" aria-pressed={form.schedule === v} onClick={() => set("schedule", v)}
            className={cn("cursor-pointer rounded-md py-2 text-sm font-semibold transition-colors", form.schedule === v ? "bg-surface-container-lowest text-secondary shadow-card" : "text-on-surface-variant hover:text-on-surface")}>{label}</button>)}
      </div>
      {form.schedule && <Field label="Publish at" error={errors.publishAt} hint="Parents see it and get the notification then" className="mt-3">
        <Input type="datetime-local" value={form.publishAt} min={`${today}T00:00`} onChange={(e) => set("publishAt", e.target.value)} />
      </Field>}
      <p className="mt-4 mb-2 text-xs font-semibold text-on-surface-variant">Due</p>
      <div className="flex flex-wrap items-center gap-2">
        {DUE_QUICK.map(([n, label]) => <Chip key={n} on={dueLeft === n} onClick={() => set("due", addDays(today, n))}>{label}</Chip>)}
        <label className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-semibold", DUE_QUICK.some(([n]) => n === dueLeft) ? "border-outline-variant" : "border-secondary bg-info-container text-secondary")}>
          <CalendarDays size={15} />
          <span className="sr-only">Due date</span>
          <input type="date" aria-label="Due date" value={form.due} min={editing ? undefined : today} onChange={(e) => set("due", e.target.value)} className="bg-transparent text-sm outline-none" />
        </label>
      </div>
      {errors.due && <p className="mt-1 text-xs text-error">{errors.due}</p>}
      <ol aria-label="Timeline" className="mt-4 rounded-lg bg-surface-container-low p-3">
        {steps.map((s, i) => {
          const [Icon, tone] = s.kind === "publish" ? [Megaphone, "bg-info-container text-secondary"] : s.kind === "reminder" ? [BellRing, "bg-warning-container text-warning"]
            : s.kind === "none" ? [BellOff, "bg-surface-container-high text-on-surface-variant"] : [Flag, "bg-error-container text-on-error-container"];
          return <li key={s.kind} className="flex gap-3">
            <div className="flex flex-col items-center"><span className={cn("grid size-7 place-items-center rounded-full", tone)}><Icon size={14} /></span>{i < steps.length - 1 && <span className="my-0.5 w-0.5 flex-1 bg-outline-variant" />}</div>
            <div className="pt-0.5 pb-3"><p className="text-sm font-semibold text-on-surface">{s.title}</p><p className="text-xs text-on-surface-variant">{s.detail}</p></div>
          </li>;
        })}
      </ol>
    </Step>

    <Step n={4} title="Grading">
      <SwitchRow icon={<FileText size={18} />} title="Give marks" checked={form.graded} onChange={(v) => set("graded", v)}
        subtitle={form.graded ? "Grade each student out of the marks below" : "Not graded — mark each one as done"} />
      {form.graded && <div className="mt-3 flex flex-wrap items-end gap-2">
        <div role="group" aria-label="Out of" className="flex flex-1 flex-wrap gap-1.5">
          {MARKS_QUICK.map((m) => <Chip key={m} on={form.maxMarks.trim() === String(m)} onClick={() => set("maxMarks", String(m))}>{m}</Chip>)}
        </div>
        <Field label="Out of" className="w-24"><Input inputMode="numeric" maxLength={4} value={form.maxMarks} className="text-center" onChange={(e) => set("maxMarks", e.target.value.replace(/\D/g, ""))} /></Field>
      </div>}
      {form.graded && errors.maxMarks && <p className="mt-1 text-xs text-error">{errors.maxMarks}</p>}
      <hr className="my-3 border-outline-variant/60" />
      <SwitchRow icon={<Timer size={18} />} title="Accept late hand-ins" checked={form.allowLate} onChange={(v) => set("allowLate", v)}
        subtitle={form.allowLate ? "Late uploads are marked late and you are notified of each" : "Hand-ins close after the due day"} />
    </Step>

    <div className="sticky bottom-0 z-10 -mx-1 flex items-center gap-3 rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-pop">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{roster.length} students • {dueSummary(form.due, today)}</p>
        <p className="truncate text-xs text-on-surface-variant">{form.schedule ? `Publishes ${dayLabel(isoOf(publishAt))}, ${Number.isNaN(publishAt.getTime()) ? "" : time12(publishAt)}` : editing ? "Changes show straight away" : "Parents are notified now"}</p>
      </div>
      <Button onClick={save} disabled={busy}>{form.schedule ? <Timer size={16} /> : <Send size={16} />}{busy ? "Saving…" : editing ? "Save" : form.schedule ? "Schedule" : "Publish"}</Button>
    </div>
  </div>;
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return <Card className="p-4 sm:p-5" role="group" aria-label={title}>
    <div className="mb-3 flex items-center gap-2.5"><span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-bold text-on-secondary">{n}</span><h2 className="text-base font-semibold">{title}</h2></div>
    {children}
  </Card>;
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={on} onClick={onClick}
    className={cn("h-9 cursor-pointer rounded-full border px-3.5 text-sm font-semibold transition-colors", on ? "border-secondary bg-info-container text-secondary" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")}>{children}</button>;
}

function SwitchRow({ icon, title, subtitle, checked, onChange }: { icon: React.ReactNode; title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="flex items-center gap-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-container text-secondary">{icon}</span>
    <div className="min-w-0 flex-1"><p className="font-semibold">{title}</p><p className="text-xs text-on-surface-variant">{subtitle}</p></div>
    <Switch checked={checked} onChange={onChange} label={title} />
  </div>;
}

function AttachRow({ name, size, image, isNew, disabled, onRemove }: { name: string; size: string; image: boolean; isNew?: boolean; disabled?: boolean; onRemove: () => void }) {
  return <li className="flex items-center gap-2 rounded-lg bg-surface-container-low py-1 pr-1 pl-3">
    {image ? <ImageIcon size={18} className="shrink-0 text-secondary" /> : <FileText size={18} className="shrink-0 text-secondary" />}
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
    {isNew && <Badge tone="brand">New</Badge>}
    {size && <span className="text-xs text-on-surface-variant">{size}</span>}
    <button type="button" aria-label={`Remove ${name}`} disabled={disabled} onClick={onRemove} className="cursor-pointer rounded p-1.5 text-on-surface-variant hover:bg-surface-container disabled:opacity-50"><X size={16} /></button>
  </li>;
}
