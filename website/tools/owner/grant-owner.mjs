// Makes a login a product owner (DATA_CONTRACT section 16): writes platform_admins/{uid}, which only admin credentials can
// write. Creates the login first when the email has none yet, and sets its password when OWNER_PASSWORD is given.
// The password is read from the environment so it never lands in shell history files or this repo.
//
//   Live project (uses your `firebase login`, which must be an owner/editor of the project):
//     OWNER_PASSWORD='<password>' node tools/owner/grant-owner.mjs you@company.com
//   Local emulators (FIREBASE_AUTH_EMULATOR_HOST / FIRESTORE_EMULATOR_HOST set, demo-* project):
//     FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 OWNER_PASSWORD='…' node tools/owner/grant-owner.mjs owner@edvio.test
//   Take owner rights away again (the login itself stays):
//     node tools/owner/grant-owner.mjs you@company.com --revoke
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const PROJECT = process.env.GCLOUD_PROJECT || (process.env.FIRESTORE_EMULATOR_HOST ? "demo-school-e2e" : "school-admin-tatos-2610");
const email = (process.argv[2] ?? "").trim().toLowerCase();
const revoke = process.argv.includes("--revoke");
const password = process.env.OWNER_PASSWORD;
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Usage: OWNER_PASSWORD='…' node tools/owner/grant-owner.mjs <email> [--revoke]");
if (password !== undefined && password.length < 6) throw new Error("OWNER_PASSWORD needs at least 6 characters (Firebase minimum)");
const require = createRequire(new URL("../../functions/package.json", import.meta.url));

if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // ---- emulator: admin SDK against the local emulators only ----
  if (!PROJECT.startsWith("demo-")) throw new Error("emulator mode needs a demo-* project id");
  const { initializeApp } = require("firebase-admin/app");
  const { getAuth } = require("firebase-admin/auth");
  const { getFirestore } = require("firebase-admin/firestore");
  initializeApp({ projectId: PROJECT });
  let user = await getAuth().getUserByEmail(email).catch(() => null);
  if (!user && revoke) throw new Error(`No login with email ${email}`);
  if (!user) {
    if (!password) throw new Error("No login yet for this email: set OWNER_PASSWORD to create it");
    user = await getAuth().createUser({ email, password, displayName: "Edvio owner" });
  } else if (password) await getAuth().updateUser(user.uid, { password });
  const ref = getFirestore().doc(`platform_admins/${user.uid}`);
  if (revoke) await ref.delete(); else await ref.set({ email, grantedAt: new Date().toISOString(), grantedBy: "grant-owner.mjs" });
  console.log(`${revoke ? "Revoked" : "Granted"} owner (emulator ${PROJECT}): ${email} uid=${user.uid}`);
  process.exit(0);
}

// ---- live: REST with the Firebase CLI's OAuth token (an IAM principal, so the Firestore rules do not apply) ----
const cliBin = execSync("node -e \"console.log(require('fs').realpathSync(process.argv[1]))\" \"$(command -v firebase)\"", { shell: "/bin/bash" }).toString().trim();
const auth = require(cliBin.replace(/\/lib\/bin\/firebase(\.js)?$/, "/lib/auth.js"));
const acct = auth.getGlobalDefaultAccount();
if (!acct) throw new Error("Run `firebase login` first");
const token = (await auth.getAccessToken(acct.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])).access_token;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "x-goog-user-project": PROJECT };

async function call(url, method, body) {
  const r = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${url.split("?")[0]}: ${j.error?.message ?? r.status}`);
  return j;
}
const idt = (path, body) => call(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/${path}`, "POST", body);

let uid = (await idt("accounts:lookup", { email: [email] })).users?.[0]?.localId;
if (!uid && revoke) throw new Error(`No login with email ${email}`);
if (!uid) {
  if (!password) throw new Error("No login yet for this email: set OWNER_PASSWORD to create it");
  uid = (await idt("accounts", { email, password, displayName: "Edvio owner" })).localId;
  console.log(`Created the login ${email}`);
} else if (password) { await idt("accounts:update", { localId: uid, password }); console.log(`Password updated for ${email}`); }

const docUrl = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/platform_admins/${uid}`;
if (revoke) await call(docUrl, "DELETE");
else await call(docUrl, "PATCH", { fields: { email: { stringValue: email }, grantedAt: { stringValue: new Date().toISOString() }, grantedBy: { stringValue: acct.user?.email ?? "grant-owner.mjs" } } });
console.log(`${revoke ? "Revoked" : "Granted"} owner on ${PROJECT}: ${email} (uid ${uid}). Sign in at https://edvio-owner.web.app/login`);
