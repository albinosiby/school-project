"use client";
import { useState } from "react";
import { setDoc, writeBatch } from "firebase/firestore";
import { Landmark, Pencil, TriangleAlert } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Tabs, useToast, type Column } from "@/components/ui";
import { ReasonModal } from "@/features/dashboard/approvals-shared";
import { fmtDate, inrFull } from "@/lib/format";
import { useMyName } from "@/lib/useMe";
import { auth, db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { applyPayment, balanceOf, createStamp, duplicateReference, newId, nextReceiptNo, normRef, paymentAmountError, paymentMode, round2, schoolDoc, stamp } from "./logic";
import type { Invoice, Payment } from "./types";

/** fee_claims (data contract 13.8): payments parents made to the school account and reported in the parent app. */
type Claim = { id: string; studentId: string; grn: string; studentName: string; classId?: string; invoiceId: string; invoiceNo?: string; amount: number; mode: string;
  reference: string; paidOn: string; note?: string; status: "Pending" | "Verified" | "Rejected" | string; parentName?: string; submittedAt?: string;
  receiptNo?: string; paymentId?: string; verifiedBy?: string; verifiedAt?: string; rejectReason?: string };
type Bank = { accountName?: string; accountNo?: string; ifsc?: string; bank?: string; branch?: string; upiId?: string; note?: string };
type School = { id: string; bank?: Bank };
const tone = { Pending: "warning", Verified: "success", Rejected: "danger" } as const;
const cls = (id = "") => id.replace(/^cls_(\d+)(\w)$/, "$1-$2");

export function PaymentVerification({ invoices, payments, today }: { invoices: Invoice[]; payments: Payment[]; today: string }) {
  const toast = useToast();
  const me = useMyName();
  const claims = useCollection<Claim>("fee_claims");
  const school = useCollection<School>("school");
  const bank = school.rows.find((s) => s.id === "school")?.bank ?? {};
  const [tab, setTab] = useState("Pending");
  const [verifying, setVerifying] = useState<Claim | null>(null);
  const [rejecting, setRejecting] = useState<Claim | null>(null);
  const [editBank, setEditBank] = useState(false);
  const n = (st: string) => claims.rows.filter((c) => c.status === st).length;
  const view = claims.rows.filter((c) => tab === "all" || c.status === tab).sort((a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""));
  // the same reference on another claim (not rejected) or on a recorded payment is a likely duplicate
  const dupOf = (c: Claim) => !!duplicateReference(c, claims.rows, payments);

  /**
   * 13.8 Verify: the fee_payments receipt exactly like the counter, the invoice's paid / balance / status, and the claim
   * {Verified, receiptNo, paymentId, verifiedBy, verifiedAt}, in one batch so a failure leaves nothing half-done.
   */
  async function verify(c: Claim, amount: number) {
    const inv = invoices.find((i) => i.id === c.invoiceId);
    if (!inv) throw new Error("The invoice of this payment was not found.");
    const err = verifyAmountError(amount, balanceOf(inv));
    if (err) throw new Error(err);
    const no = nextReceiptNo(payments);
    const p: Payment = { id: newId("pay"), receiptNo: no, invoiceId: inv.id, invoiceNo: inv.no, student: inv.student, grade: inv.grade, grn: inv.grn, amount: round2(amount),
      mode: paymentMode(c.mode, c.reference), reference: normRef(c.reference), claimId: c.id, date: c.paidOn || today, by: me.name };
    const b = writeBatch(db); const st = stamp();
    b.set(schoolDoc("fee_payments", p.id), { ...p, ...createStamp() });
    b.update(schoolDoc("fee_invoices", inv.id), { ...applyPayment(inv, amount, today), ...st });
    b.update(schoolDoc("fee_claims", c.id), { status: "Verified", amount: round2(amount), receiptNo: no, paymentId: p.id, verifiedBy: me.name, verifiedByUid: auth.currentUser?.uid ?? "", verifiedAt: new Date().toISOString(), ...st });
    try { await b.commit(); } catch { throw new Error("Could not record the payment. Nothing was saved; try again."); }
    toast(`Verified · receipt ${no} issued`);
  }

  const cols: Column<Claim>[] = [
    { key: "student", header: "Student", sortValue: (c) => c.studentName, render: (c) => <div className="flex items-center gap-3"><Avatar name={c.studentName || "?"} size={32} />
      <div><div className="font-semibold">{c.studentName}</div><div className="text-xs text-outline">{cls(c.classId)} · {c.grn}{c.parentName ? ` · ${c.parentName}` : ""}</div></div></div> },
    { key: "amount", header: "Amount", sortValue: (c) => c.amount, render: (c) => <div><div className="font-semibold">{inrFull(c.amount)}</div><div className="text-xs text-outline font-mono">{c.invoiceNo}</div></div> },
    { key: "ref", header: "Paid by", sortValue: (c) => c.reference, render: (c) => <div><div className="font-mono text-sm">{c.reference}</div>
      <div className="text-xs text-outline">{c.mode} · {c.paidOn ? fmtDate(c.paidOn) : ""}</div>
      {c.status === "Pending" && dupOf(c) && <div className="mt-0.5 flex items-center gap-1 text-xs text-error"><TriangleAlert size={12} />Reference already used</div>}
      {c.note && <div className="text-xs text-outline">“{c.note}”</div>}</div> },
    { key: "status", header: "Status", sortValue: (c) => c.status, render: (c) => <div><Badge tone={tone[c.status as keyof typeof tone] ?? "neutral"}>{c.status}</Badge>
      {c.receiptNo && <div className="mt-0.5 text-xs text-outline font-mono">{c.receiptNo}</div>}
      {c.rejectReason && <div className="mt-0.5 max-w-[220px] text-xs text-outline">{c.rejectReason}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (c) => c.status === "Pending" ? <div className="flex justify-end gap-2">
      <Button size="sm" variant="outline" onClick={() => setVerifying(c)}>Verify</Button>
      <Button size="sm" variant="ghost" className="!text-error" onClick={() => setRejecting(c)}>Reject</Button></div> : null },
  ];

  const hasBank = !!(bank.upiId || (bank.accountNo && bank.ifsc));
  return (
    <div className="mt-5 grid items-start gap-6 xl:grid-cols-[1fr_340px]">
      <Card className="pt-1">
        <CardHeader title="Payments reported by parents" subtitle="Check each one against the bank statement. Verifying records the payment and sends the receipt to the parent app." />
        <div className="px-5 pb-3"><Tabs value={tab} onChange={setTab} items={[{ id: "Pending", label: "To verify", count: n("Pending") }, { id: "Verified", label: "Verified", count: n("Verified") }, { id: "Rejected", label: "Rejected", count: n("Rejected") }, { id: "all", label: "All", count: claims.rows.length }]} /></div>
        {!claims.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading…</p>
          : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title="Nothing to verify" hint="Payments parents report from the parent app show up here." />} />}
      </Card>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2"><Landmark size={18} className="text-secondary" /><h3 className="font-semibold">Account shown to parents</h3></div>
          <Button size="sm" variant="ghost" onClick={() => setEditBank(true)}><Pencil size={14} />Edit</Button>
        </div>
        {hasBank ? <dl className="mt-3 grid grid-cols-[110px_1fr] gap-y-1.5 text-sm">
          {bank.upiId && <><dt className="text-outline">UPI ID</dt><dd className="font-mono">{bank.upiId}</dd></>}
          {bank.accountName && <><dt className="text-outline">Name</dt><dd>{bank.accountName}</dd></>}
          {bank.accountNo && <><dt className="text-outline">Account</dt><dd className="font-mono">{bank.accountNo}</dd></>}
          {bank.ifsc && <><dt className="text-outline">IFSC</dt><dd className="font-mono">{bank.ifsc}</dd></>}
          {bank.bank && <><dt className="text-outline">Bank</dt><dd>{[bank.bank, bank.branch].filter(Boolean).join(", ")}</dd></>}
        </dl> : <p className="mt-3 text-sm text-on-surface-variant">Not set. Until you add it, the parent app asks parents to pay at the school office.</p>}
      </Card>
      <VerifyModal claim={verifying} invoice={invoices.find((i) => i.id === verifying?.invoiceId)} duplicate={!!verifying && dupOf(verifying)} onClose={() => setVerifying(null)} onVerify={verify} />
      <ReasonModal ids={rejecting ? [rejecting.id] : null} title="Reject reported payment" label="Note to the parent" onClose={() => setRejecting(null)}
        onSubmit={async (_ids, reason) => { if (rejecting) { await claims.update(rejecting.id, { status: "Rejected", rejectReason: reason, verifiedBy: me.name, verifiedAt: new Date().toISOString() }); toast("Payment rejected"); } }} />
      {/* merge: a new school may not have its school/school doc yet */}
      <BankModal open={editBank} bank={bank} onClose={() => setEditBank(false)}
        onSave={async (b) => { await setDoc(schoolDoc("school", "school"), { bank: b, ...stamp() }, { merge: true }); toast("Account details saved"); }} />
    </div>
  );
}

/** "" when a verified amount is acceptable (0 < amount ≤ balance, paise allowed), else the message */
export function verifyAmountError(amount: number, balance: number) {
  if (balance <= 0) return "This invoice is already settled. Reject the claim if the money did not reach the bank twice.";
  if (!Number.isFinite(amount) || round2(amount) <= 0) return "Enter the amount that reached the bank.";
  if (round2(amount) > round2(balance)) return `Enter an amount up to the due balance of ${inrFull(round2(balance))}.`;
  return paymentAmountError(amount, balance) ? "Enter the amount that reached the bank." : "";
}

function VerifyModal({ claim, invoice, duplicate, onClose, onVerify }: {
  claim: Claim | null; invoice?: Invoice; duplicate: boolean; onClose: () => void; onVerify: (c: Claim, amount: number) => Promise<void>;
}) {
  const [amt, setAmt] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const value = amt ?? String(claim?.amount ?? "");
  const close = () => { setAmt(null); setErr(""); onClose(); };
  return (
    <Modal open={!!claim} onClose={close} title="Verify payment" subtitle={claim ? `${claim.studentName} · ${claim.mode} · ${claim.reference}` : undefined}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={async () => {
        if (!claim) return; setBusy(true);
        const a = value.trim() === "" ? NaN : Number(value);
        const pre = invoice ? verifyAmountError(a, balanceOf(invoice)) : "";
        if (pre) { setErr(pre); setBusy(false); return; }
        try { await onVerify(claim, a); close(); } catch (e) { setErr(e instanceof Error ? e.message : "Could not verify"); } finally { setBusy(false); }
      }}>{busy ? "Recording…" : "Verify & issue receipt"}</Button></>}>
      <p className="text-sm text-on-surface-variant">Confirm that {claim ? inrFull(claim.amount) : ""} with reference <b className="font-mono">{claim?.reference}</b> reached the school account
        {claim?.paidOn ? ` on or after ${fmtDate(claim.paidOn)}` : ""}.</p>
      {duplicate && <p className="mt-2 flex items-center gap-1 text-sm text-error"><TriangleAlert size={14} />This reference was already used by another payment. Check the bank statement before verifying.</p>}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Amount received (₹)" hint="Change it if a different amount reached the bank"><Input type="number" value={value} onChange={(e) => { setAmt(e.target.value); setErr(""); }} /></Field>
        <Field label="Invoice"><Input readOnly value={invoice ? `${invoice.no} · due ${inrFull(balanceOf(invoice))}` : "Not found"} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
    </Modal>
  );
}

