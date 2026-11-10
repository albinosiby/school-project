const assert = require("node:assert/strict");
const { createHash, randomUUID } = require("node:crypto");
const { test, after } = require("node:test");
const { createRequire } = require("node:module");
const functionsRequire = createRequire(require.resolve("../../functions/staff"));
const { initializeApp, deleteApp } = functionsRequire("firebase-admin/app");
const { getAuth } = functionsRequire("firebase-admin/auth");
const { getFirestore } = functionsRequire("firebase-admin/firestore");
const { saveStaffProfile, getStaffProfile, setStaffAppLogin, deleteStaffProfile } = require("../../functions/staff");

const { GCLOUD_PROJECT: projectId, FIREBASE_AUTH_EMULATOR_HOST: authHost, FIRESTORE_EMULATOR_HOST: firestoreHost } = process.env;
assert.ok(projectId?.startsWith("demo-") && authHost && firestoreHost, "Run with demo Auth and Firestore emulators.");
const app = initializeApp({ projectId });
const auth = getAuth();
const db = getFirestore();
const schoolId = "staff-profiles-school";
const school = db.collection("schools").doc(schoolId);
const admin = "profiles_admin";
const users = db.collection("users");
const call = (handler, data, uid = admin) => handler.run({ auth: { uid }, data });
const base = {
  firstName: "Sample", lastName: "Person", birthDate: "1992-10-11", gender: "Female",
  nationality: "IN", phone: "9000000000", alternatePhone: "9000000001",
  currentAddress: { country: "IN", pin: "670001" }, sameAddress: true,
  department: "Office", joined: "2025-01-01", employmentType: "Permanent", employmentStatus: "Active",
  category: "Non-Teaching", designation: "Clerk",
  qualifications: [{ level: "Diploma", course: "Office Administration", year: "2012" }],
  emergency: { name: "Emergency contact", relationship: "Sibling", mobile: "9000000002" },
};

function save(profile, requestId = randomUUID()) {
  return call(saveStaffProfile, { requestId, profile: { ...base, ...profile } });
}

