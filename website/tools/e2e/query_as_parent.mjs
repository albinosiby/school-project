// Runs a Firestore query as the test parent against the emulator (rules apply). Debug helper.
import { readFileSync } from "node:fs";
const acc = JSON.parse(readFileSync(new URL("./.accounts.json", import.meta.url)));
const headers = { "Content-Type": "application/json" };
const login = await fetch(`http://localhost:5001/${acc.projectId}/asia-south1/signInParent`, {
  method: "POST", headers, body: JSON.stringify({ data: { email: acc.parent.email, password: acc.parent.password } }),
});
if (!login.ok) throw new Error("Link a student to the test parent before querying.");
const { result } = await login.json();
const r = await fetch("http://localhost:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=fake", {
  method: "POST", headers, body: JSON.stringify({ token: result.token, returnSecureToken: true }),
});
if (!r.ok) throw new Error("Firebase could not open the test parent's session.");
const { idToken } = await r.json();
const q = JSON.parse(process.argv[2]);
const res = await fetch(`http://localhost:8080/v1/projects/${acc.projectId}/databases/(default)/documents/schools/${acc.schoolId}:runQuery`, { method: "POST", headers: { Authorization: `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ structuredQuery: q }) });
console.log(res.status, JSON.stringify(await res.json()).slice(0, 600));
