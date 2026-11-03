// Scheduled circulars (functions/index.js publishScheduledNotices) against the LOCAL emulators: runs the job in-process.
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tools/e2e/scheduled_test.mjs
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
if (!acc.projectId.startsWith("demo-")) throw new Error("emulator only");
process.env.GCLOUD_PROJECT = acc.projectId;
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const fns = require("./index.js"); // resolved from functions/package.json
const { getFirestore } = require("firebase-admin/firestore");
const db = getFirestore();
const S = db.collection("schools").doc(acc.schoolId);
let failed = 0;
const check = (name, ok) => { console.log(ok ? "  ok  " : "  FAIL", name); if (!ok) failed++; };
const past = new Date(Date.now() - 60e3).toISOString(), future = new Date(Date.now() + 3600e3).toISOString();
const base = { category: "Events", audience: "All School", body: "x", author: "Principal", recipients: 12, delivered: 0, acked: 0, read: 0, channels: ["App"] };
await S.collection("com_notices").doc("ntc_sched_due").set({ ...base, title: "Due", status: "Scheduled", sentAt: past });
await S.collection("com_notices").doc("ntc_sched_later").set({ ...base, title: "Later", status: "Scheduled", sentAt: future });
await S.collection("com_notices").doc("ntc_sched_draft").set({ ...base, title: "Draft", status: "Draft", sentAt: past });
const n = await fns.publishScheduledNotices.runFor();
const get = async (id) => (await S.collection("com_notices").doc(id).get()).data();
check("publishes exactly the due one", n === 1);
check("due notice is Published with delivered = recipients", (await get("ntc_sched_due")).status === "Published" && (await get("ntc_sched_due")).delivered === 12);
check("future notice stays Scheduled", (await get("ntc_sched_later")).status === "Scheduled");
check("draft is untouched", (await get("ntc_sched_draft")).status === "Draft");
check("a send log row is written", (await S.collection("com_log").where("noticeId", "==", "ntc_sched_due").get()).size === 1);
check("running again publishes nothing (idempotent)", (await fns.publishScheduledNotices.runFor()) === 0);
for (let i = 0; i < 40; i++) { if ((await get("ntc_sched_due")).parentVisible === true) break; await new Promise((r) => setTimeout(r, 1000)); }
check("the Published write reaches parents (onNoticeForParents sets parentVisible)", (await get("ntc_sched_due")).parentVisible === true);
console.log(failed ? `\n${failed} FAILED` : "\nall passed");
process.exit(failed ? 1 : 0);