async function signIn(email, password) {
  const response = await fetch(`http://${authHost}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return response.json();
}

async function clientRead(ref, token) {
  const url = `http://${firestoreHost}/v1/projects/${projectId}/databases/(default)/documents/${ref.path}`;
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  return response.status;
}

after(async () => {
  await db.terminate();
  await deleteApp(app);
});

test("saves private profiles without a login and provisions correct native app accounts", async () => {
  await Promise.all([
    users.doc(admin).set({ schoolId, role: "admin" }),
    users.doc("foreign_admin").set({ schoolId: "different_school", role: "admin" }),
    users.doc("office_staff").set({ schoolId, role: "staff", staffRole: "office_administrator" }),
    school.collection("classes").doc("class_one").set({ subjects: ["Mathematics", "Science"] }),
    school.collection("staff").doc("legacy_case").set({ empId: "legacy-123" }),
    school.collection("staff").doc("legacy_number").set({ empId: "fc-0042" }),
    school.collection("set_config").doc("staff_numbering").set({ template: "FC-{SEQ:4}", start: 42 }),
  ]);
  await assert.rejects(call(saveStaffProfile, { requestId: randomUUID(), profile: base }, "office_staff"), { code: "permission-denied" });
  await assert.rejects(save({ empId: "LEGACY-123" }), { code: "already-exists" });
  await assert.rejects(save({ birthDate: "1992-02-31" }), { code: "invalid-argument" });
  await assert.rejects(call(saveStaffProfile, { requestId: randomUUID(), profile: base, photo: "data:image/svg+xml;base64,PHN2Zz4=" }), { code: "invalid-argument" });
  await assert.rejects(save({
    category: "Teaching", designation: "Teacher", teachingLevel: "Primary", primarySubject: "Unconfigured", teachingExperience: "1",
  }), { code: "invalid-argument" });
  const duplicateId = await Promise.allSettled([save({ empId: "MANUAL-123" }), save({ empId: "manual-123" })]);
  assert.equal(duplicateId.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(duplicateId.find((result) => result.status === "rejected").reason.code, "already-exists");
  const allocated = await Promise.all([save({}), save({})]);
  assert.deepEqual(allocated.map(({ empId }) => empId).sort(), ["FC-0043", "FC-0044"]);
  assert.equal((await school.collection("set_config").doc("staff_numbering").get()).get("next"), 45);
  await school.collection("set_config").doc("staff_numbering").set({ template: "FC{YEAR}{SEQ:4}", start: 2 }, { merge: true });

  for (const [role, input] of [
    ["teacher", { category: "Teaching", designation: "Teacher", teachingLevel: "Primary", primarySubject: "Mathematics",
      additionalSubjects: ["Science"], teachingExperience: "2" }],
    ["driver", { designation: "Driver", department: "Transport", licenseNumber: "TEST-123" }],
    ["staff", {}],
  ]) {
    const requestId = randomUUID();
    const { staffId, empId } = await save(input, requestId);
    assert.match(empId, /^FC\d{4}004[5-7]$/);
    assert.deepEqual(await save(input, requestId), { staffId, empId });
    const staff = school.collection("staff").doc(staffId);
    const privateRef = school.collection("staff_hr").doc(staffId);
    const member = (await staff.get()).data();
    assert.equal(member.authUid, undefined);
    for (const key of ["birthDate", "currentAddress", "phone", "qualifications", "emergency"]) assert.equal(member[key], undefined);
    const { profile } = await call(getStaffProfile, { staffId });
    assert.deepEqual(profile.currentAddress, profile.permanentAddress);
    assert.equal(profile.qualifications[0].course, base.qualifications[0].course);
    await assert.rejects(call(getStaffProfile, { staffId }, "foreign_admin"), { code: "not-found" });

    const loginRole = role === "staff" ? "office_staff" : role;
    const email = `${role}-${randomUUID()}@example.test`;
    const mismatchedRole = role === "teacher" ? "driver" : "teacher";
    await assert.rejects(call(setStaffAppLogin, { staffId, email, role: mismatchedRole }), { code: "failed-precondition" });
    if (role === "staff") {
      const uid = "staff_" + createHash("sha256").update(JSON.stringify([schoolId, staffId])).digest("hex");
      await auth.createUser({ uid, email, password: "InterruptedProvisioning1!" });
    }
    const generated = await call(setStaffAppLogin, { staffId, email, role: loginRole });
    const signedIn = await signIn(email, generated.password);
    assert.ok(signedIn.idToken, signedIn.error?.message);
    const uid = (await auth.verifyIdToken(signedIn.idToken)).uid;
    const linked = (await users.doc(uid).get()).data();
    assert.equal(linked.role, role);
    assert.equal(linked.staffId, staffId);
    assert.equal((await staff.get()).get("authUid"), uid);
    assert.equal((await privateRef.get()).get("password"), undefined);
    await assert.rejects(call(setStaffAppLogin, { staffId, email, role: loginRole }), { code: "already-exists" });

    if (role === "driver") {
      const crew = (await school.collection("tr_crew").doc(linked.crewId).get()).data();
      assert.equal(crew.staffId, staffId);
      assert.equal(crew.role, "driver");
      assert.equal(crew.authUid, uid);
    }
    if (role === "teacher") {
      assert.equal(await clientRead(staff, signedIn.idToken), 200);
      assert.equal(await clientRead(privateRef, signedIn.idToken), 403);
      await assert.rejects(call(setStaffAppLogin, { staffId, replace: true }, uid), { code: "permission-denied" });
      const replacement = await call(setStaffAppLogin, { staffId, replace: true });
      assert.ok((await signIn(email, generated.password)).error);
      assert.ok((await signIn(email, replacement.password)).idToken);
      await call(deleteStaffProfile, { staffId });
      assert.equal((await privateRef.get()).exists, false);
      assert.equal((await staff.get()).exists, false);
      assert.ok((await signIn(email, replacement.password)).error);
    }
  }
});
