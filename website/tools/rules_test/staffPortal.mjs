// Staff portal rules (docs/STAFF_PORTAL_CONTRACT.md §4): the `isStaffMember` block for non-teaching staff accounts
// (users/{uid}.role "staff" with a staffId). The documents written here are exactly what school-dash's
// src/features/portal/{leave,notices} views write (logic.ts leaveDoc / checkInDoc / regularizationDoc, people/leaves.ts mirrorRow).
//   RULES_TEST_PORT=8080 EMULATOR_PROJECT=demo-staff-portal node staffPortal.mjs   (against a running Firestore emulator)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where, setLogLevel } from "firebase/firestore";

setLogLevel("silent");
const port = Number(process.env.RULES_TEST_PORT || 8873);
const env = await initializeTestEnvironment({ projectId: process.env.EMULATOR_PROJECT || "demo-staff-portal", firestore: { host: "127.0.0.1", port, rules: readFileSync(new URL("../../firestore.rules", import.meta.url), "utf8") } });
await env.clearFirestore();
let checks = 0;
const check = async (title, promise) => { await promise; checks++; console.log(`ok ${title}`); };
const path = (db, col, id) => doc(db, `schools/S1/${col}/${id}`);
const list = (db, col, ...filters) => getDocs(filters.length ? query(collection(db, `schools/S1/${col}`), ...filters) : collection(db, `schools/S1/${col}`));
const date = "2026-11-23", at = "2026-11-23T03:30:00.000Z";
const stamp = (staffId, uid) => ({ teacherId: staffId, updatedAt: at, updatedBy: uid });

// what LeaveView writes for "Apply for leave" (portal/leave/logic.ts leaveDoc) and its approvals mirror (people/leaves.ts mirrorRow)
const leaveDoc = (id, staffId, uid) => ({
  id, staffId, from: "2026-11-24", to: "2026-11-25", start: "2026-11-24", end: "2026-11-25", type: "Casual Leave", days: 2, coverage: "Full Day",
  reason: "Cousin's wedding out of town", handovers: [], note: "Ledger keys are with the office", status: "Pending", createdAt: at, ...stamp(staffId, uid),
});
const mirror = (leaveId) => ({
  id: `lv_${leaveId}`, requester: "Ravi Menon", ref: `LV-${leaveId.slice(-6).toUpperCase()}`, kind: "leave", dept: "Accounts", title: "Casual Leave", detail: "2 days · 2026-11-24 to 2026-11-25",
  remark: "Cousin's wedding out of town", submitted: at.slice(0, 19), urgency: "Standard", tone: "neutral", status: "pending", source: "staff_leaves", sourceId: leaveId, updatedAt: at, updatedBy: "s1",
});
// CheckInCard (portal/leave/logic.ts checkInDoc / checkOutPatch)
const checkIn = (staffId, uid) => ({ id: `${date}_${staffId}`, staffId, date, in: "09:00", out: null, status: "Late", note: "", source: "web", ...stamp(staffId, uid) });
// Request correction (regularizationDoc)
const regularization = (id, staffId, uid) => ({ id, staffId, date: "2026-11-21", type: "Check-out", time: "16:10", reason: "Forgot to punch out", note: "", status: "Pending", at, ...stamp(staffId, uid) });

