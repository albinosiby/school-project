// Creates (or refreshes) the client-demo school: a real Firebase Auth user whose Firestore
// data is the full demo seed (web/src/server/seed). Usage:
//   cd web && npx tsc src/server/seed/index.ts --outDir /tmp/seedjs --module commonjs --target es2020 --skipLibCheck --resolveJsonModule --esModuleInterop
//   (regenerate the shared fixture first with: node tools/demo_fixture/build.mjs)
//   DEMO_EMAIL=... DEMO_PASSWORD=... node ../tools/seed_demo/seed-demo.mjs
import { createRequire } from "node:module";
const require = createRequire(new URL("../../web/package.json", import.meta.url));
const { initializeApp } = require("firebase/app");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } = require("firebase/auth");
const { initializeFirestore, doc, writeBatch, getDocs, collection, setDoc } = require("firebase/firestore");
const { seed } = require("/tmp/seedjs/index.js");

const env = Object.fromEntries(require("node:fs").readFileSync(new URL("../../web/.env.local", import.meta.url), "utf8").split("\n").filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2)));
const app = initializeApp({ apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY, authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, appId: env.NEXT_PUBLIC_FIREBASE_APP_ID });
const auth = getAuth(app);
const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
const { DEMO_EMAIL: email, DEMO_PASSWORD: pw } = process.env;
if (!email || !pw) throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD");

let cred;
try { cred = await createUserWithEmailAndPassword(auth, email, pw); await updateProfile(cred.user, { displayName: "Sunrise Public School" }); console.log("created user"); }
catch (e) { if (e.code !== "auth/email-already-in-use") throw e; cred = await signInWithEmailAndPassword(auth, email, pw); console.log("user exists, refreshing data"); }
const uid = cred.user.uid;
// contract section 1: users/{uid} maps the login to its school (demo school id == admin uid)
await setDoc(doc(db, "users", uid), { schoolId: uid, role: "admin", email, name: cred.user.displayName || "Administrator", createdAt: new Date().toISOString() }, { merge: true });

let total = 0;
for (const [name, rows] of Object.entries(seed)) {
  const existing = await getDocs(collection(db, "schools", uid, name));
  for (let i = 0; i < existing.docs.length; i += 400) { const b = writeBatch(db); existing.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref)); await b.commit(); }
  for (let i = 0; i < rows.length; i += 400) {
    const b = writeBatch(db);
    rows.slice(i, i + 400).forEach((r, j) => {
      const v = { ...structuredClone(r), _o: 1e12 - (i + j) };
      if (name === "me") v.email = email;
      if (name === "onboarding") { v.complete = true; v.completed = [1, 2, 3, 4, 5, 6, 7, 8]; }
      if (name === "setup_steps") { v.done = true; v.doneAt = "2026-04-12"; }
      b.set(doc(db, "schools", uid, name, r.id), v);
    });
    await b.commit(); total += Math.min(400, rows.length - i);
  }
  console.log(name, rows.length);
}
console.log("done, docs written:", total);
process.exit(0);
