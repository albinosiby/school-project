"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useCollection } from "@/lib/useCollection";

type S = { id: string; complete: boolean };

/** Blocks the console until the setup wizard is finished (fresh school → /onboarding). */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const { rows, ready } = useCollection<S>("onboarding");
  const incomplete = ready && !rows.find((r) => r.id === "state")?.complete;
  useEffect(() => { if (incomplete) router.replace("/onboarding/setup"); }, [incomplete, router, path]);
  if (!ready || incomplete) return <div className="grid min-h-screen place-items-center text-outline">Loading…</div>;
  return <>{children}</>;
}
