import { annualStudentFees, type FeeTerm } from "@/features/people/studentAnnualFees";
import { studentFeePlan, studentFeeRecords } from "@/features/people/studentFees";
import { studentTransportFee, type StudentTransportFee } from "@/features/transport/transportFees";
import type { Student } from "@/features/people/StudentsView";
import type { Concession, Invoice, Payment, Structure } from "./types";
import type { FeeFrequency } from "./feePlan";

export const studentFeeHref = (id: string) => `/fees/students/${encodeURIComponent(id)}`;
type Saved<T> = T & { deleted?: boolean };
type Input = { students: Student[]; invoices: Saved<Invoice>[]; payments: Saved<Payment>[]; concessions: Saved<Concession>[]; structures: Structure[];
  academicYear: string; terms: FeeTerm[]; admissions: { id: string; admissionDate?: string }[]; transportFees: StudentTransportFee[]; transportFrequency?: FeeFrequency | "" };
export type StudentDue = { id: string; student: Student; annual: ReturnType<typeof annualStudentFees>; records: ReturnType<typeof studentFeeRecords>;
  remaining: number; complete: boolean; settled: boolean };
const key = (value?: string) => (value ?? "").trim().toLowerCase();

/** Index identities and financial records once, including retained identities that make a GRN ambiguous. */
export function studentDues(input: Input): StudentDue[] {
  const identities = new Map<string, Student[]>();
  for (const student of input.students) { const grn = key(student.grn); identities.set(grn, [...(identities.get(grn) ?? []), student]); }
  const ownerByGrn = (grn?: string) => { const group = identities.get(key(grn)); return key(grn) && group?.length === 1 ? group[0].id : ""; };
  const bills = new Map<string, Saved<Invoice>[]>(); const payments = new Map<string, Saved<Payment>[]>(); const concessions = new Map<string, Saved<Concession>[]>();
  const add = <T,>(map: Map<string, T[]>, id: string, row: T) => { if (id) { const group = map.get(id) ?? []; group.push(row); map.set(id, group); } };
  const invoiceIndex = new Map(input.invoices.map((row) => [row.id, row]));
  const invoiceOwner = (row: Saved<Invoice>) => row.deleted ? "" : row.studentId || ownerByGrn(row.grn);
  for (const row of input.invoices) add(bills, invoiceOwner(row), row);
  for (const row of input.payments) if (!row.deleted) {
    const invoice = invoiceIndex.get(row.invoiceId);
    add(payments, invoice ? invoiceOwner(invoice) : ownerByGrn(row.grn), row);
  }
  for (const row of input.concessions) if (!row.deleted) add(concessions, ownerByGrn(row.grn), row);
  const admissionIndex = new Map(input.admissions.map((row) => [row.id, row]));
  const transportIndex = new Map(input.transportFees.map((row) => [row.studentId || row.id, row]));
  return input.students.filter((row) => !row.deleted).map((raw) => {
    const student = { ...raw, admissionDate: raw.admissionDate || admissionIndex.get(raw.id)?.admissionDate };
    const records = studentFeeRecords(student, identities.get(key(student.grn)) ?? [student], bills.get(student.id) ?? [], payments.get(student.id) ?? [], concessions.get(student.id) ?? []);
    const plan = studentFeePlan(student, input.structures, input.academicYear);
    const annual = annualStudentFees({ ...plan, terms: input.terms, admissionDate: student.admissionDate, invoices: records.invoices, concessions: records.concessions,
      busId: student.busId, transportAmount: studentTransportFee({ ...student, transportFee: transportIndex.get(student.id) }), transportFrequency: input.transportFrequency });
    // Non-active enrolments retain billed debt, without estimating new annual charges.
    const active = (student.status ?? "Active") === "Active";
    const complete = !active || annual.complete;
    const remaining = active && annual.complete ? annual.payable : records.outstanding;
    return { id: student.id, student, annual, records, remaining, complete, settled: complete && remaining === 0 };
  });
}
