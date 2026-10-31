"use client";
// Transport > Buses: tr_buses CRUD with the ordered stops list, crew allotment, student assignment (contract 14.1 / 14.2).
import { Fragment, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2, UserMinus } from "lucide-react";
import { deleteField, writeBatch } from "firebase/firestore";
import { Badge, Button, Card, Checkbox, DataTable, EmptyState, Field, Input, Modal, SearchBox, Select, SlideOver, Tabs, Textarea, useToast, type Column, type Tone } from "@/components/ui";
import { GRADES, SECTIONS } from "@/features/ops/shared";
import { useCollection } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import type { Student } from "@/features/people/StudentsView";
import { applyAllot, busLabel, planAllot, schoolDoc, stamp, studentLabel, t12 } from "./shared";
import type { Bus, BusStatus, BusStop, Crew } from "./types";

const STATUS: BusStatus[] = ["Active", "Maintenance", "Inactive"];
const statusTone: Record<BusStatus, Tone> = { Active: "success", Maintenance: "warning", Inactive: "neutral" };
const nextBusId = (ids: string[]) => `bus_${String(Math.max(0, ...ids.map((i) => Number(/^bus_(\d+)$/.exec(i)?.[1] ?? 0))) + 1).padStart(2, "0")}`;
const nextStopId = (stops: BusStop[]) => `stp_${String(Math.max(0, ...stops.map((s) => Number(/^stp_(\d+)$/.exec(s.id)?.[1] ?? 0))) + 1).padStart(2, "0")}`;

export function BusesPanel({ openBusId, onOpenBus }: { openBusId: string | null; onOpenBus: (id: string | null) => void }) {
  const toast = useToast();
  const buses = useCollection<Bus>("tr_buses");
  const crew = useCollection<Crew>("tr_crew").rows;
  const students = useCollection<Student>("students").rows;
  const [form, setForm] = useState<{ edit?: Bus } | null>(null);
  const [del, setDel] = useState<Bus | null>(null);
  const [busy, setBusy] = useState(false);
  const open = openBusId ? buses.rows.find((b) => b.id === openBusId) ?? null : null;
  const onBus = (busId: string) => students.filter((s) => s.busId === busId);

  async function removeBus(b: Bus) {
    setBusy(true);
    try {
      const batch = writeBatch(db); const s = stamp();
      batch.delete(schoolDoc("tr_buses", b.id));
      for (const st of onBus(b.id)) batch.update(schoolDoc("students", st.id), { busId: deleteField(), bus: deleteField(), busStopId: deleteField(), busStop: deleteField(), ...s });
      for (const c of crew.filter((x) => x.busId === b.id)) batch.update(schoolDoc("tr_crew", c.id), { busId: deleteField(), bus: deleteField(), ...s });
      await batch.commit();
      toast(`${busLabel(b)} removed`); setDel(null); if (openBusId === b.id) onOpenBus(null);
    } catch { toast("Could not delete the bus", "error"); } finally { setBusy(false); }
  }

  const cols: Column<Bus>[] = [
    { key: "number", header: "Bus", sortValue: (b) => Number(b.number) || b.number, render: (b) => <div><div className="font-semibold">{busLabel(b)}</div><div className="t-caption text-outline">{b.model || "—"}</div></div> },
    { key: "regNo", header: "Reg no", sortValue: (b) => b.regNo, render: (b) => <span className="font-mono text-sm">{b.regNo}</span> },
    { key: "route", header: "Route", sortValue: (b) => b.routeName, render: (b) => <div>{b.routeName}<div className="t-caption text-outline">{b.stops?.length ?? 0} stops · pickup {t12(b.pickupStart)}</div></div> },
    { key: "capacity", header: "Capacity", sortValue: (b) => b.capacity, render: (b) => b.capacity },
    { key: "driver", header: "Driver", sortValue: (b) => b.driver ?? "", render: (b) => b.driver || <span className="text-outline">Unassigned</span> },
    { key: "attendant", header: "Attendant", sortValue: (b) => b.attendant ?? "", render: (b) => b.attendant || <span className="text-outline">Unassigned</span> },
    { key: "students", header: "Students", sortValue: (b) => onBus(b.id).length, render: (b) => { const n = onBus(b.id).length; return <span className={n > b.capacity ? "font-semibold text-error" : ""}>{n}{b.capacity ? ` / ${b.capacity}` : ""}</span>; } },
    { key: "status", header: "Status", sortValue: (b) => b.status, render: (b) => <Badge tone={statusTone[b.status] ?? "neutral"}>{b.status}</Badge> },
    { key: "actions", header: "", className: "text-right", render: (b) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" aria-label={`Edit ${busLabel(b)}`} onClick={() => setForm({ edit: b })}><Pencil size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label={`Delete ${busLabel(b)}`} onClick={() => setDel(b)}><Trash2 size={14} className="text-error" /></Button>
      </div>) },
  ];

  return (
    <>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <p className="text-on-surface-variant">Click a bus to allot crew, assign students and review stops.</p>
          <Button className="ml-auto" onClick={() => setForm({})}><Plus size={16} />Add Bus</Button>
        </div>
        {buses.ready ? <DataTable rows={buses.rows} columns={cols} pageSize={10} onRowClick={(b) => onOpenBus(b.id)} searchText={(b) => `${b.number} ${b.regNo} ${b.routeName} ${b.driver ?? ""} ${b.attendant ?? ""}`}
          empty={<EmptyState title="No buses yet" hint="Add a bus with its route and stops to get started." />} />
          : <p className="px-5 pb-5 text-on-surface-variant">Loading buses…</p>}
      </Card>
      {form && <BusForm key={form.edit?.id ?? "new"} edit={form.edit} existing={buses.rows} onClose={() => setForm(null)} onSave={async (v) => {
        try {
          if (form.edit) { await buses.update(form.edit.id, v); toast("Bus updated"); }
          else { await buses.create({ ...v, id: nextBusId(buses.rows.map((b) => b.id)), studentCount: 0 } as Bus); toast("Bus added"); }
          setForm(null);
        } catch { toast("Could not save the bus", "error"); }
      }} />}
      {open && <BusDetail bus={open} crew={crew} students={students} buses={buses.rows} onClose={() => onOpenBus(null)} onEdit={() => setForm({ edit: open })} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete bus?" subtitle={del ? `${busLabel(del)} · ${del.routeName}` : ""}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => del && removeBus(del)}>Delete</Button></>}>
        <p className="text-on-surface-variant">This removes the bus permanently. {del && onBus(del.id).length > 0 ? `${onBus(del.id).length} student(s) are taken off the bus and ` : ""}its crew become unassigned.</p></Modal>
    </>
  );
}

