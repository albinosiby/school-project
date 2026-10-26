#!/usr/bin/env bash
# Starts the Firebase emulators (auth, firestore, functions) for the end-to-end check of the three apps.
# demo-* project id: never touches the live project. Same JDK shim as tools/emulator_exec.sh.
set -euo pipefail
cd "$(dirname "$0")/../.."   # website/
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
fi
export METADATA_SERVER_DETECTION=none FUNCTIONS_DISCOVERY_TIMEOUT="${FUNCTIONS_DISCOVERY_TIMEOUT:-120}"
exec firebase emulators:start --only auth,firestore,functions --project "${EMULATOR_PROJECT:-demo-school-e2e}"
