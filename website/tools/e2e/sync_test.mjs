// Cross-app synchronisation check (admin web <-> teacher app <-> parent app <-> driver app) against the LOCAL emulators.
//
// Every step writes the way the owning app writes (same collection, id scheme and fields), signed in as that app's user, and
// then reads as the receiving app's user, so the Firestore rules are exercised on both sides. Function side effects (par_*
// projections, users arrays, unread counters, in-app notification rows for parents, teachers and the admin bell) are polled.
//
// Needs: emulators running (tools/e2e/start_emulators.sh, auth+firestore+functions) and a fresh seed (node tools/e2e/seed.mjs).
//   node tools/e2e/sync_test.mjs            all flows
//   node tools/e2e/sync_test.mjs transport  only flows whose name contains "transport"
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(new URL("../rules_test/package.json", import.meta.url));
const { initializeApp } = require("firebase/app");
const { getAuth, connectAuthEmulator, signInWithEmailAndPassword } = require("firebase/auth");
const {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where,
  writeBatch, runTransaction, arrayUnion, deleteField, setLogLevel,
} = require("firebase/firestore");

setLogLevel("silent");
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
if (!acc.projectId.startsWith("demo-")) throw new Error("emulator only (demo-* project id)");
const SID = acc.schoolId;
const HOST = process.env.EMULATOR_HOST ?? "127.0.0.1";
const only = process.argv[2] ?? "";

