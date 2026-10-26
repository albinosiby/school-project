"use client";
import { useMemo, useState } from "react";
import { BadgeCheck, CheckCheck, CircleHelp, RefreshCw, ScrollText, Scale, X } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, Field, Modal, ProgressBar, Select, SlideOver, Switch, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { DashHeader } from "./DashHeader";
import { KindIcon, KIND_LABEL, ReasonModal, useApprovalActions } from "./approvals-shared";
import { errMsg, fmtSubmitted, KIND_ORDER, MONTHS, type Approval, type Notif, type Policy, nowLocal } from "./data";

type Me = { id: string; name: string; title?: string };
/** hours between submission and decision (null when either timestamp is missing) */
const turnaround = (r: Approval) => { const a = Date.parse(r.submitted ?? ""), b = Date.parse(r.decidedAt ?? ""); return Number.isNaN(a) || Number.isNaN(b) || b < a ? null : (b - a) / 36e5; };
const fmtHrs = (h: number | null) => h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : `${h.toFixed(1)} hrs`;
const avg = (xs: number[]) => xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : null;

export function ApprovalsView() {
  const { rows, approve, reject, reopen, update } = useApprovalActions();
  const { rows: policies, update: updPolicy } = useCollection<Policy>("approval_policies");
  const { rows: me } = useCollection<Me>("me");
  const { create: notify } = useCollection<Notif>("notifications");
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [status, setStatus] = useState("pending");
  const [urgency, setUrgency] = useState("all");
  const [dept, setDept] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [rejecting, setRejecting] = useState<string[] | null>(null);
  const [clar, setClar] = useState<string[] | null>(null);
  const [clarMsg, setClarMsg] = useState("");
  const [detail, setDetail] = useState<string | null>(null);
  const [editPolicies, setEditPolicies] = useState(false);
  const [clarBusy, setClarBusy] = useState(false);

  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending");
  const urgencies = [...new Set(rows.map((r) => r.urgency))];
  const depts = [...new Set(rows.map((r) => r.dept))];
  const view = useMemo(() => rows.filter((r) => (tab === "all" || r.kind === tab) && (status === "all" || r.status === status) && (urgency === "all" || r.urgency === urgency) && (dept === "all" || r.dept === dept)),
    [rows, tab, status, urgency, dept]);
  const selPending = sel.filter((id) => pending.some((p) => p.id === id));
  const detailRow = rows.find((r) => r.id === detail) ?? null;
  const tabs = [{ id: "all", label: "All Approvals", count: pending.length }, ...KIND_ORDER.map((k) => ({ id: k, label: KIND_LABEL[k], count: pending.filter((r) => r.kind === k).length }))];
  const kindsSel = [...new Set(selPending.map((id) => KIND_LABEL[rows.find((r) => r.id === id)!.kind]))].join(", ");

  const statusBadge = (r: Approval) => r.status === "approved" ? <Badge tone="success">Authorized</Badge> : r.status === "rejected" ? <Badge tone="danger">Rejected</Badge>
    : <><Badge tone={r.tone}>{r.urgency}</Badge>{r.clarification && <p className="mt-1 text-[11px] text-warning">Clarification requested</p>}</>;
  const actions = (r: Approval) => r.status === "pending" ? (
    <div className="flex gap-2"><Button size="sm" onClick={() => approve([r.id])}>Authorize</Button><Button size="sm" variant="outline" className="!text-error" onClick={() => setRejecting([r.id])}>Reject</Button></div>
  ) : <Button size="sm" variant="ghost" onClick={() => reopen(r.id)}>Reopen</Button>;

  const columns: Column<Approval>[] = [
    { key: "req", header: "Requester Profile", sortValue: (r) => r.requester, render: (r) => <div className="flex items-center gap-3"><Avatar name={r.requester} size={36} /><div><p className="font-semibold">{r.requester}</p><p className="text-xs text-outline">{r.ref}</p></div></div> },
    { key: "cat", header: "Request Category", sortValue: (r) => r.title, render: (r) => <span className="flex items-center gap-2 font-medium"><KindIcon kind={r.kind} />{r.title}</span> },
    { key: "scope", header: "Scope & Impact Details", render: (r) => <span className="block max-w-[260px] text-xs text-on-surface-variant">{r.detail}</span> },
    { key: "urg", header: "Urgency / Status", render: statusBadge },
    { key: "act", header: "Quick Actions", render: (r) => <div onClick={(e) => e.stopPropagation()}>{actions(r)}</div> },
  ];

  const resolved24 = rows.length ? Math.round((decided.length / rows.length) * 1000) / 10 : 0;
  const tat = (kind?: Approval["kind"]) => avg(decided.filter((r) => !kind || r.kind === kind).map(turnaround).filter((h): h is number => h !== null));
  const avgTat = tat();
  const month = (() => { const d = new Date(); return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`; })();

  return (
    <>
      <DashHeader active="approvals" />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-5">
          <Tabs items={tabs} value={tab} onChange={(t) => { setTab(t); setSel([]); }} />
          <Card>
            <div className="flex flex-wrap items-center gap-3 p-4">
              <p className="text-sm text-on-surface-variant">Showing <b>{view.length}</b> of {rows.length} requests</p>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Select aria-label="Status" className="!w-36" value={status} onChange={(e) => setStatus(e.target.value)}><option value="pending">Pending</option><option value="approved">Authorized</option><option value="rejected">Rejected</option><option value="all">All statuses</option></Select>
                <Select aria-label="Urgency" className="!w-44" value={urgency} onChange={(e) => setUrgency(e.target.value)}><option value="all">All Urgencies</option>{urgencies.map((u) => <option key={u}>{u}</option>)}</Select>
                <Select aria-label="Department" className="!w-44" value={dept} onChange={(e) => setDept(e.target.value)}><option value="all">All Departments</option>{depts.map((u) => <option key={u}>{u}</option>)}</Select>
                <Button variant="outline" size="sm" aria-label="Reset filters" onClick={() => { setStatus("pending"); setUrgency("all"); setDept("all"); setTab("all"); toast("Filters reset"); }}><RefreshCw size={14} /></Button>
              </div>
            </div>
            <DataTable rows={view} columns={columns} pageSize={6} selectable selected={sel} onSelectedChange={setSel} onRowClick={(r) => setDetail(r.id)}
              searchText={(r) => `${r.requester} ${r.ref} ${r.title} ${r.dept}`} />
          </Card>
          {selPending.length > 0 && (
            <div className="rounded-lg border border-secondary/30 bg-info-container/60 p-4 shadow-card">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded bg-secondary font-bold text-on-secondary">{selPending.length}</span>
                <div><p className="font-semibold">{selPending.length} request{selPending.length > 1 ? "s" : ""} selected across {kindsSel}</p><p className="text-xs text-secondary">Batch decisions are applied to every selected request and recorded individually</p></div></div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => { setClar(selPending); setClarMsg(""); }}><CircleHelp size={14} />Request Clarification</Button>
                <Button variant="outline" className="!text-error" onClick={() => setRejecting(selPending)}><X size={14} />Batch Reject</Button>
                <Button onClick={async () => { await approve(selPending); setSel([]); }}><CheckCheck size={14} />Batch Approve ({selPending.length} Requests)</Button></div>
            </div>)}
        </div>

        <aside className="space-y-5">
          <Card className="p-5"><div className="flex items-center justify-between"><p className="t-label-caps !text-[11px] text-on-surface-variant"><BadgeCheck size={14} className="mr-1 inline text-secondary" />Signatory Authority</p><Badge>DSC not connected</Badge></div>
            <div className="mt-4 flex items-center gap-3"><Avatar name={me[0]?.name ?? "—"} size={48} /><div><p className="font-semibold">{me[0]?.name ?? "—"}</p><p className="text-sm text-on-surface-variant">{me[0]?.title || "Head of Institution"}</p></div></div>
            <p className="mt-4 border-t border-outline-variant/60 pt-3 text-xs text-outline">Decisions are recorded against your account. Digital signature (DSC) signing is not set up yet.</p></Card>
          <Card className="p-5"><div className="flex items-center justify-between"><p className="t-label-caps !text-[11px] text-on-surface-variant"><Scale size={14} className="mr-1 inline text-secondary" />SLA & Compliance Target</p><span className="text-xs font-semibold text-secondary">{month}</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3"><div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-on-surface-variant">Resolved this queue</p><p className="mt-1 text-2xl font-bold">{resolved24}%</p><ProgressBar value={resolved24} tone="success" className="mt-2 !h-1.5" /></div>
              <div className="rounded-lg bg-surface-container-low p-3"><p className="text-xs text-on-surface-variant">Avg Turnaround</p><p className="mt-1 text-2xl font-bold">{fmtHrs(avgTat)}</p><p className="mt-2 text-[11px] text-outline">{decided.length} decided</p></div></div>
            <ul className="mt-4 space-y-1.5 text-sm">{([["Gate Passes SLA", "pass", 0.25, "< 15m"], ["Marks Unlock Window", "marks", 6, "< 6h"], ["Fee Waiver Assessment", "fee", 48, "< 48h"]] as const).map(([a, k, target, label]) => { const h = tat(k); return (
              <li key={a} className="flex justify-between gap-2"><span>{a}</span><span><b>{fmtHrs(h)}</b> <span className={`text-xs ${h === null ? "text-outline" : h <= target ? "text-success" : "text-error"}`}>(Target {label})</span></span></li>); })}</ul></Card>
          <Card className="p-5"><div className="flex items-center justify-between"><p className="t-label-caps !text-[11px] text-on-surface-variant"><ScrollText size={14} className="mr-1 inline text-secondary" />Active Routing Policies</p>
            <button className="cursor-pointer text-xs font-semibold text-secondary" onClick={() => setEditPolicies((v) => !v)}>{editPolicies ? "Done" : "Edit"}</button></div>
            <div className="mt-3 space-y-2">{policies.map((p) => <div key={p.id} className={`flex items-start gap-3 rounded-lg bg-info-container/50 p-3 ${p.enabled ? "" : "opacity-50"}`}><div className="flex-1"><p className="text-sm font-semibold">{p.title}</p><p className="text-xs text-on-surface-variant">{p.body}</p></div>
              {editPolicies && <Switch checked={p.enabled} label={`Toggle ${p.title}`} onChange={async (v) => { try { await updPolicy(p.id, { enabled: v }); toast(`Policy ${v ? "enabled" : "disabled"}`); } catch (e) { toast(errMsg(e), "error"); } }} />}</div>)}
              {policies.length === 0 && <p className="text-sm text-outline">No routing policies configured.</p>}</div>
</Card>
        </aside>
      </div>

      <ReasonModal ids={rejecting} title={rejecting && rejecting.length > 1 ? "Batch reject requests" : "Reject request"} onClose={() => setRejecting(null)} onSubmit={async (ids, reason) => { await reject(ids, reason); setSel([]); }} />
      <Modal open={!!clar} onClose={() => setClar(null)} title="Request clarification" subtitle={clar ? `${clar.length} request${clar.length > 1 ? "s" : ""} — requesters are notified` : undefined}
        footer={<><Button variant="outline" onClick={() => setClar(null)}>Cancel</Button><Button disabled={clarMsg.trim().length < 5 || clarBusy} onClick={async () => {
          if (!clar) return;
          setClarBusy(true);
          try {
            await Promise.all(clar.map((id) => update(id, { clarification: clarMsg.trim() })));
            await notify({ category: "approvals", title: "Clarification requested", body: `Principal asked for details on ${clar.length} request(s): “${clarMsg.trim()}”`, createdAt: nowLocal(), read: false, href: "/approvals" } as never);
            toast("Clarification request sent"); setClar(null); setSel([]);
          } catch (e) { toast(errMsg(e, "Could not send"), "error"); } finally { setClarBusy(false); }
        }}>{clarBusy ? "Sending…" : "Send request"}</Button></>}>
        <Field label="Message to requester(s)" required hint="At least 5 characters"><Textarea value={clarMsg} onChange={(e) => setClarMsg(e.target.value)} autoFocus /></Field></Modal>

      <SlideOver open={!!detailRow} onClose={() => setDetail(null)} title={detailRow?.title ?? ""} subtitle={detailRow ? `${detailRow.requester} · ${detailRow.ref}` : undefined}
        footer={detailRow ? (detailRow.status === "pending" ? <><Button variant="outline" className="!text-error" onClick={() => { setRejecting([detailRow.id]); }}>Reject</Button><Button onClick={() => approve([detailRow.id])}>Authorize</Button></> : <Button variant="outline" onClick={() => reopen(detailRow.id)}>Move back to pending</Button>) : undefined}>
        {detailRow && <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><Badge tone={detailRow.status === "approved" ? "success" : detailRow.status === "rejected" ? "danger" : "warning"}>{detailRow.status === "approved" ? "Authorized" : detailRow.status === "rejected" ? "Rejected" : "Pending"}</Badge><Badge tone={detailRow.tone}>{detailRow.urgency}</Badge><Badge>{detailRow.dept}</Badge></div>
          {[["Scope & impact", detailRow.detail], ["Remarks & justification", detailRow.remark], ["Submitted", fmtSubmitted(detailRow.submitted)]].map(([k, v]) => <div key={k}><p className="text-xs font-semibold text-on-surface-variant">{k}</p><p className="mt-1">{v}</p></div>)}
          {detailRow.clarification && <div className="rounded-lg bg-warning-container p-3 text-sm"><b>Clarification requested:</b> {detailRow.clarification}</div>}
          {detailRow.status === "rejected" && <div className="rounded-lg bg-error-container p-3 text-sm"><b>Rejection reason:</b> {detailRow.reason}</div>}
          <div><p className="text-xs font-semibold text-on-surface-variant">Routing</p><ol className="mt-2 space-y-2 text-sm"><li>✓ Submitted by {detailRow.requester}</li><li>✓ Endorsement: {detailRow.urgency}</li><li>{detailRow.status === "pending" ? "○ Awaiting Principal authorization" : `✓ Principal ${detailRow.status === "approved" ? "authorized" : "rejected"}`}</li></ol></div>
        </div>}
      </SlideOver>
    </>
  );
}
