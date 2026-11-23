# Certificate Management

The school admin Certificates page manages six student formats (Transfer, Bonafide, Character, Study, Date of Birth, Conduct) and six staff formats (Employment, Experience, Salary, Service, Appreciation, Relieving). Existing Annual Fee/Other requests and signed files remain readable. Staff salary records are administrator-only; the parent app queries certificates by its linked student ID.

## Office workflow

1. Open Certificates and choose Issue certificate. Select Student or Staff and search the existing school register.
2. Choose a format and review its required details. Names, register numbers, class/designation and recorded DOB come from the recipient's profile. Fix an incorrect register entry in the profile first.
3. Enter an authorised signatory, issue date and purpose. Review conduct, leaving details, salary and clearance explicitly; the system never assumes clearance.
4. Preview the draft PDF, save a completed draft, or issue it. The server reserves the next unique school/year reference before rendering. A failed render appears under Drafts as Preparing; Resume issue uses the same reviewed snapshot and number. Cancel an unfinished issue with a reason if it cannot be resumed. Reserved numbers are not reused.
5. Open an issued record to download/print the stored PDF. For manual signatures, print, sign and attach the signed PDF (maximum 6 MB). The original remains downloadable from history.
6. Revoke with a reason when a correction is required. Administrators can download the archived copy; parents cannot download revoked certificates. Create replacement links the new issue to the revoked original. Saved files already downloaded cannot be recalled, so recipients must check the QR's current validity.

Templates support plain-text placeholders, title, accent, default signatory/designation and approved PNG/JPEG signature/seal images up to 100 KB. Changes affect future issues. A signature image is an approved visual asset, not a cryptographic digital signature. Migration/board-issued certificates and bulk award certificates are outside this release.

## Data and architecture

`certificateCatalog.json` is public static metadata shared by the admin UI and the deployable Functions codebase. Cloud Functions validate the authoritative register record and template, reserve numbers in transactions, generate a PDF with bundled fonts and QR, store it privately, then mark the record Issued. The client cannot write office records, counters, templates, indexes or history directly. Revisions prevent stale edits; UUID operations and fingerprints make retries idempotent. Preparing records are not valid certificates.

All school collections are below `schools/{schoolId}`:

| Collection | Purpose |
| --- | --- |
| `certificates` | Existing requests plus v2 snapshots, recipient kind, revision, reference, status and stored PDF path/hash |
| `certificate_templates` | One validated, versioned template per type |
| `certificate_snapshots` | Private frozen template/signature/seal bytes for retries; image data is excluded from directory records |
| `certificate_counters` | Transactional sequence per school/calendar year |
| `certificate_operations` | Idempotency fingerprint and original result, admin-only |
| `certificate_history` | Append-only actor, timestamp, action and reason; historical PDF paths |
| `certificate_reference_index` | Hash of reference to certificate ID for exact lookup |
| `certificate_verification_index` | Hash of random verification token to certificate ID |

Global private `certificate_school_index` maps the printed `SCH-…` public school code to the internal school ID; internal authentication UIDs are not printed on new certificates. Global private `certificate_download_tokens` contain five-minute bearer grants, credential versions and expiry; `certificate_verification_limits` store hashed IP/minute rate counters (60/minute). Verification returns only school, type, reference, issue/expiry date and validity. It never returns recipient names, DOB, salary, files or internal reasons. Certificate number lookup also requires the printed school code. Legacy references without a v2 verification index are verified with the school office.

PDFs are private at `schools/{schoolId}/certificate-files/{certificateId}/{operation}.pdf`; frozen logo copies are at `certificate-branding/`. Server download access checks membership and current certificate state. Parent links expire after five minutes and are checked again for revocation and credential changes when opened. Legacy public Storage download tokens are invalidated by the revocation trigger, while the archived object is retained.

Existing Firebase authentication, administrator MFA and school suspension/rollover checks apply. The current ERP's administrator permission grants certificate management; this feature does not grant general staff accounts access to salaries. The teacher app's separate local `cr_certs` award workflow is unchanged. Parent support adds the three missing request types, generated PDF downloads and explicit revoked states.

## Callable interfaces

`manageCertificate` accepts `{schoolId, action, requestId, ...}`. Actions are `preview`, `saveDraft`, `issue`, `resumeIssue`, `reject`, `revoke`, `saveTemplate`, `attachSigned`. Preview is read-only and needs no operation UUID. Mutations require an administrator session; existing records/templates require their reviewed revision/version. Issue responses contain `{id, refNo, status, revision}`.

Example form:

```json
{"kind":"student","recipientId":"student-id","type":"study","templateVersion":0,"issuedOn":"2026-11-20","validTill":"","issuer":"Authorised Principal","purpose":"Admission","note":"","fields":{"startDate":"2024-06-03","endDate":"2026-11-20"}}
```

`downloadCertificate`: `{schoolId, certificateId, historyId?}` returns `{content, filename}`; an authenticated parent can request `format:"url"` for a five-minute download link. Historical PDFs are administrator-only. `certificateFile` serves those bounded grants and checks current access again.

