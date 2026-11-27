"use client";
// Staff portal home (contract §2 /me): greeting; for teachers the "now" card (live period, Mark attendance until that
// period's register is in), "Needs your attention" (substitutions to answer, begun periods without a register) and quick
// actions; today's check-in, today's periods with substitutions overlaid, pending substitutions, the latest leave request
// and the newest notices, plus links to every section. Mirrors the teacher app's home (modules/home).
import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, CalendarCheck, CalendarDays, CheckCircle2, ClipboardList, Coffee, FolderOpen, GraduationCap, Megaphone, Replace, type LucideIcon } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, ProgressBar, Stat } from "@/components/ui";
import { PORTAL_NAV } from "@/components/portal/nav";
import { subStatus, type AttRec, type Period, type Substitution } from "@/features/ops/logic";
import { clsLabel, dayOfIso } from "@/features/ops/shared";
import { t12 } from "@/features/people/checkins";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { CheckInCard } from "../leave/CheckInCard";
import { byNewest, statusTone, type PortalLeave } from "../leave/logic";
import { useStaffNotices } from "../notices/NoticesView";
import type { ClassDoc, MobilePolicy } from "../teaching";
import {
  attendanceHref, attentionItems, bellsOf, clockOf, markedFor, markedLabel, markedMap, nowInfo, teachingSlots, todaySlots, toMin,
  type AttentionItem, type Marked, type NowInfo, type Slot,
} from "./logic";

export { todaySlots };

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
  const { name, designation, staffId, teaching, canAddStaff, reviewer, ready } = useStaffProfile();
  const now = useNow(60_000);
  const { today, minute, hour } = clockOf(now);
  const periods = useCollection<Period>("ops_periods", teaching, [["teacherId", "==", staffId]] as const);
  const subs = useCollection<Substitution>("ops_substitutions", teaching, [["substituteTeacherId", "==", staffId]] as const);
  const school = useCollection<MobilePolicy>("school", teaching);
  const classes = useCollection<ClassDoc>("classes", teaching);
  const registers = useCollection<AttRec>("ops_attendance", teaching, [["date", "==", today]] as const);
  const leaves = useCollection<PortalLeave>("staff_leaves", !!staffId, [["staffId", "==", staffId]] as const);
  const notices = useStaffNotices();
  const policy = school.rows.find((row) => row.id === "mobile");
  const bells = useMemo(() => bellsOf(policy), [policy]);
  const mySubs = useMemo(() => subs.rows.filter((s) => s.substituteTeacherId === staffId), [subs.rows, staffId]);
  const slots = useMemo(() => todaySlots(periods.rows.filter((p) => p.teacherId === staffId), mySubs, today, bells), [periods.rows, mySubs, staffId, today, bells]);
  const marked = useMemo(() => markedMap(registers.rows, today), [registers.rows, today]);
  const working = dayOfIso(today) !== "Sun";
  const info = nowInfo(working ? teachingSlots(slots) : [], bells, minute);
  const classTeacherOf = classes.rows.filter((c) => c.classTeacherId === staffId && c.deleted !== true).map((c) => c.id).sort();
  const attention = teaching ? attentionItems({ today, minute, slots, subs: mySubs, marked, started: working && info.started, classTeacherOf, label: clsLabel, time: t12 }) : [];
  const pendingSubs = mySubs.filter((s) => subStatus(s.status) === "Assigned" && s.date >= today).length;
  const latestLeave = byNewest(leaves.rows.filter((l) => l.staffId === staffId))[0];
  const links = PORTAL_NAV.filter((item) => item.href !== "/me" && (!("teaching" in item) || teaching) && (!("addStaff" in item) || canAddStaff) && (!("reviewer" in item) || reviewer));
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">Staff portal · {today}</p>
        <h1 className="t-headline-lg">{ready ? `${greeting}, ${name}` : "Loading…"}</h1>
        {designation && <p className="text-sm text-on-surface-variant">{designation}</p>}
      </div>

      {teaching && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><NowCard info={info} today={today} marked={marked} ready={periods.ready} /></div>
          <AttentionCard items={attention} ready={periods.ready && registers.ready} />
        </div>
      )}

      {teaching && <QuickActions />}

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
                {slots.map((s) => <PeriodRow key={`${s.id}_${s.cover ? "c" : "p"}`} s={s} today={today} begun={working && toMin(s.from) <= minute} m={markedFor(marked, s.classId, s.period)} />)}
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
        <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {links.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="block h-full"><Card className="flex h-full items-center gap-3 p-4 hover:bg-surface-container-low"><Icon size={20} className="text-secondary" /><span className="flex-1 font-medium">{label}</span><ArrowRight size={16} className="text-outline" /></Card></Link>
          ))}
        </div>
      </div>
      {teaching && <p className="flex items-center gap-1.5 text-xs text-outline"><CalendarDays size={12} />Periods come from the school timetable; substitutions the office assigns to you appear on the day.</p>}
    </div>
  );
}

