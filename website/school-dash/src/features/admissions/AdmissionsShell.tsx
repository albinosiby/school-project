"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useMemo, useState } from "react";
import { Download, Plus, QrCode } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useAdm, downloadCsv } from "./lib";
import { EnquirySlideOver } from "./EnquirySlideOver";
import { gradeLabel } from "./types";

const SlideCtx = createContext<() => void>(() => {});
export const useEnquirySlide = () => useContext(SlideCtx);

export function AdmissionsShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const { enq, apps, slots, seatRows, offers } = useAdm();

  const counts = useMemo(() => {
    const openEnq = enq.rows.filter((e) => ["new", "contacted", "campus"].includes(e.stage)).length;
    const tests = apps.rows.filter((a) => ["test_scheduled", "tested", "shortlisted"].includes(a.status)).length;
    const cap = seatRows.reduce((s, r) => s + r.capacity, 0), held = seatRows.reduce((s, r) => s + r.held, 0);
    const offersN = offers.rows.filter((o) => o.status === "pending").length;
    return { openEnq, tests, seats: `${held}/${cap}`, apps: apps.rows.length, offersN, slots: slots.rows.length };
  }, [enq.rows, apps.rows, seatRows, offers.rows, slots.rows]);

  const tabs = [
    { href: "/admissions", label: "Enquiries & Pipeline", n: counts.openEnq },
    { href: "/admissions/applications", label: "Applications", n: counts.apps },
    { href: "/admissions/form-builder", label: "Form Builder" },
    { href: "/admissions/tests", label: "Tests & Interviews", n: counts.tests },
    { href: "/admissions/seats", label: "Seats & Waitlist", n: counts.seats },
    { href: "/admissions/offers", label: "Offer & Enrolment", n: counts.offersN },
    { href: "/admissions/re-enrolment", label: "Re-enrolment" },
    { href: "/admissions/reports", label: "Reports & Analytics" },
  ];
  const standalone = path === "/admissions/public-form";

  const exportPipeline = () =>
    downloadCsv("admissions-pipeline.csv", [
      ["Enquiry ID", "Student", "Grade", "Guardian", "Phone", "Email", "Source", "Stage", "Assigned", "Created"],
      ...enq.rows.map((e) => [e.ref, e.name, gradeLabel(e.grade), e.guardian, e.phone, e.email, e.source, e.stage, e.assignee, e.createdAt]),
    ]);

  return (
    <SlideCtx.Provider value={() => setOpen(true)}>
      {!standalone && (
        <>
          <PageHeader
            title="Admissions Management Hub"
            subtitle="Track prospective candidates across the admissions lifecycle from enquiry intake to seat allotment and fee confirmation."
            actions={
              <>
                <Link href="/admissions/public-form" className="inline-flex h-10 items-center gap-2 rounded bg-surface-container px-4 text-sm font-semibold hover:bg-surface-container-high"><QrCode size={16} />Public Form &amp; QR</Link>
                <Button variant="outline" onClick={exportPipeline}><Download size={16} />Export Pipeline (.csv)</Button>
                <Button onClick={() => setOpen(true)}><Plus size={16} />Log New Enquiry</Button>
              </>
            }
          />
          <nav aria-label="Admissions sections" className="mb-5 overflow-x-auto rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-2 shadow-card">
            <ul className="flex min-w-max gap-1">
              {tabs.map((t) => {
                const on = t.href === "/admissions" ? path === t.href : path.startsWith(t.href);
                return (
                  <li key={t.href}>
                    <Link href={t.href} aria-current={on ? "page" : undefined}
                      className={cn("flex items-center gap-2 border-b-2 px-3 py-3.5 text-sm font-medium transition-colors", on ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-on-surface")}>
                      {t.label}
                      {t.n !== undefined && <span className={cn("rounded-full px-2 py-0.5 t-caption", on ? "bg-info-container" : "bg-surface-container")}>{t.n}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}
      {children}
      <EnquirySlideOver open={open} onClose={() => setOpen(false)} />
    </SlideCtx.Provider>
  );
}
