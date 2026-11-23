import { annualOccurrences, type FeeFrequency, type FeeItem } from "@/features/fees/feePlan";
import type { Concession, Invoice } from "@/features/fees/types";
import { attendanceAcademicRange } from "./studentAttendance";

export type FeeTerm = { id: string; start?: string; end?: string };
/** `preselect`: ticked by default when an invoice is generated. Transport is owed (mandatory) but billed only when the admin ticks it, so it can go on its own invoice. */
export type AnnualCharge = { id: string; name: string; unitAmount: number; quantity: number; frequency: FeeFrequency; mandatory: boolean; preselect: boolean; remaining: number };
export const TRANSPORT_CHARGE_ID = "student_transport";
export type AnnualInput = {
  academicYear: string; items: FeeItem[]; termsPerYear?: number; terms: FeeTerm[];
  admissionDate?: string; invoices: Invoice[]; concessions: Concession[];
  busId?: string; transportAmount: number | null; transportFrequency?: FeeFrequency | "";
};
export const toCents = (amount: number) => Math.round(amount * 100);
const normal = (name: string) => name.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const invoiceYear = (row: Invoice) => row.academicYear || /\b20\d{2}-\d{2}\b/.exec(row.term ?? "")?.[0];

export function annualStudentFees(input: AnnualInput) {
  const range = attendanceAcademicRange(input.terms);
  const inYear = (date: string) => Boolean(range && date >= range.start && date <= range.end);
  const yearInvoices = input.invoices.filter((row) => invoiceYear(row) ? invoiceYear(row) === input.academicYear : inYear(row.issued));
  const concessions = input.concessions.filter((row) => row.status === "Approved" && (row.academicYear ? row.academicYear === input.academicYear : inYear(row.requested)));
  const issues: string[] = [];
  if (!input.academicYear || !range) issues.push("Configure the academic year and term dates to calculate annual fees.");
  if (yearInvoices.some((row) => row.amount > 0 && !(row.lines ?? []).some((line) => line.amount > 0))) issues.push("Review the fee items on existing invoices before calculating annual fees.");
  if (concessions.some((row) => !Number.isFinite(row.amount) || row.amount < 0)) issues.push("Review the saved concession amounts.");
  const terms = input.termsPerYear ?? input.terms.length;
  if (!Number.isInteger(terms) || terms < 1 || terms > 4) issues.push("Configure the number of terms per year.");
  if (input.items.some((item) => item.newStudentsOnly) && !input.admissionDate) issues.push("Add the student's admission date to determine admission-only fees.");
  const items = input.items.filter((item) => !item.newStudentsOnly || Boolean(input.admissionDate && inYear(input.admissionDate)));
  if (items.some((item) => !Number.isFinite(item.amount) || item.amount < 0 || !Number.isFinite(annualOccurrences(item.frequency, terms)))) issues.push("Review the configured fee amounts and collection frequencies.");
  const charges: AnnualCharge[] = items.map((item) => ({ id: item.id, name: item.name, unitAmount: item.amount, frequency: item.frequency, mandatory: item.mandatory, preselect: item.mandatory,
    quantity: item.frequency === "One-time" ? 1 : annualOccurrences(item.frequency, terms), remaining: 0 }));
  if (input.busId) {
    if (input.transportAmount === null || !Number.isFinite(input.transportAmount) || input.transportAmount < 0 || !input.transportFrequency) issues.push("Configure the student's transport amount and its collection frequency.");
    else charges.push({ id: TRANSPORT_CHARGE_ID, name: "Transport", unitAmount: input.transportAmount, frequency: input.transportFrequency, mandatory: true, preselect: false,
      quantity: input.transportFrequency === "One-time" ? 1 : annualOccurrences(input.transportFrequency, terms), remaining: 0 });
  }
  let extraCents = 0;
  const used: Record<string, number> = {};
  const match = (line: Invoice["lines"][number]) => line.feeItemId ? charges.find((charge) => line.feeItemId === charge.id)
    : charges.find((charge) => normal(line.label) === normal(charge.name))
      || [...charges].sort((a, b) => b.name.length - a.name.length).find((charge) => normal(line.label).startsWith(`${normal(charge.name)} `));
  const previouslyBilledOnce = new Set(input.invoices.filter((invoice) => !yearInvoices.includes(invoice)).flatMap((invoice) => (invoice.lines ?? []).flatMap((line) => {
    const item = line.amount > 0 ? match(line) : undefined;
    return item?.frequency === "One-time" ? [item.id] : [];
  })));
  for (const item of charges) if (previouslyBilledOnce.has(item.id)) item.quantity = 0;
  for (const invoice of yearInvoices) for (const line of invoice.lines ?? []) {
    if (!(line.amount > 0)) continue;
    const item = match(line);
    if (!item) { extraCents += toCents(line.amount); continue; }
    const quantity = line.quantity ?? (item.unitAmount > 0 ? Math.ceil(toCents(line.amount) / toCents(item.unitAmount)) : 0);
    used[item.id] = (used[item.id] ?? 0) + quantity;
    if (!item.mandatory) extraCents += toCents(line.amount);
  }
  for (const charge of charges) charge.remaining = Math.max(0, charge.quantity - (used[charge.id] ?? 0));
  const grossCents = charges.filter((row) => row.mandatory).reduce((total, row) => total + toCents(row.unitAmount) * row.quantity, extraCents);
  const approvedCents = concessions.reduce((total, row) => total + toCents(row.amount), 0);
  const paidCents = yearInvoices.reduce((total, row) => total + toCents(row.paid ?? 0), 0);
  return {
    complete: issues.length === 0 && charges.length > 0, issues, charges, used, concessions, yearInvoices,
    gross: grossCents / 100, concessionsTotal: Math.min(grossCents, approvedCents) / 100,
    net: Math.max(0, grossCents - approvedCents) / 100, paid: paidCents / 100,
    payable: Math.max(0, grossCents - approvedCents - paidCents) / 100,
  };
}

export type InvoiceChoice = { feeItemId: string; quantity: number };
export function invoicePreview(charges: AnnualCharge[], choices: InvoiceChoice[], concessions: Concession[]) {
  const ids = new Set<string>();
  const lines = choices.map((choice) => {
    const item = charges.find((row) => row.id === choice.feeItemId);
    if (!item || ids.has(choice.feeItemId) || !Number.isInteger(choice.quantity) || choice.quantity < 1 || choice.quantity > item.remaining)
      throw new Error("Review the selected fee items and their remaining collections.");
    ids.add(choice.feeItemId);
    return { label: item.name, feeItemId: item.id, quantity: choice.quantity, unitAmount: item.unitAmount, amount: toCents(item.unitAmount) * choice.quantity / 100 };
  });
  if (!lines.length) throw new Error("Select at least one fee item.");
  const grossCents = lines.reduce((total, row) => total + toCents(row.amount), 0);
  let available = grossCents;
  const allocations = concessions.filter((concession) => concession.status === "Approved").flatMap((concession) => {
    const used = (concession.invoiceApplications ?? []).reduce((total, row) => total + toCents(row.amount), 0);
    const applied = Math.min(available, Math.max(0, toCents(concession.amount) - used));
    available -= applied;
    return applied ? [{ concessionId: concession.id, type: concession.type, amount: applied / 100 }] : [];
  });
  return { lines, allocations, gross: grossCents / 100, discount: (grossCents - available) / 100, amount: available / 100 };
}
