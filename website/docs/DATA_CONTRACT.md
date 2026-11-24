# Data contract: Admin Web ↔ Teacher App ↔ Parent App

Single source of truth for how the three apps share one Firestore. If an app and this file disagree, fix the app.
Demo tenant: **Greenfield International School**, AY 2026-27, Term 2.

## 1. Tenancy and accounts

- Every school's data lives at `schools/{schoolId}/{collection}/{id}`. `schoolId` is an opaque id (for the existing demo school it equals the admin's auth uid; new schools may use any id). Multiple schools share one backend.
- `users/{authUid}` maps a login to its school. Its application role is `admin`, `staff`, `teacher`, `parent`, `driver`, or `attendant`. The managed staff title is stored separately in `staffRole`; `staffId` links to the staff directory and `crewId` links transport logins to their crew record.
- Super Admin provisions School Admin logins. Public signup links open the school sign-in page.
- Staff & HR saves a profile through `saveStaffProfile` with `{ requestId, profile, staffId?, photo? }`. It returns `{ staffId, empId }`. A new directory ID is based on the request UUID, and the employee ID can be generated or entered manually. `staff_employee_ids` reserves employee IDs per school. The directory keeps the fields used by the apps. `staff_hr` holds private profile details, and `staff_hr_photos` holds the optional resized photo. `getStaffProfile` reads those records for school admins. `deleteStaffProfile` removes those records and a linked login when the member can be deleted from Staff & HR.
- `setStaffAppLogin` takes `{ staffId, email, role }` to create a login or `{ staffId, replace: true }` to replace its password. It returns `{ email, password }` to the requesting school admin. The dashboard displays the generated password once. Firebase Auth manages the credential, and the directory keeps the login email and linked UID. Teacher and HOD accounts use the Teacher app. Driver and Helper accounts use the Driver app, where Helper maps to `attendant`. Other staff use the `staff` application role.
- The setup wizard and `/staff-access` keep using `createSchoolStaff` to send a password setup link through Nodemailer. `resendSchoolStaffInvite` checks the caller’s school and invitation role before resending. The invitation path uses `stf_{authUid}` and `crw_{authUid}`. Older numeric IDs remain valid.
- An email belongs to exactly one school (Firebase Auth emails are global).

## 2. Ids and conventions

- Ids are stable and never names: `stf_001`, `stu_001`, `cls_10B`, `asg_001`, `per_10B_Mon_3`.
- Student ids are zero-padded to 3+ digits (`stu_001`…); roster students are `stu_101` onward.
- LKG–10 class id = `cls_{grade}{SECTION}` (grade `"10"`, section `"B"` → `cls_10B`). Grades 11–12 use `cls_{grade}_{streamId}_{SECTION}`, e.g. `cls_11_science_A` and `cls_11_commerce_A`. Canonical `streamId` values are `science`, `commerce`, `humanities`; `stream` stores the display name. Section letters restart within each stream. Both `grade` and `section` stay strings.
- Day names `Mon…Sat`; teacher app numbers them 1..6 locally. Period numbers 1..8; teacher app shows `P1..P8`.
- Dates `YYYY-MM-DD`, times `HH:mm`.
- Every doc written by an app carries `updatedAt` (ISO string or server timestamp), `updatedBy` (auth uid). Soft delete with `deleted: true` is allowed; hard delete only by admin.
- School administrators and owners can open retained student records with `deleted: true` from historical links.
  These profiles are labelled Removed student and are read-only: profile, division, transport, parent-account and
  document changes are unavailable, while saved information and document preview/download remain accessible.
  Opening the profile does not restore the student. Removed students stay out of the directory and new concession choices.
- A person is referred to by id plus a denormalized display name (`teacher: "Mrs. Anita Sharma"`, `teacherId: "stf_025"`). Id wins; the name is for display and for old views.

## 3. Shared master collections (admin writes, teacher + parent read)

Senior school setup: `onb_data/s3.values.cfg` stores `{grade, sections, cap, streams:[{id, sections, cap}]}` for
Grades 11–12. Each stream creates its own `set_sections/sec_grade11_science` row, e.g.
`{grade:"Grade 11", streamId:"science", stream:"Science", sections:["11-Science-A"], roster:0, cap:30}`.
Grade-level `cap`/`sections` remain for older setup answers; stream entries are authoritative for new senior setup.
Existing occupied classes are retained when settings change. Unassigned senior students must be explicitly assigned
to a configured stream through Students & Guardians; billing never infers a stream from a section letter.

Fee scope keys are ordinary grades for LKG–10 and `{grade}:{streamId}` for 11–12 (`11:science`). Both
`onb_data/s5.values.grades` and each fee item's `grades` array use these scope keys. A structured
`fee_structure/fs_11_science` has `{grade:"11", streamId:"science", stream:"Science", schemaVersion:2,
academicYear, termsPerYear, items:[{id,name,amount,grades:["11:science"],frequency,dueDate,mandatory,newStudentsOnly}]}`.
`dueDate` can be an empty string. Existing lower-grade document ids remain unchanged. Saving senior fees replaces
the old class-wide senior rate with stream records in the same batch; issued invoices remain unchanged. A saved
class-wide senior fee is expanded to its configured streams for review in the editor. Different rates need distinct
fee items scoped to their class and stream. Payment preferences remain in `set_config/fee_policy`.

