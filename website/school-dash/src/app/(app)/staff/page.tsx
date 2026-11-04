import { Suspense } from "react";
import { StaffView } from "@/features/people/StaffView";
// Suspense: StaffView reads ?tab= (useSearchParams); the page itself stays static
export default function Page() { return <Suspense fallback={null}><StaffView /></Suspense>; }
