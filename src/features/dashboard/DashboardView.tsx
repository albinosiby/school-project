"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Bus, Check, CheckCheck, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Download, MessageSquare, Rocket, TrendingUp, UserX, UserCheck, X, AlertTriangle } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Modal, ProgressBar, Select, Tabs, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { inr } from "@/lib/format";
import { GROUPS, groupOfGrade } from "@/features/admissions/types";
import { DashHeader, useSetupProgress } from "./DashHeader";
import { ReasonModal, useApprovalActions } from "./approvals-shared";
import {
  catOf, downloadCsv, errMsg, useHydrated, eventsOn, fmtDay, fmtSubmitted, KIND_LABEL, KIND_ORDER, MON, MONTHS, monthGrid, parse, pctOf, TODAY, upcomingEvents, useApprovals, useEvents,
  type Alert, type Notif, type Staff, nowLocal } from "./data";

type Prefs = { id: string; bannerDismissed: boolean };
type Student = { id: string; status: string };
type AttRec = { id: string; date: string; classId: string; period: number; total: number; marks?: Record<string, string> };
type Payment = { id: string; amount: number; date: string };
type Invoice = { id: string; balance: number; status: string };
type Enq = { id: string };
type App = { id: string; grade: string; status: string; testSlotId?: string; interviewSlotId?: string; panelStatus?: string | null };
type Seat = { id: string; grade: string; capacity: number };

/** dash_prefs/main may be missing for older schools: create it instead of failing the update */
export function useDashPrefs() {
  const c = useCollection<Prefs>("dash_prefs");
  const save = (patch: Partial<Prefs>) => (c.rows.some((r) => r.id === "main") ? c.update("main", patch) : c.create({ id: "main", bannerDismissed: false, ...patch }));
  return { ...c, prefs: c.rows.find((r) => r.id === "main"), save };
}

/* ---------------- onboarding banner ---------------- */
function Banner() {
  const { steps, done, total, pct } = useSetupProgress();
  const { prefs, save, ready: r0 } = useDashPrefs();
  const ready = useHydrated() && r0;
  const toast = useToast();
  if (!ready || prefs?.bannerDismissed || !steps.length || done === total) return null;
  const current = steps.find((s) => !s.done);
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-start gap-4">
        <span className="grid size-11 place-items-center rounded-lg bg-secondary text-on-secondary"><Rocket size={20} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Academic Year Onboarding Setup</h2>
            <Badge tone="brand">Step {current?.no ?? total} of {total} Active</Badge><span className="text-sm text-outline">• {pct}% complete</span></div>
          <p className="mt-1 text-on-surface-variant">{done} phase{done === 1 ? "" : "s"} completed. {current ? `Complete ${current.title} to continue.` : ""}</p>
        </div>
        <Link href="/setup"><Button size="sm">Resume <ArrowRight size={14} /></Button></Link>
        <button aria-label="Dismiss setup banner" className="cursor-pointer rounded p-1 text-outline hover:bg-surface-container"
          onClick={async () => { try { await save({ bannerDismissed: true }); toast("Setup banner dismissed — you can restore it from the Setup Wizard"); } catch (e) { toast(errMsg(e, "Could not dismiss"), "error"); } }}><X size={16} /></button>
      </div>
      <ProgressBar value={pct} className="mt-4" />
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {steps.map((s) => {
          const cur = s.id === current?.id;
          return <Link key={s.id} href="/setup" className={cn("flex items-center justify-between gap-1 rounded border px-2.5 py-2 text-xs font-medium",
            cur ? "border-secondary bg-info-container font-semibold text-secondary" : s.done ? "border-outline-variant/60 text-on-surface" : "border-outline-variant/40 text-outline")}>
            <span className="truncate">{s.no}. {s.short}</span>{s.done ? <Check size={12} className="text-success" /> : cur ? <span className="size-2 rounded-full bg-secondary" /> : null}</Link>;
        })}
      </div>
    </Card>
  );
}

