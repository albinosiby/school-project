// Creates the teacher login for a staff member (data contract section 1).
// A secondary Firebase app instance is used so the admin stays signed in on the primary one.
import { getApps, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut, type User } from "firebase/auth";
import { auth, firebaseOptions } from "./firebase";

export type NewAccount = { uid: string; /** undo: deletes the freshly created Auth user (call if a later write fails) */ rollback: () => Promise<void>; /** signs the secondary app out; call when done */ finish: () => Promise<void> };

const randomPassword = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32) + "Aa1!";
};

export const accountError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/email-already-in-use": "This email already has a login (it may belong to another school). Use a different email.",
    "auth/invalid-email": "The email address is not valid.",
    "auth/operation-not-allowed": "Email/password sign-in is disabled for this project.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  };
  return map[code] ?? (e instanceof Error ? e.message : "Could not create the login");
};

/** Creates the Auth user with a random password. Throws a Firebase error (use accountError for the message). */
export async function createAccount(email: string): Promise<NewAccount> {
  const secondary = getApps().find((a) => a.name === "secondary") ?? initializeApp(firebaseOptions, "secondary");
  const sAuth = getAuth(secondary);
  const cred = await createUserWithEmailAndPassword(sAuth, email.trim(), randomPassword());
  const user: User = cred.user;
  const finish = async () => { await signOut(sAuth).catch(() => {}); };
  const rollback = async () => { await user.delete().catch(() => {}); await finish(); };
  return { uid: user.uid, rollback, finish };
}

/** Sends the "set your password" email. The teacher uses it for first sign-in. */
export const sendInvite = (email: string) => sendPasswordResetEmail(auth, email.trim());
