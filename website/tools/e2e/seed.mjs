// Seeds a small school into the LOCAL emulators for the end-to-end check of admin web, teacher app and parent app.
// Accounts (emulator only) are written to tools/e2e/.accounts.json (git-ignored).
//   FIRESTORE_EMULATOR_HOST=localhost:8080 FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 node tools/e2e/seed.mjs
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST ??= "localhost:9099";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getAuth } = require("firebase-admin/auth");
const projectId = process.env.GCLOUD_PROJECT || "demo-school-e2e";
if (!projectId.startsWith("demo-")) throw new Error("emulator only (demo-* project id)");
initializeApp({ projectId });
const db = getFirestore(), auth = getAuth();
const SID = "e2e_school";
const S = db.collection("schools").doc(SID);
const iso = (d) => d.toISOString().slice(0, 10);
const ist = new Date(Date.now() + 5.5 * 3600e3);
const today = iso(ist);
const day = (n) => iso(new Date(ist.getTime() + n * 864e5));
const now = () => new Date().toISOString();

const pw = () => randomBytes(9).toString("base64url") + "a1";
const accounts = {
  admin: { email: "admin@e2e.test", password: pw() },
  teacher: { email: "anita@e2e.test", password: pw() },
  parent: { email: "parent@e2e.test", password: pw() },
};
for (const a of Object.values(accounts)) {
  const existing = await auth.getUserByEmail(a.email).catch(() => null);
  if (existing) await auth.deleteUser(existing.uid);
  a.uid = (await auth.createUser({ email: a.email, password: a.password })).uid;
}
writeFileSync(new URL("./.accounts.json", import.meta.url), JSON.stringify({ projectId, schoolId: SID, ...accounts }, null, 2));

await db.doc(`users/${accounts.admin.uid}`).set({ schoolId: SID, role: "admin", email: accounts.admin.email, name: "E2E Principal", createdAt: now() });
await db.doc(`users/${accounts.teacher.uid}`).set({ schoolId: SID, role: "teacher", staffId: "stf_025", email: accounts.teacher.email, name: "Mrs. Anita Sharma", createdAt: now() });
// the admin web writes the parent user like this (arrays start empty; onStudentWritten fills them)
await db.doc(`users/${accounts.parent.uid}`).set({ schoolId: SID, role: "parent", email: accounts.parent.email, name: "Mr. Rahul Sharma", studentIds: [], classIds: [], grns: [], createdAt: now() });

