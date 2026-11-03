import { describe, expect, it } from "vitest";
import { ReceiptModal } from "./ReceiptModal";
import { dialog, renderUI, seed } from "@/test/render";

const payment = { id: "pay_1", receiptNo: "RCP-20411", invoiceId: "inv_1", invoiceNo: "INV-2026-0901", student: "Aarav Sharma", grade: "10", grn: "GIS-9200", amount: 4500, mode: "UPI · UTR998877", date: "2026-11-02", by: "School Admin" };

describe("Fee receipt", () => {
  it("prints the school's own name and affiliation", () => {
    seed({ school: [{ id: "school", name: "Riverside Public School", board: "CBSE", affiliation: "2130045", city: "Pune" }] });
    renderUI(<ReceiptModal payment={payment} onClose={() => {}} />);
    const d = dialog("Fee Receipt");
    expect(d).toHaveTextContent("Riverside Public School");
    expect(d).toHaveTextContent("CBSE Affiliation #2130045 · Pune");
    expect(d).toHaveTextContent("UPI · UTR998877");
    expect(d).toHaveTextContent("₹4,500");
    expect(d).not.toHaveTextContent("GREENFIELD");
  });
  it("renders nothing without a payment", () => {
    const { container } = renderUI(<ReceiptModal payment={null} onClose={() => {}} />);
    expect(container.querySelector("#fee-receipt")).toBeNull();
  });
});
