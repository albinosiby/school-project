import { ToastProvider } from "@/components/ui";
import { AuthGuard } from "@/components/AuthGuard";
import { OwnerBanner } from "@/components/OwnerBanner";
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthGuard><ToastProvider><OwnerBanner />{children}</ToastProvider></AuthGuard>; }
