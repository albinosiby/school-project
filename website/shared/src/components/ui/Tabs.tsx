"use client";
import { cn } from "../../lib/cn";
export type TabItem = { id: string; label: string; count?: number };
export function Tabs({ items, value, onChange, variant = "pill", className }: {
  items: TabItem[]; value: string; onChange: (id: string) => void; variant?: "pill" | "underline"; className?: string;
}) {
  return (
    <div role="tablist" className={cn("flex gap-1 overflow-x-auto", variant === "underline" && "border-b border-outline-variant gap-5", className)}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className={cn("shrink-0 cursor-pointer text-sm font-medium transition-colors",
              variant === "pill"
                ? cn("rounded-full px-3.5 py-1.5", on ? "bg-info-container text-secondary" : "text-on-surface-variant hover:bg-surface-container")
                : cn("-mb-px border-b-2 pb-2.5", on ? "border-secondary text-secondary" : "border-transparent text-on-surface-variant hover:text-on-surface"))}>
            {t.label}{t.count !== undefined && <span className="ml-1.5 opacity-70">({t.count})</span>}
          </button>
        );
      })}
    </div>
  );
}
