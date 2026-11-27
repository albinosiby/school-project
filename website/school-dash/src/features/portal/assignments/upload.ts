"use client";
// Teacher attachments for an assignment (new_homework_bloc.dart → ChatMediaRepository.uploadMaterial with
// folder 'homework-materials'): Storage `schools/{sid}/homework-materials/{uid}/mat_…`, and the FileRef the app
// stores in `ops_homework.attachments` ({name, size, kind: "file", url, path, contentType, bytes}).
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import { contentTypeOf, type FileRef } from "./logic";

const matId = () => `mat_${Date.now().toString(36)}${Math.floor(Math.random() * (1 << 20)).toString(36)}`;

export async function uploadMaterial(file: File, fallbackUid = ""): Promise<FileRef> {
  const sid = currentSchoolId();
  const uid = auth.currentUser?.uid || fallbackUid;
  if (!sid || !uid) throw new Error("Sign in to attach files.");
  const contentType = contentTypeOf(file.name, file.type);
  const path = `schools/${sid}/homework-materials/${uid}/${matId()}`;
  const r = ref(storage, path);
  await uploadBytes(r, file, { contentType });
  const url = await getDownloadURL(r);
  return { name: file.name, size: "", kind: "file", url, path, contentType, bytes: file.size };
}
