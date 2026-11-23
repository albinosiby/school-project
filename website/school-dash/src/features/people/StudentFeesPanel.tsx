"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Button, Card, DataTable, EmptyState, LoadingSkeleton, useToast, type Column, type Tone } from "@/components/ui";
import { classLabel, type FeeFrequency } from "@/features/fees/feePlan";
import { balanceOf, manualInvoiceStatus, paymentRef, shownStatus } from "@/features/fees/logic";
import { ReceiptModal } from "@/features/fees/ReceiptModal";
import { InvoiceModal } from "@/features/fees/InvoiceModal";
import { StudentInvoiceDialog } from "@/features/fees/StudentInvoiceDialog";
import { CollectPaymentDialog } from "@/features/fees/CollectPaymentDialog";
import { InvoiceStatusDialog } from "@/features/fees/InvoiceStatusDialog";
import type { StudentInvoiceSource } from "@/features/fees/studentInvoiceService";
import type { InvoiceSchool } from "@/features/fees/invoicePdf";
import type { Concession, Invoice, Payment, Structure } from "@/features/fees/types";
import { studentTransportFee, type StudentTransportFee } from "@/features/transport/transportFees";
import { useAuth } from "@/lib/authContext";
import { fmtDate, inrFull } from "@/lib/format";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { studentFeePlan, studentFeeRecords } from "./studentFees";
import { annualStudentFees, type FeeTerm } from "./studentAnnualFees";
import type { Student } from "./StudentsView";

const invoiceTone: Record<Invoice["status"], Tone> = { Paid: "success", Partial: "warning", Pending: "info", Overdue: "danger" };

