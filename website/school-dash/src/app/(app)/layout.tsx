import { Suspense } from "react";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { ToastProvider } from "@/components/ui";
import { OnboardingGate } from "@/features/onboarding/OnboardingGate";
import { AuthGuard } from "@/components/AuthGuard";
import { OwnerBanner } from "@/components/OwnerBanner";
import { CollectionGuard } from "@/components/CollectionGuard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ToastProvider>
        <OwnerBanner />
        <Suspense fallback={<div className="grid min-h-screen place-items-center text-outline" role="status">Loading…</div>}>
          <OnboardingGate>
            <div className="flex min-h-screen">
              <Sidebar />
              <div className="flex min-w-0 flex-1 flex-col">
                <Topbar />
                <main className="flex-1 p-4 sm:p-6"><CollectionGuard>{children}</CollectionGuard></main>
              </div>
            </div>
          </OnboardingGate>
        </Suspense>
      </ToastProvider>
    </AuthGuard>
  );
}
