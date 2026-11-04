import { AdmissionsShell } from "@/features/admissions/AdmissionsShell";

export default function AdmissionsLayout({ children }: { children: React.ReactNode }) {
  return <AdmissionsShell>{children}</AdmissionsShell>;
}
