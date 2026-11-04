# Parent app — Figma UI build guide (read fully before coding)

App: `mobile app/parent` (Flutter 3.44, package `parent_app`). Run tools with `export PATH="$PATH:/Users/albinosiby/development/flutter/bin"`.
It already follows the user's blueprint (`/Users/albinosiby/Tatos Dev/flutter_file_structure/README.md`) and global rules
(`~/.claude/CLAUDE.md`): read README.md of the app and those two files first. Your job: build/rebuild your screens from the Figma
"Parent App" frames, fully working end to end (every button, form, filter, sheet, navigation), and test it.

## Design source
- Images: `website/design/parent/png/<frameId>_<name>.png` (402×874, Figma frame size; long screens are clipped at 874px).
- Specs: `website/design/parent/spec/<frameId>_<name>.json` → `data.spec` tree (`type,name,w,h,radius,fill{hex},text{...},children`).
  Big files: print TEXT nodes in order with a small python script to get all copy/sample data, incl. below the fold. Never cat them.
- Visual language = the existing design system (`lib/design_system/`, same as the teacher app). Match the frames' layout, hierarchy,
  copy and colours; if a frame needs a colour not in `tokens/app_tokens.dart`, append a named constant there.
- Photos in Figma (child/teacher/school photos) → `Avatar` initials or gradient illustration blocks (no image assets).

## Non-negotiable conventions (from the blueprint / CLAUDE.md)
1. Structure: `lib/modules/<feature>/{bloc,models,repositories,screens}`; module-only widgets in `screens/widgets/`. Reusable,
   presentational widgets → `lib/design_system/components/app_<name>.dart` (one per file, ScreenUtil + tokens only, no BLoC imports),
   then append one export line to `design_system/design_system.dart` (re-read before editing; others append too). Check the folder
   first — many components exist (pills, cards, segmented, choice chips, pick tile, stepper, stat ring/box, bar chart, toggle rows,
   settings group, info tile, file chip, avatar stack, loading skeleton, …).
2. Sizing: flutter_screenutil everywhere: `.w` widths/horizontal, `.h` heights/vertical, `.r` radii/icons/squares, `.sp` fonts. No raw
   pixel literals in widget code (0, 1–1.5 borders, flex, durations excepted). Design size is now 402×874 (constants/app_constants.dart).
3. Routing: go_router only, paths from `RoutePaths` (`config/routes/routes.dart`; append constants if you need more). Register your
   pushed routes ONLY in your `config/routes/modules/<group>_routes.dart`. `context.push` for pushed screens, `context.go` for tabs.
   Never `Navigator.push` for screens (sheets/dialogs via showModalBottomSheet / showAppSheet / AppDialogs are fine).
   The old `RoutePaths.learn/inbox/attendance/learnSection/inboxSection` are deprecated aliases — replace any use in files you own.
4. State: flutter_bloc + equatable. Screen → BLoC → `I<Feature>Repository` (abstract) → `Mock<Feature>Repository` (in-memory, latency via
   `utils/services/mock_latency.dart`). BLoCs depend only on interfaces. Register repos (`registerLazySingleton`) and BLoCs
   (`registerFactory`) ONLY in your `di/modules/<group>_di.dart`.
5. Caching (stale-while-revalidate): repository reads return `Stream<T>` built with `cacheFirst(...)` from
   `utils/services/cache_service.dart` (cached value first, then fresh; refresh failure keeps cache; error only with no cache).
   BLoCs consume with `emit.forEach`. Per-child data: extend `core/bloc/child_data_bloc.dart` and render with
   `core/widgets/child_data_view.dart` (loading / error+Retry / empty / data). Writes (send, apply, edit…) go through the repository and
   push fresh data through the same stream (see `refreshOn` usage in existing mock repositories).
6. Demo data: put new demo data in your module (`modules/<m>/repositories/<m>_demo_data.dart` or inside the mock repo), consistent with
   `di/demo_data.dart` (guardian Mr. Rajesh Sharma, children Aarav 10-B / Ananya). Don't edit `di/demo_data.dart` except to append.
   Figma shows "Aarav Sharma, Roll #18, Delhi Public School…" — keep the app's existing family/school data unless the frame's copy is
   generic; consistency across screens beats matching sample names.
7. Every tappable thing works: navigation to the right route, sheets open/close, forms validate inline and save, toggles persist
   (in memory), search/filter/tabs filter real data, counts derive from data, success snackbars (`AppDialogs.showSnackBar`). Things
   needing real services (calls, maps/GPS, camera, file picker, payments, Google/Apple sign-in, PDF download) are simulated with a
   clear result (snackbar / record written / mock state change) — never a dead button.
8. Accessibility & polish: ≥44 tap targets, Semantics/tooltips on icon-only buttons, ellipsis on long text, no overflow at 360–430 width.

## Tabs (already wired in routes_config.dart — don't edit that file)
Home `/home` (HomeScreen) · Academics `/academics?section=…` (AcademicsScreen, modules/academics) · Fees `/fees` (FeesScreen, now a
TAB, not pushed) · Messages `/messages` (MessagesScreen, modules/messages) · More `/more` (MoreScreen).
Tab screens use the parent tab header (`modules/family/screens/widgets/parent_tab_header.dart`, with the child switcher) — the Home
frame's header (Edvio PARENT, AY pill, school, bell with dot → /notifications, avatar → /more/profile) is the reference for all tabs.

## Ownership (only edit what you own; append-only for shared barrel/tokens/routes.dart)
- A auth: modules/auth, modules/family, core/walk_through, config/routes/modules/auth_routes.dart, di/modules/auth_di.dart,
  test/auth_test.dart, test/family_test.dart.
- B home: modules/home, modules/leave, modules/live_classes, NEW modules/transport, NEW modules/behaviour,
  config/routes/modules/home_routes.dart, di/modules/home_di.dart, test/home_*_test.dart, test/live_class_test.dart.
- C messages: modules/messages, modules/inbox (retire it), config/routes/modules/messages_routes.dart, di/modules/messages_di.dart,
  test/messages_test.dart.
- D profile: modules/profile, modules/notices (→ notifications), NEW modules/settings (or core/settings), config/routes/modules/profile_routes.dart,
  di/modules/profile_di.dart, test/profile_test.dart.
- E student: modules/more, NEW modules/student (student profile, certificates), NEW modules/ptm, NEW modules/teachers,
  config/routes/modules/student_routes.dart, di/modules/student_di.dart, test/student_test.dart.
- F academics: NEW modules/academics (tab host; may replace modules/learn), modules/attendance, homework, marks, timetable, fees,
  config/routes/modules/academics_routes.dart, di/modules/academics_di.dart, test/academics_test.dart, test/domain_test.dart.
- Lead: everything else (main.dart, routes_config.dart, routes.dart (append ok), injection.dart, global_blocs.dart, utils/, core/bloc,
  core/widgets, constants/, test/screens_test.dart — leave screens_test.dart failing cases alone; the lead rewrites it).

## Verify (no `flutter run`/`build`; the lead runs the app)
`dart analyze lib test` clean for your files; `flutter test test/<your tests>` green. Tests: use `test/helpers/pump_app.dart`
(`setUpTestApp(signedIn: true)`, `pumpApp(tester, location: RoutePaths.x)`), one widget test per screen walking its buttons/forms, BLoC
tests for new BLoCs, repository tests for new caching repos.

## Final report (brief)
Frames → routes/screens, new modules/BLoCs/repos, components added, simulated actions, deviations from Figma and why.
