// Small building blocks shared by the class pages (gradient hero, KPI tiles, section cards, status pills).
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardHeader, EmptyState, type Tone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { CODE_LABEL, type Code } from "./logic";

/** the brand gradient card (the app's class-teacher card and class performance headline) */
export function Hero({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("relative overflow-hidden rounded-lg bg-linear-to-br from-secondary via-navy-600 to-navy-800 p-5 text-white shadow-card sm:p-6", className)}>
    <div aria-hidden className="pointer-events-none absolute -top-16 -right-16 size-48 rounded-full bg-white/10" />
    <div aria-hidden className="pointer-events-none absolute -bottom-20 left-1/3 size-40 rounded-full bg-white/5" />
    <div className="relative">{children}</div>
  </div>;
}

/** a figure on the gradient hero; `warn` tints it amber */
export function HeroStat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return <div className="min-w-0 rounded-md bg-white/15 px-3 py-2.5 backdrop-blur-sm">
    <p className="truncate text-[11px] text-white/75">{label}</p>
    <p className={cn("truncate text-lg font-semibold tabular-nums", warn ? "text-warning-container" : "text-white")}>{value}</p>
  </div>;
}

/** a white KPI card: label, figure, optional sub line and icon */
export function Kpi({ label, value, sub, tone = "neutral", icon }: { label: string; value: string; sub?: string; tone?: "neutral" | "good" | "bad"; icon?: React.ReactNode }) {
  return <Card className="p-4">
    <div className="flex items-start justify-between gap-2 text-xs text-on-surface-variant"><span>{label}</span>{icon}</div>
    <p className={cn("mt-2 text-2xl font-semibold tabular-nums", tone === "good" && "text-success", tone === "bad" && "text-error")}>{value}</p>
    {sub && <p className="mt-0.5 truncate text-xs text-on-surface-variant">{sub}</p>}
  </Card>;
}

/** a titled card section */
export function Section({ title, subtitle, actions, children, className, ...p }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode } & Omit<React.HTMLAttributes<HTMLDivElement>, "title">) {
  return <Card role="region" aria-label={typeof title === "string" ? title : undefined} {...p} className={cn("min-w-0", className)}>
    <CardHeader title={title} subtitle={subtitle} actions={actions} />
    <div className="px-5 pb-5">{children}</div>
  </Card>;
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline"><ArrowLeft size={16} />{children}</Link>;
}

/** a full-page message (not one of your classes, student not found, class teacher only…) */
export function Notice({ title, hint, back }: { title: string; hint?: string; back?: { href: string; label: string } }) {
  return <div>
    {back && <BackLink href={back.href}>{back.label}</BackLink>}
    <Card><EmptyState title={title} hint={hint} /></Card>
  </div>;
}

export const CODE_TONE: Record<Code, Tone> = { P: "success", A: "danger", L: "warning", E: "info" };
/** a register mark as a pill ("Not marked" when null) */
export const MarkBadge = ({ code }: { code: Code | null }) => <Badge tone={code ? CODE_TONE[code] : "neutral"}>{code ? CODE_LABEL[code] : "Not marked"}</Badge>;

/** dot colour of a period mark in the attendance calendar */
export const DOT: Record<Code | "none", string> = { P: "bg-success", A: "bg-error", L: "bg-warning", E: "bg-secondary-container", none: "bg-outline-variant" };

/** a value that may be missing: "—" in muted text */
export const orDash = (v: string) => v || "—";

const LINK_VARIANTS = {
  primary: "bg-secondary text-on-secondary hover:bg-secondary-container shadow-card",
  outline: "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
};
/** a link that looks like a kit Button (an <a>, so no button nested in a link) */
export function ButtonLink({ href, variant = "outline", size = "md", className, children }: { href: string; variant?: keyof typeof LINK_VARIANTS; size?: "sm" | "md"; className?: string; children: React.ReactNode }) {
  return <Link href={href} className={cn("inline-flex items-center justify-center gap-2 rounded font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
    size === "sm" ? "h-8 px-3 text-xs gap-1.5" : "h-10 px-4 text-sm", LINK_VARIANTS[variant], className)}>{children}</Link>;
}
