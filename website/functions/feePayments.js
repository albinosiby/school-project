const { requireAdminSession, verifiedAdminSession } = require("./adminSession");
const { createHash } = require("node:crypto");
const { getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { schoolDate } = require("./schoolTime");

const clean = (value) => typeof value === "string" ? value.trim() : "";
const validId = (value) => typeof value === "string" && value.length > 0 && value.length <= 128 && !/[\/]/.test(value) && ![".", ".."].includes(value);
const hash = (value) => createHash("sha256").update(value).digest("hex");
const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100);
const normalizeReference = (value) => clean(value).replace(/\s+/g, "").toUpperCase();
const paymentModes = ["Cash", "UPI QR", "UPI", "Card", "Cheque", "NetBank", "Bank transfer", "Cash deposit at bank"];
const receiptSequence = (value) => Number(/(\d+)\s*$/.exec(value ?? "")?.[1] ?? 0);
const denied = () => new HttpsError("permission-denied", "Your account cannot record payments for this school.");

async function recordFeePayment(req) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in to record a payment.");
  await requireAdminSession(req);
  const input = req.data ?? {};
  const requestId = clean(input.requestId), invoiceId = clean(input.invoiceId), claimId = clean(input.claimId);
  const amountCents = cents(input.amount);
  if (!/^[a-f\d-]{36}$/i.test(requestId) || !validId(invoiceId) || (claimId && !validId(claimId)) ||
      typeof input.amount !== "number" || !Number.isFinite(input.amount) || amountCents <= 0 || amountCents > 1_000_000_000_00) {
    throw new HttpsError("invalid-argument", "Enter a valid invoice, payment amount and payment request.");
  }
  const db = getFirestore();
  const actorRef = db.collection("users").doc(uid);
  const ownerRef = db.collection("platform_admins").doc(uid);
  const actor = await actorRef.get();
  const owner = await ownerRef.get();
  const sid = owner.exists ? clean(input.schoolId) : clean(actor.get("schoolId"));
  if (!validId(sid) || (!owner.exists && actor.get("role") !== "admin")) throw denied();
  const school = db.collection("schools").doc(sid);
  const invoiceRef = school.collection("fee_invoices").doc(invoiceId);
  const requestRef = school.collection("fee_payment_requests").doc(requestId);
  const paymentRef = school.collection("fee_payments").doc(`pay_${requestId}`);
  const counterRef = school.collection("fee_counters").doc("receipts");
  const claimRef = claimId ? school.collection("fee_claims").doc(claimId) : null;
  const fingerprint = hash(JSON.stringify([uid, invoiceId, claimId, amountCents, clean(input.mode), normalizeReference(input.reference), clean(input.date)]));

  return db.runTransaction(async (tx) => {
    const [currentActor, currentOwner, platform, invoice, prior, counter, regional] = await tx.getAll(
      actorRef, ownerRef, db.collection("platform_schools").doc(sid), invoiceRef, requestRef, counterRef,
      school.collection("set_config").doc("regional"),
    );
    if (platform.get("rolloverJob") || (!currentOwner.exists && (!verifiedAdminSession(req.auth, currentActor.data()) || currentActor.get("role") !== "admin" || currentActor.get("schoolId") !== sid || platform.get("status") === "suspended"))) throw denied();
    if (prior.exists) {
      if (prior.get("fingerprint") !== fingerprint) throw new HttpsError("already-exists", "This payment request has already been used. Start a new payment.");
      const saved = await tx.get(school.collection("fee_payments").doc(prior.get("paymentId")));
      if (!saved.exists) throw new HttpsError("failed-precondition", "The payment receipt is unavailable. Contact the school administrator.");
      return { payment: saved.data(), replayed: true };
    }
    if (!invoice.exists) throw new HttpsError("not-found", "The invoice was not found.");
    const claim = claimRef ? await tx.get(claimRef) : null;
    if (claimRef && (!claim.exists || claim.get("invoiceId") !== invoiceId || claim.get("grn") !== invoice.get("grn"))) {
      throw new HttpsError("failed-precondition", "This claim does not match the invoice.");
    }
    if (claim?.get("status") === "Verified") {
      const previous = validId(claim.get("paymentId")) ? await tx.get(school.collection("fee_payments").doc(claim.get("paymentId"))) : null;
      if (!previous?.exists) throw new HttpsError("failed-precondition", "This claim was already verified. Reopen the payment history.");
      return { payment: previous.data(), replayed: true };
    }
    if (claim && claim.get("status") !== "Pending") throw new HttpsError("failed-precondition", "Only pending claims can be verified.");
    const mode = claim ? clean(claim.get("mode")) : clean(input.mode);
    const reference = normalizeReference(claim ? claim.get("reference") : input.reference);
    if (!paymentModes.includes(mode) || reference.length > 120 || (mode !== "Cash" && reference.length < 4)) {
      throw new HttpsError("invalid-argument", "Choose a payment method and enter its transaction reference.");
    }
    const today = schoolDate(Date.now(), regional.get("timezone"));
    const date = clean(claim ? claim.get("paidOn") : input.date) || today;
    const parsed = new Date(`${date}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== date || date > today) {
      throw new HttpsError("invalid-argument", "Enter a valid payment date that is not in the future.");
    }
    const billed = cents(invoice.get("amount")), paid = cents(invoice.get("paid") ?? 0);
    const balance = billed - paid;
    if (!Number.isSafeInteger(billed) || !Number.isSafeInteger(paid) || paid < 0 || balance < 0) throw new HttpsError("failed-precondition", "Review this invoice's balance before recording payment.");
    if (amountCents > balance) throw new HttpsError("failed-precondition", "The invoice balance changed. Refresh it before recording this payment.");
    const referenceRef = reference ? school.collection("fee_payment_references").doc(hash(reference)) : null;
    const reserved = referenceRef ? await tx.get(referenceRef) : null;
    if (reserved?.exists) throw new HttpsError("already-exists", "This transaction reference already has a receipt.");
    if (reference) {
      const recorded = await tx.get(school.collection("fee_payments").where("reference", "==", reference).limit(1));
      const legacy = await tx.get(school.collection("fee_payments").where("mode", "in", paymentModes.filter((value) => value !== "Cash").map((value) => `${value} · ${reference}`)).limit(1));
      if (!recorded.empty || !legacy.empty) throw new HttpsError("already-exists", "This transaction reference already has a receipt.");
    }
    // Only the initial receipt-counter bootstrap scans legacy receipt numbers.
    const existing = counter.exists ? null : await tx.get(school.collection("fee_payments").select("receiptNo"));
    const sequence = (existing?.docs.reduce((max, row) => Math.max(max, receiptSequence(row.get("receiptNo"))), Math.max(20400, counter.get("last") || 0)) ?? Math.max(20400, counter.get("last") || 0)) + 1;
    const receiptNo = `RCP-${sequence}`;
    const now = new Date().toISOString();
    const stamp = { updatedBy: uid, updatedAt: now };
    const by = clean(currentActor.get("name")) || clean(req.auth.token?.name) || "School administrator";
    const payment = { id: paymentRef.id, receiptNo, invoiceId, invoiceNo: invoice.get("no") || "", student: invoice.get("student") || "", grade: invoice.get("grade") || "",
      grn: invoice.get("grn") || "", amount: amountCents / 100, mode: reference ? `${mode} · ${reference}` : mode, date, by,
      ...(reference ? { reference } : {}), ...(claimId ? { claimId } : {}), ...stamp, _o: Date.parse(now) };
    const left = balance - amountCents;
    const status = !left ? "Paid" : invoice.get("due") && invoice.get("due") < today ? "Overdue" : "Partial";
    tx.create(paymentRef, payment);
    tx.update(invoiceRef, { paid: (paid + amountCents) / 100, balance: left / 100, status, ...stamp });
    tx.set(counterRef, { last: sequence, ...stamp });
    tx.create(requestRef, { fingerprint, paymentId: paymentRef.id, ...stamp });
    if (referenceRef) tx.create(referenceRef, { paymentId: paymentRef.id, ...stamp });
    if (claimRef) tx.update(claimRef, { status: "Verified", amount: amountCents / 100, receiptNo, paymentId: paymentRef.id, verifiedBy: by, verifiedByUid: uid, verifiedAt: now, ...stamp });
    tx.create(school.collection("set_audit").doc(), { at: now, actor: by, actorUid: uid, action: claimRef ? "Verified fee payment" : "Recorded fee payment", detail: `${receiptNo} · ${invoice.get("no") || invoiceId} · ${amountCents / 100}` });
    return { payment, replayed: false };
  });
}

exports.recordFeePayment = onCall(recordFeePayment);
