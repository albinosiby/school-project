"use client";
import { useMemo, useState, useSyncExternalStore } from "react";
import { writeBatch } from "firebase/firestore";
import { CheckCircle2, Download, FileText, MessageCircle, Plus, Printer, Receipt, Send, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inr, inrFull } from "@/lib/format";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { isActiveStudent } from "@/features/exams/logic";
import { downloadCsv } from "./csv";
import { CASH, applyPayment, createStamp, balanceOf, invoiceErrors, invoiceStatus, newId, nextInvoiceNos, nextReceiptNo, normRef, paymentAmountError, paymentMode, reminderDoc, remindable, schoolDoc, shownStatus, stamp, type InvoiceDraft } from "./logic";
import { ReceiptModal } from "./ReceiptModal";
import { PaymentVerification } from "./PaymentVerification";
import { feeTotal, todayIso, type Concession, type Invoice, type Payment, type Reminder, type Structure } from "./types";
import { useMyName } from "@/lib/useMe";

type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status?: string; deleted?: boolean };
const tone = { Paid: "success", Pending: "info", Overdue: "danger", Partial: "warning" } as const;
const MODES = ["Cash", "UPI QR", "Card", "Cheque", "NetBank"];
const noopSub = () => () => {};

export function FeesPage() {
  const toast = useToast();
  const me = useMyName();
  const inv = useCollection<Invoice>("fee_invoices");
  const pay = useCollection<Payment>("fee_payments");
  const str = useCollection<Structure>("fee_structure");
  const con = useCollection<Concession>("fee_concessions");
  const rem = useCollection<Reminder>("fee_reminders");
  const students = useCollection<Student>("students");
  const integ = useCollection<{ id: string; name: string; enabled: boolean }>("set_integrations");
  const toVerify = useCollection<{ id: string; status: string }>("fee_claims").rows.filter((c) => c.status === "Pending").length;

  const [main, setMain] = useState("invoices");
  const [tab, setTab] = useState("all");
  const [grade, setGrade] = useState("all");
  const [term, setTerm] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [cur, setCur] = useState<string>("");
  const [mode, setMode] = useState("UPI QR");
  // null = default to the invoice balance; "" = user cleared the field
  const [amt, setAmt] = useState<string | null>(null);
  const [ref, setRef] = useState("");
  const [payErr, setPayErr] = useState<{ amount?: string; ref?: string }>({});
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Payment | null>(null);
  const [newInv, setNewInv] = useState(false);
  const [batch, setBatch] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [switchQ, setSwitchQ] = useState("");
  const [editFs, setEditFs] = useState<Structure | null>(null);
  const [newCon, setNewCon] = useState(false);

  // client-only "today" without setState-in-effect (server snapshot is empty)
  const t = useSyncExternalStore(noopSub, todayIso, () => "");
  const todayPays = pay.rows.filter((p) => p.date === t);
  // mode is "Cash" or "{mode} · {reference}"; cash, cheques and cash deposits are not digital collections
  const digital = (p: Payment) => !["Cash", "Cheque", "Cash deposit at bank"].includes((p.mode ?? "").split(" · ")[0]);
  const todaySum = todayPays.reduce((a, p) => a + p.amount, 0);
  const billed = inv.rows.reduce((a, i) => a + i.amount, 0);
  const collected = inv.rows.reduce((a, i) => a + i.paid, 0);
  // the status shown is derived from paid / balance / due date (a stored "Pending" goes stale once the due date passes)
  const stOf = (i: Invoice) => shownStatus(i, t);
  const overdue = inv.rows.filter((i) => stOf(i) === "Overdue");
  const overdueSum = overdue.reduce((a, i) => a + i.balance, 0);
  const concApproved = con.rows.filter((c) => c.status === "Approved").reduce((a, c) => a + c.amount, 0);

  const terms = [...new Set(inv.rows.map((i) => i.term))];
  const filtered = useMemo(() => inv.rows.filter((i) =>
    (tab === "all" || (tab === "paid" ? shownStatus(i, t) === "Paid" : shownStatus(i, t) !== "Paid")) &&
    (grade === "all" || i.grade === grade) && (term === "all" || i.term === term)), [inv.rows, tab, grade, term, t]);
  const counts = { all: inv.rows.length, due: inv.rows.filter((i) => stOf(i) !== "Paid").length, paid: inv.rows.filter((i) => stOf(i) === "Paid").length };

  const curInv = inv.rows.find((i) => i.id === cur) ?? null;
  const pickInvoice = (i: Invoice) => { setCur(i.id); setAmt(null); setRef(""); setPayErr({}); };
  const curBal = curInv ? balanceOf(curInv) : 0;
  const shownAmt = amt ?? (curInv ? String(curBal) : "");
  const needsRef = mode !== CASH;
  const liveAmtErr = curInv && shownAmt !== "" && Number(shownAmt) > curBal ? paymentAmountError(Number(shownAmt), curBal) : "";

  /** Counter payment: the receipt and the invoice's paid / balance / status in one batch (all or nothing). */
  const collect = async () => {
    if (!curInv) return toast("Select an invoice first", "error");
    if (busy) return;
    const a = shownAmt.trim() === "" ? NaN : Number(shownAmt);
    const e = { amount: paymentAmountError(a, curBal) || undefined, ref: needsRef && normRef(ref).length < 4 ? "Enter the transaction / cheque reference (at least 4 characters)" : undefined };
    setPayErr(e);
    if (e.amount || e.ref) return;
    setBusy(true);
    try {
      const no = nextReceiptNo(pay.rows);
      const day = t || todayIso();
      const p: Payment = { id: newId("pay"), receiptNo: no, invoiceId: curInv.id, invoiceNo: curInv.no, student: curInv.student, grade: curInv.grade, grn: curInv.grn, amount: a, mode: paymentMode(mode, needsRef ? ref : ""), date: day, by: me.name, ...(needsRef ? { reference: normRef(ref) } : {}) };
      const b = writeBatch(db); const st = stamp();
      b.set(schoolDoc("fee_payments", p.id), { ...p, ...createStamp() });
      b.update(schoolDoc("fee_invoices", curInv.id), { ...applyPayment(curInv, a, day), ...st });
      await b.commit();
      setAmt(null); setRef(""); setReceipt(p); toast(`Payment of ${inrFull(a)} recorded · ${no}`);
    } catch { toast("Could not record payment", "error"); } finally { setBusy(false); }
  };

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

  const cols: Column<Invoice>[] = [
    { key: "student", header: "Student & GRN", sortValue: (i) => i.student, render: (i) => (
      <div className="flex items-center gap-3"><Avatar name={i.student} size={32} /><div><div className="font-semibold">{i.student}</div><div className="text-xs text-outline">Gr {i.grade}-{i.section} · {i.grn}</div></div></div>) },
    { key: "inv", header: "Invoice details", sortValue: (i) => i.no, render: (i) => <span><span className="font-mono">{i.no}</span>{i.issued ? `, ${fmtDate(i.issued)}` : ""}</span> },
    { key: "amount", header: "Billed", sortValue: (i) => i.amount, render: (i) => <span className="font-semibold">{inrFull(i.amount)}</span> },
    { key: "balance", header: "Due", sortValue: (i) => i.balance, render: (i) => <span className={i.balance ? "font-semibold text-error" : "text-outline"}>{inrFull(i.balance)}</span> },
    { key: "status", header: "Status", sortValue: (i) => stOf(i), render: (i) => <Badge tone={tone[stOf(i)] ?? "neutral"}>{stOf(i)}</Badge> },
    { key: "act", header: "", render: (i) => stOf(i) === "Paid"
      ? <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); const p = pay.rows.filter((x) => x.invoiceId === i.id).sort((a, b) => b.date.localeCompare(a.date) || b.receiptNo.localeCompare(a.receiptNo))[0]; if (p) setReceipt(p); else toast("No receipt on file", "error"); }}><Receipt size={14} />Receipt</Button>
      : <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); remind([i]); }}><Send size={14} />Remind</Button> },
  ];

  const selInv = inv.rows.filter((i) => sel.includes(i.id) && stOf(i) !== "Paid");
  const selSum = selInv.reduce((a, i) => a + i.balance, 0);

  const exportLedger = () => downloadCsv("fee-ledger.csv", [["Invoice", "Student", "GRN", "Grade", "Section", "Term", "Billed", "Paid", "Balance", "Status", "Due date"],
    ...inv.rows.map((i) => [i.no, i.student, i.grn, i.grade, i.section, i.term, i.amount, i.paid, i.balance, stOf(i), i.due])]);

  return (
    <>
      <PageHeader title="Fees & Payments Hub" subtitle="Real-time fee collections, counter POS terminal, aging defaulters ledger, and automated payment gateway reconciliations."
        actions={<><Button variant="outline" onClick={() => { exportLedger(); toast("Ledger downloaded"); }}><Download size={16} />Download Ledger (.csv)</Button><Button variant="outline" onClick={() => setNewInv(true)}><Plus size={16} />New Invoice</Button><Button onClick={() => setBatch(true)}><Plus size={16} />Generate Batch Invoices</Button></>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { l: "Today's Collection", v: inr(todaySum), s: `${todayPays.length} receipts today`, c: "text-on-surface", b: "success" as const },
          { l: "Fee Realization", v: inr(collected), s: `of ${inr(billed)} billed · ${billed ? ((collected / billed) * 100).toFixed(1) : 0}%`, c: "text-on-surface", b: "info" as const },
          { l: "Overdue Defaulters", v: `${overdue.length} Students`, s: `${inrFull(overdueSum)} outstanding`, c: "text-error", b: "danger" as const },
          { l: "Concessions & Waivers", v: inrFull(concApproved), s: `${con.rows.filter((c) => c.status === "Pending").length} pending approval`, c: "text-on-surface", b: "success" as const },
        ].map((k) => (
          <Card key={k.l} className="p-5"><p className="text-on-surface-variant">{k.l}</p><p className={cn("mt-2 t-headline-lg", k.c)}>{k.v}</p><Badge tone={k.b} className="mt-2">{k.s}</Badge></Card>))}
      </div>

      <Tabs variant="underline" className="mt-6" value={main} onChange={setMain}
        items={[{ id: "invoices", label: "Invoices & Dues" }, { id: "structure", label: "Fee Structure" }, { id: "concessions", label: "Concessions", count: con.rows.length }, { id: "verify", label: "Payment verification", count: toVerify }, { id: "receipts", label: "Receipts & Reminders" }]} />

      {main === "verify" && <PaymentVerification invoices={inv.rows} payments={pay.rows} today={t || todayIso()} />}

      {main === "invoices" && (
        <div className="mt-5 grid items-start gap-6 xl:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader title="Student Fee Invoices & Dues Ledger" subtitle="Real-time status across academic year 2026-27 invoices" />
            <div className="px-5 pb-3"><Tabs value={tab} onChange={setTab} items={[{ id: "all", label: `All (${counts.all.toLocaleString("en-IN")})` }, { id: "due", label: `Unpaid / Overdue (${counts.due})` }, { id: "paid", label: `Paid (${counts.paid.toLocaleString("en-IN")})` }]} /></div>
            <DataTable rows={filtered} columns={cols} pageSize={8} selectable selected={sel} onSelectedChange={setSel} onRowClick={pickInvoice}
              searchText={(i) => `${i.student} ${i.grn} ${i.no} ${i.guardian}`} empty={!inv.ready ? <p className="p-8 text-center text-on-surface-variant">Loading invoices…</p> : undefined}
              toolbar={<>
                <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="!w-40"><option value="all">All Grades</option>{Array.from({ length: 12 }, (_, g) => <option key={g} value={g + 1}>Grade {g + 1}</option>)}</Select>
                <Select aria-label="Term" value={term} onChange={(e) => setTerm(e.target.value)} className="!w-40"><option value="all">All Terms</option>{terms.map((x) => <option key={x}>{x}</option>)}</Select>
              </>} />
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Counter Collection" subtitle="Front-Desk Fast Checkout" actions={<Badge>Terminal #02</Badge>} />
              <div className="space-y-4 p-5 pt-2">
                {curInv ? (<>
                  <div className="flex items-center gap-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
                    <Avatar name={curInv.student} size={36} />
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{curInv.student} <Badge>{curInv.grade}-{curInv.section}</Badge></p><p className="truncate text-xs text-outline">{curInv.grn} · {curInv.no}</p></div>
                    <button className="cursor-pointer text-sm font-semibold text-secondary" onClick={() => setSwitchOpen(true)}>Switch</button>
                  </div>
                  <ul className="space-y-1.5 text-sm">{curInv.lines.map((l) => <li key={l.label} className="flex justify-between"><span>{l.label}</span><b className="font-mono">{inrFull(l.amount)}</b></li>)}</ul>
                  <div className="flex items-center justify-between border-t border-outline-variant/50 pt-3"><span className="font-semibold">Total Payable Due</span><span className="t-headline-md text-secondary">{inrFull(curBal)}</span></div>
                  <div><span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Payment Mode</span>
                    <Tabs value={mode} onChange={(m) => { setMode(m); setPayErr((x) => ({ ...x, ref: undefined })); }} items={MODES.map((m) => ({ id: m, label: m }))} /></div>
                  <Field label="Amount Received (₹)" error={payErr.amount || liveAmtErr || undefined}><Input inputMode="numeric" value={shownAmt} onChange={(e) => { setAmt(e.target.value.replace(/\D/g, "")); setPayErr((x) => ({ ...x, amount: undefined })); }} /></Field>
                  {needsRef && <Field label="Reference no." required error={payErr.ref} hint={mode === "Cheque" ? "Cheque number" : "UPI / card / bank transaction ID"}><Input value={ref} className="font-mono" onChange={(e) => { setRef(e.target.value.toUpperCase()); setPayErr((x) => ({ ...x, ref: undefined })); }} /></Field>}
                  <Button className="w-full" size="lg" onClick={collect} disabled={busy || curBal <= 0}><Printer size={16} />Collect & Print Receipt</Button>
                </>) : <EmptyState title="No invoice selected" hint="Click an invoice row or choose Switch." action={<Button size="sm" onClick={() => setSwitchOpen(true)}>Find student</Button>} />}
              </div>
            </Card>
            <Card>
              <CardHeader title="Settlements & Gateway Health" subtitle="Integration status from Settings" />
              <div className="space-y-3 p-5 pt-2">
                {/* status comes from set_integrations; missing = not connected (no fake "Live") */}
                {[{ id: "int_razorpay", n: "Razorpay Direct Gateway" }, { id: "int_pinelabs", n: "PineLabs Smart POS" }].map((g) => { const on = !!integ.rows.find((x) => x.id === g.id)?.enabled; return (
                  <div key={g.id} className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-3"><p className="font-semibold">{g.n}</p><Badge tone={on ? "success" : "neutral"}>{on ? "Enabled" : "Not connected"}</Badge></div>); })}
                <div className="rounded-lg border border-outline-variant/60 p-3 text-sm"><div className="flex justify-between text-xs text-outline"><span>Today&apos;s digital collections</span><span>{todayPays.filter(digital).length} receipts</span></div><div className="mt-1 flex justify-between font-semibold"><span>UPI / Card / NetBank</span><span>{inrFull(todayPays.filter(digital).reduce((a, p) => a + p.amount, 0))}</span></div></div>
                <Button variant="outline" className="w-full text-secondary" onClick={() => { if (!todayPays.length) return toast("No receipts recorded today", "error"); downloadCsv(`day-ledger-${t}.csv`, [["Receipt", "Invoice", "Student", "Mode", "Amount"], ...todayPays.map((p) => [p.receiptNo, p.invoiceNo, p.student, p.mode, p.amount]), ["", "", "", "Total", todaySum]]); toast(`Day ledger exported: ${todayPays.length} receipts, ${inrFull(todaySum)}`); }}>Export Day Ledger (.csv) →</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {main === "structure" && (
        <Card className="mt-5">
          <CardHeader title="Fee Structure" subtitle="Per-term fee heads by grade. Used when generating batch invoices."
            actions={str.rows.length < 12 && <Button size="sm" onClick={() => setEditFs({ id: "", grade: "", tuition: 0, lab: 0, activity: 0, library: 0, transport: 0 })}><Plus size={14} />Add grade</Button>} />
          <DataTable rows={[...str.rows].sort((a, b) => +a.grade - +b.grade)} pageSize={12} onRowClick={setEditFs} columns={[
            { key: "grade", header: "Grade", render: (s) => <b>Grade {s.grade}</b> },
            { key: "tuition", header: "Tuition", render: (s) => inrFull(s.tuition) },
            { key: "lab", header: "Lab", render: (s) => inrFull(s.lab) },
            { key: "activity", header: "Activity", render: (s) => inrFull(s.activity) },
            { key: "library", header: "Library", render: (s) => inrFull(s.library) },
            { key: "transport", header: "Transport (optional)", render: (s) => inrFull(s.transport) },
            { key: "total", header: "Term total", render: (s) => <b>{inrFull(feeTotal(s))}</b> },
            { key: "e", header: "", render: (s) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setEditFs(s); }}>Edit</Button> },
          ]} />
        </Card>
      )}

      {main === "concessions" && (
        <Card className="mt-5">
          <CardHeader title="Concessions & Waivers" subtitle={`${inrFull(concApproved)} approved this year`} actions={<Button size="sm" onClick={() => setNewCon(true)}><Plus size={14} />New concession</Button>} />
          <DataTable rows={con.rows} pageSize={8} searchText={(c) => `${c.student} ${c.grn} ${c.type}`} columns={[
            { key: "s", header: "Student", sortValue: (c) => c.student, render: (c) => <div><b>{c.student}</b><div className="text-xs text-outline">Grade {c.grade} · {c.grn}</div></div> },
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

      {main === "invoices" && selInv.length > 0 && (
        <div className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:pl-72">
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-pop">
            <span className="grid size-10 place-items-center rounded-lg bg-secondary text-on-secondary"><CheckCircle2 size={18} /></span>
            <div><p className="font-semibold">{selInv.length} Defaulters Selected</p><p className="text-xs text-on-surface-variant">Total Outstanding: <b className="text-error">{inrFull(selSum)}</b></p></div>
            <Button className="!bg-success" onClick={async () => { if (await remind(selInv)) setSel([]); }}><MessageCircle size={16} />Send Bulk Reminder</Button>
            <Button variant="outline" onClick={() => { downloadCsv("defaulter-notice.csv", [["Invoice", "Student", "Guardian", "Phone", "Due"], ...selInv.map((i) => [i.no, i.student, i.guardian, i.phone, i.balance])]); toast("Notice list exported (PDF simulated)"); }}><FileText size={16} />Notice PDF</Button>
            <button aria-label="Clear selection" className="cursor-pointer text-outline" onClick={() => setSel([])}><X size={16} /></button>
          </div>
        </div>
      )}

      <ReceiptModal payment={receipt} onClose={() => setReceipt(null)} />

      <Modal open={switchOpen} onClose={() => setSwitchOpen(false)} title="Switch student" subtitle="Find an invoice to collect against">
        <Input autoFocus placeholder="Search name, GRN or invoice no." value={switchQ} onChange={(e) => setSwitchQ(e.target.value)} aria-label="Search student" />
        <ul className="mt-3 divide-y divide-outline-variant/50">
          {(switchQ.length < 2 ? inv.rows.filter((i) => stOf(i) !== "Paid").slice(0, 8) : inv.rows.filter((i) => `${i.student} ${i.grn} ${i.no}`.toLowerCase().includes(switchQ.toLowerCase())).slice(0, 10)).map((i) => (
            <li key={i.id}><button className="flex w-full cursor-pointer items-center justify-between gap-3 py-2.5 text-left hover:bg-surface-container-low" onClick={() => { pickInvoice(i); setSwitchOpen(false); setSwitchQ(""); }}>
              <span><b>{i.student}</b> <span className="text-xs text-outline">{i.grn} · {i.no}</span></span><Badge tone={tone[stOf(i)] ?? "neutral"}>{stOf(i)} · {inrFull(balanceOf(i))}</Badge></button></li>))}
        </ul>
      </Modal>

      <BatchModal open={batch} onClose={() => setBatch(false)} structure={str.rows} students={students.rows.filter(isActiveStudent)} invoices={inv.rows} onCreate={async (rows) => { let n = 0; try { for (const r of rows) { await inv.create(r as Omit<Invoice, "id">); n++; } toast(`${n} invoices generated`); } catch { toast(`Stopped after ${n} of ${rows.length} invoices — try again`, "error"); throw new Error("batch"); } }} />
      <InvoiceModal open={newInv} onClose={() => setNewInv(false)} students={students.rows.filter(isActiveStudent)} invoices={inv.rows}
        onSave={async (row) => { try { const r = await inv.create(row); toast(`Invoice ${r.no} created for ${r.student}`); setNewInv(false); } catch { toast("Could not create the invoice", "error"); } }} />
      <StructureModal fs={editFs} taken={str.rows.map((x) => x.grade)} onClose={() => setEditFs(null)} onSave={async (s) => {
        try {
          if (s.id) { await str.update(s.id, s); toast(`Grade ${s.grade} fee structure updated`); }
          else { await str.create({ ...s, id: `fs_${s.grade}` }); toast(`Grade ${s.grade} fee structure added`); }
          setEditFs(null);
        } catch { toast("Could not save fee structure", "error"); } }} />
      <ConcessionModal open={newCon} onClose={() => setNewCon(false)} students={students.rows} onSave={async (c) => { try { await con.create(c as Omit<Concession, "id">); toast("Concession request submitted"); setNewCon(false); } catch { toast("Could not submit concession", "error"); } }} />
    </>
  );
}

function BatchModal({ open, onClose, structure, students, invoices, onCreate }: { open: boolean; onClose: () => void; structure: Structure[]; students: Student[]; invoices: Invoice[]; onCreate: (rows: Omit<Invoice, "id">[]) => Promise<void> }) {
  const [grade, setGrade] = useState("8");
  const [term, setTerm] = useState("Term 2");
  const [due, setDue] = useState("2026-12-15");
  const [busy, setBusy] = useState(false);
  const fs = structure.find((s) => s.grade === grade);
  const targets = students.filter((s) => s.grade === grade && !invoices.some((i) => i.grn === s.grn && i.term === term));
  const total = fs ? feeTotal(fs) : 0;
  const run = async () => {
    if (!fs || !targets.length || !due) return;
    setBusy(true);
    // continue after the highest invoice number on file (length-based numbering collides)
    const today = todayIso();
    const nos = nextInvoiceNos(invoices, targets.length, today.slice(0, 4));
    try { await onCreate(targets.map((s, k) => ({ no: nos[k], studentId: s.id, student: s.name, grade: s.grade, section: s.section, grn: s.grn, guardian: s.guardian ?? "", phone: s.phone ?? "", term, issued: today, due, amount: total, paid: 0, balance: total, status: invoiceStatus({ amount: total, paid: 0, due }, today),
      lines: [{ label: `Tuition Fee (${term})`, amount: fs.tuition }, { label: "Lab", amount: fs.lab }, { label: "Activity", amount: fs.activity }, { label: "Library", amount: fs.library }] })));
      onClose();
    } catch { /* parent toasts; keep modal open */ } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Generate Batch Invoices" subtitle="Creates invoices from the fee structure for enrolled students" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={busy || !fs || !targets.length || !due} onClick={run}>{busy ? "Generating…" : `Generate ${fs ? targets.length : 0} invoices`}</Button></>}>
      <div className="grid gap-4">
        <Field label="Grade"><Select value={grade} onChange={(e) => setGrade(e.target.value)}>{Array.from({ length: 12 }, (_, g) => <option key={g} value={g + 1}>Grade {g + 1}</option>)}</Select></Field>
        <Field label="Term"><Select value={term} onChange={(e) => setTerm(e.target.value)}><option>Term 2</option><option>Term 3</option></Select></Field>
        <Field label="Due date" required><Input type="date" value={due} onChange={(e) => setDue(e.target.value)} /></Field>
        <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">{!fs ? `No fee structure is set for Grade ${grade}. Add it under Fee Structure first.` : targets.length ? <>{targets.length} enrolled students in Grade {grade} without a {term} invoice. Each is billed <b>{inrFull(total)}</b>.</> : `Every enrolled Grade ${grade} student already has a ${term} invoice.`}</p>
      </div>
    </Modal>
  );
}

function StructureModal({ fs, taken, onClose, onSave }: { fs: Structure | null; taken: string[]; onClose: () => void; onSave: (s: Structure) => void }) {
  const [v, setV] = useState<Structure | null>(null);
  const cur = v?.id === fs?.id ? v : fs;
  if (!fs || !cur) return null;
  const keys = ["tuition", "lab", "activity", "library", "transport"] as const;
  const bad = keys.some((k) => !(cur[k] >= 0) || !Number.isInteger(cur[k])) || !cur.grade;
  const free = Array.from({ length: 12 }, (_, g) => String(g + 1)).filter((g) => !taken.includes(g));
  return (
    <Modal open onClose={() => { setV(null); onClose(); }} title={fs.id ? `Edit Grade ${fs.grade} fee structure` : "Add a grade fee structure"} footer={<><Button variant="outline" onClick={() => { setV(null); onClose(); }}>Cancel</Button><Button disabled={bad} onClick={() => { onSave(cur); setV(null); }}>Save</Button></>}>
      {!fs.id && <Field label="Grade" required className="mb-4"><Select value={cur.grade} onChange={(e) => setV({ ...cur, grade: e.target.value })}><option value="">Select a grade…</option>{free.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>}
      <div className="grid grid-cols-2 gap-4">{keys.map((k) => (
        <Field key={k} label={k[0].toUpperCase() + k.slice(1)}><Input type="number" min={0} value={cur[k]} onChange={(e) => setV({ ...cur, [k]: Number(e.target.value) })} /></Field>))}</div>
      <p className="mt-4 text-sm text-on-surface-variant">Term total (excl. transport): <b>{inrFull(feeTotal(cur))}</b></p>
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
        <Field label="Student" required error={err.s}><Select value={sid} onChange={(e) => setSid(e.target.value)}><option value="">Select student…</option>{students.map((x) => <option key={x.id} value={x.id}>{x.name} · Grade {x.grade}-{x.section}</option>)}</Select></Field>
        <Field label="Type"><Select value={type} onChange={(e) => setType(e.target.value)}>{["Sibling Discount", "Merit Scholarship", "Staff Ward", "Need-based Waiver", "Sports Quota"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Amount (₹)" required error={err.a}><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
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
