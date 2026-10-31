"use client";
// Transport > Leaves: crew leave requests from the driver app (tr_crew_leaves, contract 14.5). Approving a leave that covers
// today also marks the crew member "On leave" (Mark returned on the crew row resets it).
import { useState } from "react";
import { writeBatch } from "firebase/firestore";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Modal, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { auth, db } from "@/lib/firebase";
import { fmtDate } from "@/lib/format";
import { todayIso } from "@/features/ops/shared";
import { ROLE_LABEL, schoolDoc, stamp } from "./shared";
import type { Crew, CrewLeave, LeaveStatus } from "./types";

const tone = { Pending: "warning", Approved: "success", Rejected: "danger" } as const;
const order: Record<string, number> = { Pending: 0, Approved: 1, Rejected: 2 };

export function LeavesPanel() {
  const toast = useToast();
  const leaves = useCollection<CrewLeave>("tr_crew_leaves");
  const crew = useCollection<Crew>("tr_crew").rows;
  const [tab, setTab] = useState("Pending");
  const [deciding, setDeciding] = useState<{ l: CrewLeave; to: "Approved" | "Rejected" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const n = (st: string) => leaves.rows.filter((l) => l.status === st).length;
  const view = leaves.rows.filter((l) => tab === "all" || l.status === tab).sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (b.from ?? "").localeCompare(a.from ?? ""));

  async function decide(l: CrewLeave, status: LeaveStatus, note = "") {
    setBusy(l.id);
    try {
      const batch = writeBatch(db); const st = stamp(); const pending = status === "Pending";
      batch.update(schoolDoc("tr_crew_leaves", l.id), { status, decidedBy: pending ? "" : auth.currentUser?.uid ?? "", decidedAt: pending ? "" : new Date().toISOString(), decisionNote: note, ...st });
      const today = todayIso(); const c = crew.find((x) => x.id === l.crewId);
      if (status === "Approved" && c && l.from <= today && (l.to || l.from) >= today) batch.update(schoolDoc("tr_crew", c.id), { status: "On leave", leaveFrom: l.from, leaveTo: l.to || l.from, leaveReason: `${l.type}${l.reason ? `: ${l.reason}` : ""}`, ...st });
      await batch.commit();
      toast(pending ? "Moved back to pending" : `Leave ${status.toLowerCase()}`); return true;
    } catch { toast("Could not save the decision", "error"); return false; } finally { setBusy(null); }
  }

  const cols: Column<CrewLeave>[] = [
    { key: "who", header: "Crew member", sortValue: (l) => l.name, render: (l) => { const c = crew.find((x) => x.id === l.crewId);
      return <div className="flex items-center gap-3"><Avatar name={l.name || l.crewId} /><div><div className="font-semibold">{l.name || c?.name || l.crewId}</div><div className="t-caption text-outline">{ROLE_LABEL[l.role] ?? l.role}{c?.bus ? ` · ${c.bus}` : ""}</div></div></div>; } },
    { key: "type", header: "Type", sortValue: (l) => l.type, render: (l) => l.type },
    { key: "dates", header: "Dates", sortValue: (l) => l.from, render: (l) => <div>{l.from ? fmtDate(l.from) : "—"}{l.to && l.to !== l.from && <> – {fmtDate(l.to)}</>}{l.days != null && <div className="t-caption text-outline">{l.days} day{l.days === 1 ? "" : "s"}</div>}</div> },
    { key: "reason", header: "Reason", render: (l) => <span className="block max-w-[240px] text-sm text-on-surface-variant">{l.reason || "—"}</span> },
    { key: "status", header: "Status", sortValue: (l) => order[l.status] ?? 3, render: (l) => <div><Badge tone={tone[l.status] ?? "neutral"}>{l.status}</Badge>{l.decisionNote && <div className="t-caption mt-0.5 max-w-[200px] text-outline">{l.decisionNote}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (l) => l.status === "Pending"
      ? <div className="flex justify-end gap-2"><Button size="sm" disabled={busy === l.id} onClick={() => setDeciding({ l, to: "Approved" })}>Approve</Button><Button size="sm" variant="outline" className="!text-error" disabled={busy === l.id} onClick={() => setDeciding({ l, to: "Rejected" })}>Reject</Button></div>
      : <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => decide(l, "Pending")}>Reopen</Button> },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <Tabs value={tab} onChange={setTab} items={[{ id: "Pending", label: "Pending", count: n("Pending") }, { id: "Approved", label: "Approved", count: n("Approved") }, { id: "Rejected", label: "Rejected", count: n("Rejected") }, { id: "all", label: "All", count: leaves.rows.length }]} />
        <p className="t-caption ml-auto text-outline">Approving a leave that covers today marks the crew member On leave.</p>
      </div>
      {!leaves.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading leave requests…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No leave requests" hint="Requests raised by crew in the driver app show up here." />} />}
      {deciding && <DecideModal l={deciding.l} to={deciding.to} onClose={() => setDeciding(null)} onSubmit={async (note) => { if (await decide(deciding.l, deciding.to, note)) setDeciding(null); }} />}
    </Card>
  );
}

function DecideModal({ l, to, onClose, onSubmit }: { l: CrewLeave; to: "Approved" | "Rejected"; onClose: () => void; onSubmit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState(""); const [saving, setSaving] = useState(false);
  const approve = to === "Approved";
  return (
    <Modal open onClose={onClose} title={approve ? "Approve leave" : "Reject leave"} subtitle={`${l.name} · ${l.type} · ${fmtDate(l.from)}${l.to && l.to !== l.from ? ` – ${fmtDate(l.to)}` : ""}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={approve ? "primary" : "danger"} disabled={saving} onClick={async () => { setSaving(true); try { await onSubmit(note.trim()); } finally { setSaving(false); } }}>{approve ? "Approve" : "Reject"}</Button></>}>
      <Field label="Note (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Visible to the crew member in the driver app" autoFocus /></Field>
    </Modal>
  );
}
