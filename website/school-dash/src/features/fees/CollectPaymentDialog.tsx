"use client";

import { useRef, useState } from "react";
import { Button, Field, Input, Modal, Select } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { balanceOf, normRef, paymentAmountError, round2 } from "./logic";
import { FeePaymentError, recordFeePayment, type PaymentRequest } from "./paymentService";
import type { Invoice, Payment } from "./types";

const methods = ["Cash", "UPI", "UPI QR", "Card", "Cheque", "NetBank", "Bank transfer", "Cash deposit at bank"];

function pendingPayment(key: string): PaymentRequest | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "null") as PaymentRequest | null;
    return saved && /^[a-f\d-]{36}$/i.test(saved.requestId) && typeof saved.invoiceId === "string" && Number.isFinite(saved.amount)
      && saved.amount > 0 && methods.includes(saved.mode || "") && typeof saved.date === "string" && typeof saved.reference === "string" ? saved : null;
  } catch { return null; }
}

/** Keep uncertain requests unchanged across retries/reopening/reloads in this tab. */
export function CollectPaymentDialog({ invoices, initialInvoiceId, intent, storageKey, onClose, onSaved }: {
  invoices: Invoice[]; initialInvoiceId?: string; intent?: "Partial" | "Paid"; storageKey: string;
  onClose: () => void; onSaved: (payment: Payment) => void;
}) {
  const { date: today } = useSchoolClock();
  const [pending, setPending] = useState(() => pendingPayment(storageKey));
  const first = invoices.find((row) => row.id === initialInvoiceId && balanceOf(row) > 0) ?? invoices.find((row) => balanceOf(row) > 0);
  const [invoiceId, setInvoiceId] = useState(pending?.invoiceId ?? first?.id ?? "");
  const [amount, setAmount] = useState(pending ? String(pending.amount) : first ? String(balanceOf(first)) : "");
  const [mode, setMode] = useState(pending?.mode ?? "Cash");
  const [date, setDate] = useState(pending?.date ?? today);
  const [reference, setReference] = useState(pending?.reference ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const invoice = invoices.find((row) => row.id === invoiceId);
  const outstanding = invoice ? balanceOf(invoice) : 0;
  const outstandingInvoices = invoices.filter((row) => balanceOf(row) > 0 || row.id === invoiceId);
  const locked = busy || Boolean(pending);
  const close = () => { if (!saving.current) onClose(); };
  function remember(request: PaymentRequest | null) {
    setPending(request);
    try { if (request) sessionStorage.setItem(storageKey, JSON.stringify(request)); else sessionStorage.removeItem(storageKey); } catch { /* In-memory retry remains available if tab storage is disabled. */ }
  }
  async function save() {
    if (saving.current) return;
    const confirmingEarlierAttempt = Boolean(pending);
    let request = pending;
    if (!request) {
      const numeric = amount.trim() ? Number(amount) : NaN;
      const validation = !invoice ? "Choose an outstanding invoice." : paymentAmountError(numeric, outstanding);
      if (validation) { setError(validation); return; }
      if (Math.abs(numeric * 100 - Math.round(numeric * 100)) > 0.000001) { setError("Enter an amount with no more than two decimal places."); return; }
      if (intent === "Partial" && round2(numeric) >= outstanding) { setError("For Partial, enter less than the outstanding balance. Use Paid to collect the full balance."); return; }
      if (intent === "Paid" && round2(numeric) !== outstanding) { setError("Collect the full outstanding balance to mark this invoice Paid."); return; }
      const parsed = new Date(`${date}T12:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date || date > today) { setError("Enter a valid payment date that is not in the future."); return; }
      const ref = mode === "Cash" ? "" : normRef(reference);
      if (mode !== "Cash" && (ref.length < 4 || ref.length > 120)) { setError("Enter a transaction reference between 4 and 120 characters."); return; }
      request = { requestId: crypto.randomUUID(), invoiceId, amount: round2(numeric), mode, date, reference: ref };
      remember(request);
    }
    saving.current = true; setBusy(true); setError("");
    try {
      const receipt = await recordFeePayment(request);
      remember(null); onSaved(receipt);
    } catch (cause) {
      // A later session/permission failure cannot tell us whether an earlier
      // interrupted attempt committed. Preserve its identity until confirmed.
      if (cause instanceof FeePaymentError && cause.outcome === "rejected" && !confirmingEarlierAttempt) remember(null);
      setError(cause instanceof Error ? cause.message : "Could not confirm the payment. Retry this payment to check its receipt.");
    } finally { saving.current = false; setBusy(false); }
  }
  return <Modal open title="Collect payment" subtitle={invoice ? `${invoice.student} · ${invoice.grn}` : undefined} onClose={close}
    footer={<><Button variant="outline" disabled={busy} onClick={close}>{pending && !busy ? "Close & check history" : "Cancel"}</Button>
      <Button type="submit" form="collect-student-payment" disabled={busy || (!pending && !invoice)}>{busy ? "Saving payment…" : pending ? "Retry payment confirmation" : "Save & issue receipt"}</Button></>}>
    {pending && !busy && <p role="status" className="mb-4 rounded-lg bg-warning-container p-3 text-sm">This payment still needs confirmation. Retry the same request before starting another payment. Its details are kept if you close or reload this tab.</p>}
    <form id="collect-student-payment" onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4">
      <Field label="Invoice" required><Select value={invoiceId} disabled={locked || Boolean(intent)} onChange={(event) => {
        setInvoiceId(event.target.value); setAmount(String(balanceOf(invoices.find((row) => row.id === event.target.value)!))); setError("");
      }}><option value="" disabled>Select an outstanding invoice</option>{outstandingInvoices.map((row) => <option key={row.id} value={row.id}>{row.no} · {row.term} · Due {inrFull(balanceOf(row))}</option>)}</Select></Field>
      {!invoice && !pending && <p className="text-sm text-on-surface-variant">There are no outstanding invoices. Create an invoice for uninvoiced fees before collecting payment.</p>}
      {invoice && <dl className="grid grid-cols-3 gap-3 rounded-lg bg-surface-container-low p-3 text-sm">{[["Billed", invoice.amount], ["Already paid", invoice.paid || 0], ["Outstanding", outstanding]].map(([label, value]) => <div key={label}><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 font-semibold">{inrFull(Number(value))}</dd></div>)}</dl>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount collected (₹)" required><Input value={amount} type="number" min="0.01" step="0.01" disabled={locked} onChange={(event) => { setAmount(event.target.value); setError(""); }} /></Field>
        <Field label="Payment date" required><Input value={date} type="date" max={today} disabled={locked} onChange={(event) => { setDate(event.target.value); setError(""); }} /></Field>
        <Field label="Payment method" required><Select value={mode} disabled={locked} onChange={(event) => { setMode(event.target.value); setError(""); }}>{methods.map((method) => <option key={method}>{method}</option>)}</Select></Field>
        {mode !== "Cash" && <Field label="Transaction reference" required><Input value={reference} maxLength={120} disabled={locked} onChange={(event) => { setReference(event.target.value); setError(""); }} /></Field>}
      </div>
      <p className="text-xs text-on-surface-variant">Saving records money received and issues a receipt. The balance, payment history and invoice status update together. An overdue invoice stays overdue until fully settled.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </form>
  </Modal>;
}
