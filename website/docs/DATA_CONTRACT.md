# Data contract: Admin Web ↔ Teacher App ↔ Parent App

Single source of truth for how the three apps share one Firestore. If an app and this file disagree, fix the app.
Demo tenant: **Greenfield International School**, AY 2026-27, Term 2.

## 1. Tenancy and accounts

- Every school's data lives at `schools/{schoolId}/{collection}/{id}`. `schoolId` is an opaque id (for the existing demo school it equals the admin's auth uid; new schools may use any id). Multiple schools share one backend.
- `users/{authUid}` maps a login to a school: `{schoolId, role: "admin"|"teacher"|"parent", staffId?, studentIds?: string[], email, name, createdAt}`. Rules and both apps read only this to find the school; no school code is typed.
- Admin signs up → `users/{uid} = {schoolId: uid, role: "admin"}`.
- Admin adds a staff member with a required unique **email** → the admin web creates an Auth account for that email (secondary Firebase app instance, random password), sends a password-reset email so the teacher sets a password, writes `users/{newUid} = {schoolId, role: "teacher", staffId}` and stores `authUid` on the staff doc. Staff login = that email only.
- An email belongs to exactly one school (Firebase Auth emails are global).

## 2. Ids and conventions

- Ids are stable and never names: `stf_001`, `stu_001`, `cls_10B`, `asg_001`, `per_10B_Mon_3`.
- Student ids are zero-padded to 3+ digits (`stu_001`…); roster students are `stu_101` onward.
- Class id = `cls_{grade}{SECTION}` (grade `"10"`, section `"B"` → `cls_10B`). Both `grade` and `section` are strings, as in the admin web.
- Day names `Mon…Sat`; teacher app numbers them 1..6 locally. Period numbers 1..8; teacher app shows `P1..P8`.
- Dates `YYYY-MM-DD`, times `HH:mm`.
- Every doc written by an app carries `updatedAt` (ISO string or server timestamp), `updatedBy` (auth uid). Soft delete with `deleted: true` is allowed; hard delete only by admin.
- A person is referred to by id plus a denormalized display name (`teacher: "Mrs. Anita Sharma"`, `teacherId: "stf_025"`). Id wins; the name is for display and for old views.

## 3. Shared master collections (admin writes, teacher + parent read)

| Collection | Shape (new fields in **bold**) |
|---|---|
| `school` (doc `school`) | `name, short, board, affiliation, city, academicYear, term` (**term** `"Term 2"`) |
| `staff` | `name, empId, department, role, status, phone, **email**, **authUid?**, **designation?**, **subjects?**, **joined?**` |
| `classes` | `id=cls_10B, grade, section, **classTeacherId**, **room**, **wing**, **studentCount?**` |
| `assignments` | `classId, subject, teacherId, **topic?**, **periodsPerWeek?**` (who teaches what to which class) |
| `students` | `name, grn, grade, section, **classId**, **roll** (int), guardian, **guardianId?**, phone, status, attendance` (**`perfGrade?`** is the optional letter grade; the teacher app must not store a letter grade in `grade`) |
| `ops_periods` (the timetable) | `classId, grade, section, day:"Mon", period:1..8, subject, teacher (name), teacherId, room` |
| `ops_substitutions` (new) | `date, day, period, classId, subject, absentTeacherId, substituteTeacherId, status: "Assigned"|"Accepted"|"Declined", topic?, note?` |
| `exm_cycles`, `exm_papers`, `exm_candidates` | existing; `exm_candidates` become one per student of rostered classes: `id=cand_{studentId}, studentId, name, roll, grn, cls("8-A"), grade, section`; `exm_papers` gain `classIds?: string[]`, `invigilatorId?` |
| `com_notices`, `calendar_events` | existing (admin writes). Teacher app reads them for circulars and calendar |
| `approval_policies`, `set_*` | admin only |

## 4. Collections both sides write (shared records)

These are one collection read by both apps. The teacher app's local collection name is on the right.

