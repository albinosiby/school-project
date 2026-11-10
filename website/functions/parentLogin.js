const { createCipheriv, createDecipheriv, createHash, randomBytes, randomInt, scrypt, timingSafeEqual } = require("node:crypto");
const { promisify } = require("node:util");
const { getAuth } = require("firebase-admin/auth");
const { FieldValue, getFirestore } = require("firebase-admin/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { info } = require("firebase-functions/logger");
const { defineSecret } = require("firebase-functions/params");

const deriveHash = promisify(scrypt);
const parentPasswordKey = defineSecret("PARENT_PASSWORD_ENCRYPTION_KEY");
const attemptWindow = 5 * 60_000;
const maxAttempts = 8;
const pinAttemptWindow = 24 * 60 * 60_000;
const pinMaxAttempts = 5;
const sixDigits = /^\d{6}$/;
const normalize = (email) => typeof email === "string" ? email.trim().toLowerCase() : "";
const validEmail = (email) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validId = (id) => typeof id === "string" && id.length > 0 && id.length <= 128 && !id.includes("/") && id !== "." && id !== "..";
const digest = (value) => createHash("sha256").update(value).digest("hex");
const credentialRef = (db, email) => db.collection("parent_credentials").doc(digest(email));
const missingUser = (error) => error.code === "auth/user-not-found";
const unavailable = () => new HttpsError("failed-precondition", "This email cannot be used for parent app access.");

function passwordKey() {
  const key = parentPasswordKey.value();
  if (!/^[0-9a-f]{64}$/i.test(key ?? "")) throw new HttpsError("internal", "Parent password storage is unavailable.");
  return Buffer.from(key, "hex");
}

const passwordContext = (sid, uid, version) => Buffer.from(JSON.stringify([sid, uid, version]));

function encryptPassword(password, context) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", passwordKey(), iv);
  cipher.setAAD(context);
  const ciphertext = Buffer.concat([cipher.update(password, "utf8"), cipher.final()]);
  return { iv: iv.toString("hex"), ciphertext: ciphertext.toString("hex"), tag: cipher.getAuthTag().toString("hex") };
}

