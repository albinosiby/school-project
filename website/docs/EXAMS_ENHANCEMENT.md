# Exams & Results enhancement

## Product and scope

Office administrators need to operate an examination after its timetable is published: move papers, allocate duties, follow up marks, verify results and issue a consolidated report. Teachers retain their assigned-paper, theory-only mobile workflow. Parents retain published subject results and gain separately published report-card downloads. The supplied enhancement brief is the approved scope; the existing six-step creation wizard remains the entry point. No sample data or replacement exam collections are introduced.

The main risk is publishing a result from marks that changed after review. Another is parallel schedule changes reserving the same room or invigilator. Both need server transactions, not just disabled controls. This is an internal enhancement, so a competitor comparison is not needed.

## Existing architecture (inspection)

Next.js 16.4 / React 19 school dashboard uses shared UI primitives and school-scoped realtime Firestore listeners. `exm_cycles`, `exm_papers`, `exm_candidates`, `exm_marks` and `exm_duties` already exist. `saveExamSetup` saves draft/publication configuration; `examPublication` publishes due cycles every five minutes. `examAssessment` supplies calculations to web and parent projections. `parent.js` projects separately published subject results into `par_results`. Flutter teacher adapters read assignments/duties and write permitted theory marks. Admin authentication includes passkey session validation, school suspension and academic-rollover checks. `appMessaging` supplies an idempotent in-app feed / FCM outbox. There is no reusable real report-card PDF generator: existing PDF actions are print dialogs or simulations.

## Architecture and API

Extend existing records with operational state; preserve old status fields for mobile compatibility. Add `manageExamination`, a school-scoped callable with explicit actions for schedule, duties, locks, subject publication, report preparation/approval/publication, templates and remarks. Requests include `schoolId`, `cycleId`, `action` and a UUID `requestId`; duplicate requests replay their stored response. Invalid input returns `invalid-argument`; changed records/conflicts return `failed-precondition`; wrong role/tenant returns `permission-denied`.

Example: `{ action: "schedule", schoolId, cycleId, requestId, changes: [{ paperId, date, start, duration, venue, invigilatorId, scheduleStatus: "Scheduled" }], reason, notify: true }`. The server re-reads current records and serializes changes through the existing schedule guard. Report publication recomputes a source fingerprint, checks verified complete marks and locks the source papers. Parent PDF access is checked against current child membership, current credential version and publication state.

## Data model and indexes

- Existing cycles/papers: optional operational status and schedule revision; no rewrite/migration of historic records.
- `exm_schedule_history`: immutable old/new paper schedule, reason, actor and notification request.
- `exm_activity`: server-created append-only events with previous/new values and exam/paper/student references.
- `exm_requests`: idempotency receipts, server-only writes.
- `exm_report_templates`: reusable school templates and optional class applicability.
- `exm_report_remarks`: per-cycle/student remarks and optional attendance summary.
- `exm_report_batches`: one immutable-source class preview/approval/publication version; prior publication remains historical.
- `exm_report_cards`: one snapshot per participating student in a batch, with full component results, aggregate, school branding and template.
- Existing `push_deliveries`: actual delivery status; no duplicate email/SMS service. Schedule-history/report-batch triggers queue existing app notifications with stable source IDs.

New screens query by cycle or batch using single-field indexes, then sort bounded cycle data in memory. No composite indexes are required for these queries. Critical transactions are bounded; very large cycles must be split rather than silently partially published. PDF downloads are bounded per class batch. Firestore's 1 MB document limit applies; report content is stored per student rather than in a single class document.

## Frontend and workflow

Keep the existing visual tokens, four summary cards, wizard, marks grid and duty editor. Add operational overview, attention list, upcoming timetable, recent actions and links to `/exams/[id]`. The detail workspace has Overview, Participants, Assessment Configuration, Timetable, Invigilation, Marks Entry, Verification, Results, Reports and Activity Log. Tabs mount their operational sections on demand. Use actual listeners, visible loading/error/empty states and async controls that prevent repeat submission.

Report workflow: complete and verify required entries → prepare class preview → inspect/download draft PDF → submit → approve if required → publish → parents download published version. Corrections require reasoned administrator reopening and a new version; old snapshots remain available in history. Subject results keep separate publication controls. School timezone governs local dates; rescheduling retains local wall times, matching existing paper schema. Optional academic-calendar blocking applies only to explicitly blocking calendar records.

## Delivery milestones

Compatibility details: old verified marks remain readable, but new consolidated reports require verification fingerprints. Staff can select and verify legacy rows again. Fingerprints invalidate on edits immediately in calculations, and a server trigger clears stale stored flags. Subject publication retains legacy labels and adds exact `publishedClassIds`; one division can publish while other divisions on that paper continue entry. Paper-wide reopening withdraws subject publications and requires an administrator's reason. Historic report snapshots remain unchanged until corrections are published as a new version.

