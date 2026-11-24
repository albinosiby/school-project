import { cn } from "../../lib/cn";
import { initials } from "../../lib/format";
import { Card } from "./Card";
import { Badge, type Tone } from "./Badge";

export function ProgressBar({ value, tone = "brand", className }: { value: number; tone?: "brand" | "success" | "warning" | "danger" | "muted"; className?: string }) {
  const c = { brand: "bg-secondary", success: "bg-success", warning: "bg-warning", danger: "bg-error", muted: "bg-outline" }[tone];
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-container-high", className)} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-all", c)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

/** Initials in a circle, or the person's photo when [image] (a data URL or https URL) is given. */
export function Avatar({ name, size = 32, className, image }: { name: string; size?: number; className?: string; image?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-full bg-info-container font-semibold text-secondary", className)}
      style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- a tiny inline thumbnail; next/image cannot optimise data URLs */}
      {image ? <img src={image} alt="" width={size} height={size} className="size-full object-cover" /> : initials(name)}
    </span>
  );
}

export function Stat({ label, value, sub, subTone = "neutral", icon }: { label: string; value: React.ReactNode; sub?: string; subTone?: Tone; icon?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2 text-on-surface-variant"><span className="text-xs">{label}</span>{icon}</div>
      <div className="mt-3 flex items-end justify-between gap-2">
        <span className="t-headline-md !text-2xl !leading-8">{value}</span>
        {sub && <Badge tone={subTone}>{sub}</Badge>}
      </div>
    </Card>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="t-headline-lg">{title}</h1>{subtitle && <p className="mt-1 text-on-surface-variant">{subtitle}</p>}</div>
      {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto [&>select]:min-w-0 sm:[&>select]:w-44">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="grid place-items-center gap-2 px-6 py-12 text-center">
      <p className="font-semibold text-on-surface">{title}</p>
      {hint && <p className="max-w-sm text-on-surface-variant">{hint}</p>}
      {action}
    </div>
  );
}
