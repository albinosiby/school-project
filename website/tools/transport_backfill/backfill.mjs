// One-off: builds the parent app's bus view (par_transport, contract 14.9) for students who were put on a bus before the
// transport projection functions were deployed. It sets only `backfilledAt` on each tr_buses doc; the deployed
// onTransportProjectionBus trigger then writes par_transport for every rider of that bus. Nothing is sent to anyone.
//
//   node tools/transport_backfill/backfill.mjs [--school <sid>] [--dry]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const cliBin = execSync("node -e \"console.log(require('fs').realpathSync(process.argv[1]))\" \"$(command -v firebase)\"", { shell: "/bin/bash" }).toString().trim();
const auth = require(cliBin.replace(/\/lib\/bin\/firebase(\.js)?$/, "/lib/auth.js"));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PROJECT = "school-admin-tatos-2610";
const SCHOOL = arg("school", "JsJ5kKe00qPf2V0YfvvzTBIYlnK2");
const DRY = process.argv.includes("--dry");
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/schools/${SCHOOL}`;

const acct = auth.getGlobalDefaultAccount();
if (!acct) throw new Error("Run `firebase login` first");
const token = (await auth.getAccessToken(acct.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])).access_token;
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
const buses = [];
for (let page = ""; ; ) {
  const j = await api("GET", `${BASE}/tr_buses?pageSize=300${page ? `&pageToken=${page}` : ""}`);
  buses.push(...(j.documents ?? []));
  if (!j.nextPageToken) break;
  page = j.nextPageToken;
}
console.log(`${buses.length} bus(es) in school ${SCHOOL}${DRY ? " (dry run, nothing written)" : ""}`);
const at = new Date().toISOString();
for (const d of buses) {
  const id = d.name.split("/").pop();
  if (DRY) { console.log("  would touch", id); continue; }
  await api("PATCH", `https://firestore.googleapis.com/v1/${d.name}?updateMask.fieldPaths=backfilledAt`, { fields: { backfilledAt: { stringValue: at } } });
  console.log("  touched", id);
}
console.log(DRY ? "done (dry run)" : "done: the onTransportProjectionBus trigger now writes par_transport for each bus's riders");
