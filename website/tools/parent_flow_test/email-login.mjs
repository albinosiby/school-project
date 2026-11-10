import assert from "node:assert/strict";
import { createHash, scryptSync } from "node:crypto";
import { createRequire } from "node:module";

const projectId = process.env.GCLOUD_PROJECT;
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
const firestoreHost = process.env.FIRESTORE_EMULATOR_HOST;
const functionsHost = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
assert.ok(authHost && firestoreHost && projectId?.startsWith("demo-"), "Use local Firebase emulators.");

const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const { getStorage } = require("firebase-admin/storage");
const app = initializeApp({ projectId });
const db = getFirestore(app);
const auth = getAuth(app);
const sid = "managed-parent-school";
const email = "siblings@example.test";
const legacyPassword = "legacy-test-password";
const students = db.collection(`schools/${sid}/students`);
const [first, second, unrelated] = ["first", "second", "unrelated"].map((id) => students.doc(id));
const school = db.doc(`platform_schools/${sid}`);
const certId = "sample";
const storageHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;
const filePath = `schools/${sid}/certificates/${certId}/example.pdf`;
const storageFiles = `http://${storageHost}/v0/b/${projectId}.appspot.com/o`;
const readCertificate = async (token) => (await fetch(`${storageFiles}/${encodeURIComponent(filePath)}?alt=media`, {
  headers: { Authorization: `Firebase ${token}` },
})).status;
const schoolData = { guardian: "Guardian", guardianUids: [], classId: "cls_6A" };
const credential = db.collection("parent_credentials").doc(createHash("sha256").update(email).digest("hex"));

