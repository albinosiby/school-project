"use client";
import Link from "next/link";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { useMemo, useState } from "react";
import { ArrowRight, Bus, CheckCheck, ChevronLeft, ChevronRight, CircleDollarSign, ClipboardList, Download, MessageSquare, TrendingUp, UserX, UserCheck, AlertTriangle } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, EmptyState, Field, Modal, ProgressBar, Select, Tabs, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { inr } from "@/lib/format";
import { GROUPS, groupOfGrade } from "@/features/admissions/types";
import { isTeachingStaff } from "@/features/people/staffProfiles";
import { DashHeader } from "./DashHeader";
import { ReasonModal, useApprovalActions } from "./approvals-shared";
import {
  catOf, downloadCsv, errMsg, useHydrated, eventsOn, fmtDay, fmtSubmitted, KIND_LABEL, KIND_ORDER, MON, MONTHS, monthGrid, parse, pctOf, upcomingEvents, useApprovals, useEvents,
  type Alert, type Notif, type Staff, nowLocal } from "./data";
import { admittedStudents, checkedInStaff, openAdmissionEnquiries, latestDayRecords, dayAttendance, deriveAlerts, isOverdue, staffOnLeave, type AttRec, type BusLite, type InvoiceLite, type LeaveLite, type LiveAlert, type PeriodLite, type SubLite } from "./logic";

type Student = { id: string; status?: string; deleted?: boolean; admissionNumber?: string; admissionDate?: string; offerId?: string; grade?: string; section?: string; classId?: string };
type Payment = { id: string; amount: number; date: string };
type Invoice = InvoiceLite;
type Enq = { id: string; stage?: string; studentId?: string; applicationId?: string };
type App = { id: string; enquiryId?: string; studentId?: string; grade: string; status: string; testSlotId?: string; interviewSlotId?: string; panelStatus?: string | null };
type Seat = { id: string; grade: string; capacity: number };

/* ---------------- KPI strip (all derived from live collections) ---------------- */
const K = ({ label, icon, value, unit, tag, tone, href }: { label: string; icon: React.ReactNode; value: React.ReactNode; unit?: string; tag?: string; tone?: "danger" | "success" | "neutral" | "warning"; href?: string }) => {
  const body = (
    <Card className={cn("h-full p-4", href && "hover:bg-surface-container-low")}><div className="flex items-start justify-between gap-2 text-xs text-on-surface-variant"><span>{label}</span>{icon}</div>
      <div className="mt-4 flex flex-wrap items-end justify-between gap-2"><span className="t-headline-md whitespace-nowrap !text-[24px] !leading-8">{value}{unit && <span className="ml-1 text-sm font-normal text-outline">{unit}</span>}</span>
        {tag && <Badge tone={tone}>{tag}</Badge>}</div></Card>);
  return href ? <Link href={href} className="block">{body}</Link> : body;
};

