import { LoadingSkeleton } from "@/components/ui";
import { Suspense } from "react";
import { SettingsPage } from "@/features/settings/SettingsPage";
export default function Page() { return <Suspense fallback={<LoadingSkeleton variant="page" />}><SettingsPage /></Suspense>; }