Attendance warnings use `set_config/attendance_policy.minimumPercent` (finite number, 0–100 inclusive;
default 75 when absent/invalid). Admins configure it in Settings → Academic Year. Student warning counts and
colours, daily attendance colours and attendance/marks reports share this value. Writes retain other fields,
include `updatedAt`/`updatedBy`, and reject overwriting a concurrent change to the minimum.

Batch billing requires an explicit senior stream and matches the student's linked class, canonical stream metadata,
or stream-bearing class id. Missing assignments are excluded with a visible warning. Invoice records copy
`streamId` and `stream`; the billing-period key deliberately excludes stream to prevent charging a transferred student
twice for the same period. Optional parent payment messages target only newly created invoices in the selected batch.
CSV student import appends `stream` as its sixth column; older five-column files remain valid for LKG–10.
No new API endpoints, indexes, or broader permissions are needed for these school-scoped document writes.

| Collection | Shape (new fields in **bold**) |
|---|---|
| `school` (doc `school`) | `name, short, board, affiliation, city, academicYear, term` (**term** `"Term 2"`) |
| `staff` | `name, empId, department, role, status, phone, **email**, **authUid?**, **designation?**, **subjects?**, **joined?**` |
| `classes` | `id, grade, section, streamId?, stream?, **classTeacherId**, **room**, **wing**, **studentCount?**, divisionAssignmentRevision?` |
| `assignments` | `classId, subject, teacherId, **topic?**, **periodsPerWeek?**` (who teaches what to which class) |
| `students` | `name, grn, grade, section, streamId?, stream?, **classId**, **roll** (int), guardian, **guardianId?**, phone, status, attendance` (**`perfGrade?`** is the optional letter grade; the teacher app must not store a letter grade in `grade`) |
| `ops_periods` (the timetable) | `classId, grade, section, day:"Mon", period:1..configured bell periodCount (max 12), subject, teacher (name), teacherId, room`. Saved lessons beyond the current count are retained separately for review. |
| `ops_substitutions` (new) | `date, day, period, classId, subject, absentTeacherId, substituteTeacherId, status: "Assigned"|"Accepted"|"Declined", topic?, note?` |
| `exm_cycles`, `exm_papers`, `exm_candidates` | existing; `exm_candidates` become one per student of rostered classes: `id=cand_{studentId}, studentId, name, roll, grn, cls("8-A"), grade, section`; `exm_papers` gain `classIds?: string[]`, `invigilatorId?` |
| `com_notices`, `calendar_events` | existing (admin writes). Teacher app reads them for circulars and calendar |
| `approval_policies`, `set_*` | admin only |

### 3a. Roll numbers (Settings → Classes & Sections → Roll numbers)

- `students.roll` (int 1..999) with `rollAcademicYear`; a number from another year counts as unassigned, and the
  rollover clears both. Every change bumps `classes.rollRevision` so the apps refresh the division.
- `set_config/rolls` `{ auto: bool }` (missing = `true`). While `auto` is on, the `onStudentRollNeeded` trigger
  (`functions/studentRolls.js`) numbers a division whenever a student joins it (admission, division move, rollover)
  or lacks a number: a division with no numbers for the year is numbered 1..n in name order; a numbered division
  gives the newcomer the next number after the highest in use, so nobody else's roll changes mid-year. It skips a
  running rollover (`platform_schools.rolloverJob`) and `auto: false`.
- "Number all classes alphabetically" on the same page renumbers every division 1..n by name in batches; the class
  teacher's `assignStudentRoll` callable and the dashboard's per-class "Assign roll numbers" stay for manual fixes.

### Assessment scheme (Settings → Assessment Scheme)

Yearly academic setup that exams are created from (stage A of `EXAMS_WORKFLOW_PROPOSAL.md`). Admin-only `set_*`
collections; carried forward by rollover like the other settings.

- `set_exam_types/{ext_slug}`: `{name, short, termId ("" = none), weight (percent of the term result), pattern:
  "scheme"|"single", singleMax, shareSubjectWise, countsInTerm, order, active}`. `pattern:"single"` means one theory
  paper of `singleMax` marks per subject (unit tests); `"scheme"` uses the subject scheme's components.
  `shareSubjectWise` is the policy for pushing approved subject marks to parents before the full result.
- `set_subject_schemes/{scheme_{grade}[_{streamId}]}`: `{groupKey ("9:" or "11:science", the exam wizard's class
  key), grade, streamId, scaleId ("default" = `set_grading`), subjects:[{subject, code, mode:"marks"|"grade", theory,
  practical, internal, passMarks, theoryPass, practicalPass, internalPass, weight, gradeOptions, duration (hours),
  enteredBy:"subjectTeacher"|"classTeacher"|"office"}], coScholastic:[string]}`.
- The wizard's Exam type picker lists active `set_exam_types` (falling back to a fixed list when none exist) and
  stores `exm_cycles.examTypeId` and `termId` beside the legacy `examType` name. Selecting a class group for the
  first time pre-fills its subjects from the scheme, scaled to the exam type; "Reset to … scheme" re-applies it.

