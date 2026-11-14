# Exams: mark sheets, class results and corrections (stages C, D, E)

Implementation contract for steps 2–4 of `EXAMS_WORKFLOW_PROPOSAL.md`. Stage A (`set_exam_types`,
`set_subject_schemes`, wizard pre-fill) is already built; see "Assessment scheme" in `DATA_CONTRACT.md`.

Design rule: **additive and backward compatible.** Existing `exm_*` records, the subject-publication projection to
parents (`exm_papers.publishedClassIds` → `par_results`), report-card batches and the old teacher client keep working.
New behaviour switches on when a sheet exists for a paper × division.

## 1. `exm_sheets/{paperId}__{classId}` — the unit of work

```
{ id, cycleId, paperId, classId, classLabel ("9-A", classIdLabel), subject, grade,
  components: { mode:"marks"|"grade", theory, practical, internal, passMarks, gradeOptions },  // copied from the paper
  ownerId, ownerName, reviewerId: "",
  rosterIds: [studentId…],              // paper.studentIds ∩ class, else active students of the class
  status: "NotStarted"|"InProgress"|"Submitted"|"Returned"|"Approved"|"Locked",
  version: 1,
  submittedAt?, submittedBy?, reviewedAt?, reviewedBy?, returnNote?, reopenReason?,
  summary: { total, entered, absent, medical, exempt, outOfRange, highest, lowest, mean },   // server-maintained
  needsRecheck: false, createdAt, updatedAt, updatedBy }
```

Owner resolution (`examSheets.resolveOwner`): `paper.evaluatorIds[classId]` → `assignments` row with same
`classId` and subject (`subjectTeacherId` semantics: exact subject match, case-insensitive) → `classes/{classId}.classTeacherId`
→ `""` (shown as "Unassigned" in the dashboard).

### Transitions

| From → To | Who | How |
|---|---|---|
| (none) → NotStarted | admin | `manageExamination` action `openEntry` {cycleId}: one sheet per paper × division that has none. Sets `exm_cycles.stage = "entry"`, `entryOpenedAt`. Papers Cancelled are skipped. Idempotent: re-running creates only missing sheets (e.g. after a setup amendment). |
| NotStarted → InProgress | server trigger | `onExamMarkWritten` (extend the existing `invalidateChangedExamMarks` trigger or add one): recompute `summary` for the mark's sheet; if status NotStarted and entered > 0 → InProgress. |
| NotStarted / InProgress / Returned → Submitted | **owner (teacher) by direct write**, or admin via action `sheetSubmit` {sheetId} | Teacher rule: doc exists, `resource.data.ownerId == myStaffId()`, prior status in the open set, `onlyKeys(['status','submittedAt','submittedBy','updatedAt','updatedBy'])`, new status == "Submitted", `submittedBy == myStaffId()`. The admin action validates completeness (every `rosterIds` student has an assessment state other than `pending`/`invalid`) and fails with `failed-precondition` listing the count otherwise; the teacher client validates the same before writing. |
| Submitted → Returned | admin | `sheetReturn` {sheetId, note (5–2000 chars)}. Notifies the owner (push type "exam", route `/marks`). |
| Submitted → Approved | admin | `sheetApprove` {sheetId}. Server: completeness check as above; every rostered mark gets `verified:true` + `verificationFingerprint` (`examAssessment.markFingerprint`) in the same transaction; `reviewedAt/By`. If the cycle's exam type (`set_exam_types/{cycle.examTypeId}`) has `shareSubjectWise:true`, also add the class to `paper.publishedClassIds` and the label to `paper.published` (existing parent projection + push fire). Notifies owner. |
| Approved / Locked → Returned | admin | `sheetReopen` {sheetId, reason (5–2000)}. `version++`, `reopenReason`, status Returned. Removes the class from `paper.publishedClassIds`/`published` (withdraws the subject projection). If `exm_class_results/{cycleId}__{classId}` exists with status Compiled/Approved/Published → set `stale:true` on it and on that class's `exm_results`; `exm_cycles.correctionPending = true`. Marks stay verified until edited (the existing fingerprint trigger clears `verified` on edit). |
| Approved → Locked | server, inside `compile` | all sheets of the class. |
| any → (owner change) | admin | `sheetAssign` {sheetId, ownerId}. Allowed in every status except Locked. |

### Marks write rules

`exm_marks` teacher write (`teacherAcademicWrite`, col `exm_marks`):
- **If `exm_sheets/{paperId}__{classId}` exists**: allowed iff sheet `ownerId == myStaffId()`, sheet status in
  `NotStarted|InProgress|Returned`, student in `rosterIds`, and the mark's component values are within the sheet's
  `components` maxima. Teacher may write `theory`, `practical`, `internal`, `gradeValue`, `status`, `tag`, `note`
  (+ ids, `teacherId`, `enteredAt`, `updatedAt`, `updatedBy`); never `verified`, `medical`, `verificationFingerprint`.
  Replace the legacy paper-level checks (locked/published/evaluator/theory-only) for this branch.
