import type { PDFFont } from "pdf-lib";
import { fmtDate } from "@/lib/format";
import { formatInvoiceMoney as money, invoicePresentation, type InvoiceSchool } from "./invoicePresentation";
import type { Invoice } from "./types";

export type { InvoiceSchool } from "./invoicePresentation";
export type InvoiceFonts = { regular: Uint8Array; malayalam: Uint8Array; bold?: Uint8Array };
let fontsPromise: Promise<InvoiceFonts> | undefined;
async function loadFonts(): Promise<InvoiceFonts> {
  if (!fontsPromise) fontsPromise = Promise.all(["NotoSans-Regular.ttf", "NotoSansMalayalam-Regular.ttf", "NotoSans-Bold.ttf"].map(async (name) => {
    const response = await fetch(`/fonts/${name}`);
    if (!response.ok) throw new Error("Could not load invoice fonts. Try downloading again.");
    return new Uint8Array(await response.arrayBuffer());
  })).then(([regular, malayalam, bold]) => ({ regular, malayalam, bold })).catch((error) => { fontsPromise = undefined; throw error; });
  return fontsPromise;
}
type LogoBytes = { bytes: Uint8Array; kind: "png" | "jpg" };
const logoCache = new Map<string, Promise<LogoBytes>>();
async function loadLogo(url: string): Promise<LogoBytes> {
  let pending = logoCache.get(url);
  if (!pending) {
    pending = (async () => {
      try {
        const response = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(10000) });
        if (!response.ok || Number(response.headers?.get("content-length")) > 2 * 1024 * 1024) throw new Error();
        const bytes = new Uint8Array(await response.arrayBuffer());
        if (!bytes.length || bytes.length > 2 * 1024 * 1024) throw new Error();
        const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
        const jpg = bytes[0] === 255 && bytes[1] === 216;
        if (!png && !jpg) throw new Error();
        return { bytes, kind: png ? "png" as const : "jpg" as const };
      } catch { logoCache.delete(url); throw new Error("Could not load the school logo. Try again, or check the PNG/JPEG logo in Settings."); }
    })();
    if (logoCache.size >= 4) logoCache.delete(logoCache.keys().next().value!);
    logoCache.set(url, pending);
  }
  return pending;
}
export const invoiceFilename = (invoice: Invoice) => `${invoice.no.replace(/[^\p{L}\p{N}_-]/gu, "-") || "invoice"}.pdf`;

