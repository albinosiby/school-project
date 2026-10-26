# End-to-end plan: Admin Web + Teacher App + Parent App on one database

Status: PLAN (nothing in this file is built yet). Written 2026-10-24 from the current code.

## 1. Where we are today (verified in code)

| Piece | State |
|---|---|
| Admin web (`web`) | Complete UI, live on Firestore. Data at `schools/{adminUid}/{collection}/{id}` (~45 collections: `students`, `staff`, `ops_periods`, `ops_homework`, `ops_attendance`, `exm_*`, `fee_*`, `com_notices`, `calendar_events`, `approvals`, `set_*` …). One login = one school. |
| Firestore rules | `schools/{uid}/**` readable/writable only when `request.auth.uid == uid` — i.e. only the admin. **A teacher or parent account cannot read anything today.** |
| Teacher app (`mobile app/teacher`) | 64 screens, 97 passing tests, but runs 100% on a local JSON DB (`LocalDatabaseService` over SharedPreferences) seeded from `*_seed.dart`. 45 collections with their own prefixes/schemas (`tt_`, `tk_`, `cl_`, `att_`, `lm_`, `lv_`, `pm_`, `ed_`, `cr_`, `ls_`, `ts_`, `ms_`, `hm_`). |
| Teacher app Firebase | Packages in pubspec, three thin service wrappers, `AppConfig.backend` toggle — but no `firebase_options.dart`, no Firebase repositories, **no login screen**, nothing uses Firestore. |
| Google Meet | `LiveSession.link` field exists and the schedule form collects it, but the "Join Now" button only opens a **simulated** in-app screen. `url_launcher` is a dependency and unused. |
| Parent app | Does not exist. |

## 2. The core problem: three apps, three schemas

The admin web and the teacher app were built independently. The same real-world fact is stored differently:

| Concept | Admin web | Teacher app |
|---|---|---|
| Timetable period | `ops_periods {grade:"10", section:"A", day:"Mon", period:3, teacher:"Mrs. Kabir Nair"}` | `tt_periods {classId:"c_10b", day:1, slot:"P3", kind, room}` |
| Teacher identity | free-text name string | `me`/`hm_profile` single local record |
| Homework | `ops_homework {teacher:name, submitted, total}` | `tk_homework` with per-student submissions/grades |
| Attendance | `ops_attendance` (empty) | `att_records` per class/date/student |
| Marks | `exm_marks` | `att_marks` with section breakdown |

Joining these by teacher **name** or free-text class labels will break. The first deliverable is a **shared data contract** (section 4) that all three apps follow. Everything else depends on it.

## 3. Architecture decisions (need your answer — see section 9)

1. **Tenancy.** Keep `schools/{schoolId}/…` but decouple `schoolId` from the admin's uid. Add `users/{uid} = {schoolId, role: admin|teacher|parent, staffId?, studentIds?[]}`. Rules look up this doc.
2. **Accounts.** Admin creates teacher and parent accounts. On the free Spark plan the client SDK can only create users by signing in as them (workaround: a second Firebase app instance in the admin web). **Recommended: Blaze plan** (pay-as-you-go, effectively free at school scale) so Cloud Functions can create accounts, set roles, send push notifications and run nightly jobs.
3. **Rules by role.**
   - admin: full access in own school.
   - teacher: read school config/students/timetable for assigned classes; write only their own attendance/marks/homework/messages etc.
   - parent: read only their own children's data (attendance, homework, marks, fees, notices, live classes of the child's class); write only leave requests, PTM bookings, message replies.
4. **Backend toggle stays.** Keep `LocalXRepository` (tests/offline demo) and add `FirebaseXRepository` behind the same `I<Feature>Repository` interfaces — BLoCs and screens do not change. All reads follow the stale-while-revalidate convention (cache first, then refresh) using Firestore's offline persistence plus the cache service.
5. **Monorepo packages.** Extract `design_system`, `core`, models and the repository interfaces shared by teacher and parent into `packages/school_core` so the parent app is not a copy-paste.

## 4. Shared data contract (Phase 0 deliverable)

Create `docs/DATA_CONTRACT.md` and a typed schema (TS types for web, Dart models for apps). Rules:

