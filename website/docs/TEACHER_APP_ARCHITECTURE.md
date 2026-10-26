# Teacher App — architecture & migration guide (read fully before coding)

The app (`mobile app/teacher/`, Flutter 3.44 / Dart 3.12) follows the blueprint in `/Users/albinosiby/Tatos Dev/flutter_file_structure/README.md`.
Every screen already exists in the OLD (legacy) codebase. Your job is to PORT your module's screens to the new architecture,
keeping every behaviour, and re-checking each screen against its Figma frame.

- Legacy code (read-only reference, do not import from it):
  `/private/tmp/claude-501/-Users-albinosiby-Library-Application-Support-Claude-scratch-workspaces-7d053944-529f-40be-ba47-26588e5fd7aa-48d19894-16c3-4a67-8aef-ea7f4e478cd2-scratch-2026-10-22-939eaf/054fc1ab-b908-4ba9-a7e3-0140c4783331/scratchpad/legacy/lib/features/<module>/`
  (legacy shared code: `.../legacy/lib/core/`; legacy tests: `.../legacy/test/`).
- Figma: `design/teacher/png/<frameId>_<name>.png` (390×844, clipped below the fold) and `design/teacher/spec/<frameId>_<name>.json`
  (full content; print TEXT nodes with a small python script, never cat the whole file).
- Do NOT run/launch the app (`flutter run`/`build`); the lead does that. A web dev server may be running — leave it alone.
  Verify with `cd "mobile app/teacher" && dart analyze lib test` (clean for your files) and `flutter test test/<module>_test.dart`.

## Folder structure (blueprint)
```
lib/
  design_system/   tokens/ (app_tokens.dart: C colors, R radii, S spacing, T text styles; app_theme, light/dark, spacing)
                   components/ (ALL reusable widgets, one per file, exported by design_system.dart)
                   layouts/ (breakpoints, responsive_builder, adaptive_scaffold) feedback/ (AppDialogs) animations/
  config/          app_config.dart, routes/routes.dart (RoutePaths), routes/routes_config.dart, routes/modules/<module>_routes.dart
  constants/       app_constants.dart, api_path.dart, assest_path.dart
  core/            settings/application_setting.dart, walk_through/walkthrough_1.dart
  di/              injection.dart, global_blocs.dart, seed_data.dart, modules/<module>_di.dart
  modules/<module>/
     bloc/         <feature>_bloc.dart, <feature>_events.dart, <feature>_states.dart  (Equatable, sealed events)
     models/       <feature>_models.dart (immutable Equatable classes with fromJson/toJson/copyWith)
     repositories/ <feature>_repository_interface.dart (abstract I<Feature>Repository, Future-based + Stream<void> watch())
                   <feature>_repository.dart (Local<Feature>Repository over LocalDatabaseService), <module>_seed.dart
     screens/      <name>_screen.dart (+ screens/widgets/ for widgets used only inside this module)
  utils/           exceptions/, helpers/ (text_helper, date_helper: isoOf/fmtDate/relTime/RecX…), mixins/validation_mixins.dart,
                   services/ (local_database_service.dart, local_storage_service, secure_storage, rest_api, firebase/…)
  main.dart
```
Reference implementation to copy: `modules/school/` (models, interface, local repo, seed, bloc) + `modules/home/bloc/notifications_*`
+ `modules/tasks/models/homework_models.dart` & `repositories/homework_repository*.dart` + `test/foundation_test.dart`.

## Rules
1. **ScreenUtil everywhere.** Every dimension in widget code uses `flutter_screenutil` units: `.w` (widths/horizontal padding & gaps),
   `.h` (heights/vertical padding & gaps), `.r` (radii, icon sizes, square/circular sizes, avatar/tile sizes), `.sp` (font sizes).
   No raw pixel literals except 0, 1/1.5 border widths, flex values, durations, opacity. Use tokens (`T.*`, `R.*`, `S.*`, `C.*`) first.
   Tokens are getters, so widgets using them can't be `const` — drop `const` where needed. `import '.../design_system/design_system.dart'`
   exports ScreenUtil too. Design-pixel parameters of components (e.g. `Avatar(size: 44)`, `IconTile(size: 34)`) are scaled inside.
