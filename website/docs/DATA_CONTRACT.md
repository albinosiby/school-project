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

## 13. Parent app (guardian logins, per-child data, two-way flows)

Parents see **only their own children**. Class-wide records (`ops_attendance`, `ops_homework`, `exm_marks`) hold every
student of a class, so parents never read them directly: Cloud Functions copy each child's slice into `par_*` collections
that only that child's guardians can read. Everything a parent writes is either their own request (leave, message,
acknowledgement, consent) or nothing.

### 13.1 Accounts
- `students` gain `guardianEmail?` and `guardianUids: string[]` (auth uids of linked parent logins; siblings share a uid).
- Admin web > Students > student > **Parent login**: enter the guardian email → if a parent login with that email already
  exists in this school it is linked (uid added to `guardianUids`), else the admin web creates the Auth account the same way as
  staff (§1: secondary app, random password, password-reset invite), writes `users/{uid} = {schoolId, role:"parent", email,
  name, studentIds:[], classIds:[], grns:[]}` and links it. Unlink removes the uid.
- Function `onStudentWritten` keeps every linked parent's `users/{uid}.studentIds / classIds / grns` equal to the students
  whose `guardianUids` contain the uid (recomputed from a query, so moves between classes and unlinks are covered). Rules read
  only these arrays. Parents sign in with that email (password set from the invite) or Google with the same email.
- Classes carry `classTeacher` (name) next to `classTeacherId`; the function keeps it in sync so parents never read `staff`.

### 13.2 What a parent reads (all under `schools/{sid}`)
| Data | Source | Parent query |
|---|---|---|
| child profile | `students/{id}` | get by id (`id in studentIds`) |
| class, class teacher | `classes/{classId}` | get by id (`classId in classIds`) |
| school | `school/school` | get |
| timetable | `ops_periods` | `classId == X` (`X in classIds`) |
| live classes | `live_classes` | `classId == X`; join tap writes `live_classes/{id}/joins/{uid}` (§6) |
| attendance | `par_attendance/{studentId}_{YYYY-MM}` (function) | get by id / `studentId == X` |
| homework | `par_homework/{studentId}_{homeworkId}` (function) | `studentId == X` |
| results | `par_results/{studentId}_{paperId}` (function, only after the class is published) | `studentId == X` |
| fees | `fee_invoices`, `fee_payments` | `grn == G` (`G in grns`) |
| notices | `com_notices` with `parentVisible == true` (function sets it: Published and audience mentions parents/all/school) | `parentVisible == true` |
| calendar | `calendar_events` with `parentVisible == true` (function: published events) | `parentVisible == true` |
| leave requests | `student_leaves` | `studentId == X` |
| messages | `msg_threads`, `msg_messages` | `parentUids array-contains uid` |
| in-app notifications | `par_notifications` | `uid == auth.uid` |
| meeting slots / own bookings | `ptm_slots` / `ptm_bookings` (§13.7) | `startMs >= now` / `studentId == X` |
| certificates | `certificates` (§13.7) | `studentId == X` |
| reported fee payments, school account | `fee_claims`, `school/school.bank` (§13.8) | `studentId == X` / get |

Projection shapes (written only by functions):
- `par_attendance/{studentId}_{YYYY-MM}`: `{studentId, classId, month, days: {"YYYY-MM-DD": "P"|"A"|"L"|"E"}, updatedAt}`. A day's
  status is the student's mark in that class's newest record of the day (§9: newest `updatedAt`, ties higher period); no mark = `P`.
- `par_homework/{studentId}_{homeworkId}`: `{studentId, homeworkId, classId, title, subject, description, teacher, teacherId, assigned,
  due, maxMarks, status, attachments?, submission: {status, marks?, feedback?, gradedAt?}, updatedAt}`; removed when the homework is.
- `par_results/{studentId}_{paperId}`: `{studentId, paperId, cycleId, exam (cycle title), subject, code, date, theory, internal,
  theoryMax, internalMax, obtained, max, medical, updatedAt}`; written when `exm_papers.published` gains the child's class label and
  updated if marks change after that.

