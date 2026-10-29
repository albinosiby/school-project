# UI verification

Review dates: 29–30 October 2026. Branch: `codex/driver-app-ui`.

## Scope

All 62 Figma Driver App frames are mapped: 43 driver frames and 19 assistant frames. The app implements welcome/sign-in/verification, crew pairing, both navigation shells, trip readiness, live-trip presentation, manifests, handover, operations forms, profiles, passes, notices, duties and training views.

The [approved plan](../../website/docs/DRIVER_APP_PLAN.md) records product analysis, architecture, proposed production database/API contracts, security, testing and delivery boundaries. The [design coverage guide](../../website/design/driver/README.md) maps every source frame to its route.

## Automated checks

- `flutter analyze`: clean on the final application and test sources.
- `flutter test --update-goldens`: 67 local tests, including guardian code entry and long-roster scrolling, leave-form Submit reachability, plus 115% goldens for home, handover, sweep and profile fields. All passed. Checks cover demo credentials/logout, trip prerequisites, boarding deduplication, rejected guardian codes, both role journeys, and all 62 native view renders with decoded local images.
- All 843 runtime graphic references resolve to local assets. No full reference screenshot is used as an app screen.
- Android debug compilation and installation passed on the wireless moto g60, Android 12 / API 31. The standalone lib/main.dart build was then installed, cold-launched successfully and visually checked on its welcome screen; it is left open for review.
- The completed device suite passed both integration tests: real-keyboard sign-in, role switching, guardian code entry/verification and long-roster scrolling, followed by rendering all 62 screens. Fourteen screenshots were captured and reviewed; copies are in docs/device_screenshots.
- Screenshot review found compact text clipping at the phone's system text scale of 1.15. Single-line labels now fit their source bounds; wrapped text preserves system scaling wherever its source bounds have room and fits only when it would overflow. Native fields also preserve source borders and icon insets. Long structural wrappers share the main scroll viewport, which starts below sticky headers. The device rerun passed with these fixes. A subsequent full-canvas export-wrapper correction for the leave form and two popups is covered by the local suite, including an explicit test that Submit is reachable; this small asset-structure correction was not followed by another complete device sweep.

Commands, run from this folder:

```sh
flutter analyze
flutter test
flutter drive --no-dds \
  --driver=test_driver/integration_test.dart \
  --target=integration_test/ui_test.dart \
  -d <wireless-device-id> \
  --dart-define=UI_REVIEW=true
```

The extended integration driver saves device captures under `build/device_screenshots/`. Reviewed captures are retained under [docs/device_screenshots](docs/device_screenshots/5271.png). `UI_REVIEW` is only for the screen sweep; normal builds enforce demo authentication and primary role redirects. Local goldens are reviewed reference artifacts; update them only after inspecting the change.

## Try the app

1. Open Shift Sync and tap Get Started.
2. Enter a fictional ten-digit mobile number; tap Sign In.
3. Enter demo code **482916**. Choose Lead Driver and confirm pairing.
4. Use Home, Trips, Live and Profile. Starting a trip requires both manual checklist checks. Form changes and trip state last for this app session.
5. Open Profile → Account options → Change crew role. Choose Bus Attendant and confirm pairing. Use Students, Stops and Duties plus the companion shortcuts.
6. Guardian handover accepts demo code **4092**. Sign out clears session records.

## Limits

This delivery is the local-data UI milestone. SMS/identity, authoritative trip records, live GPS/navigation, RFID/NFC/QR hardware, guardian verification, uploads, office messages, document generation and training streaming need production adapters. Hardware/external actions display demo feedback. Source certification/security copy is visual reference content, not evidence of an implemented capability.

The device run is a debug functional/visual check, not a performance benchmark. Release packaging was stopped after heavy memory pressure on the 8 GB host; only debug Android builds are verified. iOS compilation/signing, exhaustive landscape/tablet/desktop review, accessibility certification, extreme text scaling and production service integration are not verified by these results. Compact labels fit available bounds; a production large-text layout needs flexible content geometry beyond the fixed Figma presentation contracts.
