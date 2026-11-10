# Parent app: going live

How the parent app connects to the shared Firebase backend (data contract §13) and what a school has to do.

## Give a parent access (admin web)
1. In **Admissions**, enable **Parent app access**, enter the parent’s login email, and save the admission to enable access and generate a six-digit password for a new account. For an existing student, open **Student Details → Parent app access**.
2. Copy the password and share it with the parent. In **Student Details → Parent app access**, a school admin can use **Show password** and **Copy password** under the parent username. A password issued before this feature needs a one-time replacement before it can be viewed there. It remains valid until the school replaces it.
3. Use the same email for siblings. Use **Replace parent password** when a parent needs a new one. This revokes access for older sessions across all linked siblings. The school can unlink a student without removing a sibling’s access.

Existing accounts with Firebase email/password credentials keep their student links and consent when a school admin generates their first school-managed password. Issue those passwords before asking existing parents to move to the updated app. Managed sign-in uses `signInParent` and Firebase custom tokens. Deploy the callable functions, Firestore rules, Storage rules, and updated parent notification functions before enabling the dashboard flow. The `signInParent` runtime service account needs permission to sign Firebase custom tokens.

Before deploying `setParentAppAccess` and `revealParentPassword`, provision a 32-byte random key encoded as 64 hex characters in the `PARENT_PASSWORD_ENCRYPTION_KEY` Firebase secret. Preserve this key across deploys. Replacing it without re-encrypting the stored passwords requires schools to issue replacements before those passwords can be viewed again. Successful reveals are recorded in Cloud Logging with actor, school, student, and parent IDs. Sign-in still verifies the password hash.

## What syncs
| Parent sees | Comes from |
|---|---|
| Attendance (per day) | teacher app attendance → `par_attendance` (function) |
| Homework, review and marks | teacher app homework → `par_homework` (function) |
| Exam results | only after the admin publishes the class → `par_results` (function) |
| Timetable, live classes (+ Join) | `ops_periods`, `live_classes` |
| Fees, receipts | admin fee counter (`fee_invoices`, `fee_payments`) |
| Notices (+ Acknowledge) | admin notices to parents / all school (`parentVisible`) |
| Messages | both ways with the class and subject teachers (`msg_threads`, `msg_messages`) |
| Leave requests | parent applies → class teacher decides in the teacher app (admin can too) |
| Parent-teacher meetings | office publishes slots (Students > Meetings) → parent books, reschedules, cancels; Meet link and notes from the office (`ptm_slots`, `ptm_bookings`) |
| Certificates | parent requests → office issues and uploads the signed file (Students > Certificates) → parent downloads (`certificates`, Cloud Storage) |
| Fee payments | parent pays into the school account (Fees > Payment verification > account) and reports the UTR → office verifies → receipt (`fee_claims`) |
| Notification centre + push | `par_notifications` + FCM for absences, homework, results, notices, leave, messages, live classes, fees (invoice, receipt, reminders, due dates), meetings, certificates |

Not available yet (the app shows a clear message instead of demo data): bus tracking, conduct records,
online card/gateway payment, self-registration, editing contact details.

## Build
```
cd "mobile app/parent"
flutter build apk --dart-define=BACKEND=firebase
```
Without `BACKEND=firebase` the app runs on demo data (for design reviews and tests).
The Android app is registered in Firebase as "Parent App (Android)", package `tech.tatos.parent_app`.
iOS still needs its Firebase app and `GoogleService-Info.plist`.

## Existing data
Records created before the parent functions were deployed are copied for parents with
`node website/tools/parent_backfill/backfill.mjs` (already run once on 27 Oct 2026).

## Testing without touching the live project
From `website`, generate a local-only key in `functions/.secret.local` and run the login and sibling access check:

```sh
# Create the file only if absent. If present, add PARENT_PASSWORD_ENCRYPTION_KEY to it separately.
(umask 077; set -C; printf 'PARENT_PASSWORD_ENCRYPTION_KEY=%s\n' "$(openssl rand -hex 32)" > functions/.secret.local)
tools/emulator_exec.sh auth,firestore,functions,storage "node tools/parent_flow_test/email-login.mjs"
```

`website/tools/e2e/`: `start_emulators.sh` (auth, firestore, functions on a demo project), `seed.mjs` (a small school,
an admin, a teacher and a parent login; passwords in the git-ignored `.accounts.json`), `act.mjs <step>` (plays the admin
and teacher side: link, attendance, homework, grade, publish, reply, decide, live, payment, notice, show). Build the app
with `--dart-define=BACKEND=firebase --dart-define=EMULATOR=true` to point it at the emulators; on a physical phone add
`--dart-define=EMULATOR_HOST=<computer's Wi-Fi IP>` (FlutterFire maps localhost to the Android emulator's 10.0.2.2) and
relay the emulator ports to that address. The admin web runs against the same emulators with `NEXT_PUBLIC_EMULATOR=true npm run dev`.
