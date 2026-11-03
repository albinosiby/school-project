#!/usr/bin/env bash
# Parent UI run on a USB phone, right after mobile app/driver/integration_test/run_on_device.sh (same emulator school).
#   integration_test/run_after_driver.sh <device-id>
set -euo pipefail
DEV="${1:?device id}"
APP="$(cd "$(dirname "$0")/.." && pwd)"; WEB="$APP/../../website"
ADB="${ADB:-adb}"
# stop every app of the suite first: an app killed while holding Firestore listeners makes the emulator refuse
# writes (CANCELLED) for a few seconds
for p in com.tatos.school.driver_app tech.tatos.parent_app com.greenfield.teacher_app; do "$ADB" -s "$DEV" shell am force-stop "$p" || true; done
sleep 8
"$ADB" -s "$DEV" shell pm clear tech.tatos.parent_app >/dev/null 2>&1 || true
"$ADB" -s "$DEV" reverse tcp:8080 tcp:8080 >/dev/null; "$ADB" -s "$DEV" reverse tcp:9099 tcp:9099 >/dev/null
"$ADB" -s "$DEV" shell input keyevent KEYCODE_WAKEUP
PW=$(node -e "console.log(require('$WEB/tools/e2e/.accounts.json').parent.password)")
cd "$APP" && flutter test integration_test/firebase_e2e_test.dart -d "$DEV" \
  --dart-define=BACKEND=firebase --dart-define=EMULATOR=true --dart-define=EMULATOR_USB=true \
  --dart-define=E2E_EMAIL=parent@e2e.test --dart-define=E2E_PASSWORD="$PW" --dart-define=E2E_PHASE="${E2E_PHASE:-}"
