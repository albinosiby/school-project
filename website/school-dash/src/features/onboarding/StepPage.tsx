"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Card, ProgressBar, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { canOpenStep, progressPct, STEPS } from "./logic";
import { useOnboarding } from "./state";
import { STEP_FORMS } from "./steps";

export function StepPage({ no }: { no: number }) {
  const router = useRouter();
  const toast = useToast();
  const ob = useOnboarding();
  const [busy, setBusy] = useState(false);
  const stepIndex = STEPS.findIndex((step) => step.no === no);
  const meta = STEPS[stepIndex];
  const next = STEPS[stepIndex + 1];
  const previous = STEPS[stepIndex - 1];
  const reachable = canOpenStep(no, ob.completed);

  // can't skip ahead of the first unfinished step
  useEffect(() => {
    if (!ob.ready) return;
    if (ob.state?.complete) router.replace("/dashboard");
    else if (!reachable) router.replace(`/onboarding/setup/${ob.firstOpen}`);
  }, [ob.ready, ob.state, ob.firstOpen, reachable, router]);

  if (!ob.ready || ob.state?.complete || !meta || !reachable) return <div className="grid min-h-screen place-items-center text-outline">Loading…</div>;
  const Form = STEP_FORMS[meta.no];

  const submit = async (values: Record<string, unknown>, persist?: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await persist?.();
      await ob.complete(no, values);
      if (!next) {
        await ob.finish();
        toast("Setup complete — welcome to your dashboard");
        router.push("/dashboard");
      } else {
        toast(`${meta.title} saved`);
        router.push(`/onboarding/setup/${next.no}`);
      }
    } catch (e) { toast(`Could not save, please try again${e instanceof Error && e.message ? ` (${e.message.replace(/^Firebase:\s*/, "")})` : ""}`, "error"); }
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-surface-container-low">
      <header className="border-b border-outline-variant/60 bg-surface-container-lowest">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <Logo size={36} />
            <span className="font-semibold">School setup</span>
          </div>
          <div className="hidden w-64 sm:block"><ProgressBar value={progressPct(ob.completed)} /></div>
          <span className="flex items-center gap-4 text-sm text-on-surface-variant">
            <span>Step {stepIndex + 1} of {STEPS.length}</span>
          </span>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <nav aria-label="Setup steps" className="hidden lg:sticky lg:top-8 lg:block lg:max-h-[calc(100svh-4rem)] lg:self-start lg:overflow-y-auto">
          <ol className="space-y-1">
            {STEPS.map((s, index) => {
              const done = ob.completed.includes(s.no), on = s.no === no, reachable = s.no <= ob.firstOpen;
              const row = (
                <span className={cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm", on ? "bg-info-container font-semibold text-secondary" : reachable ? "text-on-surface hover:bg-surface-container" : "text-outline")}>
                  <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", done ? "bg-success text-white" : on ? "bg-secondary text-on-secondary" : "bg-surface-container-high text-on-surface-variant")}>
                    {done ? <Check size={13} /> : index + 1}
                  </span>{s.title}
                </span>
              );
              return <li key={s.no}>{reachable ? <Link href={`/onboarding/setup/${s.no}`} aria-current={on ? "step" : undefined}>{row}</Link> : row}</li>;
            })}
          </ol>
        </nav>

        <Card className="p-6 sm:p-8">
          <p className="t-label-caps text-secondary">Step {stepIndex + 1} of {STEPS.length}</p>
          <h1 className="t-headline-lg mt-1">{meta.title}</h1>
          <p className="mt-1 text-on-surface-variant">{meta.blurb}</p>
          <div className="mt-6">
            <Form initial={ob.saved(no)} busy={busy} onSubmit={submit}
              back={previous ? () => router.push(`/onboarding/setup/${previous.no}`) : undefined} />
          </div>
        </Card>
      </div>
    </div>
  );
}
