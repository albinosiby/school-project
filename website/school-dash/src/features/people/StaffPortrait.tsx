"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Avatar } from "@/components/ui";
import { db } from "@/lib/firebase";

export function StaffPortrait({ name, photo, compact = false }: { name: string; photo?: string | null; compact?: boolean }) {
  const size = compact ? 32 : 96;
  const initialsName = compact ? name.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "") : name;
  return <div className="shrink-0">
    {photo ? <Image src={photo} alt={`Profile photo of ${name}`} width={size} height={size}
      unoptimized className={compact ? "size-8 rounded-full object-cover" : "size-24 rounded-xl object-cover"} />
      : <Avatar name={initialsName} size={size} />}
  </div>;
}

export function StaffDirectoryPortrait({ staffId, schoolId, name }: { staffId: string; schoolId: string; name: string }) {
  const [photo, setPhoto] = useState<string>();
  useEffect(() => {
    return onSnapshot(doc(db, "schools", schoolId, "staff_hr_photos", staffId), (snapshot) => {
      const image: unknown = snapshot.data()?.image;
      setPhoto(typeof image === "string" && image.startsWith("data:image/jpeg;base64,") ? image : undefined);
    }, () => setPhoto(undefined));
  }, [schoolId, staffId]);

  return <StaffPortrait name={name} photo={photo} compact />;
}
