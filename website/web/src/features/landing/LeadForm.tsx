"use client";
import { useState } from "react";
import { CheckCircle2, Mail, Send } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { CONTACT_EMAIL } from "./content";
import { leadMailto, submitLead, validateLead, type LeadErrors, type LeadInput } from "./leads";
import { Reveal } from "./motion";

const EMPTY: LeadInput = { name: "", school: "", email: "", phone: "", message: "" };

/** Section 5: the "Book a demo" form writing leads/{autoId}, with a mailto fallback carrying the same details. */
export function LeadForm() {
  const [v, setV] = useState<LeadInput>(EMPTY);
  const [errors, setErrors] = useState<LeadErrors>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const set = (k: keyof LeadInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => { setV({ ...v, [k]: e.target.value }); if (errors[k]) setErrors({ ...errors, [k]: undefined }); };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validateLead(v);
    setErrors(errs);
    if (Object.values(errs).some(Boolean)) return;
    setState("sending");
    try { await submitLead(v); setState("sent"); } catch { setState("failed"); }
  };

  const field = (k: keyof LeadInput, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={`lead-${k}`}>{label}{props.required ? <span className="text-destructive"> *</span> : <span className="text-muted-foreground"> (optional)</span>}</Label>
      <Input id={`lead-${k}`} name={k} value={v[k]} onChange={set(k)} aria-invalid={!!errors[k]} aria-describedby={errors[k] ? `lead-${k}-err` : undefined} className="h-11 bg-background" {...props} />
      {errors[k] && <p id={`lead-${k}-err`} role="alert" className="text-sm text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <section id="demo" className="scroll-mt-16 bg-muted/40 py-20 sm:py-28">
      <div className="l-container grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
        <Reveal>
          <p className="l-eyebrow text-brand">Take action</p>
          <h2 className="l-h2 mt-3 text-balance">Book a demo for your school</h2>
          <p className="l-lead mt-4 text-muted-foreground">Tell us about your school and we set up a demo tenant with your class structure. You will see the office console, a teacher&apos;s phone and a parent&apos;s phone in one session.</p>
          <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
            {["A 45-minute walkthrough with your office and one teacher", "A demo school pre-loaded with your grades and sections", "A written plan for importing students, staff and fees"].map((t) => <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-mint" />{t}</li>)}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">Prefer email? <a className="font-medium text-brand underline-offset-4 hover:underline" href={leadMailto(CONTACT_EMAIL, v)}>{CONTACT_EMAIL}</a></p>
        </Reveal>
        <Reveal delay={0.1}>
          {state === "sent" ? (
            <div role="status" className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border bg-card p-8 text-center">
              <CheckCircle2 className="size-12 text-mint" />
              <h3 className="l-h3 mt-4">Thanks, {v.name.trim().split(" ")[0]}. We have your request.</h3>
              <p className="mt-2 max-w-sm text-muted-foreground">We will write to {v.email.trim()} within one working day to fix a time for {v.school.trim()}.</p>
              <Button variant="outline" className="mt-6" onClick={() => { setV(EMPTY); setState("idle"); }}>Send another request</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="rounded-3xl border bg-card p-6 sm:p-8" aria-label="Book a demo">
              <div className="grid gap-5 sm:grid-cols-2">
                {field("name", "Your name", { required: true, autoComplete: "name", maxLength: 120 })}
                {field("school", "School", { required: true, autoComplete: "organization", maxLength: 160 })}
                {field("email", "Work email", { required: true, type: "email", autoComplete: "email", inputMode: "email", maxLength: 254 })}
                {field("phone", "Phone", { type: "tel", autoComplete: "tel", inputMode: "tel", maxLength: 32, placeholder: "+91" })}
              </div>
              <div className="mt-5 space-y-1.5">
                <Label htmlFor="lead-message">Message<span className="text-muted-foreground"> (optional)</span></Label>
                <Textarea id="lead-message" name="message" rows={4} value={v.message} onChange={set("message")} maxLength={2000} aria-invalid={!!errors.message} className="bg-background" placeholder="Number of students, buses, what you use today…" />
                {errors.message && <p role="alert" className="text-sm text-destructive">{errors.message}</p>}
              </div>
              {state === "failed" && (
                <p role="alert" className="mt-5 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  We could not send the request just now. <a className="font-semibold underline" href={leadMailto(CONTACT_EMAIL, v)}>Email it instead</a> and we will reply the same way.
                </p>
              )}
              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button type="submit" size="lg" className="h-12 px-6 text-base" disabled={state === "sending"}>{state === "sending" ? "Sending…" : <>Book a demo <Send data-icon="inline-end" /></>}</Button>
                <Button type="button" variant="ghost" size="lg" className="h-12" asChild><a href={leadMailto(CONTACT_EMAIL, v)}><Mail data-icon="inline-start" /> Email us instead</a></Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">We use these details only to arrange the demo.</p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
