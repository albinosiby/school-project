"use client";

import { useRef, useState } from "react";
import { Button, Field, LoadingSkeleton, Modal, Select, Textarea } from "@/components/ui";
import { fmtDate, inrFull } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { balanceOf, manualInvoiceStatus, shownStatus } from "./logic";
import { changeInvoiceStatus, type InvoiceStatusHistory, type InvoiceStatusRequest } from "./invoiceStatusService";
import type { Invoice } from "./types";

export function InvoiceStatusDialog({ invoice, today, onClose, onCollect, onSaved }: {
  invoice: Invoice; today: string; onClose: () => void; onCollect: (intent: "Partial" | "Paid") => void; onSaved: () => void;
}) {
  const history = useCollection<InvoiceStatusHistory>("fee_invoice_status_history", true, [["invoiceId", "==", invoice.id]]);
  const [snapshot] = useState(invoice);
  const [status, setStatus] = useState<string>(manualInvoiceStatus(invoice) ?? "Automatic");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [visible, setVisible] = useState(10);
  const request = useRef<InvoiceStatusRequest | null>(null);
  const saving = useRef(false);
  const settled = balanceOf(invoice) <= 0;
  const collects = status === "Partial" || status === "Paid";
  const close = () => { if (!saving.current) onClose(); };
  async function save() {
    if (saving.current) return;
    if (collects) { onCollect(status as "Partial" | "Paid"); return; }
    if (status !== "Automatic" && reason.trim().length < 3) { setError("Enter a reason for the manual status change (at least 3 characters)."); return; }
    if (!request.current) request.current = { requestId: crypto.randomUUID(), invoiceId: invoice.id, status: status as InvoiceStatusRequest["status"], reason: reason.trim(),
      expectedRevision: snapshot.statusRevision ?? 0, expectedAmount: snapshot.amount, expectedPaid: snapshot.paid ?? 0, expectedDue: snapshot.due ?? "" };
    saving.current = true; setBusy(true); setError("");
    try { await changeInvoiceStatus(request.current); onSaved(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update the invoice status. Retry or reopen the editor."); }
    finally { saving.current = false; setBusy(false); }
  }
  const rows = [...history.rows].sort((a, b) => b.at.localeCompare(a.at));
  return <Modal open title="Change invoice status" subtitle={`${invoice.no} · Outstanding ${inrFull(balanceOf(invoice))}`} onClose={close}
    footer={<><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button disabled={busy || (settled && collects)} onClick={save}>{busy ? "Saving status…" : collects ? "Continue to collect payment" : "Save status"}</Button></>}>
    <p className="mb-4 text-sm">Current status: <b>{shownStatus(invoice, today)}</b></p>
    <Field label="Invoice status"><Select value={status} disabled={busy} onChange={(event) => { setStatus(event.target.value); request.current = null; setError(""); }}>
      <option value="Automatic">Automatic (based on balance and due date)</option><option disabled={settled}>Pending</option><option disabled={settled}>Overdue</option><option disabled={settled}>Partial</option><option disabled={settled}>Paid</option>
    </Select></Field>
    {collects ? <p className="mt-3 rounded-lg bg-info-container/50 p-3 text-sm">{status === "Paid" ? "Collect the full outstanding balance to mark this invoice Paid." : "Record a part payment. If the due date has passed, the invoice remains Overdue until settled."} A receipt will be saved with the payment.</p>
      : status !== "Automatic" ? <div className="mt-4"><Field label="Reason for status change" required><Textarea value={reason} maxLength={500} disabled={busy} onChange={(event) => { setReason(event.target.value); request.current = null; setError(""); }} /></Field><p className="mt-2 text-xs text-on-surface-variant">This label does not change the amount due or any existing receipts. A payment or a change to the amount or due date restores automatic calculation.</p></div>
        : <p className="mt-3 text-sm text-on-surface-variant">Remove any manual label and calculate status from the current balance and due date.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    <section aria-label="Invoice status history" className="mt-6 border-t border-outline-variant/60 pt-4"><h3 className="font-semibold">Status history</h3>
      {history.error ? <div role="alert" className="mt-3 text-sm">Could not load status history.<Button size="sm" variant="outline" onClick={history.reload}>Retry history</Button></div>
        : !history.ready ? <LoadingSkeleton label="Loading invoice status history…" variant="card" />
          : rows.length ? <><ol className="mt-3 divide-y divide-outline-variant/40">{rows.slice(0, visible).map((row) => <li key={row.id} className="py-3 text-sm"><p className="font-medium">{row.from} → {row.to} · {row.mode}</p><p className="mt-1 whitespace-pre-wrap break-words">{row.reason}</p><p className="mt-1 text-xs text-on-surface-variant">{row.by} · {fmtDate(row.at)} · {new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p></li>)}</ol>{rows.length > visible && <Button size="sm" variant="ghost" onClick={() => setVisible(visible + 10)}>Show more history</Button>}</>
            : <p className="mt-3 text-sm text-on-surface-variant">No status changes recorded yet.</p>}
    </section>
  </Modal>;
}
