"use client";
// Transport > Attendance: student bus attendance (tr_attendance, contract 14.4) by trip and by student, with admin corrections.
import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import { deleteField, setDoc, updateDoc } from "firebase/firestore";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, SearchBox, Select, Stat, Tabs, useToast, type Column, type Tone } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/communication/csv";
import { todayIso } from "@/features/ops/shared";
import { fmtDate } from "@/lib/format";
import type { Student } from "@/features/people/StudentsView";
import { busLabel, isoTime, schoolDoc, stamp, studentLabel, tripId } from "./shared";
import type { Bus, Mark, MarkStatus, TripAttendance, TripKind } from "./types";

type Status = MarkStatus | "none";
const LABEL: Record<Status, string> = { boarded: "Boarded", absent: "Absent", dropped: "Dropped", none: "Not marked" };
const TONE: Record<Status, Tone> = { boarded: "info", absent: "warning", dropped: "success", none: "neutral" };
const counts = (marks: Record<string, Mark>) => { const c = { boarded: 0, dropped: 0, absent: 0 }; for (const m of Object.values(marks)) c[m.status]++; return c; };
type Row = { id: string; s?: Student; name: string; mark?: Mark };

export function AttendancePanel({ init }: { init: { date?: string; bus?: string; kind?: string } }) {
  const toast = useToast();
  const att = useCollection<TripAttendance>("tr_attendance");
  const buses = useCollection<Bus>("tr_buses").rows;
  const students = useCollection<Student>("students").rows;
  const [mode, setMode] = useState("trip");
  const [date, setDate] = useState(init.date || todayIso());
  const [busId, setBusId] = useState(init.bus ?? "");
  const [kind, setKind] = useState<TripKind>(init.kind === "drop" ? "drop" : "pickup");
  const [busy, setBusy] = useState<string | null>(null);
  const bus = buses.find((b) => b.id === busId) ?? buses[0];
  const id = bus ? tripId(date, bus.id, kind) : "";
  const docRow = att.rows.find((r) => r.id === id);
  const stopName = (stopId?: string) => bus?.stops.find((s) => s.id === stopId)?.name;

  const rows: Row[] = useMemo(() => {
    if (!bus) return [];
    const marks = docRow?.marks ?? {};
    const ids = new Set([...students.filter((s) => s.busId === bus.id).map((s) => s.id), ...Object.keys(marks)]);
    return [...ids].map((sid) => { const s = students.find((x) => x.id === sid); return { id: sid, s, name: s?.name ?? sid, mark: marks[sid] }; }).sort((a, b) => a.name.localeCompare(b.name));
  }, [bus, docRow, students]);

  async function setMark(r: Row, status: Status) {
    if (!bus) return;
    setBusy(r.id);
    try {
      const marks = { ...(docRow?.marks ?? {}) };
      const stopId = r.s?.busStopId || r.mark?.stopId;
      const mark: Mark | null = status === "none" ? null : { status, at: new Date().toISOString(), by: "admin", byName: "Admin", ...(stopId ? { stopId } : {}) };
      if (mark) marks[r.id] = mark; else delete marks[r.id];
      const c = counts(marks);
      if (docRow) await updateDoc(schoolDoc("tr_attendance", id), { [`marks.${r.id}`]: mark ?? deleteField(), ...c, ...stamp() });
      else await setDoc(schoolDoc("tr_attendance", id), { id, tripId: id, busId: bus.id, bus: busLabel(bus), date, kind, total: rows.length, marks, ...c, ...stamp(), _o: Date.now() });
      toast(mark ? `${r.name}: ${LABEL[status]}` : `${r.name}: mark cleared`);
    } catch { toast("Could not save the mark", "error"); } finally { setBusy(null); }
  }
  const exportTrip = () => downloadCsv(`bus-attendance-${date}-${bus?.number ?? "bus"}-${kind}`, ["Student", "Class", "GRN", "Stop", "Status", "Time", "Marked by"],
    rows.map((r) => [r.name, r.s ? studentLabel(r.s) : "", r.s?.grn ?? "", stopName(r.mark?.stopId ?? r.s?.busStopId) ?? "", LABEL[r.mark?.status ?? "none"], r.mark ? isoTime(r.mark.at) : "", r.mark?.byName ?? r.mark?.by ?? ""]));

  const cols: Column<Row>[] = [
    { key: "name", header: "Student", sortValue: (r) => r.name, render: (r) => <div className="flex items-center gap-3"><Avatar name={r.name} /><div><div className="font-semibold">{r.name}</div><div className="t-caption text-outline">{r.s ? `${studentLabel(r.s)} · ${r.s.grn}` : "No longer on the roster"}</div></div></div> },
    { key: "stop", header: "Stop", sortValue: (r) => stopName(r.mark?.stopId ?? r.s?.busStopId) ?? "", render: (r) => stopName(r.mark?.stopId ?? r.s?.busStopId) || <span className="text-outline">—</span> },
    { key: "status", header: "Status", sortValue: (r) => r.mark?.status ?? "zz", render: (r) => <Badge tone={TONE[r.mark?.status ?? "none"]}>{LABEL[r.mark?.status ?? "none"]}</Badge> },
    { key: "time", header: "Time", sortValue: (r) => r.mark?.at ?? "", render: (r) => <span className="font-mono text-sm">{isoTime(r.mark?.at)}</span> },
    { key: "by", header: "Marked by", render: (r) => r.mark ? <span className={r.mark.by === "admin" ? "text-secondary" : ""}>{r.mark.byName || r.mark.by}</span> : <span className="text-outline">—</span> },
    { key: "act", header: "Correct", className: "text-right", render: (r) => <Select aria-label={`Status for ${r.name}`} className="w-36" value={r.mark?.status ?? "none"} disabled={busy === r.id} onChange={(e) => setMark(r, e.target.value as Status)}>{(["none", "boarded", "absent", "dropped"] as Status[]).map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}</Select> },
  ];
  const c = docRow ? { boarded: docRow.boarded, dropped: docRow.dropped, absent: docRow.absent } : counts({});

  return (
    <div className="space-y-5">
      <Tabs value={mode} onChange={setMode} items={[{ id: "trip", label: "By trip" }, { id: "student", label: "By student" }]} variant="underline" />
      {mode === "student" ? <ByStudent att={att.rows} students={students} /> : <>
        <Card className="pt-4">
          <div className="mb-3 flex flex-wrap items-end gap-3 px-5">
            <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" /></Field>
            <Field label="Bus"><Select value={bus?.id ?? ""} onChange={(e) => setBusId(e.target.value)} className="w-52">{buses.length === 0 && <option value="">No buses</option>}{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)} · {b.routeName}</option>)}</Select></Field>
            <Tabs value={kind} onChange={(k) => setKind(k as TripKind)} items={[{ id: "pickup", label: "Pickup" }, { id: "drop", label: "Drop" }]} className="pb-0.5" />
            <Button variant="outline" size="sm" className="ml-auto" disabled={!rows.length} onClick={exportTrip}><Download size={14} />Export CSV</Button>
          </div>
          <div className="mb-4 grid gap-3 px-5 sm:grid-cols-4">
            <Stat label="Students" value={rows.length} /><Stat label="Boarded" value={c.boarded} /><Stat label="Dropped" value={c.dropped} /><Stat label="Absent" value={c.absent} subTone="warning" sub={rows.length - c.boarded - c.dropped - c.absent > 0 ? `${rows.length - c.boarded - c.dropped - c.absent} unmarked` : undefined} />
          </div>
          {!att.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading attendance…</p> : !bus ? <EmptyState title="No buses" hint="Add a bus first." /> : <>
            {!docRow && <p className="px-5 pb-2 text-sm text-on-surface-variant">No {kind} trip recorded for {busLabel(bus)} on {fmtDate(date)} yet. Correcting a mark creates the record.</p>}
            <DataTable rows={rows} columns={cols} pageSize={15} searchText={(r) => `${r.name} ${r.s?.grn ?? ""}`} empty={<EmptyState title="No students on this bus" hint="Assign students in Buses › bus › Students." />} /></>}
        </Card></>}
    </div>
  );
}

