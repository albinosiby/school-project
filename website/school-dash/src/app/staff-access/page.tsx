"use client";
// The old staff landing page: school staff now use the staff portal (/me), where Add staff lives for the designations that may add staff.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/ui";
import { homeFor, useAuth } from "@/lib/authContext";

export default function StaffAccessPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  useEffect(() => { if (!isLoading) router.replace(user ? (user.role === "staff" ? "/me/add-staff" : homeFor(user)) : "/login"); }, [isLoading, user, router]);
  return <LoadingSkeleton variant="page" className="mx-auto min-h-screen max-w-6xl p-6" />;
}
