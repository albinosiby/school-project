import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/ui";
import { CertificateVerificationRoute } from "@/features/certificates/CertificateVerificationRoute";
export const metadata = { title: "Verify certificate | Edvio", robots: { index: false, follow: false }, referrer: "no-referrer" as const };
export default function Page() { return <main className="min-h-screen bg-surface-container-low px-4 py-10 sm:py-16"><Suspense fallback={<LoadingSkeleton variant="form" label="Loading verification…" />}><CertificateVerificationRoute /></Suspense></main>; }
