"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoginScreen } from "@edvio/shared/LoginScreen";
import { useAuth } from "@/lib/authContext";

export function LoginView() {
  const router = useRouter();
  const { user, login, resetPassword, blockedMessage } = useAuth();
  useEffect(() => { if (user) router.replace("/owner"); }, [user, router]);
  return <LoginScreen audience="owner" onSignIn={login} onResetPassword={resetPassword} blockedMessage={blockedMessage} />;
}