const now = () => new Date().toISOString();
const ist = () => new Date(Date.now() + 5.5 * 3600e3);
const today = ist().toISOString().slice(0, 10);
const month = today.slice(0, 7);
const hhmm = () => ist().toISOString().slice(11, 16);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- one signed-in client per app user ----------
async function client(role) {
  const app = initializeApp({ projectId: acc.projectId, apiKey: "demo-key", appId: `e2e-${role}` }, role);
  const auth = getAuth(app);
  connectAuthEmulator(auth, `http://${HOST}:9099`, { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, HOST, 8080);
  const cred = await signInWithEmailAndPassword(auth, acc[role].email, acc[role].password);
  return { role, db, uid: cred.user.uid, d: (path) => doc(db, `schools/${SID}/${path}`), c: (name) => collection(db, `schools/${SID}/${name}`) };
}

// ---------- tiny harness ----------
let total = 0, failed = 0;
const failures = [];
async function check(name, fn) {
  total++;
  try { await fn(); console.log("  ok  ", name); }
  catch (e) { failed++; failures.push(name); console.log("  FAIL", name, "-", String(e?.message ?? e).split("\n")[0]); }
}
function expect(v, msg) { if (!v) throw new Error(msg ?? "expectation failed"); }
/** polls fn() until it returns a truthy value (functions run asynchronously), else throws with the last value */
const WAIT_MS = Number(process.env.E2E_WAIT_MS ?? 150000); // functions run serially in the emulator and slow down under load
async function until(fn, what, ms = WAIT_MS) {
  let last;
  for (const t0 = Date.now(); Date.now() - t0 < ms; await wait(700)) {
    try { last = await fn(); if (last) return last; } catch (e) { last = e?.message ?? e; }
  }
  throw new Error(`timed out waiting for ${what} (last: ${JSON.stringify(last)?.slice(0, 160)})`);
}
const data = async (ref) => (await getDoc(ref)).data();
const rows = async (q) => (await getDocs(q)).docs.map((d) => ({ id: d.id, ...d.data() }));
const flows = [];
const flow = (name, fn) => flows.push({ name, fn });

const A = await client("admin"), T = await client("teacher"), P = await client("parent"), D = await client("driver"), N = await client("attendant");
const stamp = (u) => ({ updatedAt: now(), updatedBy: u.uid });
const T_ = { teacherId: "stf_025" };
const parentRows = (prefix) => rows(query(P.c("par_notifications"), where("uid", "==", P.uid))).then((r) => r.filter((x) => x.id.startsWith(prefix)));
const teacherRows = () => rows(query(T.c("hm_notifications"), where("teacherId", "==", "stf_025")));
const bellRows = () => rows(A.c("notifications"));

// ======================= flows =======================

flow("accounts: admin links the parent login, the function fills users arrays", async () => {
  await check("admin links parent to Aarav (10-B) and Meera (8-A)", async () => {
    for (const id of ["stu_101", "stu_201"]) await updateDoc(A.d(`students/${id}`), { guardianUids: arrayUnion(P.uid), guardianEmail: acc.parent.email, ...stamp(A) });
  });
  await check("parent users doc lists both children and classes", async () => {
    const u = await until(async () => { const x = await data(doc(P.db, `users/${P.uid}`)); return x?.studentIds?.length === 2 && x; }, "users.studentIds", 60000).catch(async (e) => {
      const st = await Promise.all(["stu_101", "stu_201"].map(async (id) => (await data(A.d(`students/${id}`)))?.guardianUids));
      throw new Error(`${e.message}; parent uid ${P.uid}; guardianUids ${JSON.stringify(st)}; users ${JSON.stringify(await data(doc(P.db, `users/${P.uid}`)))}`);
    });
    expect(u.classIds.includes("cls_10B") && u.classIds.includes("cls_8A"), `classIds ${u.classIds}`);
  });
  await check("parent reads own child, not a classmate", async () => {
    expect((await data(P.d("students/stu_101")))?.name, "own child");
    await getDoc(P.d("students/stu_102")).then(() => { throw new Error("classmate readable"); }, () => {});
  });
});

flow("notices: admin publishes, parent / teacher / driver see it", async () => {
  await setDoc(A.d("com_notices/ntc_sync_all"), { title: "Sync: sports day on Friday", category: "Events", audience: "All School", status: "Published", body: "Wear house colours.", author: "Principal", sentAt: now(), urgent: false, pinned: false, recipients: 10, delivered: 10, acked: 0, read: 0, channels: ["App"], ...stamp(A) });
  await setDoc(A.d("com_notices/ntc_sync_staff"), { title: "Sync: staff meeting at 3 PM", category: "Staff", audience: "Staff & Teachers", status: "Published", body: "Staff room.", author: "Principal", sentAt: now(), recipients: 5, delivered: 5, acked: 0, read: 0, channels: ["App"], ...stamp(A) });
  await check("function marks the all-school notice parent-visible", () => until(async () => (await rows(query(P.c("com_notices"), where("parentVisible", "==", true)))).some((n) => n.id === "ntc_sync_all"), "parentVisible"));
  await check("staff-only notice stays hidden from parents", async () => {
    await wait(1500);
    expect(!(await rows(query(P.c("com_notices"), where("parentVisible", "==", true)))).some((n) => n.id === "ntc_sync_staff"), "staff notice visible");
  });
  await check("parent gets an in-app notification for the notice", () => until(async () => (await parentRows("ntc_ntc_sync_all")).length, "par_notifications ntc_"));
  await check("teacher gets the staff notice in hm_notifications", () => until(async () => (await teacherRows()).some((n) => /staff meeting/i.test(n.title ?? "")), "hm_notifications staff notice"));
  await check("teacher reads the published notice", async () => expect((await data(T.d("com_notices/ntc_sync_all")))?.title));
  await check("driver reads the published notice", async () => expect((await data(D.d("com_notices/ntc_sync_all")))?.title));
  await check("parent acknowledges; the function counts it", async () => {
    await setDoc(P.d(`com_notices/ntc_sync_all/acks/${P.uid}`), { at: now(), studentIds: ["stu_101"] });
    await until(async () => (await data(A.d("com_notices/ntc_sync_all")))?.acked >= 1, "acked count");
  });
});

flow("attendance: teacher marks absent, parent sees the day and an alert, admin sees the record", async () => {
  await setDoc(T.d(`ops_attendance/${today}_cls_10B_1`), { date: today, classId: "cls_10B", grade: "10", section: "B", period: 1, total: 3, marks: { stu_101: "A" }, submitted: true, ...T_, ...stamp(T) });
  await check("parent month projection shows A today", () => until(async () => (await data(P.d(`par_attendance/stu_101_${month}`)))?.days?.[today] === "A", "par_attendance A"));
  await check("parent gets the absence alert", () => until(async () => (await parentRows(`att_${today}_stu_101`)).length, "absence alert"));
  await check("admin reads the teacher's record", async () => expect((await data(A.d(`ops_attendance/${today}_cls_10B_1`)))?.marks?.stu_101 === "A"));
  await check("teacher corrects to present; parent day becomes P", async () => {
    await updateDoc(T.d(`ops_attendance/${today}_cls_10B_1`), { marks: {}, ...stamp(T) });
    await until(async () => (await data(P.d(`par_attendance/stu_101_${month}`)))?.days?.[today] === "P", "par_attendance P");
  });
  await check("teacher cannot write another teacher's attendance", async () => {
    await setDoc(T.d(`ops_attendance/${today}_cls_8A_1`), { date: today, classId: "cls_8A", period: 1, total: 2, marks: {}, submitted: true, teacherId: "stf_010" }).then(() => { throw new Error("allowed"); }, () => {});
  });
});

flow("homework: teacher sets and grades, parent sees both", async () => {
  await setDoc(T.d("ops_homework/hw_sync_1"), { classId: "cls_10B", grade: "10", section: "B", title: "Sync: Ex 5.1", subject: "Mathematics", due: today, maxMarks: 10, description: "Q1-5", status: "open", createdAt: now(), assigned: today, teacher: "Mrs. Anita Sharma", submissions: { stu_101: { status: "pending" }, stu_102: { status: "pending" }, stu_103: { status: "pending" } }, submitted: 0, total: 3, ...T_, ...stamp(T) });
  await check("parent homework copy appears", () => until(async () => (await data(P.d("par_homework/stu_101_hw_sync_1")))?.title === "Sync: Ex 5.1", "par_homework"));
  await check("parent new-homework alert", () => until(async () => (await parentRows("hw_hw_sync_1_stu_101")).length, "hw alert"));
  await updateDoc(T.d("ops_homework/hw_sync_1"), { "submissions.stu_101": { status: "graded", marks: 9, feedback: "Good", gradedAt: now() }, submitted: 1, ...stamp(T) });
  await check("parent sees the grade and feedback", () => until(async () => { const s = (await data(P.d("par_homework/stu_101_hw_sync_1")))?.submission; return s?.status === "graded" && s.marks === 9; }, "graded"));
  await check("parent graded alert", () => until(async () => (await parentRows("hwg_hw_sync_1_stu_101")).length, "hwg alert"));
  await check("parent cannot read class-wide ops_homework", async () => getDoc(P.d("ops_homework/hw_sync_1")).then(() => { throw new Error("readable"); }, () => {}));
});

flow("student leave: parent applies, class teacher decides, parent notified", async () => {
  await setDoc(P.d("student_leaves/sl_sync_1"), { studentId: "stu_101", classId: "cls_10B", from: today, to: today, reason: "Fever", status: "Pending", parentUid: P.uid, name: "Aarav Sharma", roll: 1, days: 1, daysLabel: "1 Day", dateText: today, type: "Medical Leave", cat: "medical", by: "Mr. Rahul Sharma (Father)", appliedOn: today, ...stamp(P) });
  await check("teacher sees the request", async () => expect((await data(T.d("student_leaves/sl_sync_1")))?.status === "Pending"));
  await check("teacher gets a push row for the new request", () => until(async () => (await teacherRows()).some((n) => /leave/i.test(`${n.title} ${n.body}`) && /Aarav/.test(`${n.title} ${n.body}`)), "teacher leave row"));
  await updateDoc(T.d("student_leaves/sl_sync_1"), { status: "Approved", decisionNote: "Get well soon", decidedBy: "stf_025", decidedAt: now(), ...stamp(T) });
  await check("parent reads Approved with the note", async () => { const l = await data(P.d("student_leaves/sl_sync_1")); expect(l.status === "Approved" && l.decisionNote === "Get well soon"); });
  await check("parent gets the decision alert", () => until(async () => (await parentRows("lv_sl_sync_1_Approved")).length, "leave decided alert"));
  await check("parent cannot approve their own leave", async () => {
    await setDoc(P.d("student_leaves/sl_sync_2"), { studentId: "stu_101", classId: "cls_10B", from: today, to: today, reason: "Trip", status: "Pending", parentUid: P.uid, name: "Aarav Sharma" });
    await updateDoc(P.d("student_leaves/sl_sync_2"), { status: "Approved" }).then(() => { throw new Error("allowed"); }, () => {});
  });
});

flow("messages: parent writes, teacher replies, unread counters move", async () => {
  const thr = "thr_stu_101_stf_025";
  const b = writeBatch(P.db);
  b.set(P.d(`msg_threads/${thr}`), { studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", parentUids: [P.uid], guardian: "Mr. Rahul Sharma", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", role: "Class Teacher", lastMessage: "", lastAt: now(), lastFrom: "parent", unreadParent: 0, unreadTeacher: 0 });
  b.set(P.d("msg_messages/msg_sync_p1"), { threadId: thr, studentId: "stu_101", teacherId: "stf_025", parentUids: [P.uid], from: "parent", uid: P.uid, name: "Mr. Rahul Sharma", text: "Is the test on Monday?", at: now() });
  await check("parent opens a thread with a first message", () => b.commit());
  await check("teacher thread shows the message and unreadTeacher 1", () => until(async () => { const t = await data(T.d(`msg_threads/${thr}`)); return t?.unreadTeacher === 1 && t.lastMessage === "Is the test on Monday?"; }, "unreadTeacher"));
  await check("teacher gets a push row for the message", () => until(async () => (await teacherRows()).some((n) => /Monday/.test(n.body ?? "")), "teacher message row"));
  await updateDoc(T.d(`msg_threads/${thr}`), { unreadTeacher: 0, ...stamp(T) });
  await setDoc(T.d("msg_messages/msg_sync_t1"), { threadId: thr, studentId: "stu_101", teacherId: "stf_025", parentUids: [P.uid], from: "teacher", uid: T.uid, name: "Mrs. Anita Sharma", text: "Yes, chapters 4 and 5.", at: now() });
  await check("parent thread shows the reply and unreadParent 1", () => until(async () => { const t = await data(P.d(`msg_threads/${thr}`)); return t?.unreadParent === 1 && t.lastFrom === "teacher"; }, "unreadParent"));
  await check("parent gets the message alert", () => until(async () => (await parentRows("msg_msg_sync_t1")).length, "message alert"));
  await check("parent reads messages with the thread filter", async () => expect((await rows(query(P.c("msg_messages"), where("parentUids", "array-contains", P.uid), where("threadId", "==", thr)))).length === 2));
  await check("admin sees the thread (message oversight)", async () => expect((await data(A.d(`msg_threads/${thr}`)))?.lastFrom === "teacher"));
});

flow("results: admin publishes 10-B, parent gets the result", async () => {
  await setDoc(A.d("exm_papers/pap_sync_math"), { cycleId: "cyc_1", grade: "10", subject: "Mathematics", code: "MATH-10S", date: "2026-10-20", start: "09:00", duration: 3, theory: 80, internal: 20, venue: "Hall A", status: "Completed", published: [], classIds: ["cls_10B"], locked: false, ...stamp(A) });
  await check("teacher enters marks while the paper is open", () => setDoc(T.d("exm_marks/m_sync_stu_101"), { paperId: "pap_sync_math", candId: "cand_stu_101", studentId: "stu_101", theory: 66, status: "entered", ...T_, ...stamp(T) }));
  await updateDoc(A.d("exm_marks/m_sync_stu_101"), { internal: 18, verified: true, ...stamp(A) });
  await updateDoc(A.d("exm_papers/pap_sync_math"), { locked: true, ...stamp(A) });
  await check("teacher cannot change marks after the admin locks the paper", () => updateDoc(T.d("exm_marks/m_sync_stu_101"), { theory: 80, ...T_ }).then(() => { throw new Error("allowed"); }, () => {}));
  await updateDoc(A.d("exm_papers/pap_sync_math"), { published: ["10-B"], ...stamp(A) });
  await check("parent reads the published result", () => until(async () => { const r = await data(P.d("par_results/stu_101_pap_sync_math")); return r?.theory === 66 && r.internal === 18; }, "par_results"));
  await check("parent results alert", () => until(async () => (await parentRows("res_pap_sync_math_stu_101")).length, "results alert"));
});

flow("fees: invoice, parent reports a transfer, admin verifies", async () => {
  const grn = (await data(A.d("students/stu_101"))).grn;
  await setDoc(A.d("fee_invoices/inv_sync_1"), { no: "INV-SYNC-1", student: "Aarav Sharma", grade: "10", section: "B", grn, guardian: "Mr. Rahul Sharma", term: "Term 2", issued: today, due: today, amount: 5000, paid: 0, balance: 5000, status: "Pending", lines: [{ label: "Transport", amount: 5000 }], ...stamp(A) });
  await check("parent reads the invoice by GRN", async () => expect((await rows(query(P.c("fee_invoices"), where("grn", "==", grn)))).some((i) => i.id === "inv_sync_1")));
  await check("parent invoice alert", () => until(async () => (await parentRows("inv_inv_sync_1")).length, "invoice alert"));
  await check("parent reports a UPI payment", () => setDoc(P.d("fee_claims/clm_sync_1"), { studentId: "stu_101", grn, studentName: "Aarav Sharma", classId: "cls_10B", invoiceId: "inv_sync_1", invoiceNo: "INV-SYNC-1", amount: 5000, mode: "UPI", reference: "UTR998877", paidOn: today, note: "", status: "Pending", parentUid: P.uid, parentName: "Mr. Rahul Sharma", submittedAt: now() }));
  await check("parent cannot mark their own claim verified", () => updateDoc(P.d("fee_claims/clm_sync_1"), { status: "Verified" }).then(() => { throw new Error("allowed"); }, () => {}));
  const b = writeBatch(A.db);
  b.set(A.d("fee_payments/pay_sync_1"), { receipt: "RCPT-SYNC-1", invoiceId: "inv_sync_1", invoiceNo: "INV-SYNC-1", student: "Aarav Sharma", grn, amount: 5000, mode: "UPI · UTR998877", date: today, by: "Admin", ...stamp(A) });
  b.update(A.d("fee_invoices/inv_sync_1"), { paid: 5000, balance: 0, status: "Paid", ...stamp(A) });
  b.update(A.d("fee_claims/clm_sync_1"), { status: "Verified", receiptNo: "RCPT-SYNC-1", paymentId: "pay_sync_1", verifiedBy: A.uid, verifiedAt: now() });
  await check("admin verifies (receipt + invoice + claim in one batch)", () => b.commit());
  await check("parent sees Paid invoice and Verified claim", async () => { expect((await data(P.d("fee_invoices/inv_sync_1"))).status === "Paid"); expect((await data(P.d("fee_claims/clm_sync_1"))).status === "Verified"); });
  await check("parent payment receipt alert", () => until(async () => (await parentRows("pay_pay_sync_1")).length, "payment alert"));
});

flow("meetings: admin slot, parent books, teacher sees it", async () => {
  const start = new Date(Date.now() + 3 * 864e5); start.setUTCHours(5, 0, 0, 0);
  const slotId = `pts_stf_025_${start.toISOString().slice(0, 16).replace(/[-T:]/g, "")}`;
  await setDoc(A.d(`ptm_slots/${slotId}`), { teacherId: "stf_025", teacher: "Mrs. Anita Sharma", start: start.toISOString(), startMs: start.getTime(), mins: 15, modes: ["In-Person", "Virtual"], room: "204", link: "", booked: false, ...stamp(A) });
  await check("parent books the slot", () => setDoc(P.d(`ptm_bookings/${slotId}`), { slotId, teacherId: "stf_025", teacher: "Mrs. Anita Sharma", studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", parentUid: P.uid, parentName: "Mr. Rahul Sharma", mode: "In-Person", agenda: "Maths progress", start: start.toISOString(), startMs: start.getTime(), mins: 15, room: "204", link: "", status: "Scheduled", bookedAt: now() }));
  await check("the slot becomes booked", () => until(async () => (await data(P.d(`ptm_slots/${slotId}`)))?.booked === true, "slot booked"));
  await check("teacher reads the booking", async () => expect((await data(T.d(`ptm_bookings/${slotId}`)))?.agenda === "Maths progress"));
  await check("teacher gets a push row for the booking", () => until(async () => (await teacherRows()).some((n) => /Aarav|meeting|booked/i.test(`${n.title} ${n.body}`) && /meet|PTM|book/i.test(`${n.title} ${n.body}`)), "teacher booking row"));
  await updateDoc(A.d(`ptm_bookings/${slotId}`), { status: "Attended", minutes: "Practise word problems.", ...stamp(A) });
  await check("parent sees the shared minutes", async () => expect((await data(P.d(`ptm_bookings/${slotId}`)))?.minutes === "Practise word problems."));
});

flow("certificates: parent requests, office issues", async () => {
  await setDoc(P.d("certificates/cert_sync_1"), { studentId: "stu_101", classId: "cls_10B", studentName: "Aarav Sharma", grn: "x", type: "bonafide", title: "Bonafide certificate", category: "bonafide", purpose: "Passport", status: "Requested", requestedBy: "Mr. Rahul Sharma", requestedAt: now(), parentUid: P.uid });
  await check("admin sees the request", async () => expect((await data(A.d("certificates/cert_sync_1")))?.status === "Requested"));
  await updateDoc(A.d("certificates/cert_sync_1"), { status: "Issued", refNo: "CERT/2026/0099", issuedOn: today, issuer: "Principal", ...stamp(A) });
  await check("parent reads Issued with the reference", async () => expect((await data(P.d("certificates/cert_sync_1")))?.refNo === "CERT/2026/0099"));
  await check("parent issued alert", () => until(async () => (await parentRows("cert_cert_sync_1_Issued")).length, "certificate alert"));
});

flow("staff leave: teacher applies, admin bell, admin decides, teacher notified", async () => {
  const b = writeBatch(T.db);
  b.set(T.d("staff_leaves/slv_sync_1"), { staffId: "stf_025", type: "Casual Leave", from: today, to: today, days: 1, reason: "Family", status: "Pending", ...stamp(T) });
  b.set(T.d("approvals/lv_slv_sync_1"), { kind: "leave", source: "staff_leaves", sourceId: "slv_sync_1", status: "pending", title: "Casual Leave", by: "Mrs. Anita Sharma", at: now() });
  await check("teacher applies (leave + approvals mirror)", () => b.commit());
  await check("admin bell shows the request", () => until(async () => (await bellRows()).some((n) => /leave/i.test(`${n.title} ${n.body}`) && /Anita/.test(`${n.title} ${n.body}`)), "bell leave"));
  await updateDoc(A.d("staff_leaves/slv_sync_1"), { status: "Approved", decidedBy: A.uid, decidedAt: now(), ...stamp(A) });
  await updateDoc(A.d("approvals/lv_slv_sync_1"), { status: "approved" });
  await check("teacher gets the decision row", () => until(async () => (await teacherRows()).some((n) => /approved/i.test(`${n.title} ${n.body}`) && /leave/i.test(`${n.title} ${n.body}`)), "teacher leave decided"));
  await check("teacher cannot approve own leave", async () => {
    await setDoc(T.d("staff_leaves/slv_sync_2"), { staffId: "stf_025", type: "Casual Leave", from: today, to: today, days: 1, reason: "x", status: "Pending" });
    await updateDoc(T.d("staff_leaves/slv_sync_2"), { status: "Approved" }).then(() => { throw new Error("allowed"); }, () => {});
  });
});

flow("substitution: admin assigns, teacher notified and accepts", async () => {
  await setDoc(A.d(`ops_substitutions/sub_${today}_cls_8A_3`), { date: today, day: "Mon", period: 3, classId: "cls_8A", subject: "English", absentTeacherId: "stf_010", substituteTeacherId: "stf_025", status: "Assigned", ...stamp(A) });
  await check("teacher gets the substitution row", () => until(async () => (await teacherRows()).some((n) => /substitut/i.test(`${n.title} ${n.body}`)), "teacher substitution"));
  await check("teacher accepts", () => updateDoc(T.d(`ops_substitutions/sub_${today}_cls_8A_3`), { status: "Accepted", ...stamp(T) }));
  await check("admin reads Accepted", async () => expect((await data(A.d(`ops_substitutions/sub_${today}_cls_8A_3`)))?.status === "Accepted"));
});

flow("live class: teacher schedules, parent sees and is told, admin bell", async () => {
  await setDoc(T.d("live_classes/lv_sync_1"), { title: "Sync: revision", classId: "cls_10B", subject: "Mathematics", date: today, time: "17:00", mins: 40, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "scheduled", createdAt: now(), ...T_, ...stamp(T) });
  await check("parent reads the class for the child's class", async () => expect((await rows(query(P.c("live_classes"), where("classId", "==", "cls_10B")))).some((l) => l.id === "lv_sync_1")));
  await check("parent live-class alert", () => until(async () => (await parentRows("live_lv_sync_1_stu_101")).length, "live alert"));
  await check("admin bell shows the new live class", () => until(async () => (await bellRows()).some((n) => /revision|live/i.test(`${n.title} ${n.body}`)), "bell live"));
  await check("parent records the join tap", () => setDoc(P.d(`live_classes/lv_sync_1/joins/${P.uid}`), { joinedAt: now() }));
  await check("teacher sees the join", async () => expect((await data(T.d(`live_classes/lv_sync_1/joins/${P.uid}`)))?.joinedAt));
});

flow("calendar and consent: admin event reaches parents, parent consent reaches admin + audit", async () => {
  await setDoc(A.d("calendar_events/ev_sync_1"), { title: "Sync: PTM day", start: today, end: today, status: "published", type: "Event", notifyApp: false, ...stamp(A) });
  await check("parent sees the published event", () => until(async () => (await rows(query(P.c("calendar_events"), where("parentVisible", "==", true)))).some((e) => e.id === "ev_sync_1"), "calendar parentVisible"));
  await setDoc(P.d(`consents/${P.uid}`), { uid: P.uid, studentIds: ["stu_101", "stu_201"], version: "2026-10", acceptedAt: now(), items: { dataProcessing: true, photos: false, notifications: true } });
  await check("admin reads the consent", async () => expect((await data(A.d(`consents/${P.uid}`)))?.items?.photos === false));
  await check("audit row written for the consent", () => until(async () => (await rows(A.c("set_audit"))).some((r) => /consent/i.test(`${r.action} ${r.detail}`)), "set_audit consent"));
});

flow("teacher check-in and regularization reach the admin", async () => {
  await check("teacher punches in", () => setDoc(T.d(`staff_attendance/${today}_stf_025`), { staffId: "stf_025", teacherId: "stf_025", date: today, in: hhmm(), out: null, status: "Present", note: "", source: "app", ...stamp(T) }));
  await check("admin reads the check-in", async () => expect((await data(A.d(`staff_attendance/${today}_stf_025`)))?.in));
  await setDoc(T.d("staff_regularizations/reg_sync_1"), { staffId: "stf_025", teacherId: "stf_025", date: today, type: "Missed punch out", time: "16:30", reason: "Forgot", note: "", status: "Pending", at: now(), ...stamp(T) });
  await check("admin bell shows the regularization", () => until(async () => (await bellRows()).some((n) => /regulari/i.test(`${n.title} ${n.body}`)), "bell regularization"));
  await updateDoc(A.d("staff_regularizations/reg_sync_1"), { status: "Approved", decidedBy: A.uid, decidedAt: now(), ...stamp(A) });
  await check("teacher gets the regularization decision row", () => until(async () => (await teacherRows()).some((n) => /regulari|attendance/i.test(`${n.title} ${n.body}`) && /approv/i.test(`${n.title} ${n.body}`)), "teacher regularization"));
});

flow("exam duty: admin allots, teacher notified", async () => {
  await setDoc(A.d("exm_duties/dut_sync_1"), { paperId: "pap_sync_math", cycleId: "cyc_1", staffId: "stf_025", role: "Invigilator", hall: "Hall B", venue: "Block 2", date: today, start: "09:00", end: "12:00", grade: "10", subject: "Mathematics", code: "MATH-10S", classIds: ["cls_10B"], candidates: 30, status: "upcoming", reportBy: "08:30", createdAt: now(), ...stamp(A) });
  await check("teacher reads the duty", async () => expect((await data(T.d("exm_duties/dut_sync_1")))?.hall === "Hall B"));
  await check("teacher gets the duty row", () => until(async () => (await teacherRows()).some((n) => /duty|invigilat/i.test(`${n.title} ${n.body}`)), "teacher duty"));
});

flow("transport: admin bus data reaches parent and driver; driver/attendant actions reach parent and admin", async () => {
  const tripIdP = `${today}_bus_01_pickup`, tripIdD = `${today}_bus_01_drop`;
  await check("parent sees the child's bus (projection from the seed)", () => until(async () => { const t = await data(P.d("par_transport/stu_101")); return t?.bus === "Bus 14" && t.driver?.name === "Ramesh Kumar" && t.attendant?.name === "Suresh Yadav" && t.stops?.length === 3 && t.stop; }, "par_transport stu_101"));
  await check("driver roster lists the bus's students with guardian phones", async () => {
    const r = await rows(query(D.c("students"), where("busId", "==", "bus_01")));
    expect(r.length === 5 && r.every((s) => s.phone && s.busStop), `roster ${r.length}`);
  });
  await check("driver cannot read par_transport; parent cannot read tr_attendance", async () => {
    await getDoc(D.d("par_transport/stu_101")).then(() => { throw new Error("driver read par_transport"); }, () => {});
    await getDocs(P.c("tr_attendance")).then(() => { throw new Error("parent read tr_attendance"); }, () => {});
  });

  // driver app: first crew member of the day creates both scheduled trips (FirebaseTripRepository._ensureDay)
  const bus = await data(D.d("tr_buses/bus_01"));
  const base = { busId: "bus_01", bus: "Bus 14", routeName: bus.routeName, date: today, status: "scheduled", driverId: "crw_001", driver: "Ramesh Kumar", attendantId: "crw_002", attendant: "Suresh Yadav", total: 5, boarded: 0, dropped: 0, absent: 0, checklist: { brakes: false, lights: false, tyres: false, fuel: false, firstAid: false, cleanliness: false }, note: "" };
  const b = writeBatch(D.db);
  b.set(D.d(`tr_trips/${tripIdP}`), { ...base, id: tripIdP, kind: "pickup", ...stamp(D) });
  b.set(D.d(`tr_trips/${tripIdD}`), { ...base, id: tripIdD, kind: "drop", ...stamp(D) });
  await check("driver creates today's trips", () => b.commit());
  await check("admin sees both trips", async () => expect((await rows(query(A.c("tr_trips"), where("date", "==", today)))).length === 2));
  await check("parent projection shows today's pickup scheduled", () => until(async () => (await data(P.d("par_transport/stu_101")))?.today?.pickup?.status === "scheduled", "today scheduled"));
  await check("driver saves the checklist and starts the pickup", async () => {
    await updateDoc(D.d(`tr_trips/${tripIdP}`), { checklist: { brakes: true, lights: true, tyres: true, fuel: true, firstAid: true, cleanliness: true }, checklistAt: now(), ...stamp(D) });
    await updateDoc(D.d(`tr_trips/${tripIdP}`), { status: "active", startedAt: now(), startedBy: "crw_001", odometerStart: 48210, ...stamp(D) });
  });
  await check("parent projection shows the pickup active", () => until(async () => (await data(P.d("par_transport/stu_101")))?.today?.pickup?.status === "active", "today active"));

  // attendant app: FirebaseAttendanceRepository.mark (transaction: tr_attendance + trip counts)
  const mark = async (u, crewId, name, studentId, status, stopId) => runTransaction(u.db, async (tx) => {
    const ref = u.d(`tr_attendance/${tripIdP}`); const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data() : { tripId: tripIdP, busId: "bus_01", bus: "Bus 14", date: today, kind: "pickup", total: 5, marks: {} };
    const marks = { ...cur.marks };
    if (status) marks[studentId] = { status, at: now(), by: crewId, byName: name, ...(stopId ? { stopId } : {}) }; else delete marks[studentId];
    const n = (s) => Object.values(marks).filter((m) => m.status === s).length;
    tx.set(ref, { ...cur, marks, total: 5, boarded: n("boarded"), dropped: n("dropped"), absent: n("absent"), ...stamp(u) });
    tx.update(u.d(`tr_trips/${tripIdP}`), { boarded: n("boarded"), dropped: n("dropped"), absent: n("absent"), ...stamp(u) });
  });
  const aarav = await data(D.d("students/stu_101")), meera = await data(D.d("students/stu_201"));
  await check("attendant marks Aarav boarded", () => mark(N, "crw_002", "Suresh Yadav", "stu_101", "boarded", aarav.busStopId));
  await check("driver marks Meera absent at the same time (both crew mark)", () => mark(D, "crw_001", "Ramesh Kumar", "stu_201", "absent", meera.busStopId));
  await check("both marks kept, counts on the trip", async () => { const t = await data(A.d(`tr_trips/${tripIdP}`)); expect(t.boarded === 1 && t.absent === 1, JSON.stringify({ b: t.boarded, a: t.absent })); });
  await check("admin reads who marked and when", async () => { const a = await data(A.d(`tr_attendance/${tripIdP}`)); expect(a.marks.stu_101.byName === "Suresh Yadav" && a.marks.stu_201.by === "crw_001"); });
  await check("parent projection shows Aarav boarded", () => until(async () => (await data(P.d("par_transport/stu_101")))?.today?.pickup?.mark === "boarded", "mark boarded"));
  await check("parent boarded alert names the bus", () => until(async () => (await parentRows(`trp_${tripIdP}_stu_101_boarded`)).some((r) => /boarded Bus 14/.test(r.body)), "boarded alert"));
  await check("parent absent alert for Meera", () => until(async () => (await parentRows(`trp_${tripIdP}_stu_201_absent`)).some((r) => /not at the bus stop/.test(r.body)), "absent alert"));
  await check("driver ends the pickup; boarded pupils arrive at school", async () => {
    await runTransaction(D.db, async (tx) => {
      const ref = D.d(`tr_attendance/${tripIdP}`); const a = (await tx.get(ref)).data();
      const marks = Object.fromEntries(Object.entries(a.marks).map(([k, m]) => [k, m.status === "boarded" ? { ...m, status: "dropped", at: now(), by: "crw_001", byName: "Ramesh Kumar" } : m]));
      const n = (s) => Object.values(marks).filter((m) => m.status === s).length;
      tx.update(ref, { marks, boarded: n("boarded"), dropped: n("dropped"), absent: n("absent"), ...stamp(D) });
      tx.update(D.d(`tr_trips/${tripIdP}`), { status: "completed", endedAt: now(), endedBy: "crw_001", boarded: n("boarded"), dropped: n("dropped"), absent: n("absent"), odometerEnd: 48230, ...stamp(D) });
    });
  });
  await check("parent projection: completed, Aarav dropped", () => until(async () => { const t = (await data(P.d("par_transport/stu_101")))?.today?.pickup; return t?.status === "completed" && t.mark === "dropped"; }, "completed dropped"));
  await check("parent got-off alert says school", () => until(async () => (await parentRows(`trp_${tripIdP}_stu_101_dropped`)).some((r) => /got off at school/.test(r.body)), "dropped alert"));
  await check("attendant cannot edit another bus's trip", () => setDoc(N.d(`tr_trips/${today}_bus_99_pickup`), { busId: "bus_99", date: today, kind: "pickup", status: "active" }).then(() => { throw new Error("allowed"); }, () => {}));

  // crew check-in + leave
  await check("driver checks in; admin sees the day", async () => {
    await setDoc(D.d(`tr_crew_attendance/${today}_crw_001`), { crewId: "crw_001", name: "Ramesh Kumar", role: "driver", busId: "bus_01", date: today, in: hhmm(), out: null, status: "Present", source: "app", note: "", ...stamp(D) });
    expect((await data(A.d(`tr_crew_attendance/${today}_crw_001`)))?.in);
  });
  await check("attendant cannot check the driver in", () => setDoc(N.d(`tr_crew_attendance/${today}_crw_001`), { crewId: "crw_001", date: today, in: "06:00", status: "Present" }).then(() => { throw new Error("allowed"); }, () => {}));
  await setDoc(D.d("tr_crew_leaves/lv_crw_001_sync"), { id: "lv_crw_001_sync", crewId: "crw_001", name: "Ramesh Kumar", role: "driver", busId: "bus_01", type: "Casual", from: today, to: today, days: 1, reason: "Family function", status: "Pending", appliedAt: now(), ...stamp(D) });
  await check("admin bell shows the transport leave", () => until(async () => (await bellRows()).some((n) => n.title === "Transport leave request" && /Ramesh/.test(n.body)), "bell transport leave"));
  await updateDoc(A.d("tr_crew_leaves/lv_crw_001_sync"), { status: "Approved", decidedBy: A.uid, decidedAt: now(), decisionNote: "Bus 8 covers", ...stamp(A) });
  await check("driver reads the approval and note", async () => { const l = await data(D.d("tr_crew_leaves/lv_crw_001_sync")); expect(l.status === "Approved" && l.decisionNote === "Bus 8 covers"); });
  await check("driver cannot approve own leave", async () => {
    await setDoc(D.d("tr_crew_leaves/lv_crw_001_sync2"), { crewId: "crw_001", type: "Sick", from: today, to: today, days: 1, reason: "x", status: "Pending", appliedAt: now() });
    await updateDoc(D.d("tr_crew_leaves/lv_crw_001_sync2"), { status: "Approved" }).then(() => { throw new Error("allowed"); }, () => {});
  });

  // admin changes that must reach the parent and the crew
  await check("admin changes the driver's phone; parent card updates", async () => {
    await updateDoc(A.d("tr_crew/crw_001"), { phone: "+91 90000 11111", ...stamp(A) });
    await until(async () => (await data(P.d("par_transport/stu_101")))?.driver?.phone === "+91 90000 11111", "driver phone");
  });
  await check("driver edits own emergency contact; admin sees it", async () => {
    await updateDoc(D.d("tr_crew/crw_001"), { emergencyName: "Sita K", emergencyPhone: "+91 9", ...stamp(D) });
    expect((await data(A.d("tr_crew/crw_001"))).emergencyName === "Sita K");
  });
  await check("driver cannot move themselves to another bus", () => updateDoc(D.d("tr_crew/crw_001"), { busId: "bus_02" }).then(() => { throw new Error("allowed"); }, () => {}));
  await check("admin moves Aarav to another stop; parent sees the new stop", async () => {
    const stops = bus.stops; const next = stops.find((s) => s.id !== aarav.busStopId);
    await updateDoc(A.d("students/stu_101"), { busStopId: next.id, busStop: next.name, ...stamp(A) });
    await until(async () => (await data(P.d("par_transport/stu_101")))?.stop === next.name, "new stop");
  });
  await check("admin takes Meera off the bus; parent projection removed, driver roster shrinks", async () => {
    await updateDoc(A.d("students/stu_201"), { busId: deleteField(), bus: deleteField(), busStopId: deleteField(), busStop: deleteField(), ...stamp(A) });
    await until(async () => { try { return !(await getDoc(P.d("par_transport/stu_201"))).exists(); } catch { return false; } }, "projection deleted");
    expect((await rows(query(D.c("students"), where("busId", "==", "bus_01")))).length === 4);
  });
  await check("admin renames the route; parent sees it", async () => {
    await updateDoc(A.d("tr_buses/bus_01"), { routeName: "Route 4B (South)", ...stamp(A) });
    await until(async () => (await data(P.d("par_transport/stu_101")))?.routeName === "Route 4B (South)", "route rename");
  });
});

// ======================= run =======================
for (const f of flows) {
  if (only && !f.name.includes(only)) continue;
  console.log(`\n${f.name}`);
  try { await f.fn(); } catch (e) { total++; failed++; failures.push(`${f.name}: setup`); console.log("  FAIL setup -", String(e?.message ?? e).split("\n")[0]); }
}
console.log(failed ? `\n${failed} of ${total} FAILED:\n - ${failures.join("\n - ")}` : `\nall ${total} passed`);
process.exit(failed ? 1 : 0);
