# Shift Sync: driver and bus staff app

Flutter app for the school's transport crew. One app, two roles: the **driver** and the **bus staff** (attendant) who
rides with the driver. Both see the same bus, trips and roster; the transport office manages everything from the admin
web (Transport section). Shared data layout: [`website/docs/DATA_CONTRACT.md`](../../website/docs/DATA_CONTRACT.md) section 14.

## What the crew can do

- **Home**: today's date, bus card (number, registration, route, students, stops), the next or live trip, shift check-in /
  check-out, crew partner with a Call button, quick actions.
- **Trips**: today's morning pickup and afternoon drop with their state; the route's stops; trip history with counts.
- **Trip detail**: pre-trip checklist (six items, required before a pickup starts), start trip (optional odometer), the
  student list with **Boarded / Absent / Arrived (Dropped) / Undo** per pupil, guardian name and phone with **Call**, search,
  stop and status filters, end trip with note. Ending a pickup marks every boarded pupil as arrived at school.
- **Students**: the bus roster with class, roll, stop, guardian phone and Call; student card with medical note and recent
  bus attendance; route stops with the pupils at each stop.
- **Profile**: identity, bus, licence (drivers), editable phone / address / emergency contact, my attendance (month view),
  leave requests (apply, withdraw while pending), transport notices, sign out.

## Run

Verified toolchain: Flutter 3.44.1 / Dart 3.12.1. Run from this folder.

```sh
flutter pub get
flutter run -d chrome                      # demo data (default)
flutter run --dart-define=BACKEND=firebase # the school's Firestore (admin web project)
flutter run --dart-define=BACKEND=firebase --dart-define=EMULATOR=true   # local emulators (see website/tools/e2e)
flutter test                               # 28 tests
flutter analyze
```

Demo logins (default build, no real data): tap a demo card on the sign-in screen, or use
`rajesh.kumar@greenfield.edu` (driver) / `sunita.devi@greenfield.edu` (bus staff) with password `shift123`.

Firebase builds sign in with the email the transport office registered (admin web > Transport > Drivers / Bus staff) and
the password set from the invite email. `users/{uid}` must have `role: driver|attendant` and `crewId`.

## Structure

```
lib/
├── design_system/    tokens, components, layouts, feedback, animations (shared with the parent app)
├── config/           app_config.dart (local | firebase, EMULATOR), routes/ (routes.dart, routes_config.dart)
├── constants/        app_constants.dart
├── core/             bloc/data_bloc.dart (stream BLoC base), widgets/data_view.dart (loading / error / empty / data)
├── di/               injection.dart (GetIt), mock_repositories.dart + demo_data.dart (local), firebase_repositories.dart
├── modules/<feature>/{bloc,models,repositories,screens}
│     auth, crew (me + bus + partner), home, trips, students, attendance (marks), crew_attendance, leave, notices, profile
├── utils/            exceptions/, helpers/ (dates), services/ (cache, link launcher, local storage, firebase/crew_session.dart)
└── main.dart
```

Flow: Screen → BLoC → `I<Feature>Repository` → `Mock…Repository` (in-memory `DemoStore`) or `Firebase…Repository`
(`CrewSession` wraps `users/{uid}` + `tr_crew/{crewId}`; Firestore offline persistence makes reads cache-first).

Routes: tabs `/home`, `/trips`, `/students`, `/profile`; pushed `/trips/:id`, `/trips/:id/checklist`, `/trips/history`,
`/students/stops`, `/profile/attendance`, `/profile/leave`, `/profile/leave/apply`, `/profile/edit`, `/notices`, `/notices/:id`;
public `/welcome`, `/login`, `/login/forgot`. Signed-out users are redirected to `/welcome`.

## Firestore (BACKEND=firebase)

Collections under `schools/{sid}` (contract section 14): `tr_crew`, `tr_buses`, `tr_trips/{date}_{busId}_{kind}`,
`tr_attendance/{same id}` (`marks.{studentId} = {status, at, by, byName, stopId}`), `tr_crew_attendance/{date}_{crewId}`,
`tr_crew_leaves`, `tr_settings/policy`, plus `students` where `busId == my bus` and published `com_notices`. Marks are
written in a transaction so the driver and the attendant can mark at the same time. The rules allow a crew member only
their own bus's records (`website/firestore.rules`, tested in `website/tools/rules_test`).

`lib/firebase_options.dart` reuses the parent app's Android values until an Android app for
`com.tatos.school.driver_app` is registered in the Firebase project and its `google-services.json` added.

## Tests

`test/journeys_test.dart` drives the whole app on the mock backend: sign-in, checklist gate, start trip, mark pupils, end
trip, attendant marking and undo, roster search and Call (`tel:`), student card, check-in / out, leave apply / withdraw,
notices, edit profile, trip history. `test/firebase_repositories_test.dart` runs the Firestore repositories against
`fake_cloud_firestore`.
