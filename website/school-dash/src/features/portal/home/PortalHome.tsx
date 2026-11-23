"use client";
// Staff portal home (contract §2 /me): greeting, today's check-in, today's periods (teachers) with substitutions overlaid,
// pending substitutions, the latest leave request and the newest notices, plus links to every section.
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarDays, Megaphone, Replace } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, Stat } from "@/components/ui";
import { PORTAL_NAV } from "@/components/portal/nav";
import { PERIOD_TIMES, periodClass, subStatus, type Period, type Substitution } from "@/features/ops/logic";
import { clsLabel, dayOfIso } from "@/features/ops/shared";
import { t12 } from "@/features/people/checkins";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { CheckInCard } from "../leave/CheckInCard";
import { byNewest, statusTone, type PortalLeave } from "../leave/logic";
import { useStaffNotices } from "../notices/NoticesView";
import { todayIso } from "../shared";

type Slot = { id: string; period: number; time: string; classId: string; subject: string; room?: string; cover?: boolean; status?: string };

/** Today's periods: own `ops_periods` of the weekday, with the substitutions the teacher covers today laid over. */
export function todaySlots(periods: Period[], subs: Substitution[], today: string): Slot[] {
  const day = dayOfIso(today);
  const own: Slot[] = periods.filter((p) => p.day === day).map((p) => ({ id: p.id, period: Number(p.period), time: PERIOD_TIMES[Number(p.period) - 1] ?? "", classId: periodClass(p), subject: p.subject, room: p.room }));
  const covers: Slot[] = subs.filter((s) => s.date === today && subStatus(s.status) !== "Declined")
    .map((s) => ({ id: s.id, period: Number(s.period), time: PERIOD_TIMES[Number(s.period) - 1] ?? "", classId: s.classId, subject: s.subject, cover: true, status: subStatus(s.status) }));
  return [...own, ...covers].sort((a, b) => a.period - b.period || Number(!!a.cover) - Number(!!b.cover));
}

export function PortalHome() {
  const profile = useStaffProfile();
  if (profile.crew) return <CrewHome name={profile.name} designation={profile.designation} />;
  return <StaffHome />;
}

/** Drivers and attendants: their trips, bus attendance and leave live in the driver app; the portal has no crew pages yet. */
function CrewHome({ name, designation }: { name: string; designation: string }) {
  return <div className="space-y-5">
    <div><p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Staff portal</p>
      <h1 className="t-headline-lg">Hello, {name}</h1><p className="text-sm text-on-surface-variant">{designation}</p></div>
    <Card className="p-5"><EmptyState title="Bus crew pages are not on the web yet" hint="Trips, bus attendance, check-ins and leave requests for drivers and attendants are in the driver app. Contact the school office for anything else." /></Card>
  </div>;
}

