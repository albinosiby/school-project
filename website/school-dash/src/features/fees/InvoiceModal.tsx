"use client";
import { useState } from "react";
import Image from "next/image";
import { Button, LoadingSkeleton, Modal } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { downloadInvoicePdf, type InvoiceSchool } from "./invoicePdf";
import { formatInvoiceMoney as inrFull, invoicePresentation } from "./invoicePresentation";
import type { Invoice } from "./types";
import { ShareInvoiceDialog } from "./ShareInvoiceDialog";

const PRINT_CSS = `@media print {
  @page { size: A4; margin: 14mm; }
  body:has(#student-fee-invoice) *:not(#student-fee-invoice):not(#student-fee-invoice *):not(:has(#student-fee-invoice)) { display: none !important; }
  body *:has(#student-fee-invoice) { display: block !important; position: static !important; height: auto !important; max-height: none !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; background: #fff !important; }
  #student-fee-invoice { position: static; width: 100%; padding: 20px 0 0; border: 0; border-top: 4px solid #0755D9; border-radius: 0; box-shadow: none; background: #fff; color: #183153; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
  #student-fee-invoice tr, #student-fee-invoice .invoice-info, #student-fee-invoice .invoice-totals { break-inside: avoid; }
  #student-fee-invoice .invoice-table { overflow: visible; }
  #student-fee-invoice table { min-width: 0; font-size: 10px; }
  #student-fee-invoice thead { display: table-header-group; }
}`;
const labelClass = "text-[10px] font-semibold uppercase tracking-wider";