async function post(url, data, token) {
  const res = await fetch(url, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  return res.json();
}

const authApi = (action, body) => post(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:${action}?key=test`, body);
const call = (name, data, token) => post(`http://${functionsHost}/${projectId}/asia-south1/${name}`, { data }, token);
const access = (token, studentId, fields = {}) => call("setParentAppAccess", { studentId, enabled: true, email, ...fields }, token);
const reveal = (token, studentId, version) => call("revealParentPassword", { studentId, version }, token);
const signIn = (password, username = email) => call("signInParent", { email: username, password });
const read = async (token, ref) => (await fetch(
  `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/${ref.path}`,
  { headers: { Authorization: `Bearer ${token}` } },
)).status;

async function actor(address, schoolId, role) {
  const u = await auth.createUser({ email: address, password: legacyPassword });
  await db.doc(`users/${u.uid}`).set({ email: address, schoolId, role });
  const session = await authApi("signInWithPassword", { email: address, password: legacyPassword, returnSecureToken: true });
  assert.ok(session.idToken);
  return { u, token: session.idToken };
}

async function signInToFirebase(password, address = email) {
  const login = await signIn(password, address);
  assert.ok(login.result?.token, login.error?.message);
  const session = await authApi("signInWithCustomToken", { token: login.result.token, returnSecureToken: true });
  assert.ok(session.idToken, session.error?.message);
  return session;
}

try {
  const [admin, foreign, teacher, legacy] = await Promise.all([
    actor("principal@example.test", sid, "admin"),
    actor("foreign@example.test", "other-school", "admin"),
    actor("teacher@example.test", sid, "teacher"),
    actor(email, sid, "parent"),
  ]);
  await Promise.all([
    first.set(schoolData), second.set(schoolData), unrelated.set(schoolData),
    db.doc("schools/other-school/students/first").set(schoolData),
    school.set({ status: "active" }),
    db.doc(`schools/${sid}/certificates/${certId}`).set({ status: "Issued", studentId: second.id }),
  ]);
  const adminToken = admin.token;
  const parent = db.doc(`users/${legacy.u.uid}`);
  assert.equal((await access(teacher.token, first.id)).error?.status, "PERMISSION_DENIED");
  assert.equal((await access(foreign.token, first.id)).error?.status, "FAILED_PRECONDITION");
  assert.equal((await access(adminToken, first.id, { email: teacher.u.email })).error?.status, "FAILED_PRECONDITION");

  const results = await Promise.all([access(adminToken, first.id), access(adminToken, second.id)]);
  const issued = results.find((value) => value.result?.state === "issued")?.result;
  assert.match(issued?.password ?? "", /^\d{6}$/);
  assert.equal(results.filter((value) => value.result?.state === "active").length, 1);
  assert.deepEqual((await parent.get()).get("studentIds"), [first.id, second.id]);
  assert.equal((await first.get()).get("emailGuardianUid"), legacy.u.uid);
  const saved = await credential.get();
  const version = saved.get("version");
  const encryptedPassword = saved.get("encryptedPassword");
  assert.equal(saved.get("password"), undefined);
  assert.equal(saved.get("hash").length, 64);
  assert.match(encryptedPassword.ciphertext, /^[0-9a-f]{12}$/);
  assert.equal((await first.get()).get("encryptedPassword"), undefined);
  assert.equal((await parent.get()).get("encryptedPassword"), undefined);
  assert.deepEqual((await reveal(adminToken, first.id, version)).result, { state: "revealed", password: issued.password });
  assert.equal((await reveal(adminToken, second.id, version)).result?.password, issued.password);
  assert.equal((await reveal(undefined, first.id, version)).error?.status, "UNAUTHENTICATED");
  assert.equal((await reveal(teacher.token, first.id, version)).error?.status, "PERMISSION_DENIED");
  assert.equal((await reveal(foreign.token, first.id, version)).error?.status, "FAILED_PRECONDITION");
  assert.equal((await reveal(adminToken, unrelated.id, version)).error?.status, "FAILED_PRECONDITION");
  await school.update({ status: "suspended" });
  assert.equal((await reveal(adminToken, first.id, version)).error?.status, "PERMISSION_DENIED");
  await school.update({ status: "active" });
  const { encryptedPassword: _encrypted, ...hashOnly } = saved.data();
  await credential.set(hashOnly);
  assert.deepEqual((await reveal(adminToken, first.id, version)).result, { state: "replacement-required" });
  assert.equal((await credential.get()).get("version"), version);
  // The credential stays valid past the former 24-hour expiry.
  await credential.update({ issuedAt: Date.now() - 2 * 24 * 60 * 60_000 });

  const session = await signInToFirebase(issued.password, " Siblings@EXAMPLE.test ");
  assert.equal((await auth.verifyIdToken(session.idToken)).uid, legacy.u.uid);
  assert.deepEqual(await Promise.all([first, second, unrelated, credential].map((ref) => read(session.idToken, ref))), [200, 200, 403, 403]);
  assert.equal(await read(adminToken, credential), 403);
  assert.equal(await read(legacy.token, first), 403);
  assert.equal(await read(legacy.token, parent), 403);
  if (storageHost) {
    await getStorage(app).bucket(`${projectId}.appspot.com`).file(filePath).save("%PDF-1.7", {
      resumable: false, contentType: "application/pdf",
    });
    assert.equal(await readCertificate(session.idToken), 200);
    assert.equal(await readCertificate(legacy.token), 403);
  }
  const refreshed = await fetch(`http://${authHost}/securetoken.googleapis.com/v1/token?key=test`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }),
  });
  const refreshedSession = await refreshed.json();
  assert.ok(refreshedSession.id_token);
  assert.equal(await read(refreshedSession.id_token, second), 200);

  assert.equal((await access(session.idToken, first.id, { regenerate: true })).error?.status, "PERMISSION_DENIED");
  assert.equal((await reveal(session.idToken, first.id, version)).error?.status, "PERMISSION_DENIED");
  const replacement = await access(adminToken, first.id, { regenerate: true });
  assert.equal(replacement.result?.state, "issued", replacement.error?.message);
  assert.notEqual(replacement.result.password, issued.password);
  const replacementVersion = (await credential.get()).get("version");
  assert.equal((await reveal(adminToken, first.id, version)).error?.status, "FAILED_PRECONDITION");
  assert.equal((await reveal(adminToken, second.id, replacementVersion)).result?.password, replacement.result.password);
  const replacementEncrypted = (await credential.get()).get("encryptedPassword");
  await credential.update({ encryptedPassword });
  assert.equal((await reveal(adminToken, second.id, replacementVersion)).error?.status, "INTERNAL");
  await credential.update({ encryptedPassword: replacementEncrypted });
  assert.equal((await signIn(issued.password)).error?.status, "UNAUTHENTICATED");
  assert.equal(await read(session.idToken, second), 403);
  assert.equal(await read(refreshedSession.id_token, second), 403);
  const next = await signInToFirebase(replacement.result.password);
  assert.equal(await read(next.idToken, second), 200);
  if (storageHost) {
    assert.equal(await readCertificate(session.idToken), 403);
    assert.equal(await readCertificate(next.idToken), 200);
  }
  assert.equal((await access(adminToken, first.id, { regenerate: true })).error?.status, "RESOURCE_EXHAUSTED");

  const unlink = (studentId) => access(adminToken, studentId, { enabled: false, unlinkUid: legacy.u.uid });
  assert.equal((await unlink(first.id)).result?.state, "off");
  assert.equal((await reveal(adminToken, first.id, replacementVersion)).error?.status, "FAILED_PRECONDITION");
  assert.equal(await read(next.idToken, first), 403);
  assert.equal(await read(next.idToken, second), 200);
  assert.equal((await unlink(second.id)).result?.state, "off");
  assert.equal((await signIn(replacement.result.password)).error?.status, "UNAUTHENTICATED");

  const freshEmail = "new-guardian@example.test";
  await unrelated.update({ pendingParentLoginEmail: freshEmail });
  const fresh = await access(adminToken, unrelated.id, { email: freshEmail });
  assert.equal(fresh.result?.state, "issued");
  assert.equal((await unrelated.get()).get("guardianEmail"), freshEmail);
  assert.equal((await unrelated.get()).get("pendingParentLoginEmail"), undefined);
  const newParent = await signInToFirebase(fresh.result.password, freshEmail);
  assert.equal((await auth.getUser((await auth.verifyIdToken(newParent.idToken)).uid)).email, undefined);
  assert.equal(await read(newParent.idToken, unrelated), 200);
  const incorrect = fresh.result.password === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) assert.equal((await signIn(incorrect, freshEmail)).error?.status, "UNAUTHENTICATED");
  assert.equal((await signIn(fresh.result.password, freshEmail)).error?.status, "RESOURCE_EXHAUSTED");

  // Accounts issued before six-digit passwords keep their existing credentials.
  const freshRef = db.collection("parent_credentials").doc(createHash("sha256").update(freshEmail).digest("hex"));
  const { format, salt, encryptedPassword: _freshEncrypted, ...savedLong } = (await freshRef.get()).data();
  await freshRef.set({ ...savedLong, salt, hash: scryptSync(legacyPassword, salt, 32).toString("hex"), attempts: 0, windowStart: 0 });
  assert.ok(format === "pin6");
  assert.equal(await read((await signInToFirebase(legacyPassword, freshEmail)).idToken, unrelated), 200);
  console.log("Passed managed parent login, password reveal permissions, legacy replacement, rotation, sibling access, unlink, and rate limiting.");
} finally {
  await db.terminate();
  await deleteApp(app);
}
