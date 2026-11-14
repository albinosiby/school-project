import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import documentTypes from "../../../../functions/staffDocumentTypes.json";
import { readProfilePhoto } from "./staffProfilePhoto";

export { documentTypes };
export type StaffDocumentCategory = keyof typeof documentTypes;
export type StaffDocument = {
  id: string;
  generation: string;
  category: StaffDocumentCategory;
  name: string;
  uploadedAt: string;
};

type DocumentVersion = Pick<StaffDocument, "id" | "generation">;
type FileAction = { action: "photo"; photo: string }
  | { action: "list" }
  | ({ action: "read" } & DocumentVersion)
  | ({ action: "save"; uploadId: string; category: StaffDocumentCategory; name: string; contentType: string; content: string } & Partial<DocumentVersion>);

async function staffFiles<Result>(staffId: string, input: FileAction) {
  const { data } = await httpsCallable<FileAction & { staffId: string }, Result>(functions, "manageStaffFiles")({ staffId, ...input });
  return data;
}

export async function uploadStaffPhoto(staffId: string, file: File) {
  return staffFiles<{ photo: string }>(staffId, { action: "photo", photo: await readProfilePhoto(file) });
}

export async function listStaffDocuments(staffId: string) {
  return staffFiles<{ documents: StaffDocument[] }>(staffId, { action: "list" });
}

export async function uploadStaffDocument(staffId: string, category: StaffDocumentCategory, file: File, replace?: DocumentVersion) {
  if (!["application/pdf", "image/jpeg", "image/png"].includes(file.type) || !file.size || file.size >= 10 * 1024 * 1024) {
    throw new Error("Choose a PDF, JPEG or PNG file under 10 MB.");
  }
  const content = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.onerror = reader.onabort = () => reject(new Error("The selected file could not be read."));
    reader.readAsDataURL(file);
  });
  return staffFiles<{ document: StaffDocument }>(staffId, {
    action: "save", uploadId: crypto.randomUUID(), category, name: file.name, contentType: file.type, content,
    ...(replace && { id: replace.id, generation: replace.generation }),
  });
}

export async function readStaffDocument(staffId: string, { id, generation }: DocumentVersion) {
  const { content, contentType } = await staffFiles<{ content: string; contentType: string }>(staffId, { action: "read", id, generation });
  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: contentType });
}

export async function downloadStaffDocument(staffId: string, document: StaffDocument) {
  const blob = await readStaffDocument(staffId, document);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = document.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
