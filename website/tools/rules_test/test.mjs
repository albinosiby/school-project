// Firestore rules tests for docs/DATA_CONTRACT.md section 7. Run with `npm test` (needs the Firestore emulator, i.e. Java + firebase-tools).
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const env = await initializeTestEnvironment({
  projectId: "demo-school-rules",
  firestore: { rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8"), host: "127.0.0.1", port: 8080 },
});
let failed = 0;
const check = async (name, p) => { try { await p; console.log("  ok  ", name); } catch (e) { failed++; console.log("  FAIL", name, "-", String(e.message ?? e).split("\n")[0]); } };

// seed: school S1 (admin a1, teachers t1/t2, parent p1), school S2 (admin a2)
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore();
  await setDoc(doc(db, "users/a1"), { schoolId: "S1", role: "admin" });
  await setDoc(doc(db, "users/t1"), { schoolId: "S1", role: "teacher", staffId: "stf_025" });
  await setDoc(doc(db, "users/t2"), { schoolId: "S1", role: "teacher", staffId: "stf_023" });
  await setDoc(doc(db, "users/p1"), { schoolId: "S1", role: "parent", studentIds: ["stu_101"] });
  await setDoc(doc(db, "users/a2"), { schoolId: "S2", role: "admin" });
  await setDoc(doc(db, "schools/S1/students/stu_101"), { name: "A", classId: "cls_10B" });
  await setDoc(doc(db, "schools/S1/fee_invoices/f1"), { amount: 1 });
  await setDoc(doc(db, "schools/S1/exm_cycles/c1"), { title: "T" });
  await setDoc(doc(db, "schools/S1/ops_attendance/2026-10-26_cls_10B_1"), { teacherId: "stf_025", marks: {}, total: 42 });
  await setDoc(doc(db, "schools/S1/ops_attendance/2026-10-26_cls_10A_1"), { teacherId: "stf_023", marks: {}, total: 48 });
  await setDoc(doc(db, "schools/S1/tk_tasks/k1"), { teacherId: "stf_025", title: "mine" });
  await setDoc(doc(db, "schools/S1/tk_tasks/k2"), { teacherId: "stf_023", title: "theirs" });
  await setDoc(doc(db, "schools/S1/staff_leaves/l1"), { staffId: "stf_025", status: "Pending" });
  await setDoc(doc(db, "schools/S1/staff_leaves/l2"), { staffId: "stf_023", status: "Pending" });
  await setDoc(doc(db, "schools/S1/ops_substitutions/sub_1"), { substituteTeacherId: "stf_025", status: "Assigned", classId: "cls_8C" });
  await setDoc(doc(db, "schools/S1/live_classes/lv1"), { teacherId: "stf_025", title: "x" });
  await setDoc(doc(db, "schools/S2/students/other"), { name: "Z" });
  await setDoc(doc(db, "schools/S1/staff_attendance/2026-10-25_stf_023"), { staffId: "stf_023", teacherId: "stf_023", date: "2026-10-25", in: "08:00", status: "Present" });
  await setDoc(doc(db, "schools/S1/staff_regularizations/r1"), { staffId: "stf_025", teacherId: "stf_025", status: "Pending", date: "2026-10-24" });
  await setDoc(doc(db, "schools/S1/staff_regularizations/r2"), { staffId: "stf_025", teacherId: "stf_025", status: "Approved", date: "2026-10-23" });
  await setDoc(doc(db, "schools/S1/staff_regularizations/r3"), { staffId: "stf_023", teacherId: "stf_023", status: "Pending", date: "2026-10-24" });
  await setDoc(doc(db, "schools/S1/exm_papers/p1"), { subject: "Maths", locked: false });
  await setDoc(doc(db, "schools/S1/exm_duties/d1"), { staffId: "stf_025", paperId: "p1" });
  await setDoc(doc(db, "schools/S1/set_leave_policy/policy"), { checkInBy: "08:15", types: [] });
});

const as = (uid) => env.authenticatedContext(uid).firestore();
const anon = env.unauthenticatedContext().firestore();

console.log("users");
await check("user reads own doc", assertSucceeds(getDoc(doc(as("t1"), "users/t1"))));
await check("teacher cannot read another user doc", assertFails(getDoc(doc(as("t1"), "users/t2"))));
await check("admin reads staff user doc of own school", assertSucceeds(getDoc(doc(as("a1"), "users/t1"))));
await check("admin creates teacher user doc", assertSucceeds(setDoc(doc(as("a1"), "users/newT"), { schoolId: "S1", role: "teacher", staffId: "stf_030" })));
await check("admin cannot create user doc in another school", assertFails(setDoc(doc(as("a1"), "users/x"), { schoolId: "S2", role: "teacher", staffId: "s" })));
await check("new admin self-creates own school doc", assertSucceeds(setDoc(doc(as("newAdmin"), "users/newAdmin"), { schoolId: "newAdmin", role: "admin" })));
await check("user cannot self-create admin of another school", assertFails(setDoc(doc(as("evil"), "users/evil"), { schoolId: "S1", role: "admin" })));
await check("teacher cannot promote self", assertFails(updateDoc(doc(as("t1"), "users/t1"), { role: "admin" })));