function Kpis() {
  const { date: TODAY } = useSchoolClock();
  const { rows: students } = useCollection<Student>("students");
  const { rows: staff } = useCollection<Staff>("staff");
  const { rows: att } = useCollection<AttRec>("ops_attendance", true, [["date", "==", TODAY]]);
  const { rows: pays } = useCollection<Payment>("fee_payments", true, [["date", "==", TODAY]]);
  const { rows: invs } = useCollection<Invoice>("fee_invoices", true, [["balance", ">", 0]]);
  const { rows: enq } = useCollection<Enq>("adm_enquiries");
  const { rows: apps } = useCollection<App>("adm_applications");
  const { rows: leaves } = useCollection<LeaveLite>("staff_leaves");
  const { rows: approvals } = useApprovals();
  const activeStudents = students.filter((s) => !s.deleted && (!s.status || s.status === "Active"));
  const active = activeStudents.length;
  const staffAttendance = useCollection<{ id: string; staffId?: string; date?: string; in?: string; out?: string; status?: string }>("staff_attendance", true, [["date", "==", TODAY]]);
  const checkedIn = checkedInStaff(staff, staffAttendance.rows, TODAY);
  const classIds = new Set(activeStudents.map((student) => student.classId || (student.grade && student.section ? `cls_${student.grade}${student.section}` : "")).filter(Boolean));
  const marked = [...latestDayRecords(att, TODAY).keys()].filter((id) => classIds.has(id)).length;
  // today's roll: per class the latest submitted record (contract 9: newest updatedAt, ties higher period)
  const { absent, pct: attPct } = dayAttendance(activeStudents.length ? (classIds.size ? att.filter((record) => classIds.has(record.classId)) : att) : [], TODAY);
  // fee_payments.date is the LOCAL yyyy-mm-dd (fees todayIso), same as TODAY
  const feesToday = pays.filter((p) => p.date === TODAY).reduce((a, p) => a + (Number(p.amount) || 0), 0);
  const overdue = invs.filter((i) => isOverdue(i, TODAY));
  const overdueAmt = overdue.reduce((a, i) => a + (Number(i.balance) || 0), 0);
  // status "On leave" or an approved staff_leaves row covering today
  const onLeave = staffOnLeave(staff, leaves, TODAY).size;
  const pending = approvals.filter((a) => a.status === "pending").length;
  const enrolled = admittedStudents(students).length;
  const openEnquiries = openAdmissionEnquiries(enq, apps).length;
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
      <K label="Today's Attendance" icon={<UserCheck size={16} className="text-success" />} value={attPct === null ? "—" : `${attPct.toFixed(1)}%`}
        tag={classIds.size ? `${marked} / ${classIds.size} classes marked` : attPct === null ? (active ? "Not marked yet" : "No students") : `${absent} Absent`} tone={attPct === null ? "neutral" : absent ? "danger" : "success"} />
      <K label="Fee Collections" href="/fees" icon={<CircleDollarSign size={16} />} value={inr(feesToday)} tag="Today" tone="success" />
      <K label="Fees Overdue" href="/fees" icon={<AlertTriangle size={16} className="text-error" />} value={inr(overdueAmt)} tag={`${overdue.length} Account${overdue.length === 1 ? "" : "s"}`} tone={overdue.length ? "danger" : "success"} />
      <K label="Admissions Enquiries" href="/admissions" icon={<TrendingUp size={16} className="text-secondary" />} value={openEnquiries} tag={`${enrolled} Enrolled`} tone="success" />
      <K label="Staff on Leave" href="/staff" icon={<UserX size={16} className="text-warning" />} value={onLeave} unit={`/${staff.length}`} tag={`${checkedIn} Checked in`} tone={onLeave ? "warning" : "success"} />
      <K label="Pending Approvals" href="/approvals" icon={<ClipboardList size={16} />} value={pending} tag={pending ? "Action needed" : "All clear"} tone={pending ? "danger" : "success"} />
    </div>
  );
}

