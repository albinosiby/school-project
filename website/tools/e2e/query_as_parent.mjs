// Runs a Firestore query as the test parent against the emulator (rules apply). Debug helper.
import { readFileSync } from "node:fs";
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
const r = await fetch("http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: acc.parent.email, password: acc.parent.password, returnSecureToken: true }) });
const { idToken } = await r.json();
const q = JSON.parse(process.argv[2]);
const res = await fetch(`http://localhost:8080/v1/projects/${acc.projectId}/databases/(default)/documents/schools/${acc.schoolId}:runQuery`, { method: "POST", headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: q }) });
console.log(res.status, JSON.stringify(await res.json()).slice(0, 600));
