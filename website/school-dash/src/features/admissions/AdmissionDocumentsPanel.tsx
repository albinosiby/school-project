"use client";

import { useState } from "react";
import { Download, Eye } from "lucide-react";
import { AdmissionFilePreview } from "./AdmissionFilePreview";
import { Badge, Button, useToast } from "@/components/ui";
import { DocumentFilePicker, DocumentList, DocumentRow } from "@/components/DocumentRows";
import { fmtDate } from "@/lib/format";
import { admissionChecklist, documentKeys, documentTypes, downloadAdmissionDocument, missingDocuments,
  reviewAdmissionDocument, setDocumentExpected, uploadAdmissionDocument, type AdmissionChecklist, type DocumentType } from "./admissionDocuments";

export function AdmissionDocumentsPanel({ id, checklist, readOnly = false }: { id: string; checklist?: AdmissionChecklist; readOnly?: boolean }) {
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
    <p className="text-sm text-on-surface-variant">{readOnly ? "Saved documents are available for viewing and download." : "Preview uploads before verification. Mark any documents the school does not require as not applicable."}</p>
    <DocumentList>
      {documentKeys.map((type) => {
        const upload = row.uploads[type];
        const expected = row.expected.includes(type);
        const status = upload?.status === "verified" ? "Verified" : upload?.status === "pending" ? "Pending verification"
          : upload?.status === "rejected" ? "Re-upload required" : expected ? "Missing" : "Not applicable";
        return <DocumentRow key={type} title={documentTypes[type]} photo={type === "photo"}
          badge={<Badge tone={status === "Verified" ? "success" : expected ? "warning" : "neutral"}>{status}</Badge>}
          details={upload ? <p className="mt-1 break-words text-xs text-on-surface-variant">
            {upload.name} · {fmtDate(upload.uploadedAt.slice(0, 10))}
          </p> : type === "parentId" && <p className="mt-1 text-xs text-on-surface-variant">Aadhaar or another accepted ID proof</p>}>
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
            {!readOnly && <DocumentFilePicker label={upload ? "Replace" : "Upload"} name={`Upload ${documentTypes[type]}`}
              accept={type === "photo" ? "image/png,image/jpeg" : "application/pdf,image/png,image/jpeg"}
              disabled={!!busy} onSelect={(file) => void run(type, () => uploadAdmissionDocument(id, type, file), "Document uploaded")} />}
            {!readOnly && !upload && <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run(type, () => setDocumentExpected(id, type, !expected))}>
              {expected ? "Mark not applicable" : "Mark expected"}
            </Button>}
            {!readOnly && upload?.status === "pending" && <>
              <Button variant="outline" size="sm" disabled={!!busy} onClick={() => void run(type, () => reviewAdmissionDocument(id, type, upload, "verified"))}>Verify</Button>
              <Button variant="ghost" size="sm" disabled={!!busy} onClick={() => void run(type, () => reviewAdmissionDocument(id, type, upload, "rejected"))}>Reject</Button>
            </>}
            {busy === type && <span role="status">Working…</span>}
          </div>
        </DocumentRow>;
      })}
    </DocumentList>
    {previewType && preview && <AdmissionFilePreview key={preview.path} title={`Preview ${documentTypes[previewType]}`} upload={preview}
      onClose={() => setPreviewType(undefined)} downloading={!!busy}
      onDownload={() => void run(previewType, () => downloadAdmissionDocument(preview))} />}
  </section>;
}
