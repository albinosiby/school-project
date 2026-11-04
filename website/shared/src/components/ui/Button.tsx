import { cn } from "../../lib/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-secondary text-on-secondary hover:bg-secondary-container shadow-card",
  secondary: "bg-primary-container text-on-primary hover:opacity-90",
  outline: "border border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low",
  ghost: "text-on-surface-variant hover:bg-surface-container",
  danger: "bg-error text-on-error hover:opacity-90",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
};

export function Button({
  variant = "primary", size = "md", className, ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center rounded font-semibold whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary",
        "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
        variants[variant], sizes[size], className,
      )}
    />
  );
}
