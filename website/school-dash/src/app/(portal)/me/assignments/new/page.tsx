"use client";
import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AssignmentForm } from "@/features/portal/assignments/AssignmentForm";

// ?classId= is read on the client so the page stays static (see app/(app)/students/page.tsx)
function NewAssignment() {
  const classId = useSearchParams().get("classId") ?? undefined;
  return <AssignmentForm key={classId ?? ""} classId={classId} />;
}
export default function Page() { return <Suspense fallback={<LoadingSkeleton variant="form" label="Loading…" />}><NewAssignment /></Suspense>; }
