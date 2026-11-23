"use client";

import { useState } from "react";
import Link from "next/link";
import { Bus as BusIcon, Pencil } from "lucide-react";
import { LoadingSkeleton, LoadingField, Button, Card, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { busStudentCounts } from "@/features/transport/logic";
import { busLabel, stopsOf } from "@/features/transport/shared";
import { assignStudentBuses } from "@/features/transport/studentBusAssignment";
import { saveStudentTransportFee } from "@/features/transport/studentTransportFee";
import { parseTransportFee, studentTransportFee, transportFeeVersion, type StudentTransportFee, type TransportFeeStudent } from "@/features/transport/transportFees";
import { cleanStopName, stopNameError, stopNameKey } from "@/features/transport/busStops";
import type { Bus } from "@/features/transport/types";
import { useAuth } from "@/lib/authContext";
import { inrFull } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import type { Student } from "./StudentsView";
import { StudentStopPicker } from "./StudentStopPicker";

export function StudentTransportCard({ student, students, readOnly = false }: { student: Student; students: Student[]; readOnly?: boolean }) {
  const { user } = useAuth();
  const canManage = user?.role === "admin" || user?.role === "owner";
  const canEdit = canManage && !readOnly && student.deleted !== true;
  const fees = useCollection<StudentTransportFee>("student_transport_fees", canManage, [["studentId", "==", student.id]]);
  const withFee = { ...student, transportFee: fees.rows.find((fee) => fee.id === student.id) };
  const amount = studentTransportFee(withFee);
  const [editing, setEditing] = useState(false);
  return <Card className="p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="t-label-caps text-on-surface-variant">Transport</h2>
      {canEdit && <Button size="sm" variant="outline" disabled={!fees.ready} onClick={() => setEditing(true)}>
        {student.busId ? <Pencil size={15} /> : <BusIcon size={15} />}{student.busId ? "Edit transport" : "Assign Bus"}
      </Button>}
    </div>
    {student.busId ? <dl className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
      <dt className="text-on-surface-variant">Bus</dt><dd>{student.bus || "Assigned bus"}</dd>
      <dt className="text-on-surface-variant">Bus stop</dt><dd>{student.busStop || "No stop set"}</dd>
      {canManage && <><dt className="text-on-surface-variant">Fee amount</dt><dd>{fees.error ? "Fee unavailable" : !fees.ready ? <LoadingSkeleton variant="inline" label="Loading fee…" /> : amount === null ? "Not configured" : inrFull(amount)}</dd></>}
    </dl> : <p className="text-sm">No bus</p>}
    {fees.error && <p role="alert" className="mt-2 text-sm text-error">Could not load the transport fee. <Button size="sm" variant="ghost" onClick={fees.reload}>Retry</Button></p>}
    {editing && canEdit && <StudentBusForm student={withFee} students={students} onClose={() => setEditing(false)} />}
  </Card>;
}

function StudentBusForm({ student, students, onClose }: { student: TransportFeeStudent; students: Student[]; onClose: () => void }) {
  const [snapshot] = useState(student);
  const buses = useCollection<Bus>("tr_buses");
  const toast = useToast();
  const [busId, setBusId] = useState(snapshot.busId ?? "");
  const [stopDraft, setStopDraft] = useState<{ name: string; id?: string } | null>(null);
  const initialAmount = studentTransportFee(snapshot);
  const initialFee = initialAmount === null ? "" : String(initialAmount);
  const [fee, setFee] = useState(initialFee);
  const [feeError, setFeeError] = useState("");
  const [stopError, setStopError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choices = buses.rows.filter((bus) => bus.status === "Active" || bus.id === snapshot.busId);
  const selected = choices.find(({ id }) => id === busId);
  const stops = stopsOf(selected);
  const currentStop = busId === snapshot.busId ? stops.find((stop) => stop.id === snapshot.busStopId) : undefined;
  const stopName = stopDraft?.name ?? currentStop?.name ?? (busId === snapshot.busId ? snapshot.busStop ?? "" : "");
  const stopId = stopDraft?.id ?? stops.find((stop) => stopNameKey(stop.name) === stopNameKey(stopName))?.id;
  const counts = busStudentCounts(students);
  const assignmentDirty = busId !== (snapshot.busId ?? "") || (stopId ?? "") !== (snapshot.busStopId ?? "") || stopNameKey(stopName) !== stopNameKey(currentStop?.name ?? snapshot.busStop ?? "");
  const feeDirty = Boolean(busId && fee.trim() !== initialFee);
  const dirty = assignmentDirty || feeDirty;
  const free = selected ? Math.max(0, selected.capacity - Math.max(counts.get(selected.id) ?? 0, selected.studentCount || 0)) : 0;
  async function save() {
    if (saving || !buses.ready || !dirty) return;
    const problem = busId ? stopNameError(stopName) : "";
    const parsed = busId ? parseTransportFee(fee) : { amount: null };
    setStopError(problem); setFeeError(parsed.error || "");
    if (problem || parsed.error) return;
    setSaving(true); setError("");
    try {
      if (!assignmentDirty && busId) await saveStudentTransportFee(snapshot, busId, fee);
      else await assignStudentBuses([{ studentId: snapshot.id, busId: busId || null, stopId,
        ...(busId ? { stopName: cleanStopName(stopName) } : {}),
        ...(busId && (busId !== snapshot.busId || feeDirty) ? { fee: { input: fee, expectedVersion: transportFeeVersion(snapshot.transportFee) } } : {}),
      }], students.map((row) => row.id === snapshot.id ? snapshot : row), buses.rows);
      toast(busId ? "Transport details saved" : "Bus assignment removed"); onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the transport details."); }
    finally { setSaving(false); }
  }

  return <Modal open title={snapshot.busId ? "Edit transport" : "Assign Bus"} subtitle={snapshot.name} onClose={() => { if (!saving) onClose(); }}
    footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={!buses.ready || saving || !dirty} onClick={save}>{saving ? "Saving…" : "Save assignment"}</Button></>}>
    <div className="space-y-4">
      <Field label="Bus">
        <LoadingField loading={!buses.ready} label="Loading buses…"><Select disabled={saving || !buses.ready} value={busId} onChange={(event) => {
          const next = event.target.value;
          setBusId(next); setFee(next === snapshot.busId ? initialFee : ""); setFeeError("");
          setStopDraft({ name: "" }); setStopError(""); setError("");
        }}>
          <option value="">No bus</option>
          {snapshot.busId && !choices.some(({ id }) => id === snapshot.busId) &&
            <option value={snapshot.busId} disabled>{snapshot.bus || "Previous bus"} · unavailable</option>}
          {choices.map((bus) => <option key={bus.id} value={bus.id}>{busLabel(bus)}{bus.endPoint || bus.routeName ? ` · ${bus.endPoint || bus.routeName}` : ""}{bus.status !== "Active" ? ` · ${bus.status}` : ""}</option>)}
        </Select></LoadingField>
      </Field>
      {selected && <>
        <p className="text-sm text-on-surface-variant">{selected.regNo} · {free} seats available</p>
        <StudentStopPicker buses={buses.rows} busId={busId} name={stopName} disabled={saving} error={stopError}
          onChange={(name, id) => { setStopDraft({ name, id }); setStopError(""); setError(""); }} />
        <Field label="Transport fee amount (₹)" error={feeError} hint="Blank = not configured; 0 = free. Collection frequency is set in Settings → Payments.">
          <Input inputMode="decimal" value={fee} disabled={saving} placeholder="e.g. 1200" onChange={(event) => { setFee(event.target.value); setFeeError(""); setError(""); }} />
        </Field>
      </>}
      {buses.ready && !choices.length && <p className="text-sm text-on-surface-variant">Add an active bus under <Link href="/transport" className="text-secondary underline">Transport</Link>.</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  </Modal>;
}