/* ---------------- KPI strip (all derived from live collections) ---------------- */
const K = ({ label, icon, value, unit, tag, tone, href }: { label: string; icon: React.ReactNode; value: React.ReactNode; unit?: string; tag?: string; tone?: "danger" | "success" | "neutral" | "warning"; href?: string }) => {
  const body = (
    <Card className={cn("h-full p-4", href && "hover:bg-surface-container-low")}><div className="flex items-start justify-between gap-2 text-xs text-on-surface-variant"><span>{label}</span>{icon}</div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2"><span className="t-headline-md whitespace-nowrap !text-[24px] !leading-8">{value}{unit && <span className="ml-1 text-sm font-normal text-outline">{unit}</span>}</span>
        {tag && <Badge tone={tone}>{tag}</Badge>}</div></Card>);
  return href ? <Link href={href} className="block">{body}</Link> : body;
};

function Kpis() {
  const { rows: students } = useCollection<Student>("students");
  const { rows: staff } = useCollection<Staff>("staff");
  const { rows: att } = useCollection<AttRec>("ops_attendance");
  const { rows: pays } = useCollection<Payment>("fee_payments");
  const { rows: invs } = useCollection<Invoice>("fee_invoices");
  const { rows: enq } = useCollection<Enq>("adm_enquiries");
  const { rows: apps } = useCollection<App>("adm_applications");
  const { rows: approvals } = useApprovals();
  const active = students.filter((s) => s.status === "Active").length;
  // today's roll: one record per class (the day-level period 0 record wins, else the earliest period)
  const byClass = new Map<string, AttRec>();
  att.filter((r) => r.date === TODAY).forEach((r) => { const c = byClass.get(r.classId); if (!c || r.period < c.period) byClass.set(r.classId, r); });
  let total = 0, absent = 0, notIn = 0;
  byClass.forEach((r) => { const v = Object.values(r.marks ?? {}); total += Number(r.total) || 0; absent += v.filter((x) => x === "A").length; notIn += v.filter((x) => x === "A" || x === "E").length; });
  const attPct = total ? ((total - notIn) / total) * 100 : null;
  // fee_payments.date is the LOCAL yyyy-mm-dd (fees todayIso), same as TODAY
  const feesToday = pays.filter((p) => p.date === TODAY).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const overdue = invs.filter((i) => i.status === "Overdue");
  const overdueAmt = overdue.reduce((a, i) => a + (Number(i.balance) || 0), 0);
  const onLeave = staff.filter((s) => s.status === "On leave").length;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const enrolled = apps.filter((a) => a.status === "enrolled").length;
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <K label="Today's Attendance" href="/attendance" icon={<UserCheck size={16} className="text-success" />} value={attPct === null ? "—" : `${attPct.toFixed(1)}%`}
        tag={attPct === null ? (active ? "Not marked yet" : "No students") : `${absent} Absent`} tone={attPct === null ? "neutral" : absent ? "danger" : "success"} />
      <K label="Fee Collections" href="/fees" icon={<CircleDollarSign size={16} />} value={inr(feesToday)} tag="Today" tone="success" />
      <K label="Fees Overdue" href="/fees" icon={<AlertTriangle size={16} className="text-error" />} value={inr(overdueAmt)} tag={`${overdue.length} Account${overdue.length === 1 ? "" : "s"}`} tone={overdue.length ? "danger" : "success"} />
      <K label="Admissions Enquiries" href="/admissions" icon={<TrendingUp size={16} className="text-secondary" />} value={enq.length} tag={`${enrolled} Enrolled`} tone="success" />
      <K label="Staff on Leave" href="/staff" icon={<UserX size={16} className="text-warning" />} value={onLeave} unit={`/${staff.length}`} tag={`${staff.length - onLeave} On duty`} tone={onLeave ? "warning" : "success"} />
      <K label="Pending Approvals" href="/approvals" icon={<ClipboardList size={16} />} value={pending} tag={pending ? "Action needed" : "All clear"} tone={pending ? "danger" : "success"} />
    </div>
  );
}

