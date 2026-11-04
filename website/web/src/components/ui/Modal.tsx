"use client";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/cn";

function useEsc(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
}

export function Modal({ open, onClose, title, subtitle, children, footer, width = "max-w-lg" }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-inverse-surface/50" onClick={onClose} />
      <div className={cn("relative flex max-h-[90vh] w-full flex-col rounded-xl bg-surface-container-lowest shadow-pop", width)}>
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant/60 p-5">
          <div><h2 className="t-headline-md">{title}</h2>{subtitle && <p className="mt-0.5 text-on-surface-variant">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded p-1 text-outline hover:bg-surface-container"><X size={18} /></button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-outline-variant/60 p-4">{footer}</footer>}
      </div>
    </div>
  );
}

export function SlideOver({ open, onClose, title, subtitle, children, footer, width = "max-w-md" }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode; width?: string;
}) {
  useEsc(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-inverse-surface/40" onClick={onClose} />
      <aside className={cn("absolute right-0 top-0 flex h-full w-full flex-col bg-surface-container-lowest shadow-pop", width)}>
        <header className="flex items-start justify-between gap-4 border-b border-outline-variant/60 p-5">
          <div><h2 className="t-headline-md">{title}</h2>{subtitle && <p className="mt-0.5 text-on-surface-variant">{subtitle}</p>}</div>
          <button onClick={onClose} aria-label="Close" className="cursor-pointer rounded p-1 text-outline hover:bg-surface-container"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-outline-variant/60 p-4">{footer}</footer>}
      </aside>
    </div>
  );
}
