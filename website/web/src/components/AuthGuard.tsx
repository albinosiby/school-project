"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor, useAuth } from "@/lib/authContext";

/** Lets in the signed-in users of one kind: school admins (default) or product owners (`role="owner"`). */
export function AuthGuard({ children, role = "admin" }: { children: React.ReactNode; role?: "admin" | "owner" }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const wrongRole = !!user && user.role !== role;

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
    else if (user.role !== role) router.replace(homeFor(user));
  }, [user, isLoading, router, role]);

  if (isLoading) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface">
        <div className="text-center">
          <div className="size-12 animate-spin rounded-full border-4 border-outline-variant border-t-secondary mx-auto mb-4"></div>
          <p className="text-on-surface-variant">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || wrongRole) {
    return null;
  }

  return <>{children}</>;
}
