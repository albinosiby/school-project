"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { writeBatch } from "firebase/firestore";
import { CheckCircle2, Download, FileText, MessageCircle, Plus, Receipt, Send, X } from "lucide-react";
import { LoadingSkeleton, Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inr, inrFull } from "@/lib/format";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { isActiveStudent } from "@/features/exams/logic";
import { downloadCsv } from "./csv";
import { createStamp, balanceOf, invoiceErrors, invoiceStatus, newId, nextInvoiceNos, reminderDoc, remindable, schoolDoc, shownStatus, type InvoiceDraft } from "./logic";
import { ReceiptModal } from "./ReceiptModal";
import { PaymentVerification } from "./PaymentVerification";
import { feeTotal, todayIso, type Concession, type Invoice, type Payment, type Reminder, type Structure } from "./types";
import { useMyName } from "@/lib/useMe";
import { BatchInvoiceDialog } from "./BatchInvoiceDialog";
import { FeePlanEditor } from "@/features/onboarding/FeePlanEditor";
import { classLabel, feePlanError, gradeFeeRecord, gradePlanScope, isTransportFee, normalizedFeePlan, type FeePlan } from "./feePlan";
import { feeScopesForClasses, parseFeeScope, streamName, type AcademicClass } from "@/lib/academicStreams";
import { StudentSearchSelect } from "@/features/people/StudentSearchSelect";
import { studentProfileHref } from "@/features/people/studentLogic";
import { useStudentDues } from "./useStudentDues";
import { StudentDuesDirectory } from "./StudentDuesDirectory";
import { InvoiceModal as SavedInvoiceModal } from "./InvoiceModal";

type Student = { id: string; name: string; grn: string; grade: string; section: string; classId?: string; streamId?: string; stream?: string; guardian: string; phone: string; status?: string; deleted?: boolean };
const tone = { Paid: "success", Pending: "info", Overdue: "danger", Partial: "warning" } as const;