### Mark sheets and class results

Stages C–E of the workflow. Full field lists, transitions and server actions are in `EXAMS_SHEETS_RESULTS_CONTRACT.md`.

- `exm_sheets/{paperId}__{classId}`: the unit of marks work (one subject × division) with `ownerId`, `rosterIds`,
  `components` and `status: NotStarted|InProgress|Submitted|Returned|Approved|Locked`. Created by the
  `manageExamination` action `openEntry`. The owner (teacher) submits by writing `status:"Submitted"` directly;
  admins return, approve, reopen and reassign through `sheetReturn|sheetApprove|sheetReopen|sheetAssign`.
  Approval sets `verified` + `verificationFingerprint` on every rostered `exm_marks` row. Teacher writes to
  `exm_marks` are governed by the sheet when one exists (owner, open status, all components); papers without a
  sheet keep the legacy paper-level rule.
- `exm_results/{cycleId}__{studentId}` and `exm_class_results/{cycleId}__{classId}`: compiled, versioned results
  (`Compiled → Approved → Published → Superseded`, `stale` after a reopen) written only by the server through
  `compile|signOff|publishResults|withdrawResults`. Publishing a class adds it to every paper's `publishedClassIds`,
  so the existing `par_results` projection and parent push keep working; parents may also read their own
  Published `exm_results`.
- `exm_cycles.stage`: `setup|scheduled|entry|tabulation|published|closed`, additive to `status`.

### Examination setup and publication

The school dashboard uses six steps in Exams & Results > Create Exam Cycle. Drafts need only a name and can be
saved from every step. Publishing validates the selected divisions, subject components, pass marks and timetable.
Rooms and invigilators are optional. Course-specific classes retain their actual class IDs throughout the workflow.

- `exm_cycles` stores academic year, exam type, description, selected `classIds`, `excludedStudentIds`, `resultRules`,
  `setupVersion` and `publicationState` (`draft`, `scheduled`, `published`). `publishAt` is UTC and
  `publicationTimezone` records the school timezone used to interpret the date-time picker.
- Each `exm_papers` row stores subject-specific theory/practical/internal maxima and pass marks, grade descriptors,
  result weight, instructions, per-class `evaluatorIds`, and a frozen `studentIds` participant list. `setupPlanned`
  includes scheduled publications in conflict detection. `setupPublished` distinguishes published papers from drafts.
- Candidate synchronization precedes the atomic cycle/paper save. `exm_config/schedule_guard` serializes setup saves
  so a competing publication rechecks the current server timetable. Published exam configuration is read-only.
- `publishScheduledExams` runs every five minutes. It publishes due exams and unlocks their papers atomically.
  `onExamTimetablePublished` sends each participating child's parent their subject timetable through in-app notifications.
- Practical, internal and grade-only entries are managed in the school dashboard. The teacher app handles theory marks
  for its assigned examiner and respects excluded participants and locked papers through Firestore rules.
- Marks use `verificationFingerprint` to invalidate review when reviewed values change. The overall-results view applies
  the chosen calculation, rounding and ranking settings. Exempt and grade-only subjects are excluded from numeric totals.
  Parent-result projections retain practical marks, school grades and calculation settings.

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

`website/tools/demo_fixture/` generates one JSON fixture (classes, staff additions, students, assignments, periods, substitutions, papers/candidates). The admin seed (`website/school-dash/src/server/seed`) and the teacher seed (`mobile app/teacher/lib/**/_seed.dart`) both consume it, so ids and names are identical in both apps.

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
- In Admissions or Student Details, a school admin calls `setParentAppAccess` with the student's ID and parent login email. It links a same-school parent in `guardianUids` and records the primary login in `emailGuardianUid`. Accounts assigned to a different school or role cannot be linked.
- `onStudentWritten` keeps each parent's `users/{uid}.studentIds / classIds / grns` in sync. Siblings share a parent account when the school uses the same login email.
- `setParentAppAccess` issues a password on first setup and replaces it only on an explicit school-admin request. The private `parent_credentials/{emailDigest}` stores its salted hash, account UID, school, credential version, and throttling state. The response shows the generated password once.
- `signInParent` checks the password and returns a Firebase custom token carrying the credential version. Firestore and Storage require the current version on managed accounts. Changing it invalidates the previous password and session; credentials from accounts awaiting migration are managed by the school once it issues a password for them.
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

Student-profile invoice creation (admin/owner, existing school write authorization):
- `fee_invoices/{sf_SHA256(studentId, academicYear, normalizedBillingPeriod)}` has the existing invoice shape plus
  `academicYear`, `grossAmount`, `concessionAmount`, `concessionAllocations: [{concessionId,type,amount}]`,
  and `generationFingerprint`. Positive lines may carry `feeItemId`, `quantity`, `unitAmount`; concessions are
  negative lines, so the sum of all lines equals `amount`. Existing mobile invoice readers remain compatible.
