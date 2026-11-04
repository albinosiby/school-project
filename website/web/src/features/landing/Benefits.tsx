"use client";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Building2, Bus, GraduationCap, HeartHandshake } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/shadcn/tabs";
import { BENEFITS } from "./content";
import { Reveal, staggerChild, staggerParent } from "./motion";

const ICON = { Office: Building2, Teachers: GraduationCap, Parents: HeartHandshake, Transport: Bus } as const;

/** Section 3: outcomes per audience. Tabs on every width; the cards re-stagger when the tab changes. */
export function Benefits() {
  const reduce = useReducedMotion();
  const [tab, setTab] = useState(BENEFITS[0].audience);
  return (
    <section id="benefits" className="scroll-mt-16 bg-muted/40 py-20 sm:py-28">
      <div className="l-container">
        <Reveal className="max-w-2xl">
          <p className="l-eyebrow text-brand">Benefits</p>
          <h2 className="l-h2 mt-3 text-balance">What changes for each part of the school</h2>
          <p className="l-lead mt-4 text-muted-foreground">Every item below is a shipped feature, not a roadmap line. The office keeps control; teachers and parents keep their phones.</p>
        </Reveal>
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-10">
          <TabsList className="h-auto w-full max-w-full flex-wrap justify-start gap-1 rounded-2xl bg-background p-1.5 ring-1 ring-border group-data-horizontal/tabs:h-auto sm:w-fit">
            {BENEFITS.map((b) => { const I = ICON[b.audience]; return (
              <TabsTrigger key={b.audience} value={b.audience} className="h-10 flex-1 gap-2 rounded-xl px-4 text-sm data-[state=active]:bg-brand data-[state=active]:text-white sm:flex-none"><I className="size-4" />{b.audience}</TabsTrigger>
            ); })}
          </TabsList>
          {BENEFITS.map((b) => (
            <TabsContent key={b.audience} value={b.audience} className="mt-8">
              <AnimatePresence mode="wait" initial={false}>
                {tab === b.audience && (
                  <motion.div key={b.audience} variants={reduce ? undefined : staggerParent} initial={reduce ? false : "hidden"} animate="show" exit={reduce ? undefined : { opacity: 0, transition: { duration: 0.15 } }}>
                    <h3 className="l-h3 mb-6 text-muted-foreground"><span className="text-foreground">{b.headline}</span></h3>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {b.items.map((it, k) => (
                        <motion.div key={it.title} variants={reduce ? undefined : staggerChild} className="group rounded-2xl border bg-card p-5 transition-colors hover:border-brand/40">
                          <div className="font-heading text-sm font-semibold text-brand">{String(k + 1).padStart(2, "0")}</div>
                          <h4 className="mt-2 font-heading text-lg font-semibold leading-snug">{it.title}</h4>
                          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{it.body}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
