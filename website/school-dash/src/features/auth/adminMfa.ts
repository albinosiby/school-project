import { httpsCallable } from "firebase/functions";
import { EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { startAuthentication, startRegistration, type PublicKeyCredentialCreationOptionsJSON, type PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/browser";
import { auth, functions } from "@/lib/firebase";
export type PasskeyStatus = { enabled: boolean; verified: boolean; credentials: { id: string; label: string; rpId: string; createdAt: string; lastUsedAt: string }[] };
export type MfaResult = { token: string; recoveryCodes?: string[] };
export async function mfaCall<T>(action: string, fields: Record<string, unknown> = {}) {
  return (await httpsCallable<Record<string, unknown>, T>(functions, "manageAdminMfa")({ action, ...fields })).data;
}
export async function confirmPassword(password: string) {
  const user = auth.currentUser;
  if (!user?.email || !password) throw new Error("Enter your current password.");
  await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, password));
}
export async function registerAdminPasskey(password: string, label: string) {
  await confirmPassword(password);
  const { options, challengeId } = await mfaCall<{ options: PublicKeyCredentialCreationOptionsJSON; challengeId: string }>("beginRegistration");
  const response = await startRegistration({ optionsJSON: options });
  return mfaCall<MfaResult>("finishRegistration", { challengeId, response, label });
}
export async function verifyAdminPasskey() {
  const { options, challengeId } = await mfaCall<{ options: PublicKeyCredentialRequestOptionsJSON; challengeId: string }>("beginAuthentication");
  const response = await startAuthentication({ optionsJSON: options });
  return mfaCall<MfaResult>("finishAuthentication", { challengeId, response });
}
export function mfaError(error: unknown) {
  const e = error as { name?: string; code?: string; message?: string };
  if (e.name === "NotAllowedError" || e.code === "ERROR_CEREMONY_ABORTED") return "Passkey verification was cancelled or timed out. Try again.";
  if (/auth\/(wrong-password|invalid-credential)/.test(e.code || "")) return "The current password is incorrect.";
  if (e.code === "functions/unavailable" || e.code === "functions/internal") return "The passkey service could not be reached. Try again.";
  return e.message || "Could not complete passkey verification. Try again.";
}
