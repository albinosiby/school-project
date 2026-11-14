import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
const port = Number(process.env.RULES_TEST_PORT || 18081);
const env = await initializeTestEnvironment({ projectId: "demo-exam-management", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  for (const [path, value] of Object.entries({
    "users/admin": { schoolId: "school", role: "admin" }, "users/other": { schoolId: "other", role: "admin" },
    "users/parent": { schoolId: "school", role: "parent", studentIds: ["s1"] }, "users/teacher": { schoolId: "school", role: "teacher", staffId: "t1" },
    "schools/school/exm_cycles/c1": { status: "Scheduled", publicationState: "published" },
    "schools/school/exm_papers/p1": { cycleId: "c1", locked: true, theory: 80, internal: 20, studentIds: ["s1"] },
    "schools/school/exm_marks/m1": { paperId: "p1", studentId: "s1", classId: "a", theory: 10, internal: 10 },
    "schools/school/classes/a": { grade: "10", section: "A" },
    "schools/school/classes/b": { grade: "10", section: "B" },
    "schools/school/exm_activity/a1": { cycleId: "c1", action: "Created" },
    "schools/school/exm_report_cards/published": { studentId: "s1", status: "Published" },
    "schools/school/exm_report_cards/preview": { studentId: "s1", status: "Preview" },
    "schools/school/exm_report_cards/otherchild": { studentId: "s2", status: "Published" },
  })) await setDoc(doc(db, path), value);
});
const admin = env.authenticatedContext("admin").firestore(), parent = env.authenticatedContext("parent").firestore();
await assertFails(updateDoc(doc(admin, "schools/school/exm_papers/p1"), { locked: false }));
await assertFails(updateDoc(doc(admin, "schools/school/exm_cycles/c1"), { status: "Draft" }));
await assertFails(updateDoc(doc(admin, "schools/school/exm_marks/m1"), { theory: 11 }));
await assertFails(updateDoc(doc(admin, "schools/school/exm_activity/a1"), { action: "Forged" }));
await assertFails(setDoc(doc(admin, "schools/school/exm_report_batches/b"), { status: "Published" }));
await assertSucceeds(getDoc(doc(parent, "schools/school/exm_report_cards/published")));
await assertFails(getDoc(doc(parent, "schools/school/exm_report_cards/preview")));
await assertFails(getDoc(doc(parent, "schools/school/exm_report_cards/otherchild")));
await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "schools/school/exm_report_cards/published")));
await assertFails(getDoc(doc(env.authenticatedContext("other").firestore(), "schools/school/exm_activity/a1")));
await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), "schools/school/exm_papers/p1"), { locked: false, lockedClassIds: ["a"], studentIds: ["s1", "s2"] }));
await assertFails(updateDoc(doc(admin, "schools/school/exm_marks/m1"), { theory: 11 }));
await assertSucceeds(updateDoc(doc(admin, "schools/school/exm_marks/m1"), { verified: true, updatedBy: "admin" }));
await assertSucceeds(setDoc(doc(admin, "schools/school/exm_marks/m2"), { paperId: "p1", studentId: "s2", classId: "b", theory: 20, internal: 10, updatedBy: "admin" }));
await env.cleanup();
console.log("Exam rules: locks, immutable history, no forged publication, parent/tenant isolation passed.");