/* ---------------- admissions pipeline (adm_enquiries / adm_applications / adm_seats) ---------------- */
const AFTER_TEST = ["test_scheduled", "tested", "shortlisted", "waitlisted", "offered", "enrolled"];
function Pipeline() {
  const enq = useCollection<Enq>("adm_enquiries");
  const apps = useCollection<App>("adm_applications");
  const seats = useCollection<Seat>("adm_seats");
  const toast = useToast();
  const ready = useHydrated() && enq.ready && apps.ready && seats.ready;
  if (!ready) return <Card className="mb-6 min-h-64" />;
  const a = apps.rows;
  const exam = a.filter((x) => x.testSlotId || AFTER_TEST.includes(x.status)).length;
  const interview = a.filter((x) => x.interviewSlotId || x.panelStatus || x.status === "offered" || x.status === "enrolled").length;
  const enrolledN = a.filter((x) => x.status === "enrolled").length;
  const steps = [
    { k: "STEP 1: ENQUIRIES", n: enq.rows.length, base: enq.rows.length, note: "Walk-ins, calls & web enquiries" },
    { k: "STEP 2: ENTRANCE TEST", n: exam, base: enq.rows.length, note: "Scheduled for or sat the test" },
    { k: "STEP 3: INTERVIEW", n: interview, base: exam, note: "Interview / panel stage" },
    { k: "STEP 4: ENROLLED", n: enrolledN, base: interview, note: "Seat confirmed" },
  ];
  const capacity = GROUPS.map((g) => {
    const cap = seats.rows.filter((s) => groupOfGrade(s.grade) === g.id).reduce((t, s) => t + (Number(s.capacity) || 0), 0);
    const enrolled = a.filter((x) => x.status === "enrolled" && groupOfGrade(x.grade) === g.id).length;
    return { label: `${g.label} (${g.sub})`, enrolled, cap };
  }).filter((c) => c.cap > 0 || c.enrolled > 0);
  const enrolled = capacity.reduce((t, c) => t + c.enrolled, 0), cap = capacity.reduce((t, c) => t + c.cap, 0);
  const tones = ["brand", "success", "brand", "muted"] as const;
  const conv = (n: number, base: number) => pctOf(n, base).toFixed(1);
  return (
    <Card className="mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3"><h2 className="t-headline-md !text-[18px]">Admissions Pipeline & Conversion</h2></div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!enq.rows.length && !a.length} onClick={() => { downloadCsv("admissions-funnel.csv", [["Stage", "Count", "Conversion %"], ...steps.map((s) => [s.k.replace(/^STEP \d: /, ""), s.n, conv(s.n, s.base)])]); toast("Funnel exported"); }}><Download size={14} />Export Funnel</Button>
          <Link href="/admissions"><Button size="sm" variant="secondary">Manage Inquiries</Button></Link></div>
      </div>
      <p className="mt-1 text-on-surface-variant">Live status of prospective candidates across intake stages.</p>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {steps.map((s, i) => (
          <div key={s.k} className={cn("rounded-lg border p-4", i === 3 ? "border-secondary/30 bg-info-container/60" : "border-outline-variant/60 bg-surface-container-low")}>
            <p className={cn("font-mono text-[11px] tracking-wide", i === 3 ? "text-secondary" : "text-outline")}>{s.k}</p>
            <div className="mt-2 flex items-baseline justify-between"><span className="t-headline-md !text-2xl">{s.n}</span>{i > 0 && <span className="font-mono text-xs text-success">{conv(s.n, s.base)}%</span>}</div>
            <p className="mt-2 text-xs text-on-surface-variant">{s.note}</p>
          </div>))}
      </div>
      <div className="mt-6 flex items-baseline justify-between"><h3 className="font-semibold">Grade Intake Capacity Utilization</h3>{cap > 0 && <span className="font-mono text-xs text-outline">{enrolled} / {cap} Total Seats</span>}</div>
      {capacity.length === 0 ? <p className="mt-3 rounded-lg bg-surface-container-low p-3 text-sm text-outline">No intake seats configured yet. <Link href="/admissions/seats" className="font-semibold text-secondary">Set up seats</Link></p> : (
        <div className="mt-3 space-y-3">
          {capacity.map((c, i) => { const pct = Math.round(pctOf(c.enrolled, c.cap)); return (
            <div key={c.label}><div className="flex justify-between gap-2 text-sm"><span>{c.label}</span><span className="shrink-0 font-mono text-xs">{c.enrolled} / {c.cap} Enrolled ({pct}%)</span></div>
              <ProgressBar value={pct} tone={tones[i % 4]} className="mt-1" /></div>); })}
        </div>)}
    </Card>
  );
}

