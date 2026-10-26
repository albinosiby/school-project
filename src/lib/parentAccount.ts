"use client";
// Parent logins (data contract section 13.1). A parent login is created like a staff login (secondary app, random password,
// password-reset invite) and linked to students through `students.guardianUids`. The Cloud Function `onStudentWritten`
// fills users/{uid}.studentIds / classIds / grns; this file never writes those arrays except their empty initial values.
import { useEffect, useSyncExternalStore } from "react";
import { arrayRemove, arrayUnion, collection, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "./firebase";
import { useAuth } from "./authContext";
import { accountError, createAccount, sendInvite } from "./staffAccount";

export type SchoolUser = { id: string; schoolId: string; role: "admin" | "teacher" | "parent"; email?: string; name?: string; staffId?: string; studentIds?: string[]; createdAt?: string };
export type Consent = { id: string; uid?: string; studentIds?: string[]; version?: string | number; acceptedAt?: unknown; items?: { dataProcessing?: boolean; photos?: boolean; notifications?: boolean } };

export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" });

/** Shared realtime listener on users where schoolId == the signed-in school (admins may read those). */
type UsersState = { sid: string | null; users: SchoolUser[]; ready: boolean };
const EMPTY_USERS: UsersState = { sid: null, users: [], ready: false };
let usersState: UsersState = EMPTY_USERS;
let usersUnsub: (() => void) | null = null;
const usersSubs = new Set<() => void>();
const setUsers = (s: UsersState) => { usersState = s; usersSubs.forEach((f) => f()); };
function listenUsers(sid: string | null) {
  if (sid === usersState.sid && (usersUnsub || !sid)) return;
  usersUnsub?.(); usersUnsub = null;
  setUsers({ sid, users: [], ready: false });
  if (sid) usersUnsub = onSnapshot(query(collection(db, "users"), where("schoolId", "==", sid)),
    (snap) => setUsers({ sid, users: snap.docs.map((d) => ({ ...(d.data() as Omit<SchoolUser, "id">), id: d.id })), ready: true }),
    () => setUsers({ sid, users: [], ready: true }));
}
const subscribeUsers = (cb: () => void) => { usersSubs.add(cb); return () => { usersSubs.delete(cb); }; };

/** All logins of this school (admin, teachers, parents), live. */
export function useSchoolUsers() {
  const sid = useAuth().user?.schoolId ?? null;
  const s = useSyncExternalStore(subscribeUsers, () => usersState, () => EMPTY_USERS);
  useEffect(() => { listenUsers(sid); }, [sid]);
  return s.sid === sid ? { users: s.users, ready: s.ready } : { users: EMPTY_USERS.users, ready: false };
}

/** "Given" | "Pending" | "None" (no parent login linked) for a student, from its guardianUids and the consents collection. */
export type ConsentState = "Given" | "Pending" | "None";
export const consentState = (guardianUids: string[] | undefined, consents: Map<string, Consent>): ConsentState =>
  !guardianUids?.length ? "None" : guardianUids.some((u) => consents.has(u)) ? "Given" : "Pending";

class LinkError extends Error {}
export const parentError = (e: unknown) => e instanceof LinkError ? e.message
  : (e as { code?: string })?.code === "auth/email-already-in-use"
    ? "This email already has a login that is not a parent login of this school (a staff/admin account, or another school). Use a different email."
    : accountError(e);

/**
 * Links a parent login with `email` to student `studentId`. Reuses an existing parent login of this school (siblings share a uid);
 * otherwise creates the Auth user + users/{uid} and sends the password invite. All-or-nothing: the Auth user is deleted if
 * the Firestore writes fail. Returns what happened.
 */
export async function linkParent(sid: string, studentId: string, rawEmail: string, guardianName: string): Promise<{ uid: string; created: boolean; invited: boolean }> {
  const email = normEmail(rawEmail);
  if (!validEmail(email)) throw new LinkError("Enter a valid email address.");
  const studentRef = doc(db, "schools", sid, "students", studentId);
  const same = await getDocs(query(collection(db, "users"), where("schoolId", "==", sid), where("email", "==", email)));
  const existing = same.docs.find((d) => d.data().role === "parent");
  if (existing) {
    await updateDoc(studentRef, { guardianUids: arrayUnion(existing.id), guardianEmail: email, ...stamp() });
    return { uid: existing.id, created: false, invited: false };
  }
  if (!same.empty) throw new LinkError("This email is already used by a staff or admin login of this school. Use a different email.");
  const acct = await createAccount(email);
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, "users", acct.uid), { schoolId: sid, role: "parent", email, name: guardianName.trim(), studentIds: [], classIds: [], grns: [], createdAt: new Date().toISOString() });
    batch.update(studentRef, { guardianUids: arrayUnion(acct.uid), guardianEmail: email, ...stamp() });
    await batch.commit();
  } catch (e) { await acct.rollback(); throw e; }
  let invited = true;
  try { await sendInvite(email); } catch { invited = false; }
  await acct.finish();
  return { uid: acct.uid, created: true, invited };
}

export const unlinkParent = (sid: string, studentId: string, uid: string) =>
  updateDoc(doc(db, "schools", sid, "students", studentId), { guardianUids: arrayRemove(uid), ...stamp() });

export const resendParentInvite = (email: string) => sendInvite(normEmail(email));
