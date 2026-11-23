"use client";
// Leave & check-in (contract §2 /me/leave): the teacher app's Apply Leave / Leave Management / self-log screens on the web.
// Own `staff_leaves` (+ the admin inbox mirror in `approvals`), the leave balance from `set_leave_policy`, own
// `staff_attendance` days and `staff_regularizations`. Every write is the app's document shape (logic.ts).
import { useMemo, useState } from "react";
import { CalendarPlus, Wrench } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, ProgressBar, Select, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { t12, useLeavePolicy } from "@/features/people/checkins";
import { mirrorRow } from "@/features/people/leaves";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { isoNow, todayIso } from "../shared";
import { CheckInCard, useMyDays } from "./CheckInCard";
import {
  balanceOf, byNewest, emptyLeaveDraft, emptyRegDraft, leaveDoc, newLeaveId, newRegId, regularizationDoc, REG_TYPES, statusTone,
  validateLeave, validateRegularization, withdrawnDoc, type LeaveDraft, type PortalLeave, type PortalRegularization, type RegDraft, type StaffDay,
} from "./logic";
import { deletePortalDoc, setPortalDoc } from "./writes";

const TABS = [{ id: "requests", label: "Leave requests" }, { id: "balance", label: "Leave balance" }, { id: "checkins", label: "Check-ins" }, { id: "regularizations", label: "Regularizations" }];
const range = (l: Pick<PortalLeave, "from" | "to">) => (l.to && l.to !== l.from ? `${l.from} to ${l.to}` : l.from);
const day = (iso?: string) => (iso ? iso.slice(0, 10) : "—");

