# Dashboard hardening and Firebase integrations

## Product and scope

School administrators need reliable admissions totals, attendance coverage, payments, communications and year-end operations. Teachers and HODs must be restricted to their assigned classes and subjects. Parents and transport crew receive school messages through their registered mobile apps. Existing repository architecture and UI are retained; a competitor comparison is not relevant to this corrective release.

The priority order is authorization, atomic money operations, observable loading errors, accurate metrics, then real FCM, passkeys and rollover. No real payments, broadcasts, passkey enrollments or academic promotions are created by the test suite. WhatsApp/SMS providers are outside the selected Firebase Messaging implementation.

## Architecture and data flow

The Next.js client uses school-scoped Firestore listeners, with refcounts, teardown, stale-snapshot protection, explicit failure states and real retries. Identical filtered queries share a listener. Dashboard attendance and payment reads are limited to the school-local date; class attendance and marks are scoped to the selected class. Queries use standard single-field indexes. Large historical ledger/report screens still require their underlying historical records; those have not been arbitrarily capped.

Privileged operations use callable Firebase Functions in `asia-south1`:

| Callable | Main request | Result and invariants |
| --- | --- | --- |
| `recordFeePayment` | `{requestId, invoiceId, amount, mode, reference?, date?, claimId?}` | `{payment, replayed}`; invoice, payment, receipt counter, reference reservation, claim and audit commit atomically. Retry with the same request ID after an ambiguous network error. |
| `setClassTeacher` | `{classId, teacherId, create?}` | Saves class teacher and a unique teacher reservation transactionally. Empty teacher ID unassigns. |
| `rebuildTeachingAccess` | `{schoolId?}` | Rebuilds trusted indexes from current assignments and periods. Owner callers provide a school ID. |
| `manageAdminMfa` | `{action, challengeId?, response?, label?, code?, id?}` | Status, enrollment, verification, recovery or credential management. Completed verification returns a Firebase custom token. |
| `manageAcademicRollover` | Preview: `{action:"preview", sectionPolicy, grade10Targets}`; execute also includes `{fromYear, planHash, signed:true, confirm:"ROLLOVER"}` | Returns an authoritative plan or a persistent worker job ID. `resume` restarts a failed job using its saved progress. |

Callable authentication comes from the verified Firebase ID token. Roles, school suspension, live administrator MFA requirements and rollover locks are checked server-side. Errors use callable status codes; the client preserves payment request IDs so retries cannot charge twice.

## Data model

All school data remains below `schools/{schoolId}`. New server-owned collections are:

- `fee_payment_requests/{uuid}`: immutable request fingerprint and resulting receipt.
- `fee_counters/receipts`: serialized receipt sequence, bootstrapped from legacy receipts once.
- `fee_payment_references/{sha256}`: unique normalized transaction-reference reservation.
- `teaching_access/{classId}__{teacherId}`: class and subject anchors to the actual assignment/period documents. Rules revalidate anchors, so stale indexes cannot preserve revoked access.
- `class_teacher_assignments/{teacherId}`: unique class-teacher reservation.
- `push_deliveries/{sha256(source,uid)}`: durable FCM job, lease, attempts and hashed per-token outcomes.
- `academic_rollovers/{sourceYear}`: immutable parameters, progress, actor and worker state.
- `academic_archives/{sourceYear}/{collection}/{id}`: source-year snapshots retained before any promotion.

Administrator public keys, short-lived challenges and hashed recovery codes live in server-only `admin_security/{uid}`. `users/{uid}.mfaVersion` is server-managed. Neither clients nor school administrators can directly forge payment records, teaching grants, reservations, push jobs, rollover jobs, archives or MFA metadata. File types, sizes, required fields, numeric ranges and ownership are validated at their write boundaries.

## Firebase Messaging

Quick Notice and the notice composer publish `com_notices`; functions resolve registered teacher, parent and crew audiences and create deterministic feed entries and push jobs. Drafts do not broadcast. Existing published notices are not resent merely because a delivery counter changes. Scheduled notices use the same path.

FCM retries preserve successful device results, remove invalid tokens, and filter obsolete parent credential versions. Teachers' notification preferences and quiet hours are respected. The app feed remains available when a user has no registered device. FCM acceptance is not proof that a device displayed or read a notification; read/acknowledgment counters remain separate. A crash between an FCM response and its checkpoint may still repeat a push, so stable notification IDs and platform collapse tags are used.

Calendar publication and the optional 48-hour app reminder use this queue. Reminders use the school's timezone and deterministic event/time IDs. Circulars are actual PDF/DOCX uploads, up to 15 MB, with stored Storage paths and preview URLs. Failed saves retain the successfully uploaded attachment for retry. A file uploaded before a permanently abandoned save may remain unreferenced; it can be reviewed under the school's calendar-document prefix.

## Passkey MFA

