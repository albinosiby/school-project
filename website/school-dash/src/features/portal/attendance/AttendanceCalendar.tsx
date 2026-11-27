"use client";
// Full-month calendar of the teacher app's `showTimetableDateSheet`: a red dot marks a school day with attendance still
// to mark; tap one day, or (with `allowRange`) a second later day for the range between them. Shared by /me/timetable
// (day or range) and /me/attendance (one day, nothing after today).
import { useState } from "react";
import { AlertCircle, CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { Button, Modal } from "@/components/ui";
import { cn } from "@/lib/cn";
import { MONTHS_LONG, fmtDay, monthGrid, schoolDaysIn, tapRange } from "./logic";

export type CalendarPick = { from: string; to?: string };
type Props = {
  from: string; to?: string; today: string; workingDays: number[];
  /** a red dot on this school day (only checked up to today) */
  missing: (iso: string) => boolean;
  allowRange?: boolean;
  /** last pickable day (e.g. today: no attendance for tomorrow) */
  last?: string;
  missingLabel?: string;
  applyLabel?: (range: boolean) => string;
  onApply: (pick: CalendarPick) => void;
};

const FIRST = "2024-01-01";
const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function AttendanceCalendar({ from, to, today, workingDays, missing, allowRange = true, last, missingLabel = "Attendance not marked", applyLabel, onApply }: Props) {
  const [sel, setSel] = useState<{ from: string; to?: string; error?: string }>({ from, to });
  const [month, setMonth] = useState(() => ({ y: Number(from.slice(0, 4)), m: Number(from.slice(5, 7)) }));
  const end = last ?? "2030-12-31";
  const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;
  const shift = (n: number) => setMonth(({ y, m }) => { const t = y * 12 + (m - 1) + n; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const canBack = monthKey(month.y, month.m) > FIRST.slice(0, 7);
  const canNext = monthKey(month.y, month.m) < end.slice(0, 7);
  const school = (d: string) => workingDays.includes(((new Date(`${d}T12:00:00Z`).getUTCDay() || 7)));
  const cap = end < today ? end : today;
  const dotted = (d: string) => school(d) && d <= cap && missing(d);
  const grid = monthGrid(month.y, month.m);
  const missedInMonth = grid.filter((d): d is string => !!d && dotted(d));
  const range = !!sel.to;
  const schoolDays = schoolDaysIn(sel.from, sel.to ?? sel.from, workingDays).length;
  const canApply = range || school(sel.from);

  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-2">
      <Button variant="ghost" size="sm" aria-label="Previous month" disabled={!canBack} onClick={() => shift(-1)}><ChevronLeft size={18} /></Button>
      <p className="text-base font-semibold" aria-live="polite">{MONTHS_LONG[month.m - 1]} {month.y}</p>
      <Button variant="ghost" size="sm" aria-label="Next month" disabled={!canNext} onClick={() => shift(1)}><ChevronRight size={18} /></Button>
    </div>
    <div role="grid" aria-label={`${MONTHS_LONG[month.m - 1]} ${month.y}`} className="grid grid-cols-7 gap-y-1 text-center">
      {LETTERS.map((l, i) => <span key={i} role="columnheader" className={cn("pb-1 text-[11px] font-bold", workingDays.includes(i + 1) ? "text-on-surface-variant" : "text-outline")}>{l}</span>)}
      {grid.map((d, i) => {
        if (!d) return <span key={`pad${i}`} />;
        const isStart = d === sel.from, isEnd = d === sel.to, edge = isStart || isEnd;
        const inside = !!sel.to && d > sel.from && d < sel.to;
        const out = d < FIRST || d > end;
        const dot = dotted(d);
        const isToday = d === today;
        return <div key={d} role="gridcell" className="relative flex h-11 items-center justify-center">
          {(inside || (range && edge)) && <span aria-hidden className={cn("absolute inset-y-1 bg-info-container/70", inside ? "inset-x-0" : isStart ? "left-1/2 right-0" : "left-0 right-1/2")} />}
          <button type="button" disabled={out} onClick={() => setSel((s) => tapRange(s, d, allowRange))}
            aria-pressed={edge || inside}
            aria-label={`${fmtDay(d)} ${d.slice(0, 4)}${isToday ? ", today" : ""}${dot ? ", attendance not marked" : ""}`}
            className={cn("relative grid size-9 cursor-pointer place-items-center rounded-full text-sm tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35",
              edge ? "bg-secondary font-bold text-on-secondary shadow-card" : inside ? "font-semibold text-secondary hover:bg-info-container" : "hover:bg-surface-container",
              !edge && !inside && (school(d) ? "text-on-surface" : "text-outline"),
              isToday && !edge && "font-bold ring-[1.5px] ring-secondary/60")}>
            {Number(d.slice(8))}
            {dot && <span data-testid={`dot-${d}`} aria-hidden className={cn("absolute bottom-0.5 size-1.5 rounded-full", edge ? "bg-on-secondary" : "bg-error")} />}
          </button>
        </div>;
      })}
    </div>

    {missedInMonth.length > 0 && <div className="space-y-2">
      <p className="text-sm font-semibold text-error">{missedInMonth.length} {missedInMonth.length === 1 ? "day" : "days"} to mark in {MONTHS_LONG[month.m - 1]}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]" role="list" aria-label="Days to mark this month">
        {missedInMonth.map((d) => <button key={d} type="button" role="listitem" onClick={() => setSel({ from: d })}
          className={cn("inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-error/35 px-3 py-1 text-xs font-medium transition-colors hover:bg-error-container/40",
            sel.from === d && !sel.to ? "bg-error-container/60 text-on-error-container" : "bg-surface-container-lowest")}>
          <AlertCircle size={13} className="text-error" />{fmtDay(d)}
        </button>)}
      </div>
    </div>}

    <div className="flex items-center gap-2 text-xs text-on-surface-variant">
      <span aria-hidden className="size-2 rounded-full bg-error" /><span className="flex-1">{missingLabel}</span>
      <Button variant="ghost" size="sm" className="text-secondary" onClick={() => { setSel({ from: today > end ? end : today }); setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }); }}>Today</Button>
    </div>

    <div className="flex items-center gap-3 rounded-lg bg-surface-container-low px-3 py-2.5 text-sm">
      {range ? <CalendarRange size={18} className="shrink-0 text-secondary" /> : <CalendarDays size={18} className="shrink-0 text-secondary" />}
      <span className="min-w-0 flex-1 truncate font-semibold" data-testid="calendar-selection">{range ? `${fmtDay(sel.from)} – ${fmtDay(sel.to!)}` : fmtDay(sel.from)}</span>
      {range && <span className="shrink-0 text-xs text-on-surface-variant">{schoolDays} school {schoolDays === 1 ? "day" : "days"}</span>}
    </div>
    {sel.error && <p role="alert" className="text-sm text-error">{sel.error}</p>}
    {!canApply && <p className="text-xs text-on-surface-variant">Not a school day — pick another date.</p>}
    <Button className="w-full" disabled={!canApply} onClick={() => onApply({ from: sel.from, ...(sel.to ? { to: sel.to } : {}) })}>
      {applyLabel ? applyLabel(range) : range ? "Show these days" : "Show this day"}
    </Button>
  </div>;
}

/** The calendar in a dialog; picking closes it. */
export function CalendarDialog({ open, onClose, title = "Calendar", subtitle, ...props }: Props & { open: boolean; onClose: () => void; title?: string; subtitle?: string }) {
  return <Modal open={open} onClose={onClose} title={title} subtitle={subtitle ?? (props.allowRange === false ? "Red dot: attendance still to mark" : "Tap a day, or two days for a range")} width="max-w-md">
    {open && <AttendanceCalendar {...props} onApply={(p) => { props.onApply(p); onClose(); }} />}
  </Modal>;
}
