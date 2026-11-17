import type { Student } from "@/features/people/StudentsView";

/** School-scoped, admin-only student_transport_fees/{studentId}. */
export type StudentTransportFee = { id: string; studentId: string; busId: string; amount?: number | null; monthlyAmount?: number | null;
  busAssignmentRevision: number; revision: number; updatedAt?: string; updatedBy?: string };
export type TransportFeeStudent = Student & { transportFee?: StudentTransportFee };

export function studentsWithTransportFees(students: readonly Student[], fees: readonly StudentTransportFee[]): TransportFeeStudent[] {
  const byStudent = new Map(fees.map((fee) => [fee.id, fee]));
  return students.map((student) => ({ ...student, transportFee: byStudent.get(student.id) }));
}

const MAX_FEE = 10_000_000;
const validAmount = (amount: unknown): amount is number => typeof amount === "number" && Number.isFinite(amount)
  && amount >= 0 && amount <= MAX_FEE && Math.abs(amount * 100 - Math.round(amount * 100)) < 0.00001;

export function parseTransportFee(input: string): { amount: number | null; error?: string } {
  const value = input.trim();
  if (!value) return { amount: null };
  const amount = Number(value);
  if (!/^(?:\d+(?:\.\d{0,2})?|\.\d{1,2})$/.test(value) || !validAmount(amount)) {
    return { amount: null, error: "Enter an amount from ₹0 to ₹1,00,00,000, with at most two decimal places." };
  }
  return { amount: Math.round(amount * 100) / 100 };
}

/** Older records used a monthly field name; the amount now has no collection frequency. */
export const transportFeeAmount = (fee?: StudentTransportFee): number | null =>
  fee?.amount !== undefined ? fee.amount : fee?.monthlyAmount ?? null;

/** A fee belongs to one student's current bus assignment, never to a bus-wide rate. */
export function studentTransportFee(student: Pick<TransportFeeStudent, "busId" | "busAssignmentRevision" | "transportFee">): number | null {
  const fee = student.transportFee;
  return student.busId && fee?.busId === student.busId && (fee.busAssignmentRevision ?? 0) === (student.busAssignmentRevision ?? 0)
    && validAmount(transportFeeAmount(fee)) ? transportFeeAmount(fee) : null;
}

export function transportFeeSummary(students: readonly TransportFeeStudent[], busId: string) {
  let paise = 0, configured = 0, missing = 0;
  for (const student of students) {
    if (student.deleted || student.busId !== busId) continue;
    const fee = studentTransportFee(student);
    if (fee === null) missing++;
    else { configured++; paise += Math.round(fee * 100); }
  }
  return { total: paise / 100, configured, missing };
}

export const transportFeeVersion = (fee?: StudentTransportFee) =>
  JSON.stringify([fee?.busId ?? null, transportFeeAmount(fee), fee?.revision ?? 0, fee?.busAssignmentRevision ?? 0]);
