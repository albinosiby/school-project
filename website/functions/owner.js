// Owner console actions that need admin credentials (DATA_CONTRACT section 16). Callable from the admin web by product
// owners only: the caller's uid must have a platform_admins/{uid} doc. Everything else the console does goes through the
// Firestore rules directly.
//   ownerSetPassword  {uid, password}         sets a new password for a login of any school (never for an owner)
//   ownerDeleteSchool {schoolId, confirm}     removes a school for good: its logins, all of its data and its files
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { getStorage } = require("firebase-admin/storage");
const { logger } = require("firebase-functions/v2");
const { onCall, HttpsError } = require("firebase-functions/v2/https");

const db = () => getFirestore();
const SCHOOL_ID = /^[A-Za-z0-9_-]{1,128}$/;

async function requireOwner(req) {
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError("unauthenticated", "Sign in first.");
  if (!(await db().doc(`platform_admins/${uid}`).get()).exists) throw new HttpsError("permission-denied", "Only product owners can do this.");
  return uid;
}

exports.ownerSetPassword = onCall(async (req) => {
  const caller = await requireOwner(req);
  const { uid, password } = req.data ?? {};
  if (typeof uid !== "string" || !uid) throw new HttpsError("invalid-argument", "Which login?");
  if (typeof password !== "string" || password.length < 8 || password.length > 128) throw new HttpsError("invalid-argument", "The password needs 8 to 128 characters.");
  if ((await db().doc(`platform_admins/${uid}`).get()).exists) throw new HttpsError("permission-denied", "Owner passwords are not changed from the console.");
  const user = await db().doc(`users/${uid}`).get();
  if (!user.exists) throw new HttpsError("not-found", "This login does not belong to any school.");
  try { await getAuth().updateUser(uid, { password }); }
  catch (e) { if (e?.code === "auth/user-not-found") throw new HttpsError("not-found", "This login no longer exists."); throw e; }
  logger.info("owner set a password", { caller, uid, schoolId: user.get("schoolId") });
  return { ok: true };
});

exports.ownerDeleteSchool = onCall({ timeoutSeconds: 540, memory: "512MiB" }, async (req) => {
  const caller = await requireOwner(req);
  const { schoolId, confirm } = req.data ?? {};
  if (typeof schoolId !== "string" || !SCHOOL_ID.test(schoolId)) throw new HttpsError("invalid-argument", "Which school?");
  if (confirm !== schoolId) throw new HttpsError("failed-precondition", "Confirm the school id to delete it.");

  // every login of the school except product owners (an owner never loses their account with a school)
  const users = (await db().collection("users").where("schoolId", "==", schoolId).get()).docs;
  const owners = new Set((await Promise.all(users.map((u) => db().doc(`platform_admins/${u.id}`).get()))).filter((d) => d.exists).map((d) => d.id));
  const uids = users.map((u) => u.id).filter((id) => !owners.has(id));
  let loginsDeleted = 0;
  for (let i = 0; i < uids.length; i += 1000) {
    const r = await getAuth().deleteUsers(uids.slice(i, i + 1000));
    loginsDeleted += r.successCount;
    r.errors.forEach((e) => logger.warn("login not deleted", { uid: uids[i + e.index], error: e.error?.message }));
  }
  for (const u of users) await db().recursiveDelete(u.ref);
  await db().recursiveDelete(db().doc(`schools/${schoolId}`));
  await db().doc(`platform_schools/${schoolId}`).delete();
  // demo requests that became this school keep their history but no longer point at it
  const leads = await db().collection("leads").where("schoolId", "==", schoolId).get();
  await Promise.all(leads.docs.map((d) => d.ref.update({ schoolId: "", updatedAt: new Date().toISOString(), updatedBy: caller })));
  let files = 0;
  try {
    const bucket = getStorage().bucket();
    const [list] = await bucket.getFiles({ prefix: `schools/${schoolId}/` });
    files = list.length;
    if (files) await bucket.deleteFiles({ prefix: `schools/${schoolId}/`, force: true });
  } catch (e) { logger.warn("school files not deleted", { schoolId, error: e?.message }); }
  logger.info("owner deleted a school", { caller, schoolId, logins: loginsDeleted, users: users.length, files });
  return { ok: true, logins: loginsDeleted, files };
});
