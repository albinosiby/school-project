import { Suspense } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { CollectionGuard } from "@/components/CollectionGuard";
import { PortalShell } from "@/components/portal/PortalShell";
import { LoadingSkeleton, ToastProvider } from "@/components/ui";

/** /me/**: the staff portal (docs/STAFF_PORTAL_CONTRACT.md), for teacher, staff, driver and attendant accounts. */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard role="staff">
      <ToastProvider>
        <Suspense fallback={<LoadingSkeleton variant="page" label="Loading…" className="mx-auto min-h-screen max-w-6xl p-4 sm:p-6" />}>
          <PortalShell><CollectionGuard>{children}</CollectionGuard></PortalShell>
        </Suspense>
      </ToastProvider>
    </AuthGuard>
  );
}
