import { balanceOf } from "@/features/fees/logic";
import { gradePlanScope, initialFeePlan, isTransportFee, type FeeItem } from "@/features/fees/feePlan";
import type { Concession, Invoice, Payment, Structure } from "@/features/fees/types";
import { classStream, feeScopeKey, streamFromClassId } from "@/lib/academicStreams";

export type FeeStudent = { id: string; grn?: string; grade: string; classId?: string; streamId?: string; stream?: string };
const key = (value?: string) => (value ?? "").trim().toLowerCase();
const cents = (amount: number) => Number.isFinite(amount) ? Math.round(amount * 100) : 0;
const sum = <T,>(rows: T[], value: (row: T) => number) => rows.reduce((total, row) => total + cents(value(row)), 0) / 100;
type Saved<T> = T & { deleted?: boolean };

/** Stable invoice ownership takes precedence over GRN. Never match children by name. */
export function studentFeeRecords(student: FeeStudent, students: readonly FeeStudent[], invoices: readonly Saved<Invoice>[], payments: readonly Saved<Payment>[], concessions: readonly Saved<Concession>[]) {
  const grn = key(student.grn);
  const uniqueGrn = Boolean(grn) && students.filter((row) => key(row.grn) === grn).length === 1;
  const matchesGrn = (value?: string) => uniqueGrn && key(value) === grn;
  const invoiceIndex = new Map(invoices.map((row) => [row.id, row]));
  const ownedInvoices = invoices.filter((row) => !row.deleted && (row.studentId ? row.studentId === student.id : matchesGrn(row.grn)))
    .sort((a, b) => (b.issued ?? "").localeCompare(a.issued ?? "") || b.no.localeCompare(a.no));
  const invoiceIds = new Set(ownedInvoices.map((row) => row.id));
  const ownedPayments = payments.filter((row) => !row.deleted && (invoiceIndex.has(row.invoiceId)
    ? invoiceIds.has(row.invoiceId) : matchesGrn(row.grn)))
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.receiptNo.localeCompare(a.receiptNo, undefined, { numeric: true }));
  const ownedConcessions = concessions.filter((row) => !row.deleted && matchesGrn(row.grn))
    .sort((a, b) => (b.requested ?? "").localeCompare(a.requested ?? ""));
  return {
    invoices: ownedInvoices, payments: ownedPayments, concessions: ownedConcessions, uniqueGrn,
    billed: sum(ownedInvoices, (row) => row.amount), paid: sum(ownedInvoices, (row) => row.paid ?? 0),
    outstanding: sum(ownedInvoices, balanceOf),
    approvedConcessions: sum(ownedConcessions.filter((row) => row.status === "Approved"), (row) => row.amount),
  };
}

export function studentFeePlan(student: FeeStudent, structures: readonly Structure[], academicYear: string) {
  const scope = feeScopeKey(student.grade, classStream(student) || streamFromClassId(student.classId));
  const matching = structures.filter((row) => gradePlanScope(row) === scope);
  const structure = (academicYear && matching.find((row) => row.academicYear === academicYear))
    || matching.find((row) => !row.academicYear) || (!academicYear ? matching[0] : undefined);
  if (!structure) return { scope, academicYear, items: [] as FeeItem[], structureId: "", termsPerYear: undefined as number | undefined };
  const items = structure.schemaVersion === 2
    ? (structure.items ?? []).filter((item) => !isTransportFee(item) && item.grades.includes(scope))
    : initialFeePlan(undefined, [structure], { grades: [scope], academicYear, termsPerYear: structure.termsPerYear ?? 2 }).items;
  return { scope, academicYear: structure.academicYear || academicYear, items, structureId: structure.id, termsPerYear: structure.termsPerYear };
}