/* ---------------- admissions pipeline (adm_enquiries / adm_applications / adm_seats) ---------------- */
function Pipeline() {
  const enquiries = useCollection<Enq>("adm_enquiries");
  const applications = useCollection<App>("adm_applications");
  const students = useCollection<Student>("students");
  const seats = useCollection<Seat>("adm_seats");
  const toast = useToast();
  const ready = useHydrated() && enquiries.ready && applications.ready && students.ready && seats.ready;
  if (!ready) return <Card className="mb-6 min-h-64" />;
  const open = openAdmissionEnquiries(enquiries.rows, applications.rows);
  const admitted = admittedStudents(students.rows);
  const capacity = GROUPS.map((group) => ({
    label: `${group.label} (${group.sub})`,
    enrolled: admitted.filter((student) => (!student.status || student.status === "Active") && groupOfGrade(student.grade || "") === group.id).length,
    cap: seats.rows.filter((seat) => groupOfGrade(seat.grade) === group.id).reduce((total, seat) => total + (Number(seat.capacity) || 0), 0),
  })).filter((row) => row.cap > 0 || row.enrolled > 0);
  return <Card className="mb-6 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-lg font-semibold">Admissions overview</h2>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => {
        downloadCsv("admissions-overview.csv", [["Metric", "Count"], ["Open enquiries", open.length], ["Admitted students", admitted.length]]);
        toast("Admissions overview exported");
      }}><Download size={14} />Export overview</Button><Link href="/admissions"><Button size="sm" variant="secondary">Manage admissions</Button></Link></div>
    </div>
    <p className="mt-1 text-sm text-on-surface-variant">Admission requests and students saved through the current admission process.</p>
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <Link href="/admissions" className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4 hover:border-secondary/30"><p className="text-xs font-semibold text-on-surface-variant">Open enquiries</p><p className="mt-2 text-2xl font-semibold">{open.length}</p><p className="mt-2 text-xs text-on-surface-variant">Converted admission requests are excluded.</p></Link>
      <Link href="/admissions/admission" className="rounded-lg border border-secondary/20 bg-info-container/40 p-4 hover:border-secondary/40"><p className="text-xs font-semibold text-on-surface-variant">Admitted students</p><p className="mt-2 text-2xl font-semibold">{admitted.length}</p><p className="mt-2 text-xs text-on-surface-variant">Includes direct admissions and converted enquiries.</p></Link>
    </div>
    <h3 className="mt-6 font-semibold">Admission intake capacity</h3>
    {!capacity.length ? <p className="mt-3 text-sm text-on-surface-variant">No intake capacity configured.</p> : <div className="mt-3 space-y-3">{capacity.map((row) => <div key={row.label}>
      <div className="flex flex-wrap justify-between gap-2 text-sm"><span>{row.label}</span><span className="text-xs tabular-nums">{row.enrolled} / {row.cap || "Not configured"} active admitted students</span></div>
      {row.cap > 0 && <ProgressBar value={Math.min(100, Math.round(pctOf(row.enrolled, row.cap)))} tone={row.enrolled > row.cap ? "muted" : "brand"} className="mt-1" />}
    </div>)}</div>}
  </Card>;
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
  const { date: TODAY } = useSchoolClock();
  // dash_alerts holds only demo / legacy rows (nothing in the live system writes it); the real alerts are derived
  const { rows: legacy, update } = useCollection<Alert>("dash_alerts");
  const { rows: staff } = useCollection<Staff>("staff");
  const { rows: leaves } = useCollection<LeaveLite>("staff_leaves");
  const { rows: periods } = useCollection<PeriodLite>("ops_periods");
  const { rows: subs } = useCollection<SubLite>("ops_substitutions");
  const { rows: invoices } = useCollection<InvoiceLite>("fee_invoices");
  const { rows: buses } = useCollection<BusLite>("tr_buses");
  const live = useMemo(() => deriveAlerts({ today: TODAY, staff, leaves, periods, subs, invoices, buses }), [TODAY, staff, leaves, periods, subs, invoices, buses]);
  const rows: (Alert | LiveAlert)[] = [...live, ...legacy];
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
  const teachers = staff.filter((s) => s.status === "Active" && isTeachingStaff(s));
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
            {!res && "derived" in a && <div className="mt-2 flex justify-end"><Link href={a.href}><Button size="sm" variant="outline">{a.kind === "substitute" ? "Assign cover" : a.kind === "fee" ? "Open fees" : "Open transport"} <ArrowRight size={12} /></Button></Link></div>}
            {!res && !("derived" in a) && <div className="mt-2 flex justify-end">
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
  const { date: TODAY } = useSchoolClock();
  const { rows: events } = useEvents();
  const [mode, setMode] = useState<"month" | "agenda">("month");
  const [ym, setYm] = useState(() => { const d = parse(TODAY); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [pick, setPick] = useState<string | null>(null);
  const grid = useMemo(() => monthGrid(ym.y, ym.m), [ym]);
  const published = events.filter((e) => e.status === "published");
  const list = pick ? eventsOn(published, pick) : upcomingEvents(published, TODAY).slice(0, 5);
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
      <Kpis />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0"><Pipeline /><ApprovalsInbox /></div>
        <div className="min-w-0"><Alerts /><Milestones /></div>
      </div>
    </>
  );
}
