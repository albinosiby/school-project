# Exams & Results: a workable real-world process

Status: proposal, 2026-11-12. Written against the current `website/school-dash/src/features/exams`,
`website/functions/exam*.js`, the teacher app's `ExamsAdapter`/`MarksAdapter` and the parent app's marks module.

## 1. Why the current process does not survive contact with a school

The code is solid, but the *process* it encodes is one a school office cannot run. The problems, in order of pain:

| # | What the module does today | Why a school cannot work like this |
|---|---|---|
| 1 | One 6-step wizard asks, for **every exam**, which subjects each division has, the theory/practical/internal split, pass marks, weights and grade descriptors. | A school decides its assessment scheme **once a year** (CBSE 80+20, Kerala CE/TE, ICSE 80/20, unit tests out of 20…). Re-typing 40 subject rows for every unit test is the first thing an office will refuse to do, and it is where inconsistencies between exams come from. |
| 2 | Setup is **frozen** at publish. Nothing can change after that, and nothing can change once a single mark exists. | Real exams change after publish: a paper's max marks was typed wrong, a subject was forgotten for 9-B, a transfer student joined. Today the only option is to recreate the exam. |
| 3 | Participants (`paper.studentIds`) are a **snapshot at publish time**. | Admissions and transfers continue after the timetable is published. A student who joins before the exam has no place to enter marks. |
| 4 | Teachers enter **theory only**; internal, practical and grade-only components must be typed by the **office**. | The subject teacher is the only person who knows the internal and practical marks. The office never has them. In practice the office would be transcribing paper sheets, which is the thing a product should remove. |
| 5 | Verification is a **per-student checkbox** in the web, with a fingerprint per mark. | 1,000 students × 8 subjects = 8,000 checkboxes per term for the exam cell. Nobody verifies marks row by row; they review a **sheet** (one subject, one division): totals, absentees, anomalies, and a spot check. |
| 6 | Teacher "Submit" (`att_exam_state`) is **cosmetic**: it locks nothing server-side, the admin never sees it as a gate, and teachers keep editing with a reason. | The handover moment ("I'm done, over to you") is the backbone of exam administration. It must flip ownership. |
| 7 | **Two publication paths**: subject-wise `subjectPublish` (parents get Maths on Monday, Science on Wednesday) and class report-card batches (prepare → submit → approve → publish). | Schools publish a term result **once, on result day**, for a whole class. Subject-wise drip is confusing for parents and creates "incomplete result" states (`expectedPapers`) that the apps have to paper over. Unit-test marks are the exception, and that is a policy, not a second workflow. |
| 8 | Each exam is an island: `calculation: total/average/weighted` only weighs papers *inside* one exam. | The report card a parent wants is **Term 1 = PT1 (10) + Half-yearly (80) + Notebook (5) + Enrichment (5)**, and the annual is Term 1 + Term 2. Cross-exam aggregation does not exist. |
| 9 | Re-exam/medical is a flag with no follow-up. | Absent and medical cases need a supplementary sitting whose marks land back in the original result. |
| 10 | Roles: only "admin" exists server-side. `approve` is the same person who `submit`s. | Schools separate **entry** (teacher), **review** (HOD / class teacher), **compile** (exam cell) and **sign-off** (principal). |

Points 1, 4, 5, 6 and 7 are the ones that make it infeasible. Points 2, 3, 8, 9, 10 are what make it incomplete.

## 2. The process schools actually run

Every school, whatever the board, follows the same five stages. Different boards only change the numbers.

```
A. Academic setup (once per year, academic coordinator)
   terms · exam types & weightage · grading scales · subject scheme per class group · co-scholastic areas
        │
B. Exam event (per exam, exam cell)
   create from scheme → timetable & halls → invigilation → open marks entry
        │
C. Mark sheets (per subject × division, subject teacher → reviewer)
   enter all components → submit → review/return → approve   (unit of work = the sheet, not the mark)
        │
D. Result compilation & publication (per class, exam cell → principal)
   compile (totals, grades, rank, term aggregation) → class-teacher remarks → sign-off → publish on result day
        │
E. After the result
   corrections as a new version · supplementary exam · annual promotion list · rollover
```

The rest of this document specifies each stage, maps it onto the existing collections, and ends with a migration order.

## 3. Stage A: Academic setup (replaces wizard steps 3 and 5)

Lives under **Settings → Academics** (the `set_*` family). Set once per academic year, copied forward by rollover.

**A1. Terms** – already `set_terms`. Add `weight` (Term 1: 50, Term 2: 50) for the annual result.