/** A4 paper template shared by downloads and sharing. Financial amounts come from the saved invoice. */
export async function createInvoicePdf(invoice: Invoice, school: InvoiceSchool, suppliedFonts?: InvoiceFonts): Promise<Uint8Array> {
  const [{ PDFDocument, rgb }, fontkit, bytes, logoBytes] = await Promise.all([import("pdf-lib"), import("fontkit"), suppliedFonts ? Promise.resolve(suppliedFonts) : loadFonts(), school.logoUrl ? loadLogo(school.logoUrl) : undefined]);
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const model = invoicePresentation(invoice, school);
  pdf.setTitle(`Invoice ${invoice.no}`); pdf.setAuthor(model.schoolName);
  // Embed whole fonts; the fontkit subset API differs from the pdf-lib subset API.
  const regular = await pdf.embedFont(bytes.regular), bold = bytes.bold ? await pdf.embedFont(bytes.bold) : regular, malayalam = await pdf.embedFont(bytes.malayalam);
  const logo = logoBytes ? await (logoBytes.kind === "png" ? pdf.embedPng(logoBytes.bytes) : pdf.embedJpg(logoBytes.bytes)).catch(() => {
    if (school.logoUrl) logoCache.delete(school.logoUrl);
    throw new Error("Could not read the school logo. Upload a valid PNG or JPEG logo in Settings.");
  }) : undefined;
  const supported = new Map<PDFFont, Set<number>>([regular, bold, malayalam].map((font) => [font, new Set(font.getCharacterSet())]));
  const runs = (text: string, strong = false) => (String(text).match(/[\u0D00-\u0D7F\u200C\u200D]+|[^\u0D00-\u0D7F\u200C\u200D]+/gu) ?? []).map((value) => {
    const font = /[\u0D00-\u0D7F]/u.test(value) ? malayalam : strong ? bold : regular;
    for (const char of value) if (!supported.get(font)!.has(char.codePointAt(0)!)) throw new Error("A character in this invoice is not supported by the PDF fonts. Use Print to save a PDF instead.");
    return { value, font };
  });
  const width = (text: string, size = 10, strong = false) => runs(text, strong).reduce((sum, run) => sum + run.font.widthOfTextAtSize(run.value, size), 0);
  const color = (hex: string) => rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255);
  const ink = color(model.colors.ink), blue = color(model.colors.blue), muted = color(model.colors.muted), line = color(model.colors.line), soft = color(model.colors.soft), green = color(model.colors.green), white = rgb(1, 1, 1);
  const margin = 44, right = 551, contentWidth = 507, bottom = 65;
  let page = pdf.addPage([595.28, 841.89]); let y = 790;
  const draw = (text: string, x: number, baseline: number, size = 10, strong = false, fill = ink) => {
    for (const run of runs(text, strong)) { page.drawText(run.value, { x, y: baseline, size, font: run.font, color: fill }); x += run.font.widthOfTextAtSize(run.value, size); }
  };
  const drawRight = (text: string, edge: number, baseline: number, size = 10, strong = false, fill = ink) => draw(text, edge - width(text, size, strong), baseline, size, strong, fill);
  const wrap = (text: string, maxWidth: number, size = 10, strong = false) => {
    const lines: string[] = [];
    for (const paragraph of String(text).replace(/[\t\r]/g, " ").split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = current ? `${current} ${word}` : word;
        if (width(candidate, size, strong) <= maxWidth) { current = candidate; continue; }
        if (current) { lines.push(current); current = ""; }
        for (const { segment } of new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word)) {
          if (current && width(current + segment, size, strong) > maxWidth) { lines.push(current); current = ""; }
          current += segment;
        }
      }
      lines.push(current);
    }
    return lines;
  };
  const block = (text: string, x: number, top: number, maxWidth: number, size = 10, strong = false, fill = ink) => {
    const lines = wrap(text, maxWidth, size, strong);
    lines.forEach((value, index) => draw(value, x, top - index * (size + 5), size, strong, fill));
    return top - lines.length * (size + 5);
  };
  const logoAt = (x: number, top: number, size: number) => {
    if (!logo) return;
    const scale = Math.min(size / logo.width, size / logo.height), w = logo.width * scale, h = logo.height * scale;
    page.drawImage(logo, { x: x + (size - w) / 2, y: top - h - (size - h) / 2, width: w, height: h });
  };
  const rule = (baseline: number) => page.drawLine({ start: { x: margin, y: baseline }, end: { x: right, y: baseline }, thickness: 0.7, color: line });
  const newPage = () => {
    page = pdf.addPage([595.28, 841.89]);
    page.drawRectangle({ x: margin, y: 804, width: contentWidth, height: 3, color: blue });
    logoAt(margin, 792, 32);
    const schoolBottom = block(model.schoolName, logo ? 88 : margin, 784, logo ? 260 : 304, 10, true);
    const numberBottom = block(`Invoice ${invoice.no}`, 376, 784, 175, 8.5, false, muted);
    y = Math.min(schoolBottom, numberBottom, 755) - 16;
  };
  const ensure = (height: number) => { if (y - height < bottom) newPage(); };

  page.drawRectangle({ x: margin, y: 804, width: contentWidth, height: 4, color: blue });
  logoAt(margin, 793, 72);
  const schoolX = logo ? 126 : margin, schoolWidth = logo ? 232 : 314;
  let schoolY = block(model.schoolName, schoolX, 783, schoolWidth, 17, true);
  if (model.affiliation) schoolY = block(model.affiliation, schoolX, schoolY - 2, schoolWidth, 8.5, false, muted);
  if (school.city) schoolY = block(school.city, schoolX, schoolY - 1, schoolWidth, 9, false, muted);
  drawRight("INVOICE", right, 783, 24, true, blue);
  const numberY = block(invoice.no, 381, 760, 170, 8.5, true, muted);
  const statusWidth = width(model.statusLabel.toUpperCase(), 8, true) + 18;
  page.drawRectangle({ x: right - statusWidth, y: numberY - 21, width: statusWidth, height: 19, color: soft });
  draw(model.statusLabel.toUpperCase(), right - statusWidth + 9, numberY - 15, 8, true, model.status === "Paid" ? green : blue);
  y = Math.min(schoolY, numberY - 29, logo ? 721 : 750) - 16; rule(y); y -= 24;

  const leftX = margin, leftW = 247, metaX = 309, metaW = 242;
  const studentRows = [{ text: invoice.student, size: 13, strong: true }, { text: `GRN: ${invoice.grn || "Not recorded"}`, size: 9 }, { text: model.className, size: 9 },
    ...(invoice.guardian ? [{ text: `Guardian: ${invoice.guardian}`, size: 9 }] : []), ...(invoice.phone ? [{ text: `Phone: ${invoice.phone}`, size: 9 }] : [])];
  const studentHeight = studentRows.reduce((height, row) => height + wrap(row.text, leftW - 28, row.size, row.strong).length * (row.size + 5) + 2, 35);
  const periodLines = wrap(model.period, metaW - 28, 10);
  const infoHeight = Math.max(134, studentHeight, 105 + periodLines.length * 15);
  ensure(infoHeight + 40);
  page.drawRectangle({ x: leftX, y: y - infoHeight, width: leftW, height: infoHeight, color: soft });
  page.drawRectangle({ x: metaX, y: y - infoHeight, width: metaW, height: infoHeight, borderColor: line, borderWidth: 0.7 });
  draw("BILLED TO", leftX + 14, y - 19, 8, true, blue);
  let studentY = y - 41;
  for (const row of studentRows) studentY = block(row.text, leftX + 14, studentY, leftW - 28, row.size, row.strong) - 2;
  draw("INVOICE DETAILS", metaX + 14, y - 19, 8, true, blue);
  draw("ISSUED", metaX + 14, y - 41, 7.5, true, muted); draw("DUE DATE", metaX + 126, y - 41, 7.5, true, muted);
  draw(invoice.issued ? fmtDate(invoice.issued) : "Not recorded", metaX + 14, y - 57, 9.5, true);
  draw(invoice.due ? fmtDate(invoice.due) : "Not recorded", metaX + 126, y - 57, 9.5, true);
  draw(`ACADEMIC YEAR${model.year ? `  ${model.year}` : "  Not recorded"}`, metaX + 14, y - 79, 8, false, muted);
  draw("BILLING PERIOD", metaX + 14, y - 99, 7.5, true, muted);
  block(model.period, metaX + 14, y - 115, metaW - 28, 10);
  y -= infoHeight + 29;

  const tableHeader = () => {
    ensure(45); page.drawRectangle({ x: margin, y: y - 26, width: contentWidth, height: 26, color: soft });
    draw("FEE DESCRIPTION", margin + 10, y - 17, 7.5, true, blue);
    draw("QTY", 336, y - 17, 7.5, true, blue); drawRight("RATE", 442, y - 17, 7.5, true, blue); drawRight("AMOUNT", right - 10, y - 17, 7.5, true, blue); y -= 26;
  };
  tableHeader();
  const summaryHeight = model.discount > 0 ? 170 : 148;
  for (const [index, item] of model.lines.entries()) {
    const labels = wrap(item.label, 266, 9.5); const fullHeight = Math.max(35, labels.length * 14 + 20);
    const tail = model.lines.length - index <= 2 ? model.lines.slice(index).reduce((height, row) => height + Math.max(35, wrap(row.label, 266, 9.5).length * 14 + 20), summaryHeight + 40) : fullHeight;
    if (y - (tail < 630 ? tail : fullHeight) < bottom && fullHeight < 630) { newPage(); tableHeader(); }
    let offset = 0;
    while (offset < labels.length) {
      let capacity = Math.floor((y - bottom - 20) / 14);
      if (capacity < 1) { newPage(); tableHeader(); capacity = Math.floor((y - bottom - 20) / 14); }
      const fragment = labels.slice(offset, offset + capacity), height = Math.max(35, fragment.length * 14 + 20);
      if (index % 2 === 1) page.drawRectangle({ x: margin, y: y - height, width: contentWidth, height, color: rgb(0.985, 0.99, 1) });
      fragment.forEach((label, part) => draw(label, margin + 10, y - 19 - part * 14, 9.5, false, item.amount < 0 ? green : ink));
      if (offset === 0) {
        drawRight(item.quantity === null ? "-" : String(item.quantity), 350, y - 19, 9);
        drawRight(item.rate === null ? "-" : money(item.rate), 442, y - 19, 9);
        drawRight(money(item.amount), right - 10, y - 19, 9.5, true, item.amount < 0 ? green : ink);
      }
      y -= height; rule(y); offset += fragment.length;
    }
  }
  y -= 22;
  ensure(summaryHeight + 18);
  const summaryX = 319, summaryRight = right - 10;
  let totalY = y;
  for (const [label, value, strong, fill] of [
    ["Charges", money(model.subtotal), false, muted], ...(model.discount > 0 ? [["Concessions", `-${money(model.discount)}`, false, green]] : []),
    ["Invoice total", money(model.amount), true, ink], ["Paid", money(model.paid), false, muted],
  ] as [string, string, boolean, ReturnType<typeof rgb>][]) {
    draw(label, summaryX + 10, totalY - 12, 9.5, strong, fill); drawRight(value, summaryRight, totalY - 12, 9.5, strong, fill); totalY -= 24;
  }
  page.drawRectangle({ x: summaryX, y: totalY - 61, width: right - summaryX, height: 58, color: blue });
  draw("BALANCE DUE", summaryX + 12, totalY - 21, 8, true, white);
  drawRight(money(model.balance), right - 12, totalY - 46, 19, true, white);
  block("Thank you.\nPlease retain this invoice for your records. A payment receipt is issued separately.", margin, y - 12, 237, 9, false, muted);
  const pages = pdf.getPages();
  pages.forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 47 }, end: { x: right, y: 47 }, thickness: 0.6, color: line });
    sheet.drawText("Computer-generated invoice", { x: margin, y: 31, size: 8, font: regular, color: muted });
    const pageLabel = `Page ${index + 1} of ${pages.length}`;
    sheet.drawText(pageLabel, { x: right - regular.widthOfTextAtSize(pageLabel, 8), y: 31, size: 8, font: regular, color: muted });
  });
  return pdf.save();
}

export async function downloadInvoicePdf(invoice: Invoice, school: InvoiceSchool) {
  const bytes = await createInvoicePdf(invoice, school);
  downloadInvoiceFile(new File([new Uint8Array(bytes)], invoiceFilename(invoice), { type: "application/pdf" }));
}
export function downloadInvoiceFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
