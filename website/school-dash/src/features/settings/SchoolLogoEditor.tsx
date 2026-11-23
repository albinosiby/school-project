"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { doc, runTransaction } from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { SchoolLogo } from "@/components/SchoolLogo";
import { useToast } from "@/components/ui";
import { auth, db, storage } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";

const LOGO_TYPES = ["image/png", "image/jpeg"];
const MAX_BYTES = 2 * 1024 * 1024;

async function saveLogo(file: File) {
  const sid = currentSchoolId();
  const uid = auth.currentUser?.uid;
  if (!sid || !uid) throw new Error("Sign in to upload a school logo.");
  const prefix = `schools/${sid}/branding/`;
  const logoPath = `${prefix}logo-${crypto.randomUUID()}`;
  const imageRef = ref(storage, logoPath);
  await uploadBytes(imageRef, file, { contentType: file.type });
  const logoUrl = await getDownloadURL(imageRef).catch(async (error) => {
    await deleteObject(imageRef).catch(() => {});
    throw error;
  });

  // Publish the new image only after it is readable. The transaction identifies which image it replaced.
  const school = doc(db, "schools", sid, "school", "school");
  const previous = await runTransaction(db, async (tx) => {
    const snapshot = await tx.get(school);
    tx.set(school, { logoUrl, logoPath, updatedAt: new Date().toISOString(), updatedBy: uid }, { merge: true });
    return snapshot.data()?.logoPath as unknown;
  });
  if (typeof previous === "string" && previous.startsWith(prefix) &&
      /^logo-[a-f0-9-]{36}$/.test(previous.slice(prefix.length))) {
    await deleteObject(ref(storage, previous)).catch(() => {});
  }
}

export function SchoolLogoEditor({ logoUrl, disabled }: { logoUrl?: string; disabled: boolean }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    setError("");
    if (!LOGO_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_BYTES) {
      setError("Choose a PNG or JPEG image up to 2 MB.");
      return;
    }
    setBusy(true);
    try {
      await saveLogo(file);
      toast("School logo updated");
    } catch {
      setError("Could not save the school logo. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-lg border border-outline-variant/60 p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="grid size-16 shrink-0 place-items-center rounded-lg bg-surface-container-low">
          <SchoolLogo src={logoUrl} size={52} alt="School logo preview" />
        </span>
        <div className="min-w-36 flex-1">
          <p className="font-semibold">School logo</p>
          <p id="school-logo-hint" className="text-xs text-on-surface-variant">Shown in the dashboard sidebar and on invoices. PNG or JPEG, up to 2 MB.</p>
        </div>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-outline-variant px-3 text-sm font-semibold hover:bg-surface-container-low focus-within:ring-2 focus-within:ring-secondary has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
          <Upload size={16} />
          <span>{busy ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}</span>
          <input type="file" accept={LOGO_TYPES.join(",")} className="sr-only" aria-label={logoUrl ? "Replace school logo" : "Upload school logo"}
            aria-describedby="school-logo-hint" disabled={disabled || busy} onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void upload(file);
            }} />
        </label>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    </div>
  );
}
