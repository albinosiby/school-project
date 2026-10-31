# Driver and Assistant App Implementation Proposal

Status: Approved on 29 October 2026; local-data UI implemented and verified on 30 October 2026. Branch: `codex/driver-app-ui`.

> **31 October 2026:** superseded by the native rebuild of `mobile app/driver` on the shared Firestore (data contract section 14: buses, crew logins, trips, bus attendance, crew check-in, leave) with the admin web Transport section. The Figma presentation-contract renderer and its 62 frame views were removed; this file stays as the product analysis and the list of simulated integrations still open (GPS, RFID/QR, guardian OTP, payslips, training).
Repository: `albinosiby/school-project`. Proposed application: `mobile app/driver`.

Implement all 62 frames in the Figma Driver App section as an interactive Flutter application with driver and assistant roles. The first delivery uses deterministic local repositories; production transport integration is a separate milestone with explicit data and authorization contracts. The approved UI milestone is implemented under mobile app/driver; verification results are recorded with the application.

Design source: [School Admin Web — Driver App](https://www.figma.com/design/7hcXAtbVJacV9atgx2f9Ii/School-Admin-Web?node-id=1174-2).
Exact frame IDs and names: [frames.tsv](../design/driver/frames.tsv).
All 62 frames were inspected through the connected Figma bridge. Source trees, style ranges, graphic assets and reference screenshots are preserved in website/design/driver.

## Product Analysis

Problem: drivers and bus attendants need a consistent mobile workflow for assigned trips, vehicle readiness, pupil accountability, guardian handover, and transport administration.

Users: school bus drivers and assistants/attendants. Transport supervisors are future integration users; parent and teacher applications remain separate.

Core scope: every driver and assistant frame, including popups, forms, role selection, navigation, validation, filtering, details, confirmation states, and meaningful local state updates.

Optional production integrations: GPS/background tracking, map navigation, RFID/QR scanning hardware, guardian OTP verification, push messaging, photo/file upload, office messaging, payroll downloads, and live school synchronization. Their UI remains in scope; the first build must clearly identify simulated operations.

Competitive analysis: compare the delivered workflows against manual trip sheets, radio/phone coordination, and generic fleet dashboards. Acceptance criteria are pupil-specific accountability, visible handover state, crew pairing, and an auditable trip closure. Vendor selection and current commercial product comparisons are outside this UI implementation.

Assumptions:
- One new Flutter app supports both roles with a role-specific navigation shell.
- “Staff UI” means the 19 Assistant Screens within Driver App.
- Android and iOS are mobile targets; web is a review target.
- Existing parent/teacher apps supply reusable design-system patterns.
- The Figma light theme is the visual acceptance target; any dark theme uses semantic tokens.
- Fixture content should follow Figma for visual review; fixtures are fictional and isolated from live school data.

Risks and challenges:
- The existing user-role contract lists admin, teacher, and parent; driver and assistant access must be designed before live integration.
- GPS, QR, OTP, pairing, and guardian handover cannot become production security controls through UI simulation.
- Trip state must stay consistent across driver and assistant views.
- Different fixture brands and dates across existing apps must not silently become production records.
- Some Figma screens contain certification/encryption claims; decorative copy does not establish a verified capability. Review those claims before a production release.

## System Architecture

Flow: Screen → feature Cubit → abstract repository → local implementation initially; a production adapter can later implement the approved contract.

Use Flutter, Material 3, flutter_screenutil with designSize 402 × 874, flutter_bloc Cubits with immutable states, GoRouter stateful shells, and GetIt dependency injection. Select compatible dependency versions during implementation and consult their official documentation as needed.

Reuse suitable existing cards, headers, fields, sheets, badges, loading/error widgets, adaptive layouts, and theme tokens. Keep parent and teacher apps unchanged; avoid introducing a shared-package migration into this branch.

Folder responsibilities:
- `design_system/`: tokens, components, adaptive scaffold, feedback and animation.
- `config/routes/`: route constants, shells, redirects and error routes.
- `modules/<feature>/{cubit,models,repositories,screens}/`: feature ownership.
- `di/`: repository and Cubit registration.
- `utils/`: typed failures, validation helpers and infrastructure.
- `constants/asset_path.dart`: local asset references.

Authentication flow: onboarding → demo sign-in/verification → crew role and pairing → role-specific home. A session model distinguishes authentication, assigned role, and active pairing. Production identity and role assignment must come from a trusted service; changing a UI role is never authorization.

Retain tab navigation stacks, loaded data, filters and scroll positions. Route-scoped forms preserve edits while navigating within their flow. Bound caches to a session and clear them on sign-out or role/tenant changes. Keep side effects out of widget build methods.

Scalability: paginate histories and rosters, subscribe only to the active trip, bound attachment previews and caches, and keep location telemetry separate from frequently updated trip summaries. No transport/network abstraction is added until the app actually needs it.

## Database Design

No production schema or migration is required for the UI milestone. Typed local models implement these proposed entity relationships:

| Entity | Relationships and constraints |
|---|---|
| CrewMember | Stable crew ID, school ID, driver/assistant role, active status |
| Vehicle | School-owned ID, registration, capacity, service dates |
| TransportRoute and Stop | Ordered stops; stable stop IDs; valid coordinates |
| Trip | Route, vehicle, assigned driver/assistant, date, lifecycle status |
| StudentManifestEntry | Trip + student + assigned stop; boarding and handover state |
| CrewPairing | Trip, two crew IDs, expiry, status; trusted verification later |
| ChecklistSubmission | Trip, crew ID, required responses and completion time |
| HandoverRecord and ScanLog | Student/trip references, event ID, actor, timestamps |
| Incident and CareNote | Restricted trip/student scope, severity and acknowledgement |
| LeaveRequest and DutyAssignment | Crew, date range, pending/approved/rejected status |
| FuelEntry and VehicleFault | Vehicle, trip where relevant, amount/odometer or fault severity |
| LostFoundItem and OfficeMessage | Trip/item references, status and optional attachment |
| Notice, Notification, Profile, Payslip, TrainingModule | Role-appropriate owner/audience and read/progress state |

Future indexes: assigned crew + trip date; trip + stop sequence; trip + student; owner + created time; vehicle + service date; school + notice status + publication date. Use cursor pagination and explicit ordering.

Validation: required stable IDs, valid enum values, bounded notes, nonnegative fuel and odometer values, increasing date ranges, unique pupil manifest entries, and legal trip lifecycle transitions. Authoritative timestamps, ownership and approval decisions belong to the backend. Prefer append-only events for scans and handovers with idempotency keys.

## API Design

No live endpoints are introduced by this UI milestone. Repository methods define the initial application contract: loadAssignedTrips, loadManifest, submitChecklist, startTrip, recordBoarding, requestHandover, finishTrip, submitIncident, submitLeave, logFuel and updateProfile.

If an HTTP adapter is selected later, proposed endpoints are:
- GET /v1/me and /v1/trips?date=YYYY-MM-DD
- GET /v1/trips/{id}/manifest and /v1/trips/{id}/stops
- POST /v1/trips/{id}/checklists, /events and /completion
- POST /v1/crew-pairings and /v1/handovers/{id}/verify
- POST /v1/incidents, /leave-requests, /fuel-entries and /lost-found
- GET /v1/notices, /v1/notifications and /v1/duties

Illustrative event request: {"eventId":"evt_001","type":"boarded","studentId":"stu_001","stopId":"stop_01"}.
Illustrative response: {"eventId":"evt_001","status":"accepted","tripVersion":12}.

Require authenticated school membership and assigned-trip authority for every live operation. Derive actor and school from verified identity. Use idempotency for mutations. Map validation, unauthenticated, forbidden, stale-state/conflict, rate-limit and unavailable errors to typed failures; retain user input on retry. Sensitive responses must not enter general HTTP caches.

## Frontend Design

The frame inventory is authoritative for the 43 driver and 19 assistant views. Screens sharing a feature use one model/repository boundary and an appropriately scoped Cubit.

| Feature | Included views |
|---|---|
| Onboarding and crew | Four onboarding frames; role selection; pairing and takeover |
| Driver home and trips | Home; trips; afternoon drop; checklist; manifest; trip history/detail and boarded popup |
| Live operations | Live trip; end-trip submission |
| Vehicle | Details; service schedule; fault reporting; fuel log |
| Leave | Apply; replacement driver popup; history; details |
| Lost and found | List; returned items/detail; lost detail; office message; found-item form |
| Driver account | Profile/edit; photo sheet; settings; digital pass/QR; score analysis; payslips |
| Notices and alerts | Transport notices/detail; driver notifications/detail |
| Assistant operations | Home; stops; seat/count; student roster; care notes; guardian handover; unknown child |
| Assistant duties | End-trip inspection; incident report; crew messages; scan log; duty roster/swap |
| Assistant learning and account | Training/module detail; profile; digital pass; notifications/detail |

Driver tabs: Home, Trips, Live, Profile. Assistant tabs: Home, Students, Stops, Duties, with account and alerts reached through header actions. Share data between tabs and role flows through repositories.

Key journeys:
1. Driver onboarding → pairing → checklist → assigned trip → live trip → completion.
2. Assistant pairing → roster/count → boarding → guardian handover → end-trip inspection.
3. Vehicle fault/fuel submission → visible updated records.
4. Leave or duty swap request → pending detail/history.
5. Lost-item report → office message → return detail.
6. Notification → correct detail; profile edits → updated identity.

Build shared vehicle/crew cards, route summaries, stop rows, pupil rows, metric tiles, status pills, checklist rows, forms and confirmation sheets. Download Figma assets into the app and record their source nodes; do not ship temporary Figma URLs or full-screen screenshots as UI.

Primary navigation uses an elevated bottom bar and reserves safe-area/content space. Preserve Figma geometry on the reference viewport; adapt layout at mobile, tablet and desktop breakpoints. Verify landscape, keyboard insets and larger text.

## Development Plan

Sequence after approval:

| Milestone | Deliverable | Planning estimate |
|---|---|---|
| 1 | Full design context/assets, route coverage matrix, app foundation and role shells | 2–3 engineering days |
| 2 | All driver screens and local interactions | 5–7 days |
| 3 | All assistant screens and shared trip state | 4–6 days |
| 4 | Visual QA, accessibility, critical journeys and setup/user guides | 3–4 days |

Estimate: 14–20 engineering days for one engineer, dependent on asset quality and review turnaround. This is a planning estimate, not a delivery guarantee. Production backend/hardware integration needs a separate estimate once providers and contracts are agreed.

Suggested sprints: foundation and core driver journey; remaining driver/admin flows; assistant flows and regression. Prioritize complete core journeys before supporting administrative screens.

## Security

Use only fictional data for demo flows. Demo OTP/pairing must be visibly marked and excluded from production adapters.

For production, enforce school, role and assigned-trip authorization on the server. Restrict pupil care notes, guardian details and payslips by purpose and role. Use secure storage for credentials, non-sensitive preferences only in SharedPreferences, and redact personal data/tokens from logs.

Pairing and handover proofs need expiry, replay protection, attempt limits, authoritative verification and audit records. Driver UI cannot self-approve leave, swaps, overrides or assistant authority. Validate uploads and access to their storage paths on the backend. GPS permission, retention and background collection require an explicit product decision before activation.

## Testing

Unit: Cubit transitions; repository mutations and failures; trip lifecycle; counts; field validation; session/role cache isolation.

Widget: role shells, forms and sheets; loading/empty/error/retry; navigation and unread counts; all 62 frame mappings.

Integration/end to end: both core trip journeys, count reconciliation across screens, rejected invalid handover, incomplete checklist blocking start, end-trip inspection, leave/swaps, reports and profile changes.

Visual QA: compare each implemented frame to its Figma screenshot at 402 × 874, including scrolled content and popup states. Check every static asset's local file, source node, callsite and rendered proportions. Test narrower/wider viewports, landscape, keyboard and enlarged text.

Run Dart formatting, flutter analyze and relevant Flutter tests. Build review artifacts for the available platforms. Production integration later adds authorization-denial, offline retry, idempotency and device permission tests.

## DevOps

Keep this branch local until publication is requested. CI should restore dependencies, check formatting, analyze, run tests and build a web review artifact plus an Android build. iOS compilation depends on configured Apple tooling; signing and store distribution are separate release steps.

Use separate demo/staging/production configuration. Monitor crashes and failed operations with redacted context when production telemetry is enabled. Establish latency/error budgets once a backend exists.

UI demo records are disposable. Keep code/design assets in Git. Before live integration, define scheduled backend backups, retention, restore access and a tested recovery procedure; establish recovery objectives with school operations.

## Documentation

Add an application README with toolchain setup, run/build/test commands, demo role access and configuration.
Add a Figma coverage guide linking every frame to its route, state or sheet.
Document repository contracts and production adapter requirements.
Provide driver and assistant walkthroughs, validation/error explanations and a clear list of simulated operations.

## Approved Scope

User approved one Flutter app in mobile app/driver covering all 62 Driver App frames, with driver and assistant roles, reusable design-system components, Cubit/repository separation, and a complete local-data UI milestone before production integrations.

Pending technical inputs for the production milestone: authentication/provisioning, driver/assistant permissions, live tracking/map provider, scanning hardware, guardian verification service and attachment policies. These do not prevent the local UI milestone.
