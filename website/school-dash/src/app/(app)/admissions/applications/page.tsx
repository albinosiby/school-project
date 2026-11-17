import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { Applications } from "@/features/admissions/Applications";

export default function Page() {
  return <Suspense fallback={<LoadingSkeleton variant="page" label="Loading applications…" />}><Applications /></Suspense>;
}
