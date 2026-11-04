"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useOnboarding } from "@/features/onboarding/state";

export default function Page() {
  const router = useRouter();
  const { ready, state, firstOpen } = useOnboarding();
  useEffect(() => { if (ready) router.replace(state?.complete ? "/dashboard" : `/onboarding/setup/${firstOpen}`); }, [ready, state, firstOpen, router]);
  return <div className="grid min-h-screen place-items-center text-outline">Loading…</div>;
}