type StopDraft = BusStop & { landmark: string };
function BusForm({ edit, existing, onClose, onSave }: { edit?: Bus; existing: Bus[]; onClose: () => void; onSave: (v: Omit<Bus, "id" | "studentCount">) => Promise<void> }) {
  const [f, setF] = useState({ number: edit?.number ?? "", regNo: edit?.regNo ?? "", capacity: String(edit?.capacity ?? 40), model: edit?.model ?? "", routeName: edit?.routeName ?? "", pickupStart: edit?.pickupStart ?? "06:45", dropStart: edit?.dropStart ?? "15:30", status: edit?.status ?? "Active", note: edit?.note ?? "" });
  const [stops, setStops] = useState<StopDraft[]>((edit?.stops ?? []).map((s) => ({ ...s, landmark: s.landmark ?? "" })));
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setStop = (i: number, k: keyof StopDraft, v: string) => setStops((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const move = (i: number, d: -1 | 1) => setStops((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j]!, n[i]!]; return n; });
  const addStop = () => setStops((p) => [...p, { id: nextStopId(p), name: "", pickupTime: p.at(-1)?.pickupTime ?? f.pickupStart, dropTime: p.at(-1)?.dropTime ?? f.dropStart, landmark: "" }]);
  async function submit() {
    const e: Record<string, string> = {};
    if (!f.number.trim()) e.number = "Bus number is required";
    else if (existing.some((b) => b.id !== edit?.id && b.number.trim().toLowerCase() === f.number.trim().toLowerCase())) e.number = "Another bus has this number";
    if (!f.regNo.trim()) e.regNo = "Registration number is required";
    if (!f.routeName.trim()) e.routeName = "Route name is required";
    if (!(Number(f.capacity) > 0)) e.capacity = "Enter the seat count";
    if (stops.some((s) => !s.name.trim())) e.stops = "Every stop needs a name";
    setErr(e); if (Object.keys(e).length) return;
    const body: Omit<Bus, "id" | "studentCount"> = { number: f.number.trim(), regNo: f.regNo.trim().toUpperCase(), capacity: Number(f.capacity), routeName: f.routeName.trim(), pickupStart: f.pickupStart, dropStart: f.dropStart, status: f.status as BusStatus,
      stops: stops.map((s) => ({ id: s.id, name: s.name.trim(), pickupTime: s.pickupTime, dropTime: s.dropTime, ...(s.landmark.trim() ? { landmark: s.landmark.trim() } : {}) })), model: f.model.trim(), note: f.note.trim() };
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={edit ? `Edit ${busLabel(edit)}` : "Add Bus"} subtitle="Bus, route timings and stops in route order" width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save Changes" : "Add Bus"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bus number" required error={err.number}><Input value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="14" /></Field>
        <Field label="Registration no" required error={err.regNo}><Input value={f.regNo} onChange={(e) => set("regNo", e.target.value)} placeholder="DL-01-AB-4092" /></Field>
        <Field label="Capacity (seats)" required error={err.capacity}><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label="Model"><Input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="42-seater AC" /></Field>
        <Field label="Route name" required error={err.routeName} className="sm:col-span-2"><Input value={f.routeName} onChange={(e) => set("routeName", e.target.value)} placeholder="Route 4B" /></Field>
        <Field label="Pickup starts" hint="Leaves the first stop"><Input type="time" value={f.pickupStart} onChange={(e) => set("pickupStart", e.target.value)} /></Field>
        <Field label="Drop starts" hint="Leaves the school"><Input type="time" value={f.dropStart} onChange={(e) => set("dropStart", e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => set("note", e.target.value)} className="min-h-16" placeholder="e.g. Fitness certificate due in March" /></Field>
      </div>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between"><h3 className="t-label-caps text-on-surface-variant">Stops ({stops.length})</h3><Button size="sm" variant="outline" onClick={addStop}><Plus size={14} />Add stop</Button></div>
        {err.stops && <p className="mb-2 text-xs text-error">{err.stops}</p>}
        {stops.length === 0 && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">No stops yet. Add them in route order; the school itself is not a stop.</p>}
        <ol className="space-y-2">
          {stops.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-outline-variant/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-outline"><span className="font-mono">{i + 1}. {s.id}</span>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === stops.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Remove stop" onClick={() => setStops((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} className="text-error" /></Button></span></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_96px_96px_1fr]">
                <Input value={s.name} onChange={(e) => setStop(i, "name", e.target.value)} placeholder="Stop name" aria-label="Stop name" />
                <Input type="time" value={s.pickupTime} onChange={(e) => setStop(i, "pickupTime", e.target.value)} aria-label="Pickup time" />
                <Input type="time" value={s.dropTime} onChange={(e) => setStop(i, "dropTime", e.target.value)} aria-label="Drop time" />
                <Input value={s.landmark} onChange={(e) => setStop(i, "landmark", e.target.value)} placeholder="Landmark" aria-label="Landmark" />
              </div>
            </li>))}
        </ol>
      </section>
    </SlideOver>
  );
}

function BusDetail({ bus, crew, students, buses, onClose, onEdit }: { bus: Bus; crew: Crew[]; students: Student[]; buses: Bus[]; onClose: () => void; onEdit: () => void }) {
  const toast = useToast();
  const [tab, setTab] = useState("crew");
  const [busy, setBusy] = useState(false);
  const assigned = useMemo(() => students.filter((s) => s.busId === bus.id).sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id]);
  const [q, setQ] = useState(""); const [grade, setGrade] = useState(""); const [section, setSection] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [stopFor, setStopFor] = useState(bus.stops[0]?.id ?? "");
  const candidates = useMemo(() => students.filter((s) => s.busId !== bus.id && (!grade || s.grade === grade) && (!section || s.section === section)
    && (!q || `${s.name} ${s.grn} ${s.guardian}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id, grade, section, q]);
  const stopName = (id?: string) => bus.stops.find((s) => s.id === id)?.name ?? "";

  async function allot(role: "driver" | "attendant", crewId: string) {
    const seat = role === "driver" ? bus.driverId : bus.attendantId;
    if ((crewId || "") === (seat || "")) return;
    setBusy(true);
    try {
      const batch = writeBatch(db);
      const c = crew.find((x) => x.id === crewId) ?? (seat ? crew.find((x) => x.id === seat) : undefined);
      if (!c) return;
      applyAllot(batch, planAllot(c, crewId ? bus.id : "", crew, buses));
      await batch.commit(); toast(crewId ? `${c.name} allotted to ${busLabel(bus)}` : `${c.name} removed from ${busLabel(bus)}`);
    } catch { toast("Could not update the crew", "error"); } finally { setBusy(false); }
  }
  /** writes students.busId/bus/busStopId/busStop for every change and recomputes studentCount on every touched bus (contract 14.2) */
  async function assign(changes: { s: Student; busId: string | null; stopId?: string }[]) {
    if (!changes.length) return;
    setBusy(true);
    try {
      const batch = writeBatch(db); const st = stamp();
      const next = new Map(students.map((s) => [s.id, s.busId ?? ""]));
      const touched = new Set<string>([bus.id]);
      for (const { s, busId, stopId } of changes) {
        if (s.busId) touched.add(s.busId); if (busId) touched.add(busId);
        next.set(s.id, busId ?? "");
        const b = busId ? buses.find((x) => x.id === busId) : undefined;
        batch.update(schoolDoc("students", s.id), busId && b
          ? { busId, bus: busLabel(b), busStopId: stopId ?? deleteField(), busStop: stopId ? (b.stops.find((x) => x.id === stopId)?.name ?? "") : deleteField(), ...st }
          : { busId: deleteField(), bus: deleteField(), busStopId: deleteField(), busStop: deleteField(), ...st });
      }
      for (const id of touched) if (buses.some((b) => b.id === id)) batch.update(schoolDoc("tr_buses", id), { studentCount: [...next.values()].filter((v) => v === id).length, ...st });
      await batch.commit();
    } catch { toast("Could not update the students", "error"); } finally { setBusy(false); }
  }
  const byRole = (r: "driver" | "attendant") => crew.filter((c) => c.role === r && c.status !== "Inactive").sort((a, b) => a.name.localeCompare(b.name));
  const seatSelect = (role: "driver" | "attendant", seatId?: string) => (
    <Field label={role === "driver" ? "Driver" : "Attendant (bus staff)"}>
      <Select value={seatId ?? ""} disabled={busy} onChange={(e) => allot(role, e.target.value)}>
        <option value="">Unassigned</option>
        {byRole(role).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.empId}{c.busId && c.busId !== bus.id ? ` (on ${c.bus})` : ""}</option>)}
      </Select></Field>);

  return (
    <SlideOver open onClose={onClose} title={busLabel(bus)} subtitle={`${bus.routeName} · ${bus.regNo} · ${assigned.length}/${bus.capacity} seats`} width="max-w-2xl"
      footer={<><Badge tone={statusTone[bus.status] ?? "neutral"} className="mr-auto self-center">{bus.status}</Badge><Button variant="outline" onClick={onEdit}><Pencil size={14} />Edit bus</Button></>}>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ id: "crew", label: "Crew" }, { id: "students", label: "Students", count: assigned.length }, { id: "stops", label: "Stops", count: bus.stops.length }]} />
      {tab === "crew" && <div className="space-y-4">
        <p className="text-sm text-on-surface-variant">Allotting a crew member here moves them off their previous bus and frees this seat&apos;s previous holder.</p>
        <div className="grid gap-4 sm:grid-cols-2">{seatSelect("driver", bus.driverId)}{seatSelect("attendant", bus.attendantId)}</div>
        <dl className="grid grid-cols-[120px_1fr] gap-y-2 rounded-lg bg-surface-container-low p-3 text-sm">
          {(["driver", "attendant"] as const).map((r) => { const c = crew.find((x) => x.id === (r === "driver" ? bus.driverId : bus.attendantId));
            return <Fragment key={r}><dt className="text-outline">{r === "driver" ? "Driver" : "Attendant"}</dt><dd>{c ? <>{c.name} <span className="text-outline">· {c.phone}{c.status !== "Active" ? ` · ${c.status}` : ""}</span></> : "—"}</dd></Fragment>; })}
        </dl>
      </div>}
      {tab === "students" && <div className="space-y-5">
        <section>
          <h3 className="t-label-caps mb-2 text-on-surface-variant">On this bus ({assigned.length})</h3>
          {assigned.length === 0 ? <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">No students assigned yet.</p> : (
            <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
              {assigned.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1"><div className="truncate font-medium">{s.name}</div><div className="t-caption text-outline">{studentLabel(s)} · {s.grn}</div></div>
                  <Select aria-label={`Stop for ${s.name}`} className="w-48" value={s.busStopId ?? ""} disabled={busy} onChange={(e) => assign([{ s, busId: bus.id, stopId: e.target.value || undefined }])}>
                    <option value="">No stop</option>{bus.stops.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select>
                  <Button size="sm" variant="ghost" aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => assign([{ s, busId: null }])}><UserMinus size={14} className="text-error" /></Button>
                </li>))}
            </ul>)}
        </section>
        <section>
          <h3 className="t-label-caps mb-2 text-on-surface-variant">Add students</h3>
          <div className="mb-2 flex flex-wrap gap-2">
            <SearchBox value={q} onChange={setQ} placeholder="Search name, GRN, guardian…" className="w-full max-w-xs" />
            <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-32"><option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
            <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-28"><option value="">All sections</option>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select>
          </div>
          <ul className="max-h-64 divide-y divide-outline-variant/40 overflow-y-auto rounded-lg border border-outline-variant/60">
            {candidates.length === 0 && <li className="p-3 text-sm text-on-surface-variant">No students match.</li>}
            {candidates.slice(0, 200).map((s) => (
              <li key={s.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-container-low">
                <Checkbox checked={picked.includes(s.id)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id)))} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="t-caption text-outline">{studentLabel(s)} · {s.grn}{s.bus ? ` · on ${s.bus}` : ""}</span></span>
              </label></li>))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Stop for the selected students" className="w-56"><Select value={stopFor} onChange={(e) => setStopFor(e.target.value)}><option value="">No stop</option>{bus.stops.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select></Field>
            <Button disabled={!picked.length || busy} onClick={async () => { const sel = students.filter((s) => picked.includes(s.id)); await assign(sel.map((s) => ({ s, busId: bus.id, stopId: stopFor || undefined }))); setPicked([]); toast(`${sel.length} student${sel.length === 1 ? "" : "s"} added to ${busLabel(bus)}`); }}>
              <Plus size={14} />Add {picked.length || ""} student{picked.length === 1 ? "" : "s"}</Button>
            {assigned.length + picked.length > bus.capacity && <Badge tone="danger">Over capacity</Badge>}
          </div>
        </section>
      </div>}
      {tab === "stops" && (bus.stops.length === 0 ? <EmptyState title="No stops" hint="Edit the bus to add its stops in route order." action={<Button variant="outline" onClick={onEdit}>Edit bus</Button>} /> : (
        <table className="w-full text-left text-sm">
          <thead><tr className="border-b border-outline-variant/60 text-on-surface-variant"><th className="py-2 pr-3 t-label-caps !text-[11px]">#</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Stop</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Pickup</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Drop</th><th className="py-2 t-label-caps !text-[11px] text-right">Students</th></tr></thead>
          <tbody>{bus.stops.map((st, i) => (
            <tr key={st.id} className="border-b border-outline-variant/40 last:border-0"><td className="py-2 pr-3 font-mono text-outline">{i + 1}</td>
              <td className="py-2 pr-3"><div className="font-medium">{st.name}</div>{st.landmark && <div className="t-caption text-outline">{st.landmark}</div>}</td>
              <td className="py-2 pr-3 font-mono">{t12(st.pickupTime)}</td><td className="py-2 pr-3 font-mono">{t12(st.dropTime)}</td>
              <td className="py-2 text-right">{assigned.filter((s) => s.busStopId === st.id).length}</td></tr>))}
            {assigned.some((s) => !s.busStopId) && <tr><td className="py-2 pr-3 text-outline">—</td><td className="py-2 pr-3 text-on-surface-variant" colSpan={3}>No stop set</td><td className="py-2 text-right">{assigned.filter((s) => !stopName(s.busStopId)).length}</td></tr>}
          </tbody>
        </table>))}
    </SlideOver>
  );
}
