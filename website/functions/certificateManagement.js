const { createHash, randomBytes } = require("node:crypto");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { verifiedAdminSession } = require("./adminSession");
const { schoolDate } = require("./schoolTime");
const { clean, validId, fail, typeOf, defaultTemplate, validateTemplate, reviewForm, publicCertificate } = require("./certificateData");
const hash = (v) => createHash("sha256").update(v).digest("hex");
const uuid = (v) => typeof v === "string" && /^[a-f\d-]{36}$/i.test(v);
const json = (value) => JSON.stringify(value, (_, v) => v && !Array.isArray(v) && typeof v === "object" ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
const options = { timeoutSeconds: 120, memory: "512MiB" };
function origin() {
  const configured = process.env.CERTIFICATE_VERIFY_ORIGIN;
  const url = new URL(configured || (process.env.FUNCTIONS_EMULATOR === "true" ? "http://localhost:3000" : `https://${process.env.GCLOUD_PROJECT || "school-admin-tatos-2610"}.web.app`));
  if (url.protocol !== "https:" && !(process.env.FUNCTIONS_EMULATOR === "true" && ["localhost", "127.0.0.1"].includes(url.hostname))) fail("Configure a secure certificate verification origin.", "failed-precondition");
  return url.origin;
}
function assertAdmin(req, actor, owner, platform, sid) {
  if (!owner.exists && (!actor.exists || actor.get("role") !== "admin" || actor.get("schoolId") !== sid || !verifiedAdminSession(req.auth, actor.data()))) fail("Your account cannot manage certificates for this school.", "permission-denied");
  if (platform.get("status") === "suspended" || platform.get("rolloverJob")) fail("This school is suspended or academic rollover is in progress.", "failed-precondition");
}
async function adminScope(db, req) {
  if (!req.auth?.uid) fail("Sign in to manage certificates.", "unauthenticated");
  const uid = req.auth.uid, actorRef = db.doc(`users/${uid}`), ownerRef = db.doc(`platform_admins/${uid}`);
  const [actor, owner] = await db.getAll(actorRef, ownerRef);
  const sid = owner.exists ? clean(req.data?.schoolId) : clean(actor.get("schoolId"));
  if (!validId(sid) || (req.data?.schoolId && req.data.schoolId !== sid)) fail("Choose your school before continuing.", "permission-denied");
  const platformRef = db.doc(`platform_schools/${sid}`), platform = await platformRef.get();
  assertAdmin(req, actor, owner, platform, sid);
  return { uid, sid, actorRef, ownerRef, platformRef, school: db.doc(`schools/${sid}`), by: clean(actor.get("name")) || clean(req.auth.token?.name) || "School administrator" };
}
async function recheck(tx, scope, req) { const docs = await tx.getAll(scope.actorRef, scope.ownerRef, scope.platformRef); assertAdmin(req, ...docs, scope.sid); }
async function logoBytes(bucket, sid, cert) {
  const path = cert.schoolSnapshot.logoPath;
  if (!path) return undefined;
  if (!path.startsWith(`schools/${sid}/branding/`) && !path.startsWith(`schools/${sid}/certificate-branding/`)) fail("Review the school logo in Settings.", "failed-precondition");
  const file = bucket.file(path), [meta] = await file.getMetadata();
  if (!Number(meta.size) || Number(meta.size) > 2 * 1024 * 1024 || !["image/png", "image/jpeg"].includes(meta.contentType)) fail("Choose a PNG or JPEG school logo up to 2 MB.", "failed-precondition");
  return (await file.download())[0];
}
const resultOf = (doc) => ({ id: doc.id, refNo: doc.refNo || "", status: doc.status, revision: doc.revision || 0 });
function createCertificateManager({ db, bucket, renderPdf = require("./certificatePdf").renderCertificate, now = () => new Date(), verifyOrigin = origin }) {
  return async (req) => {
    const input = req.data || {}, scope = await adminScope(db, req), { school, sid, uid, by } = scope;
    const at = now().toISOString(), resuming = input.action === "resumeIssue", action = resuming ? "issue" : input.action;
    if (!["preview", "saveDraft", "issue", "reject", "revoke", "saveTemplate", "attachSigned"].includes(action)) fail("Choose a certificate action.");
    if (action !== "preview" && !uuid(input.requestId)) fail("A valid request identifier is required. Reopen the form.");
    const requestRef = school.collection("certificate_operations").doc(input.requestId || "preview");
    const fingerprint = hash(json({ ...input, schoolId: sid, uid }));
    const audit = (tx, certificateId, event, detail = "") => tx.create(school.collection("certificate_history").doc(), { certificateId, action: event, detail, at, by, byUid: uid, _o: now().getTime() });
    if (action === "saveTemplate") {
      const template = validateTemplate(input.template || {}), ref = school.collection("certificate_templates").doc(template.type);
      return db.runTransaction(async (tx) => {
        await recheck(tx, scope, req);
        const [existing, operation] = await tx.getAll(ref, requestRef);
        if (operation.exists) { if (operation.get("fingerprint") !== fingerprint) fail("This request was already used.", "already-exists"); return operation.get("result"); }
        if ((existing.get("version") || 0) !== input.expectedVersion) fail("This template changed. Reopen it to review the latest version.", "failed-precondition");
        const saved = { ...template, version: (existing.get("version") || 0) + 1, updatedAt: at, updatedBy: uid };
        tx.set(ref, saved); audit(tx, `template:${template.type}`, "Template updated", `Version ${saved.version}`);
        const result = { id: template.type, version: saved.version }; tx.create(requestRef, { fingerprint, result, at }); return result;
      });
    }
    if (action === "attachSigned") {
      if (!validId(input.certificateId) || !Number.isSafeInteger(input.expectedRevision) || typeof input.content !== "string" || input.content.length > 8 * 1024 * 1024 || !/^[A-Za-z0-9+/=]+$/.test(input.content)) fail("Choose a signed PDF up to 6 MB.");
      const bytes = Buffer.from(input.content, "base64");
      if (bytes.length < 8 || bytes.length > 6 * 1024 * 1024 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail("Choose a valid signed PDF up to 6 MB.");
      const ref = school.collection("certificates").doc(input.certificateId), filePath = `schools/${sid}/certificate-files/${input.certificateId}/signed-${input.requestId}.pdf`;
      const existingOperation = await requestRef.get();
      if (existingOperation.exists) { if (existingOperation.get("fingerprint") !== fingerprint) fail("This request was already used.", "already-exists"); return existingOperation.get("result"); }
      const current = await ref.get();
      if (current.get("schemaVersion") !== 2 || current.get("status") !== "Issued" || current.get("revision") !== input.expectedRevision) fail("Reopen the issued certificate before attaching its signed PDF.", "failed-precondition");
      try { await bucket.file(filePath).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "application/pdf", cacheControl: "private, no-store", metadata: { sha256: hash(bytes) } } }); }
      catch (error) { if (error.code !== 412) throw error; const [meta] = await bucket.file(filePath).getMetadata(); if (meta.metadata?.sha256 !== hash(bytes)) fail("This upload request was already used for another file.", "already-exists"); }
      return db.runTransaction(async (tx) => {
        await recheck(tx, scope, req); const [cert, prior] = await tx.getAll(ref, requestRef);
        if (prior.exists) { if (prior.get("fingerprint") !== fingerprint) fail("This request was already used.", "already-exists"); return prior.get("result"); }
        if (cert.get("status") !== "Issued" || cert.get("revision") !== input.expectedRevision) fail("This certificate changed. Reopen its details.", "failed-precondition");
        const next = { pdfPath: filePath, pdfSha256: hash(bytes), signed: true, revision: input.expectedRevision + 1, updatedAt: at, updatedBy: uid };
        tx.update(ref, next); tx.create(school.collection("certificate_history").doc(), { certificateId: cert.id, action: "Signed copy attached", detail: "Original PDF retained in history", previousPdfPath: cert.get("pdfPath"), at, by, byUid: uid, _o: now().getTime() });
        const result = resultOf({ id: cert.id, ...cert.data(), ...next }); tx.create(requestRef, { fingerprint, result, at }); return result;
      });
    }
    if (["reject", "revoke"].includes(action)) {
      if (!validId(input.certificateId) || !Number.isSafeInteger(input.expectedRevision) || typeof input.reason !== "string" || input.reason.trim().length < 5 || input.reason.trim().length > 600) fail("Enter a reason of 5 to 600 characters.");
      const ref = school.collection("certificates").doc(input.certificateId);
      return db.runTransaction(async (tx) => {
        await recheck(tx, scope, req);
        const [cert, prior] = await tx.getAll(ref, requestRef);
        if (prior.exists) { if (prior.get("fingerprint") !== fingerprint) fail("This request was already used.", "already-exists"); return prior.get("result"); }
        if (!cert.exists) fail("Certificate not found.", "not-found");
        if ((cert.get("revision") || 0) !== input.expectedRevision) fail("This certificate changed. Reopen its details.", "failed-precondition");
        if (action === "revoke" ? cert.get("status") !== "Issued" : !["Requested", "Draft", "Preparing"].includes(cert.get("status"))) fail("This action is not available for the current certificate status.", "failed-precondition");
        const next = { status: action === "revoke" ? "Revoked" : "Rejected", revision: input.expectedRevision + 1, updatedAt: at, updatedBy: uid,
          ...(action === "reject" ? { rejectReason: input.reason.trim() } : { revokedAt: at }) };
        tx.update(ref, next); audit(tx, cert.id, next.status, input.reason.trim());
        const result = resultOf({ id: cert.id, ...cert.data(), ...next }); tx.create(requestRef, { fingerprint, result, at }); return result;
      });
    }
    if (resuming) {
      if (!validId(input.certificateId)) fail("Select the certificate to resume.");
      const pending = await school.collection("certificates").doc(input.certificateId).get();
      if (pending.get("issueRequestId") !== input.requestId || !["Preparing", "Issued"].includes(pending.get("status"))) fail("This issue request is no longer available.", "failed-precondition");
      const c = pending.data();
      input.form = { kind: c.recipientKind, recipientId: c.staffId || c.studentId, type: c.type, templateVersion: c.templateSnapshot.version, issuedOn: c.issuedOn, validTill: c.validTill, issuer: c.issuer, purpose: c.purpose, note: c.note, fields: c.fields };
      input.expectedRevision = c.revision;
    }
    const form = input.form;
    if (!form || !validId(form.recipientId) || !["student", "staff"].includes(form.kind) || !typeOf(form.type)) fail("Select a recipient and certificate type.");
    const certId = input.certificateId || `cer_${input.requestId || "preview"}`;
    if (!validId(certId) || (input.certificateId && (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0))) fail("Reopen the certificate form.");
    if (input.replacesId && !validId(input.replacesId)) fail("Choose a valid certificate to replace.");
    const ref = school.collection("certificates").doc(certId), personRef = school.collection(form.kind === "staff" ? "staff" : "students").doc(form.recipientId);
    const templateRef = school.collection("certificate_templates").doc(form.type);
    const prepare = async (tx) => {
      await recheck(tx, scope, req);
      const [person, templateDoc, schoolDoc, profile, regional, academic, existing, prior] = await tx.getAll(personRef, templateRef, school.collection("school").doc("school"),
        school.collection("set_config").doc("profile"), school.collection("set_config").doc("regional"), school.collection("set_config").doc("meta"), ref, requestRef);
      if (action !== "preview" && prior.exists) {
        if ((!resuming && prior.get("fingerprint") !== fingerprint) || (resuming && (prior.get("certificateId") !== certId || existing.get("issueRequestId") !== input.requestId))) fail("This request was already used. Reopen the form.", "already-exists");
        return { replay: true, cert: { id: certId, ...existing.data() }, complete: !!prior.get("result"), result: prior.get("result") };
      }
      if (existing.exists && (!input.certificateId || (existing.get("revision") || 0) !== input.expectedRevision || !["Requested", "Draft"].includes(existing.get("status")))) fail("This certificate changed or has already been issued. Reopen it to review.", "failed-precondition");
      if (existing.exists && (existing.get("studentId") || existing.get("staffId")) !== form.recipientId) fail("A request cannot be moved to another recipient.");
      if (existing.exists && existing.get("type") !== form.type) fail("A request's certificate type cannot be changed.");
      if (input.replacesId) {
        const previous = await tx.get(school.collection("certificates").doc(input.replacesId));
        if (!previous.exists || previous.get("status") !== "Revoked" || previous.get("replacementId") || (previous.get("studentId") || previous.get("staffId")) !== form.recipientId || previous.get("type") !== form.type) fail("Replacements require an unreplaced, revoked certificate for this recipient and type.", "failed-precondition");
      }
      const schoolInfo = { ...profile.data(), ...schoolDoc.data() };
      for (const key of ["name", "address", "affiliation"]) schoolInfo[key] = clean(schoolDoc.get(key)) || clean(profile.get(key));
      const template = templateDoc.exists ? templateDoc.data() : defaultTemplate(form.type);
      if ((template.version || 0) !== form.templateVersion) fail("The template changed. Reopen the form before issuing.", "failed-precondition");
      const model = reviewForm(form, person.data(), template, schoolInfo, regional.data(), academic.data(), now());
      const cert = { ...existing.data(), ...model, id: certId, schoolId: sid, revision: (existing.get("revision") || 0) + 1,
        status: action === "issue" ? "Preparing" : "Draft", requestedAt: existing.get("requestedAt") || at, requestedBy: existing.get("requestedBy") || "School office", updatedAt: at, updatedBy: uid,
        ...(input.replacesId ? { replacesId: input.replacesId } : {}) };
      if (action === "preview") return { cert };
      if (action === "issue") {
        const year = Number(schoolDate(now().getTime(), regional.get("timezone")).slice(0, 4)), counterRef = school.collection("certificate_counters").doc(String(year)), counter = await tx.get(counterRef);
        let sequence = counter.get("value") || 0;
        if (!counter.exists) {
          const legacy = await tx.get(school.collection("certificates").where("refNo", ">=", `CERT/${year}/`).where("refNo", "<", `CERT/${year}0`).limit(10000));
          if (legacy.size >= 10000) fail("Initialise the certificate counter from the existing register before issuing.", "failed-precondition");
          sequence = Math.max(0, ...legacy.docs.map((d) => /^CERT\/\d{4}\/(\d+)$/.exec(d.get("refNo") || "")?.[1]).filter(Boolean).map(Number));
        }
        if (!Number.isSafeInteger(sequence) || sequence < 0 || sequence >= 999999999) fail("Review the certificate number register.", "failed-precondition");
        const publicSchoolId = `SCH-${hash(sid).slice(0, 20)}`, schoolIndexRef = db.doc(`certificate_school_index/${publicSchoolId}`), schoolIndex = await tx.get(schoolIndexRef);
        if (schoolIndex.exists && schoolIndex.get("schoolId") !== sid) fail("Review this school's public verification identifier.", "failed-precondition");
        cert.publicSchoolId = publicSchoolId;
        cert.refNo = `CERT/${year}/${String(sequence + 1).padStart(4, "0")}`;
        cert.verifyToken = randomBytes(24).toString("base64url"); cert.issueRequestId = input.requestId;
        cert.pdfPath = `schools/${sid}/certificate-files/${certId}/${input.requestId}.pdf`;
        tx.set(counterRef, { value: sequence + 1, updatedAt: at });
        if (!schoolIndex.exists) tx.create(schoolIndexRef, { schoolId: sid });
        tx.create(school.collection("certificate_reference_index").doc(hash(cert.refNo.toUpperCase())), { certificateId: certId });
        tx.create(school.collection("certificate_verification_index").doc(hash(cert.verifyToken)), { certificateId: certId });
      }
      // Keep embedded signature/seal assets out of the realtime directory and parent queries.
      // A private snapshot preserves the exact bytes needed to resume an interrupted render.
      tx.set(school.collection("certificate_snapshots").doc(certId), { templateSnapshot: cert.templateSnapshot, revision: cert.revision, updatedAt: at });
      tx.set(ref, { ...cert, templateSnapshot: { ...cert.templateSnapshot, signatureImage: "", sealImage: "" } });
      tx.create(requestRef, { fingerprint, certificateId: certId, at, ...(action === "saveDraft" ? { result: resultOf(cert) } : {}) });
      audit(tx, certId, action === "issue" ? "Prepared for issue" : "Draft saved"); return { cert };
    };
    const prepared = await db.runTransaction(prepare), cert = prepared.cert;
    if (prepared.complete) return prepared.result;
    if (action === "saveDraft") return resultOf(cert);
    if (action === "issue" && (cert.status !== "Preparing" || cert.issueRequestId !== input.requestId)) fail("This issue request is no longer available.", "failed-precondition");
    if (action === "issue") {
      const snapshot = await school.collection("certificate_snapshots").doc(certId).get();
      if (!snapshot.exists || snapshot.get("revision") !== cert.revision) fail("The saved certificate snapshot could not be verified.", "failed-precondition");
      cert.templateSnapshot = snapshot.get("templateSnapshot");
    }
    // Copy the logo before PDF generation so deleting/replacing the school logo cannot alter a retry's artifact.
    if (action === "issue" && cert.schoolSnapshot.logoPath && !cert.schoolSnapshot.logoPath.startsWith(`schools/${sid}/certificate-branding/`)) {
      const source = cert.schoolSnapshot.logoPath;
      if (!source.startsWith(`schools/${sid}/branding/`)) fail("Review the school logo in Settings.", "failed-precondition");
      const target = `schools/${sid}/certificate-branding/${certId}-${input.requestId}`;
      if (!(await bucket.file(target).exists())[0]) await bucket.file(source).copy(bucket.file(target));
      cert.schoolSnapshot.logoPath = target;
      await db.runTransaction(async (tx) => { const fresh = await tx.get(ref); if (fresh.get("issueRequestId") === input.requestId && fresh.get("status") === "Preparing") tx.update(ref, { schoolSnapshot: cert.schoolSnapshot }); });
    }
    const verificationUrl = action === "issue" ? `${verifyOrigin()}/verify-certificate?school=${encodeURIComponent(cert.publicSchoolId || sid)}&token=${encodeURIComponent(cert.verifyToken)}` : "";
    const pdf = await renderPdf(cert, { logo: await logoBytes(bucket, sid, cert), draft: action === "preview", verificationUrl });
    if (pdf.length > 6 * 1024 * 1024) fail("The certificate PDF is too large. Reduce the logo and signature images.", "resource-exhausted");
    if (action === "preview") return { content: pdf.toString("base64"), filename: "certificate-preview.pdf" };
    const file = bucket.file(cert.pdfPath);
    // Concurrent retries have the same immutable destination. Only the first renderer writes the PDF.
    let artifactHash = hash(pdf);
    try { await file.save(pdf, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "application/pdf", cacheControl: "private, no-store", metadata: { sha256: artifactHash } } }); }
    catch (e) { if (e.code !== 412) throw e; const [meta] = await file.getMetadata(); artifactHash = meta.metadata?.sha256; if (!/^[a-f\d]{64}$/.test(artifactHash || "")) fail("The saved artifact could not be verified.", "failed-precondition"); }
    return db.runTransaction(async (tx) => {
      await recheck(tx, scope, req);
      const [fresh, recipient] = await tx.getAll(ref, personRef);
      if (fresh.get("status") === "Issued" && fresh.get("issueRequestId") === input.requestId) return resultOf({ id: certId, ...fresh.data() });
      if (fresh.get("status") !== "Preparing" || fresh.get("issueRequestId") !== input.requestId || !recipient.exists || recipient.get("deleted")) fail("The recipient or certificate changed during issue. Review it before retrying.", "failed-precondition");
      let previous;
      if (cert.replacesId) { previous = await tx.get(school.collection("certificates").doc(cert.replacesId)); if (previous.get("replacementId")) fail("This certificate already has a replacement.", "failed-precondition"); }
      const next = { status: "Issued", issuedAt: now().toISOString(), updatedAt: now().toISOString(), updatedBy: uid, pdfSha256: artifactHash, revision: cert.revision + 1 };
      tx.update(ref, next); audit(tx, certId, "Issued", cert.refNo);
      if (previous) { tx.update(previous.ref, { replacementId: certId, updatedAt: at }); audit(tx, previous.id, "Replacement issued", cert.refNo); }
      const result = resultOf({ ...cert, ...next }); tx.update(requestRef, { result }); return result;
    });
  };
}
exports.createCertificateManager = createCertificateManager;
exports.adminScope = adminScope;
exports.manageCertificate = onCall(options, (req) => createCertificateManager({ db: getFirestore(), bucket: getStorage().bucket() })(req));

