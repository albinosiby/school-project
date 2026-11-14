import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, setLogLevel } from "firebase/firestore";

setLogLevel("silent");
const port = Number(process.env.RULES_TEST_PORT || 8873);
const env = await initializeTestEnvironment({ projectId: "demo-dashboard-hardening", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
await env.clearFirestore();
let checks = 0;
const check = async (title, promise) => { await promise; checks++; console.log(`ok ${title}`); };
const path = (db, col, id) => doc(db, `schools/S1/${col}/${id}`);
const date = "2026-11-11";
const attendance = { classId: "cls_10B", teacherId: "teacher_1", date, period: 1, total: 2, marks: { student_1: "A" }, submitted: true };
const marks = { paperId: "paper", classId: "cls_10B", studentId: "student_1", candId: "cand_student_1", teacherId: "teacher_1", theory: 60 };
const leave = { staffId: "teacher_1", status: "Pending", from: date, to: date, reason: "Doctor appointment" };
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const seed = {
      "users/t1": { schoolId: "S1", role: "teacher", staffId: "teacher_1" },
      "users/t2": { schoolId: "S1", role: "teacher", staffId: "teacher_2" },
      "users/admin": { schoolId: "S1", role: "admin" },
      "schools/S1/classes/cls_10B": { grade: "10", section: "B", classTeacherId: "teacher_1" },
      "schools/S1/classes/cls_10A": { grade: "10", section: "A", classTeacherId: "teacher_2" },
      "schools/S1/students/student_1": { name: "Synthetic student", classId: "cls_10B", status: "Active" },
      "schools/S1/assignments/assignment": { teacherId: "teacher_1", classId: "cls_10B", subject: "Maths" },
      "schools/S1/teaching_access/cls_10B__teacher_1": { assignmentId: "assignment", subjects: { Maths: { assignmentId: "assignment" } } },
      "schools/S1/exm_papers/paper": { grade: "10", subject: "Maths", classIds: ["cls_10B"], theory: 80, locked: false },
      "schools/S1/exm_marks/existing": { ...marks, internal: 10, verified: false, medical: false },
      "schools/S1/student_leaves/own": { studentId: "student_1", classId: "cls_10B", status: "Pending" },
      "schools/S1/student_leaves/other": { studentId: "student_2", classId: "cls_10A", status: "Pending" },
      "schools/S1/fee_invoices/invoice": { amount: 100, paid: 0, balance: 100, status: "Pending" },
      "schools/S1/fee_claims/claim": { status: "Pending", invoiceId: "invoice" },
      "schools/S1/ops_substitutions/sub_2026-11-11_cls_10A_2": { substituteTeacherId: "teacher_1", classId: "cls_10A", period: 2, date, status: "Assigned" },
    };
    for (const [name, data] of Object.entries(seed)) await setDoc(doc(db, name), data);
  });
  const teacher = env.authenticatedContext("t1").firestore(), admin = env.authenticatedContext("admin").firestore();
  await check("anonymous access denied", assertFails(getDoc(path(env.unauthenticatedContext().firestore(), "students", "student_1"))));
  await check("teacher cannot access another school", assertFails(getDoc(doc(teacher, "schools/S2/students/student_1"))));
  await check("valid own-class attendance allowed", assertSucceeds(setDoc(path(teacher, "ops_attendance", "own"), attendance)));
  await check("another class attendance denied", assertFails(setDoc(path(teacher, "ops_attendance", "other"), { ...attendance, classId: "cls_10A" })));
  await check("assigned cover can submit its exact period", assertSucceeds(setDoc(path(teacher, "ops_attendance", "cover"), { ...attendance, classId: "cls_10A", period: 2 })));
  await check("cover for another day denied", assertFails(setDoc(path(teacher, "ops_attendance", "wrong_day"), { ...attendance, classId: "cls_10A", period: 2, date: "2026-11-12" })));
  await check("negative total denied", assertFails(setDoc(path(teacher, "ops_attendance", "negative"), { ...attendance, total: -1 })));
  await check("invalid mark values denied", assertFails(setDoc(path(teacher, "ops_attendance", "bad_mark"), { ...attendance, marks: { student_1: "invalid" } })));
  await check("ownership hijack denied", assertFails(updateDoc(path(teacher, "ops_attendance", "own"), { teacherId: "teacher_2" })));
  await check("class change after creation denied", assertFails(updateDoc(path(teacher, "ops_attendance", "own"), { classId: "cls_10A", period: 2 })));
  await check("valid pending leave allowed", assertSucceeds(setDoc(path(teacher, "staff_leaves", "pending"), leave)));
  await check("self-approved leave denied on create", assertFails(setDoc(path(teacher, "staff_leaves", "approved"), { ...leave, status: "Approved" })));
  await check("self-approved leave denied on update", assertFails(updateDoc(path(teacher, "staff_leaves", "pending"), { status: "Approved" })));
  await check("forged decision metadata denied", assertFails(updateDoc(path(teacher, "staff_leaves", "pending"), { decidedBy: "admin" })));
  await check("oversized leave reason denied", assertFails(updateDoc(path(teacher, "staff_leaves", "pending"), { reason: "x".repeat(2001) })));
  await check("missing required leave field denied", assertFails(setDoc(path(teacher, "staff_leaves", "missing"), { staffId: "teacher_1", status: "Pending" })));
  await check("valid own-subject marks allowed", assertSucceeds(setDoc(path(teacher, "exm_marks", "new"), marks)));
  await check("forged verification on create denied", assertFails(setDoc(path(teacher, "exm_marks", "forged"), { ...marks, verified: true })));
  await check("protected marks fields cannot change", assertFails(updateDoc(path(teacher, "exm_marks", "existing"), { verified: true, internal: 80 })));
  await check("teacher can edit theory while preserving protected fields", assertSucceeds(updateDoc(path(teacher, "exm_marks", "existing"), { theory: 70 })));
  await check("out-of-range theory denied", assertFails(updateDoc(path(teacher, "exm_marks", "existing"), { theory: 81 })));
  await check("class teacher decides own student leave", assertSucceeds(updateDoc(path(teacher, "student_leaves", "own"), { status: "Approved", decisionNote: "Approved" })));
  await check("student leave of another class denied", assertFails(updateDoc(path(teacher, "student_leaves", "other"), { status: "Approved" })));
  await check("admin cannot bypass payment service", assertFails(setDoc(path(admin, "fee_payments", "forged"), { amount: 100 })));
  await check("admin cannot alter paid balances directly", assertFails(updateDoc(path(admin, "fee_invoices", "invoice"), { paid: 50, balance: 50 })));
  await check("admin may create an unpaid invoice", assertSucceeds(setDoc(path(admin, "fee_invoices", "new"), { amount: 200, paid: 0, balance: 200 })));
  await check("admin cannot bypass claim verification", assertFails(updateDoc(path(admin, "fee_claims", "claim"), { status: "Verified" })));
  await check("admin may reject a claim", assertSucceeds(updateDoc(path(admin, "fee_claims", "claim"), { status: "Rejected" })));
  await check("admin cannot bypass teacher reservation", assertFails(updateDoc(path(admin, "classes", "cls_10A"), { classTeacherId: "teacher_1" })));
  await check("teacher cannot create their own access index", assertFails(setDoc(path(teacher, "teaching_access", "cls_10A__teacher_1"), { assignmentId: "assignment" })));
  await setDoc(path(admin, "set_roles", "role_teacher"), { perms: [] });
  await check("revoked attendance permission is enforced", assertFails(updateDoc(path(teacher, "ops_attendance", "own"), { total: 3 })));
  await check("revoked marks permission is enforced", assertFails(updateDoc(path(teacher, "exm_marks", "existing"), { theory: 40 })));
  await setDoc(path(admin, "set_roles", "role_teacher"), { perms: ["Marks & Grades Entry", "Daily Attendance"] });
  await deleteDoc(path(admin, "assignments", "assignment"));
  await check("stale access index cannot preserve revoked subject access", assertFails(updateDoc(path(teacher, "exm_marks", "existing"), { theory: 40 })));
  await check("admin cannot forge a push queue job", assertFails(setDoc(path(admin, "push_deliveries", "forged"), {uid:"victim"})));
  await env.withSecurityRulesDisabled(async (ctx) => { await updateDoc(doc(ctx.firestore(), "users/admin"), {mfaVersion:"v1"}); });
  await check("password-only admin cannot read school data after MFA", assertFails(getDoc(path(admin, "classes", "cls_10A"))));
  await check("admin can still read their own login state for MFA", assertSucceeds(getDoc(doc(admin, "users/admin"))));
  await check("admin cannot remove their own MFA requirement", assertFails(updateDoc(doc(admin, "users/admin"), {mfaVersion:""})));
  const verifiedAdmin = env.authenticatedContext("admin", {firebase:{sign_in_provider:"custom"},adminMfaVersion:"v1",adminMfaAt:Math.floor(Date.now()/1000)}).firestore();
  await check("verified passkey session reads the school", assertSucceeds(getDoc(path(verifiedAdmin, "classes", "cls_10A"))));
  const expiredAdmin = env.authenticatedContext("admin", {firebase:{sign_in_provider:"custom"},adminMfaVersion:"v1",adminMfaAt:Math.floor(Date.now()/1000)-46800}).firestore();
  await check("expired second-factor session is rejected", assertFails(getDoc(path(expiredAdmin, "classes", "cls_10A"))));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), "platform_schools/S1"), {status:"active",rolloverJob:"2026-27"}); });
  await check("admin can read rollover progress during maintenance", assertSucceeds(getDoc(path(verifiedAdmin, "classes", "cls_10A"))));
  await check("school edits are locked during rollover", assertFails(setDoc(path(verifiedAdmin, "students", "new"), {name:"Late admission"})));
  await check("mobile school reads pause during rollover", assertFails(getDoc(path(teacher, "classes", "cls_10B"))));
  await check("archives cannot be forged through the nested wildcard", assertFails(setDoc(doc(verifiedAdmin, "schools/S1/academic_archives/2026-27/students/forged"), {grade:"12"})));
  assert.ok(checks >= 43);
  console.log(`${checks} authorization checks passed`);
} finally { await env.cleanup(); }
