import { describe, expect, it } from "vitest";
import {
  applyPayment, balanceOf, duplicateReference, invoiceErrors, invoiceStatus, localDay, nextInvoiceNos, nextReceiptNo, normRef, paymentAmountError,
  paymentMode, paymentRef, reminderDoc, remindable, round2, shownStatus,
} from "./logic";
import type { Invoice } from "./types";

const inv = (p: Partial<Invoice> = {}): Invoice => ({
  id: "inv_1", no: "INV-2026-0841", student: "Aarav Sharma", grade: "10", section: "B", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "+91 98100 00001",
  term: "Term 2", issued: "2026-10-01", due: "2026-11-15", amount: 42000, paid: 0, balance: 42000, status: "Pending", lines: [], ...p,
});

describe("balance and status", () => {
  it("rounds to paise", () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(1.005)).toBe(1.01);
    expect(round2(42000)).toBe(42000);
  });
  it("uses the stored balance, else amount − paid, never below 0", () => {
    expect(balanceOf({ amount: 100, paid: 30, balance: 70 })).toBe(70);
    expect(balanceOf({ amount: 100, paid: 30 })).toBe(70);
    expect(balanceOf({ amount: 100, paid: 130 })).toBe(0);
    expect(balanceOf({ amount: 100, paid: 0, balance: Number.NaN })).toBe(100);
  });
  it("derives Paid / Partial / Pending / Overdue from money and the due date", () => {
    expect(invoiceStatus({ amount: 100, paid: 100, balance: 0, due: "2026-01-01" }, "2026-11-03")).toBe("Paid");
    expect(invoiceStatus({ amount: 100, paid: 0, balance: 100, due: "2026-11-15" }, "2026-11-03")).toBe("Pending");
    expect(invoiceStatus({ amount: 100, paid: 40, balance: 60, due: "2026-11-15" }, "2026-11-03")).toBe("Partial");
    expect(invoiceStatus({ amount: 100, paid: 40, balance: 60, due: "2026-11-02" }, "2026-11-03")).toBe("Overdue");
    expect(invoiceStatus({ amount: 100, paid: 0, balance: 100, due: "2026-11-02" }, "2026-11-03")).toBe("Overdue");
    // due today is not overdue yet
    expect(invoiceStatus({ amount: 100, paid: 0, balance: 100, due: "2026-11-03" }, "2026-11-03")).toBe("Pending");
    // unknown today: never Overdue by date
    expect(invoiceStatus({ amount: 100, paid: 0, balance: 100, due: "2020-01-01" }, "")).toBe("Pending");
  });
  it("shows the derived status, or the stored one before today is known", () => {
    expect(shownStatus(inv({ status: "Pending", due: "2026-10-31" }), "2026-11-03")).toBe("Overdue");
    expect(shownStatus(inv({ status: "Overdue", due: "2026-10-31" }), "")).toBe("Overdue");
  });
});

describe("payments", () => {
  it("accepts 0 < amount ≤ balance and refuses the rest", () => {
    expect(paymentAmountError(100, 100)).toBe("");
    expect(paymentAmountError(0.5, 100)).toBe("");
    expect(paymentAmountError(0, 100)).toBe("Enter an amount above ₹0");
    expect(paymentAmountError(-5, 100)).toBe("Enter an amount above ₹0");
    expect(paymentAmountError(Number.NaN, 100)).toBe("Enter an amount above ₹0");
    expect(paymentAmountError(100.01, 100)).toBe("Amount exceeds the due balance of ₹100");
    expect(paymentAmountError(50000, 42000)).toBe("Amount exceeds the due balance of ₹42,000");
    expect(paymentAmountError(10, 0)).toBe("This invoice is already settled");
  });
  it("applies a part payment, then the rest, keeping paise exact", () => {
    const a = applyPayment(inv(), 12000, "2026-11-03");
    expect(a).toEqual({ paid: 12000, balance: 30000, status: "Partial" });
    const b = applyPayment(inv({ ...a }), 30000, "2026-11-03");
    expect(b).toEqual({ paid: 42000, balance: 0, status: "Paid" });
    const c = applyPayment(inv({ amount: 100.3, balance: 100.3 }), 100.1, "2026-11-03");
    expect(c.balance).toBe(0.2);
  });
  it("keeps an overdue invoice Overdue after a part payment", () => {
    expect(applyPayment(inv({ due: "2026-10-31", status: "Overdue" }), 2000, "2026-11-03").status).toBe("Overdue");
  });
  it("refuses an over-payment", () => {
    expect(() => applyPayment(inv({ balance: 500, paid: 41500 }), 501, "2026-11-03")).toThrow("Amount exceeds the due balance of ₹500");
  });
});

describe("numbering", () => {
  it("continues after the highest receipt number (gaps and odd prefixes allowed)", () => {
    expect(nextReceiptNo([])).toBe("RCP-20401");
    expect(nextReceiptNo([{ receiptNo: "RCP-20410" }, { receiptNo: "RCP-20402" }])).toBe("RCP-20411");
    expect(nextReceiptNo([{ receiptNo: "RCPT-SYNC-1" }, { receiptNo: "" }, { receiptNo: undefined as unknown as string }])).toBe("RCP-20401");
    expect(nextReceiptNo([{ receiptNo: "RCP-30000" }])).toBe("RCP-30001");
  });
  it("numbers invoices after the highest on file", () => {
    expect(nextInvoiceNos([], 2, "2026")).toEqual(["INV-2026-0841", "INV-2026-0842"]);
    expect(nextInvoiceNos([{ no: "INV-2026-1347" }, { no: "INV-1001" }], 1, "2027")).toEqual(["INV-2027-1348"]);
  });
});

