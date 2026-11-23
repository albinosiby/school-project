"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  onAuthStateChanged, sendPasswordResetEmail,
  signInWithEmailAndPassword, signInWithCustomToken, getIdTokenResult, signOut, type User as FbUser,
} from "firebase/auth";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { bootstrapSchool } from "./bootstrap";
import { setCollectionScope } from "./useCollection";
import { friendly } from "@edvio/shared/authErrors";
import { AdminMfaChallenge } from "@/features/auth/AdminMfaChallenge";
import { Button, Modal } from "@/components/ui";
import { selectedSchool } from "@edvio/shared/sites";

/**
 * users/{uid} (data contract section 1) maps a school admin to their school. A product owner (contract 16,
 * platform_admins/{uid}) has no school of their own: schoolId is "" in the owner console, and the id of the school they
 * opened while they work inside one (`actAs`), so the whole admin console runs on that school.
 * School staff (teacher, staff, driver, attendant: the mobile app accounts) sign in here too and get the staff portal
 * (docs/STAFF_PORTAL_CONTRACT.md); `staffId` / `crewId` identify their staff record.
 */
export type Role = "admin" | "owner" | "staff" | "teacher" | "driver" | "attendant";
export const STAFF_ROLES: readonly Role[] = ["staff", "teacher", "driver", "attendant"];
export interface User { id: string; email: string; organizationName: string; schoolId: string; role: Role; staffRole?: string; staffId?: string; crewId?: string; name?: string; mfaVersion?: string }
export const isStaffUser = (u: Pick<User, "role"> | null | undefined) => !!u && STAFF_ROLES.includes(u.role);

/** Where a signed-in user starts: the owner console for product owners (unless inside a school), the staff portal for school staff, the dashboard for admins. */
export const homeFor = (u: Pick<User, "role"> & { schoolId?: string } | null) => (isStaffUser(u) ? "/me" : u?.role === "owner" && !u.schoolId ? "/owner" : "/dashboard");

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
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  completeAdminMfa: (token: string, recoveryCodes?: string[]) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const NOT_ADMIN = "This account is not a school account. Parents must use the parent app.";
export const NO_SCHOOL = "No school is linked to this account. Contact your school administrator.";
export const SUSPENDED = "This school's account is suspended. Contact Edvio support to restore access.";

/** A missing rule (rules not deployed yet) reads as "no such doc" here, so an old ruleset never locks admins out. */
const unlessDenied = <T,>(p: Promise<T>, fallback: T) => p.catch((e) => { if ((e as { code?: string })?.code === "permission-denied") return fallback; throw e; });
/** platform_schools/{schoolId}.status (contract 15). */
const isSuspended = (schoolId: string) =>
  unlessDenied(getDoc(doc(db, "platform_schools", schoolId)).then((d) => d.exists() && d.data()?.status === "suspended"), false);

class Blocked extends Error {}
class MfaNeeded extends Error {}
async function validMfa(u: FbUser, version: string) {
  const { claims, signInProvider } = await getIdTokenResult(u);
  const at = Number(claims.adminMfaAt);
  return signInProvider === "custom" && claims.adminMfaVersion === version && at <= Date.now() / 1000 + 30 && Date.now() / 1000 - at < 12 * 3600;
}

/** Only accounts with a platform or school profile can enter the web console. */
async function loadProfile(u: FbUser): Promise<User> {
  const owner = await unlessDenied(getDoc(doc(db, "platform_admins", u.uid)).then((d) => d.exists()), false);
  if (owner) return { id: u.uid, email: u.email ?? "", organizationName: "Edvio", schoolId: "", role: "owner" };
  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) throw new Blocked(NO_SCHOOL);
  const p = snap.data() as { schoolId?: string; role?: string; staffRole?: string; staffId?: string; crewId?: string; name?: string; mfaVersion?: string };
  if (p.role !== "admin" && !STAFF_ROLES.includes(p.role as Role)) throw new Blocked(NOT_ADMIN);
  if (!p.schoolId) throw new Blocked(NO_SCHOOL);
  if (p.role === "admin" && p.mfaVersion && !(await validMfa(u, p.mfaVersion))) throw new MfaNeeded();
  if (await isSuspended(p.schoolId)) throw new Blocked(SUSPENDED);
  // a sign-up that stopped after users/{uid} but before any school data: finish the starter data now (own school only)
  if (p.role === "admin" && p.schoolId === u.uid) {
    const hasSchool = await getDoc(doc(db, "schools", u.uid, "school", "school")).then((d) => d.exists(), () => true);
    if (!hasSchool) await bootstrapSchool(u.uid, u.displayName || (u.email ?? "").split("@")[0] || "My School", u.email ?? "").catch(() => {});
  }
  return { id: u.uid, email: u.email ?? "", organizationName: u.displayName ?? "", schoolId: p.schoolId, role: p.role as Role, staffRole: p.staffRole, staffId: p.staffId, crewId: p.crewId, name: p.name, mfaVersion: p.mfaVersion };
}
const profiles = new Map<string, Promise<User>>();
const profileFor = (u: FbUser) => { let p = profiles.get(u.uid); if (!p) { p = loadProfile(u); profiles.set(u.uid, p); p.catch(() => profiles.delete(u.uid)); } return p; };

