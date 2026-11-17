"use client";

import { deleteField, runTransaction } from "firebase/firestore";
import type { Student } from "@/features/people/StudentsView";
import { db } from "@/lib/firebase";
import { busStudentCounts, capacityError, nextStopId } from "./logic";
import { cleanStopName, stopNameError, stopNameKey } from "./busStops";
import { busLabel, schoolDoc, stamp, stopsOf } from "./shared";
import { parseTransportFee, transportFeeVersion, type StudentTransportFee } from "./transportFees";
import type { Bus, BusStop } from "./types";

export type BusAssignmentChange = { studentId: string; busId: string | null; stopId?: string; stopName?: string;
  fee?: { input: string; expectedVersion: string } };

export async function assignStudentBuses(changes: BusAssignmentChange[], students: Student[], buses: Bus[]) {
  if (!changes.length) return;
  if (new Set(changes.map(({ studentId }) => studentId)).size !== changes.length) {
    throw new Error("Each student can be assigned only once.");
  }
  const rosterCounts = busStudentCounts(students);
  const entries = changes.map((change) => {
    const parsedFee = change.fee ? parseTransportFee(change.fee.input) : undefined;
    if (parsedFee?.error) throw new Error(parsedFee.error);
    if (change.fee && !change.busId) throw new Error("Choose a bus before setting its fee.");
    if (change.busId && change.stopName !== undefined) {
      const problem = stopNameError(change.stopName);
      if (problem) throw new Error(problem);
    }
    const student = students.find(({ id }) => id === change.studentId);
    if (!student) throw new Error("The student record is unavailable.");
    return { ...change, feeAmount: parsedFee?.amount ?? null, student, ref: schoolDoc("students", student.id) };
  });
  const busIds = [...new Set(entries.flatMap(({ student, busId }) => [student.busId, busId]).filter((id): id is string => !!id))];
  const busRefs = busIds.map((id) => schoolDoc("tr_buses", id));

  await runTransaction(db, async (tx) => {
    const savedStudents = await Promise.all(entries.map(({ ref }) => tx.get(ref)));
    const savedBuses = await Promise.all(busRefs.map((ref) => tx.get(ref)));
    const savedFees = await Promise.all(entries.map((entry) => entry.fee
      ? tx.get(schoolDoc("student_transport_fees", entry.studentId)) : Promise.resolve(null)));
    const counts = new Map<string, number>();
    const deltas = new Map<string, number>();
    const changedStops = new Map<string, BusStop[]>();
    for (const [index, id] of busIds.entries()) {
      const saved = savedBuses[index];
      const expected = buses.find((bus) => bus.id === id);
      if (saved.exists() && (!expected ||
          (saved.get("assignmentRevision") ?? 0) !== (expected.assignmentRevision ?? 0) ||
          saved.get("studentCount") !== expected.studentCount)) {
        throw new Error("Bus assignments changed. Check availability and try again.");
      }
      const recorded = saved.exists() ? Number(saved.get("studentCount")) || 0 : 0;
      counts.set(id, Math.max(0, rosterCounts.get(id) ?? 0, recorded));
    }

    const updates = entries.map((entry, index) => {
      const saved = savedStudents[index];
      if (!saved.exists() || saved.get("deleted") === true ||
          (saved.get("busAssignmentRevision") ?? 0) !== (entry.student.busAssignmentRevision ?? 0) ||
          (saved.get("busId") ?? "") !== (entry.student.busId ?? "") ||
          (saved.get("busStopId") ?? "") !== (entry.student.busStopId ?? "") ||
          (saved.get("busStop") ?? "") !== (entry.student.busStop ?? "")) {
        throw new Error("This student's bus assignment changed. Reopen the assignment.");
      }
      const savedFee = savedFees[index];
      if (entry.fee && transportFeeVersion(savedFee?.exists() ? savedFee.data() as StudentTransportFee : undefined) !== entry.fee.expectedVersion) {
        throw new Error("This fee changed in another window. Cancel and reopen the assignment to review it.");
      }
      const oldBusId = saved.get("busId") as string | undefined;
      if (oldBusId !== (entry.busId || undefined)) {
        if (oldBusId) deltas.set(oldBusId, (deltas.get(oldBusId) ?? 0) - 1);
        if (entry.busId) deltas.set(entry.busId, (deltas.get(entry.busId) ?? 0) + 1);
      }
      const target = entry.busId ? savedBuses[busIds.indexOf(entry.busId)] : undefined;
      if (entry.busId && (!target?.exists() || (target.get("status") !== "Active" && entry.busId !== oldBusId))) {
        throw new Error("Choose an active bus.");
      }
      const bus = target?.exists() ? { ...target.data(), id: target.id } as Bus : undefined;
      const stops = bus ? changedStops.get(bus.id) ?? stopsOf(bus) : [];
      let stop = bus && entry.stopId ? stops.find(({ id }) => id === entry.stopId) : undefined;
      if (entry.stopId && !stop) throw new Error("This stop is no longer available on the selected bus.");
      if (bus && !entry.stopId && entry.stopName !== undefined) {
        const name = cleanStopName(entry.stopName);
        stop = stops.find((row) => stopNameKey(row.name) === stopNameKey(name));
        if (!stop) {
          stop = { id: nextStopId(stops), name, pickupTime: "", dropTime: "" };
          changedStops.set(bus.id, [...stops, stop]);
        }
      }
      return {
        ref: entry.ref,
        patch: bus ? {
          busId: bus.id, bus: busLabel(bus),
          busStopId: stop?.id ?? deleteField(), busStop: stop?.name ?? deleteField(),
          ...(oldBusId !== bus.id ? { busAssignmentRevision: (saved.get("busAssignmentRevision") ?? 0) + 1 } : {}),
        } : { busId: deleteField(), bus: deleteField(), busStopId: deleteField(), busStop: deleteField(),
          busAssignmentRevision: (saved.get("busAssignmentRevision") ?? 0) + 1 },
      };
    });

    for (const [index, id] of busIds.entries()) {
      const saved = savedBuses[index];
      const delta = deltas.get(id) ?? 0;
      if (!saved.exists() || delta <= 0) continue;
      const capacity = Number(saved.get("capacity"));
      if (!Number.isFinite(capacity) || capacity < 0) throw new Error("Configure this bus's student seating capacity first.");
      const error = capacityError(capacity, counts.get(id) ?? 0, delta, busLabel(saved.data() as Bus));
      if (error) throw new Error(error);
    }
    const audit = stamp();
    for (const [index, { ref, patch }] of updates.entries()) {
      tx.update(ref, { ...patch, ...audit });
      const entry = entries[index];
      const busChanged = (savedStudents[index].get("busId") ?? "") !== (entry.busId ?? "");
      if (entry.fee) {
        tx.set(schoolDoc("student_transport_fees", entry.studentId), {
          id: entry.studentId, studentId: entry.studentId, busId: entry.busId, amount: entry.feeAmount,
          busAssignmentRevision: (savedStudents[index].get("busAssignmentRevision") ?? 0) + (busChanged ? 1 : 0),
          revision: (savedFees[index]?.get("revision") ?? 0) + 1, ...audit,
        });
      } else if (busChanged) tx.delete(schoolDoc("student_transport_fees", entry.studentId));
    }
    for (const [index, id] of busIds.entries()) {
      if (!savedBuses[index].exists()) continue;
      tx.update(busRefs[index], {
        studentCount: Math.max(0, (counts.get(id) ?? 0) + (deltas.get(id) ?? 0)),
        assignmentRevision: (savedBuses[index].get("assignmentRevision") ?? 0) + 1, ...audit,
        ...(changedStops.has(id) ? { stops: changedStops.get(id) } : {}),
      });
    }
  });
}