process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${port}`;
// a re-run against a long-lived emulator starts from empty server-side data
await fetch(`http://127.0.0.1:${port}/emulator/v1/projects/demo-exam-management-server/databases/(default)/documents`, { method: "DELETE" });
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-exam-management-server" }, "exam-management");
const defaultApp = initializeApp({ projectId: "demo-exam-management-server" });
const db = getFirestore(app), school = db.doc("schools/school");
const { createExamManager } = require("./examManagement.js");
const { markFingerprint } = require("./examAssessment.js");
const manage = createExamManager({ db });
const paper = { id: "p1", cycleId: "c1", grade: "11", classIds: ["custom11"], studentIds: ["s1"], subject: "English", code: "ENG", date: "2026-12-02", start: "09:00", duration: 2, theory: 80, internal: 20, venue: "Hall 1", invigilatorId: "t1", invigilator: "Teacher 1", status: "Scheduled", published: [], setupVersion: 1, setupPublished: true };
for (const [path, value] of Object.entries({
  "users/admin": { role: "admin", schoolId: "school", name: "Principal" }, "users/other": { role: "admin", schoolId: "other" }, "users/teacher": { role: "teacher", schoolId: "school", staffId: "t1" },
  "schools/school": {}, "schools/school/school/school": { name: "Example School", academicYear: "2026-27" },
  "schools/school/exm_cycles/c1": { title: "Term 1", start: "2026-12-01", end: "2026-12-10", academicYear: "2026-27", status: "Scheduled", publicationState: "published", resultRules: { requireApproval: true, absentRule: "incomplete" } },
  "schools/school/exm_papers/p1": paper, "schools/school/classes/custom11": { grade: "11", section: "A" },
  "schools/school/students/s1": { name: "Student One", grade: "11", section: "A", classId: "custom11", status: "Active", privateOfficeNote: "must not enter report snapshot" },
  "schools/school/staff/t1": { name: "Teacher 1" }, "schools/school/staff/t2": { name: "Teacher 2" },
})) await db.doc(path).set(value);
const call = (action, payload = {}, uid = "admin") => manage({ auth: { uid, token: {} }, data: { action, schoolId: "school", cycleId: "c1", requestId: randomUUID(), ...payload } });
await assert.rejects(call("lock", { paperId: "p1", locked: false, reason: "correction" }, "other"), /cannot manage/);
await assert.rejects(call("lock", { paperId: "p1", locked: false, reason: "correction" }, "teacher"), /cannot manage/);
const change = { paperId: "p1", revision: 0, date: "2026-12-03", start: "09:00", duration: 2, venue: "Hall 1", invigilatorId: "t1", scheduleStatus: "Scheduled" };
const requestId = randomUUID();
await call("schedule", { changes: [change], reason: "Public holiday", notify: false, requestId });
await call("schedule", { changes: [change], reason: "Public holiday", notify: false, requestId });
assert.equal((await school.collection("exm_schedule_history").get()).size, 1);
await assert.rejects(call("schedule", { changes: [change], reason: "Stale schedule" }), /timetable changed/);
await call("schedule", { changes: [{ ...change, revision: 1, scheduleStatus: "Postponed" }], reason: "Flood warning" });
assert.equal((await school.collection("exm_papers").doc("p1").get()).get("date"), "");
await call("schedule", { changes: [{ ...change, revision: 2 }], reason: "New date confirmed" });
await school.collection("exm_papers").doc("p2").set({ ...paper, id: "p2", cycleId: "other-cycle", date: "2026-12-04", classIds: ["other"], studentIds: [], venue: "Hall 1" });
await assert.rejects(call("schedule", { changes: [{ ...change, revision: 3, date: "2026-12-04" }], reason: "Room conflict" }), /room|invigilator/);
await call("duty", { paperId: "p1", staffId: "t2", role: "Invigilator", hall: "Hall 1", reportBy: "08:30" });
assert.equal((await school.collection("exm_duties").get()).size, 1);
await assert.rejects(call("prepare", { classId: "custom11" }), /incomplete or unverified/);
const mark = { paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "custom11", theory: 60, internal: 15, verified: true, status: "Present" };
await school.collection("exm_marks").doc("p1__cand_s1").set({ ...mark, verificationFingerprint: markFingerprint(mark, paper) });
const { batchId } = await call("prepare", { classId: "custom11" });
const snapshot = (await school.collection("exm_report_cards").where("batchId", "==", batchId).get()).docs[0];
assert.equal(snapshot.get("privateOfficeNote"), undefined);
assert.equal(snapshot.get("total"), 75);
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("lockedClassIds"), ["custom11"]);
await assert.rejects(call("publishReport", { batchId }), /Approve/);
await call("submit", { batchId }); await call("approve", { batchId });
await call("lock", { paperId: "p1", locked: false, reason: "Correct internal mark" });
const changed = { ...mark, internal: 16 };
await school.collection("exm_marks").doc("p1__cand_s1").set({ ...changed, verificationFingerprint: markFingerprint(changed, paper) });
await assert.rejects(call("publishReport", { batchId }), /changed after preview/);
const next = await call("prepare", { classId: "custom11" });
await call("submit", { batchId: next.batchId }); await call("approve", { batchId: next.batchId }); await call("publishReport", { batchId: next.batchId, notify: false });
assert.equal((await school.collection("exm_report_batches").doc(next.batchId).get()).get("status"), "Published");
assert.equal((await school.collection("exm_report_cards").where("batchId", "==", next.batchId).get()).docs[0].get("status"), "Published");
assert.equal((await snapshot.ref.get()).get("total"), 75);
assert.ok((await school.collection("exm_activity").get()).size >= 10);
await db.doc("users/parent").set({ role: "parent", schoolId: "school", studentIds: ["s1"], parentCredentialVersion: "current" });
const { downloadExamReport } = require("./examReportPdf.js");
const readReport = (data, version = "current") => downloadExamReport.run({ auth: { uid: "parent", token: { parentCredentialVersion: version } }, data: { schoolId: "school", batchId: next.batchId, studentId: "s1", ...data } });
const pdf = await readReport({});
assert.equal(Buffer.from(pdf.content, "base64").subarray(0, 5).toString(), "%PDF-");
await assert.rejects(readReport({}, "old"), /unavailable/);
await assert.rejects(readReport({ studentId: "s2" }), /unavailable/);
await assert.rejects(readReport({ studentId: undefined }), /unavailable/);
await assert.rejects(readReport({ batchId }), /unavailable/);
const link = await readReport({ linkOnly: true });
assert.match(link.url, /openExamReport\?token=[a-f\d]{64}$/);
// One division's subject publication must not close a shared paper for another division.
await school.collection("exm_papers").doc("p1").update({ classIds: ["custom11", "custom11B"], locked: false, lockedClassIds: [], published: [], publishedClassIds: [] });
await call("subjectPublish", { paperId: "p1", classId: "custom11" });
const partialPaper = await school.collection("exm_papers").doc("p1").get();
assert.equal(partialPaper.get("locked"), false);
assert.deepEqual(partialPaper.get("publishedClassIds"), ["custom11"]);
const { queueExamNotification } = require("./examEvents.js");
const { createAppMessaging } = require("./appMessaging.js");
let sends = 0;
const messaging = createAppMessaging({ db, accountEnabled: async () => true, send: async ({ tokens }) => { sends++; return { responses: tokens.map(() => ({ success: true })) }; } });
await db.doc("users/parent/fcm_tokens/test-device").set({ app: "parent", parentCredentialVersion: "current" });
const published = (await school.collection("exm_report_batches").doc(next.batchId).get()).data();
await queueExamNotification(db, messaging, "school", next.batchId, published, "reports");
const jobCount = (await school.collection("push_deliveries").get()).size;
await queueExamNotification(db, messaging, "school", next.batchId, published, "reports");
assert.equal((await school.collection("push_deliveries").get()).size, jobCount);
assert.equal(jobCount, 2);
const parentJob = (await school.collection("push_deliveries").where("uid", "==", "parent").get()).docs[0];
await messaging.dispatch(parentJob.ref);
assert.equal((await parentJob.ref.get()).get("status"), "Completed");
assert.equal(sends, 1);
console.log("Exam server transactions: roles, request replay, schedule history/conflicts, duties, preview, stale approval, publication and immutable snapshots passed.");
console.log("Parent PDF authorization, credential replacement, child isolation, short-lived links and shared-paper publication passed.");
console.log("Notification recipient selection, durable queue replay and device dispatch passed with an injected sender (no live messages).");
await db.terminate();
await getFirestore(defaultApp).terminate();
