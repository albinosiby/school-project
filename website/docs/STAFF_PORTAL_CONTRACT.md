# Staff portal (web console) — implementation contract

The web console admits every school staff account (the same logins as the teacher app) and gives them a **staff portal**
at `/me/**` that does what the mobile apps do: the same Firestore collections, the same document shapes, the same rules.
Admin pages stay admin-only. This document is the contract the portal builders follow.

## 1. Sign-in and identity

- `users/{uid}` carries `role` (`teacher` for teachers and HODs, `staff` for every other designation, `driver` / `attendant`
  for bus crew), `schoolId`, `staffId` (teacher / staff), `crewId` (crew), `staffRole` (designation, `functions/staffRoles.json`), `name`.
- `src/lib/authContext.tsx`: `loadProfile` admits `admin` plus every staff role; `User` carries `staffId`, `crewId`, `name`;
  `isStaffUser(u)`; `homeFor(u)` is `/me` for staff. Parents are still refused (`NOT_ADMIN`).
- `src/components/AuthGuard.tsx`: `role="staff"` lets staff in; the admin layout (`role="admin"`) sends staff to `/me`.
- `src/lib/portal/useStaffProfile.ts`: `{ user, staffId, crewId, record, name, designation, teaching, canAddStaff, ready }`.
  `teaching` is `user.role === "teacher"` (what the rules let mark attendance, enter marks and so on).
- Firestore scope: `useCollection(name, enabled?, filters?)` already reads `schools/{sid}/...` for the signed-in school.
  **Filters must match the rules**: a teacher may list `staff_leaves` only with `["staffId", "==", staffId]`, `exm_sheets`
  only with `["ownerId", "==", staffId]`, private collections only with `["teacherId", "==", staffId]`.

## 2. Routes and layout

`src/app/(portal)/layout.tsx` → `AuthGuard role="staff"` + `PortalShell` (`src/components/portal/PortalShell.tsx`, links in
`src/components/portal/nav.ts`). Each page is `src/app/(portal)/me/<area>/page.tsx` rendering a view from
`src/features/portal/<area>/`. Teaching-only links are hidden for non-teaching staff; the page itself must also render an
"Only teachers…" empty state when `teaching` is false.

| Route | Area folder | What it does (mirror of the teacher app module) |
|---|---|---|
| `/me` | `portal/home` | Today: timetable periods (teaching), check-in card, pending substitutions, unread notices, leave status |
| `/me/timetable` | `portal/timetable` | Weekly grid of own periods from `ops_periods` (`teacherId`) with substitutions overlaid |
| `/me/attendance` | `portal/attendance` | Mark class attendance per date/period: `ops_attendance/{date}_{classId}_{period}` |
| `/me/students` | `portal/students` | Own classes (assignments, periods, class teacher), student lists, class-teacher decisions on `student_leaves` |
| `/me/homework` | `portal/homework` | `ops_homework`: create, grade submissions, close, soft delete |
| `/me/marks` | `portal/marks` | Own `exm_sheets` (`ownerId`), marks entry into `exm_marks`, submit sheet |
| `/me/substitutions` | `portal/substitutions` | `ops_substitutions` where `substituteTeacherId == staffId`: accept / decline |
| `/me/duties` | `portal/duties` | `exm_duties` for this staff, candidates of the hall, invigilation progress (`ed_duty_state`) |
| `/me/live` | `portal/live` | `live_classes`: schedule, cancel (soft), join counts |
| `/me/messages` | `portal/messages` | `msg_threads` / `msg_messages` with guardians of own students |
| `/me/leave` | `portal/leave` | Apply / withdraw leave (`staff_leaves` + `approvals` mirror), today's check-in (`staff_attendance`), regularizations |
| `/me/notices` | `portal/notices` | Published `com_notices`, read state in private `att_circulars` |
| `/me/profile` | `portal/profile` | Own `staff` record (read-only) and app login details |
| `/me/add-staff` | (page only) | `AddStaffFields` for designations that may add staff |

- `/me/lesson-plans` (principal, vice principal, HOD): lesson plans sent for review; approve or ask for changes (DATA_CONTRACT section 5).

## 3. Document shapes (write exactly what the app writes)

The teacher app's adapters are the source of truth: `mobile app/teacher/lib/utils/services/firebase/store_adapters.dart`
(`defaultAdapters()` near the end; `stamp()` adds `teacherId: staffId, updatedAt: ISO, updatedBy: authUid`).
Timestamps are ISO-8601 strings, never Firestore Timestamps. Dates are `YYYY-MM-DD`.

