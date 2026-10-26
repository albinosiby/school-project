"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StudentsView } from "@/features/people/StudentsView";

// Reads ?q= on the client so the page stays static (awaiting searchParams on the server broke hydration, React #412)
function Students() {
  const q = useSearchParams().get("q") ?? "";
  return <StudentsView key={q} initialQ={q} />;
}
export default function Page() { return <Suspense fallback={null}><Students /></Suspense>; }