/* ---------------- approvals inbox ---------------- */
function ApprovalsInbox() {
  const { rows, approve, reject } = useApprovalActions();
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const pending = rows.filter((r) => r.status === "pending");
  const view = pending.filter((r) => tab === "all" || r.kind === tab);
  const shown = view.slice(0, 5);
  const tabs = [{ id: "all", label: "All", count: pending.length }, ...KIND_ORDER.map((k) => ({ id: k, label: KIND_LABEL[k], count: pending.filter((r) => r.kind === k).length }))];
  const selIds = sel.filter((id) => pending.some((p) => p.id === id));
  return (
    <Card>
      <CardHeader title={<span className="flex flex-wrap items-center gap-3">Administrative Approvals Inbox <Badge tone={pending.length ? "danger" : "success"}>{pending.length} Pending Action</Badge></span>}
        subtitle="Statutory requests requiring Head of Institution authorization."
        actions={<Button variant="outline" size="sm" disabled={!selIds.length} onClick={async () => { await approve(selIds); setSel([]); }}><CheckCheck size={14} />Batch Approve{selIds.length ? ` (${selIds.length})` : ""}</Button>} />
      <div className="px-5 pb-3"><Tabs items={tabs} value={tab} onChange={(t) => { setTab(t); setSel([]); }} /></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead><tr className="border-y border-outline-variant/60 bg-surface-container-low text-[11px]">
            <th className="w-10 py-2.5 pl-5"><Checkbox aria-label="Select all" checked={shown.length > 0 && shown.every((r) => sel.includes(r.id))}
              onChange={(e) => setSel(e.target.checked ? shown.map((r) => r.id) : [])} /></th>
            {["Requester", "Category & Scope", "Remarks & Justification", "Submitted", "Action"].map((h) => <th key={h} className="px-3 py-2.5 t-label-caps !text-[11px] text-on-surface-variant">{h}</th>)}</tr></thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-outline-variant/40 last:border-0">
                <td className="py-3 pl-5"><Checkbox aria-label={`Select ${r.requester}`} checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
                <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={r.requester} size={32} /><div><p className="font-semibold">{r.requester}</p><p className="text-xs text-outline">{r.ref}</p></div></div></td>
                <td className="px-3 py-3"><Badge tone={r.kind === "leave" ? "warning" : r.kind === "fee" ? "success" : r.kind === "pass" ? "danger" : "brand"}>{r.title}</Badge><p className="mt-1 max-w-[220px] truncate font-mono text-xs text-outline" title={r.detail}>{r.detail}</p></td>
                <td className="max-w-[220px] px-3 py-3 text-xs text-on-surface-variant">{r.remark}</td>
                <td className="whitespace-nowrap px-3 py-3 text-xs text-on-surface-variant">{fmtSubmitted(r.submitted)}</td>
                <td className="px-3 py-3"><div className="flex gap-2"><Button size="sm" onClick={() => approve([r.id])}>Approve</Button><Button size="sm" variant="outline" className="!text-error" onClick={() => setRejecting([r.id])}>Reject</Button></div></td>
              </tr>))}
          </tbody>
        </table>
        {shown.length === 0 && <EmptyState title="All caught up" hint="No pending approvals in this category." />}
      </div>
      <div className="flex items-center justify-between px-5 py-3 text-sm text-on-surface-variant">
        <span>Showing {shown.length} of {view.length} critical approvals</span>
        <Link href="/approvals" className="inline-flex items-center gap-1 font-semibold text-secondary">Open Complete Approvals Desk <ArrowRight size={14} /></Link>
      </div>
      <ReasonModal ids={rejecting} title="Reject request" onClose={() => setRejecting(null)} onSubmit={async (ids, reason) => { await reject(ids, reason); setSel([]); }} />
    </Card>
  );
}

