// End-to-end check of the parent app functions (functions/parent.js, DATA_CONTRACT section 13) on the local emulators.
// Seeds a tiny school (2 students in 10-B, 1 parent linked to one of them, 1 class teacher), writes what the admin web,
// teacher app and parent app would write, and waits for the functions' projections, users arrays, counters and rows.
// Run from website/:  tools/emulator_exec.sh firestore,functions "node tools/parent_flow_test/test.mjs"
// (or `npm test` in this folder). Emulator only: refuses to run without FIRESTORE_EMULATOR_HOST.
import { createRequire } from "node:module";

if (!process.env.FIRESTORE_EMULATOR_HOST) { console.error("FIRESTORE_EMULATOR_HOST is not set: run through the emulators (see README)"); process.exit(2); }
const require = createRequire(new URL("../../functions/package.json", import.meta.url)); // reuse the functions' firebase-admin
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const projectId = process.env.GCLOUD_PROJECT || "demo-school-parent";
if (!projectId.startsWith("demo-")) { console.error(`refusing to run against ${projectId}: use a demo-* project id`); process.exit(2); }
initializeApp({ projectId });
const db = getFirestore();
const SID = "S1";
const S = db.collection("schools").doc(SID);
const now = () => new Date().toISOString();
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10); // India date, as the functions use
const month = today.slice(0, 7);

let failed = 0, total = 0;
/** polls until fn() returns truthy (or times out) */
async function waitFor(name, fn, ms = Number(process.env.WAIT_MS ?? 90000)) {
  total++;
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { last = await fn(); if (last) { console.log("  ok  ", name); return last; } } catch (e) { last = e; }
    await new Promise((r) => setTimeout(r, 400));
  }
  failed++; console.log("  FAIL", name, last instanceof Error ? `- ${last.message}` : "");
  return null;
}
/** waits a moment and checks a condition stays true (for "nothing happens" assertions) */
async function stays(name, fn, ms = 4000) {
  total++;
  await new Promise((r) => setTimeout(r, ms));
  if (await fn()) console.log("  ok  ", name); else { failed++; console.log("  FAIL", name); }
}
const get = async (p) => (await S.collection(p.split("/")[0]).doc(p.split("/")[1]).get()).data();
const parNotes = async (type) => (await S.collection("par_notifications").where("uid", "==", "par1").get()).docs.map((d) => d.data()).filter((n) => !type || n.type === type);
const hmNotes = async (type) => (await S.collection("hm_notifications").where("teacherId", "==", "stf_025").get()).docs.map((d) => d.data()).filter((n) => !type || n.type === type);
const audits = async (action) => (await S.collection("set_audit").get()).docs.map((d) => d.data()).filter((a) => a.action === action);
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---------------------------------------------------------------------------
console.log("seed");
await db.doc("users/par1").set({ schoolId: SID, role: "parent", email: "parent@example.test", name: "Mr. Rao", studentIds: [], classIds: [], grns: [] });
await db.doc("users/tch1").set({ schoolId: SID, role: "teacher", staffId: "stf_025", name: "Mrs. Anita Sharma" });
await S.collection("school").doc("school").set({ name: "Test School" });
await S.collection("staff").doc("stf_025").set({ name: "Mrs. Anita Sharma", email: "anita@example.test", authUid: "tch1" });
await S.collection("hm_settings").doc("settings_stf_025").set({ teacherId: "stf_025", parentMessages: true, classUpdates: true });
await S.collection("classes").doc("cls_10B").set({ grade: "10", section: "B", classTeacherId: "stf_025", room: "B-12" });
await S.collection("students").doc("stu_101").set({ name: "Aarav Rao", grn: "GIS-9201", grade: "10", section: "B", classId: "cls_10B", roll: 1, status: "Active", guardianUids: [] });
await S.collection("students").doc("stu_102").set({ name: "Diya Iyer", grn: "GIS-9202", grade: "10", section: "B", classId: "cls_10B", roll: 2, status: "Active", guardianUids: [] });

