"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { DocumentFilePicker, DocumentList, DocumentRow } from "@/components/DocumentRows";
import { Badge, Button, useToast } from "@/components/ui";
import { FilePreview } from "@/features/admissions/AdmissionFilePreview";
import { fmtDate } from "@/lib/format";
import { documentTypes, downloadStaffDocument, listStaffDocuments, readStaffDocument, uploadStaffDocument,
  uploadStaffPhoto, type StaffDocument, type StaffDocumentCategory } from "./staffFiles";
import { isTeachingStaff, staffFormError } from "./staffProfiles";

const accept = "application/pdf,image/jpeg,image/png";
const categories = Object.keys(documentTypes) as StaffDocumentCategory[];
const commonUploads: StaffDocumentCategory[] = ["identity", "experience", "pan", "bank"];

export function StaffDocumentsPanel({ staffId, photo, editing, designation, directoryRole, staffRole, staffCategory,
  hasProfessionalCredential, onPhotoSaved, onPhotoBusy }: {
  staffId: string;
  photo?: string | null;
  editing: boolean;
  designation?: string;
  directoryRole?: string;
  staffRole?: string;
  staffCategory?: string;
  hasProfessionalCredential: boolean;
  onPhotoSaved: (photo: string) => void;
  onPhotoBusy: (busy: boolean) => void;
}) {
  const toast = useToast();
  const [documents, setDocuments] = useState<StaffDocument[]>();
  const [loadError, setLoadError] = useState("");
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<StaffDocument | "photo">();
  const readPreview = useCallback(async () => {
    if (preview === "photo" && photo) return (await fetch(photo)).blob();
    if (preview && preview !== "photo") return readStaffDocument(staffId, preview);
    throw new Error("Choose a document to preview.");
  }, [photo, preview, staffId]);

  useEffect(() => {
    let active = true;
    listStaffDocuments(staffId).then(({ documents }) => {
      if (active) setDocuments(documents);
    }).catch((error: unknown) => {
      if (active) setLoadError(staffFormError(error));
    });
    return () => { active = false; };
  }, [staffId, revision]);

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    try {
      await action();
    } catch (error) {
      toast(staffFormError(error), "error");
    } finally {
      setBusy("");
    }
  }

  function savePhoto(file: File) {
    void run("Saving photo…", async () => {
      onPhotoBusy(true);
      try {
        const result = await uploadStaffPhoto(staffId, file);
        onPhotoSaved(result.photo);
        toast("Profile photo saved");
      } finally {
        onPhotoBusy(false);
      }
    });
  }

  function upload(file: File, category: StaffDocumentCategory, replace?: StaffDocument) {
    void run(replace ? "Replacing document…" : "Uploading document…", async () => {
      const { document } = await uploadStaffDocument(staffId, category, file, replace);
      setDocuments((current) => [document, ...(current ?? []).filter((entry) => entry.id !== document.id)]);
      toast(replace ? "Document replaced" : "Document uploaded");
    });
  }

  function download(document: StaffDocument) {
    void run("Downloading document…", () => downloadStaffDocument(staffId, document));
  }

  function downloadPhoto() {
    if (!photo) return;
    const link = window.document.createElement("a");
    link.href = photo;
    link.download = "profile-photo.jpg";
    link.click();
  }

  const uploaded = (documents?.length ?? 0) + Number(Boolean(photo));
  const job = designation?.trim().toLowerCase() ?? "";
  const legacyJob = directoryRole?.trim().toLowerCase() ?? "";
  const driver = job === "driver" || (!staffCategory && (staffRole === "driver" || legacyJob === "driver"));
  const attendantJobs = ["bus attendant", "helper"];
  const attendant = attendantJobs.includes(job) || (!staffCategory && (staffRole === "helper" || attendantJobs.includes(legacyJob)));
  const teaching = isTeachingStaff({ category: staffCategory, role: directoryRole ?? "", designation, staffRole });
  const uploadCategories = new Set(commonUploads);
  if (!driver && !attendant) {
    uploadCategories.add("education");
    uploadCategories.add("resume");
  }
  if (driver || teaching || hasProfessionalCredential) uploadCategories.add("professional");

  function categoryLabel(category: StaffDocumentCategory) {
    return driver && category === "professional" ? "Driving licence or professional certificate" : documentTypes[category];
  }

  return <section aria-labelledby="staff-documents" className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="staff-documents" className="t-headline-md">Staff documents</h2>
      {documents && <Badge tone={uploaded ? "success" : "neutral"}>{uploaded} uploaded</Badge>}
    </div>
    <p className="text-sm text-on-surface-variant">Upload a PDF, JPEG or PNG document under 10 MB.</p>
    <DocumentList>
      <DocumentRow title="Profile photo" photo badge={<UploadStatus count={photo ? 1 : 0} />}>
        <div className="flex flex-wrap items-center gap-1.5">
          {photo && <>
            <Button variant="outline" size="sm" aria-label="Preview profile photo" disabled={!!busy} onClick={() => setPreview("photo")}>
              <Eye size={14} aria-hidden="true" />Preview
            </Button>
            <Button variant="ghost" size="sm" aria-label="Download profile photo" disabled={!!busy} onClick={downloadPhoto}>
              <Download size={14} aria-hidden="true" />Download
            </Button>
          </>}
          <DocumentFilePicker label={photo ? "Replace" : "Upload"} name={photo ? "Replace profile photo" : "Upload profile photo"}
            accept="image/jpeg,image/png,image/webp" disabled={!!busy || editing} onSelect={savePhoto} />
        </div>
      </DocumentRow>
      {documents && categories.map((category) => {
        const files = documents.filter((document) => document.category === category);
        const canUpload = uploadCategories.has(category);
        if (!canUpload && !files.length) return null;
        const label = categoryLabel(category);
        return <DocumentRow key={category} title={label} badge={<UploadStatus count={files.length} />}>
          {files.length > 0 && <ul className="space-y-2">
            {files.map((document) => <li key={document.id} className="space-y-1">
              <p className="break-words text-xs text-on-surface-variant">{document.name} · {fmtDate(document.uploadedAt.slice(0, 10))}</p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Button variant="outline" size="sm" aria-label={`Preview ${document.name}`} disabled={!!busy} onClick={() => setPreview(document)}>
                  <Eye size={14} aria-hidden="true" />Preview
                </Button>
                <Button variant="ghost" size="sm" aria-label={`Download ${document.name}`} disabled={!!busy} onClick={() => download(document)}>
                  <Download size={14} aria-hidden="true" />Download
                </Button>
                {canUpload && <DocumentFilePicker label="Replace" name={`Replace ${document.name}`} accept={accept}
                  disabled={!!busy} onSelect={(file) => upload(file, category, document)} />}
              </div>
            </li>)}
          </ul>}
          {canUpload && <DocumentFilePicker label={files.length ? "Upload another" : "Upload"} name={`Upload ${label}`}
            accept={accept} disabled={!!busy} onSelect={(file) => upload(file, category)} />}
        </DocumentRow>;
      })}
    </DocumentList>
    {loadError ? <div className="flex flex-wrap items-center gap-3">
      <p role="alert" className="text-sm text-error">{loadError}</p>
      <Button variant="outline" size="sm" onClick={() => {
        setLoadError("");
        setRevision((current) => current + 1);
      }}>Try again</Button>
    </div> : !documents && <p role="status" className="text-sm">Loading staff documents…</p>}
    {busy && <p role="status" className="text-sm">{busy}</p>}
    {preview === "photo" && photo && <FilePreview path="photo" name="Profile photo" title="Preview profile photo"
      readFile={readPreview} onClose={() => setPreview(undefined)} onDownload={downloadPhoto} downloading={false} />}
    {preview && preview !== "photo" && <FilePreview key={preview.generation} path={preview.id} name={preview.name}
      title={`Preview ${categoryLabel(preview.category)}`} readFile={readPreview}
      onClose={() => setPreview(undefined)} onDownload={() => download(preview)} downloading={!!busy} />}
  </section>;
}

function UploadStatus({ count }: { count: number }) {
  return <Badge tone={count ? "success" : "neutral"}>{count > 1 ? `${count} uploaded` : count ? "Uploaded" : "Not uploaded"}</Badge>;
}
