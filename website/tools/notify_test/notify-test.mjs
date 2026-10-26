// Fires every push/alert case of website/functions once against a school, so you can watch them arrive on a teacher's
// phone and in the admin web's notification bell. Writes exactly what the admin web / teacher app would write, then
// restores every document it changed and deletes everything it created (pass --keep to leave the test data).
//
// Usage (from website/, signed in with `firebase login` as a project owner):
//   node tools/notify_test/notify-test.mjs [--school <schoolId>] [--teacher <staffId>] [--gap <seconds>] [--only 3,10] [--keep]
//   node tools/notify_test/notify-test.mjs --restore      undo a --keep run
// Defaults: the Greenfield demo school, teacher stf_025 (Mrs. Anita Sharma), 6 seconds between cases.
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
// the Firebase CLI's own login (works for npm and Homebrew installs): <firebase-tools>/lib/bin/firebase.js -> <firebase-tools>/lib/auth.js
const cliBin = execSync("node -e \"console.log(require('fs').realpathSync(process.argv[1]))\" \"$(command -v firebase)\"", { shell: "/bin/bash" }).toString().trim();
const auth = require(cliBin.replace(/\/lib\/bin\/firebase(\.js)?$/, "/lib/auth.js"));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PROJECT = "school-admin-tatos-2610";
const SCHOOL = arg("school", "JsJ5kKe00qPf2V0YfvvzTBIYlnK2");
const TEACHER = arg("teacher", "stf_025");
const GAP = Number(arg("gap", "6")) * 1000;
const KEEP = process.argv.includes("--keep");
const ONLY = (arg("only", "") || "").split(",").filter(Boolean).map(Number); // e.g. --only 10,11
const STATE = new URL("./.last-run.json", import.meta.url); // what --keep left behind, for --restore
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}`;
const S = `schools/${SCHOOL}`;

const acct = auth.getGlobalDefaultAccount();
if (!acct) throw new Error("Run `firebase login` first");
const token = (await auth.getAccessToken(acct.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])).access_token;
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 404) throw new Error(`${method} ${url.split("/documents/")[1] ?? url} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return r.status === 404 ? null : j;
}
const enc = (v) => v === null || v === undefined ? { nullValue: null } : typeof v === "boolean" ? { booleanValue: v } :
  typeof v === "number" ? (Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v }) : typeof v === "string" ? { stringValue: v } :
  Array.isArray(v) ? { arrayValue: { values: v.map(enc) } } : { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)])) } };