console.log("accounts and classes");
await waitFor("class gets classTeacher name", async () => (await get("classes/cls_10B"))?.classTeacher === "Mrs. Anita Sharma");
await waitFor("student creation is audited", async () => (await audits("Student record created")).length >= 2);
await S.collection("students").doc("stu_101").update({ guardianUids: ["par1"], updatedBy: "admin1" });
await waitFor("linking fills users/par1 arrays", async () => {
  const u = (await db.doc("users/par1").get()).data();
  return eq(u.studentIds, ["stu_101"]) && eq(u.classIds, ["cls_10B"]) && eq(u.grns, ["GIS-9201"]);
});
await waitFor("link is audited", async () => (await audits("Parent login linked")).some((a) => a.detail.includes("stu_101")));

console.log("attendance");
const att = (period, marks, extra = {}) => S.collection("ops_attendance").doc(`${today}_cls_10B_${period}`)
  .set({ date: today, classId: "cls_10B", grade: "10", section: "B", period, total: 2, marks, submitted: true, teacherId: "stf_025", updatedAt: now(), ...extra });
await att(1, { stu_101: "A" });
await waitFor("absent child's day is A", async () => (await get(`par_attendance/stu_101_${month}`))?.days?.[today] === "A");
await waitFor("classmate's day is P", async () => (await get(`par_attendance/stu_102_${month}`))?.days?.[today] === "P");
await waitFor("parent gets one absence alert", async () => (await parNotes("attendance")).length === 1);
await new Promise((r) => setTimeout(r, 50));
await att(2, {});
await waitFor("a newer record of the day wins (now P)", async () => (await get(`par_attendance/stu_101_${month}`))?.days?.[today] === "P");
await att(3, { stu_101: "A" });
await waitFor("newest record marks A again", async () => (await get(`par_attendance/stu_101_${month}`))?.days?.[today] === "A");
await stays("absence alert stays once per child per day", async () => (await parNotes("attendance")).length === 1);
await att(4, { stu_101: "L" }, { submitted: false });
await stays("a draft (submitted:false) record does not count", async () => (await get(`par_attendance/stu_101_${month}`))?.days?.[today] === "A", 3000);

