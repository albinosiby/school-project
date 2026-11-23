import { describe, expect, it } from "vitest";
import { annualStudentFees, invoicePreview, type AnnualInput } from "./studentAnnualFees";
import type { FeeItem } from "@/features/fees/feePlan";
import type { Concession, Invoice } from "@/features/fees/types";

const fee = (id: string, frequency: FeeItem["frequency"], amount = 100): FeeItem => ({ id, name: id, amount, frequency, grades: ["5"], dueDate: "", mandatory: true, newStudentsOnly: false });
const concession = (amount = 50): Concession => ({ id: "c", student: "Student", grn: "G", grade: "5", type: "Other", amount, requested: "2026-07-01", status: "Approved", approvedBy: "Admin" });
const bill = (patch: Partial<Invoice> = {}): Invoice => ({ id: "i", no: "INV-1", student: "Student", grn: "G", grade: "5", section: "A", guardian: "Parent", phone: "", term: "2026-27 · Term 1", issued: "2026-07-01", due: "2026-08-01", amount: 100, paid: 0, balance: 100, status: "Pending", lines: [{ label: "Tuition", amount: 100 }], ...patch });
const base: AnnualInput = { academicYear: "2026-27", terms: [{ id: "t1", start: "2026-06-01", end: "2026-12-01" }, { id: "t2", start: "2026-12-02", end: "2027-03-31" }], termsPerYear: 2,
  items: [fee("Tuition", "Term-wise")], invoices: [], concessions: [], transportAmount: null, admissionDate: "2026-06-01" };

describe("annual student fees", () => {
  it("includes every scheduled collection plus one-time charges before any invoice exists", () => {
    const assessment = annualStudentFees({ ...base, items: [fee("Monthly", "Monthly"), fee("Quarterly", "Quarterly"), fee("Half-yearly", "Half-yearly"), fee("Terms", "Term-wise"), fee("Annual", "Annual"), fee("Admission", "One-time")] });
    expect(assessment).toMatchObject({ complete: true, gross: 2200, payable: 2200 });
    expect(assessment.charges.map((row) => row.quantity)).toEqual([12, 4, 2, 2, 1, 1]);
  });
  it("subtracts only current-year approved concessions and actual payments, not billed amounts", () => {
    const assessment = annualStudentFees({ ...base, invoices: [bill({ paid: 20 }), bill({ id: "old", academicYear: "2025-26", paid: 1000 })],
      concessions: [concession(), { ...concession(200), id: "pending", status: "Pending" }, { ...concession(200), id: "old", requested: "2025-06-01" }] });
    expect(assessment).toMatchObject({ gross: 200, net: 150, paid: 20, payable: 130, used: { Tuition: 1 } });
    expect(assessment.charges[0].remaining).toBe(1);
  });
  it("handles admission eligibility and requires missing dates instead of inventing a total", () => {
    const items = [{ ...fee("Admission", "One-time"), newStudentsOnly: true }, fee("Tuition", "Annual")];
    expect(annualStudentFees({ ...base, items }).gross).toBe(200);
    expect(annualStudentFees({ ...base, items, admissionDate: "2025-06-01" }).gross).toBe(100);
    expect(annualStudentFees({ ...base, items, admissionDate: undefined }).complete).toBe(false);
    expect(annualStudentFees({ ...base, terms: [] }).complete).toBe(false);
    expect(annualStudentFees({ ...base, invoices: [bill({ lines: [] })] }).complete).toBe(false);
  });
  it("uses the student's transport amount with the school frequency, includes optional fees only after billing", () => {
    const items = [fee("Tuition", "Annual"), { ...fee("Trip", "One-time", 40), mandatory: false }];
    const assessment = annualStudentFees({ ...base, items, busId: "bus", transportAmount: 25, transportFrequency: "Quarterly", invoices: [bill({ lines: [{ label: "Trip", amount: 40 }], amount: 40 })] });
    expect(assessment.gross).toBe(240);
    expect(assessment.charges.map((row) => [row.id, row.mandatory, row.preselect])).toEqual([["Tuition", true, true], ["Trip", false, false], ["student_transport", true, false]]);
    expect(annualStudentFees({ ...base, busId: "bus" }).complete).toBe(false);
  });
  it("does not rebill one-time fees paid in a prior year", () => {
    const assessment = annualStudentFees({ ...base, items: [fee("Registration", "One-time"), fee("Tuition", "Annual")], invoices: [bill({ academicYear: "2025-26", lines: [{ label: "Registration", amount: 100 }] })] });
    expect(assessment.gross).toBe(100);
    expect(assessment.charges[0].remaining).toBe(0);
  });
  it("caps waivers at charges and never shows a negative payable", () => {
    expect(annualStudentFees({ ...base, concessions: [concession(500)] })).toMatchObject({ concessionsTotal: 200, payable: 0, net: 0 });
  });
  it("allocates unused concession amounts once, validates quantities and duplicate selections", () => {
    const { charges } = annualStudentFees(base);
    expect(invoicePreview(charges, [{ feeItemId: "Tuition", quantity: 1 }], [{ ...concession(150), invoiceApplications: [{ invoiceId: "previous", academicYear: "2026-27", amount: 100 }] }])).toMatchObject({ gross: 100, discount: 50, amount: 50 });
    expect(() => invoicePreview(charges, [{ feeItemId: "Tuition", quantity: 3 }], [])).toThrow(/remaining/);
    expect(() => invoicePreview(charges, [{ feeItemId: "Tuition", quantity: 1 }, { feeItemId: "Tuition", quantity: 1 }], [])).toThrow(/remaining/);
  });
});
