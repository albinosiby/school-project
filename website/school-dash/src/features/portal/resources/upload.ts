"use client";
// Uploads a class resource file to the teacher's own Storage folder, as the teacher app's `uploadMaterial(folder:
// 'class-resources')` does: schools/{schoolId}/class-resources/{authUid}/mat_… (storage.rules: the teacher's uid, ≤ 25 MB,
// image/*, application/* or text/plain). Reports progress 0..100.
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { auth, storage } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import { storagePath, uploadType, type UploadedFile } from "./logic";

export async function uploadResourceFile(file: File, onProgress: (pct: number) => void): Promise<UploadedFile> {
  const schoolId = currentSchoolId();
  const uid = auth.currentUser?.uid;
  if (!schoolId || !uid) throw new Error("Sign in to upload files.");
  const path = storagePath(schoolId, uid, Date.now());
  const contentType = uploadType(file);
  const r = ref(storage, path);
  await new Promise<void>((resolve, reject) => {
    const task = uploadBytesResumable(r, file, { contentType });
    task.on("state_changed",
      (snap) => onProgress(snap.totalBytes ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0),
      reject,
      () => resolve());
  });
  onProgress(100);
  return { url: await getDownloadURL(r), path, fileName: file.name, mime: contentType, sizeBytes: file.size };
}
