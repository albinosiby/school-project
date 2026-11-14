import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
export function circularError(file: File): string {
  if (!file.size || file.size > 15 * 1024 * 1024) return "Choose a file up to 15 MB.";
  if (!((file.type === "application/pdf" && /\.pdf$/i.test(file.name)) || (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && /\.docx$/i.test(file.name)))) return "Choose a PDF or DOCX circular.";
  return "";
}
export async function uploadCircular(file: File) {
  const error = circularError(file); if (error) throw new Error(error);
  const sid = currentSchoolId(); if (!sid) throw new Error("Open a school before uploading a circular.");
  const path = `schools/${sid}/calendar-documents/${crypto.randomUUID()}`;
  const target = ref(storage, path);
  await uploadBytes(target, file, { contentType: file.type });
  return { circular: file.name, circularPath: path, circularUrl: await getDownloadURL(target) };
}