export { friendly } from "@edvio/shared/authErrors";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [account, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blockedMessage, setBlocked] = useState("");
  const [mfaPending, setMfaPending] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  // read once on the client; the user is resolved later in an effect, so the first render never depends on it
  const [actingSchool, setActing] = useState(() => (typeof window === "undefined" ? "" : readActAs()));
  const isOwner = account?.role === "owner";
  // an owner inside a school is that school's admin for every screen (rules: isOwner() writes every school, contract 16)
  const user = useMemo(() => (account && isOwner && actingSchool ? { ...account, schoolId: actingSchool } : account), [account, isOwner, actingSchool]);
  useEffect(() => { if (isOwner) setCollectionScope(actingSchool || null); }, [isOwner, actingSchool]);
  const actAs = useCallback((sid: string | null) => { writeActAs(sid ?? ""); setActing(sid ?? ""); }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => {
    if (!u) { setMfaPending(false); setRecoveryCodes([]); profiles.clear(); setCollectionScope(null); setUser(null); setIsLoading(false); writeActAs(""); setActing(readPendingSchool()); return; }
    setIsLoading(true);
    profileFor(u).then((p) => {
      setBlocked(""); setMfaPending(false);
      if (p.role !== "owner") { clearPendingSchool(); writeActAs(""); setActing(""); setCollectionScope(p.schoolId); }
      else {
        const school = readPendingSchool() || readActAs();
        clearPendingSchool(); writeActAs(school); setActing(school);
      }
      setUser(p);
    })
      .catch((e) => { setCollectionScope(null); setUser(null); if (e instanceof MfaNeeded) { setMfaPending(true); setBlocked(""); return; } setBlocked(e instanceof Blocked ? e.message : "Could not load your account. Check your connection and try again."); signOut(auth); })
      .finally(() => setIsLoading(false));
  }), []);

  // an owner can suspend the school while its admin is signed in: sign them out with the reason (contract 15)
  const watchSchool = account && account.role !== "owner" ? account.schoolId : "";
  useEffect(() => {
    if (!watchSchool) return;
    return onSnapshot(doc(db, "platform_schools", watchSchool), (d) => {
      if (d.exists() && d.data()?.status === "suspended") { profiles.clear(); setCollectionScope(null); setUser(null); setBlocked(SUSPENDED); signOut(auth); }
    }, () => { /* no read access (old rules): nothing to watch */ });
  }, [watchSchool]);

  const login = async (email: string, password: string) => {
    let cred;
    try { cred = await signInWithEmailAndPassword(auth, email.trim(), password); } catch (e) { throw friendly(e); }
    try { await profileFor(cred.user); } catch (e) { if (e instanceof MfaNeeded) { setCollectionScope(null); setUser(null); setMfaPending(true); return; } await signOut(auth); throw e instanceof Blocked ? e : friendly(e); }
  };

  const completeAdminMfa = async (token: string, codes: string[] = []) => {
    if (codes.length) setRecoveryCodes(codes);
    profiles.clear();
    const credential = await signInWithCustomToken(auth, token);
    profiles.clear(); const profile = await profileFor(credential.user);
    setBlocked(""); setMfaPending(false); setUser(profile); setCollectionScope(profile.schoolId); setIsLoading(false);
  };
  // End expired or remotely invalidated MFA sessions without showing false collection errors.
  useEffect(() => {
    if (!account || account.role !== "admin") return;
    const check = async () => {
      const current = auth.currentUser; if (!current || current.uid !== account.id) return;
      const snapshot = await getDoc(doc(db, "users", current.uid));
      const version = snapshot.data()?.mfaVersion;
      if (version && !(await validMfa(current, version))) { profiles.clear(); setCollectionScope(null); setUser(null); setMfaPending(true); }
    };
    const interval = window.setInterval(() => { void check().catch(() => {}); }, 60000);
    return () => window.clearInterval(interval);
  }, [account]);

  const resetPassword = async (email: string) => {
    try { await sendPasswordResetEmail(auth, email.trim()); } catch (e) { throw friendly(e); }
  };

  const logout = async () => { clearPendingSchool(); writeActAs(""); setActing(""); await signOut(auth); };

  return <AuthContext.Provider value={{ user, isLoading, actAs, blockedMessage, login, resetPassword, logout, completeAdminMfa }}>
    {mfaPending ? <AdminMfaChallenge onComplete={completeAdminMfa} onCancel={logout} /> : children}
    <Modal open={recoveryCodes.length > 0} onClose={() => setRecoveryCodes([])} title="Save your MFA recovery codes" subtitle="Each code works once after your email and password. Keep them somewhere private." footer={<Button onClick={() => setRecoveryCodes([])}>I have saved these codes</Button>}>
      <div className="grid grid-cols-2 gap-3 font-mono text-sm">{recoveryCodes.map((code) => <code key={code} className="break-all rounded bg-surface-container-low p-2">{code}</code>)}</div>
      <p className="mt-4 text-sm text-on-surface-variant">These codes are shown once. Use one if you lose your key or need to sign in on another website address.</p>
    </Modal>
  </AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