async function authorisedCertificate(db, req) {
  if (!req.auth?.uid) fail("Sign in to download a certificate.", "unauthenticated");
  const { schoolId: sid, certificateId } = req.data || {};
  if (!validId(sid) || !validId(certificateId)) fail("Choose a valid certificate.");
  const [actor, owner, cert, platform] = await db.getAll(db.doc(`users/${req.auth.uid}`), db.doc(`platform_admins/${req.auth.uid}`), db.doc(`schools/${sid}/certificates/${certificateId}`), db.doc(`platform_schools/${sid}`));
  const data = cert.data(), admin = owner.exists || actor.get("role") === "admin" && actor.get("schoolId") === sid && verifiedAdminSession(req.auth, actor.data());
  const parent = actor.get("role") === "parent" && actor.get("schoolId") === sid && data?.recipientKind !== "staff" && (actor.get("studentIds") || []).includes(data?.studentId);
  const selfStaff = ["teacher", "staff", "driver", "attendant"].includes(actor.get("role")) && actor.get("schoolId") === sid && data?.recipientKind === "staff" && !!actor.get("staffId") && actor.get("staffId") === data?.staffId;
  const member = selfStaff ? await db.doc(`schools/${sid}/staff/${data.staffId}`).get() : null;
  const staff = selfStaff && member.exists && !member.get("deleted") && (!member.get("authUid") || member.get("authUid") === req.auth.uid);
  // Parent credential versions are checked as in the existing parent session rules.
  const credentialValid = !actor.get("parentCredentialVersion") || req.auth.token?.firebase?.sign_in_provider === "custom" && req.auth.token?.parentCredentialVersion === actor.get("parentCredentialVersion");
  if ((!admin && !(parent && credentialValid) && !staff) || platform.get("status") === "suspended" || actor.get("disabled") === true) fail("You cannot download this certificate.", "permission-denied");
  if (!data || (data.status !== "Issued" && !(admin && data.status === "Revoked")) || !data.pdfPath?.startsWith(`schools/${sid}/certificate-files/${certificateId}/`)) fail("An issued PDF is not available for this certificate.", "failed-precondition");
  let pdfPath = data.pdfPath;
  if (req.data.historyId) {
    if (!admin || !validId(req.data.historyId)) fail("You cannot download this historical file.", "permission-denied");
    const event = await db.doc(`schools/${sid}/certificate_history/${req.data.historyId}`).get();
    if (event.get("certificateId") !== certificateId || !event.get("previousPdfPath")?.startsWith(`schools/${sid}/certificate-files/${certificateId}/`)) fail("The historical file was not found.", "not-found");
    pdfPath = event.get("previousPdfPath");
  }
  return { ...data, pdfPath, id: cert.id, sid };
}
exports.authorisedCertificate = authorisedCertificate;
exports.downloadCertificate = onCall(options, async (req) => {
  const db = getFirestore(), cert = await authorisedCertificate(db, req);
  const filename = `${cert.refNo.replace(/[^\w-]/g, "-")}.pdf`;
  if (req.data.format === "url") {
    if (cert.status !== "Issued" || req.data.historyId) fail("Archived files can be downloaded by the school office.", "failed-precondition");
    const token = randomBytes(32).toString("base64url"), expiresAt = Date.now() + 5 * 60 * 1000;
    const actor = await db.doc(`users/${req.auth.uid}`).get();
    await db.collection("certificate_download_tokens").doc(hash(token)).set({ schoolId: cert.sid, certificateId: cert.id, expiresAt, deleteAt: new Date(expiresAt), uid: req.auth.uid, parentCredentialVersion: actor.get("parentCredentialVersion") || "", mfaVersion: actor.get("mfaVersion") || "" });
    const project = process.env.GCLOUD_PROJECT;
    const base = process.env.FUNCTIONS_EMULATOR === "true" ? `http://localhost:5001/${project}/asia-south1` : `https://asia-south1-${project}.cloudfunctions.net`;
    return { url: `${base}/certificateFile?token=${token}`, filename, expiresAt };
  }
  const file = getStorage().bucket().file(cert.pdfPath), [meta] = await file.getMetadata();
  if (Number(meta.size) > 6 * 1024 * 1024) fail("Download this certificate from the school office.", "resource-exhausted");
  return { content: (await file.download())[0].toString("base64"), filename };
});
exports.certificateFile = onRequest({ ...options, cors: false }, async (req, res) => {
  res.set("Cache-Control", "private, no-store"); res.set("X-Content-Type-Options", "nosniff"); res.set("Referrer-Policy", "no-referrer");
  if (req.method !== "GET" || typeof req.query.token !== "string" || !/^[\w-]{43}$/.test(req.query.token)) return res.status(404).send("Certificate download unavailable.");
  try {
    const db = getFirestore(), grant = await db.doc(`certificate_download_tokens/${hash(req.query.token)}`).get();
    if (!grant.exists || grant.get("expiresAt") < Date.now()) return res.status(410).send("This download link has expired. Open the certificate again in the app.");
    const [cert, platform, actor, owner] = await db.getAll(db.doc(`schools/${grant.get("schoolId")}/certificates/${grant.get("certificateId")}`), db.doc(`platform_schools/${grant.get("schoolId")}`), db.doc(`users/${grant.get("uid")}`), db.doc(`platform_admins/${grant.get("uid")}`));
    const sid = grant.get("schoolId"), cid = grant.get("certificateId"), data = cert.data();
    const admin = owner.exists || actor.get("role") === "admin" && actor.get("schoolId") === sid && (actor.get("mfaVersion") || "") === grant.get("mfaVersion");
    const parent = actor.get("role") === "parent" && actor.get("schoolId") === sid && data?.recipientKind !== "staff" && (actor.get("studentIds") || []).includes(data?.studentId) && (actor.get("parentCredentialVersion") || "") === grant.get("parentCredentialVersion");
    const selfStaff = ["teacher", "staff", "driver", "attendant"].includes(actor.get("role")) && actor.get("schoolId") === sid && data?.recipientKind === "staff" && !!actor.get("staffId") && actor.get("staffId") === data?.staffId;
    const member = selfStaff ? await db.doc(`schools/${sid}/staff/${data.staffId}`).get() : null;
    const staff = selfStaff && member.exists && !member.get("deleted") && (!member.get("authUid") || member.get("authUid") === grant.get("uid"));
    if (!data || data.status !== "Issued" || actor.get("disabled") === true || platform.get("status") === "suspended" || (!admin && !parent && !staff) || !data.pdfPath?.startsWith(`schools/${sid}/certificate-files/${cid}/`)) return res.status(404).send("Certificate download unavailable.");
    const file = getStorage().bucket().file(data.pdfPath), [meta] = await file.getMetadata();
    if (Number(meta.size) > 6 * 1024 * 1024) return res.status(413).send("Certificate file is too large.");
    res.set("Content-Type", "application/pdf"); res.set("Content-Disposition", `inline; filename="${String(data.refNo).replace(/[^\w-]/g, "-")}.pdf"`);
    return res.send((await file.download())[0]);
  } catch { return res.status(404).send("Certificate download unavailable."); }
});
exports.verifyCertificate = onCall({ timeoutSeconds: 20, memory: "256MiB" }, async (req) => {
  const db = getFirestore(), input = req.data || {}, token = clean(input.token), refNo = clean(input.refNo).toUpperCase();
  let sid = clean(input.schoolId);
  if (!validId(sid) || (!/^[\w-]{32}$/.test(token) && !/^CERT\/\d{4}\/\d{4,9}$/.test(refNo))) fail("Enter a certificate number or use its verification QR.");
  const minute = Math.floor(Date.now() / 60000), rate = db.doc(`certificate_verification_limits/${hash(`${req.rawRequest?.ip || "unknown"}:${minute}`)}`);
  await db.runTransaction(async (tx) => { const current = await tx.get(rate); if ((current.get("count") || 0) >= 60) fail("Too many verification attempts. Try again in a minute.", "resource-exhausted"); tx.set(rate, { count: (current.get("count") || 0) + 1, expiresAt: new Date((minute + 10) * 60000) }); });
  if (/^SCH-/i.test(sid)) {
    const school = await db.doc(`certificate_school_index/SCH-${sid.slice(4).toLowerCase()}`).get();
    if (!school.exists || !validId(school.get("schoolId"))) return { status: "Not found" };
    sid = school.get("schoolId");
  }
  const index = await db.doc(`schools/${sid}/${token ? "certificate_verification_index" : "certificate_reference_index"}/${hash(token || refNo)}`).get();
  if (!index.exists) return { status: "Not found" };
  const [cert, school] = await db.getAll(db.doc(`schools/${sid}/certificates/${index.get("certificateId")}`), db.doc(`platform_schools/${sid}`));
  if (!cert.exists || cert.get("schemaVersion") !== 2 || !["Issued", "Revoked"].includes(cert.get("status")) || school.get("status") === "suspended") return { status: "Not found" };
  return publicCertificate(cert.data(), schoolDate());
});
