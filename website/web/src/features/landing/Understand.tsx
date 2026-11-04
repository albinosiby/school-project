"use client";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { BusFront, Monitor, Smartphone, Users } from "lucide-react";
import { cn } from "cn";
import { Badge } from "@/components/shadcn/badge";
import { Card, CardContent } from "@/components/shadcn/card";
import { APPS, WALKTHROUGH, type AppKey } from "./content";
import { AppScreen } from "./mockups";
import { Reveal, Stagger, StaggerItem } from "./motion";

const ICON: Record<AppKey, typeof Monitor> = { admin: Monitor, teacher: Smartphone, parent: Users, driver: BusFront };
const TINT: Record<AppKey, string> = { admin: "bg-brand-soft text-brand", teacher: "bg-mint-soft text-mint", parent: "bg-sunrise-soft text-[#7A3E00] dark:text-sunrise", driver: "bg-secondary text-secondary-foreground" };

/** Section 2: the four apps and who uses each, plus a short auto-playing walkthrough of one attendance record. */
export function Understand() {
  return (
    <section id="product" className="scroll-mt-16 py-20 sm:py-28">
      <div className="l-container">
        <Reveal className="max-w-2xl">
          <p className="l-eyebrow text-brand">Understand</p>
          <h2 className="l-h2 mt-3 text-balance">Four apps, one record of the school day</h2>
          <p className="l-lead mt-4 text-muted-foreground">Each role gets its own app with only what that role needs. Underneath they read and write the same Firestore, so nothing is typed twice and nothing is out of date.</p>
        </Reveal>
        <Stagger className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {APPS.map((a) => { const I = ICON[a.key]; return (
            <StaggerItem key={a.key} className="h-full">
              <Card className="h-full ring-0 border transition-shadow hover:shadow-[0_16px_40px_-24px_rgb(0_23_54/0.4)]">
                <CardContent className="flex h-full flex-col">
                  <div className={cn("flex size-11 items-center justify-center rounded-xl", TINT[a.key])}><I className="size-5" /></div>
                  <div className="mt-4 flex items-center gap-2"><h3 className="l-h3">{a.name}</h3></div>
                  <Badge variant="outline" className="mt-2 w-fit rounded-full text-[11px] font-normal text-muted-foreground">{a.platform}</Badge>
                  <p className="mt-3 text-sm font-medium">{a.who}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{a.tagline}</p>
                  <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                    {a.does.map((d) => <li key={d} className="flex gap-2"><span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-brand" />{d}</li>)}
                  </ul>
                </CardContent>
              </Card>
            </StaggerItem>
          ); })}
        </Stagger>
        <Walkthrough />
      </div>
    </section>
  );
}

/** One attendance record travelling through the four apps; advances every few seconds while on screen. */
function Walkthrough() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduce = useReducedMotion();
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (!inView || paused || reduce) return;
    const t = setInterval(() => setI((n) => (n + 1) % WALKTHROUGH.length), 3200);
    return () => clearInterval(t);
  }, [inView, paused, reduce]);
  const step = WALKTHROUGH[i];
  return (
    <Reveal className="mt-16">
      <div ref={ref} className="overflow-hidden rounded-3xl border bg-card" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="grid lg:grid-cols-[1fr_1.1fr]">
          <div className="p-6 sm:p-10">
            <p className="l-eyebrow text-muted-foreground">A short walkthrough</p>
            <h3 className="l-h2 mt-2 text-balance" style={{ fontSize: "clamp(1.5rem, 1.2rem + 1.4vw, 2.125rem)" }}>What happens when a teacher marks one absence</h3>
            <ol className="mt-6 space-y-2" aria-label="Walkthrough steps">
              {WALKTHROUGH.map((s, k) => (
                <li key={s.n}>
                  <button type="button" onClick={() => { setI(k); setPaused(true); }} aria-current={k === i ? "step" : undefined}
                    className={cn("flex w-full items-start gap-3 rounded-xl p-3 text-left transition-colors", k === i ? "bg-muted" : "hover:bg-muted/50")}>
                    <span className={cn("mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", k === i ? "bg-brand text-white" : "bg-muted text-muted-foreground")}>{s.n}</span>
                    <span><span className="block font-medium">{s.title}</span><span className={cn("mt-1 block text-sm text-muted-foreground", k !== i && "hidden sm:block")}>{s.body}</span></span>
                  </button>
                </li>
              ))}
            </ol>
            {!reduce && <div className="mt-4 flex gap-1" aria-hidden>{WALKTHROUGH.map((s, k) => <span key={s.n} className={cn("h-1 flex-1 rounded-full", k === i ? "bg-brand" : "bg-muted")} />)}</div>}
          </div>
          <div className="relative flex min-h-[420px] items-center justify-center overflow-hidden bg-[linear-gradient(135deg,var(--brand-soft),var(--background))] p-6 dark:bg-[linear-gradient(135deg,var(--secondary),var(--background))]">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={step.app} initial={reduce ? false : { opacity: 0, x: 40, scale: 0.96 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={reduce ? undefined : { opacity: 0, x: -40, scale: 0.96 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="flex w-full flex-col items-center">
                <Badge className="mb-4 rounded-full bg-background text-foreground shadow-sm ring-1 ring-border" variant="secondary">{step.screen}</Badge>
                <AppScreen app={step.app} />
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
