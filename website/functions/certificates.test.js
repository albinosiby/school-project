const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const { PDFDocument } = require("../node_modules/pdf-lib");
const { catalog, defaultTemplate, validateTemplate, reviewForm, certificateText, publicCertificate } = require("./certificateData");
const { renderCertificate } = require("./certificatePdf");
const now = new Date("2026-11-20T08:00:00Z"), school = { name: "Greenfield International School", address: "12 School Road", city: "Kannur", board: "CBSE", affiliation: "123456" };
const person = { name: "Ananya Krishnan", grn: "GR-1024", empId: "EMP-108", grade: "8", section: "B", dob: "2012-08-15", designation: "Science Teacher", department: "Science", status: "Active" };
const fields = { startDate: "2024-06-03", endDate: "2026-11-20", conduct: "Good", leavingReason: "Family relocation", feeClearance: "Reviewed by the school office; no pending recorded dues", salaryAmount: "45000", salaryPeriod: "November 2026, monthly gross salary", achievement: "Leading the annual science exhibition" };
function model(entry, override = {}) {
  const selected = Object.fromEntries(entry.fields.filter((key) => key !== "dob").map((key) => [key, fields[key]]));
  return { ...reviewForm({ type: entry.id, kind: entry.kind, recipientId: "r1", issuedOn: "2026-11-20", issuer: "Dr. Anil Menon", purpose: "Official records", fields: selected, ...override }, person, defaultTemplate(entry.id), school, { timezone: "Asia/Kolkata" }, { academicYear: "2026-27" }, now), status: "Issued", refNo: "CERT/2026/0008", schoolId: "synthetic-school" };
}
function assertA4Pages(pdf) {
  for (const page of pdf.getPages()) {
    assert.ok(Math.abs(page.getWidth() - 595.28) < 0.1, "Every continuation page must retain A4 width");
    assert.ok(Math.abs(page.getHeight() - 841.89) < 0.1, "Every continuation page must retain A4 height");
  }
}
test("twelve main templates require the right student/staff fields and resolve every placeholder", () => {
  assert.equal(catalog.filter((c) => !c.legacy).length, 12);
  for (const entry of catalog) { const cert = model(entry), text = certificateText(cert); assert.ok(text.includes(person.name)); assert.ok(!text.includes("{{")); assert.ok(!text.includes("Not recorded")); assert.equal(cert.recipientKind, entry.kind); }
});
test("DOB is taken from the register; fees and character declarations require explicit review", () => {
  const dob = model(catalog.find((c) => c.id === "dob"), { fields: { dob: "1990-01-01" } });
  assert.equal(dob.fields.dob, person.dob);
  assert.throws(() => model(catalog.find((c) => c.id === "transfer"), { fields: { ...fields, feeClearance: "" } }), /reviewed clearance/i);
  assert.throws(() => model(catalog.find((c) => c.id === "character"), { fields: {} }), /character/i);
});
test("date, salary and recipient validation rejects bad or mismatched records", () => {
  const study = catalog.find((c) => c.id === "study"), salary = catalog.find((c) => c.id === "salary");
  assert.throws(() => model(study, { fields: { startDate: "2026-02-30", endDate: "2026-03-01" } }), /valid date/i);
  assert.throws(() => model(study, { fields: { startDate: "2026-10-01", endDate: "2026-01-01" } }), /on or after/i);
  assert.throws(() => model(salary, { fields: { salaryAmount: "-1", salaryPeriod: "Month" } }), /salary amount/i);
  assert.throws(() => model(salary, { kind: "student" }), /recipient type/i);
  assert.throws(() => model(study, { issuedOn: "2027-01-01" }), /today or earlier/i);
});
test("template validation bounds text and images and rejects unknown placeholders", () => {
  const template = defaultTemplate("bonafide");
  assert.equal(validateTemplate(template).title, template.title);
  assert.throws(() => validateTemplate({ ...template, body: "{{password}}" }), /Unknown placeholder/);
  assert.throws(() => validateTemplate({ ...template, body: "A".repeat(3001) }), /3000/);
  assert.throws(() => validateTemplate({ ...template, signatureImage: "https://example.com/image.png" }), /PNG or JPEG/);
  assert.throws(() => validateTemplate({ ...template, accent: "url(javascript:alert(1))" }), /accent/);
});
test("public verification does not disclose names, DOB, salary, documents or audit reasons", () => {
  const cert = model(catalog.find((c) => c.id === "salary")), value = publicCertificate(cert, "2026-11-20");
  assert.deepEqual(Object.keys(value).sort(), ["issuedOn", "refNo", "school", "status", "title", "validTill"].sort());
  assert.equal(value.status, "Valid"); assert.ok(!JSON.stringify(value).includes(person.name)); assert.ok(!JSON.stringify(value).includes("45000"));
  assert.equal(publicCertificate({ ...cert, status: "Revoked", revokeReason: "Private reason" }, "2026-11-20").status, "Revoked");
  assert.equal(publicCertificate({ ...cert, validTill: "2026-11-19" }, "2026-11-20").status, "Expired");
});
test("all twelve PDF formats render, retain text and contain a verification link", async () => {
  for (const entry of catalog.filter((c) => !c.legacy)) {
    const cert = model(entry), pdf = await renderCertificate(cert, { verificationUrl: "https://example.com/verify-certificate?school=synthetic-school&token=0123456789abcdefghijklmnopqrstuv" });
    const parsed = await PDFDocument.load(pdf); assert.equal(parsed.getPageCount(), 1, entry.id); assert.equal(parsed.getTitle(), entry.title); assert.ok(pdf.length > 10000);
    if (process.env.CERTIFICATE_PDF_PREVIEWS) { mkdirSync(process.env.CERTIFICATE_PDF_PREVIEWS, { recursive: true }); writeFileSync(`${process.env.CERTIFICATE_PDF_PREVIEWS}/${entry.id}.pdf`, pdf); }
  }
});
test("long names and multilingual text produce bounded, valid PDF pages", async () => {
  const cert = model(catalog.find((c) => c.id === "appreciation"));
  cert.recipientSnapshot.name = "അനന്യ കൃഷ്ണൻ"; cert.fields.achievement = "For sustained contributions to science learning and school activities. ".repeat(15);
  const pdf = await renderCertificate(cert, { draft: true }); const parsed = await PDFDocument.load(pdf); assert.ok(parsed.getPageCount() <= 3); assertA4Pages(parsed);
  if (process.env.CERTIFICATE_PDF_PREVIEWS) writeFileSync(`${process.env.CERTIFICATE_PDF_PREVIEWS}/multilingual.pdf`, pdf);
});
test("school logos, approved signature and seal images render in the frozen PDF", async () => {
  const logo = require("node:fs").readFileSync(require("node:path").join(__dirname, "../school-dash/public/logo.png"));
  const cert = model(catalog.find((c) => c.id === "bonafide"));
  cert.templateSnapshot.signatureImage = `data:image/png;base64,${logo.toString("base64")}`; cert.templateSnapshot.sealImage = cert.templateSnapshot.signatureImage;
  const pdf = await renderCertificate(cert, { logo, verificationUrl: "https://example.com/verify-certificate?school=SYNTHETIC&token=0123456789abcdefghijklmnopqrstuv" });
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
  if (process.env.CERTIFICATE_PDF_PREVIEWS) writeFileSync(`${process.env.CERTIFICATE_PDF_PREVIEWS}/branding.pdf`, pdf);
});
test("maximum-length signatories reserve footer space instead of overlapping document content", async () => {
  const cert = model(catalog.find((c) => c.id === "transfer"));
  cert.issuer = "Dr. Ananya Krishnan Menon ".repeat(7).slice(0, 160); cert.signatoryDesignation = "Principal and authorised head of the institution ".repeat(3).slice(0, 100);
  const pdf = await renderCertificate(cert, { draft: true }); const parsed = await PDFDocument.load(pdf); assert.ok(parsed.getPageCount() <= 4); assertA4Pages(parsed);
  if (process.env.CERTIFICATE_PDF_PREVIEWS) writeFileSync(`${process.env.CERTIFICATE_PDF_PREVIEWS}/long-signatory.pdf`, pdf);
});
