"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { MapPin, Pencil, Plus, UserMinus, UserRound } from "lucide-react";
import { Button, EmptyState, SearchBox, Select, Tabs, useToast } from "@/components/ui";
import { inrFull } from "@/lib/format";
import type { Student } from "@/features/people/StudentsView";
import { studentTransportFee, transportFeeVersion, type TransportFeeStudent } from "./transportFees";
import { studentProfileHref } from "@/features/people/studentLogic";
import { AddBusStudentsPanel } from "./AddBusStudentsPanel";
import { CrewAssignmentSelect } from "./CrewAssignmentSelect";
import { assignStudentBuses } from "./studentBusAssignment";
import { busLabel, stopsOf, studentLabel } from "./shared";
import type { Bus, Crew, CrewRole } from "./types";

export function BusAssignments({ bus, crew, students, buses, onEdit, onAllot, crewBusy, crewError }: {
  bus: Bus; crew: Crew[]; students: TransportFeeStudent[]; buses: Bus[]; onEdit: () => void;
  onAllot: (role: CrewRole, crewId: string) => Promise<void>; crewBusy: boolean;
  crewError?: { role: CrewRole; message: string } | null;
}) {
  const toast = useToast();
  const [tab, setTab] = useState("crew");
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const assigned = useMemo(() => students.filter((student) => student.busId === bus.id)
    .sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id]);
  const stops = stopsOf(bus);
  const names = new Map(stops.map((stop) => [stop.id, stop.name]));
  const visible = assigned.filter((student) => !query || [student.name, student.grn, studentLabel(student),
    names.get(student.busStopId || "") || student.busStop || ""].join(" ").toLowerCase().includes(query.toLowerCase()));
  const withoutStop = assigned.filter((student) => !names.has(student.busStopId || ""));

  async function assign(changes: { student: Student; busId: string | null; stopId?: string; fee?: { input: string; expectedVersion: string } }[]) {
    if (busy || !changes.length) return false;
    setBusy(true);
    try {
      await assignStudentBuses(changes.map(({ student, ...change }) => ({ studentId: student.id, ...change })),
        students.map((row) => changes.find((change) => change.student.id === row.id)?.student ?? row), buses);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Could not update the students", "error"); return false;
    } finally { setBusy(false); }
  }

  return <div>
    <div className="border-b border-outline-variant/50 px-5 pt-4">
      <Tabs variant="underline" className="overflow-y-hidden" value={tab} onChange={setTab} items={[
        { id: "crew", label: "Crew" }, { id: "students", label: "Students", count: assigned.length },
        { id: "stops", label: "Stops", count: stops.length },
      ]} />
    </div>
    <div className="p-5">
      {tab === "crew" && <section aria-label="Crew assignments" className="space-y-5">
        <div><h3 className="font-semibold">Assign your crew</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Choose a driver and attendant for this bus. Changes save automatically.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          {(["driver", "attendant"] as const).map((role) => <div key={role} className="rounded-lg border border-outline-variant/60 bg-surface-container-low/40 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <span className="grid size-8 place-items-center rounded-lg bg-info-container text-secondary"><UserRound size={16} aria-hidden="true" /></span>
              {role === "driver" ? "Driver assignment" : "Attendant assignment"}
            </div>
            <CrewAssignmentSelect bus={bus} crew={crew} role={role} label={role === "driver" ? "Driver" : "Attendant (bus staff)"}
              busy={busy || crewBusy} error={crewError?.role === role ? crewError.message : undefined} onAssign={onAllot} />
          </div>)}
        </div>
        <p className="text-xs text-on-surface-variant">Choosing someone assigned to another bus moves them here and frees the previous seat holder. Select Unassigned to clear a role.</p>
      </section>}

      {tab === "students" && <section aria-label="Assigned students" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">Students on this bus</h3>
            <p className="mt-1 text-sm text-on-surface-variant">{assigned.length} of {bus.capacity} student seats occupied</p></div>
          <Button disabled={busy} onClick={() => setAdding(true)}><Plus size={16} aria-hidden="true" />Add students</Button>
        </div>
        <SearchBox value={query} onChange={setQuery} placeholder="Search assigned students or stops…" className="w-full max-w-sm" />
        {!visible.length ? <EmptyState title={assigned.length ? "No students match" : "No students assigned yet."}
          hint={assigned.length ? "Try another name, GRN, class or stop." : "Use Add students to choose who travels on this bus."} /> :
          <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
            <table aria-label="Assigned bus students" className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant"><tr>
                <th scope="col" className="px-4 py-3 font-medium">Student</th><th scope="col" className="px-4 py-3 font-medium">Class</th>
                <th scope="col" className="px-4 py-3 font-medium">Bus stop</th><th scope="col" className="px-4 py-3 font-medium">Fee amount (₹)</th><th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/40">{visible.map((student) => <tr key={student.id}>
                <th scope="row" className="px-4 py-3 font-normal"><Link href={studentProfileHref(student.id)} className="font-semibold text-secondary hover:underline">{student.name}</Link>
                  <div className="mt-1 text-xs text-outline">{student.grn}</div></th>
                <td className="px-4 py-3">{studentLabel(student)}</td>
                <td className="px-4 py-3"><Select aria-label={"Stop for " + student.name} className="min-w-40" value={student.busStopId || ""} disabled={busy}
                  onChange={(event) => { void assign([{ student, busId: bus.id, stopId: event.target.value || undefined }]); }}>
                  <option value="">No stop</option>
                  {student.busStopId && !names.has(student.busStopId) && <option value={student.busStopId} disabled>{student.busStop || "Previous stop"} · unavailable</option>}
                  {stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
                </Select></td>
                <td className="px-4 py-3"><TransportFee student={student} /></td>
                <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" aria-label={"Remove " + student.name} disabled={busy}
                  onClick={() => { void assign([{ student, busId: null }]); }}><UserMinus size={14} className="text-error" aria-hidden="true" />Remove</Button></td>
              </tr>)}</tbody>
            </table>
          </div>}
      </section>}

      {tab === "stops" && <section aria-label="Bus route stops" className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h3 className="font-semibold">Route stops</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Stops in travel order, with the number of assigned students.</p></div>
          <Button variant="outline" onClick={onEdit}><Pencil size={15} aria-hidden="true" />Edit stops</Button>
        </div>
        {!stops.length ? <EmptyState title="No stops" hint="Use Edit stops to add stops and arrange the route." /> :
          <div className="overflow-x-auto rounded-lg border border-outline-variant/50">
            <table aria-label="Route stops" className="w-full min-w-[320px] text-left text-sm">
              <thead className="border-b border-outline-variant/50 bg-surface-container-low text-xs text-on-surface-variant"><tr>
                <th scope="col" className="w-14 px-4 py-3 font-medium">Order</th><th scope="col" className="px-4 py-3 font-medium">Stop</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Students</th>
              </tr></thead>
              <tbody className="divide-y divide-outline-variant/40">{stops.map((stop, index) => <tr key={stop.id}>
                <td className="px-4 py-3"><span className="grid size-7 place-items-center rounded-full bg-surface-container text-xs font-semibold">{index + 1}</span></td>
                <th scope="row" className="px-4 py-3 text-left font-normal"><div className="flex items-center gap-2 font-semibold"><MapPin size={14} aria-hidden="true" className="shrink-0 text-outline" />{stop.name}</div>
                  {stop.landmark && <div className="mt-1 text-xs text-outline">{stop.landmark}</div>}
                </th>
                <td className="px-4 py-3 text-right tabular-nums">{assigned.filter((student) => student.busStopId === stop.id).length}</td>
              </tr>)}
                {withoutStop.length > 0 && <tr><td className="px-4 py-3 text-outline">—</td><th scope="row" className="px-4 py-3 text-left font-normal text-on-surface-variant">No stop set</th><td className="px-4 py-3 text-right tabular-nums">{withoutStop.length}</td></tr>}
              </tbody>
            </table>
          </div>}
      </section>}
    </div>
    {adding && <AddBusStudentsPanel bus={bus} students={students} assignedCount={assigned.length} busy={busy} onClose={() => setAdding(false)}
      onAdd={async (chosen, stopId, amounts) => {
        if (!(await assign(chosen.map((student) => ({ student, busId: bus.id, stopId,
          fee: { input: amounts[student.id] ?? "", expectedVersion: transportFeeVersion(student.transportFee) },
        }))))) return false;
        toast(String(chosen.length) + " student" + (chosen.length === 1 ? "" : "s") + " added to " + busLabel(bus)); return true;
      }} />}
  </div>;
}

function TransportFee({ student }: { student: TransportFeeStudent }) {
  const amount = studentTransportFee(student);
  return <span className={amount === null ? "text-outline" : "tabular-nums"}>{amount === null ? "Not configured" : inrFull(amount)}</span>;
}