| Collection | Writer | Teacher-local name | Shape |
|---|---|---|---|
| `ops_attendance` | teacher | `att_records` | id `{date}_{classId}_{period}`; `date, classId, grade, section, period, total, marks:{studentId:"A"|"L"|"E"}` (only non-present listed; absent key = present), `submitted, teacherId, updatedAt`. Admin views must derive P/A/L counts from `total` and `marks`. |
| `ops_homework` | teacher | `tk_homework` | teacher shape (`classId, title, subject, due, maxMarks, description, status, createdAt, submissions:{studentId:{status,marks,feedback,gradedAt}}`) **plus denormalized**: `teacherId, teacher, grade, section, assigned, submitted (count), total (count)` so existing admin lists keep working |
| `exm_marks` | teacher | `att_marks` | existing admin shape `paperId, candId, theory, internal, medical, verified`, plus `studentId, teacherId, enteredAt`; admin may set `locked` on the cycle/paper |
| `staff_leaves` (new) | teacher | `lm_my` | `staffId, type, from, to, days, reason, status:"Pending"|"Approved"|"Rejected", decidedBy?, decidedAt?` and a mirrored `approvals` row so the admin approvals queue shows it |
| `student_leaves` (new) | parent (later); teacher decides | `lm_student`, `att_slips` | `studentId, classId, from, to, reason, status, decisionNote?` |
| `live_classes` (new) | teacher | `lv_sessions` | `title, classId, subject, teacherId, date, time, mins, medium:"Google Meet", link, status, createdAt` plus `live_classes/{id}/joins/{authUid} = {joinedAt}` |

## 5. Teacher-private collections

Everything else in the teacher app (`tt_*` extras, `tk_*` tasks/duties/syllabus, `cl_*`, `ls_*`, `ts_*`, `hm_*`, `ms_*`, `pm_*`, `ed_*`, `cr_*`, `att_*` leftovers) is stored under the same school with the same name and a `teacherId` field. Admin does not need them yet; rules still scope them to the owning teacher. They move to shared collections when an admin or parent screen needs them (messages, meetings, certificates are next).

## 6. Live classes (Google Meet)

- Two ways to get the link, both validated (`https://meet.google.com/xxx-xxxx-xxx` or `meet.google.com/lookup/…`):
  1. **Create Google Meet** in the schedule form (built, **switched off** until the Google OAuth consent screen is set up;
     teacher app build flag `--dart-define=GOOGLE_MEET=true`): the teacher connects their own Google account (any Google account, separate
     from the app login) and the app calls the **Google Meet REST API** `spaces.create` with `accessType: OPEN`, so students and
     parents join without being admitted. Stored as `meetSpace: "spaces/…"` next to `link`.
  2. Paste a link the teacher made in Google Meet.
- **Google Calendar**: when "Add to my Google Calendar" is on (`calendarSync: true`), scheduling a Google Meet class inserts an
  event on the teacher's primary calendar (Calendar API `events.insert`, India time, 10-minute popup reminder, Meet link in
  location and description) and stores `calendarEventId` / `calendarLink`. Editing the class patches the event; cancelling it
  deletes the event. Drafts do not touch the calendar. A calendar failure never blocks saving the class.
- OAuth scopes requested (incremental, only when the teacher taps the button): `meetings.space.created`, `calendar.events`.
- Teacher can share the link to WhatsApp; parents/students tap Join.
- Join opens the link externally (`url_launcher`, `LaunchMode.externalApplication`); if it fails, show the link with a copy action.
- Join is enabled from 10 min before start until `start + mins`; status is derived from the clock.
- Tapping Join writes `live_classes/{id}/joins/{authUid}`. This records link opens, not proof of presence.
- Admin web has a read-only **Live classes** list (filter by class, teacher, date).

## 7. Firestore rules by role

- `users/{uid}`: a user reads their own doc; only admin of the same school (or server) writes it.
- `schools/{sid}/**` is accessible only when `users/{request.auth.uid}.schoolId == sid`.
- admin: read/write everything in the school.
- teacher: read master collections; write shared records (§4) only when `teacherId == their staffId`; write teacher-private docs only when `teacherId == their staffId`; no access to `fee_*`, `adm_*`, `set_*`, `exm_cycles` writes, other teachers' private docs.
- parent (later): read only their children's docs.

## 8. Demo fixture

`website/tools/demo_fixture/` generates one JSON fixture (classes, staff additions, students, assignments, periods, substitutions, papers/candidates). The admin seed (`website/web/src/server/seed`) and the teacher seed (`mobile app/teacher/lib/**/_seed.dart`) both consume it, so ids and names are identical in both apps.

