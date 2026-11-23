import { readFile, writeFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it, vi } from "vitest";
import { createInvoicePdf, downloadInvoicePdf, invoiceFilename } from "./invoicePdf";
import type { Invoice } from "./types";

const invoice: Invoice = { id: "fixture", no: "INV-ST-2026-27-000001", student: "Sample Student · അല്ബിനോ സിബി", grn: "SAMPLE-001", grade: "5", section: "A", guardian: "Sample Parent", phone: "", term: "2026-27 · Full academic year", academicYear: "2026-27", issued: "2026-11-17", due: "2026-12-01", amount: 35000, paid: 5000, balance: 30000, status: "Partial", lines: [
  { label: "Tuition", amount: 20000, quantity: 2, unitAmount: 10000 }, { label: "Annual fee", amount: 15000 }, { label: "Admission fee", amount: 5000 }, { label: "Concession: Other", amount: -5000 },
] };
async function fonts() { const [regular, malayalam, bold] = await Promise.all([readFile("public/fonts/NotoSans-Regular.ttf"), readFile("public/fonts/NotoSansMalayalam-Regular.ttf"), readFile("public/fonts/NotoSans-Bold.ttf")]); return { regular: new Uint8Array(regular), malayalam: new Uint8Array(malayalam), bold: new Uint8Array(bold) }; }
describe("invoice PDF export", () => {
  it("creates a real PDF with rupees and Malayalam names, and supports long multipage invoices", async () => {
    const fontBytes = await fonts();
    const logo = new Uint8Array(await readFile(process.env.INVOICE_QA_LOGO_PATH || "public/logo.png"));
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, arrayBuffer: async () => logo.buffer })));
    const school = { name: process.env.INVOICE_QA_SCHOOL_NAME || "Sample School", board: "CBSE", affiliation: "#134563", city: "Chemperi", logoUrl: "https://school.test/brand.png" };
    const bytes = await createInvoicePdf(invoice, school, fontBytes);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("%PDF");
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    const long = await createInvoicePdf({ ...invoice, amount: 65000, balance: 60000, lines: Array.from({ length: 65 }, (_, index) => ({ label: `Collection ${index + 1} · A long fee description that should wrap clearly across the invoice column without colliding with the amount`, amount: 1000 })) }, school, fontBytes);
    expect((await PDFDocument.load(long)).getPageCount()).toBeGreaterThan(2);
    expect(vi.mocked(fetch)).toHaveBeenCalledOnce();
    if (process.env.INVOICE_PDF_QA_PATH) { await writeFile(`${process.env.INVOICE_PDF_QA_PATH}.pdf`, bytes); await writeFile(`${process.env.INVOICE_PDF_QA_PATH}-long.pdf`, long); }
    expect(invoiceFilename({ ...invoice, no: "INV/2026: 1" })).toBe("INV-2026--1.pdf");
  });
  it("downloads application/pdf bytes with the invoice filename", async () => {
    const fontBytes = await fonts();
    vi.stubGlobal("fetch", vi.fn(async (url: string) => ({ ok: true, arrayBuffer: async () => new Uint8Array(url.includes("Malayalam") ? fontBytes.malayalam : url.includes("Bold") ? fontBytes.bold! : fontBytes.regular).buffer })));
    const create = vi.spyOn(URL, "createObjectURL");
    let downloadedFilename = "";
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function(this: HTMLAnchorElement) { downloadedFilename = this.download; });
    await downloadInvoicePdf(invoice, { name: "Sample School" });
    expect(create).toHaveBeenCalledOnce();
    const blob = create.mock.calls[0][0] as Blob;
    expect(blob.type).toBe("application/pdf");
    expect(blob.size).toBeGreaterThan(1000);
    expect(click).toHaveBeenCalledOnce();
    expect(downloadedFilename).toBe("INV-ST-2026-27-000001.pdf");
  });
  it("keeps invoices without a configured logo exportable", async () => {
    const bytes = await createInvoicePdf(invoice, { name: "School without a logo" }, await fonts());
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
  it("rejects unavailable or unsupported configured logos and permits a retry", async () => {
    const source = { name: "School", logoUrl: "https://school.test/retry-brand.png" };
    const fontBytes = await fonts();
    const logo = new Uint8Array(await readFile("public/logo.png"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false }).mockResolvedValueOnce({ ok: true, arrayBuffer: async () => logo.buffer }));
    await expect(createInvoicePdf(invoice, source, fontBytes)).rejects.toThrow(/school logo/);
    expect((await PDFDocument.load(await createInvoicePdf(invoice, source, fontBytes))).getPageCount()).toBe(1);
    vi.mocked(fetch).mockResolvedValueOnce({ ok: true, arrayBuffer: async () => new TextEncoder().encode("<svg></svg>").buffer } as Response);
    await expect(createInvoicePdf(invoice, { ...source, logoUrl: "https://school.test/unsupported.svg" }, fontBytes)).rejects.toThrow(/school logo/);
  });
});
