"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@edvio/shared/LoginScreen";
import { homeFor, useAuth } from "@/lib/authContext";

export function LoginView() {
  const router = useRouter();
  const { user, login, resetPassword, blockedMessage } = useAuth();
  useEffect(() => { if (user) router.replace(homeFor(user)); }, [user, router]);
  return <LoginScreen audience="school" onSignIn={login} onResetPassword={resetPassword}
    blockedMessage={blockedMessage} onCreateAccount={() => router.push("/signup")} />;
}
