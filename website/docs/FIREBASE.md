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
cd school-dash
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
firebase deploy --only hosting:admin --project school-admin-tatos-2610   # admin site: build + upload (~10 min, mostly Cloud Build)
firebase deploy --only hosting:owner --project school-admin-tatos-2610   # owner console site (see below)
firebase deploy --only firestore --project school-admin-tatos-2610       # rules only
```
Before a hosting deploy:
- Stop `npm run dev` and delete `school-dash/.next/dev` and `school-dash/.next/cache`. Otherwise the dev build (over 1 GB) is packed into the
  server function and the deploy fails with "An Internal error has occurred".
- If the deploy fails with that same message and `firebase deploy --debug` shows `cloudbilling.googleapis.com … 429 Quota exceeded`,
  the Firebase CLI's shared API quota is used up. Bill the calls to this project instead:
  `GOOGLE_CLOUD_QUOTA_PROJECT=school-admin-tatos-2610 firebase deploy --only hosting --project school-admin-tatos-2610`
`school-dash/.npmrc` (`legacy-peer-deps`) is needed so the Firebase CLI's Next.js helper installs next to firebase@13.

## Owner console (super admin): its own hosting site
https://edvio-owner.web.app is the platform owner's console (DATA_CONTRACT section 16): a dashboard, every school with its
students, staff and logins, adding a school with its admin login and password, setting any login's password, opening a
school's console, suspend / reactivate / delete, and the demo requests from the landing page. It is an independent Next.js app in `superadmin`, deployed to its own hosting site (`firebase.json` hosting targets `admin` and `owner`, mapped in
`.firebaserc`).

Give a login owner rights (creates the login when needed; the password is read from the environment):
```bash
OWNER_PASSWORD='<password>' node tools/owner/grant-owner.mjs you@company.com
node tools/owner/grant-owner.mjs you@company.com --revoke   # take the rights away again
```
Deploy order: rules and functions first, because the console needs both.
```bash
firebase deploy --only firestore:rules,storage --project school-admin-tatos-2610
firebase deploy --only functions:notify:ownerSetPassword,functions:notify:ownerDeleteSchool --project school-admin-tatos-2610
firebase deploy --only hosting:owner --project school-admin-tatos-2610
```
Locally, run `NEXT_PUBLIC_EMULATOR=true npm run dev:superadmin` and `NEXT_PUBLIC_EMULATOR=true npm run dev`
from `website/`. The owner app uses http://localhost:3002 and admin uses http://localhost:3000. On the emulators, give a login owner rights with
`FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 OWNER_PASSWORD='…' node tools/owner/grant-owner.mjs owner@edvio.test`.

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
cd school-dash && node ../tools/demo_fixture/build.mjs   # regenerates the shared demo fixture (also writes the teacher app's demo_fixture.g.dart)
npx tsc ../shared/src/server/seed/index.ts --outDir /tmp/seedjs --module commonjs --target es2020 --skipLibCheck --resolveJsonModule --esModuleInterop
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


## Parent app backend tests (emulator only)
Rules (`tools/rules_test`, 347 checks incl. parent reads, privacy denials, the parent/teacher message and leave shapes and the transport crew rules) and an
end-to-end test of the parent functions (`tools/parent_flow_test`: seeds a 2-student school, writes attendance, homework, a
published paper, notices, a leave, messages, a live class, fees and a consent, then checks `par_*`, `users/{uid}` arrays, unread
counters, `par_notifications`, `hm_notifications` and `set_audit`). Both use a `demo-*` project id and never reach the live project.
```bash
cd website
(cd functions && npm ci) && (cd tools/rules_test && npm ci)
EMULATOR_PROJECT=demo-school-rules tools/emulator_exec.sh firestore "cd tools/rules_test && node test.mjs"
tools/emulator_exec.sh firestore,functions "node tools/parent_flow_test/test.mjs"
```
`tools/emulator_exec.sh` works around a JDK older than 21 (firebase-tools 14+ refuses it) by using the cached Firestore emulator
jar through a version shim; with JDK 21 it just runs `firebase emulators:exec`. On a busy machine raise `FUNCTIONS_DISCOVERY_TIMEOUT`
(seconds, default 120 in the script) and `WAIT_MS` (per-check wait of the flow test, default 90000).
Deploying the parent backend needs: `firebase deploy --only firestore` (rules + the two `msg_*` composite indexes) and
`firebase deploy --only functions:notify` (17 new functions in `functions/parent.js`).

## Transport backend (DATA_CONTRACT section 14, emulator-tested only)
- **Collections** under `schools/{sid}`: `tr_crew` (drivers / attendants, `busId`), `tr_buses` (stops, `driverId` / `attendantId`), `tr_trips` and
  `tr_attendance` (`{date}_{busId}_{pickup|drop}`), `tr_crew_attendance` (`{date}_{crewId}`), `tr_crew_leaves`, `tr_settings/policy`
  (`checkInBy`). `users/{uid}` gains the roles `driver` / `attendant` with `crewId`; `students` gain `busId` / `bus` / `busStopId` / `busStop`.
- **Rules** (`firestore.rules`, helpers `isCrew` / `myCrewId` / `myBusId`): the crew member's bus is read from `tr_crew/{crewId}.busId`, never
  from the client. Crew read their own bus, the students / trips / attendance of that bus, all crew records, their own check-in days and
  leaves, `tr_settings` and published `com_notices`; they write trips / attendance of their own bus only (id and `busId` / `date` / `kind`
  fixed), their own check-in day, their own Pending leaves (never the decision fields) and the contact fields of their own crew record.
  Teachers and parents cannot read any `tr_*` collection; admin reads and writes everything.
- **Indexes** (`firestore.indexes.json`): `students (busId, roll)`, `tr_trips (busId, date)`, `tr_attendance (busId, date)`,
  `tr_crew_attendance (crewId, date)`, `tr_crew_leaves (crewId, appliedAt)`.
- **Functions** (`functions/transport.js`, wired from `index.js` like `parent.js`): `onTransportAttendanceWritten` pushes the guardians of every
  student whose mark changed to boarded / dropped / absent on today's (India time) record (`par_notifications` row `type: "transport"`, route
  `/home/track`, dedupe id `trp_{tripId}_{studentId}_{status}`); `onCrewLeaveRequested` adds an admin bell row (`category: "approvals"`,
  href `/transport?tab=leaves`). Crew have no push yet, so a decided crew leave triggers nothing.
- **Demo data**: `tools/e2e/seed.mjs` adds `driver@e2e.test` / `attendant@e2e.test` (crew `crw_001` / `crw_002` on `bus_01`, three stops, all
  five students on the bus, `tr_settings/policy`, yesterday's completed pickup trip with its attendance and crew check-in days).
- Deploying needs `firebase deploy --only firestore` (rules + the five new indexes) and `firebase deploy --only functions:notify`.

### Running the Firebase CLI here (31 Oct 2026)
`firebase` is not installed globally; `npx firebase-tools` keeps a copy under `~/.npm/_npx/*/node_modules/.bin/firebase`.
Add that folder to `PATH` before `tools/e2e/start_emulators.sh` or `tools/emulator_exec.sh`.
Android apps registered (4 Nov 2026): parent `tech.tatos.parent_app`, teacher `tatos.tech.teacher_app`, driver
`tatos.tech.school.driver_app`. The older `com.greenfield.teacher_app` and `com.tatos.school.driver_app` entries were removed.

## Separate frontend apps

Public landing is in `landing`, superadmin in `superadmin`, and common source in `shared`.
See `README.md` for independent run/build/deploy commands and cross-app URL settings.
