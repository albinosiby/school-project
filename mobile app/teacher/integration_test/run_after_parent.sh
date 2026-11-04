#!/usr/bin/env bash
# Teacher UI run on a USB phone after the driver and parent runs (same emulator school).
#   integration_test/run_after_parent.sh <device-id>
set -euo pipefail
DEV="${1:?device id}"
APP="$(cd "$(dirname "$0")/.." && pwd)"; WEB="$APP/../../website"
ADB="${ADB:-adb}"
# stop every app of the suite first: an app killed while holding Firestore listeners makes the emulator refuse
# writes (CANCELLED) for a few seconds
for p in tatos.tech.school.driver_app tech.tatos.parent_app tatos.tech.teacher_app; do "$ADB" -s "$DEV" shell am force-stop "$p" || true; done
sleep 8
"$ADB" -s "$DEV" shell pm clear tatos.tech.teacher_app >/dev/null 2>&1 || true
for p in 8080 9099 9199; do "$ADB" -s "$DEV" reverse tcp:$p tcp:$p >/dev/null; done
"$ADB" -s "$DEV" shell input keyevent KEYCODE_WAKEUP
PW=$(node -e "console.log(require('$WEB/tools/e2e/.accounts.json').teacher.password)")
cd "$APP" && flutter test integration_test/firebase_e2e_test.dart -d "$DEV" \
  --dart-define=BACKEND=firebase --dart-define=EMULATOR=true --dart-define=EMULATOR_USB=true \
  --dart-define=E2E_EMAIL=anita@e2e.test --dart-define=E2E_PASSWORD="$PW"
