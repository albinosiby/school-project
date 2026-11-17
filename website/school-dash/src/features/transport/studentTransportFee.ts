"use client";

import { runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { schoolDoc, stamp } from "./shared";
import { parseTransportFee, transportFeeVersion, type StudentTransportFee, type TransportFeeStudent } from "./transportFees";

export async function saveStudentTransportFee(student: TransportFeeStudent, busId: string, input: string) {
  const result = parseTransportFee(input);
  if (result.error) throw new Error(result.error);
  if (!busId || student.busId !== busId) throw new Error("This student's bus assignment changed. Reopen the fee editor.");
  const ref = schoolDoc("students", student.id);
  const feeRef = schoolDoc("student_transport_fees", student.id);
  await runTransaction(db, async (transaction) => {
    const [saved, bus, savedFee] = await Promise.all([transaction.get(ref), transaction.get(schoolDoc("tr_buses", busId)), transaction.get(feeRef)]);
    if (!saved.exists() || saved.get("deleted") === true || saved.get("busId") !== busId || !bus.exists()
      || (saved.get("busAssignmentRevision") ?? 0) !== (student.busAssignmentRevision ?? 0)) {
      throw new Error("This student's bus assignment changed. Reopen the fee editor.");
    }
    const current = savedFee.exists() ? savedFee.data() as StudentTransportFee : undefined;
    if (transportFeeVersion(current) !== transportFeeVersion(student.transportFee)) {
      throw new Error("This fee changed in another window. Cancel and reopen the fee editor to review it.");
    }
    const audit = stamp();
    transaction.set(feeRef, { id: student.id, studentId: student.id, busId, amount: result.amount,
      busAssignmentRevision: saved.get("busAssignmentRevision") ?? 0, revision: (current?.revision ?? 0) + 1, ...audit });
  });
}
