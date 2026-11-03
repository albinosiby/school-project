# Parent App (Greenfield International School)

UI-first Flutter app for guardians, built from the Figma "Parent App" page (24 frames, 402x874; exports in
`website/design/parent/`). By default it runs on **in-memory mock repositories** (demo data); with
`--dart-define=BACKEND=firebase` it uses the school's Firestore backend shared with the admin web and teacher app. `lib/design_system/` is shared with `mobile app/teacher`
plus parent components (`AppSurfaceCard`, `AppMetricBox`, `AppSolidChips`, `AppEntryCard`, `AppChatBubble`,
`AppFlowHeader`, `AppInstitutionCard`, `AppHeaderActions`). Build notes per screen: `FIGMA_UI_GUIDE.md`.

## Run

```bash
export PATH="$PATH:/Users/albinosiby/development/flutter/bin"
flutter pub get
flutter run -d chrome          # or an emulator
flutter test --concurrency=1   # 458 tests (+32 opt-in crawl)
flutter test test/button_crawl_test.dart --dart-define=CRAWL=true   # taps every button, report in build/button_crawl.txt
dart analyze
```

Demo sign-in: Welcome -> Sign In -> "Demo family" card (mobile +91 98765 43210, or `rajesh.sharma@example.com` /
`parent123`) -> passcode **482916** (tap the hint chip) -> Select Student -> Home. Google / Apple sign in the demo guardian.
Registration demo admission numbers: GIS-2021-0142 (14/08/2010), GIS-2023-0318 (22/03/2012), GIS-2024-0457 (05/11/2014).
Demo family: guardian **Mr. Rajesh Sharma**, children **Aarav** (Grade 10-B) and **Ananya** (Grade 8-C). Use the child
switcher under the header on any tab; every screen follows the selected child.

## Structure

```
lib/
├── design_system/    tokens/, components/, layouts/, feedback/, animations/ (barrel: design_system.dart)
├── config/           app_config.dart (local | rest | firebase toggle), routes/ (routes.dart, routes_config.dart)
├── constants/        app_constants.dart, api_path.dart, assest_path.dart
├── core/
│   ├── bloc/child_data_bloc.dart     base BLoC: stream of data for the selected child (restartable, cache-first)
│   └── widgets/child_data_view.dart  scopes a BLoC to the selected child, renders loading / error / empty / data
├── di/               injection.dart (GetIt), global_blocs.dart, demo_data.dart (all demo data, relative to "now")
├── modules/<feature>/{bloc,models,repositories,screens}
│     auth (welcome, login, OTP, register), family (child switcher, select student), home, transport (track live),
│     behaviour, academics (tab host) + attendance, homework, marks, timetable, fees, messages, notifications,
│     notices, profile, settings, student, ptm, teachers, live_classes, leave, more (hub)
├── utils/            exceptions/, helpers/ (date_helper), mixins/, services/ (cache, link launcher, local storage)
└── main.dart
```

Flow: Screen -> BLoC -> `I<Feature>Repository` -> `Mock<Feature>Repository` (-> later `Firebase<Feature>Repository`).

### Tabs and routes (go_router)

Bottom dock (`StatefulShellRoute.indexedStack`, matches the Figma Home dock): **Home** `/home`,
**Academics** `/academics?section=attendance|homework|marks|timetable`, **Fees** `/fees`, **Messages** `/messages`
(unread badge), **More** `/more` (hub linking every other screen). All paths are constants in `config/routes/routes.dart`;
each module registers its pushed routes in `config/routes/modules/<module>_routes.dart`.

| Figma frame | Route |
|---|---|
| Onboarding 1 / 2 / 3 / 1.1 / 4 | `/welcome`, `/login`, `/login/otp`, `/register`, `/select-child` |
| 1. Home, 1.1 Track Live, 1.2 Behaviour, 1.2 Apply Leave | `/home`, `/home/track`, `/home/behaviour`, `/more/leave/apply` |
| 4 Messages, 4.1 View, 4.2 New, 4.3 File Upload | `/messages`, `/messages/thread/:id`, `/messages/new`, upload sheet |
| 5.1 Student Profile, 5.2 Certificates, 5.5 PTM, 5.6 Teachers | `/more/student`, `/more/certificates`, `/more/ptm`, `/more/teachers` |
| 6. Profile, 6.1 Edit (+6.1.1 photo sheet), 6.2 Settings, 6.2.1 Privacy | `/more/profile`, `/more/profile/edit`, `/more/settings`, `/more/settings/privacy` |
| 7. Notifications, 7.1 Detail | `/notifications`, `/notifications/:id` |
| (no frame, same style) Academics, Fees, homework / report card detail, leave history, live classes | `/academics`, `/fees`, `/academics/homework/:id`, `/academics/marks/:id`, `/more/leave`, `/more/live` |

