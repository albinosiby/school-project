"use client";
import { LoadingSkeleton } from "@/components/ui";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useOnboarding } from "@/features/onboarding/state";

export default function Page() {
  const router = useRouter();
  const { ready, state, firstOpen } = useOnboarding();
  useEffect(() => { if (ready) router.replace(state?.complete ? "/dashboard" : `/onboarding/setup/${firstOpen}`); }, [ready, state, firstOpen, router]);
  return <LoadingSkeleton variant="page" label="Loading…" className="mx-auto min-h-screen max-w-6xl p-4 sm:p-6" />;
}
