"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReportsView } from "@/features/communication/ReportsView";

// Reads ?run= on the client so the page stays static (see students/page.tsx)
function Reports() {
  const run = useSearchParams().get("run") ?? undefined;
  return <ReportsView key={run ?? ""} runId={run} />;
}
export default function Page() { return <Suspense fallback={null}><Reports /></Suspense>; }
