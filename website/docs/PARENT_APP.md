# Parent app: going live

How the parent app connects to the shared Firebase backend (data contract §13) and what a school has to do.

## Give a parent access (admin web)
1. Students → open the student → **Parent login** → enter the guardian's email → **Create & invite**.
   - A login is created and a "set your password" email is sent. The same email on a sibling links the same login.
   - Within a minute a Cloud Function fills the login's children (`users/{uid}.studentIds / classIds / grns`).
2. The parent installs the app, taps **Sign in**, and uses that email and the password they set.
   (Mobile passcodes and Google/Apple sign-in are not set up yet; the app says so.)
3. The Students list shows each student's parent-app state: *No parent login*, *Consent pending*, *Consent given*.

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
| Notification centre + push | `par_notifications` + FCM for absences, homework, results, notices, leave, messages, live classes, fees |

Not available yet (the app shows a clear message instead of demo data): bus tracking, conduct records,
meeting booking, certificate requests, online payment, self-registration, editing contact details.

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
`website/tools/e2e/`: `start_emulators.sh` (auth, firestore, functions on a demo project), `seed.mjs` (a small school,
an admin, a teacher and a parent login; passwords in the git-ignored `.accounts.json`), `act.mjs <step>` (plays the admin
and teacher side: link, attendance, homework, grade, publish, reply, decide, live, payment, notice, show). Build the app
with `--dart-define=BACKEND=firebase --dart-define=EMULATOR=true` to point it at the emulators.