- `ops_attendance/{date}_{classId}_{period}`: `date, classId, grade, section, period, total, marks{studentId: status}` for
  non-present students only, `submitted`, + stamp. Rules: `validTeacherAttendance`, `teachesClass` or `coversPeriod`.
- `staff_attendance/{date}_{staffId}`: `staffId, date, in, out, status (Present|Late), note, source: "web"`, + stamp.
- `staff_regularizations`: `staffId, date, type, time, reason, note, status: "Pending", at`, + stamp.
- `staff_leaves`: `staffId, from, to, start, end, type, reason, handovers, status: "Pending", createdAt`, + stamp
  (keys limited by `validStaffLeave`). Mirror row in `approvals` `{kind: "leave", status: "pending", ...}` as the app does.
- `student_leaves`: class teacher updates only `status, decisionNote, decidedBy (= staffId), decidedAt, updatedAt, updatedBy`.
- `exm_marks/{paperId}__cand_{studentId}`: `paperId, candId, studentId, classId, theory, practical, internal, gradeValue,
  status, tag, note, teacherId, enteredAt, updatedAt, updatedBy`. Which keys may change depends on
  `exm_papers.sheetsOpened` (see `teacherMarksWrite` in the rules and docs/EXAMS_SHEETS_RESULTS_CONTRACT.md).
- `exm_sheets/{paperId}__{classId}`: teacher writes only `status: "Submitted", submittedAt, submittedBy (= staffId), updatedAt, updatedBy`.
- `ops_homework`: `classId, grade, section, title, teacher (name), assigned, createdAt, submissions{studentId: {status, feedback}},
  submitted, total, status, deleted`, + stamp.
- `ops_substitutions`: update only `status (Accepted|Declined), updatedAt, updatedBy`.
- `live_classes`: row fields + `classId, title, createdAt`, + stamp; cancel = `deleted: true, status: "cancelled"`.
- `msg_threads/thr_{studentId}_{staffId}`: `studentId, classId, parentUids (⊆ student.guardianUids), teacherId, role, createdAt, updatedAt`;
  `msg_messages`: `threadId, studentId, teacherId, from: "teacher", uid, text, at`.
- Private per-teacher collections (`tt_*`, `tk_*`, `cl_*`, `ls_*`, `ts_*`, `hm_*`, `ms_*`, `pm_*`, `ed_*`, `cr_*`, `att_*`, `lm_*`):
  every doc carries `teacherId: staffId`; read and write with the `teacherId` filter.

## 4. Rules

`website/firestore.rules`: the teacher block (`isTeacher`) is unchanged and already covers every teaching write above.
New `isStaffMember(sid)` block (role `staff` with a `staffId`): reads `school, staff, classes, calendar_events,
set_leave_policy`, published `com_notices`, own `staff_leaves / staff_attendance / staff_regularizations`, own `hm_*` / `att_*` / `lm_*`;
writes own leave, check-in day, regularizations, the `approvals` leave mirror and own `hm_*` / `att_*` / `lm_*`. Crew keep their
own block (`isCrew`). Rules tests: `website/tools/rules_test` (see its README; `hardening.mjs` has role fixtures).

Notes: `validStaffLeave` whitelists keys (incl. `_o`, which `useCollection.create` adds); `set_config` is not readable by
staff or teachers, so the portal uses device-local dates (`useNow`), never `useSchoolClock`; the `approvals` leave mirror is
written with the admin's `mirrorRow()` from `features/people/leaves.ts` so the Approvals inbox matches.

## 5. Testing

`@/test/render` (`website/shared/testing`): `seed`, `renderUI`, `getRow`, `rowsOf`, `writes`, `field`, `dialog`,
`authState` (set `authState.user = { ..., role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "…" }` before
`renderUI`; `resetAuthState()` runs between tests). Every portal view gets a test that seeds the app-shaped docs, drives the
UI and asserts the exact written document shape with `getRow`.

Commands (in `website/school-dash`): `npm run typecheck`, `npm run lint -- <paths>`, `npm run test -- <paths>`.

## 6. Status (2026-11-23)

Built and tested (web, `src/features/portal/*`): home, leave & check-in (requests, balance, check-ins, regularizations),
notices, profile, add staff; teaching: timetable, class attendance, my classes with student leave decisions, homework,
substitutions, marks entry and sheet submission, exam duties with hall attendance, live classes, parent messages.
Rules: `isStaffMember` block + `_o` / `lm_*` allowances; `tools/rules_test/staffPortal.mjs` (64 checks).

Not on the web yet: bus crew pages (drivers / attendants get a home that points to the driver app); the teacher app's
private tools (lesson plans, online tests, certificates, behaviour log, to-dos, syllabus tracker, meetings, handover,
trends); marks entry for legacy papers without an opened sheet (the office opens the sheet first).
