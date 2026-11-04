import { siteUrls } from "@edvio/shared/sites";
import { ArrowRight } from "lucide-react";
import { Logo } from "@/components/Logo";
import { CopyrightYear } from "@/components/CopyrightYear";
import { Button } from "@/components/shadcn/button";
import { COMPANY, CONTACT_EMAIL, PRODUCT } from "./content";

/** Final CTA band and the footer (server component). */
export function Footer() {
  return (
    <>
      <section className="py-16 sm:py-24">
        <div className="l-container">
          <div className="relative overflow-hidden rounded-3xl bg-ink px-6 py-12 text-center text-white sm:px-12 sm:py-16 dark:bg-brand dark:text-[#04102A]">
            <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-brand/40 blur-3xl dark:bg-white/20" aria-hidden />
            <div className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full bg-sunrise/30 blur-3xl" aria-hidden />
            <h2 className="l-h2 relative mx-auto max-w-2xl text-balance">Give your school one source of truth</h2>
            <p className="relative mx-auto mt-4 max-w-xl text-pretty text-base opacity-80 sm:text-lg">The office, every teacher, every parent and every bus on the same record. Set up in days, not terms.</p>
            <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" className="h-12 bg-white px-6 text-base text-ink hover:bg-white/90 dark:bg-[#04102A] dark:text-white dark:hover:bg-[#04102A]/90" asChild><a href="#demo">Book a demo <ArrowRight data-icon="inline-end" /></a></Button>
              <Button size="lg" variant="ghost" className="h-12 px-6 text-base text-white hover:bg-white/10 hover:text-white dark:text-[#04102A] dark:hover:bg-black/10 dark:hover:text-[#04102A]" asChild><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></Button>
            </div>
          </div>
        </div>
      </section>
      <footer className="border-t py-10">
        <div className="l-container flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 font-heading text-base font-semibold"><Logo size={28} /> {PRODUCT}</div>
            <p className="mt-2 text-sm text-muted-foreground">Powered by <span className="font-medium text-foreground">{COMPANY}</span> · © <CopyrightYear /> {COMPANY}</p>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Footer">
            <a href="#product" className="hover:text-foreground">Product</a>
            <a href="#benefits" className="hover:text-foreground">Benefits</a>
            <a href="#trust" className="hover:text-foreground">Trust</a>
            <a href="#faq" className="hover:text-foreground">FAQ</a>
            <a href={`${siteUrls().admin}/login`} className="hover:text-foreground">Admin sign in</a>
            <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-foreground">Contact</a>
          </nav>
        </div>
      </footer>
    </>
  );
}
