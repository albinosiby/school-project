import { Suspense } from "react";
import { TransportView } from "@/features/transport/TransportView";
// Suspense: TransportView reads ?tab= / ?bus= (useSearchParams); the page itself stays static
export default function Page() { return <Suspense fallback={null}><TransportView /></Suspense>; }
