"use client";

import type { ReactNode } from "react";
import { FileImage, FileText, Upload } from "lucide-react";

export function DocumentList({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-outline-variant/60 overflow-hidden rounded-lg border border-outline-variant/60">
    {children}
  </ul>;
}

export function DocumentRow({ title, badge, details, photo, children }: {
  title: string;
  badge: ReactNode;
  details?: ReactNode;
  photo?: boolean;
  children: ReactNode;
}) {
  const Icon = photo ? FileImage : FileText;
  return <li className="space-y-3 p-3 text-sm">
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-surface-container text-on-surface-variant">
        <Icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-medium">{title}</p>
          {badge}
        </div>
        {details}
      </div>
    </div>
    {children}
  </li>;
}

export function DocumentFilePicker({ label, name, accept, disabled, onSelect }: {
  label: string;
  name: string;
  accept: string;
  disabled: boolean;
  onSelect: (file: File) => void;
}) {
  return <label className={`inline-flex min-h-8 items-center gap-1.5 rounded px-2 text-xs font-semibold text-secondary focus-within:ring-2 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
    <Upload size={14} aria-hidden="true" /><span>{label}</span>
    <input type="file" className="sr-only" aria-label={name} accept={accept} disabled={disabled}
      onChange={(event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onSelect(file);
      }} />
  </label>;
}
