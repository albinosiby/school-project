import { Suspense } from "react";
import { Applications } from "@/features/admissions/Applications";

export default function Page() {
  return <Suspense fallback={<p>Loading applications…</p>}><Applications /></Suspense>;
}
