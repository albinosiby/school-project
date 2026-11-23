import { describe, expect, it, vi } from "vitest";
import { authState, renderUI, screen, seed, within, writes } from "@/test/render";
import { router } from "@/test/fakeNext";
import * as collections from "@/lib/useCollection";
import { FeesPage } from "./FeesPage";
import { StudentFeeDetailsView } from "./StudentFeeDetailsView";

const student = { id: "s1", name: "Child One", grn: "G1", grade: "LKG", section: "A", guardian: "Parent One", phone: "9000000000", guardianEmail: "parent@example.test", status: "Active", attendance: 0 };
function setup() { seed({ students: [student], school: [{ id: "school", academicYear: "2026-27", name: "School" }], set_terms: [{ id: "t1", start: "2026-06-01", end: "2027-03-31" }],
  fee_structure: [{ id: "f1", grade: "LKG", academicYear: "2026-27", schemaVersion: 2, termsPerYear: 2, items: [{ id: "tuition", name: "Tuition", amount: 1000, frequency: "Term-wise", grades: ["LKG"], mandatory: true, newStudentsOnly: false, dueDate: "" }] }] }); }

describe("student dues workflow", () => {
  it("defaults to students with annual balances without needing invoices, and opens fee details", async () => {
    setup();
    const { user } = renderUI(<FeesPage />);
    const link = screen.getByRole("link", { name: "Child One" });
    expect(link).toHaveAttribute("href", "/fees/students/s1");
    const row = link.closest("tr")!;
    expect(within(row).getByText("Parent One")).toBeInTheDocument();
    expect(within(row).getAllByText("₹2,000")).toHaveLength(2);
    expect(screen.queryByText("Counter Collection")).not.toBeInTheDocument();
    expect(screen.queryByText("Settlements & Gateway Health")).not.toBeInTheDocument();
    await user.click(within(row).getByText("Parent One"));
    expect(router.push).toHaveBeenCalledWith("/fees/students/s1");
    expect(writes).toHaveLength(0);
  });
  it("searches contacts, filters grades including kindergarten, and offers a separate setup view", async () => {
    setup(); seed({ students: [{ ...student, id: "s2", name: "Child Two", grn: "G2", grade: "UKG", guardian: "Another Parent", phone: "9111111111" }] });
    const { user } = renderUI(<FeesPage />);
    expect(screen.getByRole("option", { name: "Grade LKG" })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Search…" }), "900000");
    expect(screen.getByRole("link", { name: "Child One" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Needs setup (1)" }));
    await user.clear(screen.getByRole("textbox", { name: "Search…" }));
    expect(screen.getByRole("link", { name: "Child Two" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Child One" })).not.toBeInTheDocument();
  });
  it("shows contacts, class, annual balance and payment history on the dedicated page", () => {
    setup();
    renderUI(<StudentFeeDetailsView studentId="s1" />);
    expect(screen.getByRole("heading", { name: "Child One" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: student.phone })).toHaveAttribute("href", "tel:9000000000");
    expect(screen.getByRole("link", { name: student.guardianEmail })).toHaveAttribute("href", "mailto:parent@example.test");
    expect(screen.getByText("Grade LKG · Division A", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create invoice for remaining fees" })).toBeEnabled();
    expect(screen.getByRole("heading", { name: "Payment history" })).toBeInTheDocument();
  });
  it("does not create a second invoice for already invoiced dues; exposes downloads and sharing", async () => {
    setup(); seed({ fee_invoices: [{ id: "i1", no: "INV-1", studentId: "s1", student: student.name, grn: "G1", grade: "LKG", section: "A", guardian: student.guardian, phone: student.phone, term: "2026-27 · Full year", issued: "2026-07-01", due: "2026-12-01", amount: 2000, paid: 500, balance: 1500, status: "Partial", lines: [{ label: "Tuition", feeItemId: "tuition", quantity: 2, unitAmount: 1000, amount: 2000 }] }] });
    const { user } = renderUI(<StudentFeeDetailsView studentId="s1" />);
    expect(screen.getByRole("button", { name: "Create invoice for remaining fees" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "View invoice INV-1" }));
    const modal = screen.getByRole("dialog", { name: "Student invoice" });
    expect(within(modal).getByRole("button", { name: "Download PDF" })).toBeInTheDocument();
    expect(within(modal).getByRole("button", { name: "Share" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("shows skeletons and retry instead of zero balances for incomplete reads", async () => {
    setup(); const read = collections.useCollection; const reload = vi.fn(); let error = false;
    vi.spyOn(collections, "useCollection").mockImplementation(function<T extends { id: string }>(name: string, enabled = true, filters: readonly collections.CollectionFilter[] = []) {
      const source = read<T>(name, enabled, filters);
      return name === "fee_structure" ? { ...source, ready: false, error: error ? { collection: name, code: "unavailable", message: "Offline" } : undefined, reload } : source;
    });
    const { user, rerender } = renderUI(<FeesPage />);
    expect(screen.getByRole("status", { name: "Loading student dues…" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Child One" })).not.toBeInTheDocument();
    error = true; rerender(<FeesPage />);
    await user.click(screen.getByRole("button", { name: "Retry student dues" }));
    expect(reload).toHaveBeenCalledOnce();
  });
  it("does not expose student fees to staff accounts", () => {
    setup(); authState.user = { ...authState.user!, role: "staff" };
    renderUI(<StudentFeeDetailsView studentId="s1" />);
    expect(screen.getByText("Administrator access required")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Child One" })).not.toBeInTheDocument();
  });
});