const commit = (writes) => api("POST", `${BASE}:commit`, { writes });
const set = (path, data) => commit([{ update: { name: `${ROOT}/${S}/${path}`, fields: enc(data).mapValue.fields } }]);
const del = (path) => commit([{ delete: `${ROOT}/${S}/${path}` }]);
const get = (path) => api("GET", `${BASE}/${S}/${path}`);
/** Patch a few fields of an existing doc, remembering the original for restore. */
const originals = new Map();
async function patch(path, fields) {
  const cur = await get(path);
  if (!cur) throw new Error(`${path} does not exist in this school`);
  if (!originals.has(path)) originals.set(path, cur.fields);
  await commit([{ update: { name: `${ROOT}/${S}/${path}`, fields: { ...cur.fields, ...enc(fields).mapValue.fields } } }]);
}
const created = [];
const create = async (path, data) => { created.push(path); await set(path, data); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const day = (n) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

// a paper of the teacher's classes and the class they do not lead yet, picked from the school's data
const assignments = (await api("GET", `${BASE}/${S}/assignments?pageSize=300`))?.documents ?? [];
const mine = assignments.map((d) => d.fields).filter((f) => f.teacherId?.stringValue === TEACHER);
if (!mine.length) throw new Error(`${TEACHER} has no class assignments in ${SCHOOL}`);
const papers = ((await api("GET", `${BASE}/${S}/exm_papers?pageSize=300`))?.documents ?? []).map((d) => ({ id: d.name.split("/").pop(), f: d.fields }));
// same subject matching as the functions ("Science" covers "Physics", not "Social Science")
const science = (x) => /physics|chemistry|biology/i.test(x) || (/science/i.test(x) && !/social|computer/i.test(x));
const covers = (paperSubject, assigned) => { const P = paperSubject.toLowerCase(), A = assigned.toLowerCase(); return P === A || P.includes(A) || A.includes(P) || (science(P) && science(A)); };
const pick = mine.flatMap((a) => papers
  .filter((p) => (p.f.classIds?.arrayValue?.values ?? []).some((v) => v.stringValue === a.classId.stringValue) && covers(p.f.subject?.stringValue ?? "", a.subject.stringValue))
  .map((p) => ({ a, p })))[0];
if (!pick) throw new Error(`No exam paper in ${SCHOOL} covers a class and subject ${TEACHER} teaches`);
const paper = pick.p, myClass = pick.a.classId.stringValue, mySubject = pick.a.subject.stringValue;
const otherClass = mine.map((a) => a.classId.stringValue).find((c) => c !== myClass) ?? myClass;
const label = (c) => c.replace(/^cls_(\d+)([A-Z])$/, "$1-$2");

const cases = [
  ["Circular for staff", () => create("com_notices/zz_test_circular", { title: "Test: Staff meeting on Friday", category: "Academic", audience: "Staff & Teachers", recipients: 68, sentAt: now(), status: "Published", pinned: false, urgent: false, author: "Notification test", channels: ["App"], delivered: 0, acked: 0, read: 0, body: "All teaching staff: Term 2 review in the conference hall at 3:30 PM on Friday." })],
  ["Urgent circular (ignores the teacher's switches)", () => create("com_notices/zz_test_urgent", { title: "Test: School closed tomorrow", category: "Emergency", audience: "All School", recipients: 1420, sentAt: now(), status: "Published", pinned: true, urgent: true, author: "Notification test", channels: ["App"], delivered: 0, acked: 0, read: 0, body: "Heavy rain alert: the school stays closed tomorrow." })],
  ["Substitution assigned", () => create("ops_substitutions/zz_test_sub", { date: day(2), day: "Wed", period: 3, classId: otherClass, subject: "Science", absentTeacherId: "stf_003", substituteTeacherId: TEACHER, status: "Assigned", topic: "Notification test" })],
  ["Leave request -> admin bell", () => create("staff_leaves/zz_test_leave_ok", { staffId: TEACHER, teacherId: TEACHER, type: "Casual Leave", from: day(9), to: day(9), days: 1, reason: "Notification test (approve)", status: "Pending", createdAt: now() })],
  ["Leave approved", () => patch("staff_leaves/zz_test_leave_ok", { status: "Approved", decidedAt: now(), decisionNote: "Enjoy the day" })],
  ["Leave rejected", async () => { await create("staff_leaves/zz_test_leave_no", { staffId: TEACHER, teacherId: TEACHER, type: "Medical Leave", from: day(10), to: day(11), days: 2, reason: "Notification test (reject)", status: "Pending", createdAt: now() }); await wait(4000); await patch("staff_leaves/zz_test_leave_no", { status: "Rejected", decidedAt: now(), decisionNote: "Exam week, please reschedule" }); }],
  ["New class assigned", () => create("assignments/zz_test_assignment", { classId: otherClass, subject: "Remedial Mathematics", teacherId: TEACHER, topic: "Notification test" })],
  ["Made class teacher", () => patch(`classes/${otherClass}`, { classTeacherId: TEACHER })],
  ["Exam duty assigned", () => patch(`exm_papers/${paper.id}`, { invigilatorId: TEACHER })],
  ["Marks entry locked", () => patch(`exm_papers/${paper.id}`, { locked: true })],
  ["Results published", () => patch(`exm_papers/${paper.id}`, { published: [label(myClass)] })],
  ["Calendar event", () => create("calendar_events/zz_test_event", { title: "Test: Science Exhibition", category: "event", start: day(12), end: day(12), startTime: "10:00", endTime: "13:00", venue: "Main Auditorium", term: "Term 2", status: "published", instructional: false, grades: [], notifyApp: true, notifyWhatsapp: false, lead: "", desc: "" })],
  ["Live class scheduled -> admin bell", () => create("live_classes/zz_test_live", { title: "Test: Revision class", classId: myClass, subject: mySubject, teacherId: TEACHER, date: day(1), time: "17:00", mins: 45, medium: "Google Meet", link: "https://meet.google.com/abc-defg-hij", status: "upcoming", createdAt: now() })],
];

async function restore(orig, made) {
  for (const [path, fields] of orig) await commit([{ update: { name: `${ROOT}/${S}/${path}`, fields } }]);
  for (const path of made) await del(path);
  const approvals = ((await api("GET", `${BASE}/${S}/approvals?pageSize=300`))?.documents ?? []).filter((d) => d.name.includes("zz_test_"));
  for (const d of approvals) await del(`approvals/${d.name.split("/").pop()}`);
  console.log(`Restored ${orig.filter(([p]) => !made.includes(p)).length} changed docs, deleted ${made.length} test docs. The notification rows stay; clear them in the apps.`);
}
const fs = await import("node:fs");
if (process.argv.includes("--restore")) {
  if (!fs.existsSync(STATE)) throw new Error("Nothing to restore (no --keep run recorded)");
  const st = JSON.parse(fs.readFileSync(STATE, "utf8"));
  await restore(st.originals, st.created);
  fs.unlinkSync(STATE);
  process.exit(0);
}

console.log(`School ${SCHOOL}, teacher ${TEACHER}; ${cases.length} cases, ${GAP / 1000}s apart. Put the teacher app in the background to see them in the phone's tray.\n`);
const started = now();
for (const [i, [name, run]] of cases.entries()) {
  if (ONLY.length && !ONLY.includes(i + 1)) continue;
  await run();
  console.log(`${String(i + 1).padStart(2)}. ${name}`);
  await wait(GAP);
}
console.log("\nWaiting for the functions to finish…");
await wait(15000);

// what arrived: the teacher's in-app rows and the admin bell rows written since the start
const rows = async (c) => ((await api("GET", `${BASE}/${S}/${c}?pageSize=300`))?.documents ?? []).filter((d) => (d.fields.at?.stringValue ?? d.fields.updatedAt?.stringValue ?? "") >= started.slice(0, 19) || d.fields.source?.stringValue === "teacher");
const inApp = (await rows("hm_notifications")).filter((d) => d.fields.teacherId?.stringValue === TEACHER);
const bell = (await rows("notifications")).filter((d) => d.fields.source?.stringValue === "teacher" && (d.fields.createdAt?.stringValue ?? "") >= new Date(Date.parse(started) + 5.5 * 3600e3).toISOString().slice(0, 19));
console.log(`\nTeacher in-app notifications created: ${inApp.length}`);
for (const d of inApp) console.log(`  · ${d.fields.tag?.stringValue}: ${d.fields.title?.stringValue}`);
console.log(`Admin bell notifications created: ${bell.length}`);
for (const d of bell) console.log(`  · ${d.fields.title?.stringValue}: ${d.fields.body?.stringValue}`);

if (KEEP) {
  fs.writeFileSync(STATE, JSON.stringify({ school: SCHOOL, originals: [...originals], created }));
  console.log("\n--keep: test data left in place. Undo with: node tools/notify_test/notify-test.mjs --restore");
  process.exit(0);
}
console.log("\nRestoring the school's data…");
await restore([...originals], created);
