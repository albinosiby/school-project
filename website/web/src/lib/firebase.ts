import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, getFirestore } from "firebase/firestore";
import { connectStorageEmulator, getStorage } from "firebase/storage";
import { connectFunctionsEmulator, getFunctions } from "firebase/functions";

/**
 * Development only: `NEXT_PUBLIC_EMULATOR=true npm run dev` talks to the local Firebase emulators (website/tools/e2e) on a
 * demo project, never the live one. NEXT_PUBLIC_EMULATOR_HOST defaults to localhost.
 */
export const useEmulator = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_EMULATOR === "true";
const emulatorHost = process.env.NEXT_PUBLIC_EMULATOR_HOST || "localhost";
/** Firestore emulator port (firebase.json: 8080); NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT when it runs elsewhere. */
const firestorePort = Number(process.env.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT) || 8080;

export const firebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: useEmulator ? process.env.NEXT_PUBLIC_EMULATOR_PROJECT || "demo-school-e2e" : process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};
const app = getApps().length ? getApp() : initializeApp(firebaseOptions);

/** Points an Auth instance at the emulator in emulator mode (also used for the secondary app that creates logins). */
export function withEmulator(a: Auth) {
  if (useEmulator && !a.emulatorConfig) connectAuthEmulator(a, `http://${emulatorHost}:9099`, { disableWarnings: true });
  return a;
}

export const auth = withEmulator(getAuth(app));
// ignoreUndefinedProperties: seed/UI rows may carry optional `undefined` fields.
export const db = (() => {
  try {
    const f = initializeFirestore(app, { ignoreUndefinedProperties: true });
    if (useEmulator) connectFirestoreEmulator(f, emulatorHost, firestorePort);
    return f;
  } catch { return getFirestore(app); }
})();

/** Cloud Storage (signed certificates, contract 13.7). */
export const storage = (() => {
  const s = getStorage(app);
  if (useEmulator) { try { connectStorageEmulator(s, emulatorHost, 9199); } catch { /* already connected */ } }
  return s;
})();

/** Callable Cloud Functions (owner console actions, contract 16), in the functions codebase's region (asia-south1). */
export const functions = (() => {
  const f = getFunctions(app, "asia-south1");
  if (useEmulator) { try { connectFunctionsEmulator(f, emulatorHost, 5001); } catch { /* already connected */ } }
  return f;
})();

/** Firestore of another app instance (the owner console's secondary app), pointed at the emulator in emulator mode. */
export function firestoreFor(other: FirebaseApp) {
  try {
    const f = initializeFirestore(other, { ignoreUndefinedProperties: true });
    if (useEmulator) connectFirestoreEmulator(f, emulatorHost, firestorePort);
    return f;
  } catch { return getFirestore(other); }
}
