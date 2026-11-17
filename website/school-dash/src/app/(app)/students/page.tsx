"use client";
import { LoadingSkeleton } from "@/components/ui";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { studentProfileHref } from "@/features/people/studentLogic";
import { StudentsView } from "@/features/people/StudentsView";

// Reads ?q= on the client so the page stays static (awaiting searchParams on the server broke hydration, React #412)
function Students() {
  const params = useSearchParams();
  const router = useRouter();
  const legacyStudent = params.get("student");
  const legacyCertificates = params.get("tab") === "certificates";
  useEffect(() => {
    if (legacyStudent) router.replace(studentProfileHref(legacyStudent));
    else if (legacyCertificates) router.replace("/certificates");
  }, [legacyStudent, legacyCertificates, router]);
  if (legacyStudent) return <p role="status">Opening student details…</p>;
  if (legacyCertificates) return <p role="status">Opening certificates…</p>;
  const q = params.get("q") ?? "";
  return <StudentsView key={q} initialQ={q} />;
}
export default function Page() { return <Suspense fallback={<LoadingSkeleton variant="page" />}><Students /></Suspense>; }
