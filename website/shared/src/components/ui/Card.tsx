import { cn } from "../../lib/cn";
export function Card({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...p} className={cn("rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-card", className)} />;
}
export function CardHeader({ title, subtitle, actions, className }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-wrap items-start justify-between gap-4 p-5 pb-3", className)}>
      <div className="min-w-0">
        <h3 className="t-headline-md !text-[17px] !leading-6">{title}</h3>
        {subtitle && <p className="mt-0.5 text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
