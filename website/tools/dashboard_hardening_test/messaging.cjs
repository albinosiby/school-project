const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { test, after } = require("node:test");
const r = createRequire(require.resolve("../../functions/appMessaging"));
const { initializeApp, deleteApp } = r("firebase-admin/app");
const { getFirestore } = r("firebase-admin/firestore");
assert.ok(process.env.GCLOUD_PROJECT?.startsWith("demo-") && process.env.FIRESTORE_EMULATOR_HOST, "Use an isolated emulator.");
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT }), db = getFirestore();
const { createAppMessaging } = require("../../functions/appMessaging");
const { eventInstant } = require("../../functions/eventReminders");
const sid = `messages_${randomUUID()}`, school = db.collection("schools").doc(sid), calls = [];
let failOnce = true;
const service = createAppMessaging({ db, accountEnabled: async () => true, send: async (message) => {
  calls.push(message);
  return { responses: message.tokens.map((token) => token === "dead" ? { success: false, error: { code: "messaging/registration-token-not-registered" } } : token === "retry" && failOnce ? (failOnce = false, { success: false, error: { code: "messaging/internal-error" } }) : { success: true }) };
} });
const message = { type: "notice", title: "Synthetic notice", body: "Testing only", route: "/notifications", urgent: false };
after(async () => { await db.terminate(); await deleteApp(app); });
test("Firebase Messaging outbox", async (t) => {
  const parent = db.collection("users").doc(`parent_${randomUUID()}`), teacher = db.collection("users").doc(`teacher_${randomUUID()}`), other = db.collection("users").doc(`other_${randomUUID()}`);
  await Promise.all([parent.set({schoolId:sid,role:"parent",studentIds:["child"],classIds:["cls_10A"],parentCredentialVersion:"v2"}),teacher.set({schoolId:sid,role:"teacher",staffId:"t1"}),other.set({schoolId:"another",role:"parent",studentIds:["x"]})]);
  await t.test("audiences create one feed row and outbox job per registered account, even on replay", async () => {
    assert.equal(await service.broadcast(sid,"notice:one",message,"All School"),2);
    assert.equal(await service.broadcast(sid,"notice:one",message,"All School"),2);
    assert.equal((await school.collection("push_deliveries").get()).size,2);
    assert.equal((await school.collection("par_notifications").get()).size,1);
    assert.equal((await school.collection("hm_notifications").get()).size,1);
  });
  await t.test("grade targeting excludes guardians from another class", async () => {
    assert.equal(await service.broadcast(sid,"notice:grade",message,"Parents by Grade",["Grade 8"]),0);
  });
  await t.test("retries transient failures without resending accepted tokens; old parent sessions are excluded", async () => {
    for (const token of ["accepted","retry","dead","old"]) await parent.collection("fcm_tokens").doc(token).set({app:"parent",parentCredentialVersion:token === "old" ? "v1":"v2"});
    const job = (await school.collection("push_deliveries").where("uid","==",parent.id).get()).docs[0].ref;
    await assert.rejects(service.dispatch(job));
    await service.dispatch(job);
    assert.deepEqual(calls.map(c=>c.tokens),[["accepted","dead","retry"],["retry"]]);
    assert.equal((await parent.collection("fcm_tokens").doc("dead").get()).exists,false);
    assert.equal((await job.get()).get("accepted"),2);
    await service.dispatch(job); assert.equal(calls.length,2);
  });
  await t.test("an unregistered device is reported honestly without a fake success", async () => {
    const job=(await school.collection("push_deliveries").where("uid","==",teacher.id).get()).docs[0].ref;
    await service.dispatch(job);
    assert.equal((await job.get()).get("status"),"No devices");
    assert.equal((await job.get()).get("accepted"),0);
  });
  await t.test("event reminders resolve the school's timezone", () => {
    assert.equal(new Date(eventInstant("2026-11-12","09:00","IST")).toISOString(),"2026-11-12T03:30:00.000Z");
    assert.equal(new Date(eventInstant("2026-11-12","09:00","Asia/Dubai")).toISOString(),"2026-11-12T05:00:00.000Z");
  });
});