`verifyCertificate`: public `{schoolId, token}` or `{schoolId, refNo}`. Invalid references return `Not found`; current statuses are `Valid`, `Expired` and `Revoked`. No Firestore collection is made publicly readable.

Error codes distinguish unauthenticated/permission-denied, invalid-argument, not-found, failed-precondition (stale review or invalid state), already-exists (reused operation with different content) and resource-exhausted. The UI preserves an uncertain issue payload for retry instead of allocating a new request/number.

## Setup, verification and rollout

### Local testing without cloud records

`localhost` alone does not select a test backend. A normal `npm run dev` uses the cloud Firebase project from `.env.local`. Do not use actual students or staff to test issuance unless real records are intended. A 503 or timeout is an uncertain result: check Drafts/Issued or retry the same operation; it does not prove that no number was reserved.

For a separate synthetic school, use JDK 21 or newer and start the local suite from `website` with `bash tools/e2e/start_emulators.sh`, seed it with `node tools/e2e/seed.mjs`, then run `npm run dev:emulator` from `website/school-dash`. Open `http://localhost:3011`. This command sets `NEXT_PUBLIC_EMULATOR=true` and selects `demo-school-e2e`; Auth, Firestore, Storage and Functions connect to the local emulators. The generated emulator-only accounts are in the ignored `tools/e2e/.accounts.json`. Do not mix a cloud login with emulator data. Stop/restart the Next server when changing emulator settings.

Cloud service diagnostics are read-only. Use `npx -y firebase-tools@latest functions:list --project school-admin-tatos-2610` and `npx -y firebase-tools@latest functions:log --only manageCertificate --project school-admin-tatos-2610` with an authorised Firebase CLI account. Firebase and gcloud can use different accounts. A missing function in the deployment list explains an empty log result; a 503 alone does not distinguish a missing deployment from startup or upstream failures.

### Validation and deployment

1. Install the locked Functions dependencies with `cd website/functions && npm ci`. QR generation uses pinned `qrcode@1.5.4`; PDFKit and licensed bundled fonts render the artifact without remote font requests. The Manjari font license is in `functions/assets/MANJARI-LICENSE.txt`.
2. Validate with `node --test certificates.test.js`, the admin typecheck/lint/tests and the local rules/transaction harness `tools/rules_test/certificates.mjs`. The integration script refuses a non-loopback emulator. Run parent `test/certificate_records_test.dart` and `test/student_test.dart`. Review generated PDF samples with Poppler, including long and Malayalam names.

   The broader existing parent `firebase_repositories_more_test.dart` currently fails to compile because its auth cases call the removed `sendPasswordReset` API. The targeted certificate and student tests run independently; this unrelated auth test was not changed.
3. Use an authorised Firebase CLI sign-in. The existing `(default)` database in project `school-admin-tatos-2610` is Standard edition, in `asia-south1`. Deployments of the backend and web app are separate; a local page uses the deployed backend unless emulator mode is enabled.
4. Set `CERTIFICATE_VERIFY_ORIGIN` on the Functions runtime when using a custom school-admin domain. Otherwise links use the project's Firebase Hosting domain; emulators use localhost. Keep the public `/verify-certificate` page on that origin.
5. Deploy the certificate callables/HTTP handler and `onCertificateRevoked`, then Firestore/Storage rules and admin hosting, and release the parent app update. Include the updated `onCertificateWritten` notification handler. For rollout before the new parent app is installed, parents can still request using old types, but v2 PDF downloads require the updated parent app.
6. Configure Firestore TTL cleanup for global `certificate_download_tokens.deleteAt` and `certificate_verification_limits.expiresAt`. Both are timestamp fields; checks reject expired grants regardless of TTL deletion timing. No additional composite indexes are needed for the current equality/range queries.
7. Check one synthetic issue, PDF download/print, parent download, QR lookup, revocation and cross-school denial in staging before production release. Monitor callable errors, lingering Preparing records and rate-limit volume. Restrict log output to IDs/actions rather than certificate contents or salary data.

The current Firebase Hosting framework adapter needs the deployment compatibility wrapper below for Next 16.4 in this environment. It selects Webpack, normalises the adapter's esbuild dependency names, excludes `.next/dev` and compiler caches from the server package, and keeps the generated SSR function on Node.js 22. It does not modify the running local dev server. From `website`, use the authorised account explicitly when needed:

```bash
npx --yes --package firebase-tools@15.37.0 -- node tools/firebase_admin_deploy.cjs deploy --only hosting:admin --project school-admin-tatos-2610
```

Revalidate and retire these adapter workarounds when upgrading Firebase CLI or Next.js. Temporary grant/rate-limit TTL policies are recorded in `firestore.indexes.json`; code enforces expiration while background TTL activation/deletion is pending.

Existing records are not rewritten or reissued. On first issue, the counter starts above existing `CERT/{currentYear}/{number}` references (up to 9,999 legacy rows in that year); larger registers require a reviewed counter initialisation. History covers new actions only. Keep Firestore/Storage backups together and retain operation/counter records during recovery to prevent reference reuse. Roll back UI changes independently; retain server-owned write protections and archived artifacts.
