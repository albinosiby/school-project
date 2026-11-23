import { recurringTotal, type FeeItem } from "./feePlan";

export type Invoice = {
  id: string; no: string; student: string; grade: string; section: string; grn: string; guardian: string; phone: string; term: string;
  issued: string; due: string; amount: number; paid: number; balance: number; status: "Paid" | "Pending" | "Overdue" | "Partial";
  lines: { label: string; amount: number; feeItemId?: string; quantity?: number; unitAmount?: number }[];
  /** set on invoices the admin web creates (the parent app matches on grn) */
  studentId?: string;
  streamId?: string; stream?: string;
  academicYear?: string; grossAmount?: number; concessionAmount?: number;
  concessionAllocations?: { concessionId: string; type: string; amount: number }[];
  generationFingerprint?: string;
  statusRevision?: number;
  statusOverride?: { status: "Pending" | "Overdue"; amount: number; paid: number; due: string } | null;
};
/** mode is "Cash" or "{mode} · {reference}" (the counter and the claim verification write the same, contract 13.8) */
export type Payment = { id: string; receiptNo: string; invoiceId: string; invoiceNo: string; student: string; grade: string; grn: string; amount: number; mode: string; date: string; by: string; reference?: string; claimId?: string };
export type Structure = { id: string; grade: string; streamId?: string; stream?: string; tuition: number; lab: number; activity: number; library: number; transport: number; schemaVersion?: number; items?: FeeItem[]; academicYear?: string; termsPerYear?: number };
export type Concession = { id: string; student: string; grn: string; grade: string; type: string; amount: number; status: "Approved" | "Pending" | "Rejected"; requested: string; approvedBy: string; academicYear?: string; invoiceApplications?: { invoiceId: string; academicYear: string; amount: number }[] };
export type Reminder = { id: string; invoiceId: string; invoiceNo: string; student: string; guardian: string; phone: string; channel: string; amount: number; sentAt: string; message: string; grn?: string; due?: string };
// local calendar date (toISOString is UTC, so IST mornings before 05:30 were dated yesterday)
export const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const feeTotal = (s: Structure) => s.schemaVersion === 2 ? recurringTotal(s.items ?? [], s.termsPerYear ?? 2) : s.tuition + s.lab + s.activity + s.library;
