# Firestore rules tests

Tests `website/firestore.rules` against the role model in `docs/DATA_CONTRACT.md` sections 7, 12 and 13 (admin, teacher, parent, cross-school, private data, parent privacy).
Uses the local emulator only. Nothing is deployed and no live data is touched.

```bash
cd website/tools/rules_test
npm install
npm test          # firebase emulators:exec --only firestore (needs Java + firebase-tools)
```

`npm test` needs JDK 21+ (firebase-tools requirement). With an older JDK, start the cached emulator jar yourself and run the script against it:

```bash
java -jar ~/.cache/firebase/emulators/cloud-firestore-emulator-v*.jar --host=127.0.0.1 --port=8080 &
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node test.mjs
```
Or from `website/`: `EMULATOR_PROJECT=demo-school-rules tools/emulator_exec.sh firestore "cd tools/rules_test && node test.mjs"` (handles JDK < 21).

Status: 171 checks (68 admin/teacher + 103 parent app), all passing (JDK 17, cached emulator jar, 2026-10-27).
