"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton, Button, Card, ToastProvider } from "@/components/ui";
import { AddStaffFields } from "@/features/people/AddStaffFields";
import { homeFor, useAuth } from "@/lib/authContext";
import { assignableStaffRoles } from "@/lib/staffRoles";

export default function StaffAccessPage() {
  const router = useRouter();
  const { user, isLoading, logout } = useAuth();
  useEffect(() => {
    if (!isLoading && user?.role !== "staff") router.replace(user ? homeFor(user) : "/login");
  }, [isLoading, user, router]);

  if (isLoading || user?.role !== "staff") return <LoadingSkeleton variant="page" className="mx-auto min-h-screen max-w-6xl p-6" />;
  const canAdd = assignableStaffRoles(user).length > 0;

  return (
    <ToastProvider>
      <main className="mx-auto max-w-xl space-y-6 p-6 sm:py-12">
        <div className="flex items-center justify-between gap-4">
          <h1 className="t-headline-lg">{canAdd ? "Add Staff" : "School staff account"}</h1>
          <Button variant="outline" onClick={() => void logout()}>Sign out</Button>
        </div>
        <Card className="p-6">
          {canAdd ? <AddStaffFields /> : <p className="text-on-surface-variant">Signed in as {user.email}. Contact your school administrator for help with access.</p>}
        </Card>
      </main>
    </ToastProvider>
  );
}
