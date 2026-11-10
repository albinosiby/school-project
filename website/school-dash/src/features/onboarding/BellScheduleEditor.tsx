"use client";

import { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input } from "@/components/ui";
import { cn } from "@/lib/cn";
import { buildSchedule, fmtMin, toMin, type Bell, type BellBreak } from "./bellSchedule";

export function BellScheduleEditor({ value, onChange, disabled = false }: { value: Bell; onChange: (value: Bell) => void; disabled?: boolean }) {
  const schedule = useMemo(() => buildSchedule(value), [value]);
  const updateBreak = (index: number, patch: Partial<BellBreak>) => onChange({ ...value, breaks: value.breaks.map((item, row) => row === index ? { ...item, ...patch } : item) });

  return (
    <fieldset disabled={disabled} className="min-w-0 space-y-6">
      <legend className="sr-only">School day and breaks</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Gates open"><Input type="time" value={value.gates} onChange={(event) => onChange({ ...value, gates: event.target.value })} /></Field>
        <Field label="First period starts"><Input type="time" value={value.start} onChange={(event) => onChange({ ...value, start: event.target.value })} /></Field>
        <Field label="School closes"><Input type="time" value={value.end} onChange={(event) => onChange({ ...value, end: event.target.value })} /></Field>
        <Field label="Periods per day"><Input type="number" min={1} max={12} step={1} value={value.periods} onChange={(event) => onChange({ ...value, periods: Number(event.target.value) })} /></Field>
        <Field label="Period length (min)"><Input type="number" min={20} max={90} step={1} value={value.len} onChange={(event) => onChange({ ...value, len: Number(event.target.value) })} /></Field>
      </div>

      <section aria-labelledby="bell-breaks-heading" className="space-y-3">
        <div>
          <h3 id="bell-breaks-heading" className="font-semibold">Breaks</h3>
          <p className="mt-1 text-sm text-on-surface-variant">Add morning break, lunch, and afternoon break with their exact start times.</p>
        </div>
        {value.breaks.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant p-4 text-sm text-on-surface-variant">No breaks added. Use Add break to include one.</p>}
        {value.breaks.map((item, index) => (
          <fieldset key={index} className="min-w-0 rounded-lg border border-outline-variant/60 p-4">
            <legend className="px-1 text-xs font-semibold text-on-surface-variant">Break {index + 1}</legend>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-xs text-on-surface-variant">
                {item.start && item.duration > 0 && item.duration <= 180 ? `Ends at ${fmtMin(toMin(item.start) + item.duration)}` : "Set a start time and duration"}
              </span>
              <Button type="button" size="sm" variant="ghost" aria-label={`Remove break ${index + 1}`} onClick={() => onChange({ ...value, breaks: value.breaks.filter((_, row) => row !== index) })}><Trash2 size={14} aria-hidden="true" />Remove</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <Field label="Break name"><Input value={item.name} maxLength={80} placeholder="e.g. Morning break" onChange={(event) => updateBreak(index, { name: event.target.value })} /></Field>
              <Field label="Start time"><Input type="time" value={item.start} onChange={(event) => updateBreak(index, { start: event.target.value })} /></Field>
              <Field label="Duration (min)"><Input type="number" min={1} max={180} step={1} value={item.duration} onChange={(event) => updateBreak(index, { duration: Number(event.target.value) })} /></Field>
            </div>
          </fieldset>
        ))}
        <Button type="button" variant="outline" onClick={() => onChange({ ...value, breaks: [...value.breaks, { name: "", start: "", duration: 10 }] })}><Plus size={16} aria-hidden="true" />Add break</Button>
      </section>

      <div className="overflow-hidden rounded-lg border border-outline-variant/60">
        <div className="border-b border-outline-variant/60 bg-surface-container-low px-4 py-3">
          <p className="text-sm font-semibold">Preview · day ends {fmtMin(schedule.endsAt)}</p>
          <p className="mt-1 text-xs text-on-surface-variant">Breaks keep their start times. A full period that would cross a break moves after it; any unused time is shown below.</p>
        </div>
        <ul aria-label="Daily schedule preview" className="divide-y divide-outline-variant/40 text-sm">{schedule.rows.map((row, index) => (
          <li key={index} className={cn("flex flex-wrap justify-between gap-x-4 gap-y-1 px-4 py-2", row.break && "bg-warning-container/40", row.gap && "text-on-surface-variant")}><span className="min-w-0 break-words">{row.label}</span><span className="shrink-0 font-mono">{row.from} – {row.to}</span></li>
        ))}</ul>
      </div>
    </fieldset>
  );
}
