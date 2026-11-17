import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { TransportView } from "@/features/transport/TransportView";
// Suspense: TransportView reads ?tab= / ?bus= (useSearchParams); the page itself stays static
export default function Page() { return <Suspense fallback={<LoadingSkeleton variant="page" />}><TransportView /></Suspense>; }
