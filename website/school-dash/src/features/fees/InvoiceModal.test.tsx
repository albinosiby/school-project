import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderUI, screen, within, writes } from "@/test/render";
import { InvoiceModal } from "./InvoiceModal";
import { invoicePresentation } from "./invoicePresentation";
import type { Invoice } from "./types";

const invoice: Invoice = { id: "i1", no: "INV-2026-001", student: "Student One", grade: "5", section: "A", grn: "G1", guardian: "Parent One", phone: "9000000000", term: "2026-27 · Full academic year", academicYear: "2026-27",
  issued: "2026-11-17", due: "2026-12-01", amount: 1500, paid: 500, balance: 1000, status: "Partial", grossAmount: 2000, concessionAmount: 500,
  lines: [{ label: "Tuition", amount: 2000, quantity: 2, unitAmount: 1000 }, { label: "Concession: Other", amount: -500 }] };
const school = { name: "Example School", logoUrl: "https://school.test/logo.png", affiliation: "#134563", board: "CBSE", city: "Kannur" };
describe("branded invoice", () => {
  it("shows configured branding, fee quantities and a clear balance without duplicating concessions", async () => {
    const { user } = renderUI(<InvoiceModal invoice={invoice} school={school} onClose={() => {}} />);
    const logo = screen.getByRole("img", { name: "Example School logo" });
    expect(logo).toHaveAttribute("src", school.logoUrl);
    expect(screen.getByRole("button", { name: "Print" })).toBeDisabled();
    fireEvent.load(logo);
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    await user.click(screen.getByRole("button", { name: "Print" }));
    expect(print).toHaveBeenCalledOnce();
    expect(screen.getByText("CBSE · Affiliation #134563")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Student billing details" })).getByText("Guardian: Parent One")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Rate" })).toBeInTheDocument();
    expect(screen.getAllByText("-₹500")).toHaveLength(2);
    expect(screen.getByText("Balance due").parentElement).toHaveTextContent("₹1,000");
    expect(writes).toHaveLength(0);
  });
  it("handles a failed logo without printing a broken image, then offers retry", async () => {
    const { user } = renderUI(<InvoiceModal invoice={invoice} school={school} onClose={() => {}} />);
    fireEvent.error(screen.getByRole("img", { name: "Example School logo" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("school logo could not load");
    await user.click(screen.getByRole("button", { name: "Retry logo" }));
    expect(screen.getByRole("img", { name: "Example School logo" })).toBeInTheDocument();
  });
  it("uses the same authoritative saved amounts and period labels for preview and export", () => {
    expect(invoicePresentation(invoice, school)).toMatchObject({ subtotal: 2000, discount: 500, amount: 1500, paid: 500, balance: 1000, period: "Full academic year", year: "2026-27", affiliation: "CBSE · Affiliation #134563" });
    expect(invoicePresentation({ ...invoice, grossAmount: undefined, concessionAmount: undefined }, school).subtotal).toBe(2000);
  });
});
