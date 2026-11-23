// Synthetic local emulator only. No production credentials or school data are used.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where, setLogLevel } from "firebase/firestore";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || "")) throw new Error("A local Firestore emulator is required.");
const projectId = "demo-certificate-qa", env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port: Number(host.split(":")[1]), rules: readFileSync(process.env.CERTIFICATE_RULES_FILE || new URL("../../firestore.rules", import.meta.url), "utf8") } });
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app"), { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId }), db = getFirestore(app), { createCertificateManager, authorisedCertificate, verifyCertificate } = require("./certificateManagement");
const blobs = new Map();
const bucket = { file(path) { return { async exists() { return [blobs.has(path)]; }, async getMetadata() { if (!blobs.has(path)) throw new Error("Missing file"); return [blobs.get(path).metadata]; }, async download() { return [blobs.get(path).bytes]; }, async save(bytes, options) { if (options.preconditionOpts?.ifGenerationMatch === 0 && blobs.has(path)) throw Object.assign(new Error("Exists"), { code: 412 }); blobs.set(path, { bytes, metadata: { ...options.metadata, size: bytes.length } }); }, async copy(to) { blobs.set(to.path, blobs.get(path)); }, path }; } };
const now = () => new Date("2026-11-20T08:00:00Z"), manager = createCertificateManager({ db, bucket, now, verifyOrigin: () => "https://example.com" });
const auth = (uid = "admin", token = {}) => ({ uid, token }), school = db.doc("schools/S1");
const form = { kind: "student", recipientId: "student", type: "bonafide", templateVersion: 0, issuedOn: "2026-11-20", validTill: "", issuer: "Synthetic Principal", purpose: "Admission", note: "", fields: {} };
const call = (input, user = auth()) => manager({ auth: user, data: { schoolId: "S1", requestId: randomUUID(), ...input } });
let checks = 0; const check = async (label, run) => { await run(); console.log(`ok ${++checks} ${label}`); };
setLogLevel("silent");
try {
  await env.clearFirestore();
  const seed = { "users/admin": { role: "admin", schoolId: "S1", name: "Synthetic Admin" }, "users/other": { role: "admin", schoolId: "S2" }, "users/parent": { role: "parent", schoolId: "S1", studentIds: ["student"], classIds: ["cls_8B"] }, "users/teacher": { role: "teacher", schoolId: "S1", staffId: "staff" },
    "platform_schools/S1": { status: "active" }, "schools/S1/school/school": { name: "Synthetic School", academicYear: "2026-27" }, "schools/S1/students/student": { name: "Synthetic Child", grn: "SYN-1", classId: "cls_8B", grade: "8", section: "B", dob: "2012-08-15" }, "schools/S1/staff/staff": { name: "Synthetic Employee", empId: "EMP-1", designation: "Teacher", department: "Science" },
    "schools/S1/certificates/legacy": { studentId: "student", studentName: "Synthetic Child", classId: "cls_8B", title: "Bonafide Certificate", status: "Issued", refNo: "CERT/2026/0007" } };
  for (const [path, data] of Object.entries(seed)) await db.doc(path).set(data);
  let first, second;
  await check("parallel issues allocate distinct numbers after legacy records", async () => {
    [first, second] = await Promise.all([call({ action: "issue", form }), call({ action: "issue", form })]);
    assert.deepEqual([first.refNo, second.refNo].sort(), ["CERT/2026/0008", "CERT/2026/0009"]); assert.equal(first.status, "Issued"); assert.ok(blobs.size >= 2);
  });
  await check("replayed issue is idempotent and conflicting request reuse is rejected", async () => {
    const requestId = randomUUID(), data = { action: "issue", form, requestId }; const issued = await call(data);
    assert.deepEqual(await call(data), issued); await assert.rejects(call({ ...data, form: { ...form, purpose: "Changed" } }), /already used/);
  });
  await check("a failed renderer can resume using its saved snapshot and reserved number", async () => {
    const requestId = randomUUID(), broken = createCertificateManager({ db, bucket, now, renderPdf: async () => { throw new Error("Synthetic render failure"); } });
    await assert.rejects(broken({ auth: auth(), data: { schoolId: "S1", action: "issue", form, requestId } }), /Synthetic render failure/);
    const ref = school.collection("certificates").doc(`cer_${requestId}`), before = (await ref.get()).data(); assert.equal(before.status, "Preparing");
    await school.collection("students").doc("student").update({ name: "Changed later" });
    const result = await call({ action: "resumeIssue", certificateId: ref.id, requestId }); assert.equal(result.refNo, before.refNo); assert.equal((await ref.get()).get("recipientSnapshot.name"), "Synthetic Child");
  });
  await check("staff salary certificates have no parent/student linkage", async () => {
    const staff = await call({ action: "issue", form: { ...form, kind: "staff", recipientId: "staff", type: "salary", fields: { salaryAmount: "45000", salaryPeriod: "November 2026" } } });
    const saved = (await school.collection("certificates").doc(staff.id).get()).data(); assert.equal(saved.studentId, ""); assert.equal(saved.staffId, "staff");
    await assert.rejects(authorisedCertificate(db, { auth: auth("parent"), data: { schoolId: "S1", certificateId: staff.id } }), /cannot download/);
  });
  await check("cross-school and non-admin mutation attempts fail", async () => {
    await assert.rejects(call({ action: "issue", form }, auth("other")), /school/); await assert.rejects(call({ action: "issue", form }, auth("parent")), /cannot manage/); await assert.rejects(manager({ data: { action: "issue", form } }), /Sign in/);
  });
  await check("issued records cannot be edited; revocation needs reason and matching revision", async () => {
    await assert.rejects(call({ action: "saveDraft", certificateId: first.id, expectedRevision: first.revision, form }), /already been issued/);
    await assert.rejects(call({ action: "revoke", certificateId: first.id, expectedRevision: first.revision, reason: "" }), /reason/);
    await assert.rejects(call({ action: "revoke", certificateId: first.id, expectedRevision: 999, reason: "Superseded document" }), /changed/);
    const revoked = await call({ action: "revoke", certificateId: first.id, expectedRevision: first.revision, reason: "Corrected certificate required" }); assert.equal(revoked.status, "Revoked");
    await assert.rejects(authorisedCertificate(db, { auth: auth("parent"), data: { schoolId: "S1", certificateId: first.id } }), /not available/);
    assert.equal((await authorisedCertificate(db, { auth: auth(), data: { schoolId: "S1", certificateId: first.id } })).status, "Revoked");
  });
  await check("public verification reflects revocation and returns no personal information", async () => {
    const cert = (await school.collection("certificates").doc(first.id).get()).data();
    const result = await verifyCertificate.run({ data: { schoolId: "S1", token: cert.verifyToken }, rawRequest: { ip: "127.0.0.1" } }); assert.equal(result.status, "Revoked"); assert.ok(!JSON.stringify(result).includes("Synthetic Child")); assert.ok(!Object.hasOwn(result, "revokeReason"));
    const alias = await verifyCertificate.run({ data: { schoolId: cert.publicSchoolId, refNo: cert.refNo }, rawRequest: { ip: "127.0.0.1" } }); assert.equal(alias.status, "Revoked"); assert.match(cert.publicSchoolId, /^SCH-[a-f0-9]{20}$/);
  });
  await check("template edits are version checked and do not alter issued snapshots", async () => {
    const { defaultTemplate } = require("./certificateData");
    const saved = await call({ action: "saveTemplate", expectedVersion: 0, template: { ...defaultTemplate("bonafide"), title: "Revised Bonafide Certificate" } }); assert.equal(saved.version, 1);
    await assert.rejects(call({ action: "issue", form }), /template changed/); assert.equal((await school.collection("certificates").doc(second.id).get()).get("title"), "Bonafide Certificate");
  });
  await check("signed uploads retain the original and replay without adding history twice", async () => {
    const ref = school.collection("certificates").doc(second.id), original = (await ref.get()).data(), bytes = blobs.get(original.pdfPath).bytes;
    const input = { action: "attachSigned", requestId: randomUUID(), certificateId: second.id, expectedRevision: original.revision, content: bytes.toString("base64") };
    const result = await call(input); assert.deepEqual(await call(input), result);
    const events = await school.collection("certificate_history").where("certificateId", "==", second.id).get(), archive = events.docs.find((d) => d.get("action") === "Signed copy attached");
    assert.equal(events.docs.filter((d) => d.get("action") === "Signed copy attached").length, 1); assert.equal(archive.get("previousPdfPath"), original.pdfPath);
    const saved = await authorisedCertificate(db, { auth: auth(), data: { schoolId: "S1", certificateId: second.id, historyId: archive.id } }); assert.equal(saved.pdfPath, original.pdfPath);
    await assert.rejects(authorisedCertificate(db, { auth: auth("parent"), data: { schoolId: "S1", certificateId: second.id, historyId: archive.id } }), /historical file/);
  });
  await check("unfinished issues can be cancelled without recycling their reserved number", async () => {
    const requestId = randomUUID(), updatedForm = { ...form, templateVersion: 1 }, broken = createCertificateManager({ db, bucket, now, renderPdf: async () => { throw new Error("Render stopped"); } });
    await assert.rejects(broken({ auth: auth(), data: { schoolId: "S1", action: "issue", form: updatedForm, requestId } }), /Render stopped/);
    const ref = school.collection("certificates").doc(`cer_${requestId}`), pending = (await ref.get()).data();
    const cancelled = await call({ action: "reject", certificateId: ref.id, expectedRevision: pending.revision, reason: "Office cancelled this unfinished issue" }); assert.equal(cancelled.status, "Rejected");
    await assert.rejects(call({ action: "resumeIssue", requestId, certificateId: ref.id }), /no longer available/);
    const next = await call({ action: "issue", form: updatedForm }); assert.notEqual(next.refNo, pending.refNo);
  });
  await check("permissions are rechecked after rendering and a revoked admin session cannot finish an issue", async () => {
    const requestId = randomUUID(), { renderCertificate } = require("./certificatePdf"), { FieldValue } = require("firebase-admin/firestore");
    const interrupted = createCertificateManager({ db, bucket, now, renderPdf: async (...args) => { await db.doc("users/admin").update({ mfaVersion: "new-session-required" }); return renderCertificate(...args); } });
    await assert.rejects(interrupted({ auth: auth(), data: { schoolId: "S1", action: "issue", form: { ...form, templateVersion: 1 }, requestId } }), /cannot manage/);
    assert.equal((await school.collection("certificates").doc(`cer_${requestId}`).get()).get("status"), "Preparing"); await db.doc("users/admin").update({ mfaVersion: FieldValue.delete() });
    const resumed = await call({ action: "resumeIssue", requestId, certificateId: `cer_${requestId}` }); assert.equal(resumed.status, "Issued");
  });
  const admin = env.authenticatedContext("admin").firestore(), parent = env.authenticatedContext("parent").firestore(), guest = env.unauthenticatedContext().firestore();
  await check("client writes cannot forge certificates, counters, templates or history", async () => {
    for (const col of ["certificates", "certificate_counters", "certificate_templates", "certificate_snapshots", "certificate_history", "certificate_operations", "certificate_reference_index", "certificate_verification_index"]) await assertFails(setDoc(doc(admin, "schools/S1", col, "forged"), { value: 1 }));
    await assertFails(updateDoc(doc(admin, "schools/S1/certificates", second.id), { issuer: "Forged" }));
  });
  await check("parents can query their student certificates but not staff or other students", async () => {
    const result = await assertSucceeds(getDocs(query(collection(parent, "schools/S1/certificates"), where("studentId", "==", "student")))); assert.ok(result.size > 0);
    const staff = (await school.collection("certificates").where("staffId", "==", "staff").get()).docs[0]; await assertFails(getDoc(doc(parent, "schools/S1/certificates", staff.id)));
    await assertFails(getDocs(collection(guest, "schools/S1/certificates"))); await assertFails(getDocs(collection(parent, "schools/S1/certificate_history"))); await assertFails(getDocs(collection(parent, "schools/S1/certificate_snapshots")));
  });
  await check("bounded parent requests accept the new types and block schema pollution", async () => {
    const data = { studentId: "student", classId: "cls_8B", studentName: "Synthetic Child", grn: "SYN-1", type: "study", title: "Study Certificate", category: "bonafide", purpose: "School record", status: "Requested", requestedBy: "Parent", requestedAt: now().toISOString(), parentUid: "parent", updatedBy: "parent", updatedAt: now().toISOString() };
    await assertSucceeds(setDoc(doc(parent, "schools/S1/certificates/request"), data));
    for (const patch of [{ fields: { salaryAmount: "100000" } }, { recipientKind: "staff" }, { purpose: "A".repeat(301) }, { studentId: "other" }, { status: "Issued" }, { issuer: "Fake" }]) await assertFails(setDoc(doc(parent, "schools/S1/certificates/invalid"), { ...data, ...patch }));
  });
  await check("parent download notes cannot change identity or reopen revoked records", async () => {
    await assertSucceeds(updateDoc(doc(parent, "schools/S1/certificates", second.id), { downloadedAt: now().toISOString(), updatedAt: now().toISOString(), updatedBy: "parent" }));
    await assertFails(updateDoc(doc(parent, "schools/S1/certificates", second.id), { downloadedAt: "X".repeat(41), updatedBy: "parent" }));
    await assertFails(updateDoc(doc(parent, "schools/S1/certificates", first.id), { downloadedAt: now().toISOString(), updatedBy: "parent" }));
  });
  await check("issuing a parent request preserves its identity and refreshes details from the register", async () => {
    const result = await call({ action: "issue", certificateId: "request", expectedRevision: 0, form: { ...form, type: "study", fields: { startDate: "2024-06-03", endDate: "2026-11-20" } } });
    assert.equal(result.id, "request"); const saved = await school.collection("certificates").doc("request").get(); assert.equal(saved.get("parentUid"), "parent"); assert.equal(saved.get("studentName"), "Changed later"); assert.equal(saved.get("status"), "Issued");
  });
  console.log(`${checks} certificate integration and access checks passed`);
} finally { await env.cleanup(); await deleteApp(app); }