**A2. Exam types** – new `set_exam_types/{id}`:
`{name:"Periodic Test 1", short:"PT1", termId, weight:10, maxMarksDefault:20, shareSubjectWise:true, countsInTerm:true}`.
`shareSubjectWise` is the policy switch that replaces the separate subject-publish workflow (see D4). Typical CBSE
middle-school set: PT1 10, Notebook 5, Enrichment 5, Half-yearly 80 → Term 1 100.

**A3. Grading scales** – `set_grading` already stores the CBSE 9-point bands. Make it `set_grade_scales/{id}` with
`{name, bands:[{grade, min, point}], kind:"scholastic"|"co-scholastic"}` so a school can have "9-point", "5-point A–E"
and "Primary descriptors". Each class group picks its scale; each exam can override.

**A4. Subject scheme per class group** – new `set_subject_schemes/{grade or grade_stream}`:
```
{ classGroup:"9", scaleId:"cbse9",
  subjects:[
    { subject:"Mathematics", code:"041", components:[
        { key:"theory",   label:"Theory",   max:80, passMin:26, enteredBy:"subjectTeacher" },
        { key:"internal", label:"Internal", max:20, passMin:0,  enteredBy:"subjectTeacher" } ],
      passRule:"aggregate", aggregatePassPct:33 },
    { subject:"Work Education", mode:"grade", scaleId:"co5", enteredBy:"classTeacher" } ],
  coScholastic:["Work Education","Art","Health & PE","Discipline"] }
```
`enteredBy` is the ownership rule that fixes problem 4: `subjectTeacher | classTeacher | office`. The office can
always enter on behalf (with audit) but is never the default owner of internal marks.

The wizard's "Subjects & Assessment" step becomes **"Pre-filled from the Grade 9 scheme; change only what differs
for this exam"** (for a unit test: max 20, no practical).

## 4. Stage B: Exam event (the trimmed wizard)

`exm_cycles` stays, with a real lifecycle. The current `status` (`Draft|Scheduled|Live|Completed`, of which only
two values are ever written) becomes:

```
Draft ──publish timetable──► Scheduled ──open marks entry──► MarksEntry ──all sheets approved──► Tabulation
      ◄── edit freely ──              ◄── amend with reason ──                                      │
                                                                                                    ▼
                                                                     Published ◄── sign-off ── UnderReview
                                                                        │
                                                                        └──► Closed (after corrections window)
```

**Wizard steps** (four, not six): 1 Basics (name, exam type, term, dates, classes) · 2 Subjects & marks
(pre-filled from scheme, editable) · 3 Timetable & halls (optional at creation; can be filled later) · 4 Review.
Result rules move to the exam type; grading scale comes from the scheme.

**What "publish" means** changes: it publishes the **timetable** to teachers and parents. It does not freeze the
assessment configuration.

**Amendments** (problem 2): after publish, Subjects & marks are editable until the exam enters `MarksEntry`.
After that, a change to a paper's components requires a reason, bumps `setupVersion`, and marks that paper's
sheets `needsRecheck` (reviewers see "Max marks changed from 80 to 70, re-approve"). No hard block, no recreating
the exam. The existing `setupVersion` and fingerprint machinery already supports this.

**Participants** (problem 3): drop `paper.studentIds`. A paper covers `classIds` plus `excludedStudentIds`. The
roster is resolved from `students` live until the sheet is created (B→C transition), then stored on the sheet. A
sheet has "Add student" (late admission) and "Mark as not appearing" (transfer-out), both audited.

**Operations** (timetable changes, postpone/cancel, duties, calendar-clash checks) stay exactly as built. They are
good and already transactional.

**Open marks entry** is an explicit admin action (or automatic on the day after the last paper): it creates one
`exm_sheets` document per paper × division and notifies owners. This is the moment the current code lacks.

## 5. Stage C: Mark sheets (replaces per-mark verification and `att_exam_state`)

New collection `exm_sheets/{paperId}__{classId}`:
```
{ cycleId, paperId, classId, subject, components:[...from paper...],
  ownerId (staff), reviewerId (staff), rosterIds:[...],
  status:"NotStarted"|"InProgress"|"Submitted"|"Returned"|"Approved"|"Locked",
  submittedAt, submittedBy, reviewedAt, reviewedBy, returnNote,
  summary:{ entered, absent, medical, exempt, highest, lowest, mean, outOfRange },
  needsRecheck:false, version:1 }
```

`exm_marks` stays as the per-student row (it is what `par_results` and the apps already read), but
`verified`/`verificationFingerprint` are **set in bulk by sheet approval**, not by a checkbox. `att_exam_state` is
retired; its one field (`Submitted`) is `exm_sheets.status`.

