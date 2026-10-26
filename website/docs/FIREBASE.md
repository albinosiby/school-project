# Firebase backend

Project: `school-admin-tatos-2610` (Spark / free plan) · account intern.tatos@gmail.com
Console: https://console.firebase.google.com/u/1/project/school-admin-tatos-2610

## What is live
- **Auth**: email + password (sign up, sign in, sign out, password-reset email).
- **Firestore** (asia-south1): every school's data is under `schools/{uid}/{collection}/{id}`.
  `src/lib/useCollection.ts` is a realtime Firestore store (same API as the old JSON one).
- **Rules** (`firestore.rules`): role-based (docs/DATA_CONTRACT.md section 7). Helper functions look up `users/{auth uid}` = `{schoolId, role, staffId?}`; admin has full access to `schools/{schoolId}/**`, teachers get per-collection read/write, everything else is denied. Tests: `tools/rules_test` (emulator only).
- **Accounts**: `users/{uid}` maps every login to a school. Admin sign-up writes `{schoolId: uid, role: "admin"}` (`bootstrap.ts`); on login `authContext.tsx` reads it and `useCollection.ts` scopes all data to its `schoolId`. Non-admin roles are signed out with a message. A pre-existing school without a users doc gets one on first login (kept only if `schools/{uid}` has data).
- **Staff = teacher login**: adding staff (Staff & HR) requires a unique email; the web creates the Auth user with a random password via a secondary Firebase app instance (`lib/staffAccount.ts`), writes `users/{newUid}` (role teacher, staffId) + the staff doc with `authUid` in one batch, then sends a password-reset email so the teacher sets a password. If any step fails the Auth user is deleted and nothing is saved. Existing staff get a `Create login` / `Resend invite` action. Deleting staff removes their `users` doc (revokes access); the Auth user itself must be deleted in the console.
- **New school bootstrap** (`src/lib/bootstrap.ts`): on sign up creates default config only
  (roles, grading bands, templates, report catalog, 8 setup steps). Everything else starts empty and
  is filled by the 8-step setup wizard, which gates the console until finished.
- Image / file upload is still simulated (Storage not enabled).

## Run
```bash
cd web
cp ../.env.example .env.local   # fill from: firebase apps:sdkconfig WEB 1:845227645501:web:b479eae603082a45c0a854
npm install && npm run dev
```

## Deploy rules
Not deployed yet for the role model. Run `tools/rules_test` first; deploy rules only after the demo school has a `users/{uid}` doc (`tools/seed_demo` writes it).
```bash
firebase deploy --only firestore --project school-admin-tatos-2610
```

## Hosting (live)
https://school-admin-tatos-2610.web.app — Firebase Hosting + a Cloud Functions (gen2, asia-south1) backend that serves the Next.js app.
Teacher app sign-in: email + password, or "Continue with Google". Google works only for the email the admin entered on
the staff record (it signs into that same account); any other Google account is rejected and its new login deleted.
Needs the Google provider enabled in Firebase console > Authentication > Sign-in method. Android also needs the app's
SHA-1 in project settings, and iOS needs the `REVERSED_CLIENT_ID` URL scheme (both come with `flutterfire configure`).

Redeploy after any change:
```bash
firebase deploy --only hosting --project school-admin-tatos-2610   # build + upload (takes ~10 min, mostly Cloud Build)
firebase deploy --only firestore --project school-admin-tatos-2610 # rules only
```
Before a hosting deploy:
- Stop `npm run dev` and delete `web/.next/dev` and `web/.next/cache`. Otherwise the dev build (over 1 GB) is packed into the
  server function and the deploy fails with "An Internal error has occurred".
- If the deploy fails with that same message and `firebase deploy --debug` shows `cloudbilling.googleapis.com … 429 Quota exceeded`,
  the Firebase CLI's shared API quota is used up. Bill the calls to this project instead:
  `GOOGLE_CLOUD_QUOTA_PROJECT=school-admin-tatos-2610 firebase deploy --only hosting --project school-admin-tatos-2610`
`web/.npmrc` (`legacy-peer-deps`) is needed so the Firebase CLI's Next.js helper installs next to firebase@13.

## (Old) free-plan limits — no longer apply now that billing is on
- Cloud Functions, Firebase App Hosting (Next.js server hosting) need Blaze. The app is currently run locally
  (or host the Next app on Vercel's free tier and keep Firebase as the backend).
- Identity Platform extras (MFA, blocking functions).

## Known limits
- One login = one school; an email belongs to exactly one school (Firebase Auth emails are global).
- The admissions "public form" lives inside the admin app; applicants cannot submit anonymously yet.
- SMS / WhatsApp / payment gateway / PDF export are simulated, as before.

## Client demo account
Email `demo@greenfield.edu` (password given separately). It holds the full demo dataset (~4,900 docs: students, staff,
admissions pipeline, fees, exams, communication, settings) with setup already complete.
Reset it to pristine demo data any time:
```bash
cd web && node ../tools/demo_fixture/build.mjs   # regenerates the shared demo fixture (also writes the teacher app's demo_fixture.g.dart)
npx tsc src/server/seed/index.ts --outDir /tmp/seedjs --module commonjs --target es2020 --skipLibCheck --resolveJsonModule --esModuleInterop
DEMO_EMAIL=demo@greenfield.edu DEMO_PASSWORD='<password>' node ../tools/seed_demo/seed-demo.mjs
```

## Test every notification
Fires each push / admin-alert case once against the demo school (teacher `stf_025`), then restores the data:
```bash
node tools/notify_test/notify-test.mjs                 # all 13 cases, 6 s apart
node tools/notify_test/notify-test.mjs --only 9,10,11  # just some cases
node tools/notify_test/notify-test.mjs --keep          # leave the test data; undo later with --restore
```
Put the teacher app in the background first: with the app open, pushes show as an in-app banner instead of the tray.

