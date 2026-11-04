import { Suspense } from "react";
import { FeesPage } from "@/features/fees/FeesPage";
export default function Page() { return <Suspense fallback={null}><FeesPage /></Suspense>; }
