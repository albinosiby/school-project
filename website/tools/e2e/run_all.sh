#!/usr/bin/env bash
# Full verification of the four apps and the shared backend, against the LOCAL emulators only.
#   tools/e2e/run_all.sh                # rules, sync suite, scheduled notices, every app's unit tests
#   tools/e2e/run_all.sh <device-id>    # ... plus the live UI chain on a USB phone (driver -> parent -> teacher -> parent)
# Needs: emulators running (tools/e2e/start_emulators.sh), Flutter and adb on PATH. Runs one thing at a time (8 GB machines).
set -uo pipefail
WEB="$(cd "$(dirname "$0")/../.." && pwd)"; APPS="$WEB/../mobile app"
export FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
declare -a RESULTS=()
# apps left open on a connected phone keep Firestore listeners that upset the emulator: stop them first (best effort)
if command -v adb >/dev/null; then
  for d in $(adb devices | awk 'NR>1 && $2=="device" {print $1}'); do
    for p in tatos.tech.school.driver_app tech.tatos.parent_app tatos.tech.teacher_app; do adb -s "$d" shell am force-stop "$p" >/dev/null 2>&1; done
  done
  sleep 8
fi
step() { local name="$1"; shift; echo; echo "=== $name"; if "$@"; then RESULTS+=("PASS  $name"); else RESULTS+=("FAIL  $name"); fi; }

step "Firestore rules"            bash -c "cd '$WEB/tools/rules_test' && node test.mjs"
step "seed (fresh emulator school)" bash -c "cd '$WEB' && node tools/e2e/seed.mjs && sleep 15"
step "cross-app sync suite"       bash -c "cd '$WEB' && node tools/e2e/sync_test.mjs"
step "scheduled notices"          bash -c "cd '$WEB' && node tools/e2e/scheduled_test.mjs"
step "admin web unit tests"       bash -c "cd '$WEB/web' && npm test --silent && npx tsc --noEmit && npm run lint --silent"
for app in driver parent teacher; do
  step "$app app analyze + tests" bash -c "cd '$APPS/$app' && flutter analyze && flutter test --concurrency=1"
done
if [ $# -ge 1 ]; then
  DEV="$1"
  step "phone: driver"            bash -c "cd '$APPS/driver' && integration_test/run_on_device.sh '$DEV'"
  step "phone: parent"            bash -c "cd '$APPS/parent' && integration_test/run_after_driver.sh '$DEV'"
  step "phone: teacher"           bash -c "cd '$APPS/teacher' && integration_test/run_after_parent.sh '$DEV'"
  step "phone: parent (after teacher)" bash -c "cd '$APPS/parent' && E2E_PHASE=after_teacher integration_test/run_after_driver.sh '$DEV'"
fi
echo; echo "=== summary"; printf '%s\n' "${RESULTS[@]}"
! printf '%s\n' "${RESULTS[@]}" | grep -q '^FAIL'