- `fee_invoice_sequences/student_{academicYear}`: `{id,last,updatedAt,updatedBy}` allocates the separate
  `INV-ST-{academicYear}-{six-digit-sequence}` namespace. Legacy invoice numbering remains unchanged.
- `fee_student_billing/{studentId}_{academicYear}`: `{id,studentId,academicYear,quantities:{feeItemId:count},updatedAt,updatedBy}`
  serializes new profile-generated collections for a student/year and prevents rebilling exhausted quantities.
- `fee_concessions/{id}.invoiceApplications`: `[{invoiceId,academicYear,amount}]`. Allocation uses the approved
  amount minus all prior applications. Invoice, sequence, billed quantities and applications commit atomically.
  Identical retries return the original invoice. Changed previews/configuration, removed/inactive students,
  duplicate periods and quantities exceeding remaining collections are rejected. The existing general invoice and
  batch routes retain their behavior; they do not use this new collection ledger.
- Annual payable is a display calculation from current grade/stream fees, admission eligibility, transport policy,
  configured term dates, approved current-year concessions and that year's invoice payments. It does not create
  an invoice or alter recorded balances. Existing historical invoices and receipts remain readable/exportable.
- `/fees` uses that same calculation for the student dues directory, joining `students`, `adm_student_details`
  (admission-date fallback), `fee_structure`, `set_terms`, `school/school`, `student_transport_fees`,
  `set_config/fee_policy`, invoices, payments and concessions. These remain admin/owner school-scoped reads;
  no new collection or public sharing URL is introduced. Removed identities still disambiguate legacy GRNs.
  `/fees/students/{studentId}` reuses the profile's invoice-generation transaction and payment history. PDF sharing
  exports a local file, with the recipient chosen in the device's share menu; fallback download makes no database write.

Student fee collection and invoice status (2026-11-17):
- **Collect payment** calls `recordFeePayment` with `{requestId, invoiceId, amount, mode, date, reference}`. Receipt,
  invoice paid/balance/status, unique transaction reference and replay marker commit atomically. The UI retains an
  uncertain request across retries/reloads of the same tab and does not let edits silently submit it again.
- **Change status** calls `changeFeeInvoiceStatus` with `{requestId, invoiceId, status, reason, expectedRevision,
  expectedAmount, expectedPaid, expectedDue}`. Callable status is Automatic/Pending/Overdue; Partial/Paid use collection.
  MFA-verified school admin/owner authorization, school lock checks, reason length and the reviewed financial snapshot
  are rechecked in the transaction. Stale edits, settled-to-unpaid transitions and removed student mutations fail.
- `fee_invoices.statusOverride` is null or `{status:"Pending"|"Overdue", amount, paid, due}`; `statusRevision` defaults
  to 0 for old invoices. Overrides only apply while the reviewed amount, paid total and due date still match.
  Recording a payment clears it and increments the revision. Parent-readable invoices contain no private status reason.
- `fee_invoice_status_history/{requestId|pay_requestId}` is server-only written, school-admin/owner readable:
  `{invoiceId,invoiceNo,from,to,mode:"Manual"|"Automatic"|"Payment",reason,at,by,byUid,_o}`. The reason/editor stay here.
  `fee_invoice_status_requests/{requestId}` stores fingerprint/result for idempotent status retries. Client writes to
  both collections and updates to invoice status/override/revision/paid/balance are denied. Retain audit and replay
  records with financial history; existing school backup/retention policies apply. No new indexes are required.

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

