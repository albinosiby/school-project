import { ToastProvider } from "@/components/ui";
import { AuthGuard } from "@/components/AuthGuard";
export default function Layout({ children }: { children: React.ReactNode }) { return <AuthGuard><ToastProvider>{children}</ToastProvider></AuthGuard>; }
