import { describe, expect, it } from "vitest";
import { PaymentVerification, verifyAmountError } from "./PaymentVerification";
import type { Invoice, Payment } from "./types";
import { dialog, failNextWrite, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

const inv: Invoice = {
  id: "inv_1", no: "INV-2026-0901", student: "Aarav Sharma", grade: "10", section: "B", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "", term: "Term 2",
  issued: "2026-10-10", due: "2026-11-15", amount: 42000, paid: 12000, balance: 30000, status: "Partial", lines: [],
};
// what the parent app writes (firebase_fee_repository.dart reportPayment)
const claim = {
  id: "clm_1", studentId: "stu_101", grn: "GIS-9200", studentName: "Aarav Sharma", classId: "cls_10B", invoiceId: "inv_1", invoiceNo: "INV-2026-0901", amount: 5000,
  mode: "UPI", reference: "UTR998877", paidOn: "2026-11-02", note: "", status: "Pending", parentUid: "uid_parent", parentName: "Mr. Rahul Sharma", submittedAt: "2026-11-02T10:00:00.000Z",
};

function open(payments: Payment[] = [], claims: Record<string, unknown>[] = [claim]) {
  seed({ fee_invoices: [inv], fee_payments: payments, fee_claims: claims });
  return renderUI(<PaymentVerification invoices={[inv]} payments={payments} today="2026-11-03" />);
}

describe("verify amount bounds", () => {
  it("accepts 0 < amount ≤ balance (paise allowed)", () => {
    expect(verifyAmountError(5000, 30000)).toBe("");
    expect(verifyAmountError(30000, 30000)).toBe("");
    expect(verifyAmountError(4999.5, 30000)).toBe("");
    expect(verifyAmountError(0, 30000)).toBe("Enter the amount that reached the bank.");
    expect(verifyAmountError(Number.NaN, 30000)).toBe("Enter the amount that reached the bank.");
    expect(verifyAmountError(30000.01, 30000)).toBe("Enter an amount up to the due balance of ₹30,000.");
    expect(verifyAmountError(10, 0)).toBe("This invoice is already settled. Reject the claim if the money did not reach the bank twice.");
  });
});

describe("Payment verification", () => {
  it("refuses a corrected amount of 0 or above the balance and writes nothing", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    const d = dialog("Verify payment");
    await user.clear(field("Amount received (₹)", d));
    await user.click(within(d).getByRole("button", { name: "Verify & issue receipt" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Enter the amount that reached the bank.");
    await user.type(field("Amount received (₹)", d), "30001");
    await user.click(within(d).getByRole("button", { name: "Verify & issue receipt" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Enter an amount up to the due balance of ₹30,000.");
    expect(writes).toHaveLength(0);
  });

  it("verifies: receipt like the counter, invoice paid / balance / status, claim Verified with receiptNo + paymentId", async () => {
    const { user } = open([{ id: "rcp_1", receiptNo: "RCP-20410", invoiceId: "inv_9", invoiceNo: "X", student: "", grade: "", grn: "", amount: 1, mode: "Cash", date: "2026-10-01", by: "" }]);
    await user.click(screen.getByRole("button", { name: "Verify" }));
    const d = dialog("Verify payment");
    await user.clear(field("Amount received (₹)", d));
    await user.type(field("Amount received (₹)", d), "4500");
    await user.click(within(d).getByRole("button", { name: "Verify & issue receipt" }));
    const p = rowsOf<Record<string, unknown>>("fee_payments").find((x) => x.id !== "rcp_1")!;
    expect(p).toMatchObject({ receiptNo: "RCP-20411", invoiceId: "inv_1", invoiceNo: "INV-2026-0901", student: "Aarav Sharma", grade: "10", grn: "GIS-9200", amount: 4500, mode: "UPI · UTR998877", reference: "UTR998877", claimId: "clm_1", date: "2026-11-02", by: "School Admin" });
    expect(getRow("fee_invoices", "inv_1")).toMatchObject({ paid: 16500, balance: 25500, status: "Partial" });
    const c = getRow<Record<string, unknown>>("fee_claims", "clm_1")!;
    expect(c).toMatchObject({ status: "Verified", amount: 4500, receiptNo: "RCP-20411", paymentId: p.id, verifiedBy: "School Admin", verifiedByUid: "admin_uid" });
    expect(typeof c.verifiedAt).toBe("string");
    expect(await screen.findByText("Verified · receipt RCP-20411 issued")).toBeInTheDocument();
  });

  it("writes nothing when the batch fails", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    failNextWrite();
    await user.click(within(dialog("Verify payment")).getByRole("button", { name: "Verify & issue receipt" }));
    expect(await within(dialog("Verify payment")).findByRole("alert")).toHaveTextContent("Could not record the payment. Nothing was saved; try again.");
    expect(writes).toHaveLength(0);
    expect(getRow("fee_claims", "clm_1")).toMatchObject({ status: "Pending" });
  });

  it("warns when the reference was already used by a payment or another claim", async () => {
    const { user } = open(
      [{ id: "rcp_1", receiptNo: "RCP-20410", invoiceId: "inv_1", invoiceNo: "INV-2026-0901", student: "Aarav Sharma", grade: "10", grn: "GIS-9200", amount: 5000, mode: "UPI · utr998877", date: "2026-11-01", by: "Desk" }],
    );
    expect(screen.getByText("Reference already used")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Verify" }));
    expect(within(dialog("Verify payment")).getByText("This reference was already used by another payment. Check the bank statement before verifying.")).toBeInTheDocument();
  });

  it("does not warn when the only other claim with that reference was rejected", () => {
    open([], [claim, { ...claim, id: "clm_0", status: "Rejected", rejectReason: "Not received" }]);
    expect(screen.queryByText("Reference already used")).not.toBeInTheDocument();
  });

  it("rejects only with a reason", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const d = dialog("Reject reported payment");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(within(d).getByText("Please enter at least 5 characters.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(field("Note to the parent", d), "No credit with this UTR on 2 Nov");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(getRow("fee_claims", "clm_1")).toMatchObject({ status: "Rejected", rejectReason: "No credit with this UTR on 2 Nov" });
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });

  it("saves the account shown to parents on school/school (merge, works before the doc exists)", async () => {
    const { user } = open();
    await user.click(screen.getByRole("button", { name: /Edit/ }));
    const d = dialog("Account shown to parents");
    await user.type(field("IFSC", d), "sbin1");
    await user.type(field("Account number", d), "1234567890");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("The IFSC should look like SBIN0001234.");
    expect(writes).toHaveLength(0);
    await user.clear(field("IFSC", d));
    await user.type(field("IFSC", d), "SBIN0001234");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("school", "school")).toMatchObject({ bank: { accountNo: "1234567890", ifsc: "SBIN0001234" } });
  });
});