- IDs are stable document ids (`stf_001`, `stu_001`, `cls_10B`), never names.
- Class = `classes/{cls_10B} {grade, section, classTeacherId, roomId, studentCount}`.
- Teaching assignment = `assignments/{id} {classId, subject, teacherId}` (admin web screen: "Assign teachers").
- Timetable = `timetable/{id} {classId, day(1-6), slot(P1-P8), subject, teacherId, room}`; the admin's `ops_periods` and the teacher's `tt_periods` both become this one collection.
- Every record carries `schoolId`, `createdBy`, `updatedAt` (server timestamp), `deleted` (soft delete).
- Students: `students/{id}` gains `classId`, `guardianIds[]`; `guardians/{id} {name, phone, email, studentIds[], authUid}`.

Map each current teacher collection to a contract collection (table in section 5). Where admin and teacher both have one, **merge into one**.

## 5. Module-by-module wiring matrix

Every teacher-app module, who writes, who must read it, and what the admin web / parent app needs. "Gap" = missing today.

| Module (teacher app) | Collection(s) today | Contract collection | Written by | Read by | Admin web gap | Parent app |
|---|---|---|---|---|---|---|
| Timetable + substitutions | `tt_periods`, `tt_subs` | `timetable`, `substitutions` | admin | teacher, parent | merge `ops_periods`; substitution assignment UI | child's timetable |
| Attendance (mark, trends, history) | `att_records`, `att_periods`, `att_regs` | `attendance` (per student/date/period) | teacher | admin dashboard, parent | real `ops_attendance` view | daily status + absence alert |
| Staff self-log / regularization | `att_faculty`, `att_sched`, `att_staff` | `staffAttendance` | teacher | admin (approve regularization) | approvals queue | – |
| Marks entry | `att_marks`, `att_exams` | `exm_marks`, `exm_papers` | teacher | admin, parent | marks entry window / lock | report card, results |
| Homework + grading | `tk_homework` | `homework`, `submissions` | teacher | admin, parent | merge `ops_homework` | assigned/due, grades |
| Syllabus pacing, lesson plans | `tk_syllabus*`, `ls_plans`, `cl_pacing` | `syllabus`, `lessonPlans` | teacher | admin (review) | HOD review screen | optional |
| Duties, tasks, reminders | `tk_duties`, `tk_tasks`, `hm_reminders`, `hm_pending` | `duties`, `tasks` | admin or teacher | teacher | duty roster UI | – |
| Behaviour log | `cl_behaviour`, `cl_badges` | `behaviour` | teacher | admin, parent | overview | merits/flags |
| Documents + requests | `cl_documents`, `cl_doc_requests` | `documents`, `docRequests` | parent/teacher | admin, teacher | request inbox | request + download |
| Shared resources | `cl_resources` | `resources` (Storage) | teacher | students/parents | – | download |
| Leave (staff) | `lm_my`, `lm_balance`, `att_leaves`, `att_quota` | `staffLeaves`, `leaveBalances` | teacher | admin (approve) | uses existing `approvals` | – |
| Leave (student) | `lm_student`, `att_slips`, `att_medical` | `studentLeaves` | **parent** | teacher (approve), admin | – | apply + status |
| Circulars / notices | `att_circulars`, `att_notices` | `com_notices` (existing) | admin | teacher, parent | existing | inbox + ack |
| Messages | `ms_messages`, `ms_contacts`, `ms_drafts` | `threads/{id}/messages` | teacher, parent, admin | participants | optional | chat with teacher |
| Live classes | `lv_sessions` | `liveClasses` | teacher | parent/student, admin | oversight list | **Join via Meet** |
| Parent-teacher meetings | `pm_meetings` + participants/waiting/chat | `meetings`, `meetingSlots`, `bookings` | teacher | parent (book), admin | schedule overview | slot booking, join |
| Exam duties + hall seating | `ed_duties`, `ed_candidates` | `examDuties` (from `exm_papers`/seating) | admin | teacher | invigilation allocation UI | – |
| Online tests | `ts_tests` | `tests`, `testAttempts` | teacher | student/parent | – | take/see result |
| Certificates | `cr_certs`, `cr_templates`, `cr_mine` | `certificates` | teacher requests, admin signs | admin, parent | signing queue | download |
| Notifications | `hm_*`, local | `notifications/{uid}` + FCM | system | each user | – | push |
| Calendar | – | `calendar_events` (existing) | admin | all | existing | child calendar |
| Profile, ID, settings | `hm_profile`, `cl_prefs` | `staff` + `users/{uid}` prefs | admin / self | self | staff edit | – |

