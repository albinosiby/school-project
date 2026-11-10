"use client";
import { useState, useSyncExternalStore } from "react";
import { Button, Field, Input, Modal, Select, Switch } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { batchFeeItems, classLabel, FEE_FREQUENCIES, type FeeFrequency } from "./feePlan";
import { invoiceStatus, nextInvoiceNos } from "./logic";
import { todayIso, type Invoice, type Structure } from "./types";
import { classStream, isSeniorGrade, streamsForGrade, studentStream, type AcademicClass, type StreamId } from "@/lib/academicStreams";

type Student = { id: string; name: string; grn: string; grade: string; section: string; classId?: string; streamId?: string; stream?: string; guardian: string; phone: string };
const noopSub = () => () => {};

export function BatchInvoiceDialog({ open, onClose, structure, students, classes = [], invoices, onCreate }: { open: boolean; onClose: () => void; structure: Structure[]; students: Student[]; classes?: AcademicClass[]; invoices: Invoice[]; onCreate: (rows: Omit<Invoice, "id">[], notifyParents: boolean) => Promise<void> }) {
  const [grade, setGrade] = useState("8");
  const [stream, setStream] = useState<StreamId | "">("");
  const [term, setTerm] = useState("Term 2");
  const [period, setPeriod] = useState("");
  const [frequency, setFrequency] = useState<FeeFrequency>("Monthly");
  const [dueDraft, setDue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notifyParents, setNotifyParents] = useState(false);
  const clientToday = useSyncExternalStore(noopSub, todayIso, () => "");
  const senior = isSeniorGrade(grade);
  const streams = streamsForGrade(structure, grade);
  const fs = structure.find((row) => row.grade === grade && (!senior || !!stream && classStream(row) === stream));
  const configured = fs?.schemaVersion === 2;
  const frequencies = FEE_FREQUENCIES.filter((value) => fs && batchFeeItems(fs, value).length);
  const selectedFrequency = frequencies.includes(frequency) ? frequency : frequencies[0] ?? "Monthly";
  const due = dueDraft ?? (configured ? batchFeeItems(fs, selectedFrequency).map((item) => item.dueDate).filter(Boolean).sort()[0] ?? clientToday : "2026-12-15");
  const billingPeriod = configured ? `${fs.academicYear ?? ""} · ${selectedFrequency} · ${period.trim()}` : term;
  const lines = fs ? configured ? batchFeeItems(fs, selectedFrequency).map((item) => ({ label: item.name, amount: item.amount })) : [{ label: `Tuition Fee (${term})`, amount: fs.tuition }, { label: "Lab", amount: fs.lab }, { label: "Activity", amount: fs.activity }, { label: "Library", amount: fs.library }] : [];
  const total = Math.round(lines.reduce((sum, line) => sum + line.amount, 0) * 100) / 100;
  const targets = students.filter((student) => student.grade === grade && (!senior || !!stream && studentStream(student, classes) === stream) && !invoices.some((invoice) => invoice.grn === student.grn && (invoice.term ?? "").trim().toLowerCase() === billingPeriod.trim().toLowerCase()));
  const unassigned = senior ? students.filter((student) => student.grade === grade && !studentStream(student, classes)).length : 0;
  const canGenerate = !!fs && targets.length > 0 && !!due && total > 0 && Number.isFinite(total) && (!configured || !!period.trim());
  const close = () => {
    if (busy) return;
    setNotifyParents(false);
    onClose();
  };
  const run = async () => {
    if (!canGenerate || busy) return;
    setBusy(true);
    const today = todayIso();
    const nos = nextInvoiceNos(invoices, targets.length, today.slice(0, 4));
    try { await onCreate(targets.map((student, index) => ({ no: nos[index], studentId: student.id, student: student.name, grade: student.grade, section: student.section, ...(senior ? { streamId: stream, stream: streams.find((item) => item.id === stream)?.name ?? "" } : {}), grn: student.grn, guardian: student.guardian ?? "", phone: student.phone ?? "", term: billingPeriod, issued: today, due, amount: total, paid: 0, balance: total, status: invoiceStatus({ amount: total, paid: 0, due }, today), lines })), notifyParents);
      setNotifyParents(false);
      onClose();
    } catch { /* parent toasts; keep modal open */ } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} title="Generate Batch Invoices" subtitle="Creates invoices from the fee structure for enrolled students" footer={<><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button disabled={busy || !canGenerate} onClick={run}>{busy ? "Generating…" : `Generate ${fs ? targets.length : 0} invoices`}</Button></>}>
      <div className="grid gap-4">
        <Field label="Grade"><Select value={grade} onChange={(event) => { setGrade(event.target.value); setStream(""); setDue(null); }}>{["LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => String(index + 1))].map((value) => <option key={value} value={value}>{classLabel(value)}</option>)}</Select></Field>
        {senior && <Field label="Stream" required><Select value={stream} onChange={(event) => { setStream(event.target.value as StreamId | ""); setDue(null); }}><option value="">Select a stream…</option>{streams.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>}
        {configured ? <>
          <Field label="Collection frequency"><Select value={selectedFrequency} onChange={(event) => setFrequency(event.target.value as FeeFrequency)}>{frequencies.map((value) => <option key={value}>{value}</option>)}</Select></Field>
          <Field label="Billing period" hint="Use a distinct period for each collection, e.g. November or Term 1."><Input value={period} maxLength={80} onChange={(event) => setPeriod(event.target.value)} placeholder="e.g. November" /></Field>
          <p className="text-xs text-on-surface-variant">Batch invoices include mandatory fees for all students only. Use New invoice for optional services and new-admission-only charges.</p>
          {!!lines.length && <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">{lines.map((line, index) => <li key={index} className="flex justify-between gap-3 p-3 text-sm"><span>{line.label}</span><span>{inrFull(line.amount)}</span></li>)}</ul>}
        </> : !senior && <Field label="Term"><Select value={term} onChange={(event) => setTerm(event.target.value)}><option>Term 2</option><option>Term 3</option></Select></Field>}
        {unassigned > 0 && <p className="text-xs text-warning">{unassigned} students have no stream assignment and are excluded. Assign their stream under Students &amp; Guardians before billing.</p>}
        <Field label="Due date" required hint={configured ? "Choose the due date for this collection. A saved first due date is prefilled if available." : undefined}><Input type="date" value={due} onChange={(event) => setDue(event.target.value)} /></Field>
        <fieldset disabled={busy} className="flex items-center justify-between gap-4 rounded-lg border border-outline-variant/60 p-4"><div><p className="text-sm font-semibold">Notify parents</p><p className="mt-1 text-xs leading-5 text-on-surface-variant">Send an initial payment request in the parent app for each invoice created. Only families in this batch are notified.</p></div><Switch checked={notifyParents} onChange={setNotifyParents} label="Notify parents" /></fieldset>
        <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">{!fs ? `No fee structure is set for ${classLabel(grade)}. Add it under Fee Structure first.` : !lines.length ? "No mandatory general fees are available for batch billing." : targets.length ? <>{targets.length} enrolled students in {classLabel(grade)} without an invoice for this billing period. Each is billed <b>{inrFull(total)}</b>.</> : "Every enrolled student in this class already has an invoice for this billing period."}</p>
      </div>
    </Modal>
  );
}