**Owner** = `paper.evaluatorIds[classId]` → else the `assignments` teacher → else the class teacher → else "Unassigned"
(shown as an attention item on the exam overview). Admin can reassign.

**Entry** – the owner enters **every component** the scheme gives them (theory, internal, practical, or a grade), in the
teacher app or the web. The web grid is the same component for teacher and office; "office entering on behalf of
Mrs. X" is recorded in `enteredBy`. CSV import per sheet stays.

**Submit** (owner) – allowed only when every rostered student has a mark **or** an attendance status
(Absent / Medical / Exempt / Disqualified), and nothing is out of range. On submit the sheet becomes `Submitted`,
the owner's app goes read-only for it, and the reviewer is notified. This is the real handover (problem 6).

**Review** (reviewer: HOD, class teacher or exam cell, per school policy) – sees the **sheet summary** and the
anomaly list, not 40 checkboxes:
- out-of-range or blank cells (should be none after submit),
- absentees that do not match exam-day attendance in `att_records` (the attendance module already has the data),
- students with 0 or full marks, students whose mark differs >40 points from their last exam in the subject,
- a random 10% sample for a manual spot check against the physical answer scripts (optional, configurable).

Reviewer either **Approves** (bulk-sets `verified:true` with fingerprints on all marks, status `Approved`) or
**Returns** with a note (status `Returned`, owner notified, owner edits and resubmits; `version++`).

**Lock** – when the class result is compiled (stage D) every sheet of that class becomes `Locked`. Reopening a
locked sheet is the only way to correct a mark afterwards, needs a reason, and re-enters stage D (see E1).

`paper.locked`, `lockedClassIds`, `published`, `publishedClassIds` and `marksEntered` all collapse into sheet status.
The Firestore rule for teacher writes becomes "the sheet is `NotStarted|InProgress|Returned` and I am its owner"
instead of the current six-condition `paperLocked()`.

## 6. Stage D: Result compilation and publication (one path, per class)

**D1. Compile** (exam cell, per class, enabled when every sheet of the class is `Approved`): writes
`exm_results/{cycleId}__{studentId}` – one document per student per exam with every component, subject total, grade,
aggregate, percentage, pass/fail, rank, plus the **term and annual aggregates** computed from `set_exam_types.weight`
over the student's other `exm_results` in the same term/year (problem 8). This replaces the report-card snapshot
(`exm_report_cards`) as the single source parents read; the PDF is rendered *from* it.

**D2. Remarks & co-scholastic** (class teacher, in the app or web): co-scholastic grades, attendance (pulled from
`att_records`, editable), class-teacher remark. These live on `exm_results`, not in a side collection.

**D3. Sign-off** (principal / whoever `set_roles` says): sees the class result sheet (the existing `ExamSummary`
grid is already this), the pass %, the rank list and the anomaly count. Can **send back one sheet** (which reopens
only that subject × division to `Returned`, keeps everything else) or **approve the class**. `requireApproval`
remains the per-exam-type switch for small schools where the exam cell and the principal are the same person.

**D4. Publish** (exam cell): one action per class or "all approved classes", with an optional **result date-time**
(the existing `publishAt`/timezone machinery, reused). Parents receive the full result card and the PDF link.
If the exam type has `shareSubjectWise:true` (unit tests), marks of an **approved sheet** are pushed to
`par_results` immediately on approval, so the fast-feedback case is a policy on the exam type, not a second
workflow with its own buttons and locks (problem 7). `expectedPapers` is no longer needed because a subject-wise
share is explicitly partial by design and labelled as such in the parent app.

**Report card PDF**: `exm_report_templates` and `downloadExamReport` stay; the batch concept goes. A published
`exm_results` doc *is* the versioned snapshot (`version`, `publishedAt`, `supersededBy`).

## 7. Stage E: After the result

**E1. Corrections**: "Correct a mark" on a published result → pick the sheet → reason → sheet goes `Returned` to its
owner → resubmit → re-approve → class goes back to `UnderReview` for just the affected students → republish as
`version 2`. Parents see "Revised on {date}" on the card. Old version stays readable in the activity log. This is
what `EXAMS_ENHANCEMENT.md` promised; it becomes the only correction path.

**E2. Supplementary / re-exam** (problem 9): from the class result, "Create supplementary" for the Absent/Medical/
Failed students in chosen subjects. It is a small `exm_cycles` record with `supplementaryOf: cycleId` and a scheme
rule `replace | cap:33 | best-of`. Its approved marks write back into the original `exm_results` as version 2.

