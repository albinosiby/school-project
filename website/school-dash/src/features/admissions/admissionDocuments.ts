"use client";

import { useMemo } from "react";
import { runTransaction, updateDoc } from "firebase/firestore";
import { deleteObject, ref, uploadBytes } from "firebase/storage";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { studentPhotoThumbnail } from "@/features/people/studentPhoto";
import { auth, db, storage } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { certFileError } from "@/features/people/studentLogic";

export const documentTypes = {
  photo: "Student photograph", birth: "Birth certificate", transfer: "Transfer certificate",
  marksheet: "Previous marksheet", parentId: "Parent ID proof", caste: "Caste certificate",
  disability: "Disability certificate", medical: "Medical certificate",
} as const;
export type DocumentType = keyof typeof documentTypes;
export const documentKeys = Object.keys(documentTypes) as DocumentType[];
export type AdmissionUpload = { path: string; name: string; uploadedAt: string; status: "pending" | "verified" | "rejected" };
export type AdmissionChecklist = { id: string; expected: DocumentType[]; uploads: Partial<Record<DocumentType, AdmissionUpload>> };

export function admissionChecklist(id: string, transfer = false): AdmissionChecklist {
  return { id, expected: ["photo", "birth", "parentId", ...(transfer ? ["marksheet" as const] : [])], uploads: {} };
}

export function missingDocuments(row: AdmissionChecklist) {
  return row.expected.filter((key) => !row.uploads[key] || row.uploads[key]?.status === "rejected").length;
}

export const defaultMissingDocuments = missingDocuments(admissionChecklist(""));

export function useAdmissionDocuments() {
  const list = useCollection<AdmissionChecklist>("adm_documents");
  const byStudent = useMemo(() => new Map(list.rows.map((row) => [row.id, row])), [list.rows]);
  const missing = useMemo(() => new Map(list.rows.map((row) => [row.id, missingDocuments(row)])), [list.rows]);
  return { byStudent, missing, ready: list.ready };
}

async function updateChecklist(id: string, change: (row: AdmissionChecklist) => AdmissionChecklist) {
  const target = schoolDoc("adm_documents", id);
  return runTransaction(db, async (tx) => {
    const snapshot = await tx.get(target);
    const row = snapshot.exists() ? snapshot.data() as AdmissionChecklist : admissionChecklist(id);
    tx.set(target, { ...change(row), ...stamp() });
    return row;
  });
}

export async function setDocumentExpected(id: string, type: DocumentType, expected: boolean) {
  await updateChecklist(id, (row) => ({ ...row, expected: expected
    ? [...new Set([...row.expected, type])] : row.expected.filter((key) => key !== type) }));
}

export async function reviewAdmissionDocument(id: string, type: DocumentType, upload: AdmissionUpload, status: "verified" | "rejected") {
  await updateChecklist(id, (row) => {
    if (row.uploads[type]?.path !== upload.path) throw new Error("The file changed. Review the latest upload.");
    return { ...row, uploads: { ...row.uploads, [type]: { ...upload, status } } };
  });
}

export async function uploadAdmissionDocument(id: string, type: DocumentType, file: File) {
  const error = certFileError(file);
  if (error) throw new Error(error);
  if (type === "photo" && !file.type.startsWith("image/")) throw new Error("Upload a PNG or JPG photograph.");
  const header = [...new Uint8Array(await file.slice(0, 8).arrayBuffer())];
  const signatures: Record<string, number[]> = {
    "application/pdf": [37, 80, 68, 70, 45], "image/jpeg": [255, 216, 255], "image/png": [137, 80, 78, 71, 13, 10, 26, 10],
  };
  if (!signatures[file.type]?.every((value, index) => header[index] === value)) throw new Error("The file does not match its declared format.");
  const target = schoolDoc("adm_documents", id);
  const path = `${target.parent.parent!.path}/admission-documents/${id}/${type}/${crypto.randomUUID()}`;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  const previous = await updateChecklist(id, (row) => ({ ...row,
    expected: [...new Set([...row.expected, type])],
    uploads: { ...row.uploads, [type]: { path, name: file.name, uploadedAt: new Date().toISOString(), status: "pending" } },
  }));
  const replaced = previous.uploads[type];
  if (replaced) await deleteObject(ref(storage, replaced.path)).catch(() => {});
  // the apps draw the photograph from a small thumbnail on the student record (they cannot read admission documents)
  if (type === "photo") {
    try {
      const photo = await studentPhotoThumbnail(file);
      await updateDoc(schoolDoc("students", id), { photo, ...stamp() });
    } catch (cause) {
      console.warn("student photo thumbnail not saved", cause);
    }
  }
}

export async function readAdmissionDocument(path: string) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Sign in to view this file.");
  const response = await fetch("/api/admission-document", {
    method: "POST",
    headers: { Authorization: `Firebase ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) {
    const error = await response.json().catch(() => null) as { message?: string } | null;
    throw new Error(error?.message || "The file could not be loaded.");
  }
  return response.blob();
}

export async function downloadAdmissionDocument(upload: AdmissionUpload) {
  const blob = await readAdmissionDocument(upload.path);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = upload.name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