function StaffHome() {
  const { name, designation, staffId, teaching, canAddStaff, ready } = useStaffProfile();
  const now = useNow(60_000);
  const today = todayIso(new Date(now));
  const periods = useCollection<Period>("ops_periods", teaching, [["teacherId", "==", staffId]] as const);
  const subs = useCollection<Substitution>("ops_substitutions", teaching, [["substituteTeacherId", "==", staffId]] as const);
  const leaves = useCollection<PortalLeave>("staff_leaves", !!staffId, [["staffId", "==", staffId]] as const);
  const notices = useStaffNotices();
  const mySubs = useMemo(() => subs.rows.filter((s) => s.substituteTeacherId === staffId), [subs.rows, staffId]);
  const slots = useMemo(() => todaySlots(periods.rows.filter((p) => p.teacherId === staffId), mySubs, today), [periods.rows, mySubs, staffId, today]);
  const pendingSubs = mySubs.filter((s) => subStatus(s.status) === "Assigned" && s.date >= today).length;
  const latestLeave = byNewest(leaves.rows.filter((l) => l.staffId === staffId))[0];
  const links = PORTAL_NAV.filter((item) => item.href !== "/me" && (!("teaching" in item) || teaching) && (!("addStaff" in item) || canAddStaff));
  const hour = new Date(now).getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Staff portal · {today}</p>
        <h1 className="t-headline-lg">{ready ? `${greeting}, ${name}` : "Loading…"}</h1>
        {designation && <p className="text-sm text-on-surface-variant">{designation}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><CheckInCard /></div>
        <Card role="group" aria-label="Leave status" className="p-5">
          <CardHeader className="p-0 pb-3" title="Leave status" actions={<Link href="/me/leave" className="text-sm font-medium text-secondary">Leave &amp; check-in</Link>} />
          {latestLeave ? (
            <div className="space-y-1 text-sm">
              <div className="flex items-center justify-between gap-2"><span className="font-medium">{latestLeave.type || "Leave"}</span><Badge tone={statusTone(latestLeave.status)}>{latestLeave.status}</Badge></div>
              <p className="text-on-surface-variant">{latestLeave.to && latestLeave.to !== latestLeave.from ? `${latestLeave.from} to ${latestLeave.to}` : latestLeave.from}{latestLeave.days ? ` · ${latestLeave.days} day${Number(latestLeave.days) === 1 ? "" : "s"}` : ""}</p>
              {latestLeave.decisionNote && <p className="text-xs text-on-surface-variant">{latestLeave.decisionNote}</p>}
            </div>
          ) : <p className="text-sm text-on-surface-variant">No leave requests yet.</p>}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <CardHeader className="p-0 pb-3" title="Today's periods" subtitle={teaching ? `${dayOfIso(today)} · ${slots.length} period${slots.length === 1 ? "" : "s"}` : undefined}
            actions={teaching && <Link href="/me/timetable" className="text-sm font-medium text-secondary">My timetable</Link>} />
          {!teaching ? <EmptyState title="Only teachers have a timetable" hint="Your check-in, leave, notices and profile are on this portal." />
            : !periods.ready ? <p className="text-sm text-on-surface-variant">Loading…</p>
            : slots.length === 0 ? <EmptyState title="No periods today" hint={dayOfIso(today) === "Sun" ? "Enjoy your Sunday." : "Nothing on your timetable for today."} />
            : (
              <ul aria-label="Today's periods" className="divide-y divide-outline-variant/60">
                {slots.map((s) => (
                  <li key={`${s.id}_${s.cover ? "c" : "p"}`} className="flex items-center gap-3 py-2.5 text-sm">
                    <span className="w-14 shrink-0 font-semibold text-secondary">P{s.period}</span>
                    <span className="w-20 shrink-0 text-on-surface-variant">{s.time ? t12(s.time) : "—"}</span>
                    <span className="min-w-0 flex-1 truncate"><span className="font-medium">{clsLabel(s.classId)}</span> · {s.subject}{s.room ? ` · ${s.room}` : ""}</span>
                    {s.cover && <Badge tone={s.status === "Accepted" ? "success" : "warning"}>{s.status === "Accepted" ? "Substitution" : "Substitution · to accept"}</Badge>}
                  </li>
                ))}
              </ul>
            )}
        </Card>
        <div className="space-y-4">
          {teaching && (
            <Link href="/me/substitutions" className="block">
              <Stat label="Pending substitutions" value={pendingSubs} sub={pendingSubs ? "Accept or decline" : "Nothing to cover"} subTone={pendingSubs ? "warning" : "neutral"} icon={<Replace size={16} />} />
            </Link>
          )}
          <Card className="p-5">
            <CardHeader className="p-0 pb-3" title="Latest notices" actions={<Link href="/me/notices" className="text-sm font-medium text-secondary">All notices{notices.unread ? ` (${notices.unread} new)` : ""}</Link>} />
            {notices.rows.length === 0 ? <p className="text-sm text-on-surface-variant">No notices yet.</p> : (
              <ul className="space-y-2">
                {notices.rows.slice(0, 3).map((n) => (
                  <li key={n.id} className="text-sm">
                    <Link href="/me/notices" className="flex items-start gap-2 hover:text-secondary"><Megaphone size={14} className="mt-1 shrink-0 text-outline" />
                      <span className="min-w-0"><span className={n.state?.read ? "" : "font-semibold"}>{n.title}</span><span className="block text-xs text-on-surface-variant">{(n.sentAt ?? "").slice(0, 10)}</span></span></Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-outline">Sections</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}><Card className="flex items-center gap-3 p-4 hover:bg-surface-container-low"><Icon size={20} className="text-secondary" /><span className="flex-1 font-medium">{label}</span><ArrowRight size={16} className="text-outline" /></Card></Link>
          ))}
        </div>
      </div>
      {teaching && <p className="flex items-center gap-1.5 text-xs text-outline"><CalendarDays size={12} />Periods come from the school timetable; substitutions the office assigns to you appear on the day.</p>}
    </div>
  );
}