function BankModal({ open, bank, onClose, onSave }: { open: boolean; bank: Bank; onClose: () => void; onSave: (b: Bank) => Promise<void> }) {
  const [f, setF] = useState<Bank | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const form = f ?? bank;
  const set = (k: keyof Bank) => (e: React.ChangeEvent<HTMLInputElement>) => { setF({ ...form, [k]: k === "ifsc" ? e.target.value.toUpperCase() : e.target.value }); setErr(""); };
  const close = () => { setF(null); setErr(""); onClose(); };
  return (
    <Modal open={open} onClose={close} title="Account shown to parents" subtitle="Parents pay into this account from the parent app and report the payment for you to verify."
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={async () => {
        const b = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, String(v ?? "").trim()])) as Bank;
        if (!b.upiId && !(b.accountNo && b.ifsc)) return setErr("Enter a UPI ID, or an account number with its IFSC.");
        if (b.ifsc && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(b.ifsc)) return setErr("The IFSC should look like SBIN0001234.");
        if (b.upiId && !/^[\w.-]+@[\w.-]+$/.test(b.upiId)) return setErr("The UPI ID should look like school@bank.");
        setBusy(true);
        try { await onSave(b); close(); } catch { setErr("Could not save."); } finally { setBusy(false); }
      }}>{busy ? "Saving…" : "Save"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Account name" className="sm:col-span-2"><Input value={form.accountName ?? ""} onChange={set("accountName")} placeholder="e.g. Greenfield International School" /></Field>
        <Field label="Account number"><Input value={form.accountNo ?? ""} onChange={set("accountNo")} inputMode="numeric" /></Field>
        <Field label="IFSC"><Input value={form.ifsc ?? ""} onChange={set("ifsc")} className="font-mono" /></Field>
        <Field label="Bank"><Input value={form.bank ?? ""} onChange={set("bank")} /></Field>
        <Field label="Branch"><Input value={form.branch ?? ""} onChange={set("branch")} /></Field>
        <Field label="UPI ID" className="sm:col-span-2"><Input value={form.upiId ?? ""} onChange={set("upiId")} placeholder="school@bank" /></Field>
        <Field label="Instructions for parents" className="sm:col-span-2"><Input value={form.note ?? ""} onChange={set("note")} placeholder="e.g. Write the GR number in the remarks." /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
    </Modal>
  );
}
