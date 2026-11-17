import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { FeesPage } from "@/features/fees/FeesPage";
export default function Page() { return <Suspense fallback={<LoadingSkeleton variant="page" />}><FeesPage /></Suspense>; }
