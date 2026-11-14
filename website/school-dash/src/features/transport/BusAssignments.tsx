"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, UserMinus } from "lucide-react";
import { writeBatch } from "firebase/firestore";
import { Badge, Button, Checkbox, EmptyState, Field, SearchBox, Select, Tabs, useToast } from "@/components/ui";
import { GRADES, SECTIONS } from "@/features/ops/shared";
import type { Student } from "@/features/people/StudentsView";
import { studentProfileHref } from "@/features/people/studentLogic";
import { db } from "@/lib/firebase";
import { applyAllot, busLabel, planAllot, stopsOf, studentLabel, t12 } from "./shared";
import { capacityError } from "./logic";
import { assignStudentBuses } from "./studentBusAssignment";
import type { Bus, Crew } from "./types";

export function BusAssignments({ bus, crew, students, buses, onEdit }: {
  bus: Bus; crew: Crew[]; students: Student[]; buses: Bus[]; onEdit: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("crew");
  const [busy, setBusy] = useState(false);
  const assigned = useMemo(() => students.filter((s) => s.busId === bus.id).sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id]);
  const [q, setQ] = useState(""); const [grade, setGrade] = useState(""); const [section, setSection] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const stops = stopsOf(bus);
  const [stopFor, setStopFor] = useState(stops[0]?.id ?? "");
  const [addErr, setAddErr] = useState("");
  const candidates = useMemo(() => students.filter((s) => s.busId !== bus.id && (!grade || s.grade === grade) && (!section || s.section === section)
    && (!q || `${s.name} ${s.grn} ${s.guardian}`.toLowerCase().includes(q.toLowerCase()))).sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id, grade, section, q]);
  const stopName = (id?: string) => stops.find((s) => s.id === id)?.name ?? "";

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
    if (!changes.length) return false;
    setBusy(true);
    try {
      await assignStudentBuses(changes.map(({ s, busId, stopId }) => ({ studentId: s.id, busId, stopId })), students, buses);
      return true;
    } catch (error) { toast(error instanceof Error ? error.message : "Could not update the students", "error"); return false; } finally { setBusy(false); }
  }
  const byRole = (r: "driver" | "attendant") => crew.filter((c) => c.role === r && c.status !== "Inactive").sort((a, b) => a.name.localeCompare(b.name));
  const seatSelect = (role: "driver" | "attendant", seatId?: string) => (
    <Field label={role === "driver" ? "Driver" : "Attendant (bus staff)"}>
      <Select value={seatId ?? ""} disabled={busy} onChange={(e) => allot(role, e.target.value)}>
        <option value="">Unassigned</option>
        {byRole(role).map((c) => <option key={c.id} value={c.id}>{c.name} · {c.empId}{c.busId && c.busId !== bus.id ? ` (on ${c.bus})` : ""}</option>)}
      </Select></Field>);

  return (
    <div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ id: "crew", label: "Crew" }, { id: "students", label: "Students", count: assigned.length }, { id: "stops", label: "Stops", count: stops.length }]} />
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
                  <div className="min-w-0 flex-1"><Link href={studentProfileHref(s.id)} className="font-medium text-secondary hover:underline">{s.name}</Link><div className="t-caption text-outline">{studentLabel(s)} · {s.grn}</div></div>
                  <Select aria-label={`Stop for ${s.name}`} className="w-48" value={s.busStopId ?? ""} disabled={busy} onChange={(e) => assign([{ s, busId: bus.id, stopId: e.target.value || undefined }])}>
                    <option value="">No stop</option>{stops.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select>
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
                <Checkbox aria-label={`Select ${s.name}`} checked={picked.includes(s.id)} onChange={(e) => { setAddErr(""); setPicked((p) => (e.target.checked ? [...p, s.id] : p.filter((x) => x !== s.id))); }} />
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{s.name}</span><span className="t-caption text-outline">{studentLabel(s)} · {s.grn}{s.bus ? ` · on ${s.bus}` : ""}</span></span>
              </label></li>))}
          </ul>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <Field label="Stop for the selected students" className="w-56"><Select value={stopFor} onChange={(e) => setStopFor(e.target.value)}><option value="">No stop</option>{stops.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}</Select></Field>
            <Button disabled={!picked.length || busy} onClick={async () => {
              const sel = students.filter((s) => picked.includes(s.id));
              const over = capacityError(bus.capacity, assigned.length, sel.length, busLabel(bus));
              if (over) { setAddErr(over); return; }
              if (await assign(sel.map((s) => ({ s, busId: bus.id, stopId: stopFor || undefined })))) { setPicked([]); toast(`${sel.length} student${sel.length === 1 ? "" : "s"} added to ${busLabel(bus)}`); }
            }}>
              <Plus size={14} />Add {picked.length || ""} student{picked.length === 1 ? "" : "s"}</Button>
            {assigned.length + picked.length > bus.capacity && <Badge tone="danger">Over capacity</Badge>}
          </div>
          {addErr && <p className="mt-2 text-xs text-error" role="alert">{addErr}</p>}
        </section>
      </div>}
      {tab === "stops" && (stops.length === 0 ? <EmptyState title="No stops" hint="Edit the bus to add its stops in route order." action={<Button variant="outline" onClick={onEdit}>Edit bus</Button>} /> : (
        <table aria-label="Route stops" className="w-full text-left text-sm">
          <thead><tr className="border-b border-outline-variant/60 text-on-surface-variant"><th className="py-2 pr-3 t-label-caps !text-[11px]">#</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Stop</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Pickup</th><th className="py-2 pr-3 t-label-caps !text-[11px]">Drop</th><th className="py-2 t-label-caps !text-[11px] text-right">Students</th></tr></thead>
          <tbody>{stops.map((st, i) => (
            <tr key={st.id} className="border-b border-outline-variant/40 last:border-0"><td className="py-2 pr-3 font-mono text-outline">{i + 1}</td>
              <td className="py-2 pr-3"><div className="font-medium">{st.name}</div>{st.landmark && <div className="t-caption text-outline">{st.landmark}</div>}</td>
              <td className="py-2 pr-3 font-mono">{t12(st.pickupTime)}</td><td className="py-2 pr-3 font-mono">{t12(st.dropTime)}</td>
              <td className="py-2 text-right">{assigned.filter((s) => s.busStopId === st.id).length}</td></tr>))}
            {assigned.some((s) => !stopName(s.busStopId)) && <tr><td className="py-2 pr-3 text-outline">—</td><td className="py-2 pr-3 text-on-surface-variant" colSpan={3}>No stop set</td><td className="py-2 text-right">{assigned.filter((s) => !stopName(s.busStopId)).length}</td></tr>}
          </tbody>
        </table>))}
    </div>
  );
}