console.log("homework");
await S.collection("ops_homework").doc("hw1").set({ classId: "cls_10B", title: "Algebra worksheet", subject: "Mathematics", description: "Ex 4.2", due: "2026-11-02",
  maxMarks: 10, status: "open", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", createdAt: now(), submissions: {} });
await waitFor("homework copied for both students", async () => (await get("par_homework/stu_101_hw1"))?.submission?.status === "pending" && !!(await get("par_homework/stu_102_hw1")));
await waitFor("parent notified of new homework", async () => (await parNotes("homework")).some((n) => n.title === "New homework: Algebra worksheet" && n.route === "/academics/homework/hw1"));
await S.collection("ops_homework").doc("hw1").update({ "submissions.stu_101": { status: "graded", marks: 8, feedback: "Good", gradedAt: now() } });
await waitFor("graded submission reaches the child's copy", async () => (await get("par_homework/stu_101_hw1"))?.submission?.marks === 8);
await waitFor("parent notified of review", async () => (await parNotes("homework")).some((n) => n.title === "Algebra worksheet reviewed"));
await waitFor("classmate's copy has no marks", async () => (await get("par_homework/stu_102_hw1"))?.submission?.status === "pending");
await S.collection("ops_homework").doc("hw1").delete();
await waitFor("deleting homework removes the copies", async () => (await S.collection("par_homework").where("homeworkId", "==", "hw1").get()).empty);

console.log("results");
await S.collection("exm_cycles").doc("cyc1").set({ title: "Term 2 Mid-Term", status: "Live" });
await S.collection("exm_papers").doc("pap1").set({ cycleId: "cyc1", grade: "10", subject: "Mathematics", code: "M10", date: "2026-10-20", theory: 80, internal: 20, published: [], classIds: ["cls_10B"] });
await S.collection("exm_marks").doc("pap1__cand_stu_101").set({ paperId: "pap1", candId: "cand_stu_101", theory: 70, internal: 18, medical: false, verified: true });
await S.collection("exm_marks").doc("pap1__cand_stu_102").set({ paperId: "pap1", candId: "cand_stu_102", studentId: "stu_102", theory: 50, internal: 15, medical: false, verified: true });
await stays("no results before publishing", async () => !(await get("par_results/stu_101_pap1")), 3000);
await S.collection("exm_papers").doc("pap1").update({ published: ["10-B"] });
await waitFor("publishing 10-B writes the child's result", async () => {
  const r = await get("par_results/stu_101_pap1");
  return r?.obtained === 88 && r.max === 100 && r.exam === "Term 2 Mid-Term" && r.theoryMax === 80;
});
await waitFor("parent notified of results", async () => (await parNotes("results")).length === 1);
await S.collection("exm_marks").doc("pap1__cand_stu_101").update({ theory: 72 });
await waitFor("a mark change after publishing updates the result", async () => (await get("par_results/stu_101_pap1"))?.obtained === 90);
await S.collection("exm_papers").doc("pap1").update({ published: [] });
await waitFor("unpublishing hides the results again", async () => !(await get("par_results/stu_101_pap1")));

console.log("notices and calendar");
await S.collection("com_notices").doc("n1").set({ title: "Diwali break", body: "Closed 29 Oct to 3 Nov", audience: "All School", status: "Published", acked: 0, read: 0 });
await S.collection("com_notices").doc("n2").set({ title: "Staff meeting", body: "3:30 PM", audience: "Staff & Teachers", status: "Published", acked: 0, read: 0 });
await waitFor("All School notice becomes parentVisible", async () => (await get("com_notices/n1"))?.parentVisible === true);
await waitFor("staff notice is not parentVisible", async () => (await get("com_notices/n2"))?.parentVisible === false);
await waitFor("parent notified of the notice", async () => (await parNotes("notice")).length === 1);
await S.collection("com_notices").doc("n1").collection("acks").doc("par1").set({ at: now(), studentIds: ["stu_101"] });
await waitFor("ack increments acked and read", async () => { const n = await get("com_notices/n1"); return n?.acked === 1 && n.read === 1; });
await stays("no repeat notice push (no trigger loop)", async () => (await parNotes("notice")).length === 1 && (await get("com_notices/n1"))?.acked === 1);
await S.collection("calendar_events").doc("ev1").set({ title: "Sports day", start: "2026-11-14", status: "published", notifyApp: false });
await S.collection("calendar_events").doc("ev2").set({ title: "Draft", start: "2026-11-20", status: "draft" });
await waitFor("published event becomes parentVisible", async () => (await get("calendar_events/ev1"))?.parentVisible === true);
await waitFor("draft event is not parentVisible", async () => (await get("calendar_events/ev2"))?.parentVisible === false);

console.log("leave requests");
// the parent app's leave shape
await S.collection("student_leaves").doc("sl1").set({ studentId: "stu_101", classId: "cls_10B", name: "Aarav Rao", roll: 1, from: "2026-11-03", to: "2026-11-04", days: 2, daysLabel: "2 days",
  dateText: "3-4 Nov", reason: "Family function", type: "Personal", cat: "personal", by: "Mr. Rao", status: "Pending", parentUid: "par1", appliedOn: today, createdAt: now(), updatedAt: now(), updatedBy: "par1" });
await waitFor("class teacher gets the leave request", async () => (await hmNotes("leave")).some((n) => n.title.includes("Aarav Rao") && n.route === "/leave-management/students"));
await S.collection("student_leaves").doc("sl1").update({ status: "Approved", decisionNote: "OK", decidedBy: "stf_025", decidedAt: now(), updatedAt: now(), updatedBy: "tch1" });
await waitFor("parent told the leave was approved", async () => (await parNotes("leave")).some((n) => n.title === "Leave approved"));

console.log("messages");
await S.collection("msg_threads").doc("thr_stu_101_stf_025").set({ studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Rao", parentUids: ["par1"], guardian: "Mr. Rao",
  teacherId: "stf_025", teacher: "Mrs. Anita Sharma", role: "Class teacher", lastMessage: "", lastAt: now(), lastFrom: "parent", unreadParent: 0, unreadTeacher: 0, createdAt: now() });
const msg = (id, from, text) => S.collection("msg_messages").doc(id).set({ threadId: "thr_stu_101_stf_025", studentId: "stu_101", teacherId: "stf_025", parentUids: ["par1"],
  from, uid: from === "parent" ? "par1" : "tch1", name: from === "parent" ? "Mr. Rao" : "Mrs. Anita Sharma", text, at: now() });
await msg("m1", "parent", "Is there a test on Monday?");
await waitFor("parent message updates the thread", async () => { const t = await get("msg_threads/thr_stu_101_stf_025"); return t?.unreadTeacher === 1 && t.lastFrom === "parent" && t.lastMessage.startsWith("Is there"); });
await waitFor("teacher gets a message notification", async () => (await hmNotes("message")).length === 1);
await msg("m2", "teacher", "Yes, chapter 4.");
await waitFor("teacher reply bumps unreadParent", async () => { const t = await get("msg_threads/thr_stu_101_stf_025"); return t?.unreadParent === 1 && t.unreadTeacher === 1 && t.lastFrom === "teacher"; });
await waitFor("parent gets the reply notification", async () => (await parNotes("message")).some((n) => n.route === "/messages/thread/thr_stu_101_stf_025"));
await stays("each message is counted once", async () => { const t = await get("msg_threads/thr_stu_101_stf_025"); return t.unreadParent === 1 && t.unreadTeacher === 1; });

console.log("live classes, fees, consent");
await S.collection("live_classes").doc("lv1").set({ title: "Revision: Quadratics", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025", date: "2026-11-01", time: "17:00", mins: 45, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "scheduled", createdAt: now() });
await waitFor("parents of the class told about the live class", async () => (await parNotes("live")).length === 1);
await waitFor("admin bell still gets the live class", async () => !(await S.collection("notifications").where("href", "==", "/live-classes").get()).empty);
await S.collection("fee_invoices").doc("inv1").set({ no: "INV-2026-0001", student: "Aarav Rao", grn: "GIS-9201", amount: 26000, balance: 26000, due: "2026-11-30", status: "Pending" });
await S.collection("fee_invoices").doc("inv2").set({ no: "INV-2026-0002", student: "Diya Iyer", grn: "GIS-9202", amount: 26000, balance: 26000, due: "2026-11-30", status: "Pending" });
await S.collection("fee_payments").doc("pay1").set({ receiptNo: "RCP-1", invoiceId: "inv1", grn: "GIS-9201", amount: 26000, mode: "UPI QR", date: today });
await waitFor("parent gets invoice + receipt (not the classmate's invoice)", async () => (await parNotes("fees")).length === 2);
await S.collection("consents").doc("par1").set({ uid: "par1", studentIds: ["stu_101"], version: 1, acceptedAt: now(), items: { dataProcessing: true, photos: false, notifications: true } });
await waitFor("consent is audited", async () => (await audits("Consent recorded")).some((a) => a.detail.includes("photos no")));

console.log("rename and unlink");
await S.collection("staff").doc("stf_025").update({ name: "Mrs. Anita Sharma-Rao" });
await waitFor("staff rename reaches classes.classTeacher", async () => (await get("classes/cls_10B"))?.classTeacher === "Mrs. Anita Sharma-Rao");
await S.collection("students").doc("stu_102").update({ guardianUids: ["par1"] });
await waitFor("sibling link adds the second child", async () => eq((await db.doc("users/par1").get()).data().studentIds, ["stu_101", "stu_102"]));
await S.collection("students").doc("stu_101").update({ guardianUids: [] });
await waitFor("unlink removes the child", async () => { const u = (await db.doc("users/par1").get()).data(); return eq(u.studentIds, ["stu_102"]) && eq(u.grns, ["GIS-9202"]); });
await waitFor("unlink is audited", async () => (await audits("Parent login unlinked")).length === 1);
await S.collection("students").doc("stu_102").delete();
await waitFor("deleting the student empties the arrays", async () => eq((await db.doc("users/par1").get()).data().studentIds, []));
await waitFor("student deletion is audited", async () => (await audits("Student record deleted")).length === 1);

console.log(failed ? `\n${failed} of ${total} FAILED` : `\nall ${total} passed`);
process.exit(failed ? 1 : 0);
