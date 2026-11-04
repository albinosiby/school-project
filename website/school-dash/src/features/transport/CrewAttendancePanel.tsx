"use client";
// Transport > Crew attendance: driver-app punches (tr_crew_attendance, contract 14.5) per month, admin corrections, check-in policy.
import { useMemo, useState } from "react";
import { AlarmClock, Pencil, Plus, Save } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Select, useToast, type Column, type Tone } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { todayIso } from "@/features/ops/shared";
import { ROLE_LABEL, crewAttId, t12, useTransportSettings } from "./shared";
import { CREW_ATT_STATUS as STATUS, crewDayBody, effectiveCrewStatus as effectiveStatus, isHHmm, isLateIn as isLate, validateCrewDay } from "./logic";
import type { Crew, CrewAttStatus, CrewAttendance, CrewRole } from "./types";

const tone: Record<CrewAttStatus, Tone> = { Present: "success", Late: "warning", Absent: "danger", Leave: "info" };
type DayBody = ReturnType<typeof crewDayBody>;

export function CrewAttendancePanel() {
  const toast = useToast();
  const att = useCollection<CrewAttendance>("tr_crew_attendance");
  const crew = useCollection<Crew>("tr_crew").rows;
  const policy = useTransportSettings();
  const [month, setMonth] = useState(() => todayIso().slice(0, 7));
  const [role, setRole] = useState(""); const [crewId, setCrewId] = useState("");
  const [edit, setEdit] = useState<{ rec?: CrewAttendance; crewId: string; date: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const [checkInBy, setCheckInBy] = useState<string | null>(null);
  const [policyErr, setPolicyErr] = useState("");

  const rows = useMemo(() => att.rows.filter((r) => r.date?.startsWith(month) && (!role || r.role === role) && (!crewId || r.crewId === crewId)).sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name)), [att.rows, month, role, crewId]);
  const effective = (r: CrewAttendance) => effectiveStatus(r, policy.checkInBy);
  const summary = useMemo(() => crew.filter((c) => (!role || c.role === role) && (!crewId || c.id === crewId)).map((c) => {
    const mine = att.rows.filter((r) => r.crewId === c.id && r.date?.startsWith(month));
    const n = (st: CrewAttStatus) => mine.filter((r) => effectiveStatus(r, policy.checkInBy) === st).length;
    return { id: c.id, c, present: n("Present"), late: n("Late"), absent: n("Absent"), leave: n("Leave") };
  }).sort((a, b) => a.c.name.localeCompare(b.c.name)), [crew, att.rows, month, role, crewId, policy.checkInBy]);

  async function saveDay(cid: string, date: string, v: DayBody) {
    const c = crew.find((x) => x.id === cid); if (!c) return;
    const id = crewAttId(date, cid);
    const body = { crewId: cid, name: c.name, role: c.role, busId: c.busId ?? "", date, ...v, source: "admin" as const };
    if (att.rows.some((a) => a.id === id)) await att.update(id, body); else await att.create({ id, ...body });
  }
  const cols: Column<CrewAttendance>[] = [
    { key: "date", header: "Day", sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: "who", header: "Crew member", sortValue: (r) => r.name, render: (r) => <div><div className="font-semibold">{r.name}</div><div className="t-caption text-outline">{ROLE_LABEL[r.role] ?? r.role}</div></div> },
    { key: "bus", header: "Bus", sortValue: (r) => r.busId ?? "", render: (r) => { const b = crew.find((c) => c.id === r.crewId)?.bus; return r.busId ? <Badge tone="brand">{b ?? r.busId}</Badge> : <span className="text-outline">—</span>; } },
    { key: "in", header: "In", sortValue: (r) => r.in ?? "99", render: (r) => <span className={isLate(r.in, policy.checkInBy) ? "font-mono text-warning" : "font-mono"}>{t12(r.in)}</span> },
    { key: "out", header: "Out", sortValue: (r) => r.out ?? "99", render: (r) => <span className="font-mono">{t12(r.out)}</span> },
    { key: "status", header: "Status", sortValue: (r) => effective(r), render: (r) => <div><Badge tone={tone[effective(r)] ?? "neutral"}>{effective(r)}</Badge>{r.note && <div className="t-caption mt-0.5 text-outline">{r.note}</div>}</div> },
    { key: "source", header: "Source", sortValue: (r) => r.source, render: (r) => <span className="text-sm text-on-surface-variant">{r.source === "admin" ? "Admin correction" : "Driver app"}</span> },
    { key: "act", header: "", className: "text-right", render: (r) => <Button size="sm" variant="ghost" onClick={() => setEdit({ rec: r, crewId: r.crewId, date: r.date })}><Pencil size={14} />Correct</Button> },
  ];
  type Sum = (typeof summary)[number];
  const sumCols: Column<Sum>[] = [
    { key: "who", header: "Crew member", sortValue: (r) => r.c.name, render: (r) => <div><div className="font-semibold">{r.c.name}</div><div className="t-caption text-outline">{ROLE_LABEL[r.c.role]}{r.c.bus ? ` · ${r.c.bus}` : ""}</div></div> },
    { key: "present", header: "Present", sortValue: (r) => r.present, render: (r) => r.present },
    { key: "late", header: "Late", sortValue: (r) => r.late, render: (r) => <span className={r.late ? "text-warning" : ""}>{r.late}</span> },
    { key: "absent", header: "Absent", sortValue: (r) => r.absent, render: (r) => <span className={r.absent ? "text-error" : ""}>{r.absent}</span> },
    { key: "leave", header: "Leave", sortValue: (r) => r.leave, render: (r) => r.leave },
    { key: "act", header: "", className: "text-right", render: (r) => <Button size="sm" variant="ghost" onClick={() => { setCrewId(r.id); }}>View days</Button> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <Card className="pt-1">
          <CardHeader title="Monthly summary" subtitle={`Days per crew member in ${new Date(`${month}-01T12:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}.`} />
          <DataTable rows={summary} columns={sumCols} pageSize={8} empty={<EmptyState title="No crew" hint="Add drivers and bus staff first." />} />
        </Card>
        <Card className="p-5">
          <div className="mb-3 flex items-center gap-2 text-on-surface-variant"><AlarmClock size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Check-in policy</span></div>
          <Field label="Crew must check in by" hint="tr_settings/policy.checkInBy — later punches count as Late." error={policyErr}><Input type="time" value={checkInBy ?? policy.checkInBy} onChange={(e) => { setCheckInBy(e.target.value); setPolicyErr(""); }} /></Field>
          <Button size="sm" className="mt-3" disabled={checkInBy === null || checkInBy === policy.checkInBy} onClick={async () => {
            if (!isHHmm(checkInBy)) { setPolicyErr("Enter a time as HH:mm"); return; }
            try { await policy.save(checkInBy); setCheckInBy(null); toast("Check-in time saved"); } catch { toast("Could not save the policy", "error"); } }}><Save size={14} />Save</Button>
        </Card>
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-end gap-3 px-5">
          <Field label="Month"><Input type="month" value={month} max={todayIso().slice(0, 7)} onChange={(e) => e.target.value && setMonth(e.target.value)} className="w-44" /></Field>
          <Field label="Role"><Select value={role} onChange={(e) => { setRole(e.target.value); setCrewId(""); }} className="w-36"><option value="">All roles</option><option value="driver">Drivers</option><option value="attendant">Bus staff</option></Select></Field>
          <Field label="Crew member"><Select value={crewId} onChange={(e) => setCrewId(e.target.value)} className="w-52"><option value="">Everyone</option>{crew.filter((c) => !role || c.role === (role as CrewRole)).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <Button variant="outline" className="ml-auto" onClick={() => setAdding(true)}><Plus size={14} />Add day</Button>
        </div>
        {!att.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading…</p> : <DataTable rows={rows} columns={cols} pageSize={15} empty={<EmptyState title="No check-ins this month" hint="Crew punch in and out from the driver app. Use Add day to record one by hand." />} />}
      </Card>
      {adding && <PickDayModal crew={crew} onClose={() => setAdding(false)} onPick={(cid, date) => { setAdding(false); setEdit({ rec: att.rows.find((a) => a.id === crewAttId(date, cid)), crewId: cid, date }); }} />}
      {edit && <CorrectModal key={`${edit.crewId}_${edit.date}`} rec={edit.rec} name={crew.find((c) => c.id === edit.crewId)?.name ?? edit.crewId} date={edit.date} checkInBy={policy.checkInBy} onClose={() => setEdit(null)}
        onSave={async (v) => { try { await saveDay(edit.crewId, edit.date, v); toast("Day saved"); setEdit(null); } catch { toast("Could not save the correction", "error"); } }} />}
    </div>
  );
}

function PickDayModal({ crew, onClose, onPick }: { crew: Crew[]; onClose: () => void; onPick: (crewId: string, date: string) => void }) {
  const [cid, setCid] = useState(crew[0]?.id ?? ""); const [date, setDate] = useState(todayIso);
  const future = !!date && date > todayIso();
  return (
    <Modal open onClose={onClose} title="Add a day" subtitle="Record a check-in the driver app missed" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={!cid || !date || future} onClick={() => onPick(cid, date)}>Continue</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Crew member"><Select value={cid} onChange={(e) => setCid(e.target.value)}>{crew.map((c) => <option key={c.id} value={c.id}>{c.name} · {ROLE_LABEL[c.role]}</option>)}</Select></Field>
        <Field label="Date" error={future ? "The date cannot be in the future" : undefined}><Input type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function CorrectModal({ rec, name, date, checkInBy, onClose, onSave }: { rec?: CrewAttendance; name: string; date: string; checkInBy: string; onClose: () => void; onSave: (v: DayBody) => Promise<void> }) {
  const [inT, setIn] = useState(rec?.in ?? ""); const [outT, setOut] = useState(rec?.out ?? "");
  const [status, setStatus] = useState<CrewAttStatus>(rec?.status ?? "Present"); const [note, setNote] = useState(rec?.note ?? "");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const noTimes = status === "Absent" || status === "Leave";
  const setInTime = (v: string) => { setIn(v); setErr({}); if (v && !noTimes) setStatus(isLate(v, checkInBy) ? "Late" : "Present"); };
  async function submit() {
    const v = { in: inT, out: outT, status, note };
    const e = validateCrewDay(v); setErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try { await onSave(crewDayBody(v, checkInBy)); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title={rec ? "Correct check-in" : "Record a day"} subtitle={`${name} · ${fmtDate(date)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Save"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Status" className="sm:col-span-2" error={err.status}><Select value={status} onChange={(e) => { setStatus(e.target.value as CrewAttStatus); setErr({}); }}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Check-in" error={err.in} hint={`Late after ${t12(checkInBy)}`}><Input type="time" value={inT} disabled={noTimes} onChange={(e) => setInTime(e.target.value)} /></Field>
        <Field label="Check-out" error={err.out}><Input type="time" value={outT} disabled={noTimes} onChange={(e) => { setOut(e.target.value); setErr({}); }} /></Field>
        <Field label="Note" className="sm:col-span-2"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Phone battery dead, verified by transport in-charge" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Saved as an admin correction (source: admin). The crew member sees it in the driver app.</p>
    </Modal>
  );
}
