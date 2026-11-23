import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { failNextWrite, getRow, rowsOf, seed, writes } from "@/test/render";
import { annualStudentFees, invoicePreview } from "@/features/people/studentAnnualFees";
import { studentFeePlan } from "@/features/people/studentFees";
import { generateStudentInvoice, type StudentInvoiceRequest, type StudentInvoiceSource } from "./studentInvoiceService";
import type { Student } from "@/features/people/StudentsView";
import type { Concession } from "./types";

const student: Student = { id: "s1", name: "Student One", grn: "G1", grade: "5", section: "A", guardian: "Parent", phone: "", status: "Active", attendance: 0, admissionDate: "2026-06-01" };
const source: StudentInvoiceSource = { student, academicYear: "2026-27", terms: [{ id: "t1", start: "2026-06-01", end: "2027-03-31" }], invoices: [],
  structure: { id: "f5", grade: "5", schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, tuition: 0, lab: 0, activity: 0, library: 0, transport: 0,
    items: [{ id: "tuition", name: "Tuition", amount: 1000, frequency: "Term-wise", grades: ["5"], mandatory: true, newStudentsOnly: false, dueDate: "" }] },
  concessions: [{ id: "c1", grn: "G1", student: student.name, grade: "5", type: "Other", amount: 600, requested: "2026-07-01", status: "Approved", approvedBy: "Admin" }],
};
function request(current = source, quantity = 1, period = "Term 1"): StudentInvoiceRequest {
  const annual = annualStudentFees({ ...studentFeePlan(current.student, [current.structure], current.academicYear), terms: current.terms, admissionDate: student.admissionDate, invoices: current.invoices, concessions: current.concessions, transportAmount: null });
  const choices = [{ feeItemId: "tuition", quantity }];
  return { source: current, choices, period, due: "2099-01-01", preview: invoicePreview(annual.charges, choices, annual.concessions) };
}
beforeEach(() => {
  vi.stubGlobal("crypto", webcrypto);
  seed({ students: [student], school: [{ id: "school", academicYear: "2026-27" }], fee_structure: [source.structure], set_terms: source.terms, fee_concessions: source.concessions });
});

describe("student invoice transaction", () => {
  it("atomically saves the invoice, numbering, billed quantities and concession allocation", async () => {
    const invoice = await generateStudentInvoice(request());
    expect(invoice).toMatchObject({ no: "INV-ST-2026-27-000001", studentId: "s1", amount: 400, paid: 0, balance: 400, grossAmount: 1000, concessionAmount: 600 });
    expect(invoice.lines.reduce((sum, row) => sum + row.amount, 0)).toBe(invoice.amount);
    expect(getRow("fee_student_billing", "s1_2026-27")?.quantities).toEqual({ tuition: 1 });
    expect((getRow("fee_concessions", "c1")?.invoiceApplications as unknown[])).toHaveLength(1);
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });
  it("returns the saved invoice after an identical retry; a changed request cannot duplicate its period", async () => {
    const draft = request(); const one = await generateStudentInvoice(draft); const count = writes.length;
    expect((await generateStudentInvoice(draft)).id).toBe(one.id);
    expect(writes).toHaveLength(count);
    await expect(generateStudentInvoice({ ...draft, due: "2099-02-01" })).rejects.toThrow(/already exists/);
    expect(rowsOf("fee_invoices")).toHaveLength(1);
  });
  it("does not apply the concession again to the next collection or rebill exhausted annual quantities", async () => {
    const first = await generateStudentInvoice(request());
    const current = { ...source, invoices: [first], concessions: rowsOf("fee_concessions") as Concession[] };
    const second = await generateStudentInvoice(request(current, 1, "Term 2"));
    expect(second).toMatchObject({ amount: 1000, concessionAmount: 0, no: "INV-ST-2026-27-000002" });
    await expect(generateStudentInvoice(request(source, 1, "Term 3"))).rejects.toThrow(/remaining/);
    expect(rowsOf("fee_invoices")).toHaveLength(2);
  });
  it("rejects a stale concession preview and a changed fee plan without writing", async () => {
    seed({ fee_concessions: [{ ...source.concessions[0], amount: 100 }] });
    await expect(generateStudentInvoice(request())).rejects.toThrow(/changed/);
    expect(writes).toHaveLength(0);
    seed({ fee_structure: [{ ...source.structure, termsPerYear: 3 }] });
    await expect(generateStudentInvoice(request())).rejects.toThrow(/settings changed/);
    expect(writes).toHaveLength(0);
  });
  it("rejects removed students and past due dates, preserving historical records", async () => {
    seed({ students: [{ ...student, deleted: true }] });
    await expect(generateStudentInvoice(request())).rejects.toThrow(/active students/);
    await expect(generateStudentInvoice({ ...request(), due: "2000-01-01" })).rejects.toThrow(/due date/);
    expect(writes).toHaveLength(0);
  });
  it("rolls back all changes when the transaction fails", async () => {
    failNextWrite(new Error("permission-denied"));
    await expect(generateStudentInvoice(request())).rejects.toThrow();
    expect(rowsOf("fee_invoices")).toHaveLength(0);
    expect(rowsOf("fee_invoice_sequences")).toHaveLength(0);
    expect(rowsOf("fee_student_billing")).toHaveLength(0);
    expect(getRow("fee_concessions", "c1")?.invoiceApplications).toBeUndefined();
  });
  it("supports fully waived invoices without manufacturing payment receipts", async () => {
    const current = { ...source, concessions: [{ ...source.concessions[0], amount: 1000 }] };
    seed({ fee_concessions: current.concessions });
    expect(await generateStudentInvoice(request(current))).toMatchObject({ amount: 0, status: "Paid", paid: 0 });
    expect(rowsOf("fee_payments")).toHaveLength(0);
  });
});
