"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User as FirebaseUser } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { friendly } from "@edvio/shared/authErrors";
import { auth, db } from "./firebase";

export interface User { id: string; email: string; organizationName: string; schoolId: string; role: "owner" }
export const homeFor = () => "/owner";
export const NOT_OWNER = "This account is not a platform owner. Use the school admin app to sign in.";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  blockedMessage: string;
  login: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** No self sign-up or school profile bootstrap: owner membership is provisioned by trusted admin tooling. */
export async function ownerProfile(account: FirebaseUser): Promise<User> {
  const owner = await getDoc(doc(db, "platform_admins", account.uid));
  if (!owner.exists()) throw new Error(NOT_OWNER);
  return { id: account.uid, email: account.email ?? "", organizationName: "Edvio", schoolId: "", role: "owner" };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [blockedMessage, setBlocked] = useState("");

  useEffect(() => {
    let live = true;
    let generation = 0;
    const stop = onAuthStateChanged(auth, (account) => {
      const current = ++generation;
      setUser(null);
      if (!account) { setLoading(false); return; }
      setLoading(true);
      ownerProfile(account).then((profile) => {
        if (live && current === generation) { setUser(profile); setBlocked(""); }
      }).catch(async (error) => {
        if (!live || current !== generation) return;
        setBlocked(error instanceof Error && error.message === NOT_OWNER ? NOT_OWNER : "Could not verify your account. Check your connection and try again.");
        await signOut(auth);
      }).finally(() => { if (live && current === generation) setLoading(false); });
    });
    return () => { live = false; generation++; stop(); };
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      try { await ownerProfile(credential.user); }
      catch (error) { await signOut(auth); throw error; }
    } catch (error) { throw friendly(error); }
  };
  const resetPassword = async (email: string) => {
    try { await sendPasswordResetEmail(auth, email.trim()); } catch (error) { throw friendly(error); }
  };
  const logout = async () => { await signOut(auth); };

  return <AuthContext.Provider value={{ user, isLoading, blockedMessage, login, resetPassword, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
