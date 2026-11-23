import { describe, expect, it } from "vitest";
import { studentFeePlan, studentFeeRecords } from "./studentFees";
import type { Concession, Invoice, Payment, Structure } from "@/features/fees/types";

const student = { id: "student", grn: "GRN-1", grade: "5" };
const invoice = (patch: Partial<Invoice> = {}): Invoice => ({ id: "invoice", no: "INV-1", student: "Same Name", grn: "GRN-1", grade: "5", section: "A", guardian: "Parent", phone: "", term: "Term 1", issued: "2026-06-01", due: "2026-07-01", amount: 100, paid: 20, balance: 80, status: "Partial", lines: [], ...patch });
const payment = (patch: Partial<Payment> = {}): Payment => ({ id: "payment", receiptNo: "RCP-1", invoiceId: "invoice", invoiceNo: "INV-1", student: "Same Name", grn: "GRN-1", grade: "5", amount: 20, mode: "Cash", date: "2026-06-03", by: "Admin", ...patch });
const concession = (patch: Partial<Concession> = {}): Concession => ({ id: "concession", student: "Same Name", grn: "GRN-1", grade: "5", type: "Other", amount: 10, status: "Approved", requested: "2026-06-02", approvedBy: "Admin", ...patch });

describe("student financial records", () => {
  it("uses invoice ownership before GRN, includes linked receipts after a GRN change, and keeps concessions separate", () => {
    const own = invoice({ studentId: student.id, grn: "OLD-GRN" });
    const foreign = invoice({ id: "foreign", studentId: "other" });
    const result = studentFeeRecords(student, [student, { ...student, id: "other", grn: "GRN-2" }], [own, foreign], [
      payment({ grn: "OLD-GRN" }), payment({ id: "foreign", invoiceId: "foreign" }),
      payment({ id: "orphan", invoiceId: "removed-invoice", date: "2026-07-01" }),
    ], [concession(), concession({ id: "pending", amount: 30, status: "Pending" })]);
    expect(result.invoices.map((row) => row.id)).toEqual(["invoice"]);
    expect(result.payments.map((row) => row.id)).toEqual(["orphan", "payment"]);
    expect(result).toMatchObject({ billed: 100, paid: 20, outstanding: 80, approvedConcessions: 10 });
  });

  it("never assigns legacy money by name or by an ambiguous GRN", () => {
    const result = studentFeeRecords(student, [student, { ...student, id: "duplicate" }], [invoice(), invoice({ id: "stable", studentId: student.id })], [payment(), payment({ id: "stable-payment", invoiceId: "stable" })], [concession()]);
    expect(result.uniqueGrn).toBe(false);
    expect(result.invoices.map((row) => row.id)).toEqual(["stable"]);
    expect(result.payments.map((row) => row.id)).toEqual(["stable-payment"]);
    expect(result.concessions).toEqual([]);
  });

  it("matches case-insensitive legacy GRNs and sums paise accurately", () => {
    const result = studentFeeRecords(student, [student], [invoice({ id: "a", grn: " grn-1 ", amount: 0.1, paid: 0.1, balance: 0 }), invoice({ id: "b", amount: 0.2, paid: 0.2, balance: 0 })], [], []);
    expect(result).toMatchObject({ billed: 0.3, paid: 0.3, outstanding: 0 });
  });

  it("chooses the correct stream and academic year, excluding old bus-wide fee items", () => {
    const item = { id: "tuition", name: "Tuition", amount: 2000, grades: ["11:science"], frequency: "Monthly" as const, dueDate: "", mandatory: true, newStudentsOnly: false };
    const base: Structure = { id: "science", grade: "11", streamId: "science", academicYear: "2026-27", schemaVersion: 2, tuition: 0, lab: 0, activity: 0, library: 0, transport: 0, items: [item, { ...item, id: "transport", name: "Transport" }] };
    const result = studentFeePlan({ ...student, grade: "11", streamId: "science" }, [{ ...base, id: "old", academicYear: "2025-26" }, { ...base, id: "commerce", streamId: "commerce" }, base], "2026-27");
    expect(result.items.map((row) => row.name)).toEqual(["Tuition"]);
    expect(studentFeePlan({ ...student, grade: "11", streamId: "science" }, [base], "2027-28").items).toEqual([]);
    expect(studentFeePlan({ ...student, grade: "11" }, [base], "2026-27").items).toEqual([]);
  });
});
