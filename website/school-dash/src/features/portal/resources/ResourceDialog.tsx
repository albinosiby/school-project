"use client";
// Add / edit a class resource: type (file upload, YouTube video, link), class, subject, title, note and who can see it.
// Files go to Storage first (with progress), then the `cl_resources` doc is written with the download URL.
import { useRef, useState } from "react";
import { FileUp, HardDrive, Link2, Lock, Play, Users, X } from "lucide-react";
import { Button, Field, Input, Modal, ProgressBar, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { classIdLabel } from "../teaching";
import {
  FILE_ACCEPT, editPatch, emptyForm, fileError, formOf, isDriveLink, newResource, newResourceId, sizeLabel, titleFromFile, validateResource, youtubeId,
  type Resource, type ResourceDoc, type ResourceForm, type ResourceKind,
} from "./logic";
import { uploadResourceFile } from "./upload";

type Errors = Partial<Record<keyof ResourceForm | "file", string>>;
const KINDS: { id: ResourceKind; label: string }[] = [{ id: "file", label: "File" }, { id: "youtube", label: "YouTube" }, { id: "link", label: "Link" }];

export function ResourceDialog({ editing, defaultClassId, classIds, subjectsFor, staffId, teacherName, create, update, onClose }: {
  editing: Resource | null; defaultClassId: string; classIds: string[]; subjectsFor: (classId: string) => string[]; staffId: string; teacherName: string;
  create: (body: Omit<ResourceDoc, "id"> & { id?: string }) => Promise<unknown>; update: (id: string, patch: Partial<ResourceDoc>) => Promise<unknown>; onClose: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<ResourceForm>(() => editing ? formOf(editing) : emptyForm(defaultClassId, subjectsFor(defaultClassId)[0] ?? ""));
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const subjects = form.classId ? subjectsFor(form.classId) : [];
  const set = <K extends keyof ResourceForm>(k: K, v: ResourceForm[K]) => {
    setForm((f) => ({ ...f, [k]: v, ...(k === "classId" ? { subject: subjectsFor(String(v))[0] ?? "" } : {}) }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };
  const vid = form.kind === "youtube" ? youtubeId(form.url) : null;
  const classLabel = form.classId ? classIdLabel(form.classId) : "the class";

  function pick(f: File | undefined) {
    if (!f) return;
    const err = fileError(f);
    setErrors((e) => ({ ...e, file: err || undefined }));
    if (err) { setFile(null); return; }
    setFile(f);
    if (!form.title.trim()) setForm((x) => ({ ...x, title: titleFromFile(f.name) }));
  }

  async function save() {
    const e = validateResource(form, { editing: !!editing, file });
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      if (editing) {
        await update(editing.id, editPatch(form, editing.kind));
        toast("Saved");
      } else {
        const now = Date.now();
        let uploaded;
        if (form.kind === "file" && file) {
          setProgress(0);
          uploaded = await uploadResourceFile(file, setProgress);
        }
        const body = newResource(form, { staffId, teacherName, now: new Date(now).toISOString(), nowMs: now, file: uploaded });
        await create({ id: newResourceId(now), ...body });
        toast(form.visibility === "parents" ? "Shared with the class's parents" : "Added — visible only to you");
      }
      onClose();
    } catch {
      toast(editing ? "Could not save the resource" : "Could not add the resource. Check your connection.", "error");
    } finally { setBusy(false); setProgress(null); }
  }

  const saveLabel = busy ? (progress !== null ? `Uploading… ${progress}%` : "Saving…") : editing ? "Save" : "Add resource";

  return <Modal open onClose={busy ? () => {} : onClose} title={editing ? "Edit resource" : "Add a resource"} subtitle={form.classId ? `Class ${classLabel}` : undefined} width="max-w-xl"
    footer={<><Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button><Button onClick={save} disabled={busy}>{saveLabel}</Button></>}>
    <div className="space-y-4">
      {!editing && <Tabs value={form.kind} onChange={(id) => { set("kind", id as ResourceKind); setErrors({}); }} items={KINDS} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" required error={errors.classId} hint={editing ? "The class cannot be changed" : undefined}>
          <Select value={form.classId} disabled={!!editing || busy} onChange={(e) => set("classId", e.target.value)}>
            <option value="">Pick a class</option>
            {classIds.map((id) => <option key={id} value={id}>{classIdLabel(id)}</option>)}
          </Select>
        </Field>
        <Field label="Subject">
          {subjects.length ? <Select value={form.subject} disabled={busy} onChange={(e) => set("subject", e.target.value)}>
            {!subjects.includes(form.subject) && <option value={form.subject}>{form.subject || "No subject"}</option>}
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select> : <Input value={form.subject} disabled={busy} onChange={(e) => set("subject", e.target.value)} placeholder="Subject (optional)" />}
        </Field>
      </div>

      {form.kind === "file" ? (
        editing ? (
          <div className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2.5 text-sm">
            <FileUp size={18} className="shrink-0 text-secondary" /><span className="min-w-0 flex-1 truncate font-medium">{editing.fileName || editing.title}</span>
            <span className="text-xs text-on-surface-variant">{sizeLabel(editing.sizeBytes)}</span>
          </div>
        ) : (
          <div>
            <input ref={input} type="file" accept={FILE_ACCEPT} aria-label="File" className="sr-only" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
            {file ? (
              <div className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2.5 text-sm">
                <FileUp size={18} className="shrink-0 text-secondary" /><span className="min-w-0 flex-1 truncate font-medium">{file.name}</span>
                <span className="text-xs text-on-surface-variant">{sizeLabel(file.size)}</span>
                {!busy && <button type="button" aria-label="Remove file" onClick={() => setFile(null)} className="grid size-7 cursor-pointer place-items-center rounded hover:bg-surface-container"><X size={16} /></button>}
              </div>
            ) : (
              <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}
                className="flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-outline-variant px-4 py-6 text-center transition-colors hover:border-secondary hover:bg-surface-container-low">
                <FileUp size={24} className="text-secondary" />
                <span className="text-sm font-semibold">Choose a file or drop it here</span>
                <span className="text-xs text-on-surface-variant">Images, PDF, Word, PowerPoint, Excel — up to 25 MB</span>
              </button>
            )}
            {errors.file && <p role="alert" className="mt-1 text-xs text-error">{errors.file}</p>}
            {progress !== null && <div className="mt-2 space-y-1"><ProgressBar value={progress} /><p className="text-xs text-on-surface-variant">Uploading… {progress}%</p></div>}
          </div>
        )
      ) : (
        <div className="space-y-2">
          <Field label={form.kind === "youtube" ? "YouTube link" : "Link"} required error={errors.url}>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline">
                {form.kind === "youtube" ? <Play size={16} /> : isDriveLink(form.url) ? <HardDrive size={16} /> : <Link2 size={16} />}
              </span>
              <Input type="url" inputMode="url" className="pl-9" value={form.url} disabled={busy} onChange={(e) => set("url", e.target.value)}
                placeholder={form.kind === "youtube" ? "https://youtu.be/…" : "https://drive.google.com/…"} />
            </div>
          </Field>
          {vid && (
            // eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail preview
            <img src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="Video preview" className="aspect-video w-full rounded-lg bg-surface-container object-cover" />
          )}
          {form.kind === "link" && isDriveLink(form.url) && <p className="text-xs text-warning">Make sure the Drive file is shared as &quot;Anyone with the link can view&quot;.</p>}
        </div>
      )}

      <Field label="Title" required error={errors.title}><Input value={form.title} maxLength={120} disabled={busy} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chapter 4 formula sheet" /></Field>
      <Field label="Note" error={errors.description}><Textarea value={form.description} maxLength={2000} disabled={busy} className="min-h-20" onChange={(e) => set("description", e.target.value)} placeholder="What it is for, pages to read…" /></Field>

      <div>
        <p id="res-vis" className="mb-1.5 text-xs font-semibold text-on-surface-variant">Who can see it</p>
        <div role="radiogroup" aria-labelledby="res-vis" className="grid grid-cols-2 gap-2">
          {([["parents", `Parents of ${classLabel}`, Users], ["private", "Only me", Lock]] as const).map(([v, label, Icon]) => {
            const on = form.visibility === v;
            return <button key={v} type="button" role="radio" aria-checked={on} disabled={busy} onClick={() => set("visibility", v)}
              className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${on ? "border-secondary bg-info-container text-secondary" : "border-outline-variant hover:bg-surface-container-low"}`}>
              <Icon size={16} /><span className="truncate">{label}</span></button>;
          })}
        </div>
        <p className="mt-1.5 text-xs text-on-surface-variant">{form.visibility === "parents" ? "Shown in the parent app (Academics → Resources); parents get a notification." : "Kept in your resources; share it any time."}</p>
      </div>
    </div>
  </Modal>;
}
