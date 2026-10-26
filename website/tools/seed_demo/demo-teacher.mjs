// Creates the demo teacher login (Mrs. Anita Sharma, stf_025) and runs an end-to-end check of
// teacher sign-in + Firestore rules against the live project. Usage (from website/):
//   TEACHER_PASSWORD='<choose one>' node tools/seed_demo/demo-teacher.mjs
// The school mapping users/{uid} = {schoolId, role:"teacher", staffId} is written by an admin
// (the admin web's Staff screen does it when staff are added); the script waits for it.
import { createRequire } from "node:module";
const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = require("firebase/auth");
const { initializeFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, collection, query, where } = require("firebase/firestore");

const env = Object.fromEntries(require("node:fs").readFileSync(new URL("../../web/.env.local", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const app = initializeApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID });
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
const email = process.env.TEACHER_EMAIL || "anita.sharma@greenfield.edu";
const pw = process.env.TEACHER_PASSWORD;
if (!pw || pw.length < 8) throw new Error("Set TEACHER_PASSWORD (8+ characters)");

let cred;
try { cred = await createUserWithEmailAndPassword(auth, email, pw); await updateProfile(cred.user, { displayName: "Mrs. Anita Sharma" }); console.log("created login", email); }
catch (e) { if (e.code !== "auth/email-already-in-use") throw e; cred = await signInWithEmailAndPassword(auth, email, pw); console.log("login exists, signed in", email); }
const uid = cred.user.uid;
console.log("uid:", uid);

// wait for the admin-written mapping
let me = null;
for (let i = 0; i < 60 && !me; i++) {
  const s = await getDoc(doc(db, "users", uid)).catch(() => null);
  if (s?.exists()) me = s.data();
  else { if (i === 0) console.log("waiting for users/" + uid + " (admin writes it)…"); await new Promise((r) => setTimeout(r, 5000)); }
}
if (!me) { console.log("users doc not found after 5 minutes; ask the admin to add it, then re-run"); process.exit(2); }
const { schoolId, staffId, role } = me;
console.log("mapping:", { schoolId, staffId, role });

const S = (c, id) => (id ? doc(db, "schools", schoolId, c, id) : collection(db, "schools", schoolId, c));
let pass = 0, fail = 0;
async function check(name, fn, expectAllowed = true) {
  try { const r = await fn(); if (expectAllowed) { pass++; console.log("PASS", name, r ?? ""); } else { fail++; console.log("FAIL", name, "(should be denied)"); } }
  catch (e) { if (!expectAllowed && e.code === "permission-denied") { pass++; console.log("PASS", name, "(denied)"); } else { fail++; console.log("FAIL", name, e.code || e.message); } }
}
const today = new Date().toISOString().slice(0, 10);
const tag = `e2e_${Date.now().toString(36)}`;

await check("role is teacher", async () => { if (role !== "teacher") throw new Error("role " + role); return staffId; });
await check("read own staff doc", async () => (await getDoc(S("staff", staffId))).data()?.name);
await check("read school", async () => (await getDoc(S("school", "school"))).data()?.name);
await check("read classes", async () => (await getDocs(S("classes"))).size + " classes");
await check("read 10-B roster", async () => (await getDocs(query(S("students"), where("classId", "==", "cls_10B")))).size + " students");
await check("read my timetable", async () => (await getDocs(query(S("ops_periods"), where("teacherId", "==", staffId)))).size + " periods");
await check("read substitutions", async () => (await getDocs(S("ops_substitutions"))).size + " rows");
await check("write own attendance", () => setDoc(S("ops_attendance", `${today}_cls_10B_${tag}`), { date: today, classId: "cls_10B", grade: "10", section: "B", period: 9, total: 42, marks: {}, submitted: false, teacherId: staffId, e2e: true }));
await check("write attendance as another teacher", () => setDoc(S("ops_attendance", `${today}_cls_10B_${tag}_x`), { date: today, classId: "cls_10B", period: 9, total: 42, marks: {}, teacherId: "stf_003" }), false);
await check("create live class", () => setDoc(S("live_classes", tag), { title: "E2E check", classId: "cls_10B", subject: "Mathematics", teacherId: staffId, date: today, time: "23:00", mins: 30, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "Scheduled", e2e: true }));
await check("record a join", () => setDoc(doc(db, "schools", schoolId, "live_classes", tag, "joins", uid), { joinedAt: new Date().toISOString() }));
await check("private task create + delete", async () => { await setDoc(S("tk_tasks", tag), { title: "e2e", teacherId: staffId }); await deleteDoc(S("tk_tasks", tag)); });
await check("read fees", () => getDocs(S("fee_invoices")), false);
await check("read admissions", () => getDocs(S("adm_applications")), false);
await check("edit staff records", () => setDoc(S("staff", staffId), { role: "Principal" }, { merge: true }), false);
await check("read another school", () => getDocs(collection(db, "schools", "some-other-school", "students")), false);

console.log(`\n${pass} passed, ${fail} failed. Test docs tagged ${tag} (an admin can delete them).`);
process.exit(fail ? 1 : 0);
