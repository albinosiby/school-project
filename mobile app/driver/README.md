# Shift Sync Driver and Assistant App

Flutter UI for the complete Figma Driver App section: 43 driver frames and 19 assistant frames. The app uses native Flutter text, forms, scroll views, surfaces and local design assets. Reference screenshots remain in `website/design/driver/png`; they are not app screens or runtime assets.

The [approved implementation plan](../../website/docs/DRIVER_APP_PLAN.md) records the architecture and production integration contracts.

## Run

Verified toolchain: Flutter 3.44.1 / Dart 3.12.1. Run these commands from this application folder.

```sh
flutter pub get
flutter run -d <device-id>
flutter test
flutter analyze
```

The welcome screen leads to mobile sign-in. Use any fictional ten-digit mobile number and demo code **482916**. Choose Lead Driver or Bus Attendant, then confirm pairing. Guardian handover uses demo code **4092**. No SMS, calls, dispatch alerts, payments or hardware commands are sent.

## Folder structure

- `lib/modules/auth`: credentials, verification, session and public onboarding.
- `lib/modules/crew`: role selection and crew pairing.
- `lib/modules/transport`: driver home, trips, checklist, manifest, live run and history.
- `lib/modules/operations`: vehicle, fuel, faults, service, leave, notices and lost-and-found.
- `lib/modules/account`: profiles, settings, passes, payslips and notifications.
- `lib/modules/attendant`: assistant home, students, stops, care, handover, sweep, incidents and duties.
- `lib/modules/learning`: training and module detail.

Every feature owns `cubit/`, `models/`, `repositories/` and `screens/`. Shared presentation contracts, native layout primitives and form lifecycle are under `core/`. Shared components and tokens are under `design_system/`. GoRouter route ownership is centralized in `config/routes/`; GetIt bindings are in `di/injection.dart`.

Data flow: screen → feature Cubit → repository interface/implementation → local assets or session state. Widgets do not access storage or a backend. The first milestone uses local demo repositories. Driver and assistant identities are fictional; demo verification is not production authentication.

Primary navigation uses retained GoRouter shell branches and an elevated bottom bar. Detail scroll positions use page storage. Local edits are retained for the session; restarting resets operational records. Sign-out clears feature caches and trip data.

## Design data

`assets/views/` contains typed presentation contracts grouped by feature. `ViewRepository` parses these at the infrastructure boundary into immutable application models. `DesignView` composes native widgets from their geometry and appearance; interactive targets are dispatched to feature Cubits. Business state remains separate from the exported presentation tree.

`config/routes/view_catalog.dart` and `website/design/driver/frames.tsv` map every source frame to its app route. Primary routes are `/driver/home`, `/driver/trips`, `/driver/live`, `/driver/profile`, `/assistant/home`, `/assistant/students`, `/assistant/stops`, `/assistant/duties`; other frames use `/screen/<frame-number>`.

`--dart-define=UI_REVIEW=true` allows direct screen access for automated UI review. Normal builds enforce demo session and primary role redirects. This flag is for development and is not production authorization.

## Integration boundaries

Map display, telemetry, OTP, RFID/NFC/QR hardware, uploads, document export, streaming lessons, office messaging and external alerts use demo behavior. Their UI does not establish the certification, encryption or compliance statements shown in the source design. Production integration requires trusted identity and tenant/assignment authorization, replay-protected pairing and handover, upload rules, telemetry policies and an approved transport data contract.

## Verification

`test/widget_test.dart` checks authentication, role isolation, checklist prerequisites, boarding deduplication and guardian verification. `test/screen_render_test.dart` renders reference screens for local visual QA. Device integration tests exercise screen rendering and the two role journeys. Validation results and remaining limitations belong in `UI_VERIFICATION.md`.
