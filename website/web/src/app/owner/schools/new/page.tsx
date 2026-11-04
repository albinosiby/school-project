"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { NewSchoolForm } from "@/features/owner/NewSchoolForm";

// ?lead= prefills the form from a demo request (read on the client, see students/page.tsx)
function NewSchool() {
  const lead = useSearchParams().get("lead") ?? "";
  return <NewSchoolForm key={lead} leadId={lead} />;
}
export default function Page() { return <Suspense fallback={null}><NewSchool /></Suspense>; }