- **If no sheet exists**: the existing rule, unchanged.

Admin client writes (`ExamsPage.save` transaction): when a sheet exists and its status is `Submitted`, `Approved`
or `Locked`, numeric/status edits are rejected with "Sheet is {status}. Return or reopen it to edit marks." Admin entry
while the sheet is open is "entering on behalf": the mark keeps `teacherId` = sheet owner and gets `enteredBy: uid`.

The legacy `att_exam_state` is not written by the new teacher client when a sheet exists; the dashboard's
"Teacher submission" column reads `exm_sheets.status` first and falls back to `att_exam_state`.

## 2. `exm_results/{cycleId}__{studentId}` and `exm_class_results/{cycleId}__{classId}`

Compiled per student per exam, versioned, the single source the parent app will read.

```
exm_results: { id, cycleId, studentId, classId, classLabel, name, grn, roll, termId, examTypeId,
  subjects: [{ paperId, subject, code, mode, theory, practical, internal, gradeValue, total, max, pct, grade, state, passed, weight }],
  total, maximum, pct, grade, passed, complete, rank (null unless rankScope != "none"),
  term: null | { termId, contributions: [{ cycleId, examTypeId, short, weight, pct }], pct },   // weighted mean of this student's
       // Compiled/Approved/Published exm_results in the same termId whose exam type countsInTerm, including this one
  status: "Compiled"|"Approved"|"Published"|"Superseded", version, stale: false,
  compiledAt, compiledBy, approvedAt?, approvedBy?, publishedAt?, supersededBy?, sourceHash, updatedAt, updatedBy }

exm_class_results: { id, cycleId, classId, classLabel, status (same enum), version, stale, students, passed, failed,
  incomplete, passPct, compiledAt, approvedAt?, publishedAt?, publishAt? (scheduled), sourceHash, updatedAt, updatedBy }
```

Rows come from `examOperations.consolidated(cycle, papers, candidates, marks, classes)` restricted to the class;
`sourceHash` = sha256 of the rows + cycle.resultRules (same approach as report batches). Rank uses
`cycle.resultRules.rankScope` as `consolidated` already does.

### Actions (all in `manageExamination`, same auth/idempotency/audit as existing actions)

| Action | Precondition | Effect |
|---|---|---|
| `compile` {classId} | every sheet of the class in this cycle is Approved or Locked; at least one sheet | writes/overwrites `exm_results` for the class with status Compiled (version = previous Published version + 1 if one exists, else max(existing version, 1)); sheets → Locked; `exm_class_results` Compiled, `stale:false`; cycle `stage:"tabulation"` if not already published. Bounds: 180 students × 150 papers, like report batches. |
| `signOff` {classId} | class result Compiled | → Approved, `approvedBy/At` on class and student docs. |
| `publishResults` {classIds[], publishAt?} | each class Approved, or Compiled when `cycle.resultRules.requireApproval` is false; not stale | immediate: status Published, `publishedAt`; previous Published versions of that class → Superseded (`supersededBy`); every paper of the cycle covering the class gets the class in `publishedClassIds` + label in `published` (existing projection/notification to parents runs); cycle `stage:"published"` when every class with sheets is published; `correctionPending=false` when nothing is stale. With `publishAt` (future ISO): store on the class result and let `publishScheduledExams` (5-min job) call the same publish routine when due. |
| `withdrawResults` {classId, reason} | class Published | status back to Approved, removes class from papers' `publishedClassIds`/`published`, audit. (Used before a correction when the school does not want stale results visible.) |

Correction flow = `sheetReopen` (marks results stale) → teacher/admin edits → `sheetSubmit` → `sheetApprove` → `compile`
(new version) → `signOff` → `publishResults` (version N+1; old version Superseded).

### Rules
- `exm_sheets`: admin read/write; teacher read where `ownerId == myStaffId()` (and the transition write above).
- `exm_results`, `exm_class_results`: admin read; server-only write (add to the deny list in `adminSchoolWrite`);
  parent read `exm_results` where `studentId in myStudents()` and `status == "Published"`.
- Indexes: `exm_sheets(cycleId)`, `exm_sheets(ownerId)` single-field (automatic); composite
  `exm_results(studentId, status)` and `exm_results(cycleId, classId)`.

## 3. Dashboard (`website/school-dash/src/features/exams`)

