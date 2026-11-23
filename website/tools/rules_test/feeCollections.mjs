// Synthetic emulator data only: never run against a live school.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, setLogLevel } from "firebase/firestore";
const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!/^127\.0\.0\.1:\d+$/.test(host || "")) throw new Error("Set FIRESTORE_EMULATOR_HOST to a local emulator before running these tests.");
const projectId = "demo-fee-collections", port = Number(host.split(":")[1]);
setLogLevel("silent");
const env = await initializeTestEnvironment({ projectId, firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
await env.clearFirestore();
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp, deleteApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId }), db = getFirestore(app);
const { changeFeeInvoiceStatus } = require("./feeInvoiceStatus");
const { recordFeePayment } = require("./feePayments");
const { invoiceDisplayStatus } = require("./feeInvoiceState");
const { schoolDate } = require("./schoolTime");
const school = db.doc("schools/S1"), invoiceRef = school.collection("fee_invoices").doc("invoice");
const invoice = { id: "invoice", no: "INV-SYNTHETIC-1", studentId: "student", student: "Synthetic Student", grn: "SYN-1", amount: 1000, paid: 0, balance: 1000, due: "2020-01-01", status: "Overdue" };
let checks = 0;
const check = async (name, run) => { await run(); checks++; console.log(`ok ${name}`); };
const auth = (uid = "admin") => ({ uid, token: {} });
const callStatus = async (data = {}, uid = "admin") => {
  const current = (await invoiceRef.get()).data();
  return changeFeeInvoiceStatus.run({ auth: auth(uid), data: { schoolId: "S1", invoiceId: "invoice", requestId: randomUUID(), status: "Pending", reason: "Agreed extension",
    expectedRevision: current.statusRevision ?? 0, expectedAmount: current.amount, expectedPaid: current.paid ?? 0, expectedDue: current.due ?? "", ...data } });
};
const callPayment = (data = {}, uid = "admin") => recordFeePayment.run({ auth: auth(uid), data: { schoolId: "S1", invoiceId: "invoice", requestId: randomUUID(), amount: 100, mode: "Cash", date: schoolDate(Date.now(), "Asia/Kolkata"), ...data } });
try {
  for (const [path, data] of Object.entries({
    "users/admin": { schoolId: "S1", role: "admin", name: "Synthetic Admin" }, "users/other": { schoolId: "S2", role: "admin" },
    "users/teacher": { schoolId: "S1", role: "teacher" }, "schools/S1/students/student": { name: "Synthetic Student", status: "Active" },
    "schools/S1/set_config/regional": { timezone: "Asia/Kolkata" }, "schools/S1/fee_invoices/invoice": invoice,
  })) await db.doc(path).set(data);

  const admin = env.authenticatedContext("admin").firestore(), teacher = env.authenticatedContext("teacher").firestore();
  const inv = doc(admin, "schools/S1/fee_invoices/invoice"), history = doc(admin, "schools/S1/fee_invoice_status_history/forged");
  await check("admin reads invoice", () => assertSucceeds(getDoc(inv)));
  await check("admin cannot change paid or balance directly", () => assertFails(updateDoc(inv, { paid: 999, balance: 1 })));
  await check("admin cannot forge Paid status", () => assertFails(updateDoc(inv, { status: "Paid" })));
  await check("admin cannot forge override or revision", () => assertFails(updateDoc(inv, { statusOverride: { status: "Pending" }, statusRevision: 1 })));
  await check("admin cannot prefill override on new invoice", () => assertFails(setDoc(doc(admin, "schools/S1/fee_invoices/new"), { amount: 10, paid: 0, statusOverride: { status: "Pending" } })));
  await check("admin may create an unpaid invoice", () => assertSucceeds(setDoc(doc(admin, "schools/S1/fee_invoices/new"), { amount: 10, paid: 0, balance: 10, status: "Pending" })));
  await check("admin cannot forge history", () => assertFails(setDoc(history, { byUid: "another", reason: "forged" })));
  await check("admin cannot forge status replay records", () => assertFails(setDoc(doc(admin, "schools/S1/fee_invoice_status_requests/forged"), { result: {} })));
  await check("teacher cannot read financial history", () => assertFails(getDocs(collection(teacher, "schools/S1/fee_invoice_status_history"))));
  await check("anonymous cannot list financial history", () => assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), "schools/S1/fee_invoice_status_history"))));
  await check("cross-school financial history denied", () => assertFails(getDocs(collection(env.authenticatedContext("other").firestore(), "schools/S1/fee_invoice_status_history"))));
  await check("status callable denies teacher", () => assert.rejects(callStatus({}, "teacher"), /cannot change/));
  await check("status callable cannot access another school's invoice", () => assert.rejects(callStatus({}, "other"), /not found/));
  await check("status callable requires a reason", () => assert.rejects(callStatus({ reason: "" }), /enter a reason/));
  await check("Paid cannot bypass payment collection", () => assert.rejects(callStatus({ status: "Paid" }), /Record a payment/));
  await check("manual Pending logs actor and leaves money unchanged", async () => {
    const requestId = randomUUID();
    const result = await callStatus({ requestId });
    const saved = (await invoiceRef.get()).data();
    assert.equal(result.status, "Pending"); assert.equal(saved.paid, 0); assert.equal(saved.balance, 1000);
    assert.equal(saved.statusOverride.byUid, undefined); assert.equal(saved.statusOverride.reason, undefined);
    assert.equal(invoiceDisplayStatus(saved, "2026-11-17"), "Pending");
    const row = await school.collection("fee_invoice_status_history").doc(requestId).get();
    assert.equal(row.get("reason"), "Agreed extension"); assert.equal(row.get("from"), "Overdue");
    assert.equal(row.get("byUid"), "admin"); assert.equal(row.get("by"), "Synthetic Admin");
    const replay = { auth: auth(), data: { schoolId: "S1", invoiceId: "invoice", requestId, status: "Pending", reason: "Agreed extension", expectedRevision: 0, expectedAmount: 1000, expectedPaid: 0, expectedDue: "2020-01-01" } };
    await changeFeeInvoiceStatus.run(replay);
    assert.equal((await school.collection("fee_invoice_status_history").get()).size, 1);
    await assert.rejects(changeFeeInvoiceStatus.run({ ...replay, data: { ...replay.data, reason: "Different" } }), /already used/);
  });
  await check("history cannot be rewritten or deleted", async () => {
    const first = (await school.collection("fee_invoice_status_history").get()).docs[0];
    await assertFails(updateDoc(doc(admin, first.ref.path), { reason: "erase" }));
    await assertFails(deleteDoc(doc(admin, first.ref.path)));
  });
  await check("stale editor cannot overwrite another status change", () => assert.rejects(callStatus({ expectedRevision: 0 }), /invoice changed/));
  await check("Automatic clears override and recalculates Overdue", async () => {
    await callStatus({ status: "Automatic", reason: "" });
    const saved = (await invoiceRef.get()).data(); assert.equal(saved.statusOverride, null); assert.equal(saved.status, "Overdue");
  });
  await check("manual Overdue can flag an unpaid future-dated invoice without altering money", async () => {
    await invoiceRef.update({ due: "2099-01-01" });
    await callStatus({ status: "Overdue", reason: "Payment arrangement overdue" });
    const saved = (await invoiceRef.get()).data();
    assert.equal(invoiceDisplayStatus(saved, schoolDate(Date.now(), "Asia/Kolkata")), "Overdue");
    assert.equal(saved.paid, 0); assert.equal(saved.balance, 1000);
    await invoiceRef.update({ due: "2020-01-01" });
  });
  await check("payment clears manual label and retries return the same receipt", async () => {
    await callStatus(); const requestId = randomUUID();
    const first = await callPayment({ requestId, amount: 250.5 });
    const second = await callPayment({ requestId, amount: 250.5 });
    assert.equal(first.payment.id, second.payment.id); assert.equal(second.replayed, true);
    const saved = (await invoiceRef.get()).data(); assert.equal(saved.paid, 250.5); assert.equal(saved.balance, 749.5); assert.equal(saved.statusOverride, null); assert.equal(saved.status, "Overdue");
    assert.equal((await school.collection("fee_payments").get()).size, 1);
  });
  await check("same request cannot be reused for a different amount", async () => {
    const requestId = randomUUID(); await callPayment({ requestId, amount: 1 });
    await assert.rejects(callPayment({ requestId, amount: 2 }), /already been used/);
  });
  await check("non-cash requires transaction reference", () => assert.rejects(callPayment({ mode: "UPI", reference: "" }), /transaction reference/));
  await check("future payment dates rejected", () => assert.rejects(callPayment({ date: "2099-01-01" }), /not in the future/));
  await check("duplicate transaction references cannot issue a second receipt", async () => {
    await callPayment({ amount: 1, mode: "UPI", reference: "SYNTHETIC-UTR-001" });
    await assert.rejects(callPayment({ amount: 1, mode: "UPI", reference: "synthetic-utr-001" }), /already has a receipt/);
  });
  await check("concurrent collections cannot overpay the latest balance", async () => {
    const current = (await invoiceRef.get()).data(), amount = current.balance;
    const results = await Promise.allSettled([callPayment({ amount }), callPayment({ amount })]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    const saved = (await invoiceRef.get()).data(); assert.equal(saved.balance, 0); assert.equal(saved.paid, 1000); assert.equal(saved.status, "Paid");
  });
  await check("settled invoices cannot be marked unpaid manually", () => assert.rejects(callStatus(), /settled/));
  await check("removed student is read-only on both callables", async () => {
    await invoiceRef.set(invoice); await school.collection("students").doc("student").update({ deleted: true });
    await assert.rejects(callStatus(), /read-only/); await assert.rejects(callPayment(), /read-only/);
  });
  await check("legacy GRN-only invoices cannot mutate removed students", async () => {
    const { studentId, ...legacy } = invoice;
    await invoiceRef.set(legacy); await school.collection("students").doc("student").update({ grn: invoice.grn });
    await assert.rejects(callStatus(), /read-only/); await assert.rejects(callPayment(), /read-only/);
  });
  await check("suspended school and expired admin MFA cannot mutate invoices", async () => {
    await db.doc("platform_schools/S1").set({ status: "suspended" });
    await assert.rejects(callStatus(), /cannot change/); await assert.rejects(callPayment(), /cannot record/);
    await db.doc("platform_schools/S1").delete(); await db.doc("users/admin").update({ mfaVersion: "new-session" });
    await assert.rejects(callStatus(), /Verify your administrator passkey/); await assert.rejects(callPayment(), /Verify your administrator passkey/);
  });
  console.log(`Fee collection and manual status: ${checks} emulator checks passed.`);
} finally { await env.cleanup(); await db.terminate(); await deleteApp(app); }
