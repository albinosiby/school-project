import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

/** Decorative building block; LoadingSkeleton supplies the accessible announcement. */
export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <span aria-hidden="true" className={cn("skeleton-shimmer block rounded", className)} />;
}

export type SkeletonVariant = "page" | "table" | "card" | "form" | "details" | "image" | "avatar" | "inline" | "field";

function Lines() {
  return <div className="space-y-3"><Skeleton className="h-4 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-5/6" /></div>;
}

function CardShape() {
  return <div className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5"><Skeleton className="mb-5 h-4 w-1/3" /><Lines /></div>;
}

function TableShape() {
  return <div className="overflow-hidden rounded-lg border border-outline-variant/40 bg-surface-container-lowest">
    <div className="flex items-center justify-between gap-4 border-b border-outline-variant/40 p-4"><Skeleton className="h-10 w-2/3 max-w-sm" /><Skeleton className="h-10 w-20" /></div>
    <div className="grid grid-cols-3 gap-5 bg-surface-container-low p-4 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className={cn("h-3 w-2/3", index === 3 && "hidden sm:block")} />)}</div>
    {Array.from({ length: 5 }, (_, index) => <div key={index} className="grid grid-cols-3 items-center gap-5 border-t border-outline-variant/30 p-4 sm:grid-cols-4">
      <div className="flex min-w-0 items-center gap-3"><Skeleton className="size-8 shrink-0 rounded-full" /><Skeleton className="h-3 w-full" /></div>
      <Skeleton className="h-3 w-4/5" /><Skeleton className="h-5 w-3/4" /><Skeleton className="hidden h-3 w-4/5 sm:block" />
    </div>)}
  </div>;
}

function PageShape() {
  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-5"><div className="w-2/3 space-y-3"><Skeleton className="h-7 w-3/4 max-w-sm" /><Skeleton className="h-4 w-full max-w-lg" /></div><Skeleton className="h-10 w-24" /></div>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <div key={index} className="rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-4"><Skeleton className="mb-5 h-3 w-3/4" /><Skeleton className="h-7 w-1/2" /></div>)}</div>
    <div className="flex gap-3"><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="h-8 w-24 rounded-full" /><Skeleton className="h-8 w-24 rounded-full" /></div>
    <TableShape />
  </div>;
}

/** CSS-only shimmer with one accessible status; no invented data or interactive placeholders. */
export function LoadingSkeleton({ variant = "card", label = "Loading…", className }: {
  variant?: SkeletonVariant; label?: string; className?: string;
}) {
  if (variant === "inline" || variant === "field" || variant === "avatar") return <span role="status" aria-label={label} aria-live="polite" aria-busy="true"
    className={cn(variant === "inline" ? "inline-block max-w-full align-middle" : "block", className)}>
    <span className="sr-only">{label}</span><Skeleton className={variant === "avatar" ? "size-24 rounded-xl" : variant === "field" ? "h-10 w-full" : "h-4 w-24 max-w-full"} />
  </span>;
  return <div role="status" aria-label={label} aria-live="polite" aria-busy="true" className={cn("w-full", className)}>
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="w-full">
      {variant === "page" ? <PageShape /> : variant === "table" ? <TableShape /> : variant === "form" ? <div className="space-y-5 p-4">
        <Skeleton className="h-6 w-1/3" /><div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="space-y-2"><Skeleton className="h-3 w-1/2" /><Skeleton className="h-10 w-full" /></div>)}</div><Skeleton className="h-10 w-28" />
      </div> : variant === "details" ? <div className="space-y-5"><div className="flex items-center gap-5 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-5"><Skeleton className="size-20 shrink-0 rounded-xl" /><div className="w-full max-w-md"><Lines /></div></div><div className="grid gap-4 sm:grid-cols-2"><CardShape /><CardShape /><CardShape /><CardShape /></div></div>
        : variant === "image" ? <Skeleton className="h-64 w-full rounded-lg sm:h-96" /> : <CardShape />}
    </div>
  </div>;
}

/** Keeps the real disabled field in place so labels and current form state stay intact. */
export function LoadingField({ loading, label, children }: { loading: boolean; label: string; children: ReactNode }) {
  return <span className="relative block" aria-busy={loading} aria-description={loading ? label : undefined}>
    {children}{loading && <Skeleton className="pointer-events-none absolute inset-0 h-full w-full" />}
  </span>;
}