function PeriodRow({ s, today, begun, m }: { s: Slot; today: string; begun: boolean; m: Marked | null }) {
  const takes = !s.cover || s.status === "Accepted";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
      <span className="w-10 shrink-0 font-semibold text-secondary sm:w-14">P{s.period}</span>
      <span className="w-16 shrink-0 text-on-surface-variant sm:w-20">{s.time ? t12(s.time) : "—"}</span>
      <span className="min-w-0 flex-1 truncate"><span className="font-medium">{clsLabel(s.classId)}</span> · {s.subject}{s.room ? ` · ${s.room}` : ""}</span>
      {s.cover && <Badge tone={s.status === "Accepted" ? "success" : "warning"}>{s.status === "Accepted" ? "Substitution" : "Substitution · to accept"}</Badge>}
      {takes && m && <Badge tone="success">Marked · {m.present}/{m.total}</Badge>}
      {takes && !m && begun && <Link href={attendanceHref(s.classId, s.period, today)}><Badge tone="danger">Not marked</Badge></Link>}
    </li>
  );
}

/** The "now" card (the app's NowCard): the live period with progress and Mark attendance — or, once that period's register
 * is in, "Attendance marked · x/y present" with View — else the break / no class state and the next period. */
function NowCard({ info, today, marked, ready }: { info: NowInfo; today: string; marked: Map<string, Marked>; ready: boolean }) {
  const { live, next, brk } = info;
  const nextRow = next && (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-outline-variant/60 px-3 py-2.5 text-sm">
      <ArrowRight size={14} className="shrink-0 text-secondary" />
      <span className="min-w-0 flex-1 truncate"><span className="font-semibold">Next:</span> Period {next.period} · {clsLabel(next.classId)} {next.subject}{next.room ? ` (${next.room})` : ""}</span>
      <span className="shrink-0 font-semibold text-secondary">{t12(next.from)}</span>
    </div>
  );
  if (!ready) return <Card className="h-full p-5"><p className="text-sm text-on-surface-variant">Loading…</p></Card>;
  if (!live) {
    return (
      <Card role="region" aria-label="Now" className="h-full p-5">
        <Badge tone="warning">{brk ? brk.label.toUpperCase() : info.started ? "NO CLASS RIGHT NOW" : "SCHOOL DAY NOT STARTED"}</Badge>
        <div className="mt-3 flex items-center gap-2">{brk && <Coffee size={20} className="text-warning" />}<h2 className="t-headline-md">{brk ? `Break until ${t12(brk.to)}` : "No class in progress"}</h2></div>
        <p className="mt-1 text-sm text-on-surface-variant">{next ? `Your next class starts at ${t12(next.from)}.` : "You have no more periods today."}</p>
        {nextRow}
      </Card>
    );
  }
  const m = markedFor(marked, live.classId, live.period);
  const href = attendanceHref(live.classId, live.period, today);
  const pct = info.length ? Math.round((info.done / info.length) * 100) : 0;
  return (
    <Card role="region" aria-label="Now" className="h-full p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="brand"><span className="size-1.5 rounded-full bg-secondary" />NOW · PERIOD {live.period}</Badge>
        <span className="rounded-full border border-outline-variant px-2.5 py-0.5 text-xs font-semibold text-secondary">{t12(live.from)} – {t12(live.to)}</span>
        {live.cover && <Badge tone="success">Substitution</Badge>}
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div className="min-w-0"><h2 className="t-headline-md truncate">{clsLabel(live.classId)}</h2><p className="text-sm text-on-surface-variant">{live.subject}</p></div>
        {live.room && <span className="shrink-0 rounded-full border border-outline-variant px-2.5 py-0.5 text-xs font-semibold text-secondary">{live.room}</span>}
      </div>
      <div className="mt-4 rounded-lg bg-surface-container-low p-3">
        <div className="mb-2 flex items-center justify-between gap-2 text-xs"><span className="text-on-surface-variant">Period progress</span><span className="font-semibold">{info.done} of {info.length} mins <span className="text-secondary">({pct}%)</span></span></div>
        <ProgressBar value={pct} />
      </div>
      <div className="mt-4">
        {m ? (
          <div className="flex items-center gap-2 rounded-lg bg-success-container px-3 py-2.5 text-sm text-success">
            <CheckCircle2 size={18} className="shrink-0" />
            <span className="min-w-0 flex-1 font-semibold">Attendance marked · {markedLabel(m)}</span>
            <Link href={href} className="shrink-0 font-semibold text-secondary hover:underline" aria-label={`View attendance of ${clsLabel(live.classId)} period ${live.period}`}>View</Link>
          </div>
        ) : (
          <Link href={href} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded bg-secondary px-4 text-sm font-semibold text-on-secondary shadow-card hover:bg-secondary-container">
            <CalendarCheck size={16} />Mark attendance
          </Link>
        )}
      </div>
      {nextRow}
    </Card>
  );
}

