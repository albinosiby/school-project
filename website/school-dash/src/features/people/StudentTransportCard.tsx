"use client";

import { useState } from "react";
import Link from "next/link";
import { Bus as BusIcon } from "lucide-react";
import { Button, Card, Field, Modal, Select, useToast } from "@/components/ui";
import { busStudentCounts } from "@/features/transport/logic";
import { busLabel, stopsOf } from "@/features/transport/shared";
import { assignStudentBuses } from "@/features/transport/studentBusAssignment";
import type { Bus } from "@/features/transport/types";
import { useCollection } from "@/lib/useCollection";
import type { Student } from "./StudentsView";

export function StudentTransportCard({ student, students }: { student: Student; students: Student[] }) {
  const [editing, setEditing] = useState(false);
  return <Card className="p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="t-label-caps text-on-surface-variant">Transport</h2>
      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
        <BusIcon size={15} />{student.busId ? "Change Bus" : "Assign Bus"}
      </Button>
    </div>
    <p className="text-sm">{student.bus ? `${student.bus} · ${student.busStop || "No stop set"}` : "No bus"}</p>
    {editing && <StudentBusForm student={student} students={students} onClose={() => setEditing(false)} />}
  </Card>;
}

function StudentBusForm({ student, students, onClose }: { student: Student; students: Student[]; onClose: () => void }) {
  const buses = useCollection<Bus>("tr_buses");
  const toast = useToast();
  const [busId, setBusId] = useState(student.busId ?? "");
  const [stopId, setStopId] = useState(student.busStopId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choices = buses.rows.filter((bus) => bus.status === "Active" || bus.id === student.busId);
  const selected = choices.find(({ id }) => id === busId);
  const stops = stopsOf(selected);
  const counts = busStudentCounts(students);
  const dirty = busId !== (student.busId ?? "") || stopId !== (student.busStopId ?? "");
  const free = selected ? Math.max(0, selected.capacity - Math.max(counts.get(selected.id) ?? 0, selected.studentCount || 0)) : 0;
  async function save() {
    if (saving || !buses.ready || !dirty) return;
    setSaving(true);
    setError("");
    try {
      await assignStudentBuses([{ studentId: student.id, busId: busId || null, stopId: stopId || undefined }], students, buses.rows);
      toast(busId ? "Bus assignment saved" : "Bus assignment removed");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the bus assignment.");
    } finally { setSaving(false); }
  }

  return <Modal open title="Assign Bus" subtitle={student.name} onClose={() => { if (!saving) onClose(); }}
    footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={!buses.ready || saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save assignment"}</Button></>}>
    <div className="space-y-4">
      <Field label="Bus">
        <Select disabled={saving || !buses.ready} value={busId} onChange={(event) => {
          setBusId(event.target.value); setStopId(""); setError("");
        }}>
          <option value="">{buses.ready ? "No bus" : "Loading buses…"}</option>
          {student.busId && !choices.some(({ id }) => id === student.busId) &&
            <option value={student.busId} disabled>{student.bus || "Previous bus"} · unavailable</option>}
          {choices.map((bus) => <option key={bus.id} value={bus.id}>
            {busLabel(bus)}{bus.endPoint || bus.routeName ? ` · ${bus.endPoint || bus.routeName}` : ""}
            {bus.status !== "Active" ? ` · ${bus.status}` : ""}
          </option>)}
        </Select>
      </Field>
      {selected && <>
        <p className="text-sm text-on-surface-variant">{selected.regNo} · {free} seats available</p>
        {stops.length > 0 && <Field label="Bus stop" hint="Optional">
          <Select disabled={saving} value={stopId} onChange={(event) => { setStopId(event.target.value); setError(""); }}>
            <option value="">No stop set</option>
            {stops.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
          </Select>
        </Field>}
      </>}
      {buses.ready && !choices.length && <p className="text-sm text-on-surface-variant">
        Add an active bus under <Link href="/transport" className="text-secondary underline">Transport</Link>.
      </p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  </Modal>;
}
