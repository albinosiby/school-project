"use client";
// Parent login and consent data for the school dashboard (data contract section 13.1).
import { useEffect, useSyncExternalStore } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "./firebase";
import { useAuth } from "./authContext";

export type SchoolUser = { id: string; schoolId: string; role: "admin" | "teacher" | "parent"; email?: string; name?: string; staffId?: string; studentIds?: string[]; createdAt?: string; parentCredentialVersion?: string };
export type ParentCredentials = { email: string; password: string };

type ParentAccessResult =
  | ({ state: "issued" } & ParentCredentials)
  | { state: "active"; email: string }
  | { state: "off" };

export async function setParentAppAccess(studentId: string, access: { enabled: false; unlinkUid?: string } | { enabled: true; email: string; regenerate?: boolean }) {
  const request = { studentId, ...access };
  const { data } = await httpsCallable<typeof request, ParentAccessResult>(functions, "setParentAppAccess")(request);
  return data;
}

type ParentPasswordResult = { state: "revealed"; password: string } | { state: "replacement-required" };

export async function revealParentPassword(studentId: string, version: string) {
  const request = { studentId, version };
  const { data } = await httpsCallable<typeof request, ParentPasswordResult>(functions, "revealParentPassword")(request);
  return data;
}

export type Consent = { id: string; uid?: string; studentIds?: string[]; version?: string | number; acceptedAt?: unknown; withdrawn?: boolean;
  items?: { dataProcessing?: boolean; photos?: boolean; notifications?: boolean } };

export const normEmail = (e: string) => e.trim().toLowerCase();
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

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

/** A consent that counts: recorded and not withdrawn (13.6: `withdrawn: true` or a deleted doc = withdrawn). */
export const consentGiven = (c: Consent | undefined) => !!c && c.withdrawn !== true;

/** consents rows keyed by the parent uid (`uid`, else the doc id, which is the uid by contract 13.3). */
export const consentMap = (rows: Consent[]) => new Map(rows.map((c) => [c.uid || c.id, c]));

/**
 * "Given" | "Pending" | "None" (no parent login linked) for a student, from its guardianUids and the consents collection.
 * Given = at least one linked parent login has a consent that is not withdrawn.
 */
export type ConsentState = "Given" | "Pending" | "None";
export const consentState = (guardianUids: string[] | undefined, consents: Map<string, Consent>): ConsentState =>
  !guardianUids?.length ? "None" : guardianUids.some((u) => consentGiven(consents.get(u))) ? "Given" : "Pending";
