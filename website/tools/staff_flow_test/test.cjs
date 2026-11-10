// Run from website with tools/emulator_exec.sh auth,firestore 'node --test tools/staff_flow_test/test.cjs'.
const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { test, after, mock } = require("node:test");
const { createRequire } = require("node:module");
const requireFunctions = createRequire(require.resolve("../../functions/staff"));
const { initializeApp, deleteApp } = requireFunctions("firebase-admin/app");
const { getAuth } = requireFunctions("firebase-admin/auth");
const { getFirestore } = requireFunctions("firebase-admin/firestore");
const { createSchoolStaff, resendSchoolStaffInvite } = require("../../functions/staff");

const projectId = process.env.GCLOUD_PROJECT || "demo-school-parent";
if (!projectId.startsWith("demo-") || !process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Staff flow tests require local Firestore and Auth emulators on a demo project.");
}
const app = initializeApp({ projectId });
const db = getFirestore();
const auth = getAuth();
const users = db.collection("users");
const sid = "staff_school";
const school = db.collection("schools").doc(sid);
const payload = (role, email = `${randomUUID()}@school.test`) => ({ name: "Sample Person", email, role, invitationId: randomUUID() });
const call = (uid, data) => createSchoolStaff.run({ auth: uid ? { uid } : undefined, data });
const resend = (uid, staffId) => resendSchoolStaffInvite.run({ auth: { uid }, data: { staffId } });

process.env.STAFF_SMTP_URL = "smtps://user:password@example.invalid:465";
process.env.STAFF_INVITE_FROM = "Edvio <accounts@example.invalid>";
const emails = [];
let rejectEmail = false;
mock.method(requireFunctions("nodemailer"), "createTransport", () => ({
  async sendMail(message) {
    if (rejectEmail) throw Object.assign(new Error("SMTP unavailable"), { code: "ECONNECTION" });
    emails.push(message);
    return { accepted: [message.to.address] };
  },
}));

after(async () => {
  await db.terminate();
  await deleteApp(app);
});

test("staff provisioning enforces the hierarchy, school, and account linkage", async () => {
  await Promise.all([
    users.doc("school_admin").set({ role: "admin", schoolId: sid }),
    users.doc("principal").set({ role: "staff", staffRole: "principal", schoolId: sid }),
    users.doc("vice").set({ role: "staff", staffRole: "vice_principal", schoolId: sid }),
    users.doc("office").set({ role: "staff", staffRole: "office_administrator", schoolId: sid }),
    users.doc("accountant").set({ role: "staff", staffRole: "accountant", schoolId: sid }),
    users.doc("hod").set({ role: "teacher", staffRole: "hod", schoolId: sid }),
    users.doc("platform_owner").set({ role: "admin", schoolId: sid }),
    db.collection("platform_admins").doc("platform_owner").set({}),
    school.collection("set_config").doc("staff_numbering").set({ template: "INV-{SEQ:4}", start: 21 }),
  ]);

  const forbidden = [
    ["principal", "principal"], ["vice", "accountant"], ["vice", "driver"],
    ["office", "teacher"], ["office", "office_administrator"], ["accountant", "office_staff"],
    ["hod", "teacher"], ["platform_owner", "principal"],
  ];
  for (const [actor, role] of forbidden) {
    const data = payload(role);
    await assert.rejects(call(actor, data), { code: "permission-denied" });
    await assert.rejects(auth.getUserByEmail(data.email), { code: "auth/user-not-found" });
  }
  await assert.rejects(call(null, payload("teacher")), { code: "unauthenticated" });
  await assert.rejects(call("school_admin", payload("admin")), { code: "invalid-argument" });

  for (const [actor, role, appRole] of [
    ["school_admin", "principal", "staff"],
    ["principal", "vice_principal", "staff"],
    ["vice", "hod", "teacher"],
    ["office", "helper", "attendant"],
    ["office", "driver", "driver"],
    ["office", "general_staff", "staff"],
  ]) {
    const data = payload(role);
    const emailCount = emails.length;
    assert.deepEqual(await call(actor, { ...data, schoolId: "different_school" }), { created: true, emailSent: true });
    assert.equal(emails.length, emailCount + 1);
    assert.equal(emails.at(-1).to.address, data.email);
    assert.match(emails.at(-1).text, /[?&]oobCode=/);
    const account = await auth.getUserByEmail(data.email);
    const profile = (await users.doc(account.uid).get()).data();
    assert.equal(profile.schoolId, sid);
    assert.equal(profile.role, appRole);
    assert.equal(profile.staffRole, role);
    const record = (await school.collection("staff").doc(profile.staffId).get()).data();
    assert.equal(record.email, data.email);
    assert.equal(record.authUid, account.uid);
    assert.match(record.empId, /^INV-00[2-3]\d$/);
    if (appRole === "driver" || appRole === "attendant") {
      const crew = (await school.collection("tr_crew").doc(profile.crewId).get()).data();
      assert.equal(crew.role, appRole);
      assert.equal(crew.staffId, profile.staffId);
    }
    // A replay after SMTP acceptance returns the original result without sending again.
    assert.deepEqual(await call(actor, data), { created: true, emailSent: true });
    assert.equal(emails.length, emailCount + 1);
    await assert.rejects(call(actor, { ...data, invitationId: randomUUID() }), { code: "already-exists" });
  }

  const duplicate = payload("teacher");
  await school.collection("staff").doc("legacy").set({ email: duplicate.email });
  await assert.rejects(call("school_admin", duplicate), { code: "already-exists" });
  await assert.rejects(auth.getUserByEmail(duplicate.email), { code: "auth/user-not-found" });

  const retry = payload("principal");
  rejectEmail = true;
  try {
    assert.deepEqual(await call("school_admin", retry), { created: true, emailSent: false });
  } finally {
    rejectEmail = false;
  }
  const account = await auth.getUserByEmail(retry.email);
  const { staffId } = (await users.doc(account.uid).get()).data();
  await users.doc("other_school_admin").set({ role: "admin", schoolId: "other_school" });
  await assert.rejects(resend("other_school_admin", staffId), { code: "not-found" });
  await assert.rejects(resend("vice", staffId), { code: "permission-denied" });
  assert.deepEqual(await resend("school_admin", staffId), { emailSent: true });
  assert.equal(emails.at(-1).to.address, retry.email);
  assert.deepEqual(await resend("school_admin", staffId), { emailSent: false });
  assert.deepEqual(await call("school_admin", retry), { created: true, emailSent: true });

  await db.collection("platform_schools").doc(sid).set({ status: "suspended" });
  await assert.rejects(call("school_admin", payload("teacher")), { code: "permission-denied" });
});
