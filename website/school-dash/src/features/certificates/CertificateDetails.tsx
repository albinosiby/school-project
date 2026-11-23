"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Download, History, Printer, ShieldX, Upload } from "lucide-react";
import { Badge, Button, Field, LoadingSkeleton, Modal, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { fieldLabels, recipientKind, recipientName, statusTone } from "./catalog";
import { certificateAction, certificateError, certificatePdf, pdfBlob, printPdf, savePdf } from "./service";
import type { Certificate, CertificateHistory, PdfResult } from "./types";

export function SavedCertificatePdf({ certificateId }: { certificateId: string }) {
  const [pdf, setPdf] = useState<PdfResult | null>(null), [url, setUrl] = useState(""), [error, setError] = useState(""), [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false, objectUrl = "";
    certificatePdf(certificateId).then((result) => { if (!cancelled) { objectUrl = URL.createObjectURL(pdfBlob(result)); setPdf(result); setUrl(objectUrl); setError(""); } }).catch((e) => { if (!cancelled) setError(certificateError(e)); });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [certificateId, retry]);
  if (error) return <div role="alert" className="p-5">{error}<Button variant="outline" onClick={() => { setError(""); setRetry((v) => v + 1); }}>Retry</Button></div>;
  if (!pdf) return <LoadingSkeleton variant="page" label="Loading certificate PDF…" />;
  return <div><div className="mb-4 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => savePdf(pdf)}><Download size={16} />Download PDF</Button><Button onClick={() => printPdf(pdf)}><Printer size={16} />Print</Button></div><iframe title="Issued certificate PDF" src={url} className="h-[80vh] w-full rounded-lg border border-outline-variant" /><a className="mt-3 inline-block text-secondary underline" href={url} target="_blank" rel="noreferrer">Open PDF in a new tab</a></div>;
}

export function CertificateDetails({ cert, onClose, onPrepare, onReplace }: { cert: Certificate; onClose: () => void; onPrepare: () => void; onReplace: () => void }) {
  const toast = useToast(), history = useCollection<CertificateHistory>("certificate_history", true, [["certificateId", "==", cert.id]]);
  const [busy, setBusy] = useState(""), [error, setError] = useState(""), [reasonAction, setReasonAction] = useState(""), [reason, setReason] = useState("");
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const signedRequest = useRef<{ content: string; requestId: string } | null>(null);
  const kind = recipientKind(cert), personId = kind === "staff" ? cert.staffId : cert.studentId;
  async function pdf(print = false, historyId?: string) {
    setBusy("pdf"); setError("");
    try { const result = historyId ? await certificatePdf(cert.id, historyId) : await certificatePdf(cert.id); if (print) printPdf(result); else savePdf(result); } catch (e) { setError(certificateError(e)); } finally { setBusy(""); }
  }
  async function act(action: string) {
    if (action !== "resumeIssue" && reason.trim().length < 5) { setError("Enter a reason of at least 5 characters."); return; }
    setBusy(action); setError("");
    try {
      await certificateAction(action, { certificateId: cert.id, expectedRevision: cert.revision || 0, reason, requestId: action === "resumeIssue" ? cert.issueRequestId : requestId });
      toast(action === "resumeIssue" ? "Certificate issued" : action === "revoke" ? "Certificate revoked" : "Request rejected"); setReasonAction(""); setReason(""); setRequestId(crypto.randomUUID());
    } catch (e) { setError(certificateError(e)); } finally { setBusy(""); }
  }
  async function signed(file?: File) {
    if (!file) return;
    if (file.type !== "application/pdf" || !file.size || file.size > 6 * 1024 * 1024) { setError("Choose a signed PDF up to 6 MB."); return; }
    setBusy("upload"); setError("");
    try { const bytes = new Uint8Array(await file.arrayBuffer()); let binary = ""; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      const content = btoa(binary);
      if (signedRequest.current?.content !== content) signedRequest.current = { content, requestId: crypto.randomUUID() };
      await certificateAction("attachSigned", { certificateId: cert.id, expectedRevision: cert.revision || 0, ...signedRequest.current }); signedRequest.current = null; toast("Signed PDF attached. The original is retained in history.");
    } catch (e) { setError(certificateError(e)); } finally { setBusy(""); }
  }
  return <Modal open title={cert.title} subtitle={cert.refNo || "Certificate request"} width="max-w-3xl" onClose={() => { if (!busy) onClose(); }}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><Badge tone={statusTone(cert.status)}>{cert.status}</Badge><h3 className="mt-3 text-xl font-semibold">{recipientName(cert)}</h3><p className="mt-1 text-sm text-on-surface-variant">{kind === "staff" ? `Employee ${cert.recipientSnapshot?.employeeId || ""}` : cert.grn || ""} · {kind === "staff" ? cert.recipientSnapshot?.designation : cert.recipientSnapshot?.class || cert.classId}</p>
      {personId && <Link className="mt-2 inline-block text-sm text-secondary hover:underline" href={`/${kind === "staff" ? "staff" : "students"}/${encodeURIComponent(personId)}`}>Open {kind === "staff" ? "staff" : "student"} details</Link>}</div><div className="flex flex-wrap gap-2">
      {cert.status === "Issued" && cert.schemaVersion === 2 && <><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void pdf()}><Download size={14} />Download PDF</Button><Button size="sm" variant="outline" disabled={!!busy} onClick={() => void pdf(true)}><Printer size={14} />Print</Button></>}
      {cert.status === "Issued" && cert.schemaVersion !== 2 && <><a href={`/certificate?id=${encodeURIComponent(cert.id)}`} target="_blank" rel="noreferrer" className="text-sm text-secondary underline">Print legacy certificate</a>{cert.fileUrl && <a href={cert.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-secondary underline">Signed copy</a>}</>}
      {["Requested", "Draft"].includes(cert.status) && <Button size="sm" disabled={!!busy} onClick={onPrepare}>Prepare certificate</Button>}
      {cert.status === "Preparing" && <Button size="sm" disabled={!!busy} onClick={() => void act("resumeIssue")}>Resume issue</Button>}
      {cert.status === "Revoked" && !cert.replacementId && <Button size="sm" disabled={!!busy} onClick={onReplace}>Create replacement</Button>}
      {cert.status === "Revoked" && cert.schemaVersion === 2 && <Button size="sm" variant="outline" disabled={!!busy} onClick={() => void pdf()}>Download archived PDF</Button>}
    </div></div>
    <dl className="grid gap-x-6 gap-y-4 rounded-lg bg-surface-container-low p-4 text-sm sm:grid-cols-2">{[["Issue date", cert.issuedOn && fmtDate(cert.issuedOn)], ["Valid until", cert.validTill && fmtDate(cert.validTill)], ["Authorised signatory", cert.issuer], ["Purpose", cert.purpose], ["Template", cert.templateSnapshot ? `Version ${cert.templateSnapshot.version || "default"}` : "Legacy record"], ...Object.entries(cert.fields || {}).map(([key, value]) => [fieldLabels[key] || key, value])].filter(([, value]) => value).map(([label, value]) => <div key={label}><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl>
    {cert.note && <p className="mt-4 rounded-lg border border-outline-variant p-3 text-sm">{cert.note}</p>}{(cert.rejectReason || cert.revokeReason) && <p className="mt-4 text-sm text-error">{cert.rejectReason || cert.revokeReason}</p>}
    {cert.status === "Preparing" && <p className="mt-4 text-sm text-on-surface-variant">A number has been reserved. Resume uses the saved review and the same number.</p>}
    {cert.status === "Preparing" && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => { setReasonAction("reject"); setRequestId(crypto.randomUUID()); }}>Cancel unfinished issue</Button>}
    {cert.status === "Issued" && <div className="mt-4 flex flex-wrap items-center gap-3">{cert.schemaVersion === 2 && <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold has-[:disabled]:opacity-50"><Upload size={14} />{cert.signed ? "Replace signed PDF" : "Attach signed PDF"}<input type="file" accept="application/pdf" aria-label="Signed certificate PDF" className="sr-only" disabled={!!busy} onChange={(event) => { void signed(event.target.files?.[0]); event.target.value = ""; }} /></label>}<Button size="sm" variant="ghost" className="!text-error" disabled={!!busy} onClick={() => { setReasonAction("revoke"); setError(""); setRequestId(crypto.randomUUID()); }}><ShieldX size={14} />Revoke certificate</Button></div>}
    {cert.status === "Requested" && <Button size="sm" variant="ghost" className="mt-4 !text-error" disabled={!!busy} onClick={() => { setReasonAction("reject"); setRequestId(crypto.randomUUID()); }}>Reject request</Button>}
    {reasonAction && <div className="mt-4 rounded-lg border border-outline-variant p-4"><Field label={reasonAction === "revoke" ? "Reason for revocation" : "Reason for rejection"} required><Textarea value={reason} maxLength={600} onChange={(event) => { setReason(event.target.value); setRequestId(crypto.randomUUID()); }} /></Field><div className="mt-3 flex gap-2"><Button size="sm" disabled={!!busy} onClick={() => void act(reasonAction)}>Confirm {reasonAction === "revoke" ? "revocation" : "rejection"}</Button><Button size="sm" variant="ghost" disabled={!!busy} onClick={() => setReasonAction("")}>Cancel</Button></div></div>}
    {busy && <LoadingSkeleton variant="form" label="Updating certificate…" className="mt-4" />}{error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    <section className="mt-6 border-t border-outline-variant/60 pt-5"><h3 className="flex items-center gap-2 font-semibold"><History size={17} />Issuance history</h3>{history.error ? <p role="alert" className="mt-3 text-sm">Could not load history. <Button variant="ghost" size="sm" onClick={history.reload}>Retry</Button></p> : !history.ready ? <LoadingSkeleton variant="table" label="Loading history…" /> : !history.rows.length ? <p className="mt-3 text-sm text-on-surface-variant">No recorded history for this legacy certificate.</p> : <ol className="mt-3 space-y-4">{[...history.rows].sort((a, b) => b.at.localeCompare(a.at)).map((event) => <li key={event.id} className="border-l-2 border-outline-variant pl-3"><p className="text-sm font-semibold">{event.action}</p>{event.detail && <p className="mt-1 break-words text-sm text-on-surface-variant">{event.detail}</p>}<p className="mt-1 text-xs text-on-surface-variant">{event.by} · {new Date(event.at).toLocaleString()}</p>{event.previousPdfPath && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => void pdf(false, event.id)}>Download previous PDF</Button>}</li>)}</ol>}</section>
  </Modal>;
}