try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    const seed = {
      "users/s1": { schoolId: "S1", role: "staff", staffId: "staff_1", staffRole: "accountant", name: "Ravi Menon" },
      "users/s2": { schoolId: "S1", role: "staff", staffId: "staff_2", staffRole: "librarian", name: "Meera Nair" },
      "users/s0": { schoolId: "S1", role: "staff" }, // a staff login without a staff record: not a staff member
      "users/t1": { schoolId: "S1", role: "teacher", staffId: "teacher_1" },
      "schools/S1/school/school": { name: "Synthetic School", academicYear: "2026-27" },
      "schools/S1/staff/staff_1": { name: "Ravi Menon", department: "Accounts", designation: "Accountant" },
      "schools/S1/staff/staff_2": { name: "Meera Nair", department: "Library", designation: "Librarian" },
      "schools/S1/classes/cls_10B": { grade: "10", section: "B" },
      "schools/S1/students/student_1": { name: "Synthetic student", classId: "cls_10B", status: "Active" },
      "schools/S1/set_leave_policy/policy": { types: [{ id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 }], checkInBy: "08:15" },
      "schools/S1/com_notices/published": { title: "Staff meeting", audience: "All Staff", status: "Published", sentAt: at, body: "3 pm" },
      "schools/S1/com_notices/draft": { title: "Draft", audience: "All Staff", status: "Draft", sentAt: at, body: "" },
      "schools/S1/staff_leaves/mine": { staffId: "staff_1", status: "Pending", from: date, to: date, reason: "Own pending leave", createdAt: at },
      "schools/S1/staff_leaves/decided": { staffId: "staff_1", status: "Approved", from: "2026-10-05", to: "2026-10-05", reason: "Decided", decidedBy: "admin" },
      "schools/S1/staff_leaves/theirs": { staffId: "staff_2", status: "Pending", from: date, to: date, reason: "Another member's leave" },
      "schools/S1/staff_attendance/2026-11-20_staff_1": { staffId: "staff_1", date: "2026-11-20", in: "08:05", out: "15:30", status: "Present", source: "app" },
      "schools/S1/staff_attendance/2026-11-20_staff_2": { staffId: "staff_2", date: "2026-11-20", in: "08:05", out: null, status: "Present", source: "app" },
      "schools/S1/staff_regularizations/theirs": { staffId: "staff_2", date: "2026-11-20", type: "Check-out", time: "16:00", reason: "x", status: "Pending" },
      "schools/S1/approvals/lv_theirs": { kind: "leave", status: "pending", source: "staff_leaves", sourceId: "theirs" },
      "schools/S1/att_circulars/other_notice": { teacherId: "staff_2", read: true },
      "schools/S1/ops_periods/per_10B_Mon_1": { classId: "cls_10B", day: "Mon", period: 1, teacherId: "teacher_1", subject: "Maths" },
    };
    for (const [name, data] of Object.entries(seed)) await setDoc(doc(db, name), data);
  });
  const staff = env.authenticatedContext("s1").firestore();
  const other = env.authenticatedContext("s2").firestore();
  const noRecord = env.authenticatedContext("s0").firestore();

  // ---- reads ----
  await check("staff reads the school", assertSucceeds(getDoc(path(staff, "school", "school"))));
  await check("staff reads the staff directory", assertSucceeds(getDoc(path(staff, "staff", "staff_2"))));
  await check("staff lists the staff directory (useStaffProfile)", assertSucceeds(list(staff, "staff")));
  await check("staff reads classes and the leave policy", assertSucceeds(Promise.all([getDoc(path(staff, "classes", "cls_10B")), list(staff, "set_leave_policy")])));
  await check("staff reads a published notice", assertSucceeds(getDoc(path(staff, "com_notices", "published"))));
  await check("staff cannot read a draft notice", assertFails(getDoc(path(staff, "com_notices", "draft"))));
  await check("notices query filtered on status == Published passes (portal/notices)", assertSucceeds(list(staff, "com_notices", where("status", "==", "Published"))));
  await check("unfiltered notices query is denied", assertFails(list(staff, "com_notices")));
  await check("staff reads their own leave", assertSucceeds(getDoc(path(staff, "staff_leaves", "mine"))));
  await check("own leave query filtered on staffId passes (portal/leave)", assertSucceeds(list(staff, "staff_leaves", where("staffId", "==", "staff_1"))));
  await check("staff cannot read another member's leave", assertFails(getDoc(path(staff, "staff_leaves", "theirs"))));
  await check("unfiltered staff_leaves query is denied", assertFails(list(staff, "staff_leaves")));
  await check("own check-in days and regularizations by staffId filter", assertSucceeds(Promise.all([
    list(staff, "staff_attendance", where("staffId", "==", "staff_1")), list(staff, "staff_regularizations", where("staffId", "==", "staff_1"))])));
  await check("today's own check-in doc is readable before it exists", assertSucceeds(getDoc(path(staff, "staff_attendance", `${date}_staff_1`))));
  await check("another member's check-in day is denied", assertFails(getDoc(path(staff, "staff_attendance", "2026-11-20_staff_2"))));
  await check("staff cannot read students", assertFails(getDoc(path(staff, "students", "student_1"))));
  await check("staff cannot list students", assertFails(list(staff, "students")));
  await check("staff cannot read the timetable", assertFails(getDoc(path(staff, "ops_periods", "per_10B_Mon_1"))));
  await check("staff cannot list substitutions", assertFails(list(staff, "ops_substitutions")));
  await check("staff cannot read the approvals queue", assertFails(getDoc(path(staff, "approvals", "lv_theirs"))));
  await check("staff cannot read set_config (useSchoolClock stays admin-only)", assertFails(list(staff, "set_config")));
  await check("own notice read state by teacherId filter; another's state denied", assertSucceeds(list(staff, "att_circulars", where("teacherId", "==", "staff_1"))));
  await check("another member's att_circulars doc is denied", assertFails(getDoc(path(staff, "att_circulars", "other_notice"))));
  await check("a staff login without a staffId reads nothing", assertFails(getDoc(path(noRecord, "school", "school"))));
  await check("staff cannot read another school", assertFails(getDoc(doc(staff, "schools/S2/school/school"))));

  // ---- leave: apply, mirror, withdraw ----
  await check("staff creates their own leave exactly as the portal writes it", assertSucceeds(setDoc(path(staff, "staff_leaves", "lr_new1"), leaveDoc("lr_new1", "staff_1", "s1"))));
  await check("a leave carrying the store's _o ordering key (useCollection.create) is accepted", assertSucceeds(setDoc(path(staff, "staff_leaves", "lr_o"), { ...leaveDoc("lr_o", "staff_1", "s1"), _o: 1 })));
  await check("a leave with an unknown key is denied by validStaffLeave", assertFails(setDoc(path(staff, "staff_leaves", "lr_x"), { ...leaveDoc("lr_x", "staff_1", "s1"), extra: 1 })));
  await check("a leave for another staffId is denied", assertFails(setDoc(path(staff, "staff_leaves", "lr_forged"), leaveDoc("lr_forged", "staff_2", "s1"))));
  await check("a self-approved leave is denied", assertFails(setDoc(path(staff, "staff_leaves", "lr_approved"), { ...leaveDoc("lr_approved", "staff_1", "s1"), status: "Approved" })));
  await check("an empty reason is denied", assertFails(setDoc(path(staff, "staff_leaves", "lr_noreason"), { ...leaveDoc("lr_noreason", "staff_1", "s1"), reason: "" })));
  await check("staff creates the approvals mirror row (kind leave, status pending)", assertSucceeds(setDoc(path(staff, "approvals", "lv_lr_new1"), mirror("lr_new1"))));
  await check("a pre-approved mirror row is denied", assertFails(setDoc(path(staff, "approvals", "lv_lr_x"), { ...mirror("lr_x"), status: "approved" })));
  await check("a mirror row of another kind is denied", assertFails(setDoc(path(staff, "approvals", "fee_x"), { ...mirror("lr_x"), kind: "fee" })));
  await check("staff cannot decide an approvals row", assertFails(updateDoc(path(staff, "approvals", "lv_theirs"), { status: "approved" })));
  await check("staff edits their pending leave (stays Pending)", assertSucceeds(updateDoc(path(staff, "staff_leaves", "mine"), { reason: "Own pending leave, edited", updatedAt: at, updatedBy: "s1" })));
  await check("staff cannot forge a decision on their leave", assertFails(updateDoc(path(staff, "staff_leaves", "mine"), { status: "Approved" })));
  await check("staff cannot edit a decided leave", assertFails(updateDoc(path(staff, "staff_leaves", "decided"), { reason: "changed" })));
  await check("staff withdraws (deletes) their pending leave", assertSucceeds(deleteDoc(path(staff, "staff_leaves", "lr_new1"))));
  await check("staff cannot delete a decided leave", assertFails(deleteDoc(path(staff, "staff_leaves", "decided"))));
  await check("staff cannot delete another member's leave", assertFails(deleteDoc(path(staff, "staff_leaves", "theirs"))));
  // the teacher app keeps a private lm_withdrawn copy of a withdrawn request; non-teaching staff keep the same copy
  await check("non-teaching staff keep a private lm_withdrawn copy of a withdrawn request", assertSucceeds(setDoc(path(staff, "lm_withdrawn", "lr_new1"), { ...leaveDoc("lr_new1", "staff_1", "s1"), status: "Cancelled", withdrawnAt: at })));
  await check("a private lm_withdrawn copy for another member is denied", assertFails(setDoc(path(staff, "lm_withdrawn", "lr_x2"), { ...leaveDoc("lr_x2", "staff_2", "s2"), teacherId: "staff_2", status: "Cancelled", withdrawnAt: at })));

  // ---- check-in day ----
  await check("staff creates today's own check-in day (source web)", assertSucceeds(setDoc(path(staff, "staff_attendance", `${date}_staff_1`), checkIn("staff_1", "s1"))));
  await check("a check-in day under another id is denied", assertFails(setDoc(path(staff, "staff_attendance", "sl_today"), checkIn("staff_1", "s1"))));
  await check("a check-in day for another member is denied", assertFails(setDoc(path(staff, "staff_attendance", `${date}_staff_2`), checkIn("staff_2", "s1"))));
  await check("staff checks out of their own day", assertSucceeds(updateDoc(path(staff, "staff_attendance", `${date}_staff_1`), { out: "16:05", ...stamp("staff_1", "s1") })));
  await check("staff cannot touch another member's day", assertFails(updateDoc(path(staff, "staff_attendance", "2026-11-20_staff_2"), { out: "16:05" })));

  // ---- regularization ----
  await check("staff creates a pending regularization", assertSucceeds(setDoc(path(staff, "staff_regularizations", "rg_new1"), regularization("rg_new1", "staff_1", "s1"))));
  await check("a pre-approved regularization is denied", assertFails(setDoc(path(staff, "staff_regularizations", "rg_approved"), { ...regularization("rg_approved", "staff_1", "s1"), status: "Approved" })));
  await check("a regularization for another member is denied", assertFails(setDoc(path(staff, "staff_regularizations", "rg_forged"), regularization("rg_forged", "staff_2", "s1"))));
  await check("staff cannot decide their own regularization", assertFails(updateDoc(path(staff, "staff_regularizations", "rg_new1"), { status: "Approved" })));
  await check("staff withdraws their pending regularization", assertSucceeds(deleteDoc(path(staff, "staff_regularizations", "rg_new1"))));
  await check("staff cannot delete another member's regularization", assertFails(deleteDoc(path(staff, "staff_regularizations", "theirs"))));

  // ---- notice read state (att_circulars) ----
  await check("staff records their own notice read state", assertSucceeds(setDoc(path(staff, "att_circulars", "published"), { id: "published", read: true, ...stamp("staff_1", "s1") }, { merge: true })));
  await check("a read state carrying another teacherId is denied", assertFails(setDoc(path(staff, "att_circulars", "forged"), { read: true, ...stamp("staff_2", "s1") })));
  await check("staff acknowledges their own notice state", assertSucceeds(setDoc(path(staff, "att_circulars", "published"), { ack: true, ackAt: at, ...stamp("staff_1", "s1") }, { merge: true })));

  // ---- never ----
  await check("staff cannot update students", assertFails(updateDoc(path(staff, "students", "student_1"), { name: "Changed" })));
  await check("staff cannot create students", assertFails(setDoc(path(staff, "students", "student_new"), { name: "Forged" })));
  await check("staff cannot create staff records", assertFails(setDoc(path(staff, "staff", "staff_new"), { name: "Forged" })));
  await check("staff cannot rename the school", assertFails(updateDoc(path(staff, "school", "school"), { name: "Renamed" })));
  await check("staff cannot publish notices", assertFails(setDoc(path(staff, "com_notices", "forged"), { status: "Published" })));
  await check("staff cannot write the timetable", assertFails(setDoc(path(staff, "ops_periods", "per_forged"), { teacherId: "staff_1" })));
  await check("another staff member sees only their own records", assertSucceeds(Promise.all([
    assertFails(getDoc(path(other, "staff_leaves", "mine"))), assertFails(getDoc(path(other, "staff_attendance", `${date}_staff_1`))), getDoc(path(other, "staff_leaves", "theirs"))])));

  assert.ok(checks >= 60);
  console.log(`${checks} staff portal authorization checks passed`);
} finally { await env.cleanup(); }