/* ---------------- urgent alerts ---------------- */
function Alerts() {
  const { rows, update } = useCollection<Alert>("dash_alerts");
  const { rows: staff } = useCollection<Staff>("staff");
  const { create: notify } = useCollection<Notif>("notifications");
  const toast = useToast();
  const [assign, setAssign] = useState<Alert | null>(null);
  const [sub, setSub] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); return true; } catch (e) { toast(errMsg(e), "error"); return false; } finally { setBusy(false); }
  };
  const open = rows.filter((a) => a.status === "open").length;
  const teachers = staff.filter((s) => s.status === "Active" && /PGT|TGT|PRT|HOD/.test(s.role));
  const icon = { substitute: UserX, fee: CircleDollarSign, transit: Bus } as const;
  const tint = { substitute: "border-warning/30 bg-warning-container/60", fee: "border-error/20 bg-error-container/50", transit: "border-outline-variant/60 bg-surface-container-low" } as const;
  return (
    <Card className="mb-6 p-5">
      <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 font-semibold"><span className="size-2.5 rounded-full bg-error" />Urgent Operational Alerts</h2><span className="font-mono text-xs text-outline">{open} Action{open === 1 ? "" : "s"}</span></div>
      <div className="space-y-3">
        {rows.length === 0 && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-outline">No operational alerts right now.</p>}
        {rows.map((a) => { const I = icon[a.kind]; const res = a.status === "resolved"; return (
          <div key={a.id} className={cn("rounded-lg border p-3", res ? "border-success/30 bg-success-container/50" : tint[a.kind])}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2"><I size={16} className={res ? "text-success" : "text-on-surface-variant"} /><span className="text-xs font-bold tracking-wide">{a.title}</span></div>
              <span className="font-mono text-[11px] text-outline">{a.tag}</span></div>
            <p className="mt-1.5 text-sm">{res ? (a.kind === "substitute" ? `${a.body} Covered by ${a.substitute}.` : a.kind === "fee" ? `WhatsApp reminders queued for ${a.tag} (simulated).` : `${a.body} (acknowledged)`) : a.body}</p>
            {!res && <div className="mt-2 flex justify-end">
              {a.kind === "substitute" && <Button size="sm" className="!bg-warning" disabled={busy} onClick={() => { setAssign(a); setSub(""); }}>Assign <ArrowRight size={12} /></Button>}
              {a.kind === "fee" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(async () => { await update(a.id, { status: "resolved" }); await notify({ category: "finance", title: "Fee Reminder", body: `WhatsApp reminders dispatched for ${a.tag} (simulated)`, createdAt: nowLocal(), read: false } as never); }, `WhatsApp reminders queued for ${a.tag} (simulated)`)}><MessageSquare size={13} />WhatsApp</Button>}
              {a.kind === "transit" && <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => update(a.id, { status: "resolved" }), "Alert acknowledged")}>Acknowledge</Button>}</div>}
          </div>); })}
      </div>
      <Modal open={!!assign} onClose={() => setAssign(null)} title="Assign substitute" subtitle={assign?.body}
        footer={<><Button variant="outline" onClick={() => setAssign(null)}>Cancel</Button>
          <Button disabled={!sub || busy} onClick={async () => {
            const t = teachers.find((s) => s.id === sub); const al = assign;
            if (!t || !al) return;
            const ok = await run(async () => {
              await update(al.id, { status: "resolved", substitute: t.name });
              await notify({ category: "urgent", title: "Substitute assigned", body: `${t.name} will cover ${al.tag} — ${al.body}`, createdAt: nowLocal(), read: false } as never);
            }, `${t.name} assigned as substitute`);
            if (ok) setAssign(null);
          }}>Assign substitute</Button></>}>
        <Field label="Available teaching staff" required hint={teachers.length ? undefined : "No active teaching staff found — add staff under Staff & HR."}><Select value={sub} onChange={(e) => setSub(e.target.value)}><option value="">Select a teacher…</option>
          {teachers.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department} ({s.role})</option>)}</Select></Field>
      </Modal>
    </Card>
  );
}