Auth guard (`redirect`): signed-out users land on `/welcome`; a signed-in user on a public page goes to `/select-child`.
`ScreenUtilInit` uses the Figma frame (402x874); wider screens centre the phone layout.

### Caching (stale-while-revalidate)

Repositories return `Stream<T>` for reads. `utils/services/cache_service.dart` `cacheFirst(...)` emits the cached value,
fetches in the background, saves and emits the fresh value; a failed refresh keeps the cached value and only an empty cache
surfaces an error. BLoCs use `emit.forEach`, so the UI shows cached data at once. The cache is in memory for the demo
(swap `CacheService` for a JSON-on-disk one). Mock writes (acknowledge, apply leave, send message, pay fees, book PTM...)
push fresh data through the same stream: `refreshOn` is subscribed as soon as the stream is listened to, so a write made
during the first fetch is not lost, and cancelling never waits on it.

### Live classes

Rules from `website/docs/DATA_CONTRACT.md` section 6: Join is enabled from 10 minutes before the start until
`start + mins`; status is derived from the clock (`LiveClass.statusAt` / `canJoinAt`). Join records the click
(`ILiveClassRepository.recordJoin`, `live_classes/{id}/joins/{uid}` later) and opens the Meet link with `url_launcher`
(`LaunchMode.externalApplication`); if that fails the link is shown with a copy action. The demo always has a class that starts
in 5 minutes, one tomorrow and one finished yesterday.

## What is mocked

- Sign-in: passcode by mobile or email+password (demo passcode 482916, 3 attempts then locked until resend), Google /
  Apple (demo guardian), registration (creates a pending `REG-...` request). Session flag kept in SharedPreferences.
- All reads come from demo data relative to "now" (`di/demo_data.dart` and `<module>/repositories/*_demo_data.dart`).
- Writes live in memory and reset on restart: acknowledgements, leave, messages + drafts, fee payments + receipts,
  PTM bookings, certificate requests, profile edits and photo, notification read/delete. Settings toggles persist
  through SharedPreferences.
- Simulated, with a visible result (snackbar / sheet / state): GPS tracking, payments, file pickers and
  uploads, PDF downloads, voice notes, QR scan, sharing. Meet links and phone calls (`tel:`) open through `LinkLauncher`.
- `BACKEND=firebase` replaces these with the Firestore repositories (see below); `BACKEND=rest` has none yet and uses the mocks.

## Firestore backend (`BACKEND=firebase`)

`modules/<feature>/repositories/firebase_<feature>_repository.dart` implement the same interfaces on Firestore
(data contract §13); `di/firebase_repositories.dart` swaps them in, so BLoCs and screens are unchanged.
School bus (Home card, Track Live, Student profile > Transport) reads `par_transport/{studentId}` (§14.9): there is no
GPS feed, so the position is estimated from the stop times and today's trip status (labelled "schedule-based"); a
child without the doc sees "Not on a school bus". Bus "notify me" toggles are kept on the device.
Left on device-only / not available because the contract has no parent data for them: conduct (Behaviour), profile
edits (office record), self-registration (the school creates logins), mobile passcode and Google / Apple sign-in,
online payment and receipt PDFs (§13.8: pay into the school account and report it), RFID gate entry. Session and push:
`utils/services/firebase/`. Sign-in is the email + password from the school's invite. Going live, what syncs and the
emulator test setup: `website/docs/PARENT_APP.md`.

## Tests (`test/`)

One file per module: `auth_test`, `family_test`, `home_ui_test`, `home_behaviour_test`, `home_transport_test`,
`home_repository_test`, `live_class_test`, `academics_test`, `messages_test`, `profile_test`, `student_test`,
`domain_test` (models + cache-first). Firestore repositories: `firebase_repositories_test`,
`firebase_repositories_more_test`, `firebase_transport_test` (fake_cloud_firestore + firebase_auth_mocks). BLoC module
tests: `bloc_child_data_test`, `bloc_actions_test`. Field validation on the real screens: `form_validation_test`,
`form_validation_auth_test`. `screens_test` is the end-to-end walk: every dock tab, every Academics
section, every More hub entry and every deep link, plus loading / empty / error states. `button_crawl_test`
(opt-in, `--dart-define=CRAWL=true`) opens each of 32 routes, scrolls through it and taps every tappable element
from a fresh app, reporting taps that throw or change nothing. Tests set `MockLatency.delay = Duration.zero`.
