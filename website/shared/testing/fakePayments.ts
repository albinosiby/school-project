import { ADMIN_UID, getRow, guard, rawSet, rawUpdate, rowsOf } from "./fakeDb";
import { applyPayment, invoiceStatus, nextReceiptNo, normRef, paymentMode } from "@/features/fees/logic";
import type { Invoice, Payment } from "@/features/fees/types";

/** UI-test stand-in only. Production concurrency and replay checks run against the emulator. */
export function fakeRecordPayment(input: { requestId: string; invoiceId: string; amount: number; mode?: string; reference?: string; date?: string; claimId?: string }) {
  guard();
  const claim = input.claimId ? getRow<Record<string, string>>("fee_claims", input.claimId) : undefined;
  const id = claim?.paymentId || `pay_${input.requestId}`;
  const previous = getRow<Payment>("fee_payments", id);
  if (previous) return { payment: previous, replayed: true };
  const invoice = getRow<Invoice>("fee_invoices", input.invoiceId);
  if (!invoice) throw new Error("The invoice was not found.");
  const date = claim?.paidOn || input.date || "2026-11-03";
  const reference = normRef(claim?.reference || input.reference);
  const receiptNo = nextReceiptNo(rowsOf<Payment>("fee_payments"));
  const now = new Date().toISOString(), stamp = { updatedAt: now, updatedBy: ADMIN_UID };
  const payment: Payment = { id, receiptNo, invoiceId: invoice.id, invoiceNo: invoice.no, student: invoice.student, grade: invoice.grade, grn: invoice.grn,
    amount: input.amount, mode: paymentMode(claim?.mode || input.mode || "Cash", reference), date, by: "School Admin", ...(reference ? { reference } : {}), ...(input.claimId ? { claimId: input.claimId } : {}) };
  const patch = applyPayment(invoice, input.amount, date);
  rawSet("fee_payments", id, { ...payment, ...stamp });
  rawUpdate("fee_invoices", invoice.id, { ...patch, statusOverride: null, statusRevision: (invoice.statusRevision ?? 0) + 1, ...stamp });
  rawSet("fee_invoice_status_history", id, { id, invoiceId: invoice.id, from: invoice.status, to: patch.status, mode: "Payment", reason: `Payment recorded · ${receiptNo}`, at: now, by: payment.by, byUid: ADMIN_UID });
  if (input.claimId) rawUpdate("fee_claims", input.claimId, { status: "Verified", amount: input.amount, receiptNo, paymentId: id, verifiedBy: payment.by, verifiedByUid: ADMIN_UID, verifiedAt: now, ...stamp });
  return { payment, replayed: false };
}

export function fakeChangeInvoiceStatus(input: { requestId: string; invoiceId: string; status: "Automatic" | "Pending" | "Overdue"; reason: string;
  expectedRevision: number; expectedAmount: number; expectedPaid: number; expectedDue: string }) {
  guard();
  const invoice = getRow<Invoice>("fee_invoices", input.invoiceId);
  if (!invoice) throw new Error("The invoice was not found.");
  if ((invoice.statusRevision ?? 0) !== input.expectedRevision || invoice.amount !== input.expectedAmount || (invoice.paid ?? 0) !== input.expectedPaid || invoice.due !== input.expectedDue) throw new Error("This invoice changed. Cancel and reopen the status editor to review it.");
  const now = new Date().toISOString();
  const statusOverride = input.status === "Automatic" ? null : { status: input.status, amount: invoice.amount, paid: invoice.paid ?? 0, due: invoice.due };
  const status = input.status === "Automatic" ? invoiceStatus(invoice, "2026-11-03") : input.status;
  const patch = { status, statusOverride, statusRevision: (invoice.statusRevision ?? 0) + 1 };
  rawUpdate("fee_invoices", invoice.id, patch);
  rawSet("fee_invoice_status_history", input.requestId, { id: input.requestId, invoiceId: invoice.id, from: invoice.status, to: status, mode: input.status === "Automatic" ? "Automatic" : "Manual", reason: input.reason || "Restored automatic status", at: now, by: "School Admin", byUid: ADMIN_UID });
  return patch;
}