## 6. Google Meet join flow (first vertical slice)

**What the user asked:** teacher schedules an online class with a Google Meet link; when someone taps *Join*, they are redirected to that Meet link.

1. **Data.** `liveClasses/{id} {title, classId, subject, teacherId, date, time, mins, medium:'Google Meet', link, status}` — the existing `LiveSession` model already carries all of this.
2. **Validation.** On save, require `medium == 'Google Meet'` ⇒ link must match `https://meet.google.com/xxx-xxxx-xxx` (or `meet.google.com/lookup/…`). Reject anything else with an inline error. Normalise to https.
3. **Join.** Replace the simulated join with `launchUrl(Uri.parse(link), mode: LaunchMode.externalApplication)` (opens the Meet app, or the browser if absent). If launching fails: show the link with a copy button. Android 11+ needs `<queries>` for `https` VIEW intents (already has a `<queries>` block — extend it); iOS needs `LSApplicationQueries` for `googlemeet`.
4. **Time rules.** *Join* is enabled from 10 minutes before start until `start + mins`; before that it shows "Starts in …", after that "Ended". Status is derived from the clock, not from a stale `status` field.
5. **Join tracking.** On tap, write `liveClasses/{id}/joins/{uid}` (`joinedAt`). Teacher sees "N joined"; this feeds optional attendance. Google does not report real Meet attendance without Workspace + Meet API, so this is *"opened the link"*, not proof of presence — the UI should say so.
6. **Link creation, two options (your call):**
   - **A (ship now):** teacher creates the meeting in Google Meet/Calendar and pastes the link. Zero infrastructure.
   - **B (later):** "Generate Meet link" button using Google Sign-In + Google Calendar API `events.insert` with `conferenceData.createRequest` — creates a real, scheduled Meet automatically, with invitees. Needs a Google Cloud OAuth consent screen and the `calendar.events` scope.
7. **Who sees it.** Parents/students of `classId` get a push notification when scheduled and 15 minutes before start; they see it in the parent app's *Live classes* and tap Join the same way.

## 7. Phases, deliverables and exit criteria

Sizes are relative effort (S ≈ days, M ≈ 1–2 weeks, L ≈ 3+ weeks), assuming one developer; they are estimates, not commitments.

**Phase 0 — Decisions and contract (S).** Answer section 9. Write `DATA_CONTRACT.md`, collection map, role matrix. *Exit:* all three apps' owners sign off the schema; no collection is "TBD".

**Phase 1 — Foundation (M).**
- Admin web: staff-account creation, role assignment, teacher↔class assignment screen, class master; write `users/{uid}`.
- Firestore rules by role + rules unit tests (emulator). Indexes.
- Teacher app: real `firebase_options.dart` (flutterfire), **login / forgot-password / first-run flow**, role gate, session handling, secure token storage.
- *Exit:* admin creates a teacher; teacher logs in on the phone; rules tests prove a teacher cannot read another school or an unassigned class.

**Phase 2 — Teacher data layer (L).**
- Generic `FirestoreCollectionRepository` helper (stream + SWR cache + optimistic writes + offline), then one `Firebase<X>Repository` per interface. Local repos stay for tests.
- Migrate in waves; each wave ends with its tests green on both backends:
  1. Profile, timetable, notifications, circulars (read-mostly)
  2. Live classes + Meet join (section 6) — **first visible win**
  3. Attendance, students, behaviour
  4. Homework, marks, syllabus, lesson plans, online tests
  5. Leave (staff + student), approvals
  6. Messages, meetings
  7. Exam duties, certificates, documents, resources (Storage)
