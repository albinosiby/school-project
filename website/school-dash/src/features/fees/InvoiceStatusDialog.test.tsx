import { describe, expect, it, vi } from "vitest";
import { field, getRow, renderUI, rowsOf, screen, seed } from "@/test/render";
import { InvoiceStatusDialog } from "./InvoiceStatusDialog";
import type { Invoice } from "./types";

const invoice: Invoice = { id: "invoice", no: "INV-1", studentId: "s", student: "Synthetic Student", grade: "5", section: "A", grn: "SYN-1", guardian: "Parent", phone: "", term: "Annual", issued: "2026-06-01", due: "2026-07-01", amount: 1000, paid: 200, balance: 800, status: "Overdue", lines: [] };
const props = () => ({ invoice, today: "2026-11-03", onClose: vi.fn(), onSaved: vi.fn(), onCollect: vi.fn() });

describe("manual invoice status", () => {
  it("requires a reason and changes the label with history while keeping money unchanged", async () => {
    seed({ fee_invoices: [invoice] }); const p = props(); const { user } = renderUI(<InvoiceStatusDialog {...p} />);
    await user.selectOptions(field("Invoice status"), "Pending");
    await user.click(screen.getByRole("button", { name: "Save status" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a reason");
    await user.type(field("Reason for status change"), "Agreed payment extension");
    await user.click(screen.getByRole("button", { name: "Save status" }));
    await vi.waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
    expect(getRow("fee_invoices", invoice.id)).toMatchObject({ paid: 200, balance: 800, status: "Pending", statusOverride: { status: "Pending" } });
    expect(rowsOf("fee_invoice_status_history")).toHaveLength(1);
    expect(rowsOf("fee_invoice_status_history")[0]).toMatchObject({ reason: "Agreed payment extension" });
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });

  it.each(["Paid", "Partial"] as const)("routes %s to collection without changing the financial records", async (status) => {
    seed({ fee_invoices: [invoice] }); const p = props(); const { user } = renderUI(<InvoiceStatusDialog {...p} />);
    await user.selectOptions(field("Invoice status"), status);
    await user.click(screen.getByRole("button", { name: "Continue to collect payment" }));
    expect(p.onCollect).toHaveBeenCalledWith(status);
    expect(getRow("fee_invoices", invoice.id)).toMatchObject({ paid: 200, balance: 800, status: "Overdue" });
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });

  it("cannot make a settled invoice unpaid", () => {
    seed({}); renderUI(<InvoiceStatusDialog {...props()} invoice={{ ...invoice, paid: 1000, balance: 0, status: "Paid" }} />);
    expect(screen.getByRole("option", { name: "Pending" })).toBeDisabled();
    expect(screen.getByRole("option", { name: "Overdue" })).toBeDisabled();
  });
});
