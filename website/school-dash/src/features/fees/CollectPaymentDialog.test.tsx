import { beforeEach, describe, expect, it, vi } from "vitest";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, callableCalls } from "@/test/render";
import { CollectPaymentDialog } from "./CollectPaymentDialog";
import * as service from "./paymentService";
import { FeePaymentError } from "./paymentService";
import type { Invoice } from "./types";

const invoice: Invoice = { id: "invoice", no: "INV-1", studentId: "student", student: "Synthetic Student", grn: "SYN-1", grade: "5", section: "A", guardian: "Parent", phone: "", term: "Annual", issued: "2026-06-01", due: "2099-01-01", amount: 1000, paid: 0, balance: 1000, status: "Pending", lines: [] };
const key = "test-collect-payment";
const props = () => ({ invoices: [invoice], storageKey: key, onClose: vi.fn(), onSaved: vi.fn() });
beforeEach(() => { sessionStorage.removeItem(key); seed({ fee_invoices: [invoice] }); });

describe("student payment collection", () => {
  it("records a partial payment and updates the invoice and receipt together", async () => {
    const p = props();
    const { user } = renderUI(<CollectPaymentDialog {...p} />);
    await user.clear(field("Amount collected (₹)")); await user.type(field("Amount collected (₹)"), "250.50");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    await vi.waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
    expect(getRow("fee_invoices", invoice.id)).toMatchObject({ paid: 250.5, balance: 749.5, status: "Partial" });
    expect(rowsOf("fee_payments")).toHaveLength(1);
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it("requires a non-cash reference and records the full balance as Paid", async () => {
    const p = props(); const { user } = renderUI(<CollectPaymentDialog {...p} intent="Paid" />);
    expect(field("Invoice")).toBeDisabled();
    await user.selectOptions(field("Payment method"), "UPI");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("transaction reference");
    expect(p.onSaved).not.toHaveBeenCalled();
    await user.type(field("Transaction reference"), " ref 1234 ");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    await vi.waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
    expect(getRow("fee_invoices", invoice.id)).toMatchObject({ paid: 1000, balance: 0, status: "Paid" });
    expect(rowsOf("fee_payments")[0]).toMatchObject({ reference: "REF1234", mode: "UPI · REF1234" });
  });

  it("refuses zero, overpayment and a full amount when Partial was selected", async () => {
    const p = props(); const { user } = renderUI(<CollectPaymentDialog {...p} intent="Partial" />);
    const amount = field("Amount collected (₹)");
    await user.clear(amount); await user.type(amount, "0");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(p.onSaved).not.toHaveBeenCalled();
    await user.clear(amount); await user.type(amount, "1001");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("exceeds");
    await user.clear(amount); await user.type(amount, "1000");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(screen.getByRole("alert")).toHaveTextContent("less than");
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });

  it("resumes the same uncertain request after closing, even when its payment already settled the invoice", async () => {
    const real = service.recordFeePayment;
    vi.spyOn(service, "recordFeePayment")
      .mockImplementationOnce(async (request) => { await real(request); throw new FeePaymentError("Confirmation interrupted", "unknown"); })
      .mockRejectedValueOnce(new FeePaymentError("Verify your administrator session", "rejected"));
    const p = props(); const { user, unmount } = renderUI(<CollectPaymentDialog {...p} />);
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Confirmation interrupted");
    expect(field("Amount collected (₹)")).toBeDisabled();
    const saved = JSON.parse(sessionStorage.getItem(key)!);
    expect(rowsOf("fee_payments")).toHaveLength(1);
    unmount();
    const settled = { ...invoice, paid: 1000, balance: 0, status: "Paid" as const };
    renderUI(<CollectPaymentDialog {...p} invoices={[settled]} />);
    await user.click(within(dialog("Collect payment")).getByRole("button", { name: "Retry payment confirmation" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Verify your administrator session");
    expect(JSON.parse(sessionStorage.getItem(key)!).requestId).toBe(saved.requestId);
    expect(field("Amount collected (₹)")).toBeDisabled();
    await user.click(within(dialog("Collect payment")).getByRole("button", { name: "Retry payment confirmation" }));
    await vi.waitFor(() => expect(p.onSaved).toHaveBeenCalledOnce());
    const requests = callableCalls.filter(([name]) => name === "recordFeePayment");
    expect(requests.at(-1)?.[1]).toMatchObject({ requestId: saved.requestId });
    expect(rowsOf("fee_payments")).toHaveLength(1);
  });

  it("allows correction after a confirmed rejection and explains when an invoice is needed", async () => {
    vi.spyOn(service, "recordFeePayment").mockRejectedValueOnce(new FeePaymentError("Balance changed", "rejected"));
    const { user, unmount } = renderUI(<CollectPaymentDialog {...props()} />);
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Balance changed");
    expect(field("Amount collected (₹)")).toBeEnabled(); expect(sessionStorage.getItem(key)).toBeNull();
    unmount(); renderUI(<CollectPaymentDialog {...props()} invoices={[]} />);
    expect(screen.getByText(/Create an invoice for uninvoiced fees/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save & issue receipt" })).toBeDisabled();
  });
});