### 13.3a Chat attachments, meetings and presence (2026-11-23)
- A `msg_messages` row may carry `attachment: {kind: image|file|audio, name, bytes, url, path, contentType, durationMs?}`
  (a photo, document or voice note uploaded by the sender) and/or `meeting: {id, date, time, link, note, status}` (a card
  for a chat meeting). `text` may be empty for such rows. Files live in Storage at `schools/{sid}/chat/{threadId}/{id}`
  (read/create: the thread's teacher and guardians, 15 MB, images / audio / PDF / Office / text) or, for files picked while
  composing a new message, `schools/{sid}/chat/outbox/{id}` (any member of the school may read).
- `msg_meetings/{id}` = `{threadId, studentId, studentName, parentUids, teacherId, teacher, guardian, date (yyyy-MM-dd),
  time (HH:mm, India time), startsAt (UTC ISO), link (https://meet.google.com/…), note, status: scheduled|cancelled,
  createdAt, createdBy, reminders}`. The teacher creates, reschedules and cancels (never deletes); `reminders` belongs to the
  function `sendChatMeetingReminders` (every 5 min): it pushes both sides on the morning of the meeting (07:00 IST), one hour
  before and ten minutes before (`type: "meeting"`, teacher route `/messages/{threadId}`, parent route
  `/messages/thread/{threadId}`); a changed date/time resets the flags. Parents read their own threads' meetings.
- `msg_presence/{uid}` = `{uid, threadId, at}`: which conversation a login is reading right now (both apps write their
  own doc on open / leave / background). `onMessageCreated` skips the push (and the in-app row for parents) for a
  recipient whose presence names that thread within the last 90 seconds. The push body shows "📷 Photo", "🎤 Voice note",
  "📎 name" or "📅 Meeting …" for non-text messages.

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
| admin Remind (`fee_reminders` created) | "Fee reminder" | `/fees` |
| daily 09:00 IST (`feeDueReminders`): unpaid invoice due in 3 days / today / 1 and 7 days late | "Fee due in 3 days" / "Fee due today" / "Fee overdue" | `/fees` |
Teachers get a push for a new parent message (setting `parentMessages`, §10) and for a new leave request of their class.

### 13.5 Audit
Functions append to `set_audit` (`{at, actor, action, detail, kind}`) when a parent login is linked/unlinked, a consent is
recorded or withdrawn, and a student record is created/deleted, so children's data changes are traceable in Settings > Audit.

### 13.7 Parent-teacher meetings and certificates (2026-10-27)

Certificate Management v2 (student and staff formats, frozen PDF/snapshots, server numbering, template versions, revocation and private history) is specified in [CERTIFICATES.md](CERTIFICATES.md). Existing certificate fields below remain supported for legacy records. New student request types also include `study`, `dob` and `conduct`; staff certificate records use `recipientKind:"staff"`, `staffId`, and an empty `studentId`, so they never enter a parent's child query.
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
  `issuer`, `note?`, and when the office uploads the signed copy `fileUrl` (download URL), `filePath`
  (`schools/{sid}/certificates/{id}/{file}` in Cloud Storage, `storage.rules`: admins write PDF/PNG/JPG up to 10 MB, the
  student's guardians may read once Issued), `fileName`; on rejection `rejectReason`.
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
- **Results**: `par_results` also carries `classId`. A reasoned administrator reopening withdraws the paper's subject publications
  before corrections. Removed publication labels/exact class IDs delete those classes' `par_results` until they are published again;
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

## 14. Transport: buses, drivers, bus staff, student bus attendance (2026-10-31)

One Flutter app (`mobile app/driver`, "Shift Sync") serves two crew roles: the **driver** and the **attendant** (the bus staff
member who rides with the driver). The admin web manages both, allots them to buses, puts students on buses and reads every
transport record. Everything is under `schools/{sid}`; ids and stamps follow §2.

### 14.1 Accounts and crew
- `tr_crew/{id}` (id `crw_001`…): `{name, role: "driver"|"attendant", empId ("TR-1001"), phone, email, authUid?, status:
  "Active"|"On leave"|"Inactive", busId?: string, bus?: string (display "Bus 14", kept by the admin web), licenseNo?,
  licenseExpiry? (YYYY-MM-DD), joined?, address?, emergencyName?, emergencyPhone?, photoUrl?, leaveFrom?, leaveTo?, leaveReason?}`.
- Admin web > Transport > Drivers / Bus staff adds a crew member with a required unique email → the admin web creates the
  Auth login exactly like a staff login (§1: secondary app, random password, password-reset invite), writes
  `users/{uid} = {schoolId, role: "driver"|"attendant", crewId, email, name, createdAt}` and stores `authUid` on the crew doc.
  Crew sign in to the driver app with that email and the password set from the invite (no mobile OTP).
- A crew member belongs to at most one bus (`tr_crew.busId`); a bus has one `driverId` and one `attendantId`. The admin web
  keeps both sides in sync in one batch (allotting a crew member to a bus clears them from their previous bus).
- Rules helpers: `isCrew(sid)` = users doc of that school with `role in ['driver','attendant']` and a non-empty `crewId`;
  `myCrewId()`; `myBusId(sid)` = `tr_crew/{myCrewId}.busId` (read from Firestore, never from the client).

### 14.2 Buses and stops
- `tr_buses/{id}` (id `bus_01`…): `{number ("14"), regNo ("DL-01-AB-4092"), capacity (int), model? ("42-seater AC"),
  routeName ("Route 4B"), driverId?, driver? (name), attendantId?, attendant? (name), stops: [{id: "stp_01", name,
  pickupTime: "06:45", dropTime: "15:40", landmark?, timingPending?}] (in route order; the school is not a stop), pickupStart "06:45",
  dropStart "15:30", status: "Active"|"Maintenance"|"Inactive", studentCount (int, kept by the admin web), note?,
  monthlyFee? (deprecated legacy bus-wide amount; retained but ignored by current fee settings)}`.
- `student_transport_fees/{studentId}` stores `{studentId, busId, amount: number|null, busAssignmentRevision,
  revision, updatedAt, updatedBy}`. This school-scoped collection is admin/owner-only under the existing generic
  rules; it is not embedded in the student document read by crew or parents. Amounts are INR per configured collection, from 0 to
  10,000,000 with at most two decimals; 0 is free and null/missing is not configured. Each student has their own
  agreed amount, editable during bus assignment or in Student details > Transport and displayed read-only
  in Bus details > Students. Legacy `monthlyAmount` values remain readable; new saves write `amount` instead. Bus-wide legacy rates are not copied or used as defaults.
  The fee transaction re-reads the student, bus and current fee, checks assignment/fee revisions, and writes only
  the fee setting for amount-only edits; assignment, new stop, occupancy and an entered amount share one
  transaction when edited together. School-wide `set_config/fee_policy.transportFrequency` stores the chosen
  collection cycle (empty, Monthly, Quarterly, Half-yearly, Term-wise, Annual or One-time), configured only in
  Settings > Payments. Totals use integer paise and exclude deleted or reassigned students. Existing invoices,
  payments and grade fee plans are unchanged; configuring fees does not generate a bill.
- Add Bus records the route as `endPoint` and initializes `routeName` with that value for existing consumers. Stops and their
  order can be configured later in Edit bus. `capacity` is the number of seats available to students, and `totalSeats`
  is total vehicle seating. Vehicle identity, safety equipment, compliance dates and maintenance are edited through
  Transport > Buses > bus > Edit vehicle details.
- The bus expiry reminder recipient is stored as the designated school administrator's UID in
  `tr_settings/expiry_notifications.recipientUid`. The `transportExpiryReminders` function runs daily at 09:00 India
  time. It writes an in-app notification for each registration, fitness, insurance, permit, PUC or road tax date within
  30 days. A receipt in `tr_expiry_receipts` prevents repeat delivery for the same bus, document and expiry date.
- `students` gain `busId?`, `bus?` (display "Bus 14"), `busStopId?`, `busStop?` (stop name), `busAssignmentRevision?`. The admin web assigns students to a
  bus and stop in Transport > Buses > bus > Students (and clears them on removal). `tr_buses.studentCount` = students with
  that `busId`. Changing/removing the bus increments the student assignment revision; its fee is replaced with the entered
  amount or deleted when no amount is supplied, in the same transaction. A stop-only change preserves the fee.
- Student details can select an existing stop or add a name while assigning a bus. School-scoped suggestions
  prioritize the selected bus and deduplicate names ignoring case and repeated whitespace. Stop creation,
  the student's `busStopId`/`busStop`, and bus occupancy updates share one transaction, which re-reads the
  route and reuses a matching stop. Other buses' stop names can be reused without copying their IDs or times.
  New stops append to `tr_buses.stops` with empty legacy time strings and no `timingPending` flag.
  Admin stop configuration only requires unique names; array position determines route order. Pickup/drop
  timing inputs, readouts and pending-time warnings are omitted. Editing preserves legacy time strings
  for compatibility and removes the obsolete pending flag.
- Crew read `tr_buses/{myBusId}`, and `students` where `busId == myBusId` (the roster: name, class, roll, stop, guardian,
  phone, photo). They never read other buses' students.

### 14.3 Trips (one per bus, per day, per direction)
- `tr_trips/{date}_{busId}_{kind}` with `kind` `"pickup"` (morning, home → school) or `"drop"` (afternoon, school → home):
  `{busId, bus, routeName, date, kind, status: "scheduled"|"active"|"completed", driverId, driver, attendantId, attendant,
  total (students on the bus that day), boarded, dropped, absent (counts, recomputed on every mark), startedAt?, startedBy?
  (crewId), endedAt?, endedBy?, checklist?: {brakes, lights, tyres, fuel, firstAid, cleanliness: bool}, checklistAt?,
  odometerStart?, odometerEnd?, note?, currentStopId?}`.
- The driver app creates the day's two trip docs the first time a crew member of that bus opens the app that day
  (`status: "scheduled"`); the admin web shows them in Transport > Trips. Starting a pickup trip requires every checklist
  item true. Either crew member may start or end a trip. Ending a pickup trip marks every `boarded` student `dropped`
  (arrived at school); ending a drop trip leaves unmarked boarded students as `boarded` for the office to follow up.
- Crew write `tr_trips` only for `busId == myBusId()` and never change `busId`, `date`, `kind`.

### 14.4 Student bus attendance
- `tr_attendance/{date}_{busId}_{kind}` (same id as the trip): `{tripId, busId, bus, date, kind, total, marks:
  {studentId: {status: "boarded"|"absent"|"dropped", at (ISO), by (crewId), byName, stopId?}}, boarded, dropped, absent
  (counts), updatedAt, updatedBy}`. Students without a key are not marked yet.
- The attendant (or the driver) marks each student from the trip's student list: **Boarded** / **Absent** at the stop, **Dropped**
  when the child leaves the bus. One tap writes `marks.{studentId}` with a merge, so both crew members may mark at once.
  Undo sets the key back to the previous status (or deletes it).
- The student list shows the guardian name and phone; **Call** opens the dialer (`tel:`) with the parent's number.
- Admin web > Transport > Attendance shows per date and bus the trip, the marks (with time and who marked) and the counts;
  per student the history across days. Admin may correct a mark (`by: "admin"`).
- Function `onTransportAttendanceWritten`: for every mark whose status changed to `boarded` or `dropped` today, push the
  child's guardians (`par_notifications` row, `type: "transport"`, "{name} boarded Bus 14 at 06:52" / "{name} got off at
  {stop}", route `/home/track`); `absent` pushes "{name} was not at the bus stop". Dedupe id `trp_{tripId}_{studentId}_{status}_{uid}` (one row per guardian login, like every other parent alert).

### 14.5 Crew attendance (driver / staff check-in) and leave
- `tr_crew_attendance/{date}_{crewId}`: `{crewId, name, role, busId, date, in: "HH:mm"|null, out: "HH:mm"|null, status:
  "Present"|"Late"|"Absent"|"Leave", source: "app"|"admin", note?}`. The crew member punches in / out in the driver app (Home);
  Late = check-in after `set_leave_policy/policy.checkInBy` (default "08:15") minus nothing: transport uses its own
  `tr_settings/policy.checkInBy` (default "06:30") when present. Admin web > Transport > Crew attendance lists every day per
  crew member and may correct a day (`source: "admin"`).
- `tr_crew_leaves/{id}`: `{crewId, name, role, busId, type ("Casual"|"Sick"|"Emergency"|"Other"), from, to, days, reason,
  status: "Pending"|"Approved"|"Rejected", appliedAt, decidedBy?, decidedAt?, decisionNote?}`. Crew create and edit/withdraw
  while Pending; admin decides in Transport > Leaves. Function `onCrewLeaveRequested` adds an admin bell row
  (`category: "approvals"`, href `/transport?tab=leaves`).

### 14.6 Notices
- Crew read `com_notices` with `status == "Published"`; the app shows those whose `audience` mentions transport, staff, drivers,
  all or everyone.

### 14.7 Rules summary (role driver / attendant)
- read: `school`, own `users` doc, `tr_crew` (all crew of the school: the partner card), `tr_buses/{myBusId}`, `students`
  where `busId == myBusId`, `tr_trips` / `tr_attendance` where `busId == myBusId`, own `tr_crew_attendance`
  (`crewId == myCrewId`, also by id `{date}_{crewId}` before it exists), own `tr_crew_leaves`, `tr_settings`, published `com_notices`.
- create/update: `tr_trips` and `tr_attendance` of own bus (ids `{date}_{myBusId}_{pickup|drop}`, `busId` fixed);
  own `tr_crew_attendance` day (`crewId`, docId `{date}_{crewId}`); own `tr_crew_leaves` only while Pending, never
  deciding fields; `tr_crew/{myCrewId}` only `phone`, `address`, `emergencyName`, `emergencyPhone`, `photoUrl`.
- delete: own Pending `tr_crew_leaves`. Everything else admin only.
- Composite indexes: `students (busId, roll)`, `tr_trips (busId, date)`, `tr_attendance (busId, date)`,
  `tr_crew_attendance (crewId, date)`, `tr_crew_leaves (crewId, appliedAt)`.

### 14.8 Demo data
- Emulator seed (`tools/e2e/seed.mjs`) adds bus `bus_01` (Bus 14, Route 4B, 3 stops), driver `crw_001` (`driver@e2e.test`),
  attendant `crw_002` (`attendant@e2e.test`), puts the five seeded students on the bus and writes `.accounts.json` entries
  `driver` and `attendant`. The driver app's local backend (default build) ships the same shapes as in-memory demo data.

### Bus compliance update history
The admin web's Registration and compliance card has Update and History actions. Future changes through either
Update or Edit vehicle details write `tr_bus_compliance_history/{autoId}` with `{busId, changes: [{field, before,
after}], editor, updatedAt, updatedBy}` in the same transaction as the bus update. Unchanged saves create no
history. Stale edits to the same compliance field are rejected; unrelated renewals are preserved. This collection
uses the existing school-scoped admin/owner access rules. Earlier changes are not reconstructed.

### Bus maintenance update history
The Maintenance card's Update editor saves service dates, odometer, service interval and notes. Future changes
through either Update or Edit vehicle details write `tr_bus_maintenance_history/{autoId}` with `{id, busId,
changes: [{field, before, after}], editor, updatedAt, updatedBy}` in the same transaction as the bus. Numeric zero
is preserved and clearing a numeric field saves null. Unchanged saves add no history. Concurrent edits to the
same maintenance field are rejected, and untouched maintenance fields never overwrite another window's changes.
The existing school-scoped admin/owner rules apply to this collection; earlier changes are not reconstructed.

### 14.9 Parent view of transport (2026-11-03)
Parents never read `tr_*` (they hold every pupil of a bus). A function keeps one projection per child that rides a bus:
- `par_transport/{studentId}` (written only by functions): `{studentId, busId, bus ("Bus 14"), regNo, routeName, model?,
  stopId, stop, pickupTime, dropTime, stops: [{id, name, pickupTime, dropTime}], driver: {name, phone}, attendant: {name, phone},
  today: {date (YYYY-MM-DD, India), pickup: {status: "scheduled"|"active"|"completed"|null, startedAt?, endedAt?, mark: "boarded"|"absent"|"dropped"|null, markAt?},
  drop: {same}}, updatedAt}`. A child without `busId` has no doc (it is deleted when the child is taken off the bus).
- Recomputed by `onTransportProjection*` triggers on `students` (bus / stop change), `tr_buses` (stops, crew, number), `tr_crew`
  (name / phone of the bus's crew), `tr_trips` (status of today's trips) and `tr_attendance` (today's marks).
- Parent rule: read `par_transport/{id}` when `id in myStudents()` (also before it exists) or `resource.data.studentId in myStudents()`.
- Parent app: Home bus card and Track Live read recorded trip status and child marks. Legacy pickup/drop
  timing fields are ignored: no scheduled stop times, clock-based ETA, inferred passed stops or simulated bus
  position are shown for school data. Student profile > Transport shows bus, route, stop, driver and attendant
  with Call. Actual departure and boarding/drop event timestamps remain available. The push rows of 14.4
  (`type: "transport"`) open `/home/track`.
- Driver app: Home, trip route previews, route stops and student sheets omit planned pickup/drop times.
  Existing saved timing strings remain compatibility data; actual trip and attendance timestamps are retained.

## 15. Scheduled circulars (2026-11-04)
- `com_notices` with `status: "Scheduled"` and `sentAt` (ISO publish time) are published by the function
  `publishScheduledNotices` every 5 minutes: `status: "Published"`, `delivered = recipients`, `read = acked = 0`, plus a
  `com_log` row `{noticeId, action: "Sent (scheduled)", audience, channels, recipients, at, by: "functions"}`. The admin web
  does the same while its Notices page is open; both run in a transaction-safe way (status checked first). The Published
  write then runs the usual teacher / parent notice functions. Needs the `com_notices.status` collection-group index
  (`firestore.indexes.json` fieldOverrides).

## 16. Platform owner console (super admin, 2026-11-04)
The product owner (Tatos) manages every school from a separate site: the owner console at `/owner`, served by its own
Firebase Hosting site (`edvio-owner.web.app`, target `owner`) from the independent Next.js app in `superadmin`.
The public landing app is in `landing` (target `landing`), and school admin remains in `school-dash/src`.
Local ports are admin 3000, landing 3001, superadmin 3002; common source is in `shared`. The admin site redirects `/owner/**` to the owner site; the
owner site has no landing page or self sign-up and turns school admins away.
- **Owners**: `platform_admins/{uid}` = `{email, grantedAt, grantedBy}`, written only with admin credentials
  (`tools/owner/grant-owner.mjs`, which also creates the login and sets its password). Clients cannot write it. On sign-in
  the web checks this doc first: an owner has `role: "owner"` and no school.
- **What an owner may do (rules)**: read and write everything under every `schools/{sid}/**` (also while suspended), read
  every `users` doc and create / update / delete them, keep `platform_schools`, and read / update / delete `leads`.
  Storage: an owner counts as the admin of every school.
- **`platform_schools/{schoolId}`** = `{name, status: "active"|"suspended", plan, note, reason, adminEmail, adminName, city,
  board, phone, leadId, createdAt, createdBy, updatedAt, updatedBy}` (keys fixed by the rules; `updatedBy` = the owner's
  uid). A suspended school is locked for all of its members (admin, staff, parents, crew); the admin web signs a
  signed-in admin out with a message. Members read their own school's doc. Schools that signed up by themselves have no
  doc until the owner saves their plan; the console lists them from their admin `users` docs. The rules test `exists()`
  before `get()` on this doc: most schools have none, and `get()` of a missing doc fails the whole rule.
- **Add school**: the console creates the admin's Auth login with the email and password the owner chose on a secondary
  Firebase app, bootstraps the school with the owner session (school id = the admin's uid), then writes `platform_schools/{uid}`. From a demo request it also sets the lead to `converted` with
  `schoolId`. More admin logins for a school: `users/{newUid} = {schoolId, role: "admin", email, name}` written by the owner.
- **Inside a school**: "Open school console" links to the admin app with `?school=<schoolId>`. The admin app independently
  authenticates the account and verifies owner membership before storing the selection in
  `sessionStorage["edvio.owner.actAs"]`. Its console and setup wizard then work on that school with a banner linking
  back to superadmin. Sessions are scoped to each browser origin; an owner may need to sign in once on each app.
  No credentials are transferred in URLs.
- **Callable functions** (`functions/owner.js`; the caller must have a `platform_admins` doc):
  `ownerSetPassword {uid, password}` (8–128 characters; any school login, never an owner) and
  `ownerDeleteSchool {schoolId, confirm: schoolId}` (deletes every Auth login with that `schoolId` except owners, their
  `users` docs, `schools/{sid}` recursively, `platform_schools/{sid}`, Storage files under `schools/{sid}/`, and clears
  `schoolId` on leads that pointed at it).
- **Demo requests** `leads/{id}`: the landing page creates them as before. The owner moves `status` through
  `new → contacted → demo → converted | closed` and keeps `notes` (≤ 2000); only `status`, `notes`, `schoolId`,
  `updatedAt` and `updatedBy` may change.
- **Admins change their own password** in My Profile (re-authenticate with the current password, then update). My
  Profile stays reachable during the setup wizard.

## Examination operations and consolidated report cards

The additive operational contract, API actions, immutable history/snapshots, tenant permissions, class-level locks, parent PDF access and deployment steps are documented in [EXAMS_ENHANCEMENT.md](EXAMS_ENHANCEMENT.md). Existing `exm_*` setup/marks/duty records and `par_results` subject projections remain in use. `publishedClassIds` and `lockedClassIds` preserve exact division identity alongside legacy publication labels. New report-card records never replace subject-publication controls. Parent queries read only their child's `Published` report snapshots; drafts, approval batches, history and audit records remain administrator-only.
