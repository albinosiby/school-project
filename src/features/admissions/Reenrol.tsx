"use client";
import { useMemo, useState } from "react";
import { CalendarClock, MessageSquare, Pencil, X } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, Field, Input, Modal, ProgressBar, Select, Stat, Textarea, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inrFull } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { pct, todayISO, useAdm } from "./lib";
import { campaignErrors, reenrolRows } from "./logic";
import type { Campaign, Reenrol } from "./types";

type Overlay = Partial<Reenrol> & { id: string; studentId?: string };
type RosterStudent = { id: string; name: string; grn?: string; grade: string; section: string; guardian?: string; phone?: string; status?: string; bus?: string };
type Bus = { id: string; number?: string; routeName?: string; status?: string };
const SELF = "Self / Walker";

/**
 * Re-enrolment rows come from the shared students roster; the campaign answers live in `adm_reenrolment/{studentId}` (admin-only).
 * Older overlay rows that match no student are still listed (read-only data from an earlier import).
 */
function useReenrolment() {
  const re = useCollection<Overlay>("adm_reenrolment");
  const students = useCollection<RosterStudent>("students");
  const rows = useMemo(() => reenrolRows(students.rows, re.rows), [students.rows, re.rows]);
  const patch = async (r: Reenrol, p: Partial<Reenrol>) => {
    const own = re.rows.find((o) => (o.studentId ?? o.id) === r.id);
    if (own) return re.update(own.id, p);
    return re.create({ id: r.id, studentId: r.id, status: r.status, fee: r.fee, stream: r.stream, transport: r.transport, reason: r.reason, confirmedAt: r.confirmedAt, ...p });
  };
  return { rows, ready: re.ready && students.ready, patch };
}

const WINGS = [
  { id: "pre-primary", label: "Pre-Primary & Primary", sub: "Nursery to Grade 5", target: 95 },
  { id: "middle", label: "Middle School", sub: "Grades 6 to 8 (Transition)", target: 95 },
  { id: "secondary", label: "Secondary", sub: "Grades 9 to 10 (Board Stream)", target: 95 },
  { id: "senior", label: "Senior Secondary", sub: "Grade 11 Stream Choice", target: 85 },
] as const;
const FEE: Record<Reenrol["fee"], { l: string; tone: "success" | "warning" | "info" | "neutral" }> = { paid: { l: "Paid", tone: "success" }, due: { l: "Fee Due", tone: "warning" }, sibling: { l: "Sibling concession", tone: "info" }, caution: { l: "Caution refund", tone: "neutral" } };

