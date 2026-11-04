import type { Metadata } from "next";
import { AuthGuard } from "@/components/AuthGuard";
import { ToastProvider } from "@/components/ui";
import { OwnerShell } from "@/features/owner/OwnerShell";

export const metadata: Metadata = { title: "Edvio Platform · Owner console", robots: { index: false, follow: false } };

/** Owner console (DATA_CONTRACT section 16): product owners only. */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard><ToastProvider><OwnerShell>{children}</OwnerShell></ToastProvider></AuthGuard>;
}