describe("references", () => {
  it("writes the mode as {mode} · {REFERENCE} for non-cash", () => {
    expect(paymentMode("UPI QR", " utr 1234 ")).toBe("UPI QR · UTR1234");
    expect(paymentMode("Cash")).toBe("Cash");
    expect(normRef(" ab 12 ")).toBe("AB12");
    expect(paymentRef({ mode: "UPI · UTR998877" })).toBe("UTR998877");
    expect(paymentRef({ mode: "NEFT / IMPS / RTGS · N123 · X" })).toBe("N123·X");
    expect(paymentRef({ mode: "Cash", reference: "slip9" })).toBe("SLIP9");
    expect(paymentRef({ mode: "Card" })).toBe("");
  });
  it("flags a reference already used by another live claim or a recorded payment", () => {
    const c = { id: "c1", reference: "utr998877", status: "Pending" };
    expect(duplicateReference(c, [c, { id: "c2", reference: "UTR998877", status: "Pending" }], [])).toEqual({ kind: "claim", id: "c2" });
    expect(duplicateReference(c, [c, { id: "c2", reference: "UTR998877", status: "Rejected" }], [])).toBeNull();
    expect(duplicateReference(c, [c], [{ id: "p1", mode: "UPI · UTR998877", receiptNo: "RCP-20401" }])).toEqual({ kind: "payment", id: "p1", receiptNo: "RCP-20401" });
    // a reference that only contains the claim's reference is not a duplicate
    expect(duplicateReference(c, [c], [{ id: "p1", mode: "UPI · UTR9988770", receiptNo: "RCP-20401" }])).toBeNull();
    // the payment made from this very claim does not count
    expect(duplicateReference({ ...c, paymentId: "p1" }, [c], [{ id: "p1", mode: "UPI · UTR998877", receiptNo: "RCP-20401" }])).toBeNull();
    expect(duplicateReference({ id: "c3", reference: " ", status: "Pending" }, [{ id: "c4", reference: "", status: "Pending" }], [])).toBeNull();
  });
});

describe("reminders", () => {
  it("skips settled invoices and those already reminded today", () => {
    const a = inv({ id: "a" }), b = inv({ id: "b", balance: 0, paid: 42000, status: "Paid" }), c = inv({ id: "c" });
    const sentToday = new Date(2026, 10, 3, 9, 0).toISOString(), sentYesterday = new Date(2026, 10, 2, 9, 0).toISOString();
    const r = remindable([a, b, c], [{ invoiceId: "c", sentAt: sentToday }, { invoiceId: "a", sentAt: sentYesterday }], "2026-11-03");
    expect(r.due.map((i) => i.id)).toEqual(["a"]);
    expect(r.already.map((i) => i.id)).toEqual(["c"]);
    expect(localDay("not a date")).toBe("");
  });
  it("writes the fee_reminders row the reminder push reads", () => {
    const d = reminderDoc(inv({ balance: 30000, paid: 12000 }), "2026-11-03T04:00:00.000Z", () => "15 Nov 2026");
    expect(d).toEqual({
      invoiceId: "inv_1", invoiceNo: "INV-2026-0841", student: "Aarav Sharma", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "+91 98100 00001",
      channel: "Parent app", amount: 30000, due: "2026-11-15", sentAt: "2026-11-03T04:00:00.000Z",
      message: "Dear Mr. Rahul Sharma, fee of ₹30,000 for Aarav Sharma (INV-2026-0841) is due on 15 Nov 2026.",
    });
    expect(reminderDoc(inv({ guardian: "", due: "" }), "x", () => "").message).toBe("Dear Parent, fee of ₹42,000 for Aarav Sharma (INV-2026-0841) is due on the due date.");
  });
});

describe("invoice form", () => {
  const ok = { studentId: "stu_1", term: "Term 2", head: "Tuition Fee", amount: "5000", due: "2026-11-30" };
  it("accepts a complete invoice", () => expect(invoiceErrors(ok, "2026-11-03")).toEqual({}));
  it("requires student, fee head, a whole amount above 0 and a due date not in the past", () => {
    expect(invoiceErrors({ ...ok, studentId: "", head: " ", amount: "", due: "" }, "2026-11-03")).toEqual({
      studentId: "Choose a student", head: "Enter the fee head", amount: "Enter a whole rupee amount above 0", due: "Pick the due date",
    });
    expect(invoiceErrors({ ...ok, amount: "0" }, "2026-11-03").amount).toBe("Enter a whole rupee amount above 0");
    expect(invoiceErrors({ ...ok, amount: "-10" }, "2026-11-03").amount).toBe("Enter a whole rupee amount above 0");
    expect(invoiceErrors({ ...ok, amount: "12.5" }, "2026-11-03").amount).toBe("Enter a whole rupee amount above 0");
    expect(invoiceErrors({ ...ok, due: "2026-11-02" }, "2026-11-03").due).toBe("The due date cannot be before today");
    expect(invoiceErrors({ ...ok, due: "2026-11-03" }, "2026-11-03")).toEqual({});
  });
});