**E3. Annual result and promotion**: at year end, "Compile annual" aggregates every term's `exm_results` by the
term weights, applies the promotion rule from the scheme (pass all / pass aggregate / compartment allowed in N
subjects), and produces the **promotion list** the principal signs. `academicRollover` consumes it instead of
promoting everyone.

## 8. Roles (problem 10)

| Role (from `set_roles` / staff `permissions`) | Can |
|---|---|
| Academic coordinator | Stage A |
| Exam cell / office | Stage B, D1, D4, reassign owners, enter on behalf |
| Subject teacher | own sheets: enter, submit |
| Class teacher | D2 for own class; review sheets of own class if policy says so |
| HOD | review sheets of own department if policy says so |
| Principal | D3 sign-off, authorise corrections and supplementary |

Reviewer policy is one setting per school: `sheetReviewer: "hod" | "classTeacher" | "examCell"`. Small schools pick
`examCell` and the whole thing collapses to teacher → office → publish, which is still a correct process.

## 9. What stays, what changes (migration map)

| Today | Proposal |
|---|---|
| `exm_cycles` | keep; new `status` lifecycle, add `termId`, `examTypeId`, `supplementaryOf` |
| `exm_papers` | keep for timetable/duties; components come from scheme; drop `studentIds`, `locked`, `lockedClassIds`, `published`, `publishedClassIds`, `marksEntered` |
| `exm_candidates` | drop; roster lives on the sheet |
| `exm_marks` | keep shape; `verified` set by sheet approval |
| `att_exam_state` | replaced by `exm_sheets.status` |
| per-mark Verify button, Lock/Reopen per paper, Publish Subject Results | replaced by sheet Submit / Return / Approve and class Publish |
| `exm_report_batches` + `exm_report_cards` | replaced by versioned `exm_results` |
| `exm_report_remarks` | folded into `exm_results` |
| `exm_duties`, `exm_schedule_history`, `exm_activity`, `exm_requests`, `manageExamination` | keep as is; add actions `openEntry`, `sheetSubmit`, `sheetReturn`, `sheetApprove`, `compile`, `signOff`, `publishResults`, `correct`, `supplementary` |
| `set_terms`, `set_grading`, subject list | keep; add `set_exam_types`, `set_subject_schemes`, promote grading to named scales |
| Teacher app `ExamsAdapter` (theory-only, `{paperId}@{classId}`) | list `exm_sheets` where `ownerId == me`; all components; Submit flips status |
| Parent app `mergePublished` + `expectedPapers` | read `exm_results` (published) and, for subject-wise exam types, `par_results` tagged partial |

Nothing in stages B-operations (timetable, duties, clash checks, notifications, activity log, idempotent callable)
needs rewriting. That is roughly half of the current code and it is the half that is right.

## 10. Suggested build order

1. **Stage A settings** (`set_exam_types`, `set_subject_schemes`, named grade scales) and the pre-filled wizard.
   Ships value on its own: creating an exam drops from 40 rows to 4 screens.
2. **`exm_sheets` + Submit/Return/Approve** in the callable and rules; teacher app lists sheets and enters all
   components; web grid becomes the same component for teacher and office. Remove per-mark verify.
3. **Compile + Publish per class** on `exm_results`, with term aggregation; PDF rendered from it; parent app reads it.
   Retire subject-publish buttons; add `shareSubjectWise` policy.
4. **Corrections as versions, supplementary, annual promotion list.**

Each step leaves the system working end to end, and step 1 can be done without touching the mobile apps.

## 11. Implementation status (2026-11-12)

| Stage | Status | Where |
|---|---|---|
| A. Academic setup (exam types, subject schemes, pre-filled wizard) | Built | Settings → Assessment Scheme; `assessmentScheme.ts`; contract "Assessment scheme" |
| B. Exam event | Existing wizard + operations kept; `stage`, `examTypeId`, `termId` added | `CycleForm.tsx`, `saveExamSetup.ts` |
| C. Mark sheets (open entry, owner, all components, submit / return / approve / reopen / reassign) | Built: server actions, rules, triggers, dashboard sheet board, teacher app | `EXAMS_SHEETS_RESULTS_CONTRACT.md` §1, §3, §4 |
| D. Compile, sign-off, publish per class, scheduled publish, withdraw, term aggregate | Built | contract §2; `ClassResultsPanel.tsx` |
| E. Corrections as new versions | Built (reopen → stale → recompile → republish vN+1, archived `__v{n}` copies) | contract §2 |
| E. Supplementary exams, annual promotion list | Not built | — |
| Named grade scales; scheme `enteredBy` enforcement; parent app reading `exm_results` directly; report-card PDF rendered from `exm_results` | Not built (parents still receive results through `par_results`; report-card batches still work because sheet approval sets `verified`) | — |
