"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import {
  createUserWithEmailAndPassword, onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut, updateProfile, type User as FbUser,
} from "firebase/auth";
import { deleteDoc, doc, getDoc, getDocs, onSnapshot, setDoc, collection, limit, query } from "firebase/firestore";
import { auth, db } from "./firebase";
import { bootstrapSchool } from "./bootstrap";
import { setCollectionScope } from "./useCollection";

/**
 * users/{uid} (data contract section 1) maps a school admin to their school. A product owner (contract 15,
 * platform_admins/{uid}) has no school: schoolId is "" and the app sends them to the owner console.
 */
export interface User { id: string; email: string; organizationName: string; schoolId: string; role: "admin" | "owner" }

/** Where a signed-in user starts: the owner console for product owners, the school dashboard for admins. */
export const homeFor = (u: Pick<User, "role"> | null) => (u?.role === "owner" ? "/owner" : "/dashboard");

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
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

const AUTH_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/invalid-login-credentials": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/missing-email": "Enter your email address.",
  "auth/missing-password": "Enter your password.",
  "auth/user-not-found": "No account found for this email.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-disabled": "This account has been disabled. Contact your school administrator.",
  "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again in a few minutes.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/operation-not-allowed": "Email sign-in is not enabled for this project.",
  "unavailable": "Network error. Check your connection.",
  "permission-denied": "This account cannot open the admin console.",
};
/** Maps a Firebase Auth / Firestore error to the message shown on the login and sign-up pages (exported for tests). */
export function friendly(e: unknown): Error {
  const code = (e as { code?: string })?.code ?? "";
  const fromMsg = /\((auth\/[a-z-]+)\)/.exec(e instanceof Error ? e.message : "")?.[1] ?? "";
  const raw = e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Something went wrong";
  return new Error(AUTH_MESSAGES[code] ?? AUTH_MESSAGES[fromMsg] ?? raw);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedMessage, setBlocked] = useState("");

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) { profiles.clear(); setCollectionScope(null); setUser(null); setIsLoading(false); return; }
    if (signingUp) return;
    setIsLoading(true);
    profileFor(u).then((p) => { setBlocked(""); setCollectionScope(p.schoolId); setUser(p); })
      .catch((e) => { setCollectionScope(null); setUser(null); setBlocked(e instanceof Blocked ? e.message : "Could not load your account. Check your connection and try again."); signOut(auth); })
      .finally(() => setIsLoading(false));
  }), []);

  // an owner can suspend the school while its admin is signed in: sign them out with the reason (contract 15)
  const watchSchool = user?.role === "admin" ? user.schoolId : "";
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

  const logout = async () => { await signOut(auth); };

  return <AuthContext.Provider value={{ user, isLoading, blockedMessage, login, signup, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