export function FeesPage() {
  const toast = useToast();
  const me = useMyName();
  const dues = useStudentDues();
  const { invoices: inv, payments: pay, structures: str, concessions: con, students } = dues;
  const rem = useCollection<Reminder>("fee_reminders", dues.allowed);
  const studentIdsByGrn = useMemo(() => {
    const ids = new Map<string, string | null>();
    for (const student of students.rows) {
      const grn = (student.grn ?? "").trim().toLowerCase();
      if (!grn) continue;
      ids.set(grn, ids.has(grn) ? null : student.id);
    }
    return ids;
  }, [students.rows]);
  const classes = useCollection<AcademicClass>("classes", dues.allowed);
  const toVerify = useCollection<{ id: string; status: string }>("fee_claims", dues.allowed).rows.filter((c) => c.status === "Pending").length;

  const [main, setMain] = useState("invoices");
  const [tab, setTab] = useState("all");
  const [grade, setGrade] = useState("all");
  const [term, setTerm] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [ledgerView, setLedgerView] = useState("students");
  const [viewedInvoice, setViewedInvoice] = useState<Invoice | null>(null);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [newInv, setNewInv] = useState(false);
  const [batch, setBatch] = useState(false);
  const [editFs, setEditFs] = useState<Structure | null>(null);
  const [newCon, setNewCon] = useState(false);

  // client-only "today" without setState-in-effect (server snapshot is empty)
  const { date: t } = useSchoolClock();
  const todayPays = pay.rows.filter((p) => p.date === t);
  const todaySum = todayPays.reduce((a, p) => a + p.amount, 0);
  const billed = inv.rows.reduce((a, i) => a + i.amount, 0);
  const collected = inv.rows.reduce((a, i) => a + i.paid, 0);
  // the status shown is derived from paid / balance / due date (a stored "Pending" goes stale once the due date passes)
  const stOf = (i: Invoice) => shownStatus(i, t);
  const concApproved = con.rows.filter((c) => c.status === "Approved").reduce((a, c) => a + c.amount, 0);

  const terms = [...new Set(inv.rows.map((i) => i.term))];
  const filtered = useMemo(() => inv.rows.filter((i) =>
    (tab === "all" || (tab === "paid" ? shownStatus(i, t) === "Paid" : shownStatus(i, t) !== "Paid")) &&
    (grade === "all" || i.grade === grade) && (term === "all" || i.term === term)), [inv.rows, tab, grade, term, t]);
  const counts = { all: inv.rows.length, due: inv.rows.filter((i) => stOf(i) !== "Paid").length, paid: inv.rows.filter((i) => stOf(i) === "Paid").length };

  /** fee_reminders rows: each one pushes "Fee reminder" to the invoice's guardians in the parent app (contract 13.4) */
  const remind = async (rows: Invoice[]) => {
    const { due: list, already } = remindable(rows, rem.rows, t || todayIso());
    if (!list.length) return toast(already.length ? "Already reminded today" : "Nothing outstanding for the selection", "error");
    try {
      const sentAt = new Date().toISOString();
      await Promise.all(list.map((i) => rem.create(reminderDoc(i, sentAt, fmtDate) as Omit<Reminder, "id">)));
      toast(`Reminder sent to ${list.length} guardian${list.length > 1 ? "s" : ""} in the parent app${already.length ? ` (${already.length} already reminded today)` : ""}`);
      return true;
    } catch { toast("Could not log reminders", "error"); return false; }
  };
  const safe = (fn: () => Promise<unknown>, ok: string) => fn().then(() => toast(ok)).catch(() => toast("Could not save — check your connection", "error"));

  const generateInvoices = async (rows: Omit<Invoice, "id">[], notifyParents: boolean) => {
    let created = 0;
    try {
      // Each chunk uses at most 400 writes. A reminder is never queued without its invoice.
      for (let offset = 0; offset < rows.length; offset += 200) {
        const chunk = rows.slice(offset, offset + 200);
        const batch = writeBatch(db);
        const sentAt = new Date().toISOString();
        for (const row of chunk) {
          const invoice = { ...row, id: newId("inv") };
          batch.set(schoolDoc("fee_invoices", invoice.id), { ...invoice, ...createStamp() });
          if (notifyParents) {
            const id = `rem_${invoice.id}`;
            batch.set(schoolDoc("fee_reminders", id), { ...reminderDoc(invoice, sentAt, fmtDate), id, ...createStamp() });
          }
        }
        await batch.commit();
        created += chunk.length;
      }
      toast(`${created} invoices generated${notifyParents ? " · parent payment messages queued" : ""}`);
    } catch {
      toast(`Stopped after ${created} of ${rows.length} invoices. Please try again.`, "error");
      throw new Error("Could not generate all invoices");
    }
  };

  const cols: Column<Invoice>[] = [
    { key: "student", header: "Student & GRN", sortValue: (i) => i.student, render: (i) => (
      <div className="flex items-center gap-3"><Avatar name={i.student} size={32} /><div><div className="font-semibold">{i.student}</div><div className="text-xs text-outline">Gr {i.grade}-{i.section} · {i.grn}</div></div></div>) },
    { key: "inv", header: "Invoice details", sortValue: (i) => i.no, render: (i) => <span><span className="font-mono">{i.no}</span>{i.issued ? `, ${fmtDate(i.issued)}` : ""}</span> },
    { key: "amount", header: "Billed", sortValue: (i) => i.amount, render: (i) => <span className="font-semibold">{inrFull(i.amount)}</span> },
    { key: "balance", header: "Due", sortValue: balanceOf, render: (i) => <span className={balanceOf(i) ? "font-semibold text-error" : "text-outline"}>{inrFull(balanceOf(i))}</span> },
    { key: "status", header: "Status", sortValue: (i) => stOf(i), render: (i) => <Badge tone={tone[stOf(i)] ?? "neutral"}>{stOf(i)}</Badge> },
    { key: "act", header: "", render: (i) => stOf(i) === "Paid"
      ? <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); const p = pay.rows.filter((x) => x.invoiceId === i.id).sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo))[0]; if (p) setReceipt(p); else toast("No receipt on file", "error"); }}><Receipt size={14} />Receipt</Button>
      : <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); remind([i]); }}><Send size={14} />Remind</Button> },
  ];

  const selInv = inv.rows.filter((i) => sel.includes(i.id) && stOf(i) !== "Paid");
  const selSum = selInv.reduce((a, i) => a + balanceOf(i), 0);

  const exportInvoices = () => downloadCsv("fee-ledger.csv", [["Invoice", "Student", "GRN", "Grade", "Section", "Term", "Billed", "Paid", "Balance", "Status", "Due date"],
    ...inv.rows.map((i) => [i.no, i.student, i.grn, i.grade, i.section, i.term, i.amount, i.paid, i.balance, stOf(i), i.due])]);

  if (!dues.allowed) return <EmptyState title="Administrator access required" />;
  return (
    <>
      <PageHeader title="Fees & Payments" subtitle="Track student dues, invoices, payment history and concessions."
        actions={<><Button variant="outline" disabled={!dues.ready || dues.failed} onClick={() => { if (ledgerView === "issued") exportInvoices(); else downloadCsv("student-dues.csv", [["Student", "GRN", "Grade", "Division", "Guardian", "Phone", "Net annual fee", "Paid this year", "Remaining to pay", "Status"], ...dues.rows.map((row) => [row.student.name, row.student.grn, row.student.grade, row.student.section, row.student.guardian, row.student.phone, row.annual.complete ? row.annual.net : "Not configured", row.annual.paid, row.complete || row.remaining > 0 ? row.remaining : "Needs setup", row.complete ? row.settled ? "Settled" : "Balance due" : "Needs setup"])]); toast("Ledger downloaded"); }}><Download size={16} />Download Ledger (.csv)</Button><Button variant="outline" onClick={() => setNewInv(true)}><Plus size={16} />New Invoice</Button><Button onClick={() => setBatch(true)}><Plus size={16} />Generate Batch Invoices</Button></>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Today's Collection", v: inr(todaySum), s: `${todayPays.length} receipts today`, c: "text-on-surface", b: "success" as const },
          { l: "Fee Realization", v: inr(collected), s: `of ${inr(billed)} billed · ${billed ? ((collected / billed) * 100).toFixed(1) : 0}%`, c: "text-on-surface", b: "info" as const },
          { l: "Students with balance", v: `${dues.rows.filter((row) => row.remaining > 0).length} Students`, s: `${inrFull(dues.rows.reduce((sum, row) => sum + row.remaining, 0))} remaining${dues.rows.some((row) => !row.complete) ? " · some fees need setup" : ""}`, c: "text-error", b: "danger" as const },
          { l: "Concessions & Waivers", v: inrFull(concApproved), s: `${con.rows.filter((c) => c.status === "Pending").length} pending approval`, c: "text-on-surface", b: "success" as const },
        ].map((k) => (
          <Card key={k.l} className="p-5"><p className="text-on-surface-variant">{k.l}</p><div className={cn("mt-2 t-headline-lg", k.c)}>{!dues.ready && !dues.failed ? <LoadingSkeleton variant="inline" label="Loading fee summary…" className="h-8" /> : dues.failed ? "Unavailable" : k.v}</div><Badge tone={k.b} className="mt-2">{dues.ready && !dues.failed ? k.s : "Fee records"}</Badge></Card>))}
      </div>

      <Tabs variant="underline" className="mt-6" value={main} onChange={setMain}
        items={[{ id: "invoices", label: "Invoices & Dues" }, { id: "structure", label: "Fee Structure" }, { id: "concessions", label: "Concessions", count: con.rows.length }, { id: "verify", label: "Payment verification", count: toVerify }, { id: "receipts", label: "Receipts & Reminders" }]} />

      {main === "verify" && <PaymentVerification invoices={inv.rows} payments={pay.rows} today={t || todayIso()} />}

      {main === "invoices" && <div className="mt-5 space-y-4">
        <Tabs value={ledgerView} onChange={setLedgerView} items={[{ id: "students", label: "Student dues" }, { id: "issued", label: "Issued invoices" }]} />
        {ledgerView === "students" ? <StudentDuesDirectory data={dues} /> : <Card>
          <CardHeader title="Issued invoices" subtitle="Saved invoices. Open one to download, print or share." />
          <div className="px-5 pb-3"><Tabs value={tab} onChange={setTab} items={[{ id: "all", label: `All (${counts.all})` }, { id: "due", label: `Unpaid / Overdue (${counts.due})` }, { id: "paid", label: `Paid (${counts.paid})` }]} /></div>
          <DataTable rows={filtered} columns={cols} pageSize={8} selectable selected={sel} onSelectedChange={setSel} onRowClick={setViewedInvoice}
            searchText={(i) => `${i.student} ${i.grn} ${i.no} ${i.guardian}`} empty={!inv.ready ? <LoadingSkeleton variant="table" label="Loading invoices…" /> : undefined}
            toolbar={<><Select aria-label="Grade" value={grade} onChange={(event) => setGrade(event.target.value)}><option value="all">All grades</option>{[...new Set(inv.rows.map((row) => row.grade))].map((value) => <option key={value} value={value}>Grade {value}</option>)}</Select>
              <Select aria-label="Term" value={term} onChange={(event) => setTerm(event.target.value)}><option value="all">All periods</option>{terms.map((value) => <option key={value}>{value}</option>)}</Select></>} />
        </Card>}
      </div>}

      {main === "structure" && (
        <Card className="mt-5">
          <CardHeader title="Fee Structure" subtitle="Fee items and collection schedules by class. Updated plans show mandatory recurring totals per year."
            actions={str.rows.length < 18 && <Button size="sm" onClick={() => setEditFs({ id: "", grade: "", tuition: 0, lab: 0, activity: 0, library: 0, transport: 0 })}><Plus size={14} />Add grade</Button>} />
          <DataTable rows={[...str.rows].sort((a, b) => +a.grade - +b.grade || gradePlanScope(a).localeCompare(gradePlanScope(b)))} pageSize={18} onRowClick={setEditFs} columns={[
            { key: "grade", header: "Class / stream", render: (row) => <b>{classLabel(gradePlanScope(row))}</b> },
            { key: "items", header: "Fee items", render: (row) => row.schemaVersion === 2 ? <div className="space-y-1">{row.items?.some((item) => !isTransportFee(item)) ? row.items.filter((item) => !isTransportFee(item)).map((item) => <p key={item.id} className="text-xs"><span className="font-medium">{item.name}</span> · {inrFull(item.amount)} / {item.frequency.toLowerCase()}{!item.mandatory && " · Optional"}{item.newStudentsOnly && " · New admissions"}</p>) : "No fees assigned"}</div> : <span className="text-xs">Tuition {inrFull(row.tuition)} · Lab {inrFull(row.lab)} · Activity {inrFull(row.activity)} · Library {inrFull(row.library)}</span> },
            { key: "total", header: "Mandatory total", render: (row) => <div><b>{inrFull(feeTotal(row))}</b><p className="mt-0.5 text-xs text-outline">{row.schemaVersion === 2 ? "Recurring / year" : "Per term · excludes transport"}</p></div> },
            { key: "e", header: "", render: (row) => <Button size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setEditFs(row); }}>Edit</Button> },
          ]} />
        </Card>
      )}

      {main === "concessions" && (
        <Card className="mt-5">
          <CardHeader title="Concessions & Waivers" subtitle={`${inrFull(concApproved)} approved this year`} actions={<Button size="sm" onClick={() => setNewCon(true)}><Plus size={14} />New concession</Button>} />
          <DataTable rows={con.rows} pageSize={8} searchText={(c) => `${c.student} ${c.grn} ${c.type}`} columns={[
            { key: "s", header: "Student", sortValue: (c) => c.student, render: (c) => {
              const studentId = studentIdsByGrn.get((c.grn ?? "").trim().toLowerCase());
              const tile = <><span className="block font-semibold">{c.student}</span><span className="block text-xs text-outline">Grade {c.grade} · {c.grn}</span></>;
              return studentId ? <Link href={studentProfileHref(studentId)} className="block rounded text-secondary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary">{tile}</Link> : <div>{tile}</div>;
            } },
            { key: "t", header: "Type", render: (c) => c.type },
            { key: "a", header: "Amount", sortValue: (c) => c.amount, render: (c) => <b>{inrFull(c.amount)}</b> },
            { key: "r", header: "Requested", render: (c) => c.requested ? fmtDate(c.requested) : "—" },
            { key: "st", header: "Status", render: (c) => <Badge tone={c.status === "Approved" ? "success" : c.status === "Pending" ? "warning" : "danger"}>{c.status}</Badge> },
            { key: "x", header: "", render: (c) => c.status === "Pending" ? (
              <div className="flex gap-2"><Button size="sm" onClick={() => safe(() => con.update(c.id, { status: "Approved", approvedBy: me.name }), "Concession approved")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => safe(() => con.update(c.id, { status: "Rejected" }), "Concession rejected")}>Reject</Button></div>) : null },
          ]} />
        </Card>
      )}

      {main === "receipts" && (
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <Card><CardHeader title="Receipts" subtitle="Latest payments first" />
            <DataTable rows={[...pay.rows].sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo))} pageSize={8} searchText={(p) => `${p.student} ${p.receiptNo} ${p.invoiceNo}`} onRowClick={setReceipt} columns={[
              { key: "n", header: "Receipt", render: (p) => <span className="font-mono">{p.receiptNo}</span> },
              { key: "s", header: "Student", render: (p) => p.student },
              { key: "d", header: "Date", render: (p) => p.date ? fmtDate(p.date) : "—" },
              { key: "m", header: "Mode", render: (p) => p.mode },
              { key: "a", header: "Amount", render: (p) => <b>{inrFull(p.amount)}</b> },
            ]} /></Card>
          <Card><CardHeader title="Reminder log" subtitle="Fee reminders pushed to guardians in the parent app" />
            <DataTable rows={[...rem.rows].sort((a, b) => b.sentAt.localeCompare(a.sentAt))} pageSize={8} columns={[
              { key: "s", header: "Student", render: (r) => <div><b>{r.student}</b><div className="text-xs text-outline">{r.guardian} · {r.phone}</div></div> },
              { key: "i", header: "Invoice", render: (r) => <span className="font-mono">{r.invoiceNo}</span> },
              { key: "a", header: "Due", render: (r) => inrFull(r.amount) },
              { key: "t", header: "Sent", render: (r) => new Date(r.sentAt).toLocaleString("en-IN") },
            ]} empty={<EmptyState title="No reminders sent yet" hint="Use Remind on an invoice or select defaulters for a bulk notice." />} /></Card>
        </div>
      )}

      {main === "invoices" && ledgerView === "issued" && selInv.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:pl-72">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-pop">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-on-secondary"><CheckCircle2 size={18} /></span>
            <div><p className="font-semibold">{selInv.length} Defaulters Selected</p><p className="text-xs text-on-surface-variant">Total Outstanding: <b className="text-error">{inrFull(selSum)}</b></p></div>
            <Button className="!bg-success" onClick={async () => { if (await remind(selInv)) setSel([]); }}><MessageCircle size={16} />Send Bulk Reminder</Button>
            <Button variant="outline" onClick={() => { downloadCsv("defaulter-notice.csv", [["Invoice", "Student", "Guardian", "Phone", "Due"], ...selInv.map((i) => [i.no, i.student, i.guardian, i.phone, i.balance])]); toast("Notice list exported"); }}><FileText size={16} />Export notice CSV</Button>
            <button aria-label="Clear selection" className="cursor-pointer text-outline" onClick={() => setSel([])}><X size={16} /></button>
          </div>
        </div>
      )}

      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />

      {viewedInvoice && <SavedInvoiceModal key={viewedInvoice.id} invoice={inv.rows.find((row) => row.id === viewedInvoice.id) ?? viewedInvoice} school={dues.school.rows.find((row) => row.id === "school") ?? {}} onClose={() => setViewedInvoice(null)} />}

      <BatchInvoiceDialog open={batch} onClose={() => setBatch(false)} structure={str.rows} students={students.rows.filter(isActiveStudent)} classes={classes.rows} invoices={inv.rows} onCreate={generateInvoices} />
      <InvoiceModal open={newInv} onClose={() => setNewInv(false)} students={students.rows.filter(isActiveStudent)} invoices={inv.rows}
        onSave={async (row) => { try { const r = await inv.create(row); toast(`Invoice ${r.no} created for ${r.student}`); setNewInv(false); } catch { toast("Could not create the invoice", "error"); } }} />
      <StructureModal key={editFs?.id ?? "closed"} fs={editFs} taken={str.rows.map(gradePlanScope)} scopes={feeScopesForClasses(classes.rows)} onClose={() => setEditFs(null)} onSave={async (s) => {
        try {
          if (s.id) { await str.update(s.id, s); toast(`Grade ${s.grade} fee structure updated`); }
          else { await str.create({ ...s, id: `fs_${gradePlanScope(s).replace(":", "_")}` }); toast(`${classLabel(gradePlanScope(s))} fee structure added`); }
          setEditFs(null);
        } catch { toast("Could not save fee structure", "error"); } }} />
      <ConcessionModal open={newCon} onClose={() => setNewCon(false)} students={students.rows.filter((student) => student.deleted !== true)} onSave={async (c) => { try { await con.create(c as Omit<Concession, "id">); toast("Concession request submitted"); setNewCon(false); } catch { toast("Could not submit concession", "error"); } }} />
    </>
  );
}