2. **Reusable components live in `lib/design_system/components/`.** Before writing a widget, check that folder. If a widget is generic or
   used by 2+ screens in different modules (charts, steppers, segmented controls, calendar strips, timeline rows, list tiles, toggles rows,
   date/time pickers fields…), add it there (one file, `app_<name>.dart`, ScreenUtil, tokens only, presentational — no BLoC/repository
   imports) and append one export line to `design_system.dart` (append only; another agent may have appended too — re-read before editing).
   Module-only widgets go in `modules/<module>/screens/widgets/`.
3. **go_router + RoutePaths.** Never write route strings: use `RoutePaths.x` / `RoutePaths.x(id)` from `config/routes/routes.dart`
   (all paths are already defined; if one is missing add it there — append only). Register your module's screens in
   `config/routes/modules/<module>_routes.dart` only. Navigate with `context.push(...)`, tabs with `context.go(...)`.
   Query params: `state.uri.queryParameters`. Path params: `state.pathParameters['id']`.
4. **BLoC.** Screens never touch `LocalDatabaseService`. Data flows Screen → BLoC (events) → I<X>Repository → LocalXRepository → LocalDatabaseService.
   One BLoC per feature area (e.g. attendance: MarkAttendanceBloc, TrendsBloc, MarksBloc, LeaveBloc, CircularsBloc), events sealed &
   Equatable, states Equatable with a status enum. BLoCs subscribe to `repo.watch()` and reload (see SchoolBloc). Create screen BLoCs with
   `BlocProvider(create: (_) => getIt<XBloc>()..add(const XLoadRequested()))` in the screen (or route). Form input (text controllers,
   local toggles before submit) may stay in StatefulWidget state; anything persisted goes through the BLoC. Feedback (snackbars,
   navigation after save) via `BlocListener` on a status/message field — or await a repository Future in a submit handler that then
   dispatches; keep it simple and consistent within your module.
   Register repositories (`registerLazySingleton<IX>(() => LocalX(getIt<LocalDatabaseService>()))`) and BLoCs (`registerFactory`) in
   `di/modules/<module>_di.dart` only.
5. **Shared data.** Teacher/classes/students: global `SchoolBloc` (`context.watch<SchoolBloc>().state` / `context.select`), or
   `getIt<ISchoolRepository>()` inside your repositories/BLoCs. Notifications: global `NotificationsBloc` / `INotificationRepository`
   (home). Homework: `IHomeworkRepository` (tasks). Tab screens use `TeacherTabHeader` (modules/home/screens/widgets) + `AppTabBody`.
   A repository may READ collections owned by another module for summary counts (e.g. More reads `tk_tasks`, `ms_messages`); WRITES go
   only through the owning module's repository interface.
6. **Seeds.** Your seed is already ported to `modules/<module>/repositories/<module>_seed.dart` (same collection names as legacy). Keep the
   names; adjust data only if needed. Persisted user data won't reseed — tests use `setUpTestApp()`.
7. **Tests.** Port your legacy test to `test/<module>_test.dart` using `test/helpers/pump_app.dart` (`setUp(setUpTestApp)`,
   `pumpScreen(tester, screen: ...)` or `pumpScreen(tester, location: ..., routes: [...])`). Cover each screen + main actions, and at
   least one BLoC unit test per BLoC. Overflow warnings from the test font may be filtered as legacy tests did.
8. **Quality.** Same behaviour as legacy (all buttons/forms/filters work and persist), Figma-faithful layout, no overflow at 320–430 width,
   ellipsis on long text, Semantics on icon-only buttons, ≥44 tap targets. Delete nothing you don't own. No new packages.

## Ownership
Lead owns: design_system/** (you may ADD component files + append exports), config/routes/routes.dart (append), routes_config.dart,
di/injection.dart, di/global_blocs.dart, di/seed_data.dart, main.dart, modules/school, utils/**, constants/**.
Each module agent owns: `modules/<module>/**`, `config/routes/modules/<module>_routes.dart`, `di/modules/<module>_di.dart`,
`test/<module>_test.dart`. Home also owns `core/**` (walkthrough = Onboarding 1–2, application_setting = 7.1 settings screen).
Existing shared files already written by the lead inside your module (homework_*, notification_*, teacher_tab_header.dart) are yours to
extend but keep their public APIs (other modules use them).

## Final report
Screens ported (route per frame), BLoCs/repositories created, components added to the design system, anything simulated, any
difference from legacy/design. Brief.
