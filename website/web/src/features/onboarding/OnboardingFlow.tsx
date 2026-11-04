"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BellRing, GraduationCap, LayoutDashboard, ShieldCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";

const SLIDES = [
  {
    icon: LayoutDashboard,
    title: "Run your school from one place",
    body: "Admissions, attendance, fees and exams in a single console. See what needs your attention the moment you sign in.",
    points: [{ icon: BellRing, text: "Live alerts" }, { icon: Wallet, text: "Fee tracking" }],
  },
  {
    icon: ShieldCheck,
    title: "Approvals without the paperwork",
    body: "Leave requests, fee concessions and mark unlocks reach you as one inbox. Approve, reject or batch-clear in seconds.",
    points: [{ icon: ShieldCheck, text: "Audit trail" }, { icon: BellRing, text: "Instant notices" }],
  },
  {
    icon: GraduationCap,
    title: "Start your academic year",
    body: "Finish the setup wizard, import student data and invite parents. Your school will be ready before the first bell.",
    points: [{ icon: GraduationCap, text: "8-step setup" }, { icon: LayoutDashboard, text: "CBSE ready" }],
  },
] as const;

export function OnboardingFlow() {
  const router = useRouter();
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;
  const s = SLIDES[i];
  const Icon = s.icon;

  const finish = (to: string) => {
    try { localStorage.setItem("onboarding_seen", "1"); } catch {}
    router.push(to);
  };

  return (
    <div className="grid min-h-screen place-items-center bg-surface-container p-4">
      <div className="relative flex h-[min(820px,100vh-2rem)] w-full max-w-[400px] flex-col overflow-hidden rounded-xl bg-primary-container text-on-primary shadow-pop">
        <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--color-secondary-container)_0%,transparent_55%)] opacity-40" />
        <header className="relative flex items-center justify-between px-6 pt-8">
          <span className="t-label-caps tracking-widest">Welcome</span>
          {!last && <button onClick={() => setI(SLIDES.length - 1)} className="cursor-pointer text-sm text-on-primary/80 hover:text-on-primary">Skip</button>}
        </header>

        <div className="relative grid flex-1 place-items-center px-6" key={i}>
          <div className="grid size-40 place-items-center rounded-full bg-on-primary/10 ring-1 ring-on-primary/20">
            <Icon size={72} strokeWidth={1.4} />
          </div>
        </div>

        <section className="relative px-6 pb-8">
          <h1 className="t-headline-lg text-center !text-[28px] !leading-9">{s.title}</h1>
          <p className="mt-3 text-center text-sm leading-5 text-on-primary/85">{s.body}</p>
          <div className="mt-4 flex justify-center gap-2">
            {s.points.map((p) => (
              <span key={p.text} className="inline-flex items-center gap-1.5 rounded-full bg-on-primary/10 px-3 py-1 text-xs">
                <p.icon size={13} />{p.text}
              </span>
            ))}
          </div>
          <div className="mt-6 flex justify-center gap-2" role="tablist" aria-label="Slides">
            {SLIDES.map((_, n) => (
              <button key={n} role="tab" aria-selected={n === i} aria-label={`Slide ${n + 1}`} onClick={() => setI(n)}
                className={cn("h-2 cursor-pointer rounded-full transition-all", n === i ? "w-10 bg-on-primary" : "w-2 bg-on-primary/40")} />
            ))}
          </div>
          <div className="mt-6 space-y-3">
            <Button size="lg" className="w-full" onClick={() => (last ? finish("/onboarding/setup") : setI(i + 1))}>
              {last ? "Get Started" : "Next"}
            </Button>
            {last && (
              <Button size="lg" variant="outline" className="w-full" onClick={() => finish("/dashboard")}>Go to dashboard</Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
