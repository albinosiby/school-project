"use client";
import { useMemo, useState } from "react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Select, Tabs, useToast, type Column } from "@/components/ui";
import { ReasonModal } from "@/features/dashboard/approvals-shared";
import { auth } from "@/lib/firebase";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { leaveDays, leaveStatus } from "./studentLogic";

/** student_leaves (data contract 13.3): raised by parents, decided by the class teacher in the teacher app. */
type Leave = { id: string; studentId: string; classId: string; from: string; to?: string; reason?: string; status: "Pending" | "Approved" | "Rejected" | string;
  decisionNote?: string; decidedBy?: string; decidedAt?: string; parentUid?: string; name?: string; days?: number; deleted?: boolean };
type Stu = { id: string; name: string; grn: string; grade: string; section: string; classId?: string; guardian?: string };
type Cls = { id: string; grade: string; section: string; classTeacherId?: string };
type Stf = { id: string; name: string; status?: string; authUid?: string };
const tone = { Pending: "warning", Approved: "success", Rejected: "danger" } as const;
/** day count from the dates; the parent app's stored `days` when the dates cannot be read */
const days = (l: Leave) => leaveDays(l.from, l.to) || Number(l.days) || 0;

export function StudentLeavesPanel({ students }: { students: Stu[] }) {
  const toast = useToast();
  const leaves = useCollection<Leave>("student_leaves");
  const { ready, update } = leaves;
  // tolerant read: soft-deleted requests are hidden, status in the contract spelling (teacher app ignores deleted too)
  const rows = useMemo(() => leaves.rows.filter((l) => l.deleted !== true).map((l) => ({ ...l, status: leaveStatus(l.status), classId: l.classId ?? "" })), [leaves.rows]);
  const classes = useCollection<Cls>("classes").rows;
  const staff = useCollection<Stf>("staff").rows;
  const [tab, setTab] = useState("Pending");
  const [cls, setCls] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Leave | null>(null);
  const stu = (id: string) => students.find((s) => s.id === id);
  const label = (classId: string) => { const c = classes.find((x) => x.id === classId); return c ? `${c.grade}-${c.section}` : classId.replace(/^cls_(\d+)(\w)$/, "$1-$2"); };
  const teacherOf = (classId: string) => { const t = classes.find((c) => c.id === classId)?.classTeacherId; return t ? staff.find((s) => s.id === t) : undefined; };
  const decider = (uid?: string) => !uid ? "" : uid === auth.currentUser?.uid ? "Admin" : staff.find((s) => s.authUid === uid || s.id === uid)?.name ?? "Teacher";

  const inClass = useMemo(() => rows.filter((l) => !cls || l.classId === cls), [rows, cls]);
  const n = (st: string) => inClass.filter((l) => l.status === st).length;
  const view = inClass.filter((l) => tab === "all" || l.status === tab).sort((a, b) => (b.from ?? "").localeCompare(a.from ?? ""));
  const classIds = [...new Set(rows.map((l) => l.classId).filter(Boolean))].sort((a, b) => label(a).localeCompare(label(b), undefined, { numeric: true }));

  async function decide(l: Leave, status: "Approved" | "Rejected", note = "") {
    setBusy(l.id);
    try { await update(l.id, { status, decisionNote: note, decidedBy: auth.currentUser?.uid ?? "", decidedAt: new Date().toISOString() }); toast(`Leave ${status.toLowerCase()}`); }
    catch { toast("Could not save the decision", "error"); throw Object.assign(new Error("Could not save the decision"), { toasted: true }); } finally { setBusy(null); }
  }

  const cols: Column<Leave>[] = [
    { key: "student", header: "Student", sortValue: (l) => stu(l.studentId)?.name ?? l.name ?? "", render: (l) => { const s = stu(l.studentId);
      return <div className="flex items-center gap-3"><Avatar name={s?.name ?? l.name ?? "?"} /><div><div className="font-semibold">{s?.name ?? l.name ?? l.studentId}</div><div className="t-caption font-mono text-outline">{s?.grn ?? l.studentId}</div></div></div>; } },
    { key: "class", header: "Class", sortValue: (l) => label(l.classId), render: (l) => { const t = teacherOf(l.classId);
      return <div><span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{label(l.classId)}</span>
        {t && <div className="t-caption mt-1 text-outline">{t.name}{t.status === "On leave" && <Badge tone="warning" className="ml-1">On leave</Badge>}</div>}</div>; } },
    { key: "dates", header: "Dates", sortValue: (l) => l.from ?? "", render: (l) => <div>{l.from ? fmtDate(l.from) : "—"}{l.to && l.to !== l.from && <> – {fmtDate(l.to)}</>}<div className="t-caption text-outline">{days(l)} day{days(l) === 1 ? "" : "s"}</div></div> },
    { key: "reason", header: "Reason", render: (l) => <span className="block max-w-[260px] text-sm text-on-surface-variant">{l.reason || "—"}</span> },
    { key: "status", header: "Status", sortValue: (l) => l.status, render: (l) => <div><Badge tone={tone[l.status as keyof typeof tone] ?? "neutral"}>{l.status}</Badge>
      {l.decidedBy && <div className="t-caption mt-0.5 text-outline">by {decider(l.decidedBy)}{l.decidedAt ? ` · ${fmtDate(l.decidedAt)}` : ""}</div>}
      {l.decisionNote && <div className="t-caption text-outline">{l.decisionNote}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (l) => l.status === "Pending"
      ? <div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy === l.id} onClick={() => decide(l, "Approved").catch(() => {})}>Approve</Button><Button size="sm" variant="ghost" className="!text-error" disabled={busy === l.id} onClick={() => setRejecting(l)}>Reject</Button></div> : null },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <Tabs value={tab} onChange={setTab} items={[{ id: "Pending", label: "Pending", count: n("Pending") }, { id: "Approved", label: "Approved", count: n("Approved") }, { id: "Rejected", label: "Rejected", count: n("Rejected") }, { id: "all", label: "All", count: inClass.length }]} />
        <Select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="w-40"><option value="">All classes</option>{classIds.map((c) => <option key={c} value={c}>Grade {label(c)}</option>)}</Select>
        <p className="t-caption ml-auto max-w-sm text-outline">Requests come from the parent app and are decided by the class teacher. Decide here only when the class teacher is unavailable.</p>
      </div>
      {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading leave requests…</p>
        : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="No leave requests" hint="Leave requests sent by parents from the parent app show up here." />} />}
      <ReasonModal ids={rejecting ? [rejecting.id] : null} title="Reject leave request" label="Note to the parent" onClose={() => setRejecting(null)}
        onSubmit={async (_ids, reason) => { if (rejecting) await decide(rejecting, "Rejected", reason); }} />
    </Card>
  );
}
