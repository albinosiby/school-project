"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile, type User as FbUser,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, collection, limit, query } from "firebase/firestore";
import { auth, db } from "./firebase";
import { bootstrapSchool } from "./bootstrap";
import { setCollectionScope } from "./useCollection";
import { friendly } from "@edvio/shared/authErrors";
import { selectedSchool } from "@edvio/shared/sites";

/**
 * users/{uid} (data contract section 1) maps a school admin to their school. A product owner (contract 16,
 * platform_admins/{uid}) has no school of their own: schoolId is "" in the owner console, and the id of the school they
 * opened while they work inside one (`actAs`), so the whole admin console runs on that school.
 */
export interface User { id: string; email: string; organizationName: string; schoolId: string; role: "admin" | "owner" }

/** Where a signed-in user starts: the owner console for product owners (unless inside a school), the dashboard for admins. */
export const homeFor = (u: Pick<User, "role"> & { schoolId?: string } | null) => (u?.role === "owner" && !u.schoolId ? "/owner" : "/dashboard");

/** sessionStorage key of the school an owner is working inside (survives a reload, not a new tab). */
const ACT_AS_KEY = "edvio.owner.actAs";
const PENDING_SCHOOL_KEY = "edvio.owner.pendingSchool";
const readPendingSchool = () => { try { return sessionStorage.getItem(PENDING_SCHOOL_KEY) ?? ""; } catch { return ""; } };
const clearPendingSchool = () => { try { sessionStorage.removeItem(PENDING_SCHOOL_KEY); } catch { /* storage blocked */ } };
const readActAs = () => {
  try {
    const requested = selectedSchool(window.location.search);
    if (requested) { sessionStorage.setItem(PENDING_SCHOOL_KEY, requested); return requested; }
    return readPendingSchool() || sessionStorage.getItem(ACT_AS_KEY) || "";
  } catch { return ""; }
};
const writeActAs = (sid: string) => { try { if (sid) sessionStorage.setItem(ACT_AS_KEY, sid); else sessionStorage.removeItem(ACT_AS_KEY); } catch { /* storage blocked */ } };

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  /** owner only: open a school's admin console (school id) or go back to the owner console (null) */
  actAs: (schoolId: string | null) => void;
  /** set when a signed-in account was refused (e.g. teacher account); shown on the login page */
  blockedMessage: string;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, organizationName: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const NOT_ADMIN = "This account is not an administrator account. Teachers and parents must use the mobile app.";
export const NO_SCHOOL = "No school is linked to this account. Contact your school administrator.";
export const SUSPENDED = "This school's account is suspended. Contact Edvio support to restore access.";

/** A missing rule (rules not deployed yet) reads as "no such doc" here, so an old ruleset never locks admins out. */
const unlessDenied = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { if ((e as { code?: string })?.code === "permission-denied") return fallback; throw e; });
/** platform_schools/{schoolId}.status (contract 15). */
const isSuspended = (schoolId: string) =>
  unlessDenied(getDoc(doc(db, "platform_schools", schoolId)).then((d) => d.exists() && d.data()?.status === "suspended"), false);

class Blocked extends Error {}

/**
 * Reads users/{uid} and returns the school scope. A school created before the users collection existed
 * (no doc yet, but data under schools/{uid}) gets its admin doc created on first login.
 */
