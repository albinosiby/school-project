"use client";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import { cn } from "cn";
import { WALKTHROUGH } from "./content";
import { AppScreen } from "./mockups";
import { Reveal } from "./motion";

/**
 * Sticky-scroll "how it works": on wide screens the device stays pinned while the four steps scroll past and swap the
 * screen; on phones each step shows its own screen inline.
 */
export function HowItWorks() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);
  const step = WALKTHROUGH[active];
  return (
    <section id="how" className="scroll-mt-16 py-20 sm:py-28">
      <div className="l-container">
        <Reveal className="max-w-2xl">
          <p className="l-eyebrow text-brand">How it works</p>
          <h2 className="l-h2 mt-3 text-balance">From the office to the bus stop, in four screens</h2>
          <p className="l-lead mt-4 text-muted-foreground">Scroll through a school day. Each step is a different app and a different person; the data is the same record.</p>
        </Reveal>
        <div className="mt-12 grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="hidden lg:block">
            <div className="sticky top-24 flex min-h-[560px] items-center justify-center rounded-3xl border bg-[linear-gradient(160deg,var(--brand-soft),var(--background)_70%)] p-8 dark:bg-[linear-gradient(160deg,var(--secondary),var(--background)_70%)]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={step.app} initial={reduce ? false : { opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, y: -30, scale: 0.97 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex flex-col items-center">
                  <span className="mb-5 rounded-full bg-background px-3 py-1 text-xs font-semibold ring-1 ring-border">{step.screen}</span>
                  <AppScreen app={step.app} />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
          <ol className="space-y-6 lg:space-y-0">
            {WALKTHROUGH.map((s, k) => (
              <motion.li key={s.n} onViewportEnter={() => setActive(k)} viewport={{ amount: 0.6, margin: "-15% 0px -35% 0px" }}
                className={cn("rounded-3xl border bg-card p-6 transition-colors sm:p-8 lg:flex lg:min-h-[60vh] lg:flex-col lg:justify-center lg:border-0 lg:bg-transparent lg:p-4", active === k ? "lg:opacity-100" : "lg:opacity-40")}>
                <div className="flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-brand font-heading text-sm font-semibold text-white">{s.n}</span>
                  <span className="l-eyebrow text-muted-foreground">{s.screen}</span>
                </div>
                <h3 className="l-h3 mt-4" style={{ fontSize: "clamp(1.25rem, 1.1rem + 0.8vw, 1.75rem)" }}>{s.title}</h3>
                <p className="l-body mt-3 text-muted-foreground">{s.body}</p>
                <div className="mt-6 flex min-w-0 justify-center rounded-2xl bg-muted/60 p-4 sm:p-5 lg:hidden"><AppScreen app={s.app} /></div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
