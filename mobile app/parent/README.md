# Parent App (Greenfield International School)

UI-first Flutter app for guardians. Everything runs on **in-memory mock repositories** (no backend, no Firebase),
so swapping to Firestore later means adding repository classes only. Same look as the teacher app: `lib/design_system/`
is copied from `mobile app/teacher` (plus a small `AppLoading` skeleton, "Parent Portal" labels).

## Run

```bash
export PATH="$PATH:/Users/albinosiby/development/flutter/bin"
flutter pub get
flutter run -d chrome          # or an emulator
flutter test                   # 44 tests
dart analyze
```

Demo login: `rajesh.sharma@example.com` / `parent123` (the login screen has a "Demo family" tap-to-fill card).
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
│     auth, family (guardian, children, child switcher), home, attendance, homework, marks, timetable,
│     notices, live_classes, leave, messages, fees, profile, learn / inbox / more (tab hosts)
├── utils/            exceptions/, helpers/ (date_helper), mixins/, services/ (cache, link launcher, local storage)
└── main.dart
```

Flow: Screen -> BLoC -> `I<Feature>Repository` -> `Mock<Feature>Repository` (-> later `Firebase<Feature>Repository`).

### Tabs and routes (go_router)

Bottom dock (`StatefulShellRoute.indexedStack`): **Home** `/home`, **Attendance** `/attendance`,
**Learn** `/learn?section=homework|marks|timetable`, **Inbox** `/inbox?section=notices|messages`, **More** `/more`.
Pushed screens: `/learn/homework/:id`, `/learn/marks/:id`, `/inbox/chat/:id`, `/more/live`, `/more/leave`,
`/more/leave/apply`, `/more/fees`, `/more/profile`. Auth guard (`redirect`) sends signed-out users to `/login`
(`/login/forgot` is public). Phones use the 390x844 frame; wider screens centre it (same as the teacher app).

### Caching (stale-while-revalidate)

Repositories return `Stream<T>` for reads. `utils/services/cache_service.dart` `cacheFirst(...)` emits the cached value,
fetches in the background, saves and emits the fresh value; a failed refresh keeps the cached value and only an empty cache
surfaces an error. BLoCs use `emit.forEach`, so the UI shows cached data at once. The cache is in memory for the demo
(swap `CacheService` for a JSON-on-disk one). Mock writes (acknowledge, apply leave, send message) push fresh lists through
the same stream.

### Live classes

Rules from `website/docs/DATA_CONTRACT.md` section 6: Join is enabled from 10 minutes before the start until
`start + mins`; status is derived from the clock (`LiveClass.statusAt` / `canJoinAt`). Join records the click
(`ILiveClassRepository.recordJoin`, `live_classes/{id}/joins/{uid}` later) and opens the Meet link with `url_launcher`
(`LaunchMode.externalApplication`); if that fails the link is shown with a copy action. The demo always has a class that starts
in 5 minutes, one tomorrow and one finished yesterday.

## What is mocked

- Login (only the demo guardian; session flag kept in SharedPreferences), forgot password (validates the email only).
- All reads: family, today, attendance (a term, calendar + percentage), homework, marks (exam list + report card, one
  unpublished exam), timetable (Mon-Fri), notices, live classes, leave history, message threads and chats, fees.
- Writes live only in memory: notice acknowledgement, leave applications, sent messages, live-class joins.
  They reset when the app restarts.
- Fees are view only (no payment). Notification toggles on the profile are local UI state.
- `BACKEND=rest|firebase` (`--dart-define=BACKEND=...`) is wired in `AppConfig` but still falls back to the mock repositories.

## Switching to Firestore later

1. Add `modules/<feature>/repositories/firebase_<feature>_repository.dart` implementing the interface.
2. Register it in `di/injection.dart` `_registerRepositories()` under `AppConfig.isFirebase`.
3. BLoCs and screens stay untouched. Add `firebase_core` / `cloud_firestore` and the `utils/services/firebase/` services then.

## Tests (`test/`)

`auth_test` (login, guard, forgot password, login screen), `family_test` (guardian/children, switching child, switcher UI),
`live_class_test` (join window boundaries, Join button states, launch + copy fallback), `domain_test` (attendance %, marks,
homework status, fees, cache-first), `home_repository_test` (today summary, leave validation, chat), `screens_test`
(walks every tab and pushed screen, plus loading / empty / error states). Tests set `MockLatency.delay = Duration.zero`.
