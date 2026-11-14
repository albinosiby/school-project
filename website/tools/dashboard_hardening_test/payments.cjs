const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { createRequire } = require("node:module");
const { test, after } = require("node:test");
const serverRequire = createRequire(require.resolve("../../functions/feePayments"));
const { initializeApp, deleteApp } = serverRequire("firebase-admin/app");
const { getFirestore } = serverRequire("firebase-admin/firestore");
assert.ok(process.env.GCLOUD_PROJECT?.startsWith("demo-") && process.env.FIRESTORE_EMULATOR_HOST, "Use an isolated demo Firestore emulator.");
const app = initializeApp({ projectId: process.env.GCLOUD_PROJECT });
const db = getFirestore();
const { recordFeePayment } = require("../../functions/feePayments");
const { setClassTeacher, onTeachingAssignmentWritten } = require("../../functions/teachingAccess");
const sid = `audit_${randomUUID()}`, uid = `admin_${randomUUID()}`, school = db.collection("schools").doc(sid);
const auth = { uid, token: { name: "Synthetic administrator" } };
const call = (input) => recordFeePayment.run({ auth, data: input });
const invoice = async (id, amount = 100) => {
  await school.collection("fee_invoices").doc(id).set({ no: id, student: "Synthetic student", grn: "G1", grade: "10", amount, paid: 0, balance: amount, due: "2099-01-01" });
};
after(async () => { await db.terminate(); await deleteApp(app); });

test("payment ledger and class assignment transactions", async (t) => {
  await db.collection("users").doc(uid).set({ schoolId: sid, role: "admin", name: "Synthetic administrator" });
  await t.test("concurrent valid payments retain both amounts and get distinct receipts", async () => {
    await invoice("concurrent", 100);
    const results = await Promise.all([30, 40].map((amount) => call({ requestId: randomUUID(), invoiceId: "concurrent", mode: "Cash", amount })));
    assert.equal(new Set(results.map(({ payment }) => payment.receiptNo)).size, 2);
    const saved = await school.collection("fee_invoices").doc("concurrent").get();
    assert.equal(saved.get("paid"), 70); assert.equal(saved.get("balance"), 30);
  });
  await t.test("concurrent overpayments cannot exceed the current invoice balance", async () => {
    await invoice("overspend", 100);
    const results = await Promise.allSettled([60, 60].map((amount) => call({ requestId: randomUUID(), invoiceId: "overspend", mode: "Cash", amount })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal((await school.collection("fee_invoices").doc("overspend").get()).get("paid"), 60);
  });
  await t.test("replaying an ambiguous network request returns its receipt without another charge", async () => {
    await invoice("replay", 100);
    const request = { requestId: randomUUID(), invoiceId: "replay", mode: "Cash", amount: 50 };
    const first = await call(request), second = await call(request);
    assert.equal(first.payment.id, second.payment.id); assert.equal(second.replayed, true);
    assert.equal((await school.collection("fee_invoices").doc("replay").get()).get("paid"), 50);
    await assert.rejects(call({ ...request, amount: 40 }), (error) => error.code === "already-exists");
  });
  await t.test("a claim can produce only one receipt across different requests", async () => {
    await invoice("claim", 100);
    await school.collection("fee_claims").doc("claim").set({ invoiceId: "claim", grn: "G1", amount: 50, mode: "UPI", reference: "UTR-UNIQUE", paidOn: "2026-01-01", status: "Pending" });
    const results = await Promise.all([1, 2].map(() => call({ requestId: randomUUID(), invoiceId: "claim", claimId: "claim", amount: 50 })));
    assert.equal(results[0].payment.id, results[1].payment.id);
    assert.equal((await school.collection("fee_invoices").doc("claim").get()).get("paid"), 50);
  });
  await t.test("transaction references cannot be reused on another invoice", async () => {
    await invoice("duplicate", 100);
    await assert.rejects(call({ requestId: randomUUID(), invoiceId: "duplicate", mode: "UPI", reference: "utr-unique", amount: 50 }), (error) => error.code === "already-exists");
  });
  await t.test("teachers cannot invoke the fee service", async () => {
    await db.collection("users").doc("synthetic_teacher").set({ role: "teacher", staffId: "teacher", schoolId: sid });
    await assert.rejects(recordFeePayment.run({ auth: { uid: "synthetic_teacher" }, data: { requestId: randomUUID(), invoiceId: "duplicate", mode: "Cash", amount: 1 } }), (error) => error.code === "permission-denied");
  });
  await t.test("class teacher reservation serializes two assignments to different classes", async () => {
    await school.collection("staff").doc("teacher").set({ name: "Synthetic teacher", category: "Teaching", status: "Active" });
    await Promise.all(["cls_10A", "cls_10B"].map((id) => school.collection("classes").doc(id).set({ id, grade: "10", section: id.slice(-1), classTeacherId: "" })));
    const results = await Promise.allSettled(["cls_10A", "cls_10B"].map((classId) => setClassTeacher.run({ auth, data: { classId, teacherId: "teacher" } })));
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const classes = await school.collection("classes").where("classTeacherId", "==", "teacher").get();
    assert.equal(classes.size, 1);
    await setClassTeacher.run({ auth, data: { classId: classes.docs[0].id, teacherId: "" } });
    const next = classes.docs[0].id === "cls_10A" ? "cls_10B" : "cls_10A";
    await setClassTeacher.run({ auth, data: { classId: next, teacherId: "teacher" } });
    assert.equal((await school.collection("classes").doc(next).get()).get("classTeacherId"), "teacher");
  });
  await t.test("assignment changes create a trusted access index", async () => {
    const ref = school.collection("assignments").doc("maths");
    await ref.set({ classId: "cls_10A", teacherId: "teacher", subject: "Maths" });
    await onTeachingAssignmentWritten.run({ params: { sid }, data: { before: { data: () => null }, after: await ref.get() } });
    const access = await school.collection("teaching_access").doc("cls_10A__teacher").get();
    assert.equal(access.get("subjects.Maths.assignmentId"), "maths");
  });
});
