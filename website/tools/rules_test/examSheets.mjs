// Rules and server checks for docs/EXAMS_SHEETS_RESULTS_CONTRACT.md (mark sheets, class results). Emulator only.
//   website/: EMULATOR_PROJECT=demo-exam-sheets RULES_TEST_PORT=8080 tools/emulator_exec.sh firestore "cd tools/rules_test && node examSheets.mjs"
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, query, setDoc, setLogLevel, updateDoc, where } from "firebase/firestore";
setLogLevel("silent");
const port = Number(process.env.RULES_TEST_PORT || 18081);
const env = await initializeTestEnvironment({ projectId: "demo-exam-sheets", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
const sheet = { cycleId: "c1", paperId: "p1", classId: "cls_9A", classLabel: "9-A", subject: "Maths", grade: "9", ownerId: "t1", ownerName: "Owner", rosterIds: ["s1", "s2"],
  components: { mode: "marks", theory: 80, practical: 20, internal: 20, passMarks: 33, gradeOptions: [] }, status: "NotStarted", version: 1, summary: { total: 2, entered: 0 } };
const mark = { paperId: "p1", classId: "cls_9A", studentId: "s1", candId: "cand_s1", teacherId: "t1", theory: 70, practical: 15, internal: 18, status: "Present", updatedBy: "u1" };
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [path, value] of Object.entries({
      "users/u1": { schoolId: "school", role: "teacher", staffId: "t1" }, "users/u2": { schoolId: "school", role: "teacher", staffId: "t2" },
      "users/admin": { schoolId: "school", role: "admin" }, "users/parent": { schoolId: "school", role: "parent", studentIds: ["s1"] },
      "schools/school/classes/cls_9A": { grade: "9", section: "A" },
      "schools/school/students/s1": { classId: "cls_9A", status: "Active" }, "schools/school/students/s2": { classId: "cls_9A", status: "Active" }, "schools/school/students/s9": { classId: "cls_9A", status: "Active" },
      "schools/school/exm_papers/p1": { cycleId: "c1", grade: "9", classIds: ["cls_9A"], subject: "Maths", theory: 80, practical: 20, internal: 20, locked: true, evaluatorIds: { cls_9A: "t2" }, sheetsOpened: true },
      "schools/school/exm_sheets/p1__cls_9A": sheet,
      "schools/school/exm_results/c1__s1": { cycleId: "c1", classId: "cls_9A", studentId: "s1", status: "Published", pct: 80 },
      "schools/school/exm_results/c1__s1__v1": { cycleId: "c1", classId: "cls_9A", studentId: "s1", status: "Superseded", pct: 70 },
      "schools/school/exm_results/c2__s1": { cycleId: "c2", classId: "cls_9A", studentId: "s1", status: "Compiled", pct: 60 },
      "schools/school/exm_results/c1__s2": { cycleId: "c1", classId: "cls_9A", studentId: "s2", status: "Published", pct: 50 },
      "schools/school/exm_class_results/c1__cls_9A": { cycleId: "c1", classId: "cls_9A", status: "Published", version: 1 },
    })) await setDoc(doc(db, path), value);
  });
  const t1 = env.authenticatedContext("u1").firestore(), t2 = env.authenticatedContext("u2").firestore();
  const admin = env.authenticatedContext("admin").firestore(), parent = env.authenticatedContext("parent").firestore();
  const sheetRef = (db) => doc(db, "schools/school/exm_sheets/p1__cls_9A");
  // the sheet overrides the legacy paper checks (paper is locked and names t2 as evaluator; the sheet owner is t1)
  await assertSucceeds(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), mark));
  await assertSucceeds(updateDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { theory: 0, practical: null, internal: 20, status: "Present", updatedBy: "u1" }));
  await assertSucceeds(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s2"), { ...mark, studentId: "s2", candId: "cand_s2", theory: null, practical: null, internal: null, status: "Absent" }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, theory: 81 }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, practical: 21 }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, internal: -1 }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, verified: true }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, medical: true }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { ...mark, gradeValue: "A" }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s9"), { ...mark, studentId: "s9", candId: "cand_s9" }));
  await assertFails(setDoc(doc(t2, "schools/school/exm_marks/p1__cand_s1_t2"), { ...mark, teacherId: "t2", updatedBy: "u2" }));
  await assertFails(updateDoc(doc(t2, "schools/school/exm_marks/p1__cand_s1"), { theory: 1, updatedBy: "u2" }));
  console.log("Sheet marks: owner writes all components within maxima; out-of-range, server-only keys, unrostered and non-owner writes are refused.");
  // reads and the submit transition
  await assertSucceeds(getDoc(sheetRef(t1)));
  await assertSucceeds(getDocs(query(collection(t1, "schools/school/exm_sheets"), where("ownerId", "==", "t1"))));
  await assertFails(getDoc(sheetRef(t2)));
  await assertFails(getDoc(sheetRef(parent)));
  await assertFails(updateDoc(sheetRef(t2), { status: "Submitted", submittedBy: "t2", updatedBy: "u2" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Approved", submittedBy: "t1", updatedBy: "u1" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Submitted", submittedBy: "t1", ownerId: "t2", updatedBy: "u1" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Submitted", submittedBy: "t2", updatedBy: "u1" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Submitted", submittedBy: "t1", rosterIds: ["s1"], updatedBy: "u1" }));
  await assertSucceeds(updateDoc(sheetRef(t1), { status: "Submitted", submittedAt: "2026-11-12T10:00:00.000Z", submittedBy: "t1", updatedAt: "2026-11-12T10:00:00.000Z", updatedBy: "u1" }));
  await assertFails(updateDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { theory: 5, updatedBy: "u1" }));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/p1__cand_s9b"), { ...mark, studentId: "s9", candId: "cand_s9" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Approved", updatedBy: "u1" }));
  await assertFails(updateDoc(sheetRef(t1), { status: "Returned", updatedBy: "u1" }));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(sheetRef(ctx.firestore()), { status: "Approved" }));
  await assertFails(updateDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { theory: 5, updatedBy: "u1" }));
  await env.withSecurityRulesDisabled(async (ctx) => updateDoc(sheetRef(ctx.firestore()), { status: "Returned" }));
  await assertSucceeds(updateDoc(doc(t1, "schools/school/exm_marks/p1__cand_s1"), { theory: 5, updatedBy: "u1" }));
  console.log("Sheet transitions: owner reads and submits with only the transition keys; cannot approve/return; Submitted/Approved sheets block marks, Returned reopens them.");
  // admin and parent sides
  await assertSucceeds(getDoc(sheetRef(admin)));
  await assertSucceeds(updateDoc(sheetRef(admin), { ownerName: "Renamed", updatedBy: "admin" }));
  await assertFails(updateDoc(doc(admin, "schools/school/exm_results/c1__s1"), { pct: 100, updatedBy: "admin" }));
  await assertFails(setDoc(doc(admin, "schools/school/exm_class_results/c1__cls_9B"), { status: "Published", updatedBy: "admin" }));
  await assertSucceeds(getDoc(doc(admin, "schools/school/exm_results/c1__s1")));
  await assertSucceeds(getDoc(doc(admin, "schools/school/exm_class_results/c1__cls_9A")));
  await assertSucceeds(getDoc(doc(parent, "schools/school/exm_results/c1__s1")));
  await assertFails(getDoc(doc(parent, "schools/school/exm_results/c1__s1__v1")));
  await assertFails(getDoc(doc(parent, "schools/school/exm_results/c2__s1")));
  await assertFails(getDoc(doc(parent, "schools/school/exm_results/c1__s2")));
  await assertFails(getDoc(doc(parent, "schools/school/exm_class_results/c1__cls_9A")));
  await assertSucceeds(getDocs(query(collection(parent, "schools/school/exm_results"), where("studentId", "==", "s1"), where("status", "==", "Published"))));
  await assertFails(getDocs(query(collection(parent, "schools/school/exm_results"), where("studentId", "==", "s1"))));
  await assertFails(getDoc(doc(t1, "schools/school/exm_results/c1__s1")));
  console.log("Results: server-only writes, admin reads, parent reads only own Published exm_results.");
} finally { await env.cleanup(); }