console.log("tenancy");
await check("anonymous denied", assertFails(getDoc(doc(anon, "schools/S1/students/stu_101"))));
await check("admin reads own school", assertSucceeds(getDoc(doc(as("a1"), "schools/S1/students/stu_101"))));
await check("admin cannot read other school", assertFails(getDoc(doc(as("a1"), "schools/S2/students/other"))));
await check("teacher cannot read other school", assertFails(getDoc(doc(as("t1"), "schools/S2/students/other"))));
await check("user without users doc denied", assertFails(getDoc(doc(as("ghost"), "schools/S1/students/stu_101"))));

console.log("admin");
await check("admin writes anything in school", assertSucceeds(setDoc(doc(as("a1"), "schools/S1/fee_invoices/f9"), { amount: 5 })));
await check("admin hard-deletes shared record", assertSucceeds(deleteDoc(doc(as("a1"), "schools/S1/ops_attendance/2026-10-26_cls_10A_1"))));

console.log("teacher: master data");
await check("teacher reads students", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/students/stu_101"))));
await check("teacher reads exm_cycles", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/exm_cycles/c1"))));
await check("teacher cannot write students", assertFails(updateDoc(doc(as("t1"), "schools/S1/students/stu_101"), { name: "B" })));
await check("teacher cannot write exm_cycles", assertFails(updateDoc(doc(as("t1"), "schools/S1/exm_cycles/c1"), { title: "B" })));
await check("teacher cannot read fee_*", assertFails(getDoc(doc(as("t1"), "schools/S1/fee_invoices/f1"))));
await check("teacher cannot write set_*", assertFails(setDoc(doc(as("t1"), "schools/S1/set_roles/r"), { a: 1 })));
await check("teacher cannot read adm_*", assertFails(getDoc(doc(as("t1"), "schools/S1/adm_form/f"))));

console.log("teacher: shared records");
await check("teacher creates own attendance", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/ops_attendance/2026-10-26_cls_10B_2"), { teacherId: "stf_025", marks: { stu_101: "A" }, total: 42 })));
await check("teacher cannot create attendance for another teacher", assertFails(setDoc(doc(as("t1"), "schools/S1/ops_attendance/z"), { teacherId: "stf_023", marks: {}, total: 1 })));
await check("teacher cannot edit another teacher's attendance", assertFails(updateDoc(doc(as("t2"), "schools/S1/ops_attendance/2026-10-26_cls_10B_1"), { total: 1 })));
await check("teacher edits own attendance", assertSucceeds(updateDoc(doc(as("t1"), "schools/S1/ops_attendance/2026-10-26_cls_10B_1"), { total: 41 })));
await check("teacher creates own homework", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/ops_homework/h1"), { teacherId: "stf_025", title: "t" })));
await check("teacher creates own live class", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/live_classes/lv2"), { teacherId: "stf_025", title: "t" })));
await check("teacher cannot edit another's live class", assertFails(updateDoc(doc(as("t2"), "schools/S1/live_classes/lv1"), { title: "hijack" })));
await check("teacher enters own marks", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/exm_marks/m1"), { teacherId: "stf_025", paperId: "p1", theory: 50 })));

console.log("teacher: leaves + substitutions");
await check("teacher creates own leave", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/staff_leaves/l3"), { staffId: "stf_025", status: "Pending" })));
await check("teacher cannot create leave for someone else", assertFails(setDoc(doc(as("t1"), "schools/S1/staff_leaves/l4"), { staffId: "stf_023", status: "Pending" })));
await check("teacher reads own leave", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/staff_leaves/l1"))));
await check("teacher cannot read another's leave", assertFails(getDoc(doc(as("t1"), "schools/S1/staff_leaves/l2"))));
await check("teacher cannot approve own leave", assertFails(updateDoc(doc(as("t1"), "schools/S1/staff_leaves/l1"), { status: "Approved" })));
await check("admin approves leave", assertSucceeds(updateDoc(doc(as("a1"), "schools/S1/staff_leaves/l1"), { status: "Approved" })));
await check("teacher mirrors leave into approvals (pending)", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/approvals/lv_l3"), { kind: "leave", status: "pending" })));
await check("teacher cannot write a pre-approved approvals row", assertFails(setDoc(doc(as("t1"), "schools/S1/approvals/x"), { kind: "leave", status: "approved" })));
await check("substitute accepts", assertSucceeds(updateDoc(doc(as("t1"), "schools/S1/ops_substitutions/sub_1"), { status: "Accepted" })));
await check("other teacher cannot accept", assertFails(updateDoc(doc(as("t2"), "schools/S1/ops_substitutions/sub_1"), { status: "Accepted" })));
await check("substitute cannot reassign", assertFails(updateDoc(doc(as("t1"), "schools/S1/ops_substitutions/sub_1"), { substituteTeacherId: "stf_023" })));

console.log("teacher: private data");
await check("teacher reads own private doc", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/tk_tasks/k1"))));
await check("teacher cannot read another's private doc", assertFails(getDoc(doc(as("t1"), "schools/S1/tk_tasks/k2"))));
await check("teacher writes own private doc", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/tk_tasks/k3"), { teacherId: "stf_025" })));
await check("teacher cannot write private doc as someone else", assertFails(setDoc(doc(as("t1"), "schools/S1/tk_tasks/k4"), { teacherId: "stf_023" })));

console.log("live class joins");
await check("parent records own join", assertSucceeds(setDoc(doc(as("p1"), "schools/S1/live_classes/lv1/joins/p1"), { joinedAt: "2026-10-26T09:00:00" })));
await check("parent cannot record someone else's join", assertFails(setDoc(doc(as("p1"), "schools/S1/live_classes/lv1/joins/t1"), { joinedAt: "x" })));
await check("teacher reads joins", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/live_classes/lv1/joins/p1"))));
await check("parent cannot read school data yet", assertFails(getDoc(doc(as("p1"), "schools/S1/students/stu_101"))));

console.log("section 12: check-in, regularization, duties, leave policy");
const day = (u, id, v) => setDoc(doc(as(u), `schools/S1/staff_attendance/${id}`), v);
await check("teacher punches in for own day", assertSucceeds(day("t1", "2026-10-26_stf_025", { staffId: "stf_025", teacherId: "stf_025", date: "2026-10-26", in: "08:05", out: null, status: "Present", source: "app" })));
await check("teacher punches out (update own day)", assertSucceeds(updateDoc(doc(as("t1"), "schools/S1/staff_attendance/2026-10-26_stf_025"), { out: "15:30" })));
await check("teacher reads own missing day by id", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/staff_attendance/2026-10-27_stf_025"))));
await check("teacher cannot write another teacher's day", assertFails(day("t1", "2026-10-26_stf_023", { staffId: "stf_023", teacherId: "stf_023", date: "2026-10-26", in: "08:00" })));
await check("teacher cannot write own day under a wrong id", assertFails(day("t1", "x_stf_025", { staffId: "stf_025", teacherId: "stf_025", date: "2026-10-26" })));
await check("teacher cannot read another teacher's day", assertFails(getDoc(doc(as("t1"), "schools/S1/staff_attendance/2026-10-25_stf_023"))));
await check("teacher creates pending regularization", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/staff_regularizations/r4"), { staffId: "stf_025", teacherId: "stf_025", status: "Pending", date: "2026-10-26" })));
await check("teacher cannot create approved regularization", assertFails(setDoc(doc(as("t1"), "schools/S1/staff_regularizations/r5"), { staffId: "stf_025", teacherId: "stf_025", status: "Approved" })));
await check("teacher edits own pending regularization", assertSucceeds(updateDoc(doc(as("t1"), "schools/S1/staff_regularizations/r1"), { time: "08:10" })));
await check("teacher cannot approve own regularization", assertFails(updateDoc(doc(as("t1"), "schools/S1/staff_regularizations/r1"), { status: "Approved" })));
await check("teacher cannot edit decided regularization", assertFails(updateDoc(doc(as("t1"), "schools/S1/staff_regularizations/r2"), { time: "08:10" })));
await check("teacher cannot read another's regularization", assertFails(getDoc(doc(as("t1"), "schools/S1/staff_regularizations/r3"))));
await check("teacher reads exm_duties", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/exm_duties/d1"))));
await check("teacher cannot write exm_duties", assertFails(updateDoc(doc(as("t1"), "schools/S1/exm_duties/d1"), { hall: "X" })));
await check("teacher reads leave policy", assertSucceeds(getDoc(doc(as("t1"), "schools/S1/set_leave_policy/policy"))));
await check("teacher cannot write leave policy", assertFails(updateDoc(doc(as("t1"), "schools/S1/set_leave_policy/policy"), { checkInBy: "10:00" })));
await check("teacher writes own ed_duty_state", assertSucceeds(setDoc(doc(as("t1"), "schools/S1/ed_duty_state/d1"), { teacherId: "stf_025", checklist: [] })));
await check("admin approves regularization", assertSucceeds(updateDoc(doc(as("a1"), "schools/S1/staff_regularizations/r1"), { status: "Approved" })));
await check("admin corrects a day", assertSucceeds(updateDoc(doc(as("a1"), "schools/S1/staff_attendance/2026-10-25_stf_023"), { in: "08:20", source: "admin" })));

await env.cleanup();
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
