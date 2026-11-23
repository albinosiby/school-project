import { describe, expect, it } from "vitest";
import { studentDues } from "./studentDues";
import type { Student } from "@/features/people/StudentsView";
import type { Invoice, Structure } from "./types";

const student: Student = { id: "s1", name: "Child One", grn: "G1", grade: "LKG", section: "A", guardian: "Parent One", phone: "9000000000", status: "Active", attendance: 0 };
const structure: Structure = { id: "f1", grade: "LKG", academicYear: "2026-27", schemaVersion: 2, termsPerYear: 2, tuition: 0, lab: 0, library: 0, activity: 0, transport: 0,
  items: [{ id: "tuition", name: "Tuition", amount: 1000, frequency: "Term-wise", grades: ["LKG"], dueDate: "", mandatory: true, newStudentsOnly: false }] };
const base = { students: [student], structures: [structure], invoices: [], payments: [], concessions: [], academicYear: "2026-27", terms: [{ id: "t1", start: "2026-06-01", end: "2027-03-31" }], admissions: [], transportFees: [] };
const invoice: Invoice = { id: "i1", studentId: "s1", student: student.name, grn: student.grn, grade: "LKG", section: "A", guardian: student.guardian, phone: student.phone, no: "INV-1", term: "2026-27 · Term 1", issued: "2026-07-01", due: "2026-08-01", amount: 1000, paid: 300, balance: 700, status: "Partial", lines: [{ feeItemId: "tuition", label: "Tuition", quantity: 1, unitAmount: 1000, amount: 1000 }] };

describe("student dues directory calculation", () => {
  it("includes full-year balances before any invoice exists", () => {
    expect(studentDues(base)[0]).toMatchObject({ remaining: 2000, complete: true, settled: false });
  });
  it("deducts concessions and payments once, without adding issued balances to annual dues again", () => {
    const row = studentDues({ ...base, invoices: [invoice], concessions: [{ id: "c1", student: student.name, grn: student.grn, grade: "LKG", type: "Other", amount: 100, status: "Approved", requested: "2026-07-01", approvedBy: "Admin" }] })[0];
    expect(row.remaining).toBe(1600); expect(row.records.outstanding).toBe(700);
  });
  it("uses admission date fallback and school transport frequency", () => {
    const rows = studentDues({ ...base, students: [{ ...student, busId: "bus", busAssignmentRevision: 0 }], structures: [{ ...structure, items: [...structure.items!, { ...structure.items![0], id: "admission", name: "Admission", frequency: "One-time", newStudentsOnly: true }] }], admissions: [{ id: "s1", admissionDate: "2026-06-01" }],
      transportFees: [{ id: "s1", studentId: "s1", busId: "bus", busAssignmentRevision: 0, revision: 0, amount: 200 }], transportFrequency: "Quarterly" });
    expect(rows[0].remaining).toBe(3800); expect(rows[0].complete).toBe(true);
  });
  it("retains ambiguous identities for safe legacy matching and excludes removed students from the list", () => {
    const rows = studentDues({ ...base, students: [student, { ...student, id: "removed", deleted: true }], invoices: [invoice, { ...invoice, id: "legacy", studentId: undefined, paid: 900 }], concessions: [{ id: "c1", student: student.name, grn: student.grn, grade: "LKG", type: "Other", amount: 100, status: "Approved", requested: "2026-07-01", approvedBy: "Admin" }] });
    expect(rows).toHaveLength(1); expect(rows[0].records.invoices).toHaveLength(1); expect(rows[0].records.concessions).toHaveLength(0); expect(rows[0].remaining).toBe(1700);
  });
  it("marks missing configuration instead of declaring a student settled, while retaining known invoice debt", () => {
    const row = studentDues({ ...base, structures: [], invoices: [invoice] })[0];
    expect(row).toMatchObject({ complete: false, settled: false, remaining: 700 });
    expect(studentDues({ ...base, structures: [] })[0]).toMatchObject({ complete: false, settled: false });
  });
  it("retains only billed debt for inactive enrolments and classifies fully paid active students as settled", () => {
    expect(studentDues({ ...base, students: [{ ...student, status: "Transferred" }], invoices: [invoice] })[0].remaining).toBe(700);
    expect(studentDues({ ...base, invoices: [{ ...invoice, amount: 2000, paid: 2000, balance: 0, lines: [{ ...invoice.lines[0], quantity: 2, amount: 2000 }] }] })[0].settled).toBe(true);
  });
});
