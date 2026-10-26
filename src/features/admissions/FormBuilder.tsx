"use client";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Copy, GripVertical, History, Lock, Plus, RotateCcw, ShieldCheck, Trash2, Pencil } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, Field, Input, Modal, Select, Switch, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { DynamicForm, FieldInput } from "./DynamicForm";
import { useAdm } from "./lib";
import type { FieldType, FormDoc, FormField, FormSection } from "./types";
import { useMyName } from "@/lib/useMe";

const TYPES: { v: FieldType; l: string }[] = [{ v: "text", l: "Text" }, { v: "textarea", l: "Long text" }, { v: "select", l: "Dropdown" }, { v: "radio", l: "Radio / select" }, { v: "date", l: "Date picker" }, { v: "tel", l: "Phone & OTP" }, { v: "email", l: "Email" }, { v: "number", l: "Number" }];
const move = <T,>(a: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= a.length) return a; const r = [...a]; [r[i], r[j]] = [r[j]!, r[i]!]; return r; };
const uid = () => Math.random().toString(36).slice(2, 8);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";

export function FormBuilder() {
  const form = useCollection<FormDoc>("adm_form");
  const { enq, config, cfg } = useAdm();
  const toast = useToast();
  const me = useMyName();
  const doc = form.rows[0];
  const [edit, setEdit] = useState<{ sec: string; field: FormField | null } | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState("");
  const [showLog, setShowLog] = useState(false);
  const [dragSec, setDragSec] = useState<string | null>(null);
  const [capDraft, setCapDraft] = useState<string | null>(null);

  const dirty = useMemo(() => !!doc && JSON.stringify(doc.sections) !== JSON.stringify(doc.published), [doc]);
  if (!doc) return <p className="text-on-surface-variant">Loading form…</p>;
  const fail = () => toast("Could not save form changes — check your connection", "error");
  const setSections = (fn: (s: FormSection[]) => FormSection[]) => form.update("form", { sections: fn(structuredClone(doc.sections)) }).catch(fail);
  const patchSec = (id: string, p: Partial<FormSection>) => setSections((s) => s.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const patchField = (sid: string, fid: string, p: Partial<FormField>) => setSections((s) => s.map((x) => (x.id === sid ? { ...x, fields: x.fields.map((f) => (f.id === fid ? { ...f, ...p } : f)) } : x)));
  const webSubs = enq.rows.filter((e) => e.source === "Website Form").length;

  async function publish() {
    const version = doc!.version + 1;
    try { await form.update("form", { version, status: "published", published: doc!.sections, publishedAt: new Date().toISOString(), publishedBy: me.name, history: [{ version, at: new Date().toISOString(), by: me.name, note: note || "Schema updated" }, ...doc!.history] }); } catch { return fail(); }
    toast(`Form v${version} published — public form updated`); setPublishing(false); setNote("");
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="t-headline-md">{doc.name}</h2><p className="text-on-surface-variant">{dirty ? "Unpublished changes — the public form still uses v" + doc.version : `Live as v${doc.version}`}</p></div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!dirty} onClick={() => form.update("form", { sections: doc.published }).then(() => toast("Draft discarded")).catch(fail)}><RotateCcw size={14} />Discard draft</Button>
            <Button disabled={!dirty} onClick={() => setPublishing(true)}>Publish v{doc.version + 1}</Button>
          </div>
        </div>

        {doc.sections.map((sec, si) => (
          <Card key={sec.id} className={cn(dragSec === sec.id && "opacity-50")}
            onDragOver={(e) => e.preventDefault()} onDrop={() => { if (dragSec && dragSec !== sec.id) setSections((s) => { const a = s.findIndex((x) => x.id === dragSec), b = s.findIndex((x) => x.id === sec.id); const r = [...s]; const [m] = r.splice(a, 1); r.splice(b, 0, m!); return r; }); setDragSec(null); }}>
            <div className="flex flex-wrap items-start gap-3 p-5">
              <span draggable onDragStart={() => setDragSec(sec.id)} onDragEnd={() => setDragSec(null)} aria-label="Drag to reorder section" className="mt-1 cursor-grab text-outline"><GripVertical size={18} /></span>
              <span className="grid size-8 place-items-center rounded bg-info-container text-sm font-semibold text-secondary">{String(si + 1).padStart(2, "0")}</span>
              <div className="min-w-0 flex-1 space-y-1">
                <input key={sec.title} defaultValue={sec.title} aria-label="Section title" onBlur={(e) => e.target.value.trim() && e.target.value !== sec.title && patchSec(sec.id, { title: e.target.value.trim() })} className="w-full rounded bg-transparent px-1 text-lg font-semibold focus:bg-surface-container-low" />
                <input key={sec.description} defaultValue={sec.description} aria-label="Section description" onBlur={(e) => e.target.value !== sec.description && patchSec(sec.id, { description: e.target.value })} className="w-full rounded bg-transparent px-1 text-on-surface-variant focus:bg-surface-container-low" />
              </div>
              <label className="flex items-center gap-2 text-sm"><Checkbox checked={sec.mandatory} onChange={(e) => patchSec(sec.id, { mandatory: e.target.checked })} />Mandatory</label>
              <div className="flex items-center gap-1 text-on-surface-variant">
                <button aria-label="Move section up" disabled={si === 0} onClick={() => setSections((s) => move(s, si, -1))} className="cursor-pointer rounded p-1.5 hover:bg-surface-container disabled:opacity-30"><ArrowUp size={16} /></button>
                <button aria-label="Move section down" disabled={si === doc.sections.length - 1} onClick={() => setSections((s) => move(s, si, 1))} className="cursor-pointer rounded p-1.5 hover:bg-surface-container disabled:opacity-30"><ArrowDown size={16} /></button>
                <button aria-label="Duplicate section" onClick={() => { setSections((s) => { const c = structuredClone(sec); c.id = "sec_" + uid(); c.title += " (copy)"; c.fields = c.fields.map((f) => ({ ...f, id: "f_" + uid(), key: f.key + "_" + uid().slice(0, 3), core: false })); const r = [...s]; r.splice(si + 1, 0, c); return r; }); toast("Section duplicated"); }} className="cursor-pointer rounded p-1.5 hover:bg-surface-container"><Copy size={16} /></button>
                <button aria-label="Delete section" disabled={sec.fields.some((f) => f.core)} title={sec.fields.some((f) => f.core) ? "Contains core fields" : "Delete section"} onClick={() => { setSections((s) => s.filter((x) => x.id !== sec.id)); toast("Section removed"); }} className="cursor-pointer rounded p-1.5 hover:bg-error-container hover:text-error disabled:opacity-30"><Trash2 size={16} /></button>
              </div>
            </div>
            <div className="grid gap-3 border-t border-outline-variant/60 p-5 md:grid-cols-2">
              {sec.fields.map((f, fi) => (
                <div key={f.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="t-caption text-on-surface-variant uppercase">Field · {TYPES.find((t) => t.v === f.type)?.l}{f.core && <Lock size={10} className="ml-1 inline" aria-label="Core field" />}</span>
                    <label className="flex items-center gap-2 text-xs">{f.required ? "Required" : "Optional"}<Switch label={`${f.label} required`} checked={f.required} onChange={(v) => { if (f.core) return toast("Core fields are always required", "error"); patchField(sec.id, f.id, { required: v }); }} /></label>
                  </div>
                  <div className="mt-1 font-semibold">{f.label}</div>
                  {f.rule && <Badge tone="info" className="mt-1">{f.rule}</Badge>}
                  <div className="pointer-events-none mt-2"><FieldInput f={f} value="" onChange={() => {}} disabled /></div>
                  <div className="mt-2 flex justify-end gap-1 text-on-surface-variant">
                    <button aria-label={`Move ${f.label} up`} disabled={fi === 0} onClick={() => patchSec(sec.id, { fields: move(sec.fields, fi, -1) })} className="cursor-pointer rounded p-1 hover:bg-surface-container disabled:opacity-30"><ArrowUp size={14} /></button>
                    <button aria-label={`Move ${f.label} down`} disabled={fi === sec.fields.length - 1} onClick={() => patchSec(sec.id, { fields: move(sec.fields, fi, 1) })} className="cursor-pointer rounded p-1 hover:bg-surface-container disabled:opacity-30"><ArrowDown size={14} /></button>
                    <button aria-label={`Edit ${f.label}`} onClick={() => setEdit({ sec: sec.id, field: f })} className="cursor-pointer rounded p-1 hover:bg-surface-container"><Pencil size={14} /></button>
                    <button aria-label={`Remove ${f.label}`} disabled={f.core} onClick={() => { patchSec(sec.id, { fields: sec.fields.filter((x) => x.id !== f.id) }); toast("Field removed"); }} className="cursor-pointer rounded p-1 hover:bg-error-container hover:text-error disabled:opacity-30"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <button onClick={() => setEdit({ sec: sec.id, field: null })} className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-secondary/50 text-sm font-semibold text-secondary hover:bg-info-container md:col-span-2"><Plus size={16} />Add Field to {sec.title}</button>
            </div>
          </Card>
        ))}
        <Button variant="outline" onClick={() => { setSections((s) => [...s, { id: "sec_" + uid(), title: "New Section", description: "Describe this section", mandatory: false, fields: [] }]); toast("Section added"); }}><Plus size={16} />Add section</Button>
      </div>

      <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <Card>
          <CardHeader title="Release History" actions={<Badge tone="success">Live v{doc.version}</Badge>} />
          <div className="space-y-3 p-5 pt-2 text-sm">
            <div className="rounded-lg bg-surface-container-low p-4">
              <div className="flex items-center gap-2 font-semibold"><ShieldCheck size={16} className="text-secondary" />Production Status</div>
              <p className="mt-1 text-on-surface-variant">Last published by <b className="text-on-surface">{doc.publishedBy}</b> on {doc.publishedAt && !isNaN(+new Date(doc.publishedAt)) ? new Date(doc.publishedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}.</p>
              <div className="mt-2 flex justify-between border-t border-outline-variant/60 pt-2"><span>Total Submissions</span><b className="text-lg">{webSubs}</b></div>
            </div>
            <button onClick={() => setShowLog((x) => !x)} className="flex cursor-pointer items-center gap-2 font-semibold text-secondary"><History size={14} />{showLog ? "Hide" : "View"} Changelog</button>
            {showLog && <ul className="space-y-2">{doc.history.map((h) => <li key={h.version} className="rounded bg-surface-container-low px-3 py-2"><b>v{h.version}</b> — {h.note}<div className="text-xs text-on-surface-variant">{new Date(h.at).toLocaleDateString("en-IN")} · {h.by}</div></li>)}</ul>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Form Safeguards & Quotas" />
          <div className="space-y-3 p-5 pt-2 text-sm">
            {([["dedupe", "Aadhaar & DOB Deduplication", "Prevents duplicate sibling or multiple attempts"], ["otp", "SMS / WhatsApp OTP 2FA", "Guarantees genuine parent identity"]] as const).map(([k, t, d]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-lg bg-surface-container-low p-3"><div><div className="font-semibold">{t}</div><div className="text-xs text-on-surface-variant">{d}</div></div>
                <Switch label={t} checked={!!config?.safeguards[k]} onChange={(v) => config && cfg.update("config", { safeguards: { ...config.safeguards, [k]: v } }).catch(fail)} /></div>))}
            <div className="rounded-lg bg-surface-container-low p-3"><div className="flex justify-between font-semibold"><span>Max Submissions Cap</span><span>{webSubs} / {config?.submissionCap ?? "—"} filed</span></div>
              {/* local draft so the field can be cleared while typing; saved on blur when valid */}
              <Field label="Cap" className="mt-2" error={capDraft !== null && !(Number.isInteger(Number(capDraft)) && Number(capDraft) > 0) ? "Enter a whole number above 0" : undefined}>
                <Input type="number" min={1} value={capDraft ?? config?.submissionCap ?? ""} onChange={(e) => setCapDraft(e.target.value)}
                  onBlur={() => { const n = Number(capDraft); if (capDraft === null || !config || !Number.isInteger(n) || n <= 0) return; setCapDraft(null); if (n !== config.submissionCap) cfg.update("config", { submissionCap: n }).then(() => toast("Submission cap updated")).catch(fail); }} /></Field></div>
          </div>
        </Card>
        <Card>
          <CardHeader title="Live Preview" subtitle="Draft schema as parents will see it" />
          <div className="max-h-[560px] overflow-y-auto p-5 pt-2"><DynamicForm sections={doc.sections} preview /></div>
        </Card>
      </aside>

      <FieldEditor key={edit ? `${edit.sec}-${edit.field?.id ?? "new"}` : "none"} state={edit} onClose={() => setEdit(null)} onSave={(sid, f, isNew) => {
        setSections((s) => s.map((x) => (x.id === sid ? { ...x, fields: isNew ? [...x.fields, f] : x.fields.map((y) => (y.id === f.id ? f : y)) } : x)));
        toast(isNew ? "Field added" : "Field updated"); setEdit(null);
      }} keys={doc.sections.flatMap((s) => s.fields.map((f) => f.key))} />

      <Modal open={publishing} onClose={() => setPublishing(false)} title={`Publish v${doc.version + 1}`} subtitle="The public form and QR link will use this schema immediately."
        footer={<><Button variant="outline" onClick={() => setPublishing(false)}>Cancel</Button><Button onClick={publish}>Publish now</Button></>}>
        <Field label="Release note"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed?" /></Field>
      </Modal>
    </div>
  );
}

function FieldEditor({ state, onClose, onSave, keys }: { state: { sec: string; field: FormField | null } | null; onClose: () => void; onSave: (sec: string, f: FormField, isNew: boolean) => void; keys: string[] }) {
  const base: FormField = state?.field ?? { id: "f_" + uid(), key: "", label: "", type: "text", required: false, placeholder: "", options: [] };
  const [f, setF] = useState<FormField>(base);
  const [opts, setOpts] = useState((base.options ?? []).join("\n"));
  const [err, setErr] = useState("");
  const needsOpts = f.type === "select" || f.type === "radio";
  if (!state) return null;
  const save = () => {
    if (!f.label.trim()) return setErr("Label is required");
    const options = opts.split("\n").map((x) => x.trim()).filter(Boolean);
    if (needsOpts && options.length < 2) return setErr("Add at least two options (one per line)");
    let key = f.key || slug(f.label);
    if (!state.field) while (keys.includes(key)) key += "_" + uid().slice(0, 2);
    onSave(state.sec, { ...f, key, label: f.label.trim(), options: needsOpts ? options : undefined }, !state.field);
  };
  return (
    <Modal open onClose={onClose} title={state.field ? "Edit field" : "Add field"} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save field</Button></>}>
      <div className="space-y-4">
        <Field label="Label" required error={err && !f.label.trim() ? err : undefined}><Input value={f.label} onChange={(e) => setF({ ...f, label: e.target.value })} /></Field>
        <Field label="Field type"><Select value={f.type} disabled={f.core} onChange={(e) => setF({ ...f, type: e.target.value as FieldType })}>{TYPES.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}</Select></Field>
        {!needsOpts && <Field label="Placeholder"><Input value={f.placeholder ?? ""} onChange={(e) => setF({ ...f, placeholder: e.target.value })} /></Field>}
        {needsOpts && <Field label="Options (one per line)" error={err && f.label.trim() ? err : undefined}><Textarea value={opts} onChange={(e) => setOpts(e.target.value)} /></Field>}
        <Field label="Validation rule note (shown to parents)"><Input value={f.rule ?? ""} onChange={(e) => setF({ ...f, rule: e.target.value })} /></Field>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.required} disabled={f.core} onChange={(e) => setF({ ...f, required: e.target.checked })} />Required</label>
      </div>
    </Modal>
  );
}
