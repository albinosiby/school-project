# End-to-end verification report (3–4 November 2026)

Scope: admin web, teacher app, parent app and driver app on the shared Firestore, checked feature by feature, across
apps, and live on a phone (moto g60, Android 12, USB). Everything ran against the **local Firebase emulators**
(project `demo-school-e2e`); nothing was written to the live project and nothing was deployed.

Repeat everything with one command (emulators running, phone optional):

```sh
website/tools/e2e/start_emulators.sh          # terminal 1 (needs firebase-tools on PATH)
website/tools/e2e/run_all.sh <device-id>      # terminal 2; omit the device id to skip the phone chain
```

## Results

| Check | Result |
|---|---|
| Firestore rules (`tools/rules_test`) | 357 / 357 |
| Cross-app sync suite (`tools/e2e/sync_test.mjs`, real rules, 5 signed-in roles) | 103 / 103 |
| Scheduled notices (`tools/e2e/scheduled_test.mjs`) | 7 / 7 |
| Admin web unit + form tests (vitest), `tsc`, lint | 770 / 770, clean |
| Teacher app analyze + tests | clean, 311 / 311 (was 184) |
| Parent app analyze + tests | clean, 469 / 469 (was 168) |
| Driver app analyze + tests (incl. 93-route layout sweep) | clean, 123 / 123 |
| Phone chain: driver → parent → teacher → parent | 4 / 4 stages pass from a fresh seed |

### What the cross-app suite covers
Each flow writes as the owning app and reads as the receiving app, so the rules are exercised on both sides, and
waits for the Cloud Functions side effects (projections and in-app notification rows):

- Parent login linking (admin) → parent's children and classes (function).
- Notices (admin) → parent visibility and alert, teacher alert, driver read, parent acknowledgement count.
- Attendance (teacher) → parent month view and absence alert; correction back to present.
- Homework set and graded (teacher) → parent copy and both alerts.
- Student leave (parent) → teacher alert → decision → parent status and alert.
- Messages both ways with unread counters and alerts; admin oversight.
- Results publish (admin) after teacher marks; locked paper refuses teacher edits.
- Fees: invoice → parent bank-transfer claim → admin verification batch → receipt alert.
- Meetings: admin slot → parent booking → slot booked → teacher alert → minutes shared.
- Certificates: parent request → office issue → parent alert.
- Staff leave and regularization: teacher → admin bell → decision → teacher alert; withdrawal removes the approval row.
- Substitution and exam duty: admin → teacher alert → accept.
- Live class: teacher → parent alert, admin bell, join tap.
- Calendar and consent: admin event → parents; parent consent → admin + audit log.
- Transport: admin bus data → parent bus view and driver roster; driver trip start, both crew marking at once,
  end of trip → parent projection and "boarded / got off at school / not at the bus stop" alerts; crew check-in and
  leave → admin; admin changes (driver phone, stop, taking a child off the bus, route name) → parent and driver.

### What the phone chain covers (real UI on the device, landscape)
1. **Driver:** sign in, pre-trip checklist gate, start trip, mark Aarav boarded and Meera absent, end trip, check in, apply leave, edit profile.
2. **Parent:** sign in, consent sheet, bus card, Track Live with both crew, transport alerts, student transport details, apply leave.
3. **Teacher:** sign in, approve that leave, mark Aarav absent.
4. **Parent again:** the approval on the leave history, and the "Leave approved" and absence alerts.

## Built or fixed tonight

**Backend**
- Parent bus view `par_transport` (contract 14.9), five triggers, rule and checks.
- Scheduled circulars published every 5 minutes (contract 15).
- Withdrawn teacher requests leave the admin approvals queue.
- Transport alerts per guardian login; a pickup's "got off" alert says school.

**Parent app**
- Real bus data on Home, Track Live and the student profile, with Call buttons.
- Consent at first sign-in, changeable in Settings > Privacy (the admin's "Consent pending" now clears).
- Family updates live; section notices show; cheque and cash receipts are labelled correctly.
- Stricter form validation; the leave history no longer breaks in landscape or under the keyboard.

**Teacher app**
- Several writes that the rules silently rejected now go through: profile, substitution checklist, homework and live-class delete, leave withdraw, "clarify".
- Previously empty screens are filled on Firestore.
- Marks on locked papers are refused; long forms validate fields scrolled out of view.

**Admin web**
- Writes match the contract and what the apps read: enrolment ids and classes, transport fields kept on student edit, office-recorded leave, attendance rule, exam marks, atomic fee verification and bus edits.
- Validation with exact messages on every form.

**Driver app**
- Landscape layouts (welcome, navigation rail, quick actions); reset-screen crash; roster in route order; bundled font.

## Open items (decisions or access needed)

- **Real push notifications** were not tested: the emulators cannot send FCM. In-app notification rows and the
  functions that send pushes were verified. A live push test needs your go-ahead on the real project.
- **Android package names** (4 Nov): teacher `tatos.tech.teacher_app`, driver `tatos.tech.school.driver_app`, both registered in
  Firebase. The old `com.greenfield.teacher_app` and `com.tatos.school.driver_app` registrations were removed.
- **Deployed 4 Nov 2026** to `school-admin-tatos-2610`: Firestore rules, indexes and the `notify` functions codebase
  (45 functions, 10 new, 0 failed; the admin web's hosting server was not touched). Live students already on a bus
  get their parent bus view after a one-off `node tools/transport_backfill/backfill.mjs --dry` then without `--dry`
  (it only touches each bus doc; the deployed trigger does the rest). It was not run: reading live data was blocked.
- **Fonts:** parent and teacher apps download Inter at first launch; a phone with no data shows the fallback font
  until it can download. The driver app bundles its font. Bundling Inter is a small follow-up.
- **No screens yet** (contract has the data, no app screen):
  - parent withdraws a pending certificate request or fee claim;
  - parent calendar;
  - teacher view of their own PTM bookings.
- **Rules gaps reported by the teacher-app pass:**
  - teachers cannot write certificates, attendance notices, online tests, behaviour logs or documents to shared collections, so those stay private;
  - a teacher cannot update an `ops_attendance` record another teacher created.
- **Admin web:** the Next 16 dev overlay warns about "instant navigation" on Dashboard and Transport (dev only). The
  public admissions form still needs an unauthenticated route; some client-generated ids (receipts, staff) can
  race between two admins.
- **Emulator quirk:** killing an app that holds Firestore listeners makes the emulator refuse writes for a while.
  The scripts now stop all apps and wait, and the seed waits until the emulator accepts writes.