### 13.3 What a parent writes
- `student_leaves/{id}`: create with `{studentId (in studentIds), classId (the child's class), from, to, reason, status:"Pending",
  parentUid: auth.uid, name}` plus the teacher app's display fields `roll, days, daysLabel ("2 Days"), dateText ("Oct 28 – Oct 29"),
  type ("Personal Leave"|"Medical Leave"), cat ("leave"|"medical"), by ("Mr. X (Father)"), appliedOn`; edit or withdraw (delete) only while Pending. The class teacher decides (teacher app, §4) →
  `status` Approved/Rejected + `decisionNote`.
- Messages: `msg_threads/thr_{studentId}_{staffId}` = `{studentId, classId, studentName, parentUids, guardian, teacherId, teacher,
  role, lastMessage, lastAt, lastFrom:"parent"|"teacher", unreadParent, unreadTeacher}` and `msg_messages/{id}` = `{threadId,
  studentId, teacherId, parentUids, from:"parent"|"teacher", uid, name, text, at}`. Either side creates the thread and adds
  messages; only the function updates `last*` and the unread counters (on message create). Reading resets your own counter.
  The teacher app shows them in Messages (local `ms_messages`), the parent app in Messages.
- `com_notices/{id}/acks/{uid}` = `{at, studentIds}`; the function increments the notice's `acked` / `read`.
- `consents/{uid}` = `{uid, studentIds, version, acceptedAt, items: {dataProcessing, photos, notifications}}`, written at
  first sign-in; the admin web shows each student's consent state.
- `par_notifications/{id}`: parent may only set `read`.
- `users/{uid}/fcm_tokens/{token}` with `app:"parent"` (§10 layout).

### 13.4 Parent notifications (push + `par_notifications` row: `{uid, studentId, type, title, body, route, read, at}`)
| Trigger | Message | Route |
|---|---|---|
| child marked A/L in a submitted `ops_attendance` (once per child per day) | "{name} was marked absent today" | `/academics?section=attendance` |
| homework created for the class / submission graded | "New homework: {title}" / "{title} reviewed" | `/academics/homework/{homeworkId}` |
| class published in `exm_papers.published` | "{exam} results: {subject}" | `/academics` |
| notice becomes parent-visible | notice title | `/notifications` |
| `student_leaves` decided | "Leave approved/rejected" | `/more/leave` |
| teacher message | teacher name + text | `/messages/thread/{threadId}` |
| live class scheduled for the class | title + time | `/more/live` |
| `fee_invoices` created / `fee_payments` created | invoice due / receipt | `/fees` |
Teachers get a push for a new parent message (setting `parentMessages`, §10) and for a new leave request of their class.

### 13.5 Audit
Functions append to `set_audit` (`{at, actor, action, detail, kind}`) when a parent login is linked/unlinked, a consent is
recorded or withdrawn, and a student record is created/deleted, so children's data changes are traceable in Settings > Audit.

### 13.7 Parent-teacher meetings and certificates (2026-10-27)
**Meetings.** The school office publishes bookable time slots per teacher in the admin web (Students > Meetings); parents
book one from the parent app (More > Parent-Teacher Meeting).
- `ptm_slots/{id}` (admin writes; id `pts_{staffId}_{YYYYMMDDHHmm}`): `{teacherId, teacher, start (ISO, UTC), startMs, mins,
  modes: ["In-Person"|"Virtual"], room, link?, booked}`. `booked` is kept by the function from the slot's booking. Every parent
  login of the school may read slots (no student data on them); the app asks for `startMs >= now` and keeps its child's teachers.
- `ptm_bookings/{slotId}` (the slot id is the doc id, so a slot holds one booking): `{slotId, teacherId, teacher, studentId,
  classId, studentName, parentUid, parentName, mode, agenda, start, startMs, mins, room, link, status, bookedAt}` with
  `status` "Scheduled" | "Cancelled" | "Attended" | "Missed"; later `cancelledBy` ("parent"|"school"), `cancelReason`,
  `cancelledAt`, `minutes` (notes shared with the parent), `joinedAt`.
  - Parent create (or re-book a slot whose booking is "Cancelled"): own child, own uid, the child's class, a future slot,
    `teacherId / start / startMs / mins / room / link` equal to the slot's, `mode` in `slot.modes`, `status:"Scheduled"`.
  - Parent update: cancel (`status` "Cancelled", `cancelledBy:"parent"`, `cancelledAt`) while Scheduled, or `joinedAt`.
    Reschedule = cancel the old booking and book the new slot in one batch.
  - Admin: everything (mark Attended / Missed, add `minutes`, set the Meet `link`, cancel with `cancelledBy:"school"`).
  - Function `onPtmBookingWritten`: sets `ptm_slots.booked`; pushes the teacher on a new booking or a parent cancellation
    (route `/notifications`), the child's guardians on a school cancellation and when minutes are shared (route `/more/ptm`).
    `onPtmSlotDeleted` cancels a Scheduled booking of a withdrawn slot (`cancelReason` "The slot was withdrawn").
- **Certificates.** `certificates/{id}`: `{studentId, classId, studentName, grn, type ("bonafide"|"character"|"transfer"|
  "feeReceipt"|"other"), title, category ("bonafide"|"academic"|"sports"), purpose, status ("Requested"|"Issued"|"Rejected"),
  requestedBy, requestedAt, parentUid?}`; on issue `refNo` (`CERT/{year}/{0001}`), `issuedOn` (YYYY-MM-DD), `validTill?`,
  `issuer`, `note?`, `fileUrl?` (link to the signed PDF); on rejection `rejectReason`.
  - Parent create: own child and class, own uid, `status:"Requested"`, no issue fields. Parent update: only `downloadedAt` of an
    Issued one. Parent delete: withdraw while Requested. Parents read `studentId == X`.
  - Admin issues (from a request or directly), rejects, and prints the certificate from the admin web (Students > Certificates).
  - Function `onCertificateWritten`: pushes the child's guardians when a certificate is issued or a request rejected
    (route `/more/certificates`).

### 13.8 Fee payments to the school account (2026-10-27)
There is no payment gateway. Parents pay into the school's bank account (UPI / NEFT / IMPS / RTGS / cheque / cash deposit)
and report it in the parent app; the office checks it against the bank statement in the admin web (Fees > Payment
verification) and only then records the payment.
- `school/school.bank` (admin writes, parents read): `{accountName, accountNo, ifsc, bank, branch, upiId, note}`. The parent
  app's Pay Now shows it; without it Pay Now says to pay at the office.
- `fee_claims/{id}` (parent creates): `{studentId, grn (the child's), studentName, classId, invoiceId, invoiceNo, amount, mode
  ("UPI"|"NEFT / IMPS / RTGS"|"Cheque"|"Cash deposit at bank"), reference (UTR / cheque / slip no., upper case), paidOn
  (YYYY-MM-DD), note, status:"Pending", parentUid, parentName, submittedAt}`. Parents read `studentId == X` and may withdraw
  (delete) their own while Pending; they never write the verification fields.
- Admin **Verify**: creates the `fee_payments` receipt exactly like the fee counter (`mode` "{mode} · {reference}", `by` the
  admin), updates the invoice's `paid` / `balance` / `status`, and sets the claim `{status:"Verified", receiptNo, paymentId,
  verifiedBy, verifiedAt}` (amount may be corrected to what reached the bank). **Reject**: `{status:"Rejected", rejectReason}`.
  The admin web warns when the reference was already used by another claim or payment.
- Pushes: the receipt push of `onFeePaymentCreated` (§13.4) covers a verified claim; `onFeeClaimWritten` tells the guardians
  when a claim is rejected (route `/fees`).

### 13.6 Implementation notes (functions/parent.js, firestore.rules)
Where the backend had to pick a detail the sections above leave open:
- **Attendance**: records with `submitted: false` (drafts) and `deleted: true` are ignored by the day rule. The absence alert is sent
  only when the record's `date` is today (India time), so back-filled days update `par_attendance` without a "today" push.
  Dedupe id `att_{date}_{studentId}_{uid}`; `E` (excused) updates the projection but sends no alert.
- **Homework**: a homework with `deleted: true` or a draft `status` has no `par_homework` copies; publishing it later counts as "new".
- **Results**: `par_results` also carries `classId`. When a class label is removed from `exm_papers.published` (the admin web does
  this when marks are edited after publishing) that class's `par_results` for the paper are deleted until it is published again;
  marks are matched by `exm_marks.studentId`, else `candId` = `cand_{studentId}`. Students without a mark get no row.
- **Notices**: parent-visible = `status == "Published"` and `audience` matches `parent|guardian|all school|whole school|everyone`
  ("Staff & Teachers" and "Transport Routes" are not); the flag is always written, `true` or `false`, and only when it changes. The push goes to all parent logins of the school, narrowed by the notice's
  `grades` labels ("Grade 8-A", "Grade 9") when present. Calendar: `status == "published"`. No calendar push.
- **Messages**: a new thread must have `lastMessage == ""` and both unread counters 0 (`lastAt` / `lastFrom` may be set for
  sorting). The function marks each counted message `counted: true` (clients cannot set it), so retries never double-count.
  Parents query messages with `parentUids array-contains uid` **and** `threadId == X` (a `threadId`-only query is denied);
  composite indexes for both thread and message queries are in `firestore.indexes.json`.
- **Leave decisions**: the teacher may change only `status` (Pending/Approved/Rejected), `decisionNote`, `decidedBy`, `decidedAt`,
  `updatedAt`, `updatedBy` of a `student_leaves` doc.
- **Class teacher name**: kept by a separate trigger `onClassTeacherNameSync` (a deployed `onDocumentUpdated` function such as
  `onClassTeacherChanged` cannot change its event type), plus `onStaffRenamed` for staff renames.
- **Audit**: `set_audit` rows written by functions carry `kind: "parent"`, `source: "functions"`; `actor` is the user named by the
  student's `updatedBy` (else "System"), or the parent for consents. A consent doc with `withdrawn: true` (or deleted) logs "Consent withdrawn".
- **Accounts**: `onStudentWritten` updates only `users` docs with `role == "parent"` in the same school; it never creates them.
