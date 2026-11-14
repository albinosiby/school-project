"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Button, Card, DataTable, Field, Input, Modal, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { loadStaffPayroll, recordStaffPayrollPayment, revealStaffPayrollAccount, saveStaffPayrollAccount,
  type PayrollAccount, type PayrollPayment, type PayrollPaymentInput, type PayrollSnapshot } from "./staffPayroll";
import { staffFormError } from "./staffProfiles";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" });
const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
type PaymentRow = PayrollPayment & { id: string };
const payrollColumns: Column<PaymentRow>[] = [
  { key: "month", header: "Month", render: (row) => monthLabel.format(new Date(`${row.month}-01T00:00:00Z`)) },
  { key: "paidOn", header: "Paid on", render: (row) => <div>
    {fmtDate(row.paidOn)}
    {row.reference && <div className="t-caption text-outline">{row.reference}</div>}
  </div> },
  { key: "gross", header: "Gross pay", render: (row) => money.format(row.grossPaise / 100) },
  { key: "deductions", header: "Deductions", render: (row) => money.format(row.deductionsPaise / 100) },
  { key: "net", header: "Net paid", render: (row) => <strong>{money.format(row.netPaise / 100)}</strong> },
];

export function StaffPayrollCards({ staffId, today }: { staffId: string; today: string }) {
  const toast = useToast();
  const [snapshot, setSnapshot] = useState<PayrollSnapshot>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [editing, setEditing] = useState<"account" | "payment">();
  const [accountNumber, setAccountNumber] = useState("");
  const [revealing, setRevealing] = useState(false);
  const visit = useRef<AbortController | null>(null);

  useLayoutEffect(() => {
    const current = new AbortController();
    visit.current = current;
    return () => {
      current.abort();
      setAccountNumber("");
      setEditing(undefined);
      setRevealing(false);
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadStaffPayroll(staffId).then((result) => {
      if (active) setSnapshot(result);
    }).catch((error: unknown) => {
      if (active) setError(staffFormError(error));
    });
    return () => { active = false; };
  }, [staffId, revision]);

  const account = snapshot?.account;
  const payments = (snapshot?.payments ?? []).map((payment) => ({ ...payment, id: payment.month }));

  async function toggleAccountNumber() {
    if (accountNumber) {
      setAccountNumber("");
      return;
    }
    const signal = visit.current?.signal;
    setRevealing(true);
    try {
      const result = await revealStaffPayrollAccount(staffId);
      if (!signal?.aborted) setAccountNumber(result.accountNumber);
    } catch (error) {
      if (!signal?.aborted) toast(staffFormError(error), "error");
    } finally {
      if (!signal?.aborted) setRevealing(false);
    }
  }

  return <>
    <Card className="min-w-0 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-label-caps text-on-surface-variant">Payroll bank details</h2>
        {account && <Button variant="outline" size="sm" disabled={revealing} onClick={() => {
          setAccountNumber("");
          setEditing("account");
        }}>Edit bank details</Button>}
      </div>
      {error ? <div className="flex flex-wrap items-center gap-2">
        <p role="alert" className="text-sm text-error">{error}</p>
        <Button variant="outline" size="sm" onClick={() => {
          setError("");
          setRevision((value) => value + 1);
        }}>Try again</Button>
      </div> : !snapshot ? <p role="status" className="text-sm">Loading payroll…</p>
        : account ? <dl className="grid grid-cols-[minmax(0,8rem)_1fr] gap-2 text-sm">
          <dt className="text-outline">Account holder</dt><dd className="break-words">{account.accountHolder}</dd>
          <dt className="text-outline">Bank</dt><dd className="break-words">{account.bank}</dd>
          {account.branch && <><dt className="text-outline">Branch</dt><dd className="break-words">{account.branch}</dd></>}
          <dt className="text-outline">IFSC</dt><dd className="font-mono">{account.ifsc}</dd>
          <dt className="text-outline">Account number</dt><dd className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="break-all font-mono">{accountNumber || `•••• ${account.lastFour}`}</span>
              <Button variant="ghost" size="sm" disabled={revealing} onClick={() => void toggleAccountNumber()}>
                {revealing ? "Loading…" : accountNumber ? "Hide account number" : "Show account number"}
              </Button>
            </div>
          </dd>
        </dl> : <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">No payroll bank details saved.</p>
          <Button size="sm" onClick={() => setEditing("account")}>Add bank details</Button>
        </div>}
    </Card>
    <Card className="min-w-0 p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="t-label-caps text-on-surface-variant">Payroll history</h2>
        {payments.length > 0 && <Button variant="outline" size="sm" onClick={() => setEditing("payment")}>Record payment</Button>}
      </div>
      {!snapshot ? <p className="text-sm text-on-surface-variant">{error ? "Payroll history is unavailable." : "Loading payroll history…"}</p>
        : payments.length ? <DataTable rows={payments} columns={payrollColumns} pageSize={6} />
        : <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">No payroll payments recorded.</p>
          <Button size="sm" onClick={() => setEditing("payment")}>Record payment</Button>
        </div>}
    </Card>
    {editing === "account" && <PayrollEditor title="Payroll bank details" onClose={() => setEditing(undefined)}
      onSave={async (form) => {
        const { account } = await saveStaffPayrollAccount(staffId, {
          bank: field(form, "bank"), branch: field(form, "branch"), accountHolder: field(form, "accountHolder"),
          ifsc: field(form, "ifsc"), accountNumber: field(form, "accountNumber"),
        });
        setSnapshot((current) => current && { ...current, account });
        toast("Payroll bank details saved");
      }}>
      <AccountFields account={account} />
    </PayrollEditor>}
    {editing === "payment" && <PayrollEditor title="Record payroll payment" onClose={() => setEditing(undefined)}
      onSave={async (form) => {
        const input: PayrollPaymentInput = {
          month: field(form, "month"), paidOn: field(form, "paidOn"), gross: field(form, "gross"),
          deductions: field(form, "deductions"), reference: field(form, "reference"),
        };
        const { payment } = await recordStaffPayrollPayment(staffId, input);
        setSnapshot((current) => current && {
          ...current,
          payments: [payment, ...current.payments.filter((row) => row.month !== payment.month)]
            .sort((first, second) => second.month.localeCompare(first.month)),
        });
        toast("Payroll payment recorded");
      }}>
      <p className="text-sm text-on-surface-variant sm:col-span-2">Record a payment already made to this staff member.</p>
      <Field label="Payroll month" required><Input name="month" type="month" defaultValue={today.slice(0, 7)} max={today.slice(0, 7)} required /></Field>
      <Field label="Payment date" required><Input name="paidOn" type="date" defaultValue={today} max={today} required /></Field>
      <Field label="Gross pay (₹)" required><Input name="gross" type="number" min="0.01" max="999999999.99" step="0.01" required /></Field>
      <Field label="Deductions (₹)"><Input name="deductions" type="number" min="0" max="999999999.99" step="0.01" defaultValue="0" /></Field>
      <Field label="Payment reference" className="sm:col-span-2"><Input name="reference" maxLength={100} /></Field>
    </PayrollEditor>}
  </>;
}

function field(data: FormData, name: string) {
  return String(data.get(name) ?? "");
}

function AccountFields({ account }: { account?: PayrollAccount | null }) {
  return <>
    <Field label="Account holder" required><Input name="accountHolder" defaultValue={account?.accountHolder} maxLength={120} required /></Field>
    <Field label="Bank name" required><Input name="bank" defaultValue={account?.bank} maxLength={120} required /></Field>
    <Field label="Branch"><Input name="branch" defaultValue={account?.branch} maxLength={120} /></Field>
    <Field label="IFSC" required><Input name="ifsc" defaultValue={account?.ifsc} pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" maxLength={11} required /></Field>
    <Field label="Account number" required={!account} className="sm:col-span-2"
      hint={account ? `Leave blank to keep the account ending in ${account.lastFour}.` : undefined}>
      <Input name="accountNumber" type="text" inputMode="numeric" pattern="[0-9]{6,24}" maxLength={24} autoComplete="off" required={!account} />
    </Field>
  </>;
}

function PayrollEditor({ title, onClose, onSave, children }: {
  title: string;
  onClose: () => void;
  onSave: (form: FormData) => Promise<void>;
  children: React.ReactNode;
}) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(new FormData(event.currentTarget));
      onClose();
    } catch (error) {
      setError(staffFormError(error));
    } finally {
      setSaving(false);
    }
  }

  return <Modal open title={title} onClose={() => { if (!saving) onClose(); }} footer={<>
    <Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
    <Button type="submit" form={id} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
  </>}>
    <form id={id} onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      {children}
      {error && <p role="alert" className="text-sm text-error sm:col-span-2">{error}</p>}
    </form>
  </Modal>;
}
