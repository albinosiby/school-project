// The signed-in admin changes their own password (the owner console gives a school admin a first password, contract 16).
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { auth } from "./firebase";

export const MIN_PASSWORD = 8;

/** Field errors for the change-password form; empty when it can be sent. Pure (exported for tests). */
export function passwordErrors(v: { current: string; next: string; confirm: string }) {
  const e: Partial<Record<"current" | "next" | "confirm", string>> = {};
  if (!v.current) e.current = "Enter your current password.";
  if (v.next.length < MIN_PASSWORD) e.next = `Use at least ${MIN_PASSWORD} characters.`;
  else if (v.next === v.current) e.next = "Choose a password you have not used here.";
  if (v.confirm !== v.next) e.confirm = "The two new passwords do not match.";
  return e;
}

const MESSAGES: Record<string, string> = {
  "auth/wrong-password": "Your current password is not correct.",
  "auth/invalid-credential": "Your current password is not correct.",
  "auth/invalid-login-credentials": "Your current password is not correct.",
  "auth/weak-password": `Use at least ${MIN_PASSWORD} characters.`,
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/requires-recent-login": "Sign out, sign in again and retry.",
};
export const passwordError = (e: unknown) => MESSAGES[(e as { code?: string })?.code ?? ""] ?? (e instanceof Error ? e.message : "Could not change the password.");

/** Confirms the current password, then sets the new one. Throws a Firebase error (use passwordError for the message). */
export async function changePassword(current: string, next: string) {
  const u = auth.currentUser;
  if (!u?.email) throw new Error("Sign in again to change your password.");
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, current));
  await updatePassword(u, next);
}
