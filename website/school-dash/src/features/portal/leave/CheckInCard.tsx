"use client";
// Today's check-in card (contract §3 staff_attendance/{date}_{staffId}): the same punch-in / punch-out the teacher app's
// self-log does, with `source: "web"`. Used on the portal home and the Leave & check-in page.
import { useState } from "react";
import { AlarmClock, LogIn, LogOut } from "lucide-react";
import { Badge, Button, Card, CardHeader, useToast } from "@/components/ui";
import { t12, useLeavePolicy } from "@/features/people/checkins";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { todayIso } from "../shared";
import { checkInDoc, checkOutPatch, dayId, hhmm, type StaffDay } from "./logic";
import { setPortalDoc, updatePortalDoc } from "./writes";

export function useMyDays() {
  const { staffId } = useStaffProfile();
  const days = useCollection<StaffDay>("staff_attendance", !!staffId, [["staffId", "==", staffId]] as const);
  return { ...days, rows: days.rows.filter((d) => d.staffId === staffId) };
}

export function CheckInCard() {
  const { user, staffId, teaching, ready } = useStaffProfile();
  const policy = useLeavePolicy();
  const toast = useToast();
  const now = useNow(30_000);
  const today = todayIso(new Date(now));
  const days = useMyDays();
  const rec = days.rows.find((d) => d.id === dayId(today, staffId) || d.date === today);
  const [busy, setBusy] = useState(false);
  const uid = user?.id ?? "";

  const checkIn = async () => {
    setBusy(true);
    try { await setPortalDoc("staff_attendance", dayId(today, staffId), checkInDoc(staffId, uid, today, hhmm(new Date()), policy.checkInBy)); toast("Checked in"); }
    catch { toast("Could not record your check-in", "error"); }
    finally { setBusy(false); }
  };
  const checkOut = async () => {
    if (!rec) return;
    setBusy(true);
    try { await updatePortalDoc("staff_attendance", rec.id, checkOutPatch(staffId, uid, hhmm(new Date()))); toast("Checked out"); }
    catch { toast("Could not record your check-out", "error"); }
    finally { setBusy(false); }
  };

  const status = rec?.status ?? "";
  return (
    <Card className="p-5">
      <CardHeader className="p-0 pb-3" title="Today's check-in" subtitle={`${today} · on time until ${t12(policy.checkInBy)}`}
        actions={rec && <Badge tone={status === "Late" ? "warning" : status === "Leave" ? "info" : "success"}>{status || "Present"}</Badge>} />
      {!ready || !staffId ? <p className="text-sm text-on-surface-variant">Loading your record…</p> : (
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm"><LogIn size={16} className="text-secondary" /><span className="text-on-surface-variant">In</span><span className="font-semibold">{rec?.in ? t12(rec.in) : "—"}</span></div>
          <div className="flex items-center gap-2 text-sm"><LogOut size={16} className="text-secondary" /><span className="text-on-surface-variant">Out</span><span className="font-semibold">{rec?.out ? t12(rec.out) : "—"}</span></div>
          <div className="ml-auto flex gap-2">
            {!rec?.in && <Button onClick={checkIn} disabled={busy || !days.ready}><AlarmClock size={16} />Check in</Button>}
            {rec?.in && !rec.out && <Button variant="outline" onClick={checkOut} disabled={busy}><LogOut size={16} />Check out</Button>}
            {rec?.in && rec.out && <span className="text-sm text-on-surface-variant">Day complete</span>}
          </div>
        </div>
      )}
      {rec?.note && <p className="mt-2 text-xs text-on-surface-variant">{rec.note}</p>}
      {!teaching && !rec && days.ready && <p className="mt-2 text-xs text-outline">Your check-in is recorded against your staff record for the office&apos;s attendance register.</p>}
    </Card>
  );
}
