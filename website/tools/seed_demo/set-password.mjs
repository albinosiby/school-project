// Sets a new password for a login of this project (e.g. demo accounts whose email cannot receive reset mail).
// Uses your Firebase CLI login (`firebase login` as a project owner); the password is read from the environment so it
// never lands in shell history files or this repo.
//
//   NEW_PASSWORD='<at least 8 characters>' node tools/seed_demo/set-password.mjs demo@greenfield.edu
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const PROJECT = "school-admin-tatos-2610";
const email = process.argv[2];
const password = process.env.NEW_PASSWORD;
if (!email) throw new Error("Usage: NEW_PASSWORD='…' node tools/seed_demo/set-password.mjs <email>");
if (!password || password.length < 8) throw new Error("Set NEW_PASSWORD (at least 8 characters)");

const require = createRequire(import.meta.url);
const cliBin = execSync("node -e \"console.log(require('fs').realpathSync(process.argv[1]))\" \"$(command -v firebase)\"", { shell: "/bin/bash" }).toString().trim();
const auth = require(cliBin.replace(/\/lib\/bin\/firebase(\.js)?$/, "/lib/auth.js"));
const acct = auth.getGlobalDefaultAccount();
if (!acct) throw new Error("Run `firebase login` first");
const token = (await auth.getAccessToken(acct.tokens.refresh_token, ["https://www.googleapis.com/auth/cloud-platform"])).access_token;

async function call(path, body) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${PROJECT}/${path}`, {
    method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${path}: ${j.error?.message ?? r.status}`);
  return j;
}

const user = (await call("accounts:lookup", { email: [email] })).users?.[0];
if (!user) throw new Error(`No login with email ${email}`);
await call("accounts:update", { localId: user.localId, password });
console.log(`Password updated for ${email}. Sign in with it now.`);
