const { createHash } = require("node:crypto");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const { schoolDate } = require("./schoolTime");
const { invoiceDisplayStatus, assertInvoiceStudentWritable } = require("./feeInvoiceState");
const clean = (v) => typeof v === "string" ? v.trim() : "";
const validId = (v) => typeof v === "string" && v.length > 0 && v.length <= 128 && !/[\/]/.test(v) && ![".", ".."].includes(v);

async function changeFeeInvoiceStatus(req) {
  if (!req.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to change an invoice status.");
  await requireAdminSession(req);
  const input = req.data ?? {}, uid = req.auth.uid;
  const requestId = clean(input.requestId), invoiceId = clean(input.invoiceId), status = clean(input.status), reason = clean(input.reason);
  if (!/^[a-f\d-]{36}$/i.test(requestId) || !validId(invoiceId) || !["Automatic", "Pending", "Overdue"].includes(status)
    || reason.length > 500 || (status !== "Automatic" && reason.length < 3)
    || !Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0
    || !Number.isFinite(input.expectedAmount) || !Number.isFinite(input.expectedPaid) || typeof input.expectedDue !== "string" || input.expectedDue.length > 10) {
    throw new HttpsError("invalid-argument", "Choose a status and enter a reason. Record a payment to mark an invoice Partial or Paid.");
  }
  const db = getFirestore(), actorRef = db.doc(`users/${uid}`), ownerRef = db.doc(`platform_admins/${uid}`);
  const [actor, owner] = await Promise.all([actorRef.get(), ownerRef.get()]);
  const sid = owner.exists ? clean(input.schoolId) : clean(actor.get("schoolId"));
  const denied = () => new HttpsError("permission-denied", "Your account cannot change invoice statuses for this school.");
  if (!validId(sid) || (!owner.exists && actor.get("role") !== "admin")) throw denied();
  const school = db.doc(`schools/${sid}`), invoiceRef = school.collection("fee_invoices").doc(invoiceId);
  const requestRef = school.collection("fee_invoice_status_requests").doc(requestId);
  const fingerprint = createHash("sha256").update(JSON.stringify([uid, invoiceId, status, reason, input.expectedRevision, input.expectedAmount, input.expectedPaid, input.expectedDue])).digest("hex");
  return db.runTransaction(async (tx) => {
    const [currentActor, currentOwner, platform, invoice, prior, regional] = await tx.getAll(actorRef, ownerRef, db.doc(`platform_schools/${sid}`), invoiceRef, requestRef, school.collection("set_config").doc("regional"));
    if (platform.get("rolloverJob") || (!currentOwner.exists && (!verifiedAdminSession(req.auth, currentActor.data())
      || currentActor.get("role") !== "admin" || currentActor.get("schoolId") !== sid || platform.get("status") === "suspended"))) throw denied();
    if (prior.exists) {
      if (prior.get("fingerprint") !== fingerprint) throw new HttpsError("already-exists", "This status request was already used. Reopen the status editor.");
      return prior.get("result");
    }
    if (!invoice.exists || invoice.get("deleted")) throw new HttpsError("not-found", "The invoice was not found.");
    await assertInvoiceStudentWritable(tx, school, invoice);
    const data = invoice.data(), paid = data.paid ?? 0, revision = data.statusRevision ?? 0;
    if (!Number.isFinite(data.amount) || !Number.isFinite(paid) || paid < 0 || data.amount < paid) throw new HttpsError("failed-precondition", "Review this invoice's balance first.");
    if (revision !== input.expectedRevision || data.amount !== input.expectedAmount || paid !== input.expectedPaid || (data.due || "") !== input.expectedDue) {
      throw new HttpsError("failed-precondition", "This invoice changed. Cancel and reopen the status editor to review it.");
    }
    if (status !== "Automatic" && Math.round((data.amount - paid) * 100) <= 0) throw new HttpsError("failed-precondition", "This invoice is settled. Changing status cannot undo its recorded payments.");
    const now = new Date().toISOString(), today = schoolDate(Date.now(), regional.get("timezone"));
    const by = clean(currentActor.get("name")) || clean(req.auth.token?.name) || "School administrator";
    // Invoices are parent-readable. Keep the private reason and editor in the
    // admin-only history, never on the invoice's public status override.
    const statusOverride = status === "Automatic" ? null : { status, amount: data.amount, paid, due: data.due || "" };
    const next = invoiceDisplayStatus({ ...data, statusOverride }, today);
    const result = { status: next, statusOverride, statusRevision: revision + 1, updatedAt: now, updatedBy: uid };
    tx.update(invoiceRef, result);
    tx.create(school.collection("fee_invoice_status_history").doc(requestId), { invoiceId, invoiceNo: data.no || "", from: invoiceDisplayStatus(data, today), to: next,
      mode: status === "Automatic" ? "Automatic" : "Manual", reason: reason || "Restored automatic status", at: now, by, byUid: uid, _o: Date.parse(now) });
    tx.create(requestRef, { fingerprint, result, updatedAt: now, updatedBy: uid });
    tx.create(school.collection("set_audit").doc(), { at: now, actor: by, actorUid: uid, action: "Changed invoice status", detail: `${data.no || invoiceId} · ${status} · ${reason || "Restored automatic status"}` });
    return result;
  });
}
exports.changeFeeInvoiceStatus = onCall(changeFeeInvoiceStatus);
