import { cn } from "@/lib/cn";
export type Tone = "neutral" | "brand" | "success" | "warning" | "danger" | "info";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-container text-on-surface-variant",
  brand: "bg-info-container text-secondary",
  info: "bg-info-container text-secondary",
  success: "bg-success-container text-success",
  warning: "bg-warning-container text-warning",
  danger: "bg-error-container text-on-error-container",
};
export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 t-caption whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}
