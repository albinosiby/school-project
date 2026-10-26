# Firestore rules tests

Tests `website/firestore.rules` against the role model in `docs/DATA_CONTRACT.md` section 7 (admin, teacher, parent, cross-school, private data).
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
Status: 68 checks, all passing when last run this way (JDK 17, 2026-10-26).