// ---- server actions against the emulator (no rules; the callable runs as the admin SDK) ----
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${port}`;
// a re-run against a long-lived emulator starts from empty server-side data
await fetch(`http://127.0.0.1:${port}/emulator/v1/projects/demo-exam-sheets-server/databases/(default)/documents`, { method: "DELETE" });
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-exam-sheets-server" }, "exam-sheets");
const db = getFirestore(app), school = db.doc("schools/school");
const { createExamManager } = require("./examManagement.js");
const { syncSheetForMark, queueExamNotification, auditRecord } = require("./examEvents.js");
const { publishDueClassResults } = require("./examPublication.js");
const { createAppMessaging } = require("./appMessaging.js");
const manage = createExamManager({ db });
const cycle = { title: "PT1", start: "2026-12-01", end: "2026-12-10", status: "Scheduled", publicationState: "published", classIds: ["cls_9A", "cls_9B"], examTypeId: "pt1", termId: "term1", resultRules: { requireApproval: true, absentRule: "zero", rankScope: "division" } };
const paper = (id, subject, extra = {}) => ({ id, cycleId: "c1", grade: "9", classIds: ["cls_9A", "cls_9B"], subject, code: subject.slice(0, 3).toUpperCase(), date: "2026-12-02", start: "09:00", duration: 2, theory: 80, internal: 20, practical: 0, passMarks: 33, status: "Scheduled", published: [], publishedClassIds: [], setupVersion: 1, setupPublished: true, evaluatorIds: { cls_9A: "t1" }, ...extra });
for (const [path, value] of Object.entries({
  "users/admin": { role: "admin", schoolId: "school", name: "Principal" }, "users/u1": { role: "teacher", schoolId: "school", staffId: "t1" }, "users/u2": { role: "teacher", schoolId: "school", staffId: "t2" },
  "users/parent": { role: "parent", schoolId: "school", studentIds: ["s1"], parentCredentialVersion: "current" },
  "schools/school": {}, "schools/school/exm_cycles/c1": cycle,
  "schools/school/set_exam_types/pt1": { name: "Periodic Test 1", short: "PT1", termId: "term1", weight: 10, shareSubjectWise: true, countsInTerm: true },
  "schools/school/exm_papers/p1": paper("p1", "Maths"), "schools/school/exm_papers/p2": paper("p2", "Science", { evaluatorIds: {} }), "schools/school/exm_papers/p3": paper("p3", "Gone", { scheduleStatus: "Cancelled" }),
  "schools/school/classes/cls_9A": { grade: "9", section: "A", classTeacherId: "t2" }, "schools/school/classes/cls_9B": { grade: "9", section: "B", classTeacherId: "t2" },
  "schools/school/assignments/a1": { classId: "cls_9B", subject: "maths", teacherId: "t3" },
  "schools/school/students/s1": { name: "One", grade: "9", section: "A", classId: "cls_9A", roll: 1, status: "Active", guardianUids: ["parent"] },
  "schools/school/students/s2": { name: "Two", grade: "9", section: "A", classId: "cls_9A", roll: 2, status: "Active" },
  "schools/school/students/s3": { name: "Three", grade: "9", section: "B", classId: "cls_9B", roll: 1, status: "Active" },
  "schools/school/staff/t1": { name: "Teacher 1" }, "schools/school/staff/t2": { name: "Teacher 2" }, "schools/school/staff/t3": { name: "Teacher 3" }, "schools/school/staff/t4": { name: "Left", status: "Resigned" },
  "schools/school/exm_results/old__s1": { id: "old__s1", cycleId: "old", classId: "cls_9A", studentId: "s1", termId: "term1", examTypeId: "half", status: "Published", pct: 60 },
  "schools/school/set_exam_types/half": { short: "HY", termId: "term1", weight: 30, countsInTerm: true },
})) await db.doc(path).set(value);
const call = (action, payload = {}, uid = "admin") => manage({ auth: { uid, token: {} }, data: { action, schoolId: "school", cycleId: "c1", requestId: randomUUID(), ...payload } });
const sheetDoc = async (id) => (await school.collection("exm_sheets").doc(id).get()).data();
const writeMark = async (paperId, studentId, classId, data) => {
  const ref = school.collection("exm_marks").doc(`${paperId}__cand_${studentId}`);
  await ref.set({ paperId, studentId, candId: `cand_${studentId}`, classId, teacherId: "t1", updatedBy: "u1", ...data }, { merge: true });
  await syncSheetForMark(db, "school", (await ref.get()).data());
};
await assert.rejects(call("openEntry", {}, "u1"), /cannot manage/);
// openEntry: one sheet per live paper × division, owner chain, idempotent re-run
const opened = await call("openEntry");
assert.equal(opened.created, 4);
assert.deepEqual((await school.collection("exm_sheets").get()).docs.map((d) => d.id).sort(), ["p1__cls_9A", "p1__cls_9B", "p2__cls_9A", "p2__cls_9B"]);
assert.equal((await sheetDoc("p1__cls_9A")).ownerId, "t1"); assert.equal((await sheetDoc("p1__cls_9B")).ownerId, "t3"); assert.equal((await sheetDoc("p2__cls_9A")).ownerId, "t2");
assert.deepEqual((await sheetDoc("p1__cls_9A")).rosterIds, ["s1", "s2"]);
assert.equal((await school.collection("exm_cycles").doc("c1").get()).get("stage"), "entry");
assert.equal((await call("openEntry")).created, 0);
assert.equal((await school.collection("exm_papers").doc("p1").get()).get("sheetsOpened"), true);
assert.equal((await school.collection("exm_papers").doc("p3").get()).get("sheetsOpened"), undefined);
// marks trigger: summary + NotStarted → InProgress, idempotent
await writeMark("p1", "s1", "cls_9A", { theory: 70, internal: 15 });
let s = await sheetDoc("p1__cls_9A");
assert.equal(s.status, "InProgress"); assert.equal(s.summary.entered, 1); assert.equal(s.summary.highest, 85);
assert.equal(await syncSheetForMark(db, "school", (await school.collection("exm_marks").doc("p1__cand_s1").get()).data()), null);
assert.equal(await syncSheetForMark(db, "school", { paperId: "nosheet", classId: "cls_9A", studentId: "s1" }), null);
// submit needs a complete roster
await assert.rejects(call("sheetSubmit", { sheetId: "p1__cls_9A" }), /1 of 2 students/);
await assert.rejects(call("sheetApprove", { sheetId: "p1__cls_9A" }), /cannot move to Approved/);
await writeMark("p1", "s2", "cls_9A", { theory: null, internal: null, status: "Absent" });
await call("sheetSubmit", { sheetId: "p1__cls_9A" });
assert.equal((await sheetDoc("p1__cls_9A")).status, "Submitted");
await assert.rejects(call("sheetReturn", { sheetId: "p1__cls_9A", note: "no" }), /five characters/);
await call("sheetReturn", { sheetId: "p1__cls_9A", note: "Check roll 2 attendance" });
s = await sheetDoc("p1__cls_9A"); assert.equal(s.status, "Returned"); assert.equal(s.returnNote, "Check roll 2 attendance");
assert.equal(auditRecord("exm_sheets", { status: "Returned" }, { status: "Submitted" }), "Sheet submitted");
assert.equal(auditRecord("exm_sheets", { status: "Submitted" }, { status: "Approved" }), null);
// approve: verifies every rostered mark, shares subject-wise (exam type policy) → paper publishedClassIds
await call("sheetSubmit", { sheetId: "p1__cls_9A" });
const approved = await call("sheetApprove", { sheetId: "p1__cls_9A" });
assert.equal(approved.verified, 2); assert.equal(approved.subjectShared, true);
const m1 = (await school.collection("exm_marks").doc("p1__cand_s1").get()).data();
assert.equal(m1.verified, true); assert.ok(m1.verificationFingerprint);
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("publishedClassIds"), ["cls_9A"]);
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("published"), ["9-A"]);
// owner notification for returned/approved sheets goes to the owner's teacher account only
const messaging = createAppMessaging({ db, accountEnabled: async () => true, send: async ({ tokens }) => ({ responses: tokens.map(() => ({ success: true })) }) });
assert.equal(await queueExamNotification(db, messaging, "school", "p1__cls_9A:Approved:x", await sheetDoc("p1__cls_9A"), "sheet"), 1);
assert.equal(await queueExamNotification(db, messaging, "school", "p1__cls_9A:Approved:x", await sheetDoc("p1__cls_9A"), "sheet"), 1);
const jobs = await school.collection("push_deliveries").get();
assert.equal(jobs.size, 1); assert.equal(jobs.docs[0].get("uid"), "u1"); assert.equal(jobs.docs[0].get("message").route, "/marks");
// assign: not while Locked; active staff only
await assert.rejects(call("sheetAssign", { sheetId: "p2__cls_9A", ownerId: "t4" }), /active staff/);
await call("sheetAssign", { sheetId: "p2__cls_9A", ownerId: "t1" });
assert.equal((await sheetDoc("p2__cls_9A")).ownerName, "Teacher 1");
// compile needs every sheet approved
await assert.rejects(call("compile", { classId: "cls_9A" }), /not approved yet/);
await writeMark("p2", "s1", "cls_9A", { theory: 40, internal: 10 });
await writeMark("p2", "s2", "cls_9A", { theory: 20, internal: 5 });
await call("sheetSubmit", { sheetId: "p2__cls_9A" }); await call("sheetApprove", { sheetId: "p2__cls_9A" });
await assert.rejects(call("signOff", { classId: "cls_9A" }), /Compile/);
const compiled = await call("compile", { classId: "cls_9A" });
assert.equal(compiled.version, 1); assert.equal(compiled.students, 2); assert.equal(compiled.incomplete, 0);
assert.equal((await sheetDoc("p1__cls_9A")).status, "Locked");
let r1 = (await school.collection("exm_results").doc("c1__s1").get()).data();
assert.equal(r1.status, "Compiled"); assert.equal(r1.total, 135); assert.equal(r1.rank, 1); assert.equal(r1.pct, 67.5);
assert.deepEqual(r1.term.contributions.map((c) => [c.cycleId, c.weight, c.pct]), [["c1", 10, 67.5], ["old", 30, 60]]);
assert.equal(r1.term.pct, 61.88);
assert.equal((await school.collection("exm_cycles").doc("c1").get()).get("stage"), "tabulation");
await assert.rejects(call("sheetAssign", { sheetId: "p1__cls_9A", ownerId: "t2" }), /Locked/);
await assert.rejects(call("publishResults", { classIds: ["cls_9A"] }), /Sign off/);
await call("signOff", { classId: "cls_9A" });
assert.equal((await school.collection("exm_class_results").doc("c1__cls_9A").get()).get("status"), "Approved");
await assert.rejects(call("publishResults", { classIds: ["cls_9A"], publishAt: "2020-01-01T00:00:00Z" }), /future/);
// scheduled publication goes through the shared routine
await call("publishResults", { classIds: ["cls_9A"], publishAt: "2999-01-01T00:00:00.000Z" });
assert.equal(await publishDueClassResults(db, new Date("2998-12-31T00:00:00Z")), 0);
assert.equal(await publishDueClassResults(db, new Date("2999-01-01T00:00:00Z")), 1);
assert.equal(await publishDueClassResults(db, new Date("2999-01-01T00:05:00Z")), 0);
r1 = (await school.collection("exm_results").doc("c1__s1").get()).data();
assert.equal(r1.status, "Published"); assert.equal(r1.version, 1);
assert.deepEqual((await school.collection("exm_papers").doc("p2").get()).get("publishedClassIds"), ["cls_9A"]);
assert.equal((await school.collection("exm_class_results").doc("c1__cls_9A").get()).get("publishAt"), null);
await assert.rejects(call("publishResults", { classIds: ["cls_9A"] }), /already published/);
// correction: reopen → stale, projection withdrawn; recompile → version 2 with the published copy archived
await assert.rejects(call("sheetReopen", { sheetId: "p1__cls_9A", reason: "Totalling error in roll 1" }, "u1"), /cannot manage/);
const reopened = await call("sheetReopen", { sheetId: "p1__cls_9A", reason: "Totalling error in roll 1" });
assert.equal(reopened.version, 2); assert.equal(reopened.resultsStale, true);
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("publishedClassIds"), []);
assert.equal((await school.collection("exm_results").doc("c1__s1").get()).get("stale"), true);
assert.equal((await school.collection("exm_cycles").doc("c1").get()).get("correctionPending"), true);
await assert.rejects(call("publishResults", { classIds: ["cls_9A"] }), /Compile the division again|already published/);
await writeMark("p1", "s1", "cls_9A", { theory: 75, internal: 15 });
assert.equal((await school.collection("exm_marks").doc("p1__cand_s1").get()).get("verified"), true); // the fingerprint trigger clears this in production
await call("sheetSubmit", { sheetId: "p1__cls_9A" }); await call("sheetApprove", { sheetId: "p1__cls_9A" });
const recompiled = await call("compile", { classId: "cls_9A" });
assert.equal(recompiled.version, 2);
assert.equal((await school.collection("exm_results").doc("c1__s1").get()).get("status"), "Compiled");
assert.equal((await school.collection("exm_results").doc("c1__s1__v1").get()).get("status"), "Published");
assert.equal((await school.collection("exm_class_results").doc("c1__cls_9A__v1").get()).get("status"), "Published");
await call("signOff", { classId: "cls_9A" });
const republished = await call("publishResults", { classIds: ["cls_9A"] });
assert.deepEqual(republished.published, ["cls_9A"]);
r1 = (await school.collection("exm_results").doc("c1__s1").get()).data();
assert.equal(r1.status, "Published"); assert.equal(r1.version, 2); assert.equal(r1.total, 140);
assert.equal((await school.collection("exm_results").doc("c1__s1__v1").get()).get("status"), "Superseded");
assert.equal((await school.collection("exm_results").doc("c1__s1__v1").get()).get("supersededBy"), "c1__s1");
assert.equal((await school.collection("exm_class_results").doc("c1__cls_9A__v1").get()).get("status"), "Superseded");
assert.equal((await school.collection("exm_cycles").doc("c1").get()).get("correctionPending"), false);
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("publishedClassIds"), ["cls_9A"]);
// withdraw: results hidden again, projection removed
await call("withdrawResults", { classId: "cls_9A", reason: "Awaiting moderation" });
assert.equal((await school.collection("exm_results").doc("c1__s1").get()).get("status"), "Approved");
assert.equal((await school.collection("exm_class_results").doc("c1__cls_9A").get()).get("status"), "Approved");
assert.deepEqual((await school.collection("exm_papers").doc("p1").get()).get("publishedClassIds"), []);
await assert.rejects(call("withdrawResults", { classId: "cls_9A", reason: "Awaiting moderation" }), /Only published/);
// receipts and audit rows
const replay = randomUUID();
await call("signOff", { classId: "cls_9A", requestId: replay }).catch(() => {});
const actions = (await school.collection("exm_activity").get()).docs.map((d) => d.get("action"));
for (const expected of ["Marks entry opened", "Sheet submitted", "Sheet returned", "Sheet approved", "Sheet reassigned", "Results compiled", "Results signed off", "Results publication scheduled", "Results published", "Sheet reopened", "Results republished", "Results withdrawn"])
  assert.ok(actions.includes(expected), expected);
console.log("Sheet/result actions: openEntry, summary trigger, submit/return/approve (verification + subject-wise share), assign, compile/signOff/publish (scheduled and immediate), reopen/recompile/republish (archived versions) and withdraw passed.");
await db.terminate();
