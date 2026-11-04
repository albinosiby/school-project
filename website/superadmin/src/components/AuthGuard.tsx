"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  useEffect(() => { if (!isLoading && !user) router.replace("/login"); }, [isLoading, user, router]);
  if (isLoading) return <div className="grid min-h-screen place-items-center bg-surface" role="status">Loading...</div>;
  return user?.role === "owner" ? children : null;
}
