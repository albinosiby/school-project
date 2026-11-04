"use client";
// Staff > Check-ins: teacher app punches (staff_attendance) for one day, admin corrections, regularization requests.
// Data contract section 12.1.
import { useMemo, useState } from "react";
import { AlarmClock, CalendarOff, Pencil, UserCheck, UserX } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Select, Stat, Tabs, Textarea, useToast, type Column, type Tone } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import type { StaffLeave } from "./leaves";
import { attId, dayStatus, isLate, localToday, t12, useLeavePolicy, useRegularizations, validateCorrection, type DayStatus, type PunchStatus, type Regularization, type RegStatus, type StaffAttendance } from "./checkins";
import { approvedLeaveOn } from "./leaves";

type S = { id: string; name: string; department: string; empId?: string };
type Row = { id: string; staff: S; rec?: StaffAttendance; status: DayStatus };

const statusTone: Record<DayStatus, Tone> = { Present: "success", Late: "warning", Leave: "info", "On leave": "info", Irregular: "danger", "Not checked in": "neutral" };
const regTone: Record<RegStatus, Tone> = { Pending: "warning", Approved: "success", Rejected: "danger" };
const plain = (n: string) => n.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "");

export function CheckinsPanel({ staff }: { staff: S[] }) {
  const toast = useToast();
  const { regs, att, saveDay, decide: decideReg } = useRegularizations();
  const leaves = useCollection<StaffLeave>("staff_leaves").rows;
  const policy = useLeavePolicy();
  const [date, setDate] = useState(localToday);
  const [edit, setEdit] = useState<Row | null>(null);
  const [deciding, setDeciding] = useState<{ r: Regularization; to: "Approved" | "Rejected" } | null>(null);
  const [regTab, setRegTab] = useState("Pending");

  const teaching = useMemo(() => staff.filter((s) => s.department !== "Administration").sort((a, b) => a.name.localeCompare(b.name)), [staff]);

  const rows: Row[] = useMemo(() => teaching.map((s) => {
    const rec = att.rows.find((a) => a.id === attId(date, s.id)) ?? att.rows.find((a) => a.staffId === s.id && a.date === date);
    return { id: s.id, staff: s, rec, status: dayStatus(rec, !!approvedLeaveOn(leaves, s.id, date), policy.checkInBy) };
  }), [teaching, att.rows, date, policy.checkInBy, leaves]);

  const count = (...st: DayStatus[]) => rows.filter((r) => st.includes(r.status)).length;


  const cols: Column<Row>[] = [
    { key: "who", header: "Staff member", sortValue: (r) => r.staff.name, render: (r) => (
      <div className="flex items-center gap-3"><Avatar name={plain(r.staff.name)} /><div><div className="font-semibold">{r.staff.name}</div><div className="t-caption text-outline">{r.staff.department}</div></div></div>) },
    { key: "in", header: "Check-in", sortValue: (r) => r.rec?.in ?? "99", render: (r) => <span className={isLate(r.rec?.in, policy.checkInBy) ? "font-mono text-warning" : "font-mono"}>{t12(r.rec?.in)}</span> },
    { key: "out", header: "Check-out", sortValue: (r) => r.rec?.out ?? "99", render: (r) => <span className="font-mono">{t12(r.rec?.out)}</span> },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => (
      <div><Badge tone={statusTone[r.status]}>{r.status}</Badge>
        {r.rec && <div className="t-caption mt-0.5 text-outline">{r.rec.source === "admin" ? "Corrected by admin" : "Teacher app"}{r.rec.note ? ` · ${r.rec.note}` : ""}</div>}</div>) },
    { key: "act", header: "", className: "text-right", render: (r) => <Button size="sm" variant="ghost" onClick={() => setEdit(r)}><Pencil size={14} />Correct</Button> },
  ];

  const who = (id: string) => staff.find((s) => s.id === id);
  const nReg = (st: string) => regs.rows.filter((r) => r.status === st).length;
  const order: Record<string, number> = { Pending: 0, Approved: 1, Rejected: 2 };
  const regView = regs.rows.filter((r) => regTab === "all" || r.status === regTab)
    .sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || (b.date ?? "").localeCompare(a.date ?? "") || (b.at ?? "").localeCompare(a.at ?? ""));

  const decide = async (r: Regularization, to: "Approved" | "Rejected", note: string) => {
    try {
      await decideReg(r, to, note);
      toast(`Request ${to.toLowerCase()}`);
      return true;
    } catch { toast("Could not save the decision", "error"); return false; }
  };

  const regCols: Column<Regularization>[] = [
    { key: "who", header: "Staff member", sortValue: (r) => who(r.staffId)?.name ?? r.staffId, render: (r) => { const s = who(r.staffId);
      return <div className="flex items-center gap-3"><Avatar name={plain(s?.name ?? r.staffId)} /><div><div className="font-semibold">{s?.name ?? r.staffId}</div><div className="t-caption text-outline">{s?.department}</div></div></div>; } },
    { key: "date", header: "Day", sortValue: (r) => r.date ?? "", render: (r) => (r.date ? fmtDate(r.date) : "—") },
    { key: "type", header: "Correction", render: (r) => <div>{r.type}<div className="t-caption font-mono text-outline">{t12(r.time)}</div></div> },
    { key: "reason", header: "Reason", render: (r) => <div className="max-w-[260px] text-sm"><div>{r.reason || "—"}</div>{r.note && <div className="t-caption text-outline">{r.note}</div>}</div> },
    { key: "status", header: "Status", sortValue: (r) => order[r.status] ?? 3, render: (r) => <div><Badge tone={regTone[r.status] ?? "neutral"}>{r.status}</Badge>{r.decisionNote && <div className="t-caption mt-0.5 max-w-[200px] text-outline">{r.decisionNote}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (r) => r.status === "Pending"
      ? <div className="flex justify-end gap-2"><Button size="sm" onClick={() => setDeciding({ r, to: "Approved" })}>Approve</Button><Button size="sm" variant="outline" className="!text-error" onClick={() => setDeciding({ r, to: "Rejected" })}>Reject</Button></div>
      : null },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Present" value={count("Present", "Irregular")} icon={<UserCheck size={16} />} />
        <Stat label="Late" value={count("Late")} sub={`after ${t12(policy.checkInBy)}`} subTone="warning" icon={<AlarmClock size={16} />} />
        <Stat label="Not checked in" value={count("Not checked in")} icon={<UserX size={16} />} />
        <Stat label="On leave" value={count("On leave", "Leave")} icon={<CalendarOff size={16} />} />
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-end gap-3 px-5">
          <Field label="Date"><Input type="date" value={date} max={localToday()} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" /></Field>
          {date !== localToday() && <Button variant="ghost" size="sm" onClick={() => setDate(localToday())}>Today</Button>}
          <p className="t-caption ml-auto text-outline">Teachers check in from the mobile app. Late = check-in after {t12(policy.checkInBy)} (Settings › Leave policy).</p>
        </div>
        {!att.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading check-ins…</p> : <DataTable rows={rows} columns={cols} pageSize={12} searchText={(r) => `${r.staff.name} ${r.staff.department} ${r.status}`}
          empty={<EmptyState title="No teaching staff" hint="Add teachers in the Directory tab." />} />}
      </Card>

      <Card className="pt-1">
        <CardHeader title="Regularization requests" subtitle="Missed or wrong punches raised from the teacher app. Approving fixes that day's check-in record." />
        <div className="mb-3 px-5">
          <Tabs value={regTab} onChange={setRegTab} items={[{ id: "Pending", label: "Pending", count: nReg("Pending") }, { id: "Approved", label: "Approved", count: nReg("Approved") }, { id: "Rejected", label: "Rejected", count: nReg("Rejected") }, { id: "all", label: "All", count: regs.rows.length }]} />
        </div>
        {!regs.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading requests…</p> : <DataTable rows={regView} columns={regCols} pageSize={8} empty={<EmptyState title="No regularization requests" hint="Requests raised by teachers in the mobile app show up here." />} />}
      </Card>

      {edit && <CorrectModal row={edit} date={date} checkInBy={policy.checkInBy} onClose={() => setEdit(null)}
        onSave={async (v) => { try { await saveDay(edit.staff.id, date, v); toast("Check-in corrected"); setEdit(null); } catch { toast("Could not save the correction", "error"); } }} />}
      {deciding && <DecideModal r={deciding.r} to={deciding.to} name={who(deciding.r.staffId)?.name ?? deciding.r.staffId} onClose={() => setDeciding(null)}
        onSubmit={async (note) => { if (await decide(deciding.r, deciding.to, note)) setDeciding(null); }} />}
    </div>
  );
}

