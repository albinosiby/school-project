// One-off: fills the parent app's data for records that existed before the parent functions were deployed.
// It sets only `backfilledAt` on each source doc; the deployed triggers (functions/parent.js) then write
// par_attendance / par_homework / par_results, parentVisible on notices and calendar events, and classes.classTeacher.
// Existing teacher triggers fire only on status changes, so nothing is re-sent to teachers.
//
//   node tools/parent_backfill/backfill.mjs [--school <sid>] [--days 120] [--dry]
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const cliBin = execSync("node -e \"console.log(require('fs').realpathSync(process.argv[1]))\" \"$(command -v firebase)\"", { shell: "/bin/bash" }).toString().trim();
const auth = require(cliBin.replace(/\/lib\/bin\/firebase(\.js)?$/, "/lib/auth.js"));
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const PROJECT = "school-admin-tatos-2610";
const SCHOOL = arg("school", "JsJ5kKe00qPf2V0YfvvzTBIYlnK2");
const DAYS = Number(arg("days", "120"));
const DRY = process.argv.includes("--dry");
const ROOT = `projects/${PROJECT}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${ROOT}/schools/${SCHOOL}`;

const acct = auth.getGlobalDefaultAccount();
if (!acct) throw new Error("Run `firebase login` first");
const token = (await auth.getAccessToken(acct.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])).access_token;
async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: body && JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url} -> ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j;
}
async function list(col) {
  const out = [];
  let page = "";
  do {
    const j = await api("GET", `${BASE}/${col}?pageSize=300${page ? `&pageToken=${page}` : ""}`);
    out.push(...(j.documents ?? []));
    page = j.nextPageToken ?? "";
  } while (page);
  return out;
}
const idOf = (d) => d.name.split("/").pop();
const str = (f) => f?.stringValue ?? "";
const at = new Date().toISOString();
async function touch(col, docs) {
  // commit in batches of 200, writing only backfilledAt (updateMask) on docs that exist
  for (let i = 0; i < docs.length; i += 200) {
    const writes = docs.slice(i, i + 200).map((d) => ({
      update: { name: d.name, fields: { backfilledAt: { stringValue: at } } },
      updateMask: { fieldPaths: ["backfilledAt"] },
      currentDocument: { exists: true },
    }));
    if (!DRY) await api("POST", `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:commit`, { writes });
  }
  console.log(`${DRY ? "[dry] " : ""}${col}: ${docs.length}`);
}

const since = new Date(Date.now() - DAYS * 864e5).toISOString().slice(0, 10);
await touch("classes", await list("classes"));
await touch("com_notices", await list("com_notices"));
await touch("calendar_events", await list("calendar_events"));
await touch("ops_attendance", (await list("ops_attendance")).filter((d) => str(d.fields?.date) >= since));
await touch("ops_homework", await list("ops_homework"));
const published = new Set((await list("exm_papers")).filter((d) => (d.fields?.published?.arrayValue?.values ?? []).length).map(idOf));
await touch("exm_marks", (await list("exm_marks")).filter((d) => published.has(str(d.fields?.paperId))));
console.log("done; the triggers fill the parent collections over the next minute or two");
