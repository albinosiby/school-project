import { describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import * as collections from "@/lib/useCollection";
import { authState, dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";
import { StudentFeesPanel } from "./StudentFeesPanel";
import type { Student } from "./StudentsView";

const student: Student = { id: "student", name: "Student One", grn: "GRN-1", grade: "5", section: "A", guardian: "Parent", phone: "", status: "Active", attendance: 0, busId: "bus", busAssignmentRevision: 0 };
const invoice = { id: "invoice", no: "INV-1", studentId: student.id, student: student.name, grn: student.grn, grade: "5", section: "A", guardian: "Parent", phone: "", term: "Term 1", issued: "2026-06-01", due: "2026-07-01", amount: 1000, paid: 400, balance: 600, status: "Partial", lines: [{ label: "Tuition", amount: 1000 }] };
const payment = { id: "payment", receiptNo: "RCP-1", invoiceId: "invoice", invoiceNo: "INV-1", student: student.name, grn: student.grn, grade: "5", amount: 400, mode: "UPI QR · REF1234", date: "2026-06-10", by: "School admin" };
const readCollection = collections.useCollection;

function simulateRead(error = false) {
  const reload = vi.fn();
  vi.spyOn(collections, "useCollection").mockImplementation(function<T extends { id: string }>(name: string, enabled = true, filters: readonly collections.CollectionFilter[] = []) {
    const source = readCollection<T>(name, enabled, filters);
    return name === "fee_invoices" ? { ...source, ready: false, error: error ? { collection: name, code: "unavailable", message: "Offline" } : undefined, reload } : source;
  });
  return reload;
}

describe("student fees and payment history", () => {
  it("collects only against this student's invoices and immediately opens the saved receipt", async () => {
    seed({ students: [student], fee_invoices: [invoice, { ...invoice, id: "other-invoice", no: "INV-OTHER", studentId: "other", grn: "OTHER", student: "Other Student" }] });
    const { user } = renderUI(<StudentFeesPanel student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Collect payment" }));
    expect(within(dialog("Collect payment")).queryByRole("option", { name: /INV-OTHER/ })).not.toBeInTheDocument();
    await user.clear(field("Amount collected (₹)")); await user.type(field("Amount collected (₹)"), "600");
    await user.click(screen.getByRole("button", { name: "Save & issue receipt" }));
    expect(await screen.findByRole("dialog", { name: "Fee Receipt" })).toHaveTextContent("₹600");
    expect(getRow("fee_invoices", "invoice")).toMatchObject({ paid: 1000, balance: 0, status: "Paid" });
    expect(getRow("fee_invoices", "other-invoice")).toMatchObject({ paid: 400, balance: 600 });
    expect(rowsOf("fee_payments")).toHaveLength(1);
  });

  it("offers status control for an active record and hides all mutations for removed students with history", async () => {
    seed({ fee_invoices: [invoice] });
    const { user, unmount } = renderUI(<StudentFeesPanel student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Change status for INV-1" }));
    await user.selectOptions(field("Invoice status"), "Paid");
    await user.click(screen.getByRole("button", { name: "Continue to collect payment" }));
    expect(dialog("Collect payment")).toBeInTheDocument();
    unmount();
    renderUI(<StudentFeesPanel student={{ ...student, deleted: true }} students={[student]} />);
    expect(screen.queryByRole("button", { name: /Collect|Change status|Generate invoice/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View invoice INV-1" })).toBeInTheDocument();
  });
  it("shows configured charges, saved balances and concessions separately, and opens printable receipts without writes", async () => {
    seed({ students: [student], school: [{ id: "school", name: "Example School", academicYear: "2026-27" }], set_terms: [{ id: "t1", start: "2026-06-01", end: "2026-12-01" }, { id: "t2", start: "2026-12-02", end: "2027-03-31" }], fee_invoices: [invoice], fee_payments: [payment],
      fee_concessions: [{ id: "concession", student: student.name, grn: student.grn, grade: "5", type: "Other", amount: 100, status: "Approved", requested: "2026-06-01" }],
      fee_structure: [{ id: "grade5", grade: "5", schemaVersion: 2, academicYear: "2026-27", items: [{ id: "tuition", name: "Tuition", amount: 1000, grades: ["5"], frequency: "Term-wise", mandatory: true, newStudentsOnly: false }] }],
      student_transport_fees: [{ id: student.id, studentId: student.id, busId: "bus", amount: 200, busAssignmentRevision: 0 }], set_config: [{ id: "fee_policy", transportFrequency: "Annual" }],
    });
    const { user } = renderUI(<StudentFeesPanel student={student} students={[student]} />);
    for (const [label, value] of [["Total billed", "₹1,000"], ["Total paid", "₹400"], ["Outstanding balance", "₹600"], ["Approved concessions", "₹100"]]) {
      expect(within(screen.getByText(label!).parentElement!).getByText(value!)).toBeInTheDocument();
    }
    expect(screen.getByText("Term-wise")).toBeInTheDocument();
    expect(screen.getByText("Annual")).toBeInTheDocument();
    expect(screen.getByText("REF1234")).toBeInTheDocument();
    expect(screen.getByText("₹1,700")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generate invoice" }));
    const preview = dialog("Generate student invoice");
    expect(within(preview).getByText(/Transport is not ticked by default/)).toBeInTheDocument();
    const transport = within(preview).getByRole("checkbox", { name: /Transport/ });
    expect(transport).not.toBeChecked();
    expect(within(preview).getByText("₹900")).toBeInTheDocument();
    await user.click(transport);
    expect(within(preview).getByText("₹1,100")).toBeInTheDocument();
    await user.click(within(preview).getByRole("button", { name: "Cancel" }));
    await user.click(screen.getByRole("button", { name: "View receipt RCP-1" }));
    const receipt = dialog("Fee Receipt");
    expect(within(receipt).getByText(student.name)).toBeInTheDocument();
    expect(within(receipt).getByText("Example School")).toBeInTheDocument();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(within(receipt).getByRole("button", { name: "Print Receipt" }));
    expect(print).toHaveBeenCalledOnce();
    expect(writes).toHaveLength(0);
  });

  it("generates through the preview and exposes saved invoice PDF and print actions", async () => {
    vi.stubGlobal("crypto", webcrypto);
    const active = { ...student, busId: "" };
    seed({ students: [active], school: [{ id: "school", name: "Example School", academicYear: "2026-27" }],
      set_terms: [{ id: "t1", start: "2026-06-01", end: "2027-03-31" }],
      fee_structure: [{ id: "f5", grade: "5", schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, items: [{ id: "tuition", name: "Tuition", amount: 1000, grades: ["5"], frequency: "Term-wise", mandatory: true, newStudentsOnly: false }] }],
    });
    const { user } = renderUI(<StudentFeesPanel student={active} students={[active]} />);
    expect(screen.getByText("₹2,000", { selector: "p" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Generate invoice" }));
    await user.click(within(dialog("Generate student invoice")).getByRole("button", { name: "Create invoice" }));
    const saved = await screen.findByRole("dialog", { name: "Student invoice" });
    expect(within(saved).getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(within(saved).getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();
  });

  it("shows explicit empty history and zero recorded totals for a removed student", () => {
    seed({ school: [{ id: "school", academicYear: "2026-27" }] });
    renderUI(<StudentFeesPanel student={{ ...student, deleted: true }} students={[student]} />);
    expect(screen.getByRole("heading", { name: "Payment history" })).toBeInTheDocument();
    expect(screen.getByText("No invoices recorded")).toBeInTheDocument();
    expect(screen.getByText("No payments recorded")).toBeInTheDocument();
    expect(within(screen.getByText("Outstanding balance").parentElement!).getByText("₹0")).toBeInTheDocument();
    expect(screen.getByText("Amount not configured")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Record|Collect|Generate/ })).not.toBeInTheDocument();
  });

  it("shows shimmer while reading instead of premature zero balances", () => {
    simulateRead();
    renderUI(<StudentFeesPanel student={student} students={[student]} />);
    expect(screen.getByRole("status", { name: "Loading student fees and payment history…" })).toBeInTheDocument();
    expect(screen.queryByText("Total billed")).not.toBeInTheDocument();
  });

  it("offers a retry after a failed read without displaying incomplete totals", async () => {
    const reload = simulateRead(true);
    const { user } = renderUI(<StudentFeesPanel student={student} students={[student]} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not load");
    expect(screen.queryByText("Total billed")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Retry fee records" }));
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not expose the admin fee section to staff accounts", () => {
    authState.user = { ...authState.user!, role: "staff" };
    renderUI(<StudentFeesPanel student={student} students={[student]} />);
    expect(screen.queryByText("Fees")).not.toBeInTheDocument();
    expect(screen.queryByText("Payment history")).not.toBeInTheDocument();
  });
});
