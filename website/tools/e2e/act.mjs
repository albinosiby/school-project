// Plays the admin web / teacher app side of the end-to-end check against the LOCAL emulators, one step at a time.
//   node tools/e2e/act.mjs <step>   steps: link attendance homework grade publish reply decide live invoice payment notice show
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

process.env.FIRESTORE_EMULATOR_HOST ??= "localhost:8080";
process.env.METADATA_SERVER_DETECTION ??= "none";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
if (!acc.projectId.startsWith("demo-")) throw new Error("emulator only");
initializeApp({ projectId: acc.projectId });
const db = getFirestore();
const S = db.collection("schools").doc(acc.schoolId);
const now = () => new Date().toISOString();
const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const T = { teacherId: "stf_025", updatedAt: now(), updatedBy: acc.teacher.uid };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const step = process.argv[2];

const steps = {
  // admin web > Students > Parent login (siblings share the login)
  async link() {
    for (const id of ["stu_101", "stu_201"]) await S.collection("students").doc(id).update({ guardianUids: FieldValue.arrayUnion(acc.parent.uid), guardianEmail: acc.parent.email, updatedAt: now() });
    for (let i = 0; i < 240; i++) { const u = (await db.doc(`users/${acc.parent.uid}`).get()).data(); if (u.studentIds?.length === 2) return u; await wait(1000); }
    throw new Error("users arrays not filled");
  },
  // teacher app: 10-B period 1, Aarav absent, Ananya late; plus three earlier days
  async attendance() {
    const day = (n) => new Date(Date.now() + 5.5 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
    for (const [d, marks] of [[day(3), {}], [day(2), { stu_101: "L" }], [day(1), {}], [today, { stu_101: "A", stu_102: "L" }]])
      await S.collection("ops_attendance").doc(`${d}_cls_10B_1`).set({ date: d, classId: "cls_10B", grade: "10", section: "B", period: 1, total: 3, marks, submitted: true, ...T });
    await wait(15000);
    return (await S.collection("par_attendance").doc(`stu_101_${today.slice(0, 7)}`).get()).data();
  },
  async homework() {
    await S.collection("ops_homework").doc("hw_e2e_1").set({ classId: "cls_10B", grade: "10", section: "B", title: "Quadratic equations: Ex 4.3", subject: "Mathematics", due: today, maxMarks: 20,
      description: "Solve questions 1 to 10 in your notebook.", status: "open", createdAt: now(), assigned: today, teacher: "Mrs. Anita Sharma",
      submissions: { stu_101: { status: "pending" }, stu_102: { status: "pending" }, stu_103: { status: "pending" } }, submitted: 0, total: 3, ...T });
    await wait(15000);
    return (await S.collection("par_homework").doc("stu_101_hw_e2e_1").get()).data();
  },
  async grade() {
    await S.collection("ops_homework").doc("hw_e2e_1").update({ "submissions.stu_101": { status: "graded", marks: 18, feedback: "Neat and correct, well done", gradedAt: now() }, submitted: 1, updatedAt: now() });
    await wait(15000);
    return (await S.collection("par_homework").doc("stu_101_hw_e2e_1").get()).data()?.submission;
  },
  // admin exam cell: paper + marks, then publish 10-B
  async publish() {
    await S.collection("exm_papers").doc("pap_math_10").set({ cycleId: "cyc_1", grade: "10", subject: "Mathematics", code: "MATH-10", date: "2026-09-22", start: "09:00", duration: 3, theory: 80, internal: 20, venue: "Hall A", status: "Completed", published: [], classIds: ["cls_10B"] });
    for (const [s, th, int] of [["stu_101", 71, 18], ["stu_102", 64, 17], ["stu_103", 55, 15]])
      await S.collection("exm_marks").doc(`m_${s}`).set({ paperId: "pap_math_10", candId: `cand_${s}`, studentId: s, theory: th, internal: int, medical: false, verified: true });
    await S.collection("exm_papers").doc("pap_math_10").update({ published: ["10-B"] });
    await wait(20000);
    return (await S.collection("par_results").doc("stu_101_pap_math_10").get()).data();
  },
  // teacher app replies in the parent's thread (or starts one)
  async reply() {
    const id = "thr_stu_101_stf_025";
    const t = await S.collection("msg_threads").doc(id).get();
    if (!t.exists) await t.ref.set({ studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: [acc.parent.uid], guardian: "Mr. Rahul Sharma", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", role: "Class Teacher", lastMessage: "", lastAt: now(), lastFrom: "teacher", unreadParent: 0, unreadTeacher: 0 });
    await S.collection("msg_messages").add({ threadId: id, studentId: "stu_101", teacherId: "stf_025", parentUids: (t.data()?.parentUids ?? [acc.parent.uid]), from: "teacher", uid: acc.teacher.uid, name: "Mrs. Anita Sharma", text: "Yes, please send a scientific calculator tomorrow.", at: now() });
    await wait(15000);
    return (await t.ref.get()).data();
  },
  // class teacher decides the newest pending leave of Aarav
  async decide() {
    const q = await S.collection("student_leaves").where("studentId", "==", "stu_101").where("status", "==", "Pending").get();
    if (q.empty) throw new Error("no pending leave from the parent yet");
    await q.docs[0].ref.update({ status: "Approved", decisionNote: "Approved. Get well soon.", decidedBy: "stf_025", decidedAt: now(), updatedAt: now(), updatedBy: acc.teacher.uid });
    return { decided: q.docs[0].id, request: q.docs[0].data() };
  },
  async live() {
    const t = new Date(Date.now() + 5.5 * 3600e3 + 5 * 60e3);
    const hh = String(t.getUTCHours()).padStart(2, "0"), mm = String(t.getUTCMinutes()).padStart(2, "0");
    await S.collection("live_classes").doc("lc_e2e_1").set({ title: "Doubt clearing: quadratics", classId: "cls_10B", subject: "Mathematics", teacher: "Mrs. Anita Sharma", date: today, time: `${hh}:${mm}`, mins: 40, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "scheduled", createdAt: now(), ...T });
    return { at: `${today} ${hh}:${mm}` };
  },
  async payment() {
    await S.collection("fee_payments").add({ receiptNo: "R-2001", invoiceId: "inv_1", invoiceNo: "INV-1001", student: "Aarav Sharma", grade: "10", grn: "GIS-9200", amount: 10000, mode: "UPI", date: today, by: "Front Office" });
    await S.collection("fee_invoices").doc("inv_1").update({ paid: 22000, balance: 20000, updatedAt: now() });
    return { paid: 22000 };
  },
  async notice() {
    await S.collection("com_notices").doc("ntc_4").set({ title: "PTM on Saturday", category: "Academic", audience: "All Parents", status: "Published", body: "Parent-teacher meeting on Saturday 10 AM to 1 PM.", author: "Principal", sentAt: now(), urgent: false, recipients: 120, delivered: 118, acked: 0, read: 0, channels: ["App"] });
    await wait(15000);
    return (await S.collection("com_notices").doc("ntc_4").get()).data()?.parentVisible;
  },
  // what the admin sees: acks, threads, leave, notifications
  async show() {
    const col = async (c, f = (x) => x) => (await S.collection(c).get()).docs.map((d) => f({ id: d.id, ...d.data() }));
    return {
      user: (await db.doc(`users/${acc.parent.uid}`).get()).data(),
      notices: await col("com_notices", (n) => ({ id: n.id, parentVisible: n.parentVisible, acked: n.acked })),
      threads: await col("msg_threads", (t) => ({ id: t.id, last: t.lastMessage, from: t.lastFrom, unreadParent: t.unreadParent, unreadTeacher: t.unreadTeacher })),
      messages: await col("msg_messages", (m) => ({ from: m.from, text: m.text })),
      leaves: await col("student_leaves", (l) => ({ id: l.id, status: l.status, by: l.by, dateText: l.dateText })),
      parNotifications: await col("par_notifications", (n) => ({ type: n.type, title: n.title })),
      teacherNotifications: (await col("hm_notifications", (n) => ({ type: n.type, title: n.title }))).slice(-5),
      consents: await col("consents"),
      audit: (await col("set_audit", (a) => a.action)).slice(-6),
    };
  },
};
if (!steps[step]) { console.log("steps:", Object.keys(steps).join(" ")); process.exit(1); }
console.log(JSON.stringify(await steps[step](), null, 1));