function ConfiguredStructureModal({ fs, onClose, onSave }: { fs: Structure; onClose: () => void; onSave: (value: Structure) => void }) {
  const scope = gradePlanScope(fs);
  const [value, setValue] = useState<FeePlan>(() => ({ schemaVersion: 2, academicYear: fs.academicYear ?? "", termsPerYear: fs.termsPerYear ?? 2, grades: [scope], items: (fs.items ?? []).filter((item) => !isTransportFee(item)).map((item) => ({ ...item, grades: [scope] })), late: 0, upi: true, card: true }));
  const [error, setError] = useState("");
  const save = () => {
    const why = feePlanError(value);
    if (why) return setError(why);
    onSave({ ...fs, ...gradeFeeRecord(normalizedFeePlan(value), scope) });
  };
  return <Modal open onClose={onClose} title={`${fs.id ? "Edit" : "Add"} ${classLabel(scope)} fee structure`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
    {!fs.id && <div className="mb-4 grid gap-3 sm:grid-cols-2"><Field label="Academic year"><Input value={value.academicYear} placeholder="2026-27" onChange={(event) => setValue({ ...value, academicYear: event.target.value })} /></Field><Field label="Terms per year"><Select value={value.termsPerYear} onChange={(event) => setValue({ ...value, termsPerYear: Number(event.target.value) })}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</Select></Field></div>}
    <FeePlanEditor value={value} onChange={(next) => { setValue(next); setError(""); }} compact />
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
  </Modal>;
}

function StructureModal({ fs, taken, scopes, onClose, onSave }: { fs: Structure | null; taken: string[]; scopes: string[]; onClose: () => void; onSave: (s: Structure) => void }) {
  const [v, setV] = useState<Structure | null>(null);
  const cur = v?.id === fs?.id ? v : fs;
  if (!fs || !cur) return null;
  if (cur.schemaVersion === 2) return <ConfiguredStructureModal key={cur.id} fs={cur} onClose={onClose} onSave={onSave} />;
  const keys = ["tuition", "lab", "activity", "library"] as const;
  const bad = keys.some((k) => !(cur[k] >= 0) || !Number.isInteger(cur[k])) || !cur.grade;
  const free = [...new Set(["LKG", "UKG", ...Array.from({ length: 10 }, (_, g) => String(g + 1)), ...scopes])].filter((g) => !taken.includes(g));
  return (
    <Modal open onClose={() => { setV(null); onClose(); }} title={fs.id ? `Edit Grade ${fs.grade} fee structure` : "Add a grade fee structure"} footer={<><Button variant="outline" onClick={() => { setV(null); onClose(); }}>Cancel</Button><Button disabled={bad} onClick={() => { onSave(cur); setV(null); }}>Save</Button></>}>
      {!fs.id && <Field label="Grade" required className="mb-4"><Select value={cur.grade} onChange={(e) => { const { grade, streamId } = parseFeeScope(e.target.value); setV({ ...cur, grade, ...(streamId ? { streamId, stream: streamName(streamId), schemaVersion: 2, items: [] } : {}) }); }}><option value="">Select a grade…</option>{free.map((g) => <option key={g} value={g}>{classLabel(g)}</option>)}</Select></Field>}
      <div className="grid grid-cols-2 gap-4">{keys.map((k) => (
        <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><Input type="number" min={0} value={cur[k]} onChange={(e) => setV({ ...cur, [k]: Number(e.target.value) })} /></Field>))}</div>
      <p className="mt-4 text-sm text-on-surface-variant">Term total (excl. transport): <b>{inrFull(feeTotal(cur))}</b></p>
      <p className="mt-2 text-xs text-on-surface-variant">Set transport amounts in student details → Transport. Choose the collection frequency in Settings → Payments.</p>
    </Modal>
  );
}

function ConcessionModal({ open, onClose, students, onSave }: { open: boolean; onClose: () => void; students: Student[]; onSave: (c: Omit<Concession, "id">) => void }) {
  const [sid, setSid] = useState("");
  const [type, setType] = useState("Sibling Discount");
  const [amount, setAmount] = useState("");
  const [err, setErr] = useState<{ s?: string; a?: string }>({});
  const s = students.find((x) => x.id === sid);
  const close = () => { setErr({}); onClose(); };
  return (
    <Modal open={open} onClose={close} title="New concession request" footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={() => {
      const e = { s: s ? undefined : "Choose a student", a: Number(amount) > 0 && Number.isInteger(Number(amount)) ? undefined : "Enter a whole rupee amount above 0" };
      setErr(e); if (e.s || e.a || !s) return;
      onSave({ student: s.name, grn: s.grn, grade: s.grade, type, amount: Number(amount), status: "Pending", requested: todayIso(), approvedBy: "" }); setSid(""); setAmount("");
    }}>Submit</Button></>}>
      <div className="grid gap-4">
        <StudentSearchSelect students={students} value={sid} error={err.s} onChange={(id) => { setSid(id); setErr((previous) => ({ ...previous, s: undefined })); }} />
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}>{["Sibling Discount", "Merit Scholarship", "Staff Ward", "Need-based Waiver", "Sports Quota", "Other"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Concession amount (₹)" required error={err.a}><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** One invoice for one student (fees outside the batch run: a trip, a re-exam, a late admission). */
function InvoiceModal({ open, onClose, students, invoices, onSave }: { open: boolean; onClose: () => void; students: Student[]; invoices: Invoice[]; onSave: (row: Omit<Invoice, "id">) => Promise<void> }) {
  const blankDraft: InvoiceDraft = { studentId: "", term: "Term 2", head: "Tuition Fee", amount: "", due: "" };
  const [v, setV] = useState<InvoiceDraft>(blankDraft);
  const [err, setErr] = useState<Partial<Record<keyof InvoiceDraft, string>>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof InvoiceDraft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setV({ ...v, [k]: e.target.value }); setErr({ ...err, [k]: undefined }); };
  const close = () => { setV(blankDraft); setErr({}); onClose(); };
  const submit = async () => {
    const today = todayIso();
    const e = invoiceErrors(v, today);
    setErr(e);
    const s = students.find((x) => x.id === v.studentId);
    if (Object.keys(e).length || !s) return;
    const amount = Number(v.amount);
    setBusy(true);
    try {
      await onSave({ no: nextInvoiceNos(invoices, 1, today.slice(0, 4))[0], studentId: s.id, student: s.name, grade: s.grade, section: s.section, grn: s.grn, guardian: s.guardian ?? "", phone: s.phone ?? "",
        term: v.term, issued: today, due: v.due, amount, paid: 0, balance: amount, status: invoiceStatus({ amount, paid: 0, due: v.due }, today), lines: [{ label: v.head.trim(), amount }] });
      setV(blankDraft);
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} title="New invoice" subtitle="Bills one student; the guardians are notified in the parent app"
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create invoice"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student" required error={err.studentId} className="sm:col-span-2"><Select value={v.studentId} onChange={set("studentId")}><option value="">Select student…</option>
          {[...students].sort((a, b) => a.name.localeCompare(b.name)).map((x) => <option key={x.id} value={x.id}>{x.name} · Grade {x.grade}-{x.section} · {x.grn}</option>)}</Select></Field>
        <Field label="Term"><Select value={v.term} onChange={set("term")}><option>Term 1</option><option>Term 2</option><option>Term 3</option></Select></Field>
        <Field label="Fee head" required error={err.head}><Input value={v.head} onChange={set("head")} /></Field>
        <Field label="Amount (₹)" required error={err.amount}><Input inputMode="numeric" value={v.amount} onChange={set("amount")} /></Field>
        <Field label="Due date" required error={err.due}><Input type="date" value={v.due} onChange={set("due")} /></Field>
      </div>
    </Modal>
  );
}
