// Read receipts for circulars (DATA_CONTRACT section 10): com_notices/{id}/receipts/{uid} = {uid, role, name, readAt, ackAt?}.
// Only functions write them. The apps signal through what they may already write:
//   - teacher app: its private att_circulars/{noticeId} overlay ({read, ack}, updatedBy = the teacher's auth uid);
//   - parent app: its par_notifications row for the notice turning read (the row carries noticeId), and the
//     existing com_notices/{id}/acks/{uid} acknowledgement (parent.js onNoticeAck calls recordReceipt).
// The notice's `read` / `acked` counters go up once per person: the first read, and the first acknowledgement
// (which also counts as read when nothing was read before).
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { onDocumentWritten, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions/v2");

/** What a new read / acknowledgement changes on an existing receipt (null = nothing new). */
function receiptChange(existing, { read = false, ack = false, at }) {
  const r = existing ?? {};
  const addRead = (read || ack) && !r.readAt;
  const addAck = ack && !r.ackAt;
  if (!addRead && !addAck) return null;
  return {
    receipt: { ...(addRead ? { readAt: at } : {}), ...(addAck ? { ackAt: at } : {}) },
    read: addRead ? 1 : 0,
    acked: addAck ? 1 : 0,
  };
}

/** Records [uid]'s read / acknowledgement of a published notice and bumps its counters once. */
async function recordReceipt(db, sid, noticeId, uid, { role, name = "", read = false, ack = false, at = new Date().toISOString() }) {
  if (!sid || !noticeId || !uid) return false;
  const notice = db.collection("schools").doc(sid).collection("com_notices").doc(noticeId);
  const ref = notice.collection("receipts").doc(uid);
  return db.runTransaction(async (tx) => {
    const [n, r] = await Promise.all([tx.get(notice), tx.get(ref)]);
    if (!n.exists || n.get("status") !== "Published") return false;
    const change = receiptChange(r.exists ? r.data() : null, { read, ack, at });
    if (!change) return false;
    tx.set(ref, { uid, role, name, ...change.receipt }, { merge: true });
    tx.update(notice, { read: FieldValue.increment(change.read), acked: FieldValue.increment(change.acked) });
    return true;
  });
}

const nameOf = async (db, uid) => {
  try { return String((await db.collection("users").doc(uid).get()).get("name") ?? ""); } catch { return ""; }
};

// teacher app: opening a circular sets read, Acknowledge sets ack, on the teacher's private overlay
const onCircularStateForReceipts = onDocumentWritten("schools/{sid}/att_circulars/{id}", async (e) => {
  const before = e.data?.before?.data(), after = e.data?.after?.data();
  const uid = String(after?.updatedBy ?? "");
  if (!after || !uid) return;
  const read = after.read === true && before?.read !== true, ack = after.ack === true && before?.ack !== true;
  if (!read && !ack) return;
  const db = getFirestore();
  const done = await recordReceipt(db, e.params.sid, e.params.id, uid, { role: "teacher", name: await nameOf(db, uid), read, ack });
  if (done) logger.info("circular receipt", { sid: e.params.sid, notice: e.params.id, role: "teacher", read, ack });
});

// parent app: the notification for a notice is opened (or marked read)
const onParentNoticeRead = onDocumentUpdated("schools/{sid}/par_notifications/{id}", async (e) => {
  const before = e.data.before.data(), after = e.data.after.data();
  if (!after?.noticeId || !after.uid || before.read === true || after.read !== true) return;
  const db = getFirestore();
  await recordReceipt(db, e.params.sid, String(after.noticeId), String(after.uid), { role: "parent", name: await nameOf(db, String(after.uid)), read: true });
});

module.exports = { receiptChange, recordReceipt, nameOf, onCircularStateForReceipts, onParentNoticeRead };