- Rostered classes: 8-A (38), 8-B (36), 8-C (40), 9-A (38), 10-A (48), 10-B (42).
- Demo teacher login: **Mrs. Anita Sharma, `stf_025`, `anita.sharma@greenfield.edu`**, Mathematics & Science, class teacher of `cls_10B`, teaches 10-B, 10-A (Mathematics), 9-A (Science), 8-C (Physics). Her timetable is the existing teacher-app week.
- Other teachers in the timetable are existing admin staff (`stf_023`, `stf_008`, `stf_003`, `stf_010`, `stf_002`, `stf_006`), each given an email `firstname.lastname@greenfield.edu`.
- Existing admin students who currently sit in a rostered class are moved to another section so rosters are exactly the counts above.

## 9. Conventions fixed by the admin web (clarifications)

- `approvals` mirror of a staff leave: id `lv_{leaveId}`, `kind:"leave"`, `source:"staff_leaves"`, `sourceId:{leaveId}`, `status:"pending"`. Either app may create it; the admin web also backfills missing ones. Deciding the approval updates the leave (`Approved`/`Rejected`, `decidedBy`, `decidedAt`) and vice versa.
- Admin day-level attendance record: id `{date}_{classId}_0`, `period: 0`, `markedBy:"admin"`, `teacherId:""`. Admin views show, per class and date, the record with the newest `updatedAt` (ties: higher period).
- `ops_substitutions` ids: `sub_{date}_{classId}_{period}` when created by the admin web (fixture uses `sub_1..3`). A substitute teacher may change only `status` to `Accepted`/`Declined`.
- `exm_candidates.roll` stays the admin display string (`#8A-01`); the integer roll lives on `students.roll`.
- Sections are `A`-`D`: grade 8 has all of A-C rostered, so displaced grade-8 students go to section D.
- Every write through the admin web adds `updatedAt` (ISO) and `updatedBy` (auth uid).

## 10. Push notifications (FCM)

- **Device tokens.** After login the teacher app asks for notification permission, then stores this device's FCM token at
  `users/{authUid}/fcm_tokens/{token} = {token, app:"teacher", platform, updatedAt}` and refreshes it when FCM rotates it.
  Logout deletes the doc and the token. Only the owner can read/write their tokens; Cloud Functions use admin access.
- **Senders.** Cloud Functions in `website/functions` (codebase `notify`, region asia-south1) react to admin writes:

  | Trigger | Who is notified | Opens |
  |---|---|---|
  | `com_notices` becomes `Published` with a staff/all audience | every teacher of the school | `/circulars` |
  | `ops_substitutions` gets (or changes) `substituteTeacherId` | the substitute | `/timetable` |
  | `staff_leaves.status` → `Approved` / `Rejected` | the teacher who applied | `/leave-management` |
  | `assignments` created | the assigned teacher | `/classes` |
  | `classes.classTeacherId` changes | the new class teacher | `/classes` |
  | `exm_papers.invigilatorId` set or changed (exam duty) | that teacher | `/exam-duties` |
  | `exm_papers.locked` → true (marks window closed) | teachers of that subject in the paper's classes | `/marks` |
  | `exm_papers.published` gains a class ("10-B") | teachers of that subject in that class | `/marks` |
  | `calendar_events` becomes `published` with `notifyApp` | every teacher of the school | `/notifications` |