function CorrectModal({ row, date, checkInBy, onClose, onSave }: { row: Row; date: string; checkInBy: string; onClose: () => void; onSave: (v: { in: string | null; out: string | null; status: PunchStatus; note: string }) => Promise<void> }) {
  const r = row.rec;
  const [inT, setIn] = useState(r?.in ?? "");
  const [outT, setOut] = useState(r?.out ?? "");
  const [status, setStatus] = useState<PunchStatus>(r?.status ?? (row.status === "On leave" ? "Leave" : "Present"));
  const [note, setNote] = useState(r?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<Record<string, string>>({});
  const setInTime = (v: string) => { setIn(v); if (v && (status === "Present" || status === "Late")) setStatus(isLate(v, checkInBy) ? "Late" : "Present"); };
  return (
    <Modal open onClose={onClose} title="Correct check-in" subtitle={`${row.staff.name} · ${fmtDate(date)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={async () => {
        const { errors, value } = validateCorrection({ in: inT, out: outT, status, note }, checkInBy);
        setErr(errors); if (!value) return;
        setSaving(true);
        try { await onSave(value); } finally { setSaving(false); }
      }}>{saving ? "Saving…" : "Save correction"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" className="sm:col-span-2" error={err.status}><Select value={status} onChange={(e) => setStatus(e.target.value as PunchStatus)}>{(["Present", "Late", "Leave", "Irregular"] as const).map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Check-in" error={err.in} hint={`Late after ${t12(checkInBy)}`}><Input type="time" value={inT} disabled={status === "Leave"} onChange={(e) => setInTime(e.target.value)} /></Field>
        <Field label="Check-out" error={err.out}><Input type="time" value={outT} disabled={status === "Leave"} onChange={(e) => setOut(e.target.value)} /></Field>
        <Field label="Note" className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Biometric terminal down, verified by office" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Saved as an admin correction (source: admin). The teacher sees it in the app.</p>
    </Modal>
  );
}

function DecideModal({ r, to, name, onClose, onSubmit }: { r: Regularization; to: "Approved" | "Rejected"; name: string; onClose: () => void; onSubmit: (note: string) => Promise<void> }) {
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const approve = to === "Approved";
  return (
    <Modal open onClose={onClose} title={approve ? "Approve regularization" : "Reject regularization"} subtitle={`${name} · ${fmtDate(r.date)} · ${r.type} ${t12(r.time)}`}
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant={approve ? "primary" : "danger"} disabled={saving} onClick={async () => {
        if (!approve && note.trim().length < 5) { setErr("Please enter at least 5 characters."); return; }
        setSaving(true);
        try { await onSubmit(note.trim()); } finally { setSaving(false); }
      }}>{approve ? "Approve" : "Reject"}</Button></>}>
      {approve && <p className="mb-3 text-sm text-on-surface-variant">The {r.type === "Check-out" ? "check-out" : "check-in"} for this day is set to {t12(r.time)} and the day is marked Present.</p>}
      <Field label={approve ? "Note (optional)" : "Reason for rejection"} required={!approve} error={err}>
        <Textarea value={note} onChange={(e) => { setNote(e.target.value); setErr(""); }} placeholder="Visible to the teacher in the app" autoFocus /></Field>
    </Modal>
  );
}
