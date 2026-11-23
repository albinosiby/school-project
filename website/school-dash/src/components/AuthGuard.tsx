"use client";
import { LoadingSkeleton } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { homeFor, isStaffUser, useAuth, type Role } from "@/lib/authContext";

export type PageKind = "admin" | "owner" | "staff";
/** May this user open a page of this kind? A product owner opens the school console only while inside a school (contract 16);
 * school staff (teacher, staff, driver, attendant) open only the staff portal. */
export const allowed = (u: { role: Role; schoolId: string }, role: PageKind) =>
  role === "owner" ? u.role === "owner" : role === "staff" ? isStaffUser(u) : u.role === "admin" || (u.role === "owner" && !!u.schoolId);

/** Lets in the signed-in users of one kind: school admins (default), product owners (`role="owner"`) or school staff (`role="staff"`). */
export function AuthGuard({ children, role = "admin" }: { children: React.ReactNode; role?: PageKind }) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const wrongRole = !!user && !allowed(user, role);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/login");
    else if (!allowed(user, role)) router.replace(homeFor(user));
  }, [user, isLoading, router, role]);

  if (isLoading) {
    return <div className="min-h-screen bg-surface p-4 sm:p-6"><LoadingSkeleton variant="page" label="Loading..." className="mx-auto max-w-6xl" /></div>;
  }

  if (!user || wrongRole) {
    return null;
  }

  return <>{children}</>;
}
