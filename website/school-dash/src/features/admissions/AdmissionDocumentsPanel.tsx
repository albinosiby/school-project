"use client";

import { useState } from "react";
import { Download, Eye, FileImage, FileText, Upload } from "lucide-react";
import { AdmissionFilePreview } from "./AdmissionFilePreview";
import { Badge, Button, useToast } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { admissionChecklist, documentKeys, documentTypes, downloadAdmissionDocument, missingDocuments,
  reviewAdmissionDocument, setDocumentExpected, uploadAdmissionDocument, type AdmissionChecklist, type DocumentType } from "./admissionDocuments";

export function AdmissionDocumentsPanel({ id, checklist }: { id: string; checklist?: AdmissionChecklist }) {
  const row = checklist ?? admissionChecklist(id);
  const [busy, setBusy] = useState<DocumentType>();
  const [previewType, setPreviewType] = useState<DocumentType>();
  const preview = previewType ? row.uploads[previewType] : undefined;
  const missing = missingDocuments(row);
  const toast = useToast();

  async function run(type: DocumentType, action: () => Promise<unknown>, success?: string) {
    if (busy) return;
    setBusy(type);
    try { await action(); if (success) toast(success); }
    catch (error) { toast(error instanceof Error ? error.message : "Could not update the document.", "error"); }
    finally { setBusy(undefined); }
  }

  return <section aria-labelledby={`admission-documents-${id}`} className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id={`admission-documents-${id}`} className="t-headline-md">Admission documents</h2>
      <Badge tone={missing ? "warning" : "success"}>{missing ? `${missing} missing` : "Checklist complete"}</Badge>
    </div>
    <p className="text-sm text-on-surface-variant">Preview uploads before verification. Mark any documents the school does not require as not applicable.</p>
    <ul className="divide-y divide-outline-variant/60 overflow-hidden rounded-lg border border-outline-variant/60">
      {documentKeys.map((type) => {
        const upload = row.uploads[type];
        const expected = row.expected.includes(type);
        const status = upload?.status === "verified" ? "Verified" : upload?.status === "pending" ? "Pending verification"
          : upload?.status === "rejected" ? "Re-upload required" : expected ? "Missing" : "Not applicable";
        const Icon = type === "photo" ? FileImage : FileText;
        return <li key={type} className="space-y-3 p-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container text-on-surface-variant">
              <Icon size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{documentTypes[type]}</p>
                <Badge tone={status === "Verified" ? "success" : expected ? "warning" : "neutral"}>{status}</Badge>
              </div>
              {upload ? <p className="mt-1 break-words text-xs text-on-surface-variant">
                {upload.name} · {fmtDate(upload.uploadedAt.slice(0, 10))}
              </p> : type === "parentId" && <p className="mt-1 text-xs text-on-surface-variant">Aadhaar or another accepted ID proof</p>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {upload && <>
              <Button variant="outline" size="sm" aria-label={`Preview ${documentTypes[type]}`} disabled={!!busy} onClick={() => setPreviewType(type)}>
                <Eye size={14} aria-hidden="true" />Preview
              </Button>
              <Button variant="ghost" size="sm" aria-label={`Download ${documentTypes[type]}`} disabled={!!busy}
                onClick={() => void run(type, () => downloadAdmissionDocument(upload))}>
                <Download size={14} aria-hidden="true" />Download
              </Button>
            </>}
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-xs font-semibold text-secondary focus-within:ring-2">
              <Upload size={14} aria-hidden="true" /><span>{upload ? "Replace" : "Upload"}</span>
              <input type="file" className="sr-only" aria-label={`Upload ${documentTypes[type]}`}
                accept={type === "photo" ? "image/png,image/jpeg" : "application/pdf,image/png,image/jpeg"}
                disabled={!!busy} onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void run(type, () => uploadAdmissionDocument(id, type, file), "Document uploaded");
                }} />
            </label>
            {!upload && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run(type, () => setDocumentExpected(id, type, !expected))}>
              {expected ? "Mark not applicable" : "Mark expected"}
            </Button>}
            {upload?.status === "pending" && <>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run(type, () => reviewAdmissionDocument(id, type, upload, "verified"))}>Verify</Button>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run(type, () => reviewAdmissionDocument(id, type, upload, "rejected"))}>Reject</Button>
            </>}
            {busy === type && <span role="status">Working…</span>}
          </div>
        </li>;
      })}
    </ul>
    {previewType && preview && <AdmissionFilePreview key={preview.path} title={`Preview ${documentTypes[previewType]}`} upload={preview}
      onClose={() => setPreviewType(undefined)} downloading={!!busy}
      onDownload={() => void run(previewType, () => downloadAdmissionDocument(preview))} />}
  </section>;
}
