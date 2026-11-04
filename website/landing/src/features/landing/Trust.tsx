"use client";
import { Lock, Quote, ShieldCheck } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/shadcn/accordion";
import { FAQ, PROOF, SECURITY, TESTIMONIALS } from "./content";
import { Counter, Reveal, Stagger, StaggerItem } from "./motion";

/** Section 4: verified numbers, security model, placeholder testimonials, FAQ. */
export function Trust() {
  return (
    <section id="trust" className="scroll-mt-16 py-20 sm:py-28">
      <div className="l-container">
        <Reveal className="max-w-2xl">
          <p className="l-eyebrow text-brand">Trust</p>
          <h2 className="l-h2 mt-3 text-balance">Built for one school&apos;s data to stay that school&apos;s</h2>
          <p className="l-lead mt-4 text-muted-foreground">Each school kept apart, every role limited to its own data, and checked end to end before every release.</p>
        </Reveal>

        <Stagger className="mt-12 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {PROOF.map((p) => (
            <StaggerItem key={p.label} className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="font-heading text-4xl font-bold tracking-tight text-brand sm:text-5xl"><Counter value={p.value} suffix={p.suffix} /></div>
              <div className="mt-2 text-sm text-muted-foreground">{p.label}</div>
            </StaggerItem>
          ))}
        </Stagger>
        <Reveal className="mt-3 text-xs text-muted-foreground" as="p">Counts from the end-to-end verification report of 3–4 November 2026: access-control suite, cross-app sync suite with five signed-in roles, and unit tests of the admin web and the three apps.</Reveal>

        <div className="mt-16 grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <div className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand dark:bg-secondary"><ShieldCheck className="size-5" /></div>
            <h3 className="l-h2 mt-5" style={{ fontSize: "clamp(1.5rem, 1.2rem + 1.4vw, 2.125rem)" }}>Security that is enforced, not assumed</h3>
            <p className="l-body mt-4 text-muted-foreground">Access is enforced on the server, not in app code. A login is mapped to one school and one role, and every read and write is decided from that mapping.</p>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              {["Hosted in Mumbai, India, with each school's data kept apart", "Alerts and parent views are kept in sync automatically", "Sensitive changes are written to an audit log the office can read", "Signed certificates are stored per school with the same role-based access"].map((t) => <li key={t} className="flex gap-2"><Lock className="mt-0.5 size-4 shrink-0 text-mint" />{t}</li>)}
            </ul>
          </Reveal>
          <Stagger className="grid gap-4 sm:grid-cols-2">
            {SECURITY.map((s) => (
              <StaggerItem key={s.title} className="rounded-2xl border bg-card p-5">
                <h4 className="font-heading text-base font-semibold">{s.title}</h4>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </StaggerItem>
            ))}
          </Stagger>
        </div>

        {/* PLACEHOLDER testimonials (see content.ts): illustrative quotes, no real schools named. */}
        <Stagger className="mt-20 grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <StaggerItem key={t.quote} className="flex flex-col rounded-2xl bg-ink p-6 text-white dark:bg-card dark:ring-1 dark:ring-border">
              <Quote className="size-6 text-sunrise" />
              <p className="mt-4 flex-1 text-pretty text-base leading-relaxed">{t.quote}</p>
              <div className="mt-5 text-sm"><div className="font-semibold">{t.who}</div><div className="text-white/60 dark:text-muted-foreground">{t.org}</div></div>
            </StaggerItem>
          ))}
        </Stagger>

        <div id="faq" className="mx-auto mt-20 max-w-3xl scroll-mt-20">
          <Reveal><p className="l-eyebrow text-brand">FAQ</p><h3 className="l-h2 mt-3" style={{ fontSize: "clamp(1.5rem, 1.2rem + 1.4vw, 2.125rem)" }}>Questions schools ask first</h3></Reveal>
          <Reveal className="mt-6 rounded-2xl border bg-card px-5 sm:px-6" delay={0.1}>
            <Accordion type="single" collapsible>
              {FAQ.map((f, k) => (
                <AccordionItem key={f.q} value={`q${k}`}>
                  <AccordionTrigger className="py-4 text-left text-base font-medium hover:no-underline">{f.q}</AccordionTrigger>
                  <AccordionContent className="pb-4 text-base text-muted-foreground">{f.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
