#!/usr/bin/env bash
# Fresh emulator school, parent linked to two children, then the driver UI run on a USB phone.
#   integration_test/run_on_device.sh <device-id>      (emulators must be running: website/tools/e2e/start_emulators.sh)
set -euo pipefail
DEV="${1:?device id}"
APP="$(cd "$(dirname "$0")/.." && pwd)"; WEB="$APP/../../website"
ADB="${ADB:-adb}"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
# stop every app of the suite first: an app killed while holding Firestore listeners makes the emulator refuse
# writes (CANCELLED) for a few seconds
for p in tatos.tech.school.driver_app tech.tatos.parent_app tatos.tech.teacher_app; do "$ADB" -s "$DEV" shell am force-stop "$p" || true; done
sleep 8
"$ADB" -s "$DEV" shell pm clear tatos.tech.school.driver_app >/dev/null 2>&1 || true
(cd "$WEB" && node tools/e2e/seed.mjs && node tools/e2e/act.mjs link >/dev/null)
"$ADB" -s "$DEV" reverse tcp:8080 tcp:8080 >/dev/null; "$ADB" -s "$DEV" reverse tcp:9099 tcp:9099 >/dev/null
"$ADB" -s "$DEV" shell input keyevent KEYCODE_WAKEUP
PW=$(node -e "console.log(require('$WEB/tools/e2e/.accounts.json').driver.password)")
cd "$APP" && flutter test integration_test/firebase_e2e_test.dart -d "$DEV" \
  --dart-define=BACKEND=firebase --dart-define=EMULATOR=true --dart-define=EMULATOR_USB=true \
  --dart-define=E2E_EMAIL=driver@e2e.test --dart-define=E2E_PASSWORD="$PW"