export function Reenrolment() {
  const re = useReenrolment();
  const camp = useCollection<Campaign>("adm_campaign");
  const { logMessage } = useAdm();
  const toast = useToast();
  const [wing, setWing] = useState("");
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [campEdit, setCampEdit] = useState(false);
  const [call, setCall] = useState(false);
  const c = camp.rows[0];

  const stat = useMemo(() => {
    const by = (f: (r: Reenrol) => boolean) => re.rows.filter(f).length;
    return { total: re.rows.length, conf: by((r) => r.status === "confirmed"), pend: by((r) => r.status === "pending"), exit: by((r) => r.status === "exit"), due: by((r) => r.status === "confirmed" && r.fee === "due") };
  }, [re.rows]);
  const rows = re.rows.filter((r) => (!wing || r.wing === wing) && (tab === "all" || r.status === tab));
  const selected = re.rows.filter((r) => sel.includes(r.id));
  const row = rowId ? re.rows.find((r) => r.id === rowId) ?? null : null;

  const cols: Column<Reenrol>[] = [
    { key: "adm", header: "Adm No", sortValue: (r) => r.admNo, render: (r) => <span className="font-mono text-xs text-secondary">#{r.admNo}</span> },
    { key: "name", header: "Student Name", sortValue: (r) => r.name, render: (r) => <div className="flex items-center gap-2"><Avatar name={r.name} size={30} /><b>{r.name}</b></div> },
    { key: "grade", header: "Current Grade", render: (r) => <Badge>Class {r.grade}-{r.section}</Badge> },
    { key: "stream", header: "Next-Year Stream / Elective", render: (r) => r.status === "exit" ? <i className="text-on-surface-variant">Transfer Out: {r.reason}</i> : r.stream ? r.stream : <i className="text-on-surface-variant">Pending Stream/Lang Choice</i> },
    { key: "tr", header: "Transport", render: (r) => r.status === "exit" ? "Discontinuing" : r.transport },
    { key: "fee", header: "Re-enrolment Fee", render: (r) => <Badge tone={FEE[r.fee].tone}>{FEE[r.fee].l}</Badge> },
    { key: "st", header: "Status", sortValue: (r) => r.status, render: (r) => <Badge tone={r.status === "confirmed" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status === "exit" ? "Exit / TC" : r.status === "confirmed" ? "Confirmed" : "Pending"}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div><div className="t-label-caps text-on-surface-variant">Active campaign</div><h2 className="t-headline-md">{c?.name ?? "—"}</h2>
          <p className="text-on-surface-variant">{c ? `${fmtDate(c.opensAt)} → ${fmtDate(c.closesAt)} · re-enrolment fee ${inrFull(c.reenrolFee)} · ${c.noticesSent} notices sent` : ""}</p></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setCampEdit(true)}><Pencil size={14} />Edit campaign</Button>
          <Button onClick={async () => { const p = re.rows.filter((r) => r.status === "pending"); if (!p.length) return toast("No pending guardians to remind", "error"); try { await logMessage("Re-enrolment reminder", `${p.length} guardians`, `Campaign reminder sent to ${p.length} pending guardians.`); if (c) await camp.update(c.id, { noticesSent: (c.noticesSent || 0) + p.length, lastReminderAt: todayISO() }); toast(`Reminder sent to ${p.length} pending guardians (simulated)`); } catch { toast("Could not send reminders", "error"); } }}><MessageSquare size={14} />Remind all pending</Button></div>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="TOTAL ELIGIBLE RETURNING" value={stat.total.toLocaleString("en-IN")} />
        <Stat label="CONFIRMED RE-ENROLMENT" value={stat.conf.toLocaleString("en-IN")} sub={`${pct(stat.conf, stat.total)}%`} subTone="success" />
        <Stat label="PENDING GUARDIAN INTENT" value={stat.pend} sub={`${pct(stat.pend, stat.total)}%`} subTone="warning" />
        <Stat label="INTENT TO TRANSFER / TC" value={stat.exit} sub={`${pct(stat.exit, stat.total)}%`} subTone="danger" />
      </div>

      <div className="flex items-center justify-between"><h2 className="t-headline-md">Cohort Retention Breakdown</h2><span className="text-xs text-on-surface-variant">Click card to filter table roster below</span></div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {WINGS.map((w) => {
          const all = re.rows.filter((r) => r.wing === w.id), conf = all.filter((r) => r.status === "confirmed").length, p = pct(conf, all.length);
          return (
            <button key={w.id} onClick={() => setWing(wing === w.id ? "" : w.id)} aria-pressed={wing === w.id} className={cn("cursor-pointer rounded-lg border bg-surface-container-lowest p-5 text-left shadow-card", wing === w.id ? "border-secondary ring-2 ring-secondary/30" : "border-outline-variant/60")}>
              <div className="flex items-start justify-between gap-2"><h3 className="font-semibold">{w.label}</h3><Badge tone={p >= w.target ? "info" : "warning"}>{p}%</Badge></div>
              <p className="text-xs text-on-surface-variant">{w.sub}</p>
              <div className="mt-3 flex justify-between text-sm"><span>{conf} / {all.length} students</span><b>{p}%</b></div><ProgressBar className="mt-1" value={p} tone={p >= w.target ? "brand" : "warning"} />
              <p className="mt-3 text-xs text-on-surface-variant">{all.filter((r) => r.status === "pending").length} Pending · {all.filter((r) => r.status === "exit").length} Exit Requests · Target {w.target}%</p>
            </button>);
        })}
      </div>

      <Card>
        <div className="flex flex-wrap gap-1 p-4 pb-0" role="tablist">{([["all", "All", stat.total], ["confirmed", "Confirmed", stat.conf], ["pending", "Pending", stat.pend], ["exit", "Exit / TC", stat.exit]] as const).map(([id, l, n]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("cursor-pointer rounded px-3 py-1.5 text-sm font-medium", tab === id ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container")}>{l} <span className="ml-1 text-xs opacity-80">{n}</span></button>))}
          {wing && <Button size="sm" variant="ghost" onClick={() => setWing("")}>Clear cohort filter ✕</Button>}</div>
        <div className="pt-4">{!re.ready ? <p className="p-5">Loading…</p> : <DataTable rows={rows} columns={cols} pageSize={10} selectable selected={sel} onSelectedChange={setSel} onRowClick={(r) => setRowId(r.id)} searchText={(r) => `${r.name} ${r.admNo}`} />}</div>
      </Card>

      {sel.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-6 left-1/2 z-40 w-[min(520px,92vw)] -translate-x-1/2 rounded-xl border border-secondary/30 bg-info-container p-4 shadow-pop">
          <div className="flex items-start justify-between"><div><b>{sel.length} Students Selected</b><div className="text-xs text-on-surface-variant">Ready for batch reminders or counselor assignment</div></div><button aria-label="Clear selection" onClick={() => setSel([])} className="cursor-pointer"><X size={16} /></button></div>
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={async () => { try { await Promise.all(selected.map((r) => logMessage("Re-enrolment notice", r.phone, `Please confirm re-enrolment for ${r.name} (${r.admNo})${c?.closesAt ? ` by ${fmtDate(c.closesAt)}` : ""}.`))); if (c) await camp.update(c.id, { noticesSent: (c.noticesSent || 0) + selected.length }); toast(`WhatsApp notice sent to ${selected.length} guardians (simulated)`); setSel([]); } catch { toast("Could not send notices", "error"); } }}><MessageSquare size={14} />Send WhatsApp Notice</Button>
            <Button size="sm" variant="outline" onClick={() => setCall(true)}><CalendarClock size={14} />Schedule Counselor Call</Button></div>
        </div>)}

      {/* keyed per student so the exit-reason draft doesn't carry over to the next student */}
      <StudentModal key={rowId ?? "none"} r={row} campaign={c?.name} patchRow={re.patch} onClose={() => setRowId(null)} />
      <CallModal open={call} n={sel.length} onClose={() => setCall(false)} onSave={async (when, note) => { try { await Promise.all(selected.map((r) => logMessage("Counselor call", r.phone, `Counselor call for ${r.name} on ${when}. ${note}`))); toast(`Counselor call scheduled for ${selected.length} families`); setCall(false); setSel([]); } catch { toast("Could not schedule calls", "error"); } }} />
      {campEdit && <CampaignModal c={c} onClose={() => setCampEdit(false)} onSave={async (p) => { try { if (c) await camp.update(c.id, p); else await camp.create({ id: "campaign", noticesSent: 0, lastReminderAt: "", ...p } as Campaign); toast("Campaign updated"); setCampEdit(false); } catch { toast("Could not save campaign", "error"); } }} />}
    </div>
  );
}

function StudentModal({ r, campaign, patchRow, onClose }: { r: Reenrol | null; campaign?: string; patchRow: (r: Reenrol, p: Partial<Reenrol>) => Promise<unknown>; onClose: () => void }) {
  const { logMessage } = useAdm();
  const buses = useCollection<Bus>("tr_buses").rows;
  const toast = useToast();
  const [reason, setReason] = useState("");
  if (!r) return null;
  const transports = [...new Set([r.transport, ...buses.filter((b) => b.status !== "Inactive" && b.number).map((b) => `Bus ${b.number}`), SELF].filter(Boolean))];
  const patch = (p: Partial<Reenrol>, msg: string) => patchRow(r, p).then(() => toast(msg)).catch(() => toast("Update failed", "error"));
  return (
    <Modal open onClose={onClose} title={`${r.name} · ${r.admNo}`} subtitle={`Class ${r.grade}-${r.section} · Guardian ${r.guardian} (${r.phone})`} width="max-w-xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Stream / elective"><Input defaultValue={r.stream} onBlur={(e) => e.target.value !== r.stream && patch({ stream: e.target.value }, "Stream updated")} /></Field>
        <Field label="Transport"><Select value={r.transport} onChange={(e) => patch({ transport: e.target.value }, "Transport updated")}>{transports.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Fee status"><Select value={r.fee} onChange={(e) => patch({ fee: e.target.value as Reenrol["fee"] }, "Fee status updated")}>{Object.entries(FEE).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}</Select></Field>
        <Field label="Status"><div className="pt-2"><Badge tone={r.status === "confirmed" ? "success" : r.status === "pending" ? "warning" : "danger"}>{r.status}</Badge></div></Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {r.status !== "confirmed" && <Button onClick={() => patch({ status: "confirmed", confirmedAt: todayISO(), reason: "" }, `${r.name} confirmed${campaign ? ` (${campaign})` : ""}`)}>Confirm re-enrolment</Button>}
        {r.fee === "due" && <Button variant="outline" onClick={async () => { await patch({ fee: "paid" }, "Fee recorded as paid"); await logMessage("Receipt", r.phone, `Re-enrolment fee receipt for ${r.name}.`).catch(() => {}); }}>Mark fee paid</Button>}
        {r.status === "pending" && <Button variant="outline" onClick={() => logMessage("Re-enrolment notice", r.phone, `Reminder for ${r.name}`).then(() => toast("Reminder sent (simulated)")).catch(() => toast("Could not send reminder", "error"))}><MessageSquare size={14} />Send reminder</Button>}
      </div>
      {r.status !== "exit" && <div className="mt-5 flex items-end gap-2 border-t border-outline-variant/60 pt-4"><Field label="Record exit / TC request — reason" className="flex-1"><Textarea className="!min-h-12" value={reason} onChange={(e) => setReason(e.target.value)} /></Field><Button variant="danger" disabled={!reason.trim()} onClick={() => patch({ status: "exit", reason: reason.trim(), fee: "caution" }, "Exit request recorded")}>Mark exit</Button></div>}
    </Modal>
  );
}

function CallModal({ open, n, onClose, onSave }: { open: boolean; n: number; onClose: () => void; onSave: (when: string, note: string) => void }) {
  const [d, setD] = useState(""); const [t, setT] = useState("11:00"); const [note, setNote] = useState("");
  if (!open) return null;
  const past = !!d && d < todayISO();
  return <Modal open onClose={onClose} title="Schedule counselor call" subtitle={`${n} families`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!d || past} onClick={() => onSave(`${d} ${t}`, note)}>Schedule</Button></>}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Date" required error={past ? "Pick today or a later date" : undefined}><Input type="date" value={d} onChange={(e) => setD(e.target.value)} /></Field><Field label="Time"><Input type="time" value={t} onChange={(e) => setT(e.target.value)} /></Field></div>
    <Field label="Agenda" className="mt-4"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field></Modal>;
}

function CampaignModal({ c, onClose, onSave }: { c?: Campaign; onClose: () => void; onSave: (p: Partial<Campaign>) => void }) {
  const [f, setF] = useState({ name: c?.name ?? "", opensAt: c?.opensAt ?? "", closesAt: c?.closesAt ?? "", fee: String(c?.reenrolFee ?? 0) });
  const [tried, setTried] = useState(false);
  const e = campaignErrors(f);
  const show = (k: string) => (tried || k === "closesAt" ? e[k] : undefined);
  const save = () => { setTried(true); if (Object.keys(e).length) return; onSave({ name: f.name.trim(), opensAt: f.opensAt, closesAt: f.closesAt, reenrolFee: Number(f.fee) }); };
  return <Modal open onClose={onClose} title="Edit campaign" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Name" className="sm:col-span-2" error={show("name")}><Input value={f.name} onChange={(ev) => setF({ ...f, name: ev.target.value })} /></Field>
      <Field label="Opens" error={show("opensAt")}><Input type="date" value={f.opensAt} onChange={(ev) => setF({ ...f, opensAt: ev.target.value })} /></Field><Field label="Closes" error={f.closesAt || tried ? show("closesAt") : undefined}><Input type="date" value={f.closesAt} onChange={(ev) => setF({ ...f, closesAt: ev.target.value })} /></Field>
      <Field label="Re-enrolment fee (₹)" error={show("fee")}><Input type="number" min={0} value={f.fee} onChange={(ev) => setF({ ...f, fee: ev.target.value })} /></Field></div></Modal>;
}