const b = db.batch();
const put = (col, id, data) => b.set(S.collection(col).doc(id), { ...data, updatedAt: now() });
put("school", "school", { name: "Greenfield International School (E2E)", short: "GIS", board: "CBSE", affiliation: "1930281", city: "New Delhi", academicYear: "2026-27", term: "Term 2" });
put("staff", "stf_025", { name: "Mrs. Anita Sharma", empId: "EMP-1025", department: "Mathematics", role: "PGT", status: "Active", email: accounts.teacher.email, authUid: accounts.teacher.uid, subjects: ["Mathematics", "Science"] });
put("staff", "stf_010", { name: "Dr. Isha Joshi", empId: "EMP-1010", department: "English", role: "TGT", status: "Active", email: "isha@e2e.test" });
put("classes", "cls_10B", { grade: "10", section: "B", classTeacherId: "stf_025", room: "204", wing: "North" });
put("classes", "cls_8A", { grade: "8", section: "A", classTeacherId: "stf_010", room: "108", wing: "South" });
put("assignments", "asg_1", { classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025" });
put("assignments", "asg_2", { classId: "cls_10B", subject: "English", teacherId: "stf_010" });
put("assignments", "asg_3", { classId: "cls_8A", subject: "English", teacherId: "stf_010" });
const kids = [
  ["stu_101", "Aarav Sharma", "10", "B", 1, "GIS-9200"], ["stu_102", "Ananya Reddy", "10", "B", 2, "GIS-9201"], ["stu_103", "Kabir Das", "10", "B", 3, "GIS-9202"],
  ["stu_201", "Meera Sharma", "8", "A", 1, "GIS-8100"], ["stu_202", "Rohan Gupta", "8", "A", 2, "GIS-8101"],
];
for (const [id, name, grade, section, roll, grn] of kids) {
  put("students", id, { name, grade, section, classId: `cls_${grade}${section}`, roll, grn, status: "Active", attendance: 95,
    guardian: id === "stu_101" || id === "stu_201" ? "Mr. Rahul Sharma" : "Guardian", relation: "Father", phone: "+91 98100 00001", guardianUids: [] });
}
// timetable for 10-B and 8-A, Mon..Sat P1..P6
const subj10 = ["Mathematics", "English", "Science", "Social Science", "Hindi", "Physical Education"];
const t10 = { Mathematics: ["Mrs. Anita Sharma", "stf_025"], English: ["Dr. Isha Joshi", "stf_010"] };
for (const [ci, cls] of [["cls_10B", "10B"], ["cls_8A", "8A"]])
  ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((d, di) => [1, 2, 3, 4, 5, 6].forEach((p) => {
    const subject = subj10[(di + p) % subj10.length];
    const [teacher, teacherId] = t10[subject] ?? ["Mr. Om Patel", "stf_008"];
    put("ops_periods", `per_${cls}_${d}_${p}`, { classId: ci, grade: cls.slice(0, -1), section: cls.slice(-1), day: d, period: p, subject, teacher, teacherId, room: ci === "cls_10B" ? "204" : "108" });
  }));
put("com_notices", "ntc_1", { title: "Diwali break: school closed 29 Oct – 3 Nov", category: "Holidays", audience: "All School", status: "Published", body: "School reopens on 4 November.", author: "Principal", sentAt: now(), pinned: false, urgent: false, recipients: 120, delivered: 118, acked: 0, read: 0, channels: ["App"] });
put("com_notices", "ntc_2", { title: "Urgent: revised timings due to fog", category: "Campus Safety", audience: "All Parents", status: "Published", body: "Classes start at 9:00 AM this week. Please acknowledge.", author: "Principal", sentAt: now(), urgent: true, pinned: true, recipients: 120, delivered: 118, acked: 0, read: 0, channels: ["App"] });
put("com_notices", "ntc_3", { title: "Staff meeting", category: "Staff", audience: "Staff & Teachers", status: "Published", body: "Staff only.", author: "Principal", sentAt: now(), recipients: 20, delivered: 20, acked: 0, read: 0, channels: ["App"] });
put("calendar_events", "ev_1", { title: "Annual Sports Day", start: day(10), end: day(10), status: "published", type: "Event", notifyApp: false });
put("fee_invoices", "inv_1", { no: "INV-1001", student: "Aarav Sharma", grade: "10", section: "B", grn: "GIS-9200", guardian: "Mr. Rahul Sharma", phone: "", term: "Term 2", issued: day(-20), due: day(5), amount: 42000, paid: 12000, balance: 30000, status: "Partial", lines: [{ label: "Tuition", amount: 36000 }, { label: "Lab", amount: 6000 }] });
put("fee_invoices", "inv_2", { no: "INV-1002", student: "Ananya Reddy", grade: "10", section: "B", grn: "GIS-9201", term: "Term 2", issued: day(-20), due: day(5), amount: 42000, paid: 0, balance: 42000, status: "Pending", lines: [] });
put("exm_cycles", "cyc_1", { title: "Term 1 Mid-Term 2026", short: "MT1", term: "Term 1", status: "Completed", theoryMax: 80, internalMax: 20 });
put("set_leave_policy", "policy", { checkInBy: "08:15", types: [] });
await b.commit();
console.log(JSON.stringify({ seeded: true, schoolId: SID, today }));
