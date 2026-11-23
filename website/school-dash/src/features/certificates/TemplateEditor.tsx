"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { Button, Field, Input, LoadingSkeleton, Modal, Textarea, useToast } from "@/components/ui";
import { certificateError, saveCertificateTemplate } from "./service";
import type { CertificateTemplate } from "./types";
import { catalog } from "./catalog";

export function TemplateEditor({ original, onClose }: { original: CertificateTemplate; onClose: () => void }) {
  const toast = useToast(), requestId = useRef(crypto.randomUUID());
  const [form, setForm] = useState(original), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const update = (patch: Partial<CertificateTemplate>) => { setForm((f) => ({ ...f, ...patch })); setError(""); requestId.current = crypto.randomUUID(); };
  async function pick(field: "signatureImage" | "sealImage", file?: File) {
    if (!file) return;
    if (!["image/png", "image/jpeg"].includes(file.type) || !file.size || file.size > 100 * 1024) { setError("Choose a PNG or JPEG image up to 100 KB."); return; }
    const reader = new FileReader(); reader.onload = () => update({ [field]: String(reader.result) }); reader.onerror = () => setError("Could not read the selected image."); reader.readAsDataURL(file);
  }
  async function save() {
    setBusy(true); setError("");
    try { await saveCertificateTemplate(form, requestId.current); toast("Certificate template updated"); onClose(); } catch (e) { setError(certificateError(e)); } finally { setBusy(false); }
  }
  return <Modal open title={`Edit ${original.title} template`} subtitle="Changes apply to future certificates. Issued copies retain their saved template." width="max-w-2xl" onClose={() => { if (!busy) onClose(); }}
    footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={() => void save()}>Save template</Button></>}>
    <fieldset disabled={busy} className="grid gap-4"><Field label="Certificate title" required><Input value={form.title} maxLength={120} onChange={(e) => update({ title: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Default signatory"><Input value={form.signatory} maxLength={160} onChange={(e) => update({ signatory: e.target.value })} /></Field>
        <Field label="Signatory designation" required><Input value={form.designation} maxLength={100} onChange={(e) => update({ designation: e.target.value })} /></Field></div>
      <Field label="Accent colour"><Input type="color" value={form.accent} onChange={(e) => update({ accent: e.target.value })} className="max-w-28" /></Field>
      <Field label="Certificate wording" required hint="Use placeholders in double braces. Plain text only."><Textarea rows={8} maxLength={3000} value={form.body} onChange={(e) => update({ body: e.target.value })} /></Field>
      <div className="flex flex-wrap gap-1.5 text-xs text-on-surface-variant">{[...new Set(["name", "schoolName", "purpose", "issueDate", ...(form.kind === "student" ? ["admissionNumber", "class", "dob", "academicYear"] : ["employeeId", "designation", "department"]), ...(catalog.find((c) => c.id === form.type)?.fields || [])])].map((name) => <code key={name} className="rounded bg-surface-container-low px-2 py-1">{`{{${name}}}`}</code>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">{(["signatureImage", "sealImage"] as const).map((key) => <Field key={key} label={key === "signatureImage" ? "Authorised signature image" : "School seal image"} hint="Optional PNG/JPEG, up to 100 KB.">
        <Input type="file" accept="image/png,image/jpeg" onChange={(event) => { void pick(key, event.target.files?.[0]); event.target.value = ""; }} />
        {form[key] && <div className="mt-2 flex items-center gap-3"><Image unoptimized width={160} height={56} src={form[key]} alt={key === "signatureImage" ? "Signature preview" : "School seal preview"} className="h-14 max-w-40 rounded border border-outline-variant object-contain bg-white p-1" /><Button variant="ghost" size="sm" onClick={() => update({ [key]: "" })}>Remove</Button></div>}
      </Field>)}</div>
    </fieldset>
    {busy && <LoadingSkeleton variant="form" label="Saving template…" className="mt-4" />}{error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
  </Modal>;
}