export function InvoiceModal({ invoice, school, onClose }: { invoice: Invoice; school: InvoiceSchool; onClose: () => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [sharing, setSharing] = useState(false);
  const [loadedLogo, setLoadedLogo] = useState<string>(); const [failedLogo, setFailedLogo] = useState<string>();
  const model = invoicePresentation(invoice, school), colors = model.colors;
  const logoLoading = Boolean(school.logoUrl && loadedLogo !== school.logoUrl && failedLogo !== school.logoUrl);
  const logoFailed = Boolean(school.logoUrl && failedLogo === school.logoUrl);
  async function download() {
    if (busy) return;
    setBusy(true); setError("");
    try { await downloadInvoicePdf(invoice, school); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not download the PDF. Try again."); } finally { setBusy(false); }
  }
  if (sharing) return <ShareInvoiceDialog key={JSON.stringify([invoice, school])} invoice={invoice} school={school} onClose={() => setSharing(false)} />;
  return <Modal open title="Student invoice" subtitle={invoice.no} width="max-w-3xl" onClose={onClose}
    footer={<><Button variant="outline" disabled={busy} onClick={() => setSharing(true)}>Share</Button><Button variant="outline" disabled={logoLoading} onClick={() => window.print()}>Print</Button><Button disabled={busy} onClick={download}>{busy ? "Preparing PDF…" : "Download PDF"}</Button></>}>
    <style>{PRINT_CSS}</style>
    <article id="student-fee-invoice" className="rounded-lg border px-5 py-6 text-sm shadow-sm sm:px-7 sm:py-7"
      style={{ background: "#fff", color: colors.ink, borderColor: colors.line, borderTopColor: colors.blue, borderTopWidth: 4, colorScheme: "light" }}>
      <header className="flex flex-wrap items-start justify-between gap-5 border-b pb-6" style={{ borderColor: colors.line }}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {school.logoUrl && !logoFailed && <div className="relative size-20 shrink-0">
            {logoLoading && <LoadingSkeleton variant="avatar" label="Loading school logo…" className="absolute inset-0 overflow-hidden" />}
            <Image unoptimized loading="eager" src={school.logoUrl} alt={`${model.schoolName} logo`} width={80} height={80} className="size-20 object-contain"
              onLoad={() => setLoadedLogo(school.logoUrl)} onError={() => setFailedLogo(school.logoUrl)} />
          </div>}
          <div className="min-w-0 max-w-xs"><h3 className="text-xl font-semibold leading-snug">{model.schoolName}</h3>{model.affiliation && <p className="mt-2 text-xs leading-relaxed" style={{ color: colors.muted }}>{model.affiliation}</p>}{school.city && <p className="mt-0.5 text-xs" style={{ color: colors.muted }}>{school.city}</p>}</div>
        </div>
        <div className="min-w-40 sm:max-w-52 sm:text-right"><h4 className="text-2xl font-bold tracking-wide" style={{ color: colors.blue }}>INVOICE</h4><p className="mt-1 break-all font-mono text-xs" style={{ color: colors.muted }}>{invoice.no}</p>
          <span className="mt-3 inline-block rounded px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide" style={{ background: colors.soft, color: model.status === "Paid" ? colors.green : colors.blue }}>{model.statusLabel}</span>
        </div>
      </header>
      <div className="invoice-info my-6 grid gap-4 sm:grid-cols-2">
        <section aria-label="Student billing details" className="rounded-md p-4" style={{ background: colors.soft }}>
          <p className={labelClass} style={{ color: colors.blue }}>Billed to</p><p className="mt-3 break-words text-base font-semibold">{invoice.student}</p>
          <p className="mt-1 text-xs" style={{ color: colors.muted }}>GRN: {invoice.grn || "Not recorded"}</p><p className="mt-2 text-xs leading-relaxed">{model.className}</p>
          {invoice.guardian && <p className="mt-2 break-words text-xs">Guardian: {invoice.guardian}</p>}{invoice.phone && <p className="mt-1 text-xs">Phone: {invoice.phone}</p>}
        </section>
        <section aria-label="Invoice billing details" className="rounded-md border p-4" style={{ borderColor: colors.line }}>
          <p className={labelClass} style={{ color: colors.blue }}>Invoice details</p>
          <dl className="mt-3 grid grid-cols-2 gap-3"><div><dt className={labelClass} style={{ color: colors.muted }}>Issued</dt><dd className="mt-1 text-xs font-semibold">{invoice.issued ? fmtDate(invoice.issued) : "Not recorded"}</dd></div>
            <div><dt className={labelClass} style={{ color: colors.muted }}>Due date</dt><dd className="mt-1 text-xs font-semibold">{invoice.due ? fmtDate(invoice.due) : "Not recorded"}</dd></div>
            <div className="col-span-2"><dt className={labelClass} style={{ color: colors.muted }}>Academic year</dt><dd className="mt-1 text-xs">{model.year || "Not recorded"}</dd></div>
            <div className="col-span-2"><dt className={labelClass} style={{ color: colors.muted }}>Billing period</dt><dd className="mt-1 break-words text-xs">{model.period}</dd></div>
          </dl>
        </section>
      </div>
      <div className="invoice-table overflow-x-auto"><table className="w-full min-w-[460px] border-collapse text-left text-xs">
        <thead style={{ background: colors.soft, color: colors.blue }}><tr><th className="px-3 py-3 text-[10px] font-semibold uppercase tracking-wide">Fee description</th><th className="px-2 py-3 text-right text-[10px] font-semibold uppercase">Qty</th><th className="px-3 py-3 text-right text-[10px] font-semibold uppercase">Rate</th><th className="px-3 py-3 text-right text-[10px] font-semibold uppercase">Amount</th></tr></thead>
        <tbody>{model.lines.map((item, index) => <tr key={index} className="border-b" style={{ borderColor: colors.line, background: index % 2 ? "#FBFCFF" : "#fff", color: item.amount < 0 ? colors.green : colors.ink }}>
          <td className="min-w-40 px-3 py-3.5 leading-relaxed">{item.label}</td><td className="px-2 py-3.5 text-right tabular-nums">{item.quantity ?? "-"}</td><td className="whitespace-nowrap px-3 py-3.5 text-right tabular-nums">{item.rate === null ? "-" : inrFull(item.rate)}</td><td className="whitespace-nowrap px-3 py-3.5 text-right font-semibold tabular-nums">{inrFull(item.amount)}</td>
        </tr>)}</tbody>
      </table></div>
      <div className="invoice-totals mt-6 grid items-start gap-6 sm:grid-cols-2">
        <p className="max-w-64 text-xs leading-relaxed" style={{ color: colors.muted }}><span className="mb-2 block font-semibold" style={{ color: colors.ink }}>Thank you.</span>Please retain this invoice for your records. A payment receipt is issued separately.</p>
        <div><dl className="space-y-3 px-3 text-xs">
          <div className="flex justify-between gap-4" style={{ color: colors.muted }}><dt>Charges</dt><dd className="tabular-nums">{inrFull(model.subtotal)}</dd></div>
          {model.discount > 0 && <div className="flex justify-between gap-4" style={{ color: colors.green }}><dt>Concessions</dt><dd className="tabular-nums">-{inrFull(model.discount)}</dd></div>}
          <div className="flex justify-between gap-4 font-semibold"><dt>Invoice total</dt><dd className="tabular-nums">{inrFull(model.amount)}</dd></div>
          <div className="flex justify-between gap-4" style={{ color: colors.muted }}><dt>Paid</dt><dd className="tabular-nums">{inrFull(model.paid)}</dd></div>
        </dl><dl className="mt-4 rounded-md px-4 py-3 text-white" style={{ background: colors.blue }}><dt className="text-[10px] font-semibold uppercase tracking-wider">Balance due</dt><dd className="mt-1 text-right text-2xl font-semibold tabular-nums">{inrFull(model.balance)}</dd></dl></div>
      </div>
      <footer className="mt-7 border-t pt-3 text-[10px]" style={{ borderColor: colors.line, color: colors.muted }}>Computer-generated invoice</footer>
    </article>
    {logoFailed && <p role="status" className="mt-3 text-sm text-on-surface-variant">The school logo could not load. <button className="font-semibold text-secondary hover:underline" onClick={() => { setLoadedLogo(undefined); setFailedLogo(undefined); }}>Retry logo</button></p>}
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
  </Modal>;
}
