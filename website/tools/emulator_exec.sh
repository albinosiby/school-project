#!/usr/bin/env bash
# Runs a command against the local Firebase emulators (never the live project: demo-* project id, no credentials).
#   tools/emulator_exec.sh <emulators> <command>      e.g. tools/emulator_exec.sh firestore,functions "node tools/parent_flow_test/test.mjs"
# firebase-tools 14+ refuses to start the Firestore emulator on a JDK older than 21. With an older JDK this script falls back
# to the newest cached emulator jar (~/.cache/firebase/emulators) and a `java` wrapper that reports version 21 to the CLI.
# Installing JDK 21 makes the fallback unnecessary.
set -euo pipefail
ONLY="$1"; shift
cd "$(dirname "$0")/.."   # website/
[ -d functions/node_modules ] || (cd functions && npm ci)
JAVA_MAJOR=$(java -version 2>&1 | sed -nE 's/.*version "([0-9]+).*/\1/p' | head -1)
if [ "${JAVA_MAJOR:-0}" -lt 21 ]; then
  JAR=$(ls "$HOME"/.cache/firebase/emulators/cloud-firestore-emulator-v*.jar 2>/dev/null | sort -V | tail -1 || true)
  [ -n "$JAR" ] || { echo "Need JDK 21+, or a cached Firestore emulator jar in ~/.cache/firebase/emulators"; exit 1; }
  SHIM=$(mktemp -d); REAL=$(command -v java)
  cat > "$SHIM/java" <<SH
#!/bin/sh
for a in "\$@"; do [ "\$a" = "-version" ] && { echo 'openjdk version "21.0.0" (shim for the Firebase CLI)' >&2; exit 0; }; done
exec "$REAL" "\$@"
SH
  chmod +x "$SHIM/java"
  export PATH="$SHIM:$PATH" FIRESTORE_EMULATOR_BINARY_PATH="$JAR"
  echo "JDK $JAVA_MAJOR < 21: running $(basename "$JAR") through a version shim"
fi
# no Google metadata server locally: without this firebase-admin probes it and every function call stalls for seconds
export METADATA_SERVER_DETECTION=none
# a busy machine can take longer than the default 30 s to boot a functions worker ("Failed to load function.")
export FUNCTIONS_DISCOVERY_TIMEOUT="${FUNCTIONS_DISCOVERY_TIMEOUT:-120}"
exec firebase emulators:exec --only "$ONLY" --project "${EMULATOR_PROJECT:-demo-school-parent}" "$*"