- **Admin alerts** (no push; the admin web's notification bell, `schools/{sid}/notifications`, `source:"teacher"`):
  a new `staff_leaves` request (`category:"approvals"`, opens `/approvals`) and a new `live_classes` session
  (`category:"ops"`, opens `/live-classes`).
- Exam papers carry `invigilatorId` (picked from staff in the admin cycle form) and `locked`. A published class
  (`published` lists labels like "10-B") or a locked paper is read-only in the teacher app.

- **Every notification is also a row** in `schools/{sid}/hm_notifications` (`teacherId`, `type`, `category`, `tag`, `title`, `body`,
  `route`, `read:false`, `at`, `ord`), which the teacher app shows in its Notifications screen (local name `notifications`).
- Push payload: `notification {title, body}` + `data {route, type}`. The app opens `route` when the notification is tapped and shows a
  snack bar for messages that arrive while it is open. Tokens FCM reports as dead are deleted by the function.
- Teacher-private remote names must carry a private prefix (`hm_`, `tk_`, `lm_`…); the teacher app's `notifications` and `settings`
  are stored as `hm_notifications` and `hm_settings` (the school's own `notifications` collection belongs to the admin).
- **Teacher notification settings** (teacher app > Settings) are stored per teacher at `schools/{sid}/hm_settings/settings_{staffId}`
  and decide only the push (the in-app row is always written): `classUpdates` (circulars, substitutions, leave, classes, exams,
  calendar), `parentMessages` (messages), `dnd` + `dndFrom`/`dndTo` (India time, no push in quiet hours), `parentMute` (no parent
  messages on weekends). Urgent circulars always push. The Settings page also shows whether the phone allows notifications.
- Parent notifications (absence alerts, homework, messages) will use the same token layout with `app:"parent"`.

## 11. Rules confirmed in the admin ↔ teacher end-to-end check (2026-10-26)

- `exm_marks`: the teacher app writes only `theory`, `status`, `tag`, `note`, ids and `teacherId`. `internal`, `medical` and
  `verified` belong to the admin's exam cell and are never sent (writes merge, so they are never overwritten).
- A paper with `locked: true` is read-only for teachers: the teacher app shows it as "Locked" with no edit, and the Firestore
  rules reject `exm_marks` writes for it (`paperOpen`). Publishing a class's results (`published` gains "10-B") also makes
  that class read-only in the app.
- `ops_homework` created in the admin web (status "Published", no per-student data) shows in the teacher app as status
  "open" with a pending submission for every student of the class; the teacher app's writes then fill `submissions` and
  recompute `submitted`/`total`.
- The teacher Home card's "Present Today / Absent" comes from today's latest submitted `ops_attendance` record of the class
  ("Not marked" when there is none), not from the term average.

## 12. Staff check-in, leave policy, exam duties (admin screens for teacher data)

### 12.1 Staff check-in and regularization
- `staff_attendance/{date}_{staffId}`: `{staffId, teacherId, date, in: "HH:mm"|null, out: "HH:mm"|null, status: "Present"|"Late"|"Leave"|"Irregular", note, source: "app"|"admin"}`.
  The teacher app writes its own day (punch in / punch out; local `att_staff`, id = remote id). The admin web reads all and may
  correct a day (`source: "admin"`). Late = check-in after the school's start time (`set_leave_policy/policy.checkInBy`, default "08:15").
- `staff_regularizations/{id}`: `{staffId, teacherId, date, type, time, reason, note, status: "Pending"|"Approved"|"Rejected", at, decidedBy?, decidedAt?, decisionNote?}`.
  Teacher creates (local `att_regs`), can edit only while Pending; admin decides. Approving also fixes that day's
  `staff_attendance` (in/out from `type`/`time`, status Present, `source: "admin"`).
- Notifications: new request → admin bell (`category: "approvals"`, href `/staff?tab=checkins`); decision → teacher push
  (`type: "attendance"`, route `/attendance`).

### 12.2 Leave policy
- `set_leave_policy/policy`: `{types: [{id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12}, …], checkInBy: "08:15"}`. Admin edits it in
  Settings > Leave policy. The teacher app's quotas (`att_quota`, `lm_balance`) use it (built-in defaults only when the doc is missing);
  used = approved/completed `staff_leaves` days of that type. Teachers may read it.

### 12.3 Exam duty allocation
- `exm_duties/{id}`: `{paperId, cycleId, staffId, role: "Chief Invigilator"|"Invigilator"|"Reliever", hall, venue, date, start, end, grade, subject, code,
  classIds: [], candidates: int, status: "upcoming"|"completed", reportBy: "HH:mm", note?, createdAt}`.
  The admin allocates per paper in Exams > Exam duties (the paper's chief invigilator, `exm_papers.invigilatorId`, appears as its
  Chief row). Clash check: one staff member, overlapping time on the same date.
- Teacher app `ed_duties` = the teacher's `exm_duties` (plus papers where they are the paper's `invigilatorId` but have no duty row, as Chief);
  `partner` = the other duty holder of the same paper and hall. The teacher's own working state (swap request, checklist, submitted,
  per-candidate attendance / supplementary sheets / malpractice) is private: overlays `ed_duty_state` and `ed_cand_state` (teacherId).
- Teacher app `ed_candidates` for a duty = `exm_candidates` of the paper's classes, seated in roll order (desk D-01…).
- Notifications: a duty row created or moved to a teacher → push (`type: "exam"`, route `/exam-duties`).
- Rules: teachers read `exm_duties`, `staff_attendance` / `staff_regularizations` of their own staffId, `set_leave_policy`; write their own
  `staff_attendance` and Pending `staff_regularizations`; `ed_duty_state` / `ed_cand_state` are teacher-private (`ed_` prefix).
