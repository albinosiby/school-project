"use client";

import { useMemo, useState } from "react";
import { Badge, Button, Checkbox, Field, Input, SearchBox, Select, SlideOver } from "@/components/ui";
import { CLASS_GRADES, SECTIONS } from "@/features/ops/shared";
import { parseTransportFee, type TransportFeeStudent } from "./transportFees";
import { capacityError } from "./logic";
import { busLabel, stopsOf, studentLabel } from "./shared";
import type { Bus } from "./types";

export function AddBusStudentsPanel({ bus, students, assignedCount, busy, onClose, onAdd }: {
  bus: Bus; students: TransportFeeStudent[]; assignedCount: number; busy: boolean;
  onClose: () => void; onAdd: (students: TransportFeeStudent[], stopId: string | undefined, amounts: Record<string, string>) => Promise<boolean>;
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, TransportFeeStudent>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [feeErrors, setFeeErrors] = useState<Record<string, string>>({});
  const stops = stopsOf(bus);
  const [stopId, setStopId] = useState(stops[0]?.id ?? "");
  const [error, setError] = useState("");
  const available = Math.max(0, bus.capacity - assignedCount);
  const selected = picked.flatMap((id) => snapshots[id] ? [snapshots[id]] : []);
  const candidates = useMemo(() => students.filter((student) => student.busId !== bus.id
    && (!grade || student.grade === grade) && (!section || student.section === section)
    && (!query || `${student.name} ${student.grn} ${student.guardian}`.toLowerCase().includes(query.toLowerCase())))
    .sort((a, b) => a.name.localeCompare(b.name)), [students, bus.id, query, grade, section]);

  async function add() {
    if (busy || !selected.length) return;
    const problem = capacityError(bus.capacity, assignedCount, selected.length, busLabel(bus));
    if (problem) { setError(problem); return; }
    const invalid = Object.fromEntries(selected.flatMap((student) => {
      const result = parseTransportFee(amounts[student.id] ?? "");
      return result.error ? [[student.id, result.error]] : [];
    }));
    setFeeErrors(invalid);
    if (Object.keys(invalid).length) return;
    setError("");
    if (await onAdd(selected, stopId || undefined, amounts)) onClose();
  }

  return <SlideOver open title="Add students" subtitle={`${busLabel(bus)} · ${available} student seats available`} width="max-w-xl"
    onClose={() => { if (!busy) onClose(); }}
    footer={<div className="w-full space-y-3">
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-on-surface-variant">{selected.length} selected {selected.length > available && <Badge tone="danger">Over capacity</Badge>}</div>
        <div className="flex gap-2"><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          <Button disabled={busy || !selected.length} onClick={() => { void add(); }}>{busy ? "Adding…" : selected.length ? `Add ${selected.length} student${selected.length === 1 ? "" : "s"}` : "Add students"}</Button></div>
      </div>
    </div>}>
    <div className="space-y-5">
      <div className="space-y-3">
        <SearchBox value={query} onChange={setQuery} placeholder="Search name, GRN, guardian…" className="w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Select aria-label="Grade" value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{CLASS_GRADES.map((item) => <option key={item} value={item}>{/^\d+$/.test(item) ? `Grade ${item}` : item}</option>)}</Select>
          <Select aria-label="Section" value={section} onChange={(event) => setSection(event.target.value)}><option value="">All sections</option>{SECTIONS.map((item) => <option key={item}>{item}</option>)}</Select>
        </div>
      </div>
      <Field label="Stop for the selected students" hint="Applies to everyone selected below. Arrange route stops in Stops.">
        <Select value={stopId} disabled={busy} onChange={(event) => { setStopId(event.target.value); setError(""); }}>
          <option value="">No stop</option>{stopId && !stops.some((stop) => stop.id === stopId) && <option value={stopId} disabled>Previous stop · unavailable</option>}
          {stops.map((stop) => <option key={stop.id} value={stop.id}>{stop.name}</option>)}
        </Select>
      </Field>
      {selected.length > 0 && <section aria-label="Transport fee amounts" className="space-y-3 rounded-lg border border-outline-variant/60 p-3">
        <div><h3 className="text-sm font-semibold">Transport fee amounts</h3><p className="mt-1 text-xs text-on-surface-variant">Set an amount for each student. Blank = not configured; 0 = free. Collection frequency is set in Settings → Payments.</p></div>
        {selected.map((student) => <Field key={student.id} label={`Fee amount for ${student.name} (₹)`} error={feeErrors[student.id]}>
          <Input inputMode="decimal" disabled={busy} value={amounts[student.id] ?? ""} placeholder="e.g. 1200"
            onChange={(event) => { setAmounts((previous) => ({ ...previous, [student.id]: event.target.value })); setFeeErrors((previous) => ({ ...previous, [student.id]: "" })); }} />
        </Field>)}
      </section>}
      <div>
        <p className="mb-2 text-xs text-on-surface-variant">{candidates.length > 200 ? `Showing 200 of ${candidates.length} students. Refine the search to find others.` : `${candidates.length} students available`}</p>
        <ul aria-label="Available students" className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
          {!candidates.length && <li className="p-5 text-sm text-on-surface-variant">No students match. Try another search or filter.</li>}
          {candidates.slice(0, 200).map((student) => <li key={student.id}>
            <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-surface-container-low">
              <Checkbox aria-label={`Select ${student.name}`} disabled={busy} checked={picked.includes(student.id)} onChange={(event) => {
                if (event.target.checked) setSnapshots((previous) => ({ ...previous, [student.id]: student }));
                setError(""); setPicked((previous) => event.target.checked ? [...previous, student.id] : previous.filter((id) => id !== student.id));
              }} />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{student.name}</span>
                <span className="t-caption text-outline">{studentLabel(student)} · {student.grn}</span>
                {student.bus && <span className="mt-1 block text-xs text-on-surface-variant">Moving from {student.bus}</span>}
              </span>
            </label>
          </li>)}
        </ul>
      </div>
    </div>
  </SlideOver>;
}