export function LeaveView() {
  const { user, staffId, record, name, teaching, ready } = useStaffProfile();
  const uid = user?.id ?? "";
  const policy = useLeavePolicy();
  const toast = useToast();
  const [tab, setTab] = useState("requests");
  const liveCol = useCollection<PortalLeave>("staff_leaves", !!staffId, [["staffId", "==", staffId]] as const);
  // private copies of withdrawn requests: the rules give private `lm_*` collections to teacher accounts only
  const withdrawnCol = useCollection<PortalLeave>("lm_withdrawn", !!staffId, [["teacherId", "==", staffId]] as const);
  const regsCol = useCollection<PortalRegularization>("staff_regularizations", !!staffId, [["staffId", "==", staffId]] as const);
  const days = useMyDays();
  const live = useMemo(() => liveCol.rows.filter((l) => l.staffId === staffId), [liveCol.rows, staffId]);
  const leaves = useMemo(() => {
    const ids = new Set(live.map((l) => l.id));
    return byNewest([...live, ...withdrawnCol.rows.filter((w) => w.teacherId === staffId && !ids.has(w.id)).map((w) => ({ ...w, status: "Cancelled" }))]);
  }, [live, withdrawnCol.rows, staffId]);
  const regs = useMemo(() => byNewest(regsCol.rows.filter((r) => r.staffId === staffId)), [regsCol.rows, staffId]);
  const balance = useMemo(() => balanceOf(policy.types, live, staffId), [policy.types, live, staffId]);
  const today = todayIso();

  // ---- apply ----
  const [apply, setApply] = useState(false);
  const [draft, setDraft] = useState<LeaveDraft>(() => emptyLeaveDraft("", today));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const openApply = () => { setDraft(emptyLeaveDraft(policy.types[0]?.type ?? "", today)); setErrors({}); setApply(true); };
  const set = (k: keyof LeaveDraft, v: string) => { setDraft((d) => ({ ...d, [k]: v })); setErrors((e) => { const { [k]: _k, ...rest } = e; void _k; return rest; }); };
  const submit = async () => {
    const e = validateLeave(draft, policy.types, live, staffId);
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    const id = newLeaveId();
    const docBody = leaveDoc(id, draft, staffId, uid);
    try {
      await setPortalDoc("staff_leaves", id, docBody);
      // the admin Approvals inbox row (people/leaves.ts mirrorRow): same id convention, so the admin web never duplicates it
      const staffRef = record ? { id: record.id, name: record.name || name, department: record.department ?? "Staff" } : undefined;
      const mirror = mirrorRow({ id, staffId, type: docBody.type, from: docBody.from, to: docBody.to, days: docBody.days, reason: docBody.reason, status: "Pending", createdAt: docBody.createdAt }, staffRef);
      await setPortalDoc("approvals", mirror.id, { ...mirror, updatedAt: isoNow(), updatedBy: uid });
      toast("Leave application submitted for approval");
      setApply(false);
    } catch { toast("Could not submit the leave request", "error"); }
    finally { setBusy(false); }
  };

  // ---- withdraw ----
  const [withdraw, setWithdraw] = useState<PortalLeave | null>(null);
  const confirmWithdraw = async () => {
    if (!withdraw) return;
    setBusy(true);
    try {
      await setPortalDoc("lm_withdrawn", withdraw.id, withdrawnDoc(withdraw, staffId, uid));
      await deletePortalDoc("staff_leaves", withdraw.id);
      toast("Leave request withdrawn");
      setWithdraw(null);
    } catch { toast("Could not withdraw the request", "error"); }
    finally { setBusy(false); }
  };

  // ---- regularization ----
  const [reg, setReg] = useState(false);
  const [regDraft, setRegDraft] = useState<RegDraft>(() => emptyRegDraft(today));
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});
  const openReg = () => { setRegDraft(emptyRegDraft(today)); setRegErrors({}); setReg(true); };
  const setR = (k: keyof RegDraft, v: string) => { setRegDraft((d) => ({ ...d, [k]: v })); setRegErrors((e) => { const { [k]: _k, ...rest } = e; void _k; return rest; }); };
  const submitReg = async () => {
    const e = validateRegularization(regDraft, today);
    setRegErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { const id = newRegId(); await setPortalDoc("staff_regularizations", id, regularizationDoc(id, regDraft, staffId, uid)); toast("Correction request sent"); setReg(false); }
    catch { toast("Could not send the correction request", "error"); }
    finally { setBusy(false); }
  };

  const leaveColumns: Column<PortalLeave>[] = [
    { key: "type", header: "Type", sortValue: (l) => l.type, render: (l) => <span className="font-medium">{l.type || "Leave"}</span> },
    { key: "dates", header: "Dates", sortValue: (l) => l.from, render: (l) => range(l) },
    { key: "days", header: "Days", sortValue: (l) => Number(l.days) || 0, render: (l) => String(l.days ?? "—") },
    { key: "reason", header: "Reason", render: (l) => <span className="text-on-surface-variant">{l.reason}</span> },
    { key: "status", header: "Status", sortValue: (l) => l.status, render: (l) => <Badge tone={statusTone(l.status)}>{l.status}</Badge> },
    { key: "decision", header: "Decision", render: (l) => <span className="text-on-surface-variant">{l.decisionNote || (l.decidedAt ? day(l.decidedAt) : l.withdrawnAt ? `Withdrawn ${day(l.withdrawnAt)}` : "Awaiting the office")}</span> },
    { key: "act", header: "", render: (l) => l.status === "Pending" ? <Button size="sm" variant="ghost" onClick={() => setWithdraw(l)}>Withdraw</Button> : null },
  ];
  const dayColumns: Column<StaffDay>[] = [
    { key: "date", header: "Date", sortValue: (d) => d.date, render: (d) => <span className="font-medium">{d.date}</span> },
    { key: "in", header: "In", render: (d) => (d.in ? t12(d.in) : "—") },
    { key: "out", header: "Out", render: (d) => (d.out ? t12(d.out) : "—") },
    { key: "status", header: "Status", sortValue: (d) => d.status, render: (d) => <Badge tone={d.status === "Late" ? "warning" : d.status === "Leave" ? "info" : d.status === "Irregular" ? "danger" : "success"}>{d.status || "Present"}</Badge> },
    { key: "source", header: "Source", render: (d) => <span className="text-on-surface-variant">{d.source || "app"}</span> },
    { key: "note", header: "Note", render: (d) => <span className="text-on-surface-variant">{d.note || ""}</span> },
  ];
  const regColumns: Column<PortalRegularization>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => <span className="font-medium">{r.date}</span> },
    { key: "type", header: "Punch", render: (r) => r.type },
    { key: "time", header: "Time", render: (r) => t12(r.time) },
    { key: "reason", header: "Reason", render: (r) => <span className="text-on-surface-variant">{r.reason}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => <Badge tone={statusTone(r.status)}>{r.status}</Badge> },
    { key: "decision", header: "Decision", render: (r) => <span className="text-on-surface-variant">{r.decisionNote || (r.decidedAt ? day(r.decidedAt) : "Awaiting the office")}</span> },
  ];

  if (!ready) return <p className="text-on-surface-variant">Loading…</p>;
  if (!staffId) return <EmptyState title="No staff record" hint="Your login is not linked to a staff record. Contact your school administrator." />;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="t-headline-lg">Leave &amp; check-in</h1><p className="text-sm text-on-surface-variant">Your leave requests, balance, daily check-ins and attendance corrections.</p></div>
        {tab === "regularizations"
          ? <Button onClick={openReg}><Wrench size={16} />Request correction</Button>
          : <Button onClick={openApply}><CalendarPlus size={16} />Apply for leave</Button>}
      </div>
      <Tabs items={TABS.map((t) => (t.id === "requests" ? { ...t, count: live.filter((l) => l.status === "Pending").length } : t))} value={tab} onChange={setTab} variant="underline" />

      {tab === "requests" && <Card className="p-0">
        <DataTable rows={leaves} columns={leaveColumns} searchText={(l) => `${l.type} ${l.reason} ${l.status}`}
          empty={<EmptyState title="No leave requests yet" hint="Apply for leave and the office will see it in their approvals queue." action={<Button onClick={openApply}>Apply for leave</Button>} />} />
      </Card>}

      {tab === "balance" && (balance.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {balance.map((b) => (
            <Card key={b.id} role="group" aria-label={b.name} className="p-5">
              <CardHeader className="p-0 pb-2" title={b.name} subtitle={b.type} />
              <p className="t-headline-md">{b.left} <span className="text-sm font-normal text-on-surface-variant">of {b.total} days left</span></p>
              <ProgressBar value={b.total ? (b.used / b.total) * 100 : 0} tone={b.left === 0 ? "danger" : "brand"} className="mt-2" />
              <p className="mt-1 text-xs text-on-surface-variant">{b.used} day{b.used === 1 ? "" : "s"} used (approved leave)</p>
            </Card>
          ))}
        </div>
      ) : <EmptyState title="No leave policy yet" hint="The office has not set up leave types." />)}

      {tab === "checkins" && <div className="space-y-4">
        <CheckInCard />
        <Card className="p-0">
          <DataTable rows={[...days.rows].sort((a, b) => b.date.localeCompare(a.date))} columns={dayColumns} searchText={(d) => `${d.date} ${d.status}`}
            empty={<EmptyState title="No check-ins yet" hint="Your daily check-ins from the app or this portal appear here." />} />
        </Card>
      </div>}

      {tab === "regularizations" && <Card className="p-0">
        <DataTable rows={regs} columns={regColumns} searchText={(r) => `${r.date} ${r.type} ${r.reason} ${r.status}`}
          empty={<EmptyState title="No correction requests" hint="Missed or wrong punch? Ask the office to regularize it." action={<Button onClick={openReg}>Request correction</Button>} />} />
      </Card>}

      <Modal open={apply} onClose={() => setApply(false)} title="Apply for leave" subtitle="The office decides your request from their approvals queue."
        footer={<><Button variant="ghost" onClick={() => setApply(false)}>Cancel</Button><Button onClick={submit} disabled={busy}>Submit request</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Leave type" required error={errors.type} className="sm:col-span-2">
            <Select value={draft.type} onChange={(e) => set("type", e.target.value)}>
              {policy.types.map((t) => <option key={t.id} value={t.type}>{t.name}{balance.find((b) => b.id === t.id) ? ` · ${balance.find((b) => b.id === t.id)!.left} left` : ""}</option>)}
            </Select>
          </Field>
          <Field label="From" required error={errors.from}><Input type="date" value={draft.from} onChange={(e) => set("from", e.target.value)} /></Field>
          <Field label="To" required error={errors.to}><Input type="date" value={draft.to} onChange={(e) => set("to", e.target.value)} /></Field>
          <Field label="Reason" required error={errors.reason} hint="At least 10 characters" className="sm:col-span-2"><Textarea rows={3} maxLength={2000} value={draft.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Briefly explain the reason for leave" /></Field>
          <Field label="Handover note" error={errors.note} hint={teaching ? "Who covers your classes, pending work, where to find things" : "Pending work and who to contact while you are away"} className="sm:col-span-2"><Textarea rows={2} maxLength={2000} value={draft.note} onChange={(e) => set("note", e.target.value)} /></Field>
        </div>
      </Modal>

      <Modal open={!!withdraw} onClose={() => setWithdraw(null)} title="Withdraw leave request" subtitle={withdraw ? `${withdraw.type || "Leave"} · ${range(withdraw)}` : ""}
        footer={<><Button variant="ghost" onClick={() => setWithdraw(null)}>Keep request</Button><Button variant="danger" onClick={confirmWithdraw} disabled={busy}>Withdraw</Button></>}>
        <p className="text-sm text-on-surface-variant">The request is removed from the office&apos;s approvals queue. A cancelled copy stays in your history.</p>
      </Modal>

      <Modal open={reg} onClose={() => setReg(false)} title="Request correction" subtitle="Ask the office to regularize a missed or wrong punch."
        footer={<><Button variant="ghost" onClick={() => setReg(false)}>Cancel</Button><Button onClick={submitReg} disabled={busy}>Send request</Button></>}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Date" required error={regErrors.date}><Input type="date" value={regDraft.date} max={today} onChange={(e) => setR("date", e.target.value)} /></Field>
          <Field label="Punch" required error={regErrors.type}><Select value={regDraft.type} onChange={(e) => setR("type", e.target.value)}>{REG_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</Select></Field>
          <Field label="Correct time" required error={regErrors.time} hint="HH:mm, 24-hour"><Input type="time" value={regDraft.time} onChange={(e) => setR("time", e.target.value)} /></Field>
          <Field label="Reason" required error={regErrors.reason}><Input value={regDraft.reason} onChange={(e) => setR("reason", e.target.value)} placeholder="Forgot to punch in" /></Field>
          <Field label="Note" className="sm:col-span-2"><Textarea rows={2} value={regDraft.note} onChange={(e) => setR("note", e.target.value)} /></Field>
        </div>
      </Modal>
    </div>
  );
}
