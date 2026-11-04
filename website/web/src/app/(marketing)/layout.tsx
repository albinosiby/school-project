import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edvio · School management for the office, teachers, parents and the bus",
  description: "Admin web, teacher app, parent app and driver app on one Firebase backend. Attendance, homework, fees with receipts, leave, meetings, certificates, notices and bus boarding alerts. Powered by Tatos Technologies.",
};

/**
 * Public marketing pages. Rendered inside the root layout (fonts, AuthProvider) but outside the (app) group, so there is
 * no admin shell, no AuthGuard and no onboarding gate. `.landing` scopes the landing palette and the shadcn tokens.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <div className="landing min-h-screen">{children}</div>;
}
