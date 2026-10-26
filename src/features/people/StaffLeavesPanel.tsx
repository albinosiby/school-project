"use client";
import { useState } from "react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Tabs, useToast, type Column } from "@/components/ui";
import { ReasonModal } from "@/features/dashboard/approvals-shared";
import { fmtDate } from "@/lib/format";
import { useStaffLeaves, type StaffLeave } from "./leaves";

type S = { id: string; name: string; department: string };
const tone = { Pending: "warning", Approved: "success", Rejected: "danger" } as const;

/** Leave requests raised from the teacher app (staff_leaves). Decisions are mirrored into the Approvals queue. */
export function StaffLeavesPanel({ staff }: { staff: S[] }) {
  const toast = useToast();
  const { leaves, ready, decide } = useStaffLeaves();
  const [tab, setTab] = useState("Pending");
  const [rejecting, setRejecting] = useState<StaffLeave | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const who = (id: string) => staff.find((s) => s.id === id);
  const n = (st: string) => leaves.filter((l) => l.status === st).length;
  const view = leaves.filter((l) => tab === "all" || l.status === tab).sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""));
  const act = async (l: StaffLeave, st: "Approved" | "Rejected" | "Pending", note = "") => {
    setBusy(l.id);
    try { await decide(l, st, note); toast(st === "Pending" ? "Moved back to pending" : `Leave ${st.toLowerCase()}`); return true; }
    catch { toast("Could not save the decision", "error"); return false; } finally { setBusy(null); }
  };

  const cols: Column<StaffLeave>[] = [
    { key: "who", header: "Staff member", sortValue: (l) => who(l.staffId)?.name ?? l.staffId, render: (l) => { const s = who(l.staffId);
      return <div className="flex items-center gap-3"><Avatar name={(s?.name ?? l.staffId).replace(/^(Mr|Mrs|Ms|Dr)\.? /, "")} /><div><div className="font-semibold">{s?.name ?? l.staffId}</div><div className="t-caption text-outline">{s?.department}</div></div></div>; } },
    { key: "type", header: "Type", sortValue: (l) => l.type, render: (l) => l.type },
    { key: "dates", header: "Dates", sortValue: (l) => l.from, render: (l) => <div>{l.from ? fmtDate(l.from) : "—"}{l.to && l.to !== l.from && <> – {fmtDate(l.to)}</>}{l.days != null && <div className="t-caption text-outline">{l.days} day{l.days === 1 ? "" : "s"}</div>}</div> },
    { key: "reason", header: "Reason", render: (l) => <span className="block max-w-[240px] text-sm text-on-surface-variant">{l.reason || "—"}</span> },
    { key: "status", header: "Status", sortValue: (l) => l.status, render: (l) => <div><Badge tone={tone[l.status] ?? "neutral"}>{l.status}</Badge>{l.decisionNote && <div className="t-caption mt-0.5 text-outline">{l.decisionNote}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (l) => l.status === "Pending"
      ? <div className="flex justify-end gap-2"><Button size="sm" disabled={busy === l.id} onClick={() => act(l, "Approved")}>Approve</Button><Button size="sm" variant="outline" className="!text-error" disabled={busy === l.id} onClick={() => setRejecting(l)}>Reject</Button></div>
      : <Button size="sm" variant="ghost" disabled={busy === l.id} onClick={() => act(l, "Pending")}>Reopen</Button> },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <Tabs value={tab} onChange={setTab} items={[{ id: "Pending", label: "Pending", count: n("Pending") }, { id: "Approved", label: "Approved", count: n("Approved") }, { id: "Rejected", label: "Rejected", count: n("Rejected") }, { id: "all", label: "All", count: leaves.length }]} />
        <p className="t-caption ml-auto text-outline">Pending requests also appear in the Approvals inbox.</p>
      </div>
      {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading leave requests…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No leave requests" hint="Requests raised by teachers in the mobile app show up here." />} />}
      <ReasonModal ids={rejecting ? [rejecting.id] : null} title="Reject leave request" onClose={() => setRejecting(null)} onSubmit={async (_ids, reason) => { if (rejecting) await act(rejecting, "Rejected", reason); }} />
    </Card>
  );
}