type HistRow = { id: string; date: string; kind: TripKind; bus: string; mark: Mark };
function ByStudent({ att, students }: { att: TripAttendance[]; students: Student[] }) {
  const [q, setQ] = useState("");
  const [sid, setSid] = useState("");
  const s = students.find((x) => x.id === sid);
  const matches = useMemo(() => (q.trim().length < 2 ? [] : students.filter((x) => `${x.name} ${x.grn}`.toLowerCase().includes(q.toLowerCase())).slice(0, 8)), [q, students]);
  const rows: HistRow[] = useMemo(() => !sid ? [] : att.filter((a) => a.marks?.[sid]).map((a) => ({ id: a.id, date: a.date, kind: a.kind, bus: a.bus, mark: a.marks[sid]! })).sort((a, b) => b.date.localeCompare(a.date) || (a.kind === "pickup" ? -1 : 1)), [att, sid]);
  const cols: Column<HistRow>[] = [
    { key: "date", header: "Date", sortValue: (r) => r.date, render: (r) => fmtDate(r.date) },
    { key: "kind", header: "Trip", sortValue: (r) => r.kind, render: (r) => <Badge tone={r.kind === "pickup" ? "brand" : "neutral"}>{r.kind === "pickup" ? "Pickup" : "Drop"}</Badge> },
    { key: "bus", header: "Bus", sortValue: (r) => r.bus, render: (r) => r.bus },
    { key: "status", header: "Status", sortValue: (r) => r.mark.status, render: (r) => <Badge tone={TONE[r.mark.status]}>{LABEL[r.mark.status]}</Badge> },
    { key: "time", header: "Time", sortValue: (r) => r.mark.at, render: (r) => <span className="font-mono text-sm">{isoTime(r.mark.at)}</span> },
    { key: "by", header: "Marked by", render: (r) => r.mark.byName || r.mark.by },
  ];
  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-start gap-3 px-5">
        <div className="relative w-full max-w-sm">
          <SearchBox value={q} onChange={(v) => { setQ(v); setSid(""); }} placeholder="Find a student by name or GRN…" />
          {matches.length > 0 && !sid && <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-outline-variant bg-surface-container-lowest shadow-pop">
            {matches.map((m) => <li key={m.id}><button className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-surface-container-low" onClick={() => { setSid(m.id); setQ(m.name); }}><Avatar name={m.name} size={28} /><span><span className="block text-sm font-medium">{m.name}</span><span className="t-caption text-outline">{studentLabel(m)} · {m.grn}{m.bus ? ` · ${m.bus}` : ""}</span></span></button></li>)}</ul>}
        </div>
        {s && <div className="rounded-lg bg-surface-container-low px-3 py-2 text-sm"><span className="font-semibold">{s.name}</span> <span className="text-on-surface-variant">· {studentLabel(s)} · {s.bus ? `${s.bus}${s.busStop ? ` · ${s.busStop}` : ""}` : "No bus"}</span></div>}
        <Button variant="outline" size="sm" className="ml-auto" disabled={!rows.length} onClick={() => downloadCsv(`bus-attendance-${s?.grn ?? sid}`, ["Date", "Trip", "Bus", "Status", "Time", "Marked by"], rows.map((r) => [r.date, r.kind, r.bus, LABEL[r.mark.status], isoTime(r.mark.at), r.mark.byName || r.mark.by]))}><Download size={14} />Export CSV</Button>
      </div>
      {!sid ? <EmptyState title="Pick a student" hint="Type at least two letters of the name or GRN." /> : <DataTable rows={rows} columns={cols} pageSize={15} empty={<EmptyState title="No bus attendance yet" hint="Marks from the driver app show up here." />} />}
    </Card>
  );
}
