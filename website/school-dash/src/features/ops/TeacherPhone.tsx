"use client";

import { useEffect, useState } from "react";
import { Phone } from "lucide-react";
import { LoadingSkeleton, Button } from "@/components/ui";
import { loadStaffProfile } from "@/features/people/staffProfiles";
import { useAuth } from "@/lib/authContext";
import type { ClassTeacher } from "./classDetails";

/** Contact details stay in the protected staff profile; fetch only for a displayed teacher. */
export function TeacherPhone({ teacher, icon = false }: { teacher?: ClassTeacher; icon?: boolean }) {
  const { user } = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ key: string; phone?: string; failed?: boolean }>();
  const staffId = teacher?.id;
  const summaryPhone = teacher?.phone?.trim() || "";
  const canLoad = Boolean(user?.schoolId && user.role === "admin" && staffId && (teacher?.profileVersion || !summaryPhone));
  const key = canLoad ? JSON.stringify([user?.id, user?.schoolId, staffId, teacher?.updatedAt, attempt]) : "";
  useEffect(() => {
    if (!key || !staffId) return;
    let disposed = false;
    loadStaffProfile(staffId).then(({ profile }) => {
      if (!disposed) setResult({ key, phone: profile?.phone?.trim() });
    }).catch(() => {
      if (!disposed) setResult({ key, failed: true });
    });
    return () => { disposed = true; };
  }, [key, staffId]);

  const loaded = key && result?.key === key ? result : undefined;
  if (key && !loaded) return <LoadingSkeleton variant="inline" label="Loading phone…" />;
  if (loaded?.failed) return <span className="inline-flex flex-wrap items-center gap-2">Phone unavailable
    <Button variant="ghost" size="sm" onClick={(event) => { event.stopPropagation(); setAttempt((value) => value + 1); }}>Retry phone</Button>
  </span>;
  const phone = loaded?.phone ?? summaryPhone;
  return phone ? <a href={`tel:${phone}`} className="inline-flex items-center gap-1.5 text-secondary hover:underline" onClick={(event) => event.stopPropagation()}>
    {icon && <Phone size={13} aria-hidden="true" />}{phone}
  </a> : <span>Phone not recorded</span>;
}
