// Read-only dump of the emulator's transport docs for the e2e school (demo-* project only).
//   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node tools/e2e/probe.mjs [trips|att|crew|leaves|crewdocs|par|notif|bell|all]
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
process.env.FIRESTORE_EMULATOR_HOST ??= "127.0.0.1:8080";
const require = createRequire(new URL("../../functions/package.json", import.meta.url));
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
if (!acc.projectId.startsWith("demo-")) throw new Error("emulator only");
initializeApp({ projectId: acc.projectId });
const S = getFirestore().collection("schools").doc(acc.schoolId);
const ist = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
const what = process.argv[2] ?? "all";
const show = async (col, filter = () => true, pick = (d) => d) => {
  const q = await S.collection(col).get();
  const rows = q.docs.filter((d) => filter(d.id, d.data())).map((d) => ({ id: d.id, ...pick(d.data()) }));
  console.log(`== ${col} (${rows.length})`); for (const r of rows) console.log(JSON.stringify(r));
};
const on = (k) => what === "all" || what === k;
if (on("trips")) await show("tr_trips", (id) => id.startsWith(ist), ({ status, boarded, dropped, absent, total, startedBy, endedBy, checklist, note }) => ({ status, total, boarded, dropped, absent, startedBy, endedBy, checklistDone: checklist ? Object.values(checklist).filter(Boolean).length : 0, note }));
if (on("att")) await show("tr_attendance", (id) => id.startsWith(ist), ({ marks, boarded, dropped, absent }) => ({ boarded, dropped, absent, marks: Object.fromEntries(Object.entries(marks ?? {}).map(([k, v]) => [k, `${v.status} by ${v.byName || v.by}`])) }));
if (on("crew")) await show("tr_crew_attendance", (id) => id.startsWith(ist));
if (on("leaves")) await show("tr_crew_leaves", () => true, ({ crewId, type, from, to, status, decisionNote }) => ({ crewId, type, from, to, status, decisionNote }));
if (on("crewdocs")) await show("tr_crew", () => true, ({ name, phone, busId, emergencyName, address, status }) => ({ name, phone, busId, emergencyName, address, status }));
if (on("par")) await show("par_transport", () => true, ({ bus, stop, driver, attendant, today }) => ({ bus, stop, driver: driver?.phone, attendant: attendant?.name, pickup: today?.pickup, drop: today?.drop }));
if (on("notif")) await show("par_notifications", (id) => id.startsWith("trp_"), ({ title, body }) => ({ title, body }));
if (what === "bell" || what === "all") await show("notifications", () => true, ({ title, body, href }) => ({ title, body, href }));
process.exit(0);