function decryptPassword({ iv, ciphertext, tag }, context) {
  const decipher = createDecipheriv("aes-256-gcm", passwordKey(), Buffer.from(iv, "hex"), { authTagLength: 16 });
  decipher.setAAD(context);
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

function requireAccessAdmin(staff, school, sid) {
  if (staff.get("schoolId") !== sid || staff.get("role") !== "admin" || school.get("status") === "suspended") {
    throw new HttpsError("permission-denied", "Only a school admin can manage parent app access.");
  }
}

function requireStudent(student) {
  if (!student.exists || student.get("deleted") === true) throw new HttpsError("not-found", "Student record not found.");
}

function projection(students) {
  const values = (field) => [...new Set(students.map((row) => row.get(field)).filter((value) => value != null && value !== "").map(String))].sort();
  return { studentIds: students.map((row) => row.id).sort(), classIds: values("classId"), grns: values("grn") };
}

async function siblingsFor(tx, student, uid) {
  const links = await tx.get(student.ref.parent.where("guardianUids", "array-contains", uid));
  return links.docs.filter((row) => row.id !== student.id && row.get("deleted") !== true);
}

async function unlinkAccess(tx, db, student, sid, actorUid, unlinkUid) {
  const current = student.get("guardianUids") ?? [];
  if (unlinkUid && !current.includes(unlinkUid)) return;
  const removed = unlinkUid ? [unlinkUid] : current.filter(validId);
  const profiles = removed.length ? await tx.getAll(...removed.map((uid) => db.collection("users").doc(uid))) : [];
  const updates = [];
  let clearEmail = !unlinkUid || student.get("emailGuardianUid") === unlinkUid;
  const loginEmail = normalize(student.get("guardianEmail"));
  for (const profile of profiles) {
    if (profile.get("schoolId") !== sid || profile.get("role") !== "parent") continue;
    if (loginEmail && normalize(profile.get("email")) === loginEmail) clearEmail = true;
    updates.push([profile.ref, projection(await siblingsFor(tx, student, profile.id))]);
  }
  for (const [ref, fields] of updates) tx.update(ref, fields);
  tx.update(student.ref, {
    guardianUids: unlinkUid ? current.filter((uid) => uid !== unlinkUid) : [],
    ...(clearEmail ? { guardianEmail: "", pendingParentLoginEmail: FieldValue.delete(), emailGuardianUid: FieldValue.delete(), guardianLoginName: FieldValue.delete(),
      guardianEmailLinkStatus: FieldValue.delete() } : {}),
    updatedBy: actorUid, updatedAt: new Date().toISOString(),
  });
}

async function resolveParentUid(auth, sid, email, saved) {
  if (saved.exists) {
    if (saved.get("schoolId") !== sid || !validId(saved.get("uid"))) throw unavailable();
    return saved.get("uid");
  }
  // Reuse a legacy Auth identity when possible so existing links and consent keep the same UID.
  try {
    return (await auth.getUserByEmail(email)).uid;
  } catch (error) {
    if (!missingUser(error)) throw error;
    return "par_" + digest(JSON.stringify([sid, email]));
  }
}

function isSameParent(profile, sid, email) {
  return profile.get("schoolId") === sid && profile.get("role") === "parent" && normalize(profile.get("email")) === email;
}

function requireAvailable(profile, owner, saved, uid, sid, email) {
  const deterministic = uid === "par_" + digest(JSON.stringify([sid, email]));
  if (owner.exists || (profile.exists ? !isSameParent(profile, sid, email) : !deterministic) ||
      (saved.exists && (saved.get("uid") !== uid || saved.get("schoolId") !== sid))) throw unavailable();
}

exports.setParentAppAccess = onCall({ timeoutSeconds: 60, secrets: [parentPasswordKey] }, async (req) => {
  const actorUid = req.auth?.uid;
  if (!actorUid) throw new HttpsError("unauthenticated", "Sign in to manage parent app access.");
  const { studentId, enabled, email: submittedEmail, regenerate = false, unlinkUid } = req.data ?? {};
  const email = normalize(submittedEmail);
  if (!validId(studentId) || typeof enabled !== "boolean" || typeof regenerate !== "boolean" ||
      (enabled && !validEmail(email)) || (unlinkUid !== undefined && (enabled || !validId(unlinkUid)))) {
    throw new HttpsError("invalid-argument", "Check the student and parent login details.");
  }

  const db = getFirestore();
  const users = db.collection("users");
  const actorRef = users.doc(actorUid);
  const actor = await actorRef.get();
  const sid = actor.get("schoolId");
  if (!validId(sid)) throw new HttpsError("permission-denied", "Only a school admin can manage parent app access.");
  const schoolRef = db.collection("platform_schools").doc(sid);
  const studentRef = db.collection("schools").doc(sid).collection("students").doc(studentId);
  const [school, student] = await db.getAll(schoolRef, studentRef);
  requireAccessAdmin(actor, school, sid);
  requireStudent(student);

  if (!enabled) {
    await db.runTransaction(async (tx) => {
      const [staff, currentSchool, current] = await tx.getAll(actorRef, schoolRef, studentRef);
      requireAccessAdmin(staff, currentSchool, sid);
      requireStudent(current);
      await unlinkAccess(tx, db, current, sid, actorUid, unlinkUid);
    });
    return { state: "off" };
  }

  const credentials = credentialRef(db, email);
  const auth = getAuth();
  const uid = await resolveParentUid(auth, sid, email, await credentials.get());
  const parentRef = users.doc(uid);
  const ownerRef = db.collection("platform_admins").doc(uid);
  // Old setup flows could leave a disabled Auth identity. Recover that identity
  // only when the same school's pending parent profile proves who owns it.
  const existing = await auth.getUser(uid).catch((error) => {
    if (!missingUser(error)) throw error;
    return null;
  });
  if (existing?.disabled) {
    const [profile, owner] = await db.getAll(parentRef, ownerRef);
    const currentEmail = normalize(student.get("guardianEmail"));
    if (owner.exists || !isSameParent(profile, sid, email) || !profile.get("parentPasswordPending") ||
        (currentEmail && currentEmail !== email)) throw unavailable();
    await auth.updateUser(uid, { disabled: false });
  }
  const result = await db.runTransaction(async (tx) => {
    const [staff, currentSchool, current, parent, saved, owner] = await tx.getAll(actorRef, schoolRef, studentRef, parentRef, credentials, ownerRef);
    requireAccessAdmin(staff, currentSchool, sid);
    requireStudent(current);
    requireAvailable(parent, owner, saved, uid, sid, email);
    const currentEmail = normalize(current.get("guardianEmail"));
    if (currentEmail && currentEmail !== email) throw new HttpsError("failed-precondition", "Turn off the existing login before using a different email.");
    const siblings = await siblingsFor(tx, current, uid);
    const linkedHere = (current.get("guardianUids") ?? []).includes(uid);
    if (regenerate && !linkedHere && currentEmail !== email) {
      throw new HttpsError("failed-precondition", "Link this parent before replacing their password.");
    }
    const issue = !saved.exists || parent.get("parentCredentialVersion") !== saved.get("version") ||
      regenerate || (!linkedHere && !siblings.length);
    const now = Date.now();
    if (issue && regenerate && saved.get("issuedAt") > now - 30_000) {
      throw new HttpsError("resource-exhausted", "Wait 30 seconds before replacing the parent password.");
    }

    const parentFields = projection([...siblings, current]);
    let password;
    if (issue) {
      do {
        password = String(randomInt(1_000_000)).padStart(6, "0");
      } while (saved.get("format") === "pin6" &&
        (await deriveHash(password, saved.get("salt"), 32)).toString("hex") === saved.get("hash"));
      const salt = randomBytes(16).toString("hex");
      const hash = (await deriveHash(password, salt, 32)).toString("hex");
      const version = randomBytes(16).toString("hex");
      const encryptedPassword = encryptPassword(password, passwordContext(sid, uid, version));
      tx.set(credentials, { uid, schoolId: sid, salt, hash, encryptedPassword, version, format: "pin6", issuedAt: now, issuedBy: actorUid });
      Object.assign(parentFields, { parentCredentialVersion: version });
      if (parent.exists) Object.assign(parentFields, {
        parentPasswordPending: FieldValue.delete(), temporaryPasswordExpiresAt: FieldValue.delete(), parentInviteStatus: FieldValue.delete(),
      });
      tx.delete(db.collection("parent_password_setup").doc(uid));
    }
    if (parent.exists) tx.update(parentRef, parentFields);
    else tx.create(parentRef, { schoolId: sid, role: "parent", email, name: current.get("guardian") || "Parent",
      ...parentFields, createdAt: new Date(now).toISOString() });
    tx.update(studentRef, {
      guardianEmail: email, pendingParentLoginEmail: FieldValue.delete(), guardianLoginName: current.get("guardian") || "Parent",
      emailGuardianUid: uid, guardianUids: FieldValue.arrayUnion(uid), guardianEmailLinkStatus: FieldValue.delete(),
      updatedBy: actorUid, updatedAt: new Date(now).toISOString(),
    });
    return issue ? { state: "issued", email, password } : { state: "active", email };
  });
  return result;
});

exports.revealParentPassword = onCall({ timeoutSeconds: 30, secrets: [parentPasswordKey] }, async (req) => {
  const actorUid = req.auth?.uid;
  if (!actorUid) throw new HttpsError("unauthenticated", "Sign in to view the parent password.");
  const { studentId, version } = req.data ?? {};
  if (!validId(studentId) || !validId(version)) throw new HttpsError("invalid-argument", "Check the student and parent login details.");

  const db = getFirestore();
  const users = db.collection("users");
  const changed = () => new HttpsError("failed-precondition", "The parent login has changed. Refresh Student Details and try again.");
  const result = await db.runTransaction(async (tx) => {
    const staff = await tx.get(users.doc(actorUid));
    const sid = staff.get("schoolId");
    if (!validId(sid)) throw new HttpsError("permission-denied", "Only a school admin can view parent passwords.");
    const studentRef = db.collection("schools").doc(sid).collection("students").doc(studentId);
    const [school, student] = await tx.getAll(db.collection("platform_schools").doc(sid), studentRef);
    requireAccessAdmin(staff, school, sid);
    requireStudent(student);

    const email = normalize(student.get("guardianEmail"));
    if (!validEmail(email)) throw changed();
    const saved = await tx.get(credentialRef(db, email));
    const uid = saved.get("uid");
    const links = student.get("guardianUids");
    if (saved.get("schoolId") !== sid || saved.get("version") !== version || !validId(uid) ||
        !Array.isArray(links) || !links.includes(uid)) throw changed();
    const parent = await tx.get(users.doc(uid));
    if (!isSameParent(parent, sid, email) || parent.get("parentCredentialVersion") !== version) throw changed();
    const encrypted = saved.get("encryptedPassword");
    return encrypted ? { sid, uid, encrypted } : null;
  }, { readOnly: true });
  if (!result) return { state: "replacement-required" };

  const { sid, uid, encrypted } = result;
  let password;
  try {
    password = decryptPassword(encrypted, passwordContext(sid, uid, version));
  } catch {
    throw new HttpsError("internal", "The parent password could not be retrieved.");
  }
  info("Parent password revealed", { actorUid, schoolId: sid, studentId, parentUid: uid });
  return { state: "revealed", password };
});

exports.signInParent = onCall({ timeoutSeconds: 30, concurrency: 8 }, async (req) => {
  const { email: submittedEmail, password } = req.data ?? {};
  const email = normalize(submittedEmail);
  const invalid = () => new HttpsError("unauthenticated", "Incorrect email or password. Ask your school if you need a replacement.");
  if (!validEmail(email) || typeof password !== "string" || (!sixDigits.test(password) && (password.length < 12 || password.length > 128))) throw invalid();

  const db = getFirestore();
  const ref = credentialRef(db, email);
  const credentials = await db.runTransaction(async (tx) => {
    const saved = await tx.get(ref);
    if (!saved.exists) throw invalid();
    const isPin = saved.get("format") === "pin6";
    if (isPin !== sixDigits.test(password)) throw invalid();
    const now = Date.now();
    const windowStart = saved.get("windowStart") ?? 0;
    const window = isPin ? pinAttemptWindow : attemptWindow;
    const inWindow = now - windowStart < window;
    const attempts = inWindow ? (saved.get("attempts") ?? 0) : 0;
    if (attempts >= (isPin ? pinMaxAttempts : maxAttempts)) {
      throw new HttpsError("resource-exhausted", isPin
        ? "Too many attempts. Contact your school to replace your password."
        : "Too many attempts. Try again in a few minutes.");
    }
    tx.update(ref, { attempts: attempts + 1, windowStart: inWindow ? windowStart : now });
    return saved.data();
  });
  const { uid, schoolId: sid, version, hash, salt } = credentials;
  const expected = Buffer.from(hash, "hex");
  const actual = await deriveHash(password, salt, 32);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid();

  const auth = getAuth();
  const [parent, school] = await db.getAll(db.collection("users").doc(uid), db.collection("platform_schools").doc(sid));
  if (!isSameParent(parent, sid, email) || parent.get("parentCredentialVersion") !== version ||
      school.get("status") === "suspended") throw invalid();
  const links = await db.collection("schools").doc(sid).collection("students").where("guardianUids", "array-contains", uid).get();
  if (!links.docs.some((row) => row.get("deleted") !== true)) throw invalid();

  // Custom sign-in creates an Auth identity when needed. Respect identities
  // explicitly disabled by the school or platform.
  try {
    const user = await auth.getUser(uid);
    if (user.disabled) throw invalid();
  } catch (error) {
    if (!missingUser(error)) throw error;
  }
  const token = await auth.createCustomToken(uid, { parentCredentialVersion: version });
  await db.runTransaction(async (tx) => {
    const latest = await tx.get(ref);
    if (latest.get("version") !== version) throw invalid();
    tx.update(ref, { attempts: 0, windowStart: 0 });
  });
  return { token };
});
