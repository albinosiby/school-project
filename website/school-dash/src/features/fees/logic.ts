// Pure fee maths and record shapes (unit tested in logic.test.ts). Data contract 13.2 / 13.4 / 13.8.
import { doc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { inrFull } from "@/lib/format";
import { currentSchoolId } from "@/lib/useCollection";
import type { Invoice, Payment, Reminder } from "./types";

/** rupees with paise: 0.1 + 0.2 → 0.3 */
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** what is still due: the stored balance, else amount − paid (never below 0) */
export function balanceOf(inv: Pick<Invoice, "amount" | "paid"> & { balance?: number }) {
  const b = typeof inv.balance === "number" && Number.isFinite(inv.balance) ? inv.balance : (inv.amount ?? 0) - (inv.paid ?? 0);
  return Math.max(0, round2(b));
}

/**
 * Invoice status from the money and the due date (`today` = local YYYY-MM-DD):
 * Paid when nothing is due, Overdue when the due date has passed, Partial when something was paid, else Pending (unpaid).
 * The parent app derives the same from `paid` / `due` (fee_models.dart Invoice.statusAt).
 */
export function invoiceStatus(inv: Pick<Invoice, "amount" | "paid"> & { balance?: number; due?: string }, today: string): Invoice["status"] {
  if (balanceOf(inv) <= 0) return "Paid";
  if (today && inv.due && inv.due < today) return "Overdue";
  return (inv.paid ?? 0) > 0 ? "Partial" : "Pending";
}

/** the status shown: derived from the due date when today is known (stored statuses go stale), else the stored one */
export const shownStatus = (inv: Invoice, today: string): Invoice["status"] => (today ? invoiceStatus(inv, today) : inv.status ?? invoiceStatus(inv, ""));

/** "" when `amount` can be recorded against `balance`, else the message to show */
export function paymentAmountError(amount: number, balance: number) {
  if (balance <= 0) return "This invoice is already settled";
  if (!Number.isFinite(amount) || round2(amount) <= 0) return "Enter an amount above ₹0";
  if (round2(amount) > round2(balance)) return `Amount exceeds the due balance of ${inrFull(round2(balance))}`;
  return "";
}

/** The invoice fields after a payment (over-payment refused). */
export function applyPayment(inv: Invoice, amount: number, today: string): Pick<Invoice, "paid" | "balance" | "status"> {
  const balance = balanceOf(inv);
  const err = paymentAmountError(amount, balance);
  if (err) throw new Error(err);
  const paid = round2((inv.paid ?? 0) + amount), left = round2(balance - amount);
  return { paid, balance: left, status: invoiceStatus({ amount: inv.amount, paid, balance: left, due: inv.due }, today) };
}

const tailNo = (s?: string) => Number(/(\d+)\s*$/.exec(s ?? "")?.[1] ?? 0) || 0;
/** next receipt number after the highest on file (length-based numbering collides after deletes) */
export const nextReceiptNo = (payments: Pick<Payment, "receiptNo">[]) => `RCP-${Math.max(20400, ...payments.map((p) => tailNo(p.receiptNo))) + 1}`;
/** next `count` invoice numbers INV-{year}-0841… after the highest on file */
export function nextInvoiceNos(invoices: Pick<Invoice, "no">[], count: number, year: string) {
  const base = Math.max(840, ...invoices.map((i) => tailNo(i.no))) + 1;
  return Array.from({ length: count }, (_, k) => `INV-${year}-${String(base + k).padStart(4, "0")}`);
}

export const CASH = "Cash";
/** fee_payments.mode: "UPI QR · 4417…" for non-cash (the claim verification writes "{mode} · {reference}" too, 13.8) */
export const paymentMode = (mode: string, reference = "") => (reference.trim() ? `${mode} · ${normRef(reference)}` : mode);
/** upper case, no spaces: references are compared this way (the parent app upper-cases them) */
export const normRef = (s?: string) => String(s ?? "").replace(/\s+/g, "").toUpperCase();
/** the reference of a recorded payment: its `reference` field, else what follows " · " in its mode */
export const paymentRef = (p: Pick<Payment, "mode"> & { reference?: string }) => normRef(p.reference ?? (p.mode?.includes(" · ") ? p.mode.split(" · ").slice(1).join(" · ") : ""));

type ClaimLike = { id: string; reference: string; status: string; paymentId?: string };
/** Another claim (not rejected) or a recorded payment with the same reference, else null. */
export function duplicateReference(c: ClaimLike, claims: ClaimLike[], payments: (Pick<Payment, "id" | "mode" | "receiptNo"> & { reference?: string })[]) {
  const ref = normRef(c.reference);
  if (!ref) return null;
  const claim = claims.find((x) => x.id !== c.id && x.status !== "Rejected" && normRef(x.reference) === ref);
  if (claim) return { kind: "claim" as const, id: claim.id };
  const pay = payments.find((p) => p.id !== c.paymentId && paymentRef(p) === ref);
  return pay ? { kind: "payment" as const, id: pay.id, receiptNo: pay.receiptNo } : null;
}

/** local calendar day of an ISO timestamp */
export const localDay = (iso: string) => { const d = new Date(iso); return Number.isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };

/** Invoices a Remind may go to: something still due and not reminded already today. */
export function remindable(invoices: Invoice[], reminders: Pick<Reminder, "invoiceId" | "sentAt">[], today: string) {
  const sent = new Set(reminders.filter((r) => localDay(r.sentAt) === today).map((r) => r.invoiceId));
  return { due: invoices.filter((i) => balanceOf(i) > 0 && !sent.has(i.id)), already: invoices.filter((i) => balanceOf(i) > 0 && sent.has(i.id)) };
}

/** fee_reminders row (13.4): `onFeeReminderCreated` pushes "Fee reminder" to the guardians of `invoiceId` */
export function reminderDoc(i: Invoice, sentAt: string, fmt: (iso: string) => string): Omit<Reminder, "id"> & { grn: string; due: string } {
  const balance = balanceOf(i);
  return {
    invoiceId: i.id, invoiceNo: i.no, student: i.student, grn: i.grn, guardian: i.guardian ?? "", phone: i.phone ?? "", channel: "Parent app", amount: balance, due: i.due ?? "", sentAt,
    message: `Dear ${i.guardian || "Parent"}, fee of ${inrFull(balance)} for ${i.student} (${i.no}) is due on ${i.due ? fmt(i.due) : "the due date"}.`,
  };
}

export type InvoiceDraft = { studentId: string; term: string; head: string; amount: string; due: string };
/** single-invoice form errors (empty object = valid) */
export function invoiceErrors(v: InvoiceDraft, today: string) {
  const e: Partial<Record<keyof InvoiceDraft, string>> = {};
  if (!v.studentId) e.studentId = "Choose a student";
  if (!v.head.trim()) e.head = "Enter the fee head";
  const a = Number(v.amount);
  if (!v.amount.trim() || !Number.isInteger(a) || a <= 0) e.amount = "Enter a whole rupee amount above 0";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.due)) e.due = "Pick the due date";
  else if (today && v.due < today) e.due = "The due date cannot be before today";
  return e;
}

// ---- Firestore helpers for multi-doc writes (one batch = all or nothing) ------------------------------------------
export const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" });
/** stamp + `_o` (newest first), as useCollection.create writes */
export const createStamp = () => ({ ...stamp(), _o: Date.now() });
export const schoolDoc = (col: string, id: string) => { const sid = currentSchoolId(); if (!sid) throw new Error("Not signed in"); return doc(db, "schools", sid, col, id); };
export const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