- **Exam detail → Marks Entry tab**: a *sheet board* above the marks grid. Columns: Subject · division, Owner (editable
  select → `sheetAssign`), Status badge, Entered / total, Absent, Out of range, Submitted at, Actions. Actions by status:
  open → "Submit on behalf"; Submitted → "Approve", "Return…" (note modal); Approved/Locked → "Reopen…" (reason modal).
  Header button "Open marks entry" (→ `openEntry`) when the cycle has no sheets; shows sheet counts by status otherwise.
  The marks grid (`ExamsPage` embedded) selects a sheet; its "Verify selected", "Lock/Reopen" and "Publish Subject
  Results" buttons are removed when the paper has sheets (kept for legacy cycles without sheets). Entry inputs are
  disabled when the selected sheet is Submitted/Approved/Locked, with the message above.
- **Results tab**: per class a card: sheets approved x/y, class status + version, stale flag, pass %, buttons Compile →
  Approve (when required) → Publish (with optional date-time) → Withdraw. Below: the existing `ExamSummary` grid
  for the selected class plus a "Term so far" column from `exm_results.term.pct` when present.
- **Overview tab**: stage badge (`cycle.stage`), and "Open marks entry" shortcut after the last paper date.
- **Top-level Exams page**: keep as is, minus the three legacy buttons when sheets exist.
- All calls go through `examService.examAction`. Pure UI helpers (allowed actions per status, counts) live in
  `features/exams/sheets.ts` with tests.

## 4. Teacher app (`mobile app/teacher`)

- `ExamsAdapter`: query `exm_sheets` where `ownerId == staffId`; one local exam per sheet (local id = sheet id,
  which equals the legacy `{paperId}@{classId}` only in shape; keep the `@` form for local ids and map to `__` for the
  remote sheet id). Papers that have **no** sheet keep the legacy assignment-based listing. Exam row gains
  `components` (mode, theory, practical, internal, passMarks, gradeOptions), `status` from the sheet
  (NotStarted/InProgress → "Draft", Submitted → "Submitted", Returned → "Returned" with `returnNote`,
  Approved/Locked → "Locked"), `rosterIds`.
- Marks entry: one field per component with max validation; grade dropdown for grade-only sheets; attendance status
  (Present / Absent / Medical Slip / Disqualified). `MarksAdapter.write` sends `theory`, `practical`, `internal`,
  `gradeValue`, `status`, `tag`, `note`, ids, `teacherId`, `enteredAt`.
- Submit: client validates every rostered student has a mark or a non-Present status, then writes
  `exm_sheets/{id}` `{status:"Submitted", submittedAt, submittedBy: staffId}` (merge). No `att_exam_state` write when a
  sheet exists. Returned sheets show the note and allow edits; Submitted/Locked are read-only.
- Tests in `test/adapters_test.dart` for listing, component writes, submit, and read-only states.

## Deploy

Server side of sections 1–2 ships as: the `manageExamination` callable (new actions `openEntry`, `sheetSubmit`,
`sheetReturn`, `sheetApprove`, `sheetReopen`, `sheetAssign`, `compile`, `signOff`, `publishResults`, `withdrawResults`),
the triggers `syncExamSheetSummary` (exm_marks → sheet summary / InProgress), `auditExamSheet` (teacher "Sheet submitted"
rows) and `notifyExamSheetReviewed` (owner push on Returned / Approved), and `publishScheduledExams` (now also publishes
`exm_class_results` whose `publishAt` is due). From `website/`:
`firebase deploy --project school-admin-tatos-2610 --only functions:manageExamination,functions:syncExamSheetSummary,functions:auditExamSheet,functions:notifyExamSheetReviewed,functions:publishScheduledExams,firestore:rules,firestore:indexes`
(the rules add the sheet-governed teacher marks branch, teacher reads/submit on `exm_sheets`, server-only
`exm_results`/`exm_class_results` with admin and parent reads; the indexes add `exm_results(studentId, status)` and
`exm_results(cycleId, classId)`). Implementation note: the rules dispatch a teacher marks write to the sheet rule through
`exm_papers.sheetsOpened`, which `openEntry` sets on every paper that has sheets, because a Firestore rules lookup of a
*missing* document exhausts the engine's evaluation budget on the legacy marks rule; the sheet document stays the
authority (a flagged paper whose division has no sheet denies the write until `openEntry` is re-run). Superseded result
versions are kept as `exm_results/{cycleId}__{studentId}__v{n}` and `exm_class_results/{cycleId}__{classId}__v{n}`
copies; the canonical id always holds the current version. Emulator checks: `cd website/functions && node --test
examSheets.test.js examResults.test.js` and, with the Firestore emulator on `RULES_TEST_PORT`,
`cd website/tools/rules_test && node examSheets.mjs`.