- Remove production reliance on seed data; keep a `tools/seed_demo` path for the demo school.
- *Exit:* with `BACKEND=firebase`, every screen reads/writes live data; airplane-mode shows cached data; no screen touches the local DB.

**Phase 3 — Admin web fills the gaps (M).** Screens/fields that teachers' data needs: assignment management, substitution assignment, duty roster, exam-duty allocation, live-class oversight, marks-window lock, regularization/leave approvals tied to real staff ids, student-leave overview. Merge `ops_*` collections into the contract collections (one-time migration script + backfill).

**Phase 4 — Notifications and automation (M, needs Blaze).** FCM push, Cloud Functions: create user + claims, notify on notice/homework/absence/live-class, 15-min live-class reminder, nightly attendance summary, leave-balance accrual, parent-student linking. Per-user notification preferences honour the app's Settings screen.

**Phase 5 — Parent app (L).** New Flutter app on `school_core`: login (guardian invited by phone/email), child switcher, today view, attendance, homework, marks/report card, fees (read + pay-link), timetable, calendar, notices (ack), live classes (Join), PTM slot booking, leave application, chat with teacher, documents, notifications. Rules already isolate children by `studentIds`.

**Phase 6 — Hardening and release (M).** Full E2E suite, security review of rules, performance (indexes, pagination for 4,000+ student docs), accessibility, crash reporting (Crashlytics), analytics, store builds, backup schedule (`firestore_create_backup_schedule`), runbook.

## 8. End-to-end scenarios (the acceptance checklist)

Each must pass on real devices against the emulator and then staging. Nothing ships until all pass.

1. Admin adds a teacher + assigns Class 10-B Maths → teacher logs in → sees that timetable and roster only.
2. Teacher marks attendance (one absent) → parent app shows absent within seconds and gets a push → admin dashboard attendance % updates.
3. Teacher schedules a Google Meet class → parent of 10-B gets a push → *Join* is disabled until 10 min before → tapping it opens the Meet link → join count increments on the teacher's screen.
4. Teacher assigns homework → parent sees it → (student/parent submits) → teacher grades → parent sees grade.
5. Teacher enters marks → admin locks the window → parent sees the result; teacher can no longer edit.
6. Parent applies student leave → teacher approves → attendance for those days shows "leave", parent notified.
7. Teacher applies for leave → admin approves → substitution assigned → substitute teacher gets the duty + brief.
8. Admin publishes a circular → every teacher and the targeted parents receive and can acknowledge it; admin sees read/ack counts.
9. Parent books a PTM slot → teacher's meeting list updates → both get reminders.
10. Offline: teacher marks attendance with no network → syncs on reconnect without duplicates or lost writes.
11. Security: a parent cannot read another child, another class, or any admin collection; a teacher cannot read unassigned classes or fees.

## 9. Decisions I need from you

1. **Upgrade Firebase to Blaze?** It unlocks accounts-by-admin, push notifications and automation. Without it, plan for the secondary-app workaround and no server-side push.
2. **Meet links: A (paste) now, B (auto-generate via Google Calendar) later — or B from the start?**
3. **One school per deployment, or many schools on one backend?** The path `schools/{schoolId}` supports both, but multi-school adds onboarding and billing work.
4. **Who joins live classes** — only parents, or students with their own logins?
5. **Parent login method** — email + password, or phone OTP (needs Blaze and SMS cost)?
6. **Real data migration** — is there existing production data, or can we start clean from the demo school?

## 10. Risks

- **Schema divergence** is the biggest risk; Phase 0 exists to remove it. Merging `ops_*` and `tt_*` changes the admin web too.
- **Meet attendance can't be verified** without Workspace; we can only record link opens.
- **Spark-plan limits** block server logic; see decision 1.
- **Rules complexity** (role + class + child scoping) is easy to get wrong; require emulator rule tests in CI.
- **Offline conflicts**: attendance and marks are edited by one owner each, so last-write-wins with `updatedAt` is enough; messages are append-only.
- **Scale**: queries must be class/date-scoped with composite indexes; never stream a whole collection to a phone.
- **Privacy**: minors' data — least-privilege rules, audit trail (`set_audit` exists), delete/export on request.
