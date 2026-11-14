import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, setDoc } from "firebase/firestore";
const port = Number(process.env.RULES_TEST_PORT || 18081);
const env = await initializeTestEnvironment({ projectId: "demo-exam-setup", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
const paper = { cycleId: "cycle", grade: "11", classIds: ["cls_11A"], subject: "English", theory: 80, internal: 20, locked: false,
  studentIds: ["included"], evaluatorIds: { cls_11A: "t2" } };
const mark = { paperId: "paper", classId: "cls_11A", studentId: "included", candId: "cand_included", teacherId: "t2", theory: 70 };
try {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    const rows = {
      "users/u1": { schoolId: "school", role: "teacher", staffId: "t1" },
      "users/u2": { schoolId: "school", role: "teacher", staffId: "t2" },
      "schools/school/classes/cls_11A": { grade: "11", section: "A" },
      "schools/school/students/included": { classId: "cls_11A", status: "Active" },
      "schools/school/students/excluded": { classId: "cls_11A", status: "Active" },
      "schools/school/exm_papers/paper": paper,
    };
    for (const [path, value] of Object.entries(rows)) await setDoc(doc(db, path), value);
  });
  const t1 = env.authenticatedContext("u1").firestore();
  const t2 = env.authenticatedContext("u2").firestore();
  await assertSucceeds(setDoc(doc(t2, "schools/school/exm_marks/m1"), mark));
  await assertFails(setDoc(doc(t1, "schools/school/exm_marks/m2"), { ...mark, teacherId: "t1" }));
  await assertFails(setDoc(doc(t2, "schools/school/exm_marks/m3"), { ...mark, studentId: "excluded", candId: "cand_excluded" }));
  await env.withSecurityRulesDisabled(async (context) => setDoc(doc(context.firestore(), "schools/school/exm_papers/paper"), { ...paper, locked: true }));
  await assertFails(setDoc(doc(t2, "schools/school/exm_marks/m4"), mark));
  console.log("Exam rules verified selected examiner, exclusions and locked marks.");
} finally { await env.cleanup(); }

process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:" + port;
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const app = initializeApp({ projectId: "demo-exam-publication" }, "exam-test");
const db = getFirestore(app);
const { publishDueExams } = require("./examPublication.js");
const scheduled = db.collection("schools").doc("school");
await scheduled.set({});
await scheduled.collection("exm_cycles").doc("cycle").set({ title: "Term 1", status: "Draft", publicationState: "scheduled", publishAt: "2026-12-01T03:30:00.000Z", setupVersion: 1 });
await scheduled.collection("exm_papers").doc("paper").set({ ...paper, locked: true, setupVersion: 1 });
assert.equal(await publishDueExams(db, new Date("2026-12-01T03:29:00Z")), 0);
const counts = await Promise.all([publishDueExams(db, new Date("2026-12-01T03:30:00Z")), publishDueExams(db, new Date("2026-12-01T03:30:00Z"))]);
assert.equal(counts[0] + counts[1], 1);
assert.equal((await scheduled.collection("exm_cycles").doc("cycle").get()).get("publicationState"), "published");
assert.equal((await scheduled.collection("exm_papers").doc("paper").get()).get("locked"), false);
assert.equal(await publishDueExams(db, new Date("2026-12-01T03:35:00Z")), 0);
console.log("Scheduled exam publication verified timing, paper unlock and concurrent deduplication.");
await db.terminate();
