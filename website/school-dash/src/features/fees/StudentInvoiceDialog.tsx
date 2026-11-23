"use client";

import { useState } from "react";
import { Button, Modal } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { annualStudentFees, invoicePreview, TRANSPORT_CHARGE_ID, type InvoiceChoice } from "@/features/people/studentAnnualFees";
import { studentFeePlan } from "@/features/people/studentFees";
import { studentTransportFee } from "@/features/transport/transportFees";
import { generateStudentInvoice, type StudentInvoiceSource } from "./studentInvoiceService";
import { todayIso, type Invoice } from "./types";

const inputClass = "mt-1 w-full rounded-lg border border-outline-variant bg-surface p-2.5 text-sm";

/** Source is captured when opened; the transaction checks it again before saving. */
export function StudentInvoiceDialog({ source, onClose, onSaved }: { source: StudentInvoiceSource; onClose: () => void; onSaved: (invoice: Invoice) => void }) {
  const plan = studentFeePlan(source.student, [source.structure], source.academicYear);
  const annual = annualStudentFees({ ...plan, terms: source.terms, admissionDate: source.student.admissionDate,
    invoices: source.invoices, concessions: source.concessions, busId: source.student.busId,
    transportAmount: studentTransportFee({ ...source.student, transportFee: source.transportFee }), transportFrequency: source.transportFrequency });
  const [choices, setChoices] = useState<InvoiceChoice[]>(() => annual.charges.filter((item) => item.preselect && item.remaining > 0).map((item) => ({ feeItemId: item.id, quantity: item.remaining })));
  const [period, setPeriod] = useState(annual.yearInvoices.length ? "Remaining academic year" : "Full academic year");
  const [due, setDue] = useState(todayIso);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  let preview: ReturnType<typeof invoicePreview> | undefined;
  let previewError = "";
  try { preview = invoicePreview(annual.charges, choices, annual.concessions); }
  catch (cause) { previewError = cause instanceof Error ? cause.message : "Review fee selections."; }
  const close = () => { if (!busy) onClose(); };
  async function save() {
    if (!preview || busy) return;
    setBusy(true); setError("");
    try { onSaved(await generateStudentInvoice({ source, period, due, choices, preview })); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not generate the invoice. Try again."); setBusy(false); }
  }
  return <Modal open title="Generate student invoice" subtitle={source.academicYear} width="max-w-2xl" onClose={close}
    footer={<><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button disabled={busy || !preview || !annual.complete || !period.trim() || !due} onClick={save}>{busy ? "Creating invoice…" : "Create invoice"}</Button></>}>
    <div className="rounded-lg bg-surface-container-low p-3 text-sm"><p className="font-semibold">{source.student.name}</p><p className="text-on-surface-variant">{source.student.grn} · Grade {source.student.grade}{source.student.section ? ` · ${source.student.section}` : ""}</p></div>
    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <label className="text-sm font-medium">Billing period<input className={inputClass} value={period} maxLength={80} disabled={busy} onChange={(event) => setPeriod(event.target.value)} /></label>
      <label className="text-sm font-medium">Due date<input type="date" className={inputClass} min={todayIso()} value={due} disabled={busy} onChange={(event) => setDue(event.target.value)} /></label>
    </div>
    <fieldset disabled={busy} className="mt-5"><legend className="font-semibold">Fee items</legend>
      <p className="mt-1 text-xs text-on-surface-variant">Each ticked item is billed for the instalments not yet invoiced this year.{annual.charges.some((item) => item.id === TRANSPORT_CHARGE_ID) && " Transport is not ticked by default, so it can be billed with this invoice or on its own later."}</p>
      <div className="mt-3 space-y-2">{annual.charges.map((item) => {
        const choice = choices.find((row) => row.feeItemId === item.id);
        return <div key={item.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-3">
          <label className="flex min-w-0 flex-1 items-center gap-3 text-sm"><input type="checkbox" checked={Boolean(choice)} disabled={item.remaining === 0} onChange={(event) => setChoices(event.target.checked ? [...choices, { feeItemId: item.id, quantity: item.remaining }] : choices.filter((row) => row.feeItemId !== item.id))} />
            <span><span className="font-medium">{item.name}</span><span className="mt-1 block text-xs text-on-surface-variant">{inrFull(item.unitAmount)} · {item.frequency}{!item.mandatory && " · Optional"}{item.id === TRANSPORT_CHARGE_ID && " · Tick to bill with this invoice"}{item.remaining === 0 ? " · Fully invoiced" : item.remaining > 1 ? ` · ${item.remaining} instalments due` : ""}</span></span>
          </label>
          {choice && <span className="text-sm font-semibold tabular-nums">{inrFull(item.unitAmount * choice.quantity)}</span>}
        </div>;
      })}</div>
    </fieldset>
    {preview && <section aria-label="Invoice preview" className="mt-4 rounded-lg bg-surface-container-low p-4 text-sm">
      <h3 className="mb-3 font-semibold">Invoice preview</h3>
      <dl className="space-y-2"><div className="flex justify-between gap-3"><dt>Selected charges</dt><dd>{inrFull(preview.gross)}</dd></div>
        {preview.allocations.map((row) => <div key={row.concessionId} className="flex justify-between gap-3"><dt>Concession · {row.type}</dt><dd>−{inrFull(row.amount)}</dd></div>)}
        <div className="flex justify-between gap-3 border-t border-outline-variant pt-3 text-lg font-semibold"><dt>Invoice amount</dt><dd>{inrFull(preview.amount)}</dd></div></dl>
      <p className="mt-3 text-xs text-on-surface-variant">Only the unused part of approved concessions is applied. This invoice will be available to the parent in the app.</p>
    </section>}
    {(error || previewError || !annual.complete) && <p role="alert" className="mt-3 text-sm text-error">{error || annual.issues[0] || previewError}</p>}
  </Modal>;
}
