import assert from "node:assert/strict";
import { createRequire } from "node:module";

const projectId = process.env.GCLOUD_PROJECT || "demo-school-parent";
const authHost = process.env.FIREBASE_AUTH_EMULATOR_HOST;
assert.ok(authHost && process.env.FIRESTORE_EMULATOR_HOST && projectId.startsWith("demo-"), "Use local emulators.");
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const sid = "roll-test";
const password = "local-test-password";

async function actor(name, role, schoolId = sid) {
  const email = `${name}@example.test`;
  const user = await auth.createUser({ email, password });
  await db.doc(`users/${user.uid}`).set({ schoolId, role, staffId: name });
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  assert.equal(response.status, 200);
  return (await response.json()).idToken;
}

const [assigned, otherTeacher, admin] = await Promise.all([
  actor("assigned", "teacher"), actor("other", "teacher"), actor("principal", "admin"),
]);
const school = db.collection("schools").doc(sid);
const student = (id) => school.collection("students").doc(id);
await Promise.all([
  school.collection("classes").doc("cls_3A").set({ grade: "3", section: "A", classTeacherId: "assigned" }),
  school.collection("classes").doc("cls_3B").set({ grade: "3", section: "B", classTeacherId: "other" }),
  school.collection("school").doc("school").set({ academicYear: "2026-27" }),
  student("first").set({ classId: "cls_3A", roll: 0 }),
  student("second").set({ classId: "cls_3A", roll: 0 }),
  student("unassigned").set({ classId: "", roll: 0 }),
  student("anotherDivision").set({ classId: "cls_3B", roll: 0 }),
]);

async function assign(token, studentId, roll) {
  const host = process.env.FUNCTIONS_EMULATOR_HOST || "127.0.0.1:5001";
  const res = await fetch(`http://${host}/${projectId}/asia-south1/assignStudentRoll`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ data: { studentId, roll } }),
  });
  return res.json();
}

assert.equal((await assign(admin, "first", 3)).error?.status, "PERMISSION_DENIED");
assert.equal((await assign(otherTeacher, "first", 3)).error?.status, "PERMISSION_DENIED");
assert.equal((await assign(assigned, "anotherDivision", 3)).error?.status, "PERMISSION_DENIED");
assert.equal((await assign(assigned, "unassigned", 3)).error?.status, "FAILED_PRECONDITION");
const contenders = ["first", "second"];
const attempts = await Promise.all(contenders.map((id) => assign(assigned, id, 1)));
assert.equal(attempts.filter((reply) => reply.result?.roll === 1).length, 1);
const conflict = attempts.findIndex((reply) => reply.error?.status === "ALREADY_EXISTS");
assert.notEqual(conflict, -1);
const remaining = contenders[conflict];
assert.equal((await assign(assigned, remaining, null)).result?.roll, 2);
assert.equal((await student(remaining).get()).get("rollAcademicYear"), "2026-27");
assert.equal((await assign(otherTeacher, "anotherDivision", 1)).result?.roll, 1);
console.log("Verified class teacher permissions, deferred assignment, and concurrent roll uniqueness.");

if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
  const { initializeApp: clientApp, deleteApp } = await import("firebase/app");
  const { connectAuthEmulator, getAuth: clientAuth, signInWithEmailAndPassword } = await import("firebase/auth");
  const { connectStorageEmulator, getBytes, getStorage, ref, uploadBytes } = await import("firebase/storage");
  const endpoint = new URL(`http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`);
  async function connect(name) {
    const app = clientApp({ projectId, apiKey: "demo-key", storageBucket: `${projectId}.appspot.com` }, name);
    const session = clientAuth(app);
    connectAuthEmulator(session, `http://${authHost}`, { disableWarnings: true });
    await signInWithEmailAndPassword(session, `${name}@example.test`, password);
    const storage = getStorage(app);
    connectStorageEmulator(storage, endpoint.hostname, Number(endpoint.port));
    return { app, storage };
  }
  const [principal, teacher] = await Promise.all([connect("principal"), connect("assigned")]);
  const file = `schools/${sid}/admission-documents/first/birth/00000000-0000-0000-0000-000000000001`;
  const content = new TextEncoder().encode("%PDF-1.7\n");
  const metadata = { contentType: "application/pdf" };
  const unauthorized = { code: "storage/unauthorized" };
  try {
    await uploadBytes(ref(principal.storage, file), content, metadata);
    assert.deepEqual(new Uint8Array(await getBytes(ref(principal.storage, file))), content);
    await assert.rejects(getBytes(ref(teacher.storage, file)), unauthorized);
    await assert.rejects(uploadBytes(ref(teacher.storage, file), content, metadata), unauthorized);
    await db.doc(`platform_schools/${sid}`).set({ status: "suspended" });
    await assert.rejects(getBytes(ref(principal.storage, file)), unauthorized);
    console.log("Verified admission files are limited to active school administrators.");
  } finally {
    await Promise.all([deleteApp(principal.app), deleteApp(teacher.app)]);
  }
}
