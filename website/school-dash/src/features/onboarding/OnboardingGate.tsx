"use client";
import { LoadingSkeleton } from "@/components/ui";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCollection } from "@/lib/useCollection";

type S = { id: string; complete: boolean };

/** Blocks the console until the setup wizard is finished (fresh school → /onboarding). */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { rows, ready } = useCollection<S>("onboarding");
  // My Profile stays reachable during setup: a new admin changes the first password the owner gave them (contract 16)
  const incomplete = ready && !rows.find((r) => r.id === "state")?.complete && path !== "/profile";
  useEffect(() => { if (incomplete) router.replace("/onboarding/setup"); }, [incomplete, router, path]);
  if (!ready || incomplete) return <LoadingSkeleton variant="page" label="Loading…" className="mx-auto min-h-screen max-w-6xl p-4 sm:p-6" />;
  return <>{children}</>;
}
