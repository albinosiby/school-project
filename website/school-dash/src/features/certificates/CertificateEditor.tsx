"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, FileCheck2 } from "lucide-react";
import { Button, Field, Input, LoadingSkeleton, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { localDate } from "@/features/people/checkins";
import { catalog, defaultTemplate, fieldLabels, recipientKind } from "./catalog";
import { RecipientPicker } from "./RecipientPicker";
import { certificateAction, certificateError, pdfBlob, previewCertificate } from "./service";
import type { Certificate, CertificateForm, CertificateTemplate, Recipient, RecipientKind } from "./types";

export function CertificateEditor({ kind, target, replaces, templates, onKind, onClose }: { kind: RecipientKind; target?: Certificate; replaces?: Certificate; templates: CertificateTemplate[]; onKind: (kind: RecipientKind) => void; onClose: () => void }) {
  const toast = useToast(), people = useCollection<Recipient>(kind === "staff" ? "staff" : "students");
  const source = target || replaces, initialType = source?.type || (kind === "staff" ? "employment" : "bonafide");
  const templateFor = (type: string) => templates.find((t) => t.type === type) || defaultTemplate(type);
  const [form, setForm] = useState<CertificateForm>(() => ({ kind, type: initialType, recipientId: source?.staffId || source?.studentId || "", templateVersion: templateFor(initialType).version,
    issuedOn: target?.issuedOn || localDate(new Date()), validTill: target?.validTill || "", issuer: source?.issuer || templateFor(initialType).signatory,
    purpose: source?.purpose || "", note: target?.note || "", fields: { ...source?.fields } }));
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [url, setUrl] = useState("");
  const [pending, setPending] = useState<Record<string, unknown> | null>(null), saveId = useRef(crypto.randomUUID());
  const selected = people.rows.find((row) => row.id === form.recipientId), type = catalog.find((c) => c.id === form.type);
  const frozen = !!busy || !!pending;
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const update = (patch: Partial<CertificateForm>) => { setForm((previous) => ({ ...previous, ...patch })); setError(""); setUrl(""); saveId.current = crypto.randomUUID(); };
  const defaults = (id: string, typeId = form.type) => {
    const person = people.rows.find((row) => row.id === id), item = catalog.find((c) => c.id === typeId)!;
    return Object.fromEntries(item.fields.map((key) => [key, key === "startDate" ? person?.admissionDate || person?.joined || "" : key === "endDate" ? localDate(new Date()) : key === "dob" ? person?.dob || "" : ""]));
  };
  const selection = (id: string) => update({ recipientId: id, fields: defaults(id) });
  const changeType = (typeId: string) => { const template = templateFor(typeId); update({ type: typeId, fields: defaults(form.recipientId, typeId), templateVersion: template.version, issuer: template.signatory }); };
  const context = { ...(target ? { certificateId: target.id, expectedRevision: target.revision || 0 } : {}), ...(replaces ? { replacesId: replaces.id } : {}) };
  function validate() {
    if (!type) return "This legacy certificate type is not supported for issuing. Review the request or create a new certificate with a supported type.";
    if (!form.recipientId || !selected) return `Choose a ${kind === "staff" ? "staff member" : "student"}.`;
    if (!form.issuedOn || !form.issuer.trim()) return "Enter the issue date and authorised signatory.";
    for (const key of type.fields) if (!(key === "dob" ? selected.dob : form.fields[key])?.trim()) return `Enter ${fieldLabels[key].toLowerCase()}${key === "dob" ? " in the student's profile first" : ""}.`;
    return "";
  }
  async function preview() {
    const invalid = validate(); if (invalid) { setError(invalid); return; }
    setBusy("preview"); setError("");
    try { setUrl(URL.createObjectURL(pdfBlob(await previewCertificate(form, context)))); } catch (e) { setError(certificateError(e)); } finally { setBusy(""); }
  }
  async function save(action: "saveDraft" | "issue") {
    const invalid = validate(); if (invalid && !pending) { setError(invalid); return; }
    setBusy(action); setError("");
    const payload = pending || { ...context, form, requestId: saveId.current };
    if (action === "issue") setPending(payload);
    try {
      await certificateAction(action, payload); toast(action === "issue" ? "Certificate issued" : "Certificate draft saved"); setPending(null); onClose();
    } catch (e) {
      setError(certificateError(e));
      if ((e as { code?: string }).code === "functions/invalid-argument") { setPending(null); saveId.current = crypto.randomUUID(); }
    } finally { setBusy(""); }
  }
  return <Modal open onClose={() => { if (!busy) onClose(); }} title={target ? `Prepare ${target.title}` : replaces ? `Replace ${replaces.refNo || replaces.title}` : "Issue certificate"}
    subtitle="Review the recipient's record and certificate details before issuing." width={url ? "max-w-6xl" : "max-w-2xl"}
    footer={<div className="w-full">
      {error && <p role="alert" className="mb-3 rounded-lg border border-error/30 bg-error/5 p-3 text-sm text-error">{error}</p>}
      {pending && !busy && <p className="mb-3 text-sm text-on-surface-variant">Issuance has not been confirmed. Retry keeps the same request and certificate number. You can also check Drafts for an unfinished issue.</p>}
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={!!busy} onClick={onClose}>Cancel</Button>
      {!pending && <Button variant="outline" disabled={!!busy || !people.ready || !!people.error} onClick={() => void save("saveDraft")}>Save draft</Button>}
      {!pending && <Button variant="outline" disabled={!!busy || !people.ready || !!people.error} onClick={() => void preview()}><Eye size={15} />Preview</Button>}
      <Button disabled={!!busy || !people.ready || !!people.error} onClick={() => void save("issue")}><FileCheck2 size={15} />{busy === "issue" ? "Issuing…" : pending ? "Retry issue" : "Issue certificate"}</Button></div></div>}>
    <div className={url ? "grid gap-6 lg:grid-cols-2" : ""}>
      <div>{people.error ? <div role="alert">Could not load recipients. <Button variant="ghost" onClick={people.reload}>Retry</Button></div> : !people.ready ? <LoadingSkeleton variant="form" label="Loading recipients…" /> : <fieldset disabled={frozen} className="grid min-w-0 gap-4 disabled:opacity-70">
        {!target && !replaces && <Field label="Recipient type"><Select value={kind} onChange={(event) => onKind(event.target.value as RecipientKind)}><option value="student">Student</option><option value="staff">Staff</option></Select></Field>}
        {source ? <div className="rounded-lg bg-surface-container-low p-3"><p className="font-semibold">{source.recipientName || source.studentName}</p><p className="text-xs text-on-surface-variant">{source.grn || source.recipientSnapshot?.employeeId} · {recipientKind(source) === "staff" ? "Staff certificate" : "Student certificate"}</p></div> : <RecipientPicker kind={kind} rows={people.rows} value={form.recipientId} onChange={selection} />}
        {!target && !replaces && <Field label="Certificate type"><Select value={form.type} onChange={(event) => changeType(event.target.value)}>{catalog.filter((c) => c.kind === kind && !c.legacy).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select></Field>}
        {selected && <p className="text-xs text-on-surface-variant">{kind === "staff" ? [selected.empId, selected.designation || selected.role, selected.department].filter(Boolean).join(" · ") : [selected.grn, selected.grade && `Grade ${selected.grade}`, selected.section && `Division ${selected.section}`].filter(Boolean).join(" · ")}</p>}
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Issue date" required><Input type="date" value={form.issuedOn} max={localDate(new Date())} onChange={(e) => update({ issuedOn: e.target.value })} /></Field>
          <Field label="Valid until"><Input type="date" min={form.issuedOn} value={form.validTill} onChange={(e) => update({ validTill: e.target.value })} /></Field></div>
        {(type?.fields || []).map((key) => <Field key={key} label={fieldLabels[key]} required hint={key === "feeClearance" ? "Record the office's reviewed position. Clearance is never assumed." : key === "salaryPeriod" ? "For example: November 2026, monthly gross salary." : undefined}>
          {key === "achievement" ? <Textarea maxLength={1200} value={form.fields[key] || ""} onChange={(e) => update({ fields: { ...form.fields, [key]: e.target.value } })} /> :
            <Input type={["startDate", "endDate", "dob"].includes(key) ? "date" : key === "salaryAmount" ? "number" : "text"} min={key === "salaryAmount" ? "0" : undefined} step={key === "salaryAmount" ? "0.01" : undefined}
              maxLength={300} readOnly={key === "dob"} value={key === "dob" ? selected?.dob || "" : form.fields[key] || ""} onChange={(e) => update({ fields: { ...form.fields, [key]: e.target.value } })} />}
        </Field>)}
        <Field label="Purpose"><Input maxLength={300} value={form.purpose} onChange={(e) => update({ purpose: e.target.value })} placeholder="For example: admission, bank or employment records" /></Field>
        <Field label="Authorised signatory" required><Input maxLength={160} value={form.issuer} onChange={(e) => update({ issuer: e.target.value })} placeholder="Name of the authorised signatory" /></Field>
        <Field label="Office note" hint="Visible in the certificate record to the recipient; use history for internal action reasons."><Textarea maxLength={600} value={form.note} onChange={(e) => update({ note: e.target.value })} /></Field>
        <p className="text-xs text-on-surface-variant">A unique certificate number is assigned when issued. Template version {form.templateVersion || "default"} · {templateFor(form.type).designation}.</p>
      </fieldset>}
      {!!busy && <LoadingSkeleton variant="form" label={busy === "preview" ? "Preparing PDF preview…" : "Saving certificate…"} className="mt-4" />}
      </div>
      {url && <div className="min-w-0"><p className="mb-2 text-sm font-semibold">Draft preview</p><iframe title="Certificate PDF preview" src={url} className="h-[65vh] min-h-80 w-full rounded-lg border border-outline-variant" /><a href={url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-secondary underline">Open preview PDF</a></div>}
    </div>
  </Modal>;
}