function AttentionCard({ items, ready }: { items: AttentionItem[]; ready: boolean }) {
  return (
    <Card role="region" aria-label="Needs your attention" className="flex h-full flex-col p-5">
      <CardHeader className="p-0 pb-3" title="Needs your attention" actions={<Link href="/me/assignments" className="text-sm font-medium text-secondary">Assignments</Link>} />
      {!ready ? <p className="text-sm text-on-surface-variant">Loading…</p> : !items.length ? (
        <div className="flex items-center gap-3 rounded-lg bg-success-container/60 p-3">
          <CheckCircle2 size={20} className="shrink-0 text-success" />
          <div><p className="font-semibold">All caught up</p><p className="text-xs text-on-surface-variant">Nothing is waiting for you right now.</p></div>
        </div>
      ) : (
        <ul aria-label="Needs your attention" className="-mx-2 divide-y divide-outline-variant/60">
          {items.map((i) => (
            <li key={i.id}>
              <Link href={i.href} className="flex items-center gap-3 rounded px-2 py-2.5 hover:bg-surface-container-low">
                <span className={`grid size-8 shrink-0 place-items-center rounded-lg ${i.tone === "warning" ? "bg-warning-container text-warning" : "bg-error-container text-error"}`}>
                  {i.kind === "sub" ? <Replace size={16} /> : <CalendarCheck size={16} />}
                </span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{i.title}</span><span className="block truncate text-xs text-on-surface-variant">{i.sub}</span></span>
                <ArrowRight size={14} className="shrink-0 text-outline" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const QUICK: { href: string; label: string; icon: LucideIcon; tint: string }[] = [
  { href: "/me/attendance", label: "Attendance", icon: CalendarCheck, tint: "bg-info-container text-secondary" },
  { href: "/me/assignments", label: "Assignments", icon: ClipboardList, tint: "bg-warning-container text-warning" },
  { href: "/me/marks", label: "Enter marks", icon: GraduationCap, tint: "bg-tertiary-container/15 text-tertiary" },
  { href: "/me/resources", label: "Resources", icon: FolderOpen, tint: "bg-success-container text-success" },
];

/** Four equal cards (the app's quick actions: one fixed size whatever the label). */
function QuickActions() {
  return (
    <nav aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {QUICK.map(({ href, label, icon: Icon, tint }) => (
        <Link key={href} href={href} className="block h-full">
          <Card className="flex h-28 flex-col items-center justify-center gap-2 p-3 text-center transition-colors hover:bg-surface-container-low">
            <span className={`grid size-10 place-items-center rounded-xl ${tint}`}><Icon size={20} /></span>
            <span className="line-clamp-2 text-sm font-semibold leading-tight">{label}</span>
          </Card>
        </Link>
      ))}
    </nav>
  );
}