Profile → Hardware MFA registers a security key or passkey only after a verified WebAuthn ceremony. The browser/device owns the private key; the backend stores its public key and counter. Challenges expire after five minutes, are bound to the administrator, origin, RP ID and current MFA version, and are consumed once. User verification is required. Only a verified, current-version custom-token session can use school data and administrative callables after enrollment. Sessions require second-factor verification again after twelve hours.

Eight recovery codes are shown once on initial enrollment and stored only as hashes. They require a recent primary sign-in, are rate-limited and work once, including under concurrent requests. Recovery also lets an administrator enroll a credential on another approved website origin. The last key cannot be removed without adding another key or deliberately disabling MFA.

Default origins are localhost/127.0.0.1 on port 3000 and this project's `web.app`/`firebaseapp.com` admin domains. Set `WEBAUTHN_ORIGINS` to an explicit comma-separated allowlist before adding a custom admin domain. Never derive the allowed RP ID from untrusted client input. Existing administrators remain unenrolled until they choose to register.

## Academic rollover

Settings → Year-End Rollover first prepares an authoritative, downloadable plan. The administrator chooses preserved or unassigned next-year sections. Grade 10 requires an explicit configured Grade 11 course/class. LKG advances to UKG, UKG to Grade 1, other grades advance once, and Grade 12 graduates. Missing target classes and unresolved school exceptions block execution. A stale plan must be reviewed again.

Execution requires sign-off and the exact text `ROLLOVER`. A persistent worker locks school writes, snapshots roster, classes, assignments, timetable, attendance, exams, terms and the financial ledger in chunks, then promotes active students and clears their roll numbers. Inactive students retain their placements. Existing class teachers and timetable remain for review. Existing balances and receipts are retained without creating duplicate debts. Old terms close, and the academic year changes only after promotion finishes.

The worker resumes from committed cursors after retries or process failure, and continues if the browser closes. Administrators can read progress during maintenance; mobile school reads pause to avoid showing a partially promoted roster. Unexpected errors retain the archive and maintenance lock, with a Resume action. Do not manually delete a running job or release its lock. An operator can inspect Cloud Logging and recover from the immutable source-year archive if a repair is needed. No rollover is executed automatically during deployment.

## Verification and operations

Use the isolated validation workspace or a local emulator. Never aim destructive test fixtures at a live project. The backend test scripts enforce a `demo-*` project and emulator host. Run:

```sh
npm test --workspace @edvio/school-dash
npm run lint --workspace @edvio/school-dash
npm run typecheck --workspace @edvio/school-dash
npm run build --workspace @edvio/school-dash -- --webpack
RULES_TEST_PORT=8873 node tools/rules_test/test.mjs
node tools/rules_test/hardening.mjs
GCLOUD_PROJECT=demo-dashboard-mfa FIRESTORE_EMULATOR_HOST=127.0.0.1:8873 node --test tools/dashboard_hardening_test/mfa.cjs
```

The `payments.cjs`, `messaging.cjs` and `rollover.cjs` scripts in the same directory test transaction races, idempotency, FCM retries and full multi-chunk promotion. `tools/rules_test/storage.mjs` requires Firestore on 8874 and Storage on 9198, running together. Tests include both legitimate mobile-app writes and privilege-escalation attempts.

Deploy targeted functions first, backfill teaching indexes, then release rules and the client. The Firebase connector's status must be independently checked against the deployed function list; this release required the CLI fallback. Use explicit `functions:notify:<name>` targets. Retry-enabled triggers require the CLI's reviewed `--force` option. Do not redeploy unrelated dirty workspace changes or delete unspecified functions.

For the matching existing admin Hosting target, `tools/deploy_admin.cjs` bridges the current Firebase CLI adapter: it selects the validated Webpack bundler and excludes `.next/dev` and build caches from the server artifact. It leaves the running developer's `.next/dev` untouched. Run it with the absolute path to the installed `firebase-tools/lib/bin/firebase.js`. It was verified with Firebase CLI 15.35.0; review the bridge if that adapter changes. Local discovery uses a sixty-second timeout. The underlying Hosting framework integration remains the existing project deployment architecture.

Cloud Logging records function failures without password, recovery-code or token content. Inspect failed push jobs and rollover state during support. Source-year archives protect academic rollback/recovery; financial idempotency records and receipts must be retained together. A production CI pipeline should run the commands above before deployment and use a dedicated deployment identity. Live device display, hardware-key enrollment on an actual administrator account and a real-school rollover require the user's own device/explicit operation and are not substituted with test success.

Security review note: I've set up prototype Security Rules to keep the data in Firestore safe. They are designed to be secure for school isolation, assigned-class access, protected payment records, MFA sessions and immutable rollover archives. However, you should review and verify them before broadly sharing your app. If you'd like, I can help you harden these rules.
