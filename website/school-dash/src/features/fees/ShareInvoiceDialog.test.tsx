import { describe, expect, it, vi } from "vitest";
import { renderUI, screen, writes } from "@/test/render";
import { ShareInvoiceDialog } from "./ShareInvoiceDialog";
import { createInvoicePdf, downloadInvoiceFile } from "./invoicePdf";
import type { Invoice } from "./types";

vi.mock("./invoicePdf", () => ({ createInvoicePdf: vi.fn(async () => new Uint8Array([37, 80, 68, 70])), invoiceFilename: () => "INV-1.pdf", downloadInvoiceFile: vi.fn() }));
const invoice = { id: "i1", no: "INV-1" } as Invoice;
const school = { name: "School" };
describe("invoice sharing", () => {
  it("prepares the PDF, then opens the device chooser only on the user's Share click", async () => {
    const share = vi.fn(async () => {}); Object.defineProperty(navigator, "share", { configurable: true, value: share }); Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    const { user } = renderUI(<ShareInvoiceDialog invoice={invoice} school={school} onClose={() => {}} />);
    expect(share).not.toHaveBeenCalled();
    await user.click(await screen.findByRole("button", { name: "Share PDF" }));
    expect(share).toHaveBeenCalledWith({ files: [expect.objectContaining({ name: "INV-1.pdf", type: "application/pdf" })], title: "Invoice INV-1" });
    expect(writes).toHaveLength(0);
  });
  it("downloads the prepared file when native file sharing is unavailable", async () => {
    Object.defineProperty(navigator, "canShare", { configurable: true, value: () => false });
    const { user } = renderUI(<ShareInvoiceDialog invoice={invoice} school={school} onClose={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Download PDF to share" }));
    expect(downloadInvoiceFile).toHaveBeenCalledWith(expect.objectContaining({ name: "INV-1.pdf" }));
    expect(screen.getByRole("status")).toHaveTextContent("PDF downloaded");
  });
  it("allows cancelling the native chooser without reporting an error", async () => {
    Object.defineProperty(navigator, "share", { configurable: true, value: vi.fn(async () => { throw new DOMException("Cancelled", "AbortError"); }) }); Object.defineProperty(navigator, "canShare", { configurable: true, value: () => true });
    const { user } = renderUI(<ShareInvoiceDialog invoice={invoice} school={school} onClose={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Share PDF" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("offers PDF preparation retry when export fails", async () => {
    vi.mocked(createInvoicePdf).mockRejectedValueOnce(new Error("Font download failed"));
    const { user } = renderUI(<ShareInvoiceDialog invoice={invoice} school={school} onClose={() => {}} />);
    await user.click(await screen.findByRole("button", { name: "Retry PDF" }));
    expect(await screen.findByRole("button", { name: "Share PDF" })).toBeInTheDocument();
  });
});
