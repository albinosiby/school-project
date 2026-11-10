"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";

import { AdmissionForm } from "./AdmissionForm";

const tabs = [
  { href: "/admissions", label: "Enquiry / Admission Request" },
  { href: "/admissions/admission", label: "Admission" },
];

export function AdmissionsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const active = path === "/admissions/applications" ? "/admissions" : path;
  const [admitting, setAdmitting] = useState(false);
  return (
    <>
      <PageHeader title="Admissions Hub" subtitle="Manage admission requests and admitted students."
        actions={<Button onClick={() => setAdmitting(true)}><Plus size={16} />New Admission</Button>} />
      {admitting && <AdmissionForm mode="direct" onClose={() => setAdmitting(false)} />}
      <nav aria-label="Admissions sections" className="mb-5 flex flex-wrap gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2">
        {tabs.map(({ href, label }) => (
          <Link key={href} href={href} aria-current={active === href ? "page" : undefined}
            className={cn("rounded-md border-b-2 px-4 py-3 text-sm font-medium",
              active === href ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
