const path = require("node:path");
const { certificateText, FIELD_LABELS } = require("./certificateData");

/** One frozen A4 artifact is used by preview, download and print. No HTML or remote URLs are executed. */
async function renderCertificate(cert, { logo, draft = false, verificationUrl = "" } = {}) {
  const PDFDocument = require("pdfkit");
  const margins = { top: 48, bottom: 170, left: 50, right: 50 };
  const doc = new PDFDocument({ size: "A4", margins, bufferPages: true,
    info: { Title: cert.title, Author: cert.schoolSnapshot.name, Subject: cert.refNo || "Draft certificate" } });
  doc.registerFont("Regular", path.join(__dirname, "assets/PlusJakartaSans-Regular.ttf"));
  doc.registerFont("Bold", path.join(__dirname, "assets/PlusJakartaSans-Bold.ttf"));
  doc.registerFont("Malayalam", path.join(__dirname, "assets/Manjari-Regular.ttf"));
  const chunks = [], complete = new Promise((resolve, reject) => { doc.on("data", (chunk) => chunks.push(chunk)); doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const accent = cert.templateSnapshot.accent || "#1554BD", ink = "#192B43", muted = "#53657C", width = 495;
  const font = (value, bold) => /[\u0D00-\u0D7F]/.test(String(value)) ? "Malayalam" : bold ? "Bold" : "Regular";
  const text = (value, x, y, w, size = 10, bold = false, options = {}) => {
    // Shape each script separately. A Latin-led paragraph must not apply Latin shaping to a Malayalam name.
    const runs = String(value || "-").match(/[\u0D00-\u0D7F\u200C\u200D]+(?:[ \t]+[\u0D00-\u0D7F\u200C\u200D]+)*|[^\u0D00-\u0D7F\u200C\u200D]+/gu) || ["-"];
    let left = x, opts = options;
    if (runs.length > 1 && options.align === "center") {
      const measured = runs.reduce((sum, run) => sum + doc.font(font(run, bold)).fontSize(size).widthOfString(run), 0);
      if (measured <= w) { left += (w - measured) / 2; opts = { ...options, align: "left" }; }
    }
    runs.forEach((run, i) => { doc.font(font(run, bold)).fontSize(size).fillColor(ink);
      if (i === 0) doc.text(run, left, y, { width: w, lineGap: 4, ...opts, continued: runs.length > 1 });
      else doc.text(run, { continued: i < runs.length - 1 });
    });
    return doc;
  };
  const nameHeight = doc.font(font(cert.issuer, true)).fontSize(9).heightOfString(cert.issuer, { width: 165, lineGap: 2 });
  const designationHeight = doc.font(font(cert.signatoryDesignation, false)).fontSize(8).heightOfString(cert.signatoryDesignation, { width: 165, lineGap: 2 });
  const nameTop = 780 - nameHeight - designationHeight - 2, signatureLine = nameTop - 7, signatureTop = signatureLine - 52;
  const contentBottom = Math.min(670, signatureTop - 18);
  margins.bottom = 841.89 - contentBottom; doc.page.margins.bottom = margins.bottom;
  const ensure = (height) => { if (doc.y + height > contentBottom) { doc.addPage({ size: "A4", margins }); text(`${cert.title} - continued`, 50, 48, width, 12, true); doc.y += 18; } };
  const school = cert.schoolSnapshot;
  let schoolX = 50, schoolW = width;
  if (logo) { doc.image(logo, 50, 48, { fit: [60, 60] }); schoolX = 125; schoolW = 420; }
  text(school.name, schoolX, 48, schoolW, 19, true);
  let headerBottom = Math.max(82, doc.y + 7);
  const address = [school.address, school.city].filter(Boolean).join(", ");
  if (address) { text(address, schoolX, headerBottom, schoolW, 9); headerBottom = doc.y + 5; }
  const affiliation = [school.board, school.affiliation && `Affiliation ${school.affiliation}`].filter(Boolean).join(" - ");
  if (affiliation) { text(affiliation, schoolX, headerBottom, schoolW, 8); headerBottom = doc.y + 5; }
  doc.y = Math.max(125, headerBottom + 14);
  const metaY = doc.y;
  doc.roundedRect(50, metaY, width, 46, 6).fill("#EEF3FA");
  text(draft ? "DRAFT PREVIEW - NOT ISSUED" : cert.refNo, 64, metaY + 10, 315, 9, true);
  text(`Issued: ${cert.issuedOn}`, 390, metaY + 10, 140, 8);
  if (cert.validTill) text(`Valid until: ${cert.validTill}`, 390, metaY + 25, 140, 8);
  doc.y = metaY + 74;
  text(cert.title.toUpperCase(), 50, doc.y, width, 19, true, { align: "center" });
  doc.y += 18;
  text(cert.recipientSnapshot.name, 50, doc.y, width, 21, true, { align: "center" });
  doc.y += 23;
  const body = certificateText(cert);
  text(body, 50, doc.y, width, 11, false, { lineGap: 7, align: "left" });
  doc.y += 20;
  const rows = [
    [cert.recipientKind === "staff" ? "Employee number" : "Admission number", cert.recipientKind === "staff" ? cert.recipientSnapshot.employeeId : cert.recipientSnapshot.admissionNumber],
    [cert.recipientKind === "staff" ? "Designation" : "Class", cert.recipientKind === "staff" ? cert.recipientSnapshot.designation : cert.recipientSnapshot.class],
    ...Object.entries(cert.fields).map(([key, value]) => [FIELD_LABELS[key], key === "salaryAmount" ? `INR ${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : value]),
  ].filter(([, value]) => value);
  for (const [label, value] of rows) {
    doc.font(font(value, false)).fontSize(9);
    const h = Math.max(30, doc.heightOfString(String(value), { width: 310, lineGap: 4 }) + 17);
    ensure(h); const y = doc.y;
    doc.rect(50, y, width, h).fill("#F6F8FC");
    text(label, 61, y + 9, 153, 8, true); text(value, 222, y + 9, 312, 9);
    doc.strokeColor("#DCE5EF").lineWidth(0.5).moveTo(50, y + h).lineTo(545, y + h).stroke(); doc.y = y + h;
  }
  const qr = !draft && verificationUrl ? await require("qrcode").toBuffer(verificationUrl, { type: "png", errorCorrectionLevel: "M", width: 240, margin: 4 }) : null;
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page++) {
    doc.switchToPage(page); const bottom = doc.page.margins.bottom; doc.page.margins.bottom = 0;
    doc.rect(26, 26, 543, 789).strokeColor("#DCE5EF").lineWidth(0.7).stroke();
    doc.rect(26, 26, 543, 5).fill(accent);
    if (qr) { doc.image(qr, 47, 690, { width: 78, height: 78 }); text("Scan to verify validity", 130, 706, 190, 8, true); text(cert.refNo, 130, 725, 190, 8); }
    else text("DRAFT PREVIEW - NOT ISSUED", 50, 725, 265, 10, true);
    const template = cert.templateSnapshot;
    if (template.sealImage) doc.image(template.sealImage, 310, signatureTop + 4, { fit: [55, 55] });
    if (template.signatureImage) doc.image(template.signatureImage, 393, signatureTop, { fit: [136, 45] });
    doc.moveTo(390, signatureLine).lineTo(537, signatureLine).strokeColor("#AEBED1").stroke();
    text(cert.issuer, 380, nameTop, 165, 9, true, { align: "center", lineGap: 2 });
    text(cert.signatoryDesignation, 380, nameTop + nameHeight + 2, 165, 8, false, { align: "center", lineGap: 2 });
    // Footer text has its own fixed box rather than the body's flowing layout.
    text(draft ? "Preview only. A certificate number and verification QR are assigned on issue." : `School ID: ${cert.publicSchoolId || cert.schoolId || ""}. Verify current validity using the QR.`, 50, 786, 435, 7, false, { height: 20 });
    text(`${page + 1} / ${range.count}`, 495, 786, 50, 7, false, { align: "right", height: 20 });
    doc.page.margins.bottom = bottom;
  }
  doc.end(); return complete;
}
module.exports = { renderCertificate };
