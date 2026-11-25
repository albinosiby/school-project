"use client";
import { useMemo, useState } from "react";
import { GraduationCap, School, Search, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { suggest, type Roster, type Target } from "./targets";

const icon = { class: School, student: GraduationCap, staff: UserRound } as const;
const tone = { class: "bg-info-container text-secondary", student: "bg-success-container text-success", staff: "bg-warning-container text-warning" } as const;

/** Search box for classes, students and staff by name; picked ones show as removable chips. */
export function TargetPicker({ roster, value, onChange, error }: { roster: Roster; value: Target[]; onChange: (t: Target[]) => void; error?: string }) {
  const [q, setQ] = useState("");
  const [hi, setHi] = useState(0);
  const options = useMemo(() => suggest(q, roster, value), [q, roster, value]);
  const pick = (t: Target) => { onChange([...value, t]); setQ(""); setHi(0); };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-on-surface-variant" htmlFor="target-search">Search a class, student or staff member<span className="text-error"> *</span></label>
      <div className="relative">
        <div className={cn("flex items-center gap-2 rounded-lg border bg-surface-container-lowest px-3", error ? "border-error" : "border-outline-variant focus-within:border-secondary")}>
          <Search size={16} className="text-outline" />
          <input id="target-search" role="combobox" aria-expanded={options.length > 0} aria-controls="target-options" autoComplete="off"
            className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none" placeholder="e.g. 8-A, Asha, Mrs. Rao" value={q}
            onChange={(e) => { setQ(e.target.value); setHi(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, options.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
              else if (e.key === "Enter" && options[hi]) { e.preventDefault(); pick(options[hi]); }
              else if (e.key === "Escape") setQ("");
            }} />
        </div>
        {options.length > 0 && (
          <ul id="target-options" role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-pop">
            {options.map((o, i) => {
              const Icon = icon[o.type];
              return (
                <li key={`${o.type}:${o.id}`} role="presentation">
                  <button type="button" role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onClick={() => pick(o)}
                    className={cn("flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left", i === hi && "bg-surface-container-low")}>
                    <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", tone[o.type])}><Icon size={15} /></span>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium text-on-surface">{o.label}</span><span className="block truncate text-xs text-on-surface-variant">{o.sub}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {q.trim() && options.length === 0 && <p className="mt-1 text-xs text-outline">No class or person matches “{q.trim()}”.</p>}
      </div>
      {value.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((t) => {
            const Icon = icon[t.type];
            return (
              <span key={`${t.type}:${t.id}`} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1 text-sm", tone[t.type])} title={t.sub}>
                <Icon size={14} /><span className="truncate">{t.label}</span>
                {t.type === "student" && <span className="text-xs opacity-75">{t.sub.replace(/^Student · /, "")}</span>}
                <button type="button" aria-label={`Remove ${t.label}`} onClick={() => onChange(value.filter((x) => !(x.type === t.type && x.id === t.id)))}
                  className="grid size-5 cursor-pointer place-items-center rounded-full hover:bg-black/10"><X size={12} /></button>
              </span>
            );
          })}
        </div>
      )}
      {error && <span className="mt-1 block text-xs text-error">{error}</span>}
    </div>
  );
}