/** Annual assessment and financial history from the school-scoped Fees & Payments stores. */
export function StudentFeesPanel({ student, students, invoiceActionLabel = "Generate invoice" }: { student: Student; students: Student[]; invoiceActionLabel?: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const allowed = user?.role === "admin" || user?.role === "owner";
  const invoices = useCollection<Invoice>("fee_invoices", allowed);
  const payments = useCollection<Payment>("fee_payments", allowed);
  const concessions = useCollection<Concession>("fee_concessions", allowed);
  const structures = useCollection<Structure>("fee_structure", allowed);
  const school = useCollection<InvoiceSchool & { id: string; academicYear?: string }>("school", allowed);
  const terms = useCollection<FeeTerm>("set_terms", allowed);
  const policy = useCollection<{ id: string; transportFrequency?: FeeFrequency | "" }>("set_config", allowed);
  const transportFees = useCollection<StudentTransportFee>("student_transport_fees", allowed, [["studentId", "==", student.id]]);
  const { date } = useSchoolClock();
  const headingId = useId();
  const [receiptId, setReceiptId] = useState("");
  const [collectedReceipt, setCollectedReceipt] = useState<Payment | null>(null);
  const [collecting, setCollecting] = useState<{ invoiceId?: string; intent?: "Partial" | "Paid" } | null>(null);
  const [statusInvoice, setStatusInvoice] = useState<Invoice | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState<Invoice | null>(null);
  const [invoiceSource, setInvoiceSource] = useState<StudentInvoiceSource | null>(null);
  const records = useMemo(() => studentFeeRecords(student, students, invoices.rows, payments.rows, concessions.rows),
    [student, students, invoices.rows, payments.rows, concessions.rows]);
  const schoolInfo = school.rows.find((row) => row.id === "school");
  const year = schoolInfo?.academicYear ?? "";
  const plan = useMemo(() => studentFeePlan(student, structures.rows, year), [student, structures.rows, year]);
  const transportFee = transportFees.rows.find((row) => row.id === student.id);
  const amount = studentTransportFee({ ...student, transportFee });
  const transportFrequency = policy.rows.find((row) => row.id === "fee_policy")?.transportFrequency;
  const annual = useMemo(() => annualStudentFees({ ...plan, terms: terms.rows, admissionDate: student.admissionDate, invoices: records.invoices,
    concessions: records.concessions, busId: student.busId, transportAmount: amount, transportFrequency }),
    [plan, terms.rows, student.admissionDate, student.busId, records.invoices, records.concessions, amount, transportFrequency]);
  const sources = [invoices, payments, concessions, structures, school, policy, transportFees, terms];
  const failed = sources.filter((source) => source.error);
  const ready = sources.every((source) => source.ready);
  const canManage = !student.deleted;

  if (!allowed) return null;
  if (failed.length) return <Card role="alert" className="mt-5 p-5">
    <h2 className="font-semibold">Fees &amp; payment history unavailable</h2>
    <p className="mt-1 text-sm text-on-surface-variant">Could not load the student’s fee records.</p>
    <Button variant="outline" className="mt-3" onClick={() => failed.forEach((source) => source.reload())}>Retry fee records</Button>
  </Card>;
  if (!ready) return <Card className="mt-5 p-5"><LoadingSkeleton variant="table" label="Loading student fees and payment history…" /></Card>;

  const invoiceColumns: Column<Invoice>[] = [
    { key: "no", header: "Invoice", render: (row) => <div><span className="font-mono text-xs">{row.no}</span><p className="text-xs text-outline">{row.term}</p></div> },
    { key: "items", header: "Fee items", render: (row) => <div className="space-y-1">{row.lines?.map((line, index) => <p key={index} className="text-xs">{line.label} · {inrFull(line.amount)}</p>)}</div> },
    { key: "due", header: "Due date", render: (row) => row.due ? fmtDate(row.due) : "—" },
    { key: "amount", header: "Billed", render: (row) => inrFull(row.amount) },
    { key: "paid", header: "Paid", render: (row) => inrFull(row.paid ?? 0) },
    { key: "balance", header: "Outstanding", render: (row) => inrFull(balanceOf(row)) },
    { key: "status", header: "Status", render: (row) => { const status = shownStatus(row, date); return <div><Badge tone={invoiceTone[status] ?? "neutral"}>{status}</Badge>{manualInvoiceStatus(row) && <p className="mt-1 text-xs text-outline">Manual</p>}</div>; } },
    { key: "view", header: "Actions", render: (row) => <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" size="sm" aria-label={`View invoice ${row.no}`} onClick={() => setInvoiceOpen(row)}>View / download</Button>
      {canManage && <><Button variant="outline" size="sm" aria-label={`Change status for ${row.no}`} onClick={() => setStatusInvoice(row)}>Change status</Button>
        {balanceOf(row) > 0 && <Button size="sm" aria-label={`Collect payment for ${row.no}`} onClick={() => setCollecting({ invoiceId: row.id })}>Collect</Button>}</>}</div> },
  ];
  const paymentColumns: Column<Payment>[] = [
    { key: "date", header: "Date", render: (row) => row.date ? fmtDate(row.date) : "—" },
    { key: "receipt", header: "Receipt", render: (row) => <span className="font-mono text-xs">{row.receiptNo}</span> },
    { key: "invoice", header: "Invoice", render: (row) => <span className="font-mono text-xs">{row.invoiceNo || "—"}</span> },
    { key: "amount", header: "Amount paid", render: (row) => <b>{inrFull(row.amount)}</b> },
    { key: "mode", header: "Method / reference", render: (row) => <div>{(row.mode ?? "").split(" · ")[0]}{paymentRef(row) && <p className="break-all text-xs text-outline">{paymentRef(row)}</p>}</div> },
    { key: "by", header: "Collected by", render: (row) => row.by || "—" },
    { key: "view", header: "", render: (row) => <Button variant="outline" size="sm" aria-label={`View receipt ${row.receiptNo}`} onClick={() => setReceiptId(row.id)}>View receipt</Button> },
  ];
  const totals = [{ label: "Total billed", value: records.billed }, { label: "Total paid", value: records.paid },
    { label: "Outstanding balance", value: records.outstanding }, { label: "Approved concessions", value: records.approvedConcessions }];

  return <section aria-labelledby={headingId} className="mt-5 space-y-4">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
        <div><h2 id={headingId} className="t-headline-md">Fees</h2><p className="mt-1 text-sm text-on-surface-variant">Annual fees, invoices and concessions for this student.</p></div>
        <div className="flex flex-wrap items-center gap-3"><Link href="/fees" className="text-sm font-semibold text-secondary hover:underline">Open Fees &amp; Payments</Link>
          {canManage && <Button size="sm" disabled={!records.invoices.length} onClick={() => setCollecting({})}>Collect payment</Button>}
          {!student.deleted && (student.status ?? "Active") === "Active" && <Button size="sm" variant="outline" disabled={!plan.structureId || !annual.complete || !annual.charges.some((row) => row.remaining > 0)} onClick={() => {
            const structure = structures.rows.find((row) => row.id === plan.structureId);
            if (structure) setInvoiceSource({ student, structure, academicYear: year, terms: terms.rows, transportFee, transportFrequency, invoices: records.invoices, concessions: records.concessions });
          }}>{invoiceActionLabel}</Button>}</div>
      </div>
      <div className="mx-5 mb-4 rounded-xl bg-info-container/50 p-4">
        <h3 className="text-sm font-semibold">Total amount to pay · Full academic year{year ? ` · ${year}` : ""}</h3>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{annual.complete ? inrFull(annual.payable) : "Not configured"}</p>
        {annual.complete ? <><dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">{[["Annual charges", annual.gross], ["Year concessions", annual.concessionsTotal], ["Net annual fee", annual.net], ["Paid this year", annual.paid]].map(([label, value]) => <div key={label}><dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-1 font-semibold">{inrFull(Number(value))}</dd></div>)}</dl>
          <p className="mt-3 text-xs text-on-surface-variant">All required collections for the year, including applicable admission and transport charges, less approved concessions and recorded payments. Optional fees are included once invoiced. Issued invoice balances are shown below.</p></>
          : <p className="mt-2 text-sm text-on-surface-variant">{annual.issues[0] || "Configure fee items for this class and academic year."}</p>}
      </div>
      <dl className="grid grid-cols-2 gap-3 px-5 sm:grid-cols-4">
        {totals.map(({ label, value }) => <div key={label} className="rounded-lg bg-surface-container-low p-4">
          <dt className="text-xs text-on-surface-variant">{label}</dt><dd className="mt-2 text-xl font-semibold tabular-nums">{inrFull(value)}</dd>
        </div>)}
      </dl>
      {!records.uniqueGrn && <p role="status" className="mx-5 mt-3 rounded-lg bg-warning-container p-3 text-sm">Older records cannot be matched reliably because the student’s GRN is missing or shared. Only records linked to this student’s invoices are shown.</p>}
      <div className="p-5">
        <h3 className="font-semibold">Configured fee items · {classLabel(plan.scope)}{plan.academicYear ? ` · ${plan.academicYear}` : ""}</h3>
        <p className="mt-1 text-xs text-on-surface-variant">Amounts per collection for the recorded class. Configured charges are separate from issued invoices.</p>
        {plan.items.length ? <ul className="mt-3 grid gap-3 sm:grid-cols-2">{plan.items.map((item) => <li key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-outline-variant/60 p-3 text-sm">
          <div><p className="font-medium">{item.name}</p><p className="mt-1 text-xs text-on-surface-variant">{item.frequency}{!item.mandatory && " · Optional"}{item.newStudentsOnly && " · New admissions only"}</p></div><span className="whitespace-nowrap font-semibold">{inrFull(item.amount)}</span>
        </li>)}</ul> : <p className="mt-3 text-sm text-on-surface-variant">No grade fee items configured for this class and academic year.</p>}
        {student.busId && <div className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg border border-outline-variant/60 p-3 text-sm"><div><p className="font-medium">Transport</p><p className="mt-1 text-xs text-on-surface-variant">{transportFrequency || "Collection frequency not configured"}</p></div><span className="font-semibold">{amount === null ? "Amount not configured" : inrFull(amount)}</span></div>}
        <h3 className="mb-2 mt-5 font-semibold">Concessions</h3>
        <p className="mb-3 text-xs text-on-surface-variant">Shown separately. Outstanding balances come from the saved invoices.</p>
        {records.concessions.length ? <ul className="divide-y divide-outline-variant/40">{records.concessions.map((row) => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
          <div><p className="font-medium">{row.type}</p><p className="text-xs text-outline">{row.requested ? fmtDate(row.requested) : "Date not recorded"}</p></div><div className="flex items-center gap-3"><span className="font-semibold">{inrFull(row.amount)}</span><Badge tone={row.status === "Approved" ? "success" : row.status === "Rejected" ? "neutral" : "warning"}>{row.status}</Badge></div>
        </li>)}</ul> : <p className="text-sm text-on-surface-variant">No concessions recorded.</p>}
        <h3 className="mt-5 font-semibold">Invoices</h3>
        {annual.complete && !annual.charges.some((row) => row.remaining > 0) && records.invoices.length > 0 && <p className="mt-2 text-xs text-on-surface-variant">All annual collections have been invoiced. Open a saved invoice to download or share its outstanding balance.</p>}
      </div>
      <DataTable rows={records.invoices} columns={invoiceColumns} pageSize={6} resetKey={student.id} empty={<EmptyState title="No invoices recorded" hint="Issued invoices will appear here." />} />
    </Card>
    <Card>
      <div className="p-5 pb-3"><h2 className="t-headline-md">Payment history</h2><p className="mt-1 text-sm text-on-surface-variant">All recorded payments, newest first. Open a receipt to view or print it.</p></div>
      <DataTable rows={records.payments} columns={paymentColumns} pageSize={6} resetKey={student.id} empty={<EmptyState title="No payments recorded" hint="Payment receipts will appear here after a payment is recorded." />} />
    </Card>
    <ReceiptModal payment={records.payments.find((row) => row.id === receiptId) ?? collectedReceipt} onClose={() => { setReceiptId(""); setCollectedReceipt(null); }} />
    {canManage && collecting && <CollectPaymentDialog invoices={records.invoices} initialInvoiceId={collecting.invoiceId} intent={collecting.intent}
      storageKey={`fee-payment:${currentSchoolId()}:${user?.id}:${student.id}`} onClose={() => setCollecting(null)}
      onSaved={(payment) => { setCollecting(null); setCollectedReceipt(payment); setReceiptId(payment.id); toast(`Payment collected · receipt ${payment.receiptNo} issued`); }} />}
    {canManage && statusInvoice && <InvoiceStatusDialog invoice={records.invoices.find((row) => row.id === statusInvoice.id) ?? statusInvoice} today={date}
      onClose={() => setStatusInvoice(null)} onSaved={() => { setStatusInvoice(null); toast("Invoice status updated"); }}
      onCollect={(intent) => { setCollecting({ invoiceId: statusInvoice.id, intent }); setStatusInvoice(null); }} />}
    {invoiceSource && <StudentInvoiceDialog source={invoiceSource} onClose={() => setInvoiceSource(null)} onSaved={(invoice) => { setInvoiceSource(null); setInvoiceOpen(invoice); }} />}
    {invoiceOpen && <InvoiceModal key={invoiceOpen.id} invoice={records.invoices.find((row) => row.id === invoiceOpen.id) ?? invoiceOpen} school={schoolInfo ?? {}} onClose={() => setInvoiceOpen(null)} />}
  </section>;
}