Parent projections carry `expectedPapers` so partial subject publication does not appear complete. Published report snapshots override subject projections in the parent app. PDF links expire after five minutes and check the current account, child membership, credential version and batch status on access. Expired links are cleaned by the existing exam scheduler. Students have no separate authenticated app role in the current architecture; the family notification channel is the parent account. No email/SMS service was added.

1. Inspect/document contracts and establish operational models.
2. Dashboard and cycle workspace.
3. Transactional schedule/duty changes and history.
4. Verification, locks and detailed consolidated results.
5. Versioned report previews, approvals, PDF and parent access.
6. Immutable audit events and durable notifications.
7. Focused unit/integration/rules tests, production build, deployment guide.

Estimate: a full production rollout needs staged school acceptance across timetable changes, marks and report previews; implementation timing depends on existing data and acceptance feedback.

## Security and validation

Server checks tenant, role, administrator MFA, suspension and rollover before mutations. Privileged operations and generated snapshots are denied to direct client writes. Audit/history cannot be edited through normal app workflows. Teacher permissions remain limited to assigned supported components, including zero/blank distinctions and participant exclusions. Report generation never fetches arbitrary remote branding URLs. PDF assets come only from school-scoped Storage paths. Approval must apply to the exact marks snapshot being published.

## Testing and operations

Test schedule overlaps, cancellation/postponement, concurrent changes, stale report approval, missing/unverified marks, component/grade-only/exempt/absent treatment, ranking, tenant isolation, locked marks and request replay. Run existing wizard/marks/duties tests and the production build. Generate and render an A4 report sample for layout QA. Deploy functions and security rules with the web app; scheduled publication retains its existing five-minute job. No destructive migrations or new secrets are needed. Keep Firestore backups/exports before rollout and retain old report snapshots for recovery. Functions log failures without student marks in operational logs; the existing delivery outbox exposes failed notifications. CI should run focused web tests, backend tests and emulator rules checks before deployment.

## Setup and deployment runbook

The existing database is Firestore Standard `(default)` in `asia-south1`. There is no data migration/backfill; new fields are optional on historic records. Run `npm ci` in `website` and separately in `website/functions` (Node 22). PDFKit is the only new runtime dependency. Bundled Plus Jakarta Sans fonts retain their OFL license under `functions/assets`. Templates support optional authorized PNG/JPEG signature images under 100 KB and 1500 × 600 pixels. Previews preserve a copy of school branding in a school-scoped Storage path.

Validation commands:

```sh
# website/school-dash
npm run test -- src/features/exams
npm run lint -- src/features/exams
npm run typecheck
NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack

# repository root
node --test website/functions/examAssessment.test.js website/functions/examOperations.test.js

# website/tools/rules_test, with Firestore emulator on RULES_TEST_PORT (default 18081)
node examManagement.mjs
node exams.mjs

# mobile app/parent
flutter test --no-pub test/marks_rules_test.dart test/academics_test.dart test/firebase_repositories_test.dart
```

Production deployment is a separate operational step: release functions and Firestore rules/indexes together, then the school dashboard and updated parent/teacher apps. The updated teacher client displays division-level report locks; older clients remain protected by server rules. Review other work-in-progress rules changes already in this workspace before releasing them. Use the existing Hosting deployment bridge if the Next adapter requires Webpack. This feature does not require deploying landing/superadmin.

Exam functions to release: `manageExamination`, `downloadExamReport`, `openExamReport`, `auditExamCycle`, `auditExamPaper`, `auditExamMarks`, `auditExamDuty`, `auditExamSubmission`, `invalidateChangedExamMarks`, `notifyExamScheduleChanged`, `notifyExamReportsPublished`, `publishScheduledExams`, `onExamTimetablePublished`. Also release `onPaperForParents`, `onMarkForParents`, `onExamPaperChanged` and the existing `onAppPushQueued` outbox worker if its prior changes are not deployed. Select explicit `functions:name` targets to avoid deploying unrelated work. From `website`, deploy rules/indexes with `firebase deploy --only firestore:rules,firestore:indexes --project school-admin-tatos-2610` when releasing.

No new production secrets, SMTP configuration or signing service are required. Local phone testing can set `EXAM_LINK_EMULATOR_HOST` to the computer's reachable host/port; the parent app retains its existing `EMULATOR_HOST` and `EMULATOR_PROJECT` defines. Report links use `openExamReport`, avoiding permanent public Storage tokens. An index for parent queries on `exm_report_cards(studentId, status)` is included.

Release acceptance: create/edit a draft; publish/schedule; reschedule a paper; assign duties; enter/verify marks in web and the assigned teacher app; publish one subject division; prepare/approve/publish a report; open the correct child's PDF in the parent app; reopen with a reason and confirm a stale preview cannot publish. Live push delivery requires registered devices. `Queued` is an outbox state, not proof that a device displayed the message.

Explicit operational bounds: a schedule mutation supports 150 papers within the transaction write budget; a class report batch supports 180 students and 150 papers; PDF responses are capped at 7 MB. Larger cohorts get an error instead of partial publication. Existing listeners remain school/cycle scoped; high-volume schools need server pagination and an audit-retention policy before increasing these bounds.
