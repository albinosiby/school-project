"use client";
import { siteUrls } from "@edvio/shared/sites";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";

/** Shown above the school console while a product owner works inside a school (contract 16). */
export function OwnerBanner() {
  const { user } = useAuth();
  const school = useCollection<{ id: string; name?: string }>("school").rows[0];
  if (user?.role !== "owner" || !user.schoolId) return null;
  const sid = user.schoolId;
  return (
    <div role="status" className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 bg-inverse-surface px-4 py-2 text-sm text-inverse-on-surface">
      <span className="flex items-center gap-2"><ShieldCheck size={16} />Platform owner inside <b>{school?.name ?? "this school"}</b>. Changes are saved to this school.</span>
      
      <a href={`${siteUrls().owner}/owner/schools/${encodeURIComponent(sid)}`} className="flex cursor-pointer items-center gap-1 rounded-md bg-inverse-on-surface/15 px-3 py-1 font-semibold hover:bg-inverse-on-surface/25">
        <ArrowLeft size={14} />Back to owner console
      </a>
    </div>
  );
}
