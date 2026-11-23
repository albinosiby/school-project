import { balanceOf, shownStatus, round2 } from "./logic";
import { todayIso, type Invoice } from "./types";

export type InvoiceSchool = { name?: string; board?: string; affiliation?: string; city?: string; logoUrl?: string };
export const invoiceColors = { blue: "#0755D9", ink: "#183153", muted: "#68778C", line: "#DBE3EE", soft: "#F2F6FC", green: "#137859" };
export const formatInvoiceMoney = (amount: number) => `${amount < 0 ? "-" : ""}₹${Math.abs(amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** One presentation model for the paper preview and PDF; saved invoice amounts stay authoritative. */
export function invoicePresentation(invoice: Invoice, school: InvoiceSchool) {
  const adjustments = round2((invoice.lines ?? []).reduce((sum, line) => sum + (line.amount < 0 ? -line.amount : 0), 0));
  const discount = invoice.concessionAmount ?? adjustments;
  const status = shownStatus(invoice, todayIso());
  const term = invoice.term || "";
  const year = invoice.academicYear || /\b20\d{2}-\d{2}\b/.exec(term)?.[0] || "";
  return {
    colors: invoiceColors, status, statusLabel: status === "Partial" ? "Part paid" : status === "Pending" ? "Unpaid" : status,
    schoolName: school.name || "School invoice",
    affiliation: [school.board, school.affiliation ? `Affiliation #${school.affiliation.replace(/^#\s*/, "")}` : ""].filter(Boolean).join(" · "),
    year, period: year && term.startsWith(`${year} · `) ? term.slice(year.length + 3) : term || "Not recorded",
    className: `Grade ${invoice.grade}${invoice.section ? ` · Division ${invoice.section}` : ""}${invoice.stream ? ` · ${invoice.stream}` : ""}`,
    subtotal: invoice.grossAmount ?? round2(invoice.amount + discount), discount, amount: invoice.amount, paid: invoice.paid ?? 0, balance: balanceOf(invoice),
    lines: (invoice.lines ?? []).map((line) => ({ ...line, quantity: line.amount >= 0 ? line.quantity || 1 : null,
      rate: line.amount >= 0 ? round2(line.unitAmount ?? line.amount / (line.quantity || 1)) : null })),
  };
}