async function loadProfile(u: FbUser): Promise<User> {
  // product owner first: platform_admins/{uid} is written only with admin credentials (tools/owner/grant-owner.mjs)
  const owner = await unlessDenied(getDoc(doc(db, "platform_admins", u.uid)).then((d) => d.exists()), false);
  if (owner) return { id: u.uid, email: u.email ?? "", organizationName: "Edvio", schoolId: "", role: "owner" };
  const ref = doc(db, "users", u.uid);
  // a failed read is an error (network / rules), never "no profile": only a missing doc may take the legacy self-create path
  let snap = await getDoc(ref);
  let p = snap.exists() ? (snap.data() as { schoolId?: string; role?: string }) : null;
  if (!p) {
    // legacy school: self-create {schoolId: uid, role: admin}, keep it only if schools/{uid} really has data
    await setDoc(ref, { schoolId: u.uid, role: "admin", email: u.email ?? "", name: u.displayName ?? "", createdAt: new Date().toISOString() });
    const has = await getDocs(query(collection(db, "schools", u.uid, "school"), limit(1))).then((r) => !r.empty).catch(() => false);
    if (!has) { await deleteDoc(ref).catch(() => {}); throw new Blocked(NO_SCHOOL); }
    snap = await getDoc(ref); p = snap.data() as { schoolId?: string; role?: string };
  }
  if (p.role !== "admin") throw new Blocked(NOT_ADMIN);
  if (!p.schoolId) throw new Blocked(NO_SCHOOL);
  if (await isSuspended(p.schoolId)) throw new Blocked(SUSPENDED);
  // a sign-up that stopped after users/{uid} but before any school data: finish the starter data now (own school only)
  if (p.schoolId === u.uid) {
    const hasSchool = await getDoc(doc(db, "schools", u.uid, "school", "school")).then((d) => d.exists(), () => true);
    if (!hasSchool) await bootstrapSchool(u.uid, u.displayName || (u.email ?? "").split("@")[0] || "My School", u.email ?? "").catch(() => {});
  }
  return { id: u.uid, email: u.email ?? "", organizationName: u.displayName ?? "", schoolId: p.schoolId, role: "admin" };
}
/** true while signup is writing users/{uid} + the starter data; the auth observer must not resolve a profile yet */
let signingUp = false;
const profiles = new Map<string, Promise<User>>();
const profileFor = (u: FbUser) => { let p = profiles.get(u.uid); if (!p) { p = loadProfile(u); profiles.set(u.uid, p); p.catch(() => profiles.delete(u.uid)); } return p; };

export { friendly } from "@edvio/shared/authErrors";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedMessage, setBlocked] = useState("");
  // read once on the client; the user is resolved later in an effect, so the first render never depends on it
  const [actingSchool, setActing] = useState(() => (typeof window === "undefined" ? "" : readActAs()));
  const isOwner = account?.role === "owner";
  // an owner inside a school is that school's admin for every screen (rules: isOwner() writes every school, contract 16)
  const user = useMemo(() => (account && isOwner && actingSchool ? { ...account, schoolId: actingSchool } : account), [account, isOwner, actingSchool]);
  useEffect(() => { if (isOwner) setCollectionScope(actingSchool || null); }, [isOwner, actingSchool]);
  const actAs = useCallback((sid: string | null) => { writeActAs(sid ?? ""); setActing(sid ?? ""); }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) { profiles.clear(); setCollectionScope(null); setUser(null); setIsLoading(false); writeActAs(""); setActing(readPendingSchool()); return; }
    if (signingUp) return;
    setIsLoading(true);
    profileFor(u).then((p) => {
      setBlocked("");
      if (p.role === "admin") { clearPendingSchool(); writeActAs(""); setActing(""); setCollectionScope(p.schoolId); }
      else {
        const school = readPendingSchool() || readActAs();
        clearPendingSchool(); writeActAs(school); setActing(school);
      }
      setUser(p);
    })
      .catch((e) => { setCollectionScope(null); setUser(null); setBlocked(e instanceof Blocked ? e.message : "Could not load your account. Check your connection and try again."); signOut(auth); })
      .finally(() => setIsLoading(false));
  }), []);

  // an owner can suspend the school while its admin is signed in: sign them out with the reason (contract 15)
  const watchSchool = account?.role === "admin" ? account.schoolId : "";
  useEffect(() => {
    if (!watchSchool) return;
    return onSnapshot(doc(db, "platform_schools", watchSchool), (d) => {
      if (d.exists() && d.data()?.status === "suspended") { profiles.clear(); setCollectionScope(null); setUser(null); setBlocked(SUSPENDED); signOut(auth); }
    }, () => { /* no read access (old rules): nothing to watch */ });
  }, [watchSchool]);

  const login = async (email: string, password: string) => {
    let cred;
    try { cred = await signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw friendly(e); }
    try { await profileFor(cred.user); } catch (e) { await signOut(auth); throw e instanceof Blocked ? e : friendly(e); }
  };

  const signup = async (email: string, password: string, organizationName: string) => {
    if (!organizationName.trim()) throw new Error("Organization name is required");
    signingUp = true;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: organizationName.trim() });
      await bootstrapSchool(cred.user.uid, organizationName.trim(), email.trim());
      const p = await profileFor(cred.user);
      setCollectionScope(p.schoolId); setUser(p);
    } catch (e) { throw friendly(e); } finally { signingUp = false; }
  };

  const resetPassword = async (email: string) => {
    try { await sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw friendly(e); }
  };

  const logout = async () => { clearPendingSchool(); writeActAs(""); setActing(""); await signOut(auth); };

  return <AuthContext.Provider value={{ user, isLoading, actAs, blockedMessage, login, signup, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
