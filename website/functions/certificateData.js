const catalog = require("./certificateCatalog.json");
const { HttpsError } = require("firebase-functions/v2/https");
const { schoolDate } = require("./schoolTime");
const clean = (v) => typeof v === "string" ? v.trim() : "";
const fail = (message, code = "invalid-argument") => { throw new HttpsError(code, message); };
const validId = (v) => typeof v === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const dateOk = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const FIELD_LABELS = { startDate: "Start date", endDate: "End date", conduct: "Character / conduct", leavingReason: "Reason for leaving", feeClearance: "Reviewed clearance", dob: "Date of birth in the student record", salaryAmount: "Salary amount", salaryPeriod: "Salary period", achievement: "Contribution / statement" };
const VARIABLES = ["name", "admissionNumber", "employeeId", "schoolName", "class", "dob", "academicYear", "purpose", "designation", "department", "issueDate", ...Object.keys(FIELD_LABELS)];
const typeOf = (type) => catalog.find((entry) => entry.id === type);
const text = (value, label, max, required = false, multiline = false) => {
  const v = multiline ? clean(value) : clean(value).replace(/\s+/g, " ");
  if ((required && !v) || v.length > max || (value != null && typeof value !== "string")) fail(`Enter ${label.toLowerCase()}${max ? ` (up to ${max} characters)` : ""}.`);
  return v;
};
function image(value, label) {
  if (!value) return "";
  if (typeof value !== "string" || value.length > 140000 || !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value)) fail(`Choose a PNG or JPEG ${label} under 100 KB.`);
  try {
    const PDFDocument = require("pdfkit"), doc = new PDFDocument({ autoFirstPage: false });
    doc.resume(); const img = doc.openImage(value); doc.end();
    if (Buffer.from(value.split(",")[1], "base64").length > 100 * 1024 || img.width > 1800 || img.height > 1800) fail(`Resize the ${label} to at most 1800 x 1800 pixels and 100 KB.`);
  } catch (e) { if (e instanceof HttpsError) throw e; fail(`The ${label} image could not be read.`); }
  return value;
}
function defaultTemplate(type) {
  const item = typeOf(type); if (!item) fail("Choose a supported certificate type.");
  return { id: item.id, type: item.id, kind: item.kind, title: item.title, body: item.body, accent: "#1554BD", signatory: "", designation: "Principal", signatureImage: "", sealImage: "", version: 0 };
}
function validateTemplate(input) {
  const base = defaultTemplate(input.type), body = text(input.body, "Certificate wording", 3000, true, true);
  const allowed = new Set(["name", "schoolName", "purpose", "issueDate", ...(base.kind === "student" ? ["admissionNumber", "class", "dob", "academicYear"] : ["employeeId", "designation", "department"]), ...typeOf(input.type).fields]);
  for (const match of body.matchAll(/{{\s*([^{}]+?)\s*}}/g)) if (!allowed.has(match[1])) fail(`Unknown placeholder for this certificate: ${match[1]}.`);
  if (body.replace(/{{\s*[^{}]+?\s*}}/g, "").includes("{{") || body.replace(/{{\s*[^{}]+?\s*}}/g, "").includes("}}")) fail("Check the certificate placeholders.");
  const accent = clean(input.accent); if (!/^#[a-f\d]{6}$/i.test(accent)) fail("Choose a valid accent colour.");
  return { ...base, title: text(input.title, "Certificate title", 120, true), body, accent,
    signatory: text(input.signatory, "Signatory name", 160), designation: text(input.designation, "Signatory designation", 100, true),
    signatureImage: image(input.signatureImage, "signature"), sealImage: image(input.sealImage, "seal") };
}
function reviewForm(input, person, template, school, regional, academic, now) {
  const item = typeOf(input.type); if (!item || item.kind !== input.kind) fail("Choose a certificate for this recipient type.");
  if (!person || person.deleted === true) fail("This recipient record is unavailable. Review their school record first.", "failed-precondition");
  if (input.kind === "student" && input.type === "bonafide" && /withdrawn|left|transferred|inactive/i.test(person.status || "")) fail("A bonafide certificate requires a currently enrolled student.", "failed-precondition");
  if (input.type === "employment" && /left|relieved|terminated|inactive/i.test(person.status || "")) fail("An employment certificate requires a currently employed staff member.", "failed-precondition");
  const issuedOn = text(input.issuedOn, "Issue date", 10, true), today = schoolDate(now.getTime(), regional?.timezone);
  if (!dateOk(issuedOn) || issuedOn > today) fail("Choose a valid issue date, today or earlier.");
  const validTill = text(input.validTill, "Valid until", 10);
  if (validTill && (!dateOk(validTill) || validTill < issuedOn)) fail("Valid until must be on or after the issue date.");
  const fields = {};
  if (input.fields != null && (typeof input.fields !== "object" || Array.isArray(input.fields))) fail("Review the certificate details.");
  for (const key of Object.keys(input.fields || {})) if (!Object.hasOwn(FIELD_LABELS, key)) fail("An unsupported certificate field was supplied.");
  for (const key of item.fields) {
    const value = key === "dob" ? person.dob : input.fields?.[key];
    fields[key] = text(value, FIELD_LABELS[key], key === "achievement" ? 1200 : 300, true, key === "achievement");
    if (["startDate", "endDate", "dob"].includes(key) && (!dateOk(fields[key]) || fields[key] > issuedOn)) fail(`${FIELD_LABELS[key]} must be a valid date on or before the issue date.`);
  }
  if (fields.startDate && fields.endDate && fields.endDate < fields.startDate) fail("End date must be on or after the start date.");
  if (Object.hasOwn(fields, "salaryAmount") && (!/^\d+(?:\.\d{1,2})?$/.test(fields.salaryAmount) || Number(fields.salaryAmount) > 1e9)) fail("Enter a valid salary amount with up to two decimal places.");
  const schoolName = text(school.name, "School name in Settings", 250, true);
  const snapshot = { name: text(person.name, "Recipient name in their profile", 250, true),
    admissionNumber: text(person.grn, "Admission number", 100), employeeId: text(person.empId, "Employee number", 100),
    class: input.kind === "student" ? text([person.grade ? `Grade ${person.grade}` : "", person.streamName || "", person.section ? `Division ${person.section}` : ""].filter(Boolean).join(" - "), "Class", 200) : "",
    dob: text(person.dob, "Date of birth", 10), designation: text(person.designation || person.role, "Staff designation", 150),
    department: text(person.department, "Department", 150) || "School", academicYear: text(academic?.name || academic?.year || academic?.academicYear || school.academicYear, "Academic year", 60) || "the recorded academic year" };
  if (input.kind === "student" && (!snapshot.admissionNumber || !snapshot.class)) fail("Add the student's admission number and class to their profile first.", "failed-precondition");
  if (input.kind === "staff" && (!snapshot.employeeId || !snapshot.designation)) fail("Add the staff member's employee number and designation to their profile first.", "failed-precondition");
  const purpose = text(input.purpose, "Purpose", 300) || "the recipient's stated purpose";
  const issuer = text(input.issuer || template.signatory, "Authorised signatory", 160, true);
  return { schemaVersion: 2, type: item.id, recipientKind: item.kind, title: template.title, purpose, issuedOn, validTill, issuer,
    signatoryDesignation: template.designation, note: text(input.note, "Office note", 600), fields, recipientSnapshot: snapshot,
    templateSnapshot: { ...template }, schoolSnapshot: { name: schoolName, address: text(school.address, "School address", 500), city: text(school.city, "School city", 150),
      affiliation: text(school.affiliation, "Affiliation", 100), board: text(school.board, "Board", 100), logoPath: text(school.logoPath, "School logo path", 600) },
    studentId: item.kind === "student" ? input.recipientId : "", studentName: item.kind === "student" ? snapshot.name : "", grn: snapshot.admissionNumber,
    staffId: item.kind === "staff" ? input.recipientId : "", recipientName: snapshot.name, classId: item.kind === "student" ? clean(person.classId) : "",
    category: "bonafide" };
}
function certificateText(cert) {
  const fields = { ...cert.fields };
  if (fields.salaryAmount) fields.salaryAmount = `INR ${Number(fields.salaryAmount).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const values = { ...cert.recipientSnapshot, ...fields, name: cert.recipientSnapshot.name, schoolName: cert.schoolSnapshot.name, purpose: cert.purpose, issueDate: cert.issuedOn };
  return cert.templateSnapshot.body.replace(/{{\s*([^{}]+?)\s*}}/g, (_, key) => String(values[key] || "Not recorded"));
}
function publicCertificate(cert, today) {
  return { refNo: cert.refNo, title: cert.title, school: cert.schoolSnapshot?.name || "School", issuedOn: cert.issuedOn || "", validTill: cert.validTill || "",
    status: cert.status === "Revoked" ? "Revoked" : cert.status === "Issued" && cert.validTill && cert.validTill < today ? "Expired" : cert.status === "Issued" ? "Valid" : "Not valid" };
}
module.exports = { catalog, FIELD_LABELS, VARIABLES, clean, validId, fail, dateOk, typeOf, defaultTemplate, validateTemplate, reviewForm, certificateText, publicCertificate };