/* ---------------- academic milestones ---------------- */
function Milestones() {
  const { rows: events } = useEvents();
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [ym, setYm] = useState(() => { const d = parse(TODAY); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [pick, setPick] = useState<string | null>(null);
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const published = events.filter((e) => e.status === "published");
  const list = pick ? eventsOn(published, pick) : upcomingEvents(published).slice(0, 5);
  const shift = (d: number) => setYm((x) => { const n = x.m + d; return n < 0 ? { y: x.y - 1, m: 11 } : n > 11 ? { y: x.y + 1, m: 0 } : { ...x, m: n }; });
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2">
        <div><h2 className="font-semibold">Academic Milestones</h2><p className="text-xs text-outline">{MONTHS[ym.m]!.slice(0, 3)} {ym.y}</p></div>
        <div className="flex rounded bg-surface-container p-0.5 text-xs font-semibold" role="tablist">
          {(["month", "agenda"] as const).map((m) => <button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("cursor-pointer rounded px-3 py-1 capitalize", mode === m ? "bg-surface-container-lowest shadow-card" : "text-on-surface-variant")}>{m}</button>)}</div>
      </div>
      {mode === "month" && (<>
        <div className="mt-3 flex items-center justify-between text-sm font-semibold"><span>{MONTHS[ym.m]} {ym.y}</span>
          <span><button aria-label="Previous month" onClick={() => shift(-1)} className="cursor-pointer p-1"><ChevronLeft size={16} /></button><button aria-label="Next month" onClick={() => shift(1)} className="cursor-pointer p-1"><ChevronRight size={16} /></button></span></div>
        <div className="mt-2 grid grid-cols-7 gap-y-1 text-center text-xs">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="py-1 font-mono text-outline">{d}</span>)}
          {grid.map((c) => { const evs = eventsOn(published, c.iso); const isToday = c.iso === TODAY, isPick = c.iso === pick; return (
            <button key={c.iso} onClick={() => setPick(isPick ? null : c.iso)} aria-label={`${fmtDay(c.iso)}${evs.length ? `, ${evs.length} events` : ""}`}
              className={cn("relative mx-auto grid size-8 cursor-pointer place-items-center rounded-lg", !c.inMonth && "text-outline/40", c.dow > 4 && c.inMonth && "text-error",
                isToday && "bg-secondary font-bold !text-on-secondary", isPick && !isToday && "bg-info-container font-bold !text-secondary")}>
              {c.day}{evs.length > 0 && <span className={cn("absolute bottom-0.5 size-1 rounded-full", catOf(evs[0]!.category).dot, isToday && "!bg-white")} />}</button>); })}
        </div>
      </>)}
      <div className="mt-4 space-y-2">
        {pick && <p className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">Events on {fmtDay(pick)}<button className="cursor-pointer text-secondary" onClick={() => setPick(null)}>Clear</button></p>}
        {list.length === 0 && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-outline">No events {pick ? "on this day" : "scheduled"}.</p>}
        {list.map((e) => { const d = parse(e.start); return (
          <Link key={e.id} href="/calendar" className="flex items-center gap-3 rounded-lg bg-surface-container-low p-2.5 hover:bg-surface-container">
            <span className={cn("grid w-11 shrink-0 place-items-center rounded py-1 text-center", catOf(e.category).chip)}><span className="text-[10px] font-bold">{MON[d.getMonth()]}</span><span className="text-base font-bold leading-4">{String(d.getDate()).padStart(2, "0")}</span></span>
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{e.title}</span><span className="block truncate text-xs text-outline">{e.desc || e.venue}</span></span></Link>); })}
      </div>
    </Card>
  );
}

export function DashboardView() {
  return (
    <>
      <DashHeader active="dashboard" />
      <Banner />
      <Kpis />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0"><Pipeline /><ApprovalsInbox /></div>
        <div className="min-w-0"><Alerts /><Milestones /></div>
      </div>
    </>
  );
}
