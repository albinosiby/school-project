import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base =
  "w-full rounded border border-outline-variant bg-surface-container-lowest px-3 text-sm text-on-surface placeholder:text-outline " +
  "focus:border-secondary focus:outline-2 focus:outline-secondary/30 disabled:bg-surface-container disabled:text-outline";

export function Field({ label, hint, error, required, children, className }: {
  label?: string; hint?: string; error?: string; required?: boolean; children: React.ReactNode; className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      {label && (
        <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">
          {label}{required && <span className="text-error"> *</span>}
        </span>
      )}
      {children}
      {error ? <span className="mt-1 block text-xs text-error">{error}</span>
        : hint ? <span className="mt-1 block text-xs text-outline">{hint}</span> : null}
    </label>
  );
}
export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cn(base, "h-10", className)} />;
}
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...p} className={cn(base, "h-10 cursor-pointer pr-8", className)}>{children}</select>;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...p} className={cn(base, "min-h-24 py-2", className)} />;
}
export function Checkbox({ className, ...p }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" {...p} className={cn("size-4 cursor-pointer rounded-sm border-outline-variant accent-secondary", className)} />;
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cn("relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors", checked ? "bg-secondary" : "bg-outline-variant")}>
      <span className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow transition-all", checked ? "left-[22px]" : "left-0.5")} />
    </button>
  );
}
