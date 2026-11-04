"use client";
// Owner console actions (DATA_CONTRACT section 16).
// New logins are created on a secondary Firebase app so the owner stays signed in on the default one. A new school is
// bootstrapped by that secondary app signed in as the new admin (the same starter data as a self sign-up), then the
// owner records it in platform_schools. Setting another login's password and deleting a school need admin credentials:
// the ownerSetPassword / ownerDeleteSchool Cloud Functions do those.
import { deleteApp, getApps, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, sendPasswordResetEmail, signOut, updateProfile } from "firebase/auth";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { bootstrapSchool } from "@/lib/bootstrap";
import { auth, db, firebaseOptions, firestoreFor, functions, withEmulator } from "@/lib/firebase";
import type { LeadStatus, NewSchoolInput, PlatformSchool } from "./logic";

const nowIso = () => new Date().toISOString();
const me = () => auth.currentUser?.uid ?? "";

/** A fresh secondary app per login creation: its Auth session and Firestore are thrown away afterwards. */
async function withSecondary<T>(fn: (a: ReturnType<typeof getAuth>, app: ReturnType<typeof initializeApp>) => Promise<T>) {
  const name = `owner-${Date.now().toString(36)}`;
  const app = getApps().find((a) => a.name === name) ?? initializeApp(firebaseOptions, name);
  const sAuth = withEmulator(getAuth(app));
  try { return await fn(sAuth, app); } finally { await signOut(sAuth).catch(() => {}); await deleteApp(app).catch(() => {}); }
}

export const ownerError = (e: unknown): string => {
  const code = (e as { code?: string })?.code ?? "";
  const map: Record<string, string> = {
    "auth/email-already-in-use": "This email already has a login (maybe in another school). Use a different email.",
    "auth/invalid-email": "The email address is not valid.",
    "auth/weak-password": "The password is too weak. Use at least 8 characters.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
    "permission-denied": "Your account is not allowed to do this. Sign in again as a product owner.",
    "functions/permission-denied": "Your account is not allowed to do this. Sign in again as a product owner.",
    "functions/not-found": "That login no longer exists.",
    "functions/unavailable": "The server could not be reached. Check that the Cloud Functions are deployed.",
    "functions/internal": "The server could not finish this. Try again.",
  };
  return map[code] ?? (e instanceof Error ? e.message.replace(/^Firebase:\s*/, "") : "Something went wrong.");
};

/** Platform record of a school, merged with what is there already (the rules check the whole doc). */
async function writePlatform(sid: string, patch: Partial<PlatformSchool>) {
  const ref = doc(db, "platform_schools", sid);
  const cur = (await getDoc(ref)).data() as PlatformSchool | undefined;
  const base = cur ?? { status: "active", plan: "", note: "", reason: "", createdAt: nowIso(), createdBy: me() };
  const { id: _id, ...rest } = { ...base, ...patch } as PlatformSchool; void _id;
  await setDoc(ref, { ...rest, updatedAt: nowIso(), updatedBy: me() });
}

/**
 * Adds a school with its first admin login (email + the password the owner chose). Returns the school id (= the
 * admin's uid). If anything fails after the login exists, the login is removed again.
 */
export async function createSchool(v: NewSchoolInput, leadId = ""): Promise<string> {
  const name = v.name.trim(), email = v.adminEmail.trim().toLowerCase(), adminName = v.adminName.trim();
  const sid = await withSecondary(async (sAuth, app) => {
    const cred = await createUserWithEmailAndPassword(sAuth, email, v.password);
    try {
      await updateProfile(cred.user, { displayName: name });
      await bootstrapSchool(cred.user.uid, name, email, { adminName, city: v.city.trim(), board: v.board, phone: v.phone.trim() }, firestoreFor(app));
      return cred.user.uid;
    } catch (e) {
      await deleteDoc(doc(db, "users", cred.user.uid)).catch(() => {});
      await cred.user.delete().catch(() => {});
      throw e;
    }
  });
  await writePlatform(sid, { name, status: "active", plan: v.plan, adminEmail: email, adminName, city: v.city.trim(), board: v.board, phone: v.phone.trim(), leadId, createdAt: nowIso(), createdBy: me() });
  if (leadId) await updateLead(leadId, { status: "converted", schoolId: sid }).catch(() => {});
  return sid;
}

/** Another admin login for an existing school (e.g. the principal and the office manager). */
export async function addAdminLogin(sid: string, v: { name: string; email: string; password: string }) {
  const email = v.email.trim().toLowerCase();
  const uid = await withSecondary(async (sAuth) => {
    const cred = await createUserWithEmailAndPassword(sAuth, email, v.password);
    try {
      await setDoc(doc(db, "users", cred.user.uid), { schoolId: sid, role: "admin", email, name: v.name.trim(), createdAt: nowIso(), updatedAt: nowIso(), updatedBy: me() });
      return cred.user.uid;
    } catch (e) { await cred.user.delete().catch(() => {}); throw e; }
  });
  return uid;
}

/** Takes away a login's access to its school (its users doc). The Auth account itself stays until the school is deleted. */
export const removeAccess = (uid: string) => deleteDoc(doc(db, "users", uid));

/** Sets a new password for a school login (Cloud Function, admin credentials). */
export const setPassword = (uid: string, password: string) => httpsCallable(functions, "ownerSetPassword")({ uid, password });
/** Emails the login a link to choose a new password themselves. */
export const sendReset = (email: string) => sendPasswordResetEmail(auth, email.trim());

export const updatePlatform = (sid: string, patch: Partial<PlatformSchool>) => writePlatform(sid, patch);
export const suspendSchool = (sid: string, name: string, reason: string) => writePlatform(sid, { name, status: "suspended", reason: reason.trim() });
export const reactivateSchool = (sid: string, name: string) => writePlatform(sid, { name, status: "active", reason: "" });

/** Removes the school for good: every login, all of its data and files (Cloud Function). */
export const deleteSchool = (sid: string) => httpsCallable<{ schoolId: string; confirm: string }, { ok: boolean; logins: number; files: number }>(functions, "ownerDeleteSchool")({ schoolId: sid, confirm: sid });

export const updateLead = (id: string, patch: { status: LeadStatus; notes?: string; schoolId?: string }) =>
  updateDoc(doc(db, "leads", id), { ...patch, updatedAt: nowIso(), updatedBy: me() });
export const deleteLead = (id: string) => deleteDoc(doc(db, "leads", id));
