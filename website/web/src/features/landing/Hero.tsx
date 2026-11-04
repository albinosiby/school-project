"use client";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { useRef } from "react";
import { ArrowRight, PlayCircle } from "lucide-react";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { COMPANY } from "./content";
import { AdminScreen, DriverScreen, ParentScreen, Phone, TeacherScreen, Window } from "./mockups";

/** Value proposition over a parallax stack of the admin window and the three phones. */
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const yWindow = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -60]);
  const yPhones = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : -140]);
  const yText = useTransform(scrollYProgress, [0, 1], [0, reduce ? 0 : 40]);
  const fade = useTransform(scrollYProgress, [0, 0.8], [1, reduce ? 1 : 0.2]);
  const enter = (d: number) => (reduce ? {} : { initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay: d, ease: [0.22, 1, 0.36, 1] as const } });

  return (
    <section id="top" ref={ref} className="relative overflow-hidden pt-10 pb-8 sm:pt-16 lg:pt-20">
      <div className="l-grid-bg pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,color-mix(in_oklab,var(--brand)_22%,transparent),transparent)]" aria-hidden />
      <motion.div style={{ y: yText, opacity: fade }} className="l-container text-center">
        <motion.div {...enter(0)}><Badge variant="secondary" className="rounded-full px-3 py-1 text-xs">Powered by {COMPANY}</Badge></motion.div>
        <motion.h1 {...enter(0.08)} className="l-display mx-auto mt-5 max-w-4xl text-balance">
          One school day, <span className="text-brand">four apps</span>, a single source of truth.
        </motion.h1>
        <motion.p {...enter(0.16)} className="l-lead mx-auto mt-5 max-w-2xl text-pretty text-muted-foreground">
          Edvio runs the office, the classroom, the parents and the school bus on one shared record. A teacher marks attendance once; the office, the parent and the audit log all have it.
        </motion.p>
        <motion.div {...enter(0.24)} className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" className="h-12 w-full px-6 text-base sm:w-auto" asChild><a href="#demo">Book a demo <ArrowRight data-icon="inline-end" /></a></Button>
          <Button size="lg" variant="outline" className="h-12 w-full px-6 text-base sm:w-auto" asChild><a href="#how"><PlayCircle data-icon="inline-start" /> See how it works</a></Button>
        </motion.div>
        <motion.p {...enter(0.3)} className="mt-4 text-sm text-muted-foreground">Admin web · Teacher app · Parent app · Driver &amp; bus-staff app</motion.p>
      </motion.div>

      <div className="l-container relative mt-12 sm:mt-16">
        <motion.div style={{ y: yWindow }} {...enter(0.35)} className="mx-auto max-w-4xl">
          <Window className="hidden sm:block"><AdminScreen /></Window>
          <Window className="sm:hidden" title="Edvio · Admin"><div className="overflow-hidden"><div className="w-[560px] origin-top-left scale-[0.62] sm:scale-100"><AdminScreen /></div></div></Window>
        </motion.div>
        <motion.div style={{ y: yPhones }} {...enter(0.5)} className="relative z-10 -mt-24 flex justify-center gap-3 sm:-mt-40 sm:gap-6 lg:-mt-48">
          <div className="translate-y-6 rotate-[-4deg] sm:translate-y-10"><Phone label="Teacher app"><TeacherScreen /></Phone></div>
          <div className="hidden sm:block"><Phone label="Parent app"><ParentScreen /></Phone></div>
          <div className="translate-y-6 rotate-[4deg] sm:translate-y-10"><Phone label="Driver app"><DriverScreen /></Phone></div>
        </motion.div>
      </div>
    </section>
  );
}
