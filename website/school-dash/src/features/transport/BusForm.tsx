"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, SlideOver, Textarea } from "@/components/ui";
import { busLabel, stopsOf } from "./shared";
import { moveStop, nextStopId, validateBus } from "./logic";
import type { Bus, BusStatus, BusStop } from "./types";

const STATUS: BusStatus[] = ["Active", "Maintenance", "Inactive"];

type StopDraft = BusStop & { landmark: string };
export function BusForm({ edit, existing, onBus, onClose, onSave }: { edit: Bus; existing: Bus[]; onBus: number; onClose: () => void; onSave: (v: Omit<Bus, "id" | "studentCount">) => Promise<void> }) {
  const [f, setF] = useState({ number: edit?.number ?? "", regNo: edit?.regNo ?? "", capacity: String(edit?.capacity ?? 40), monthlyFee: edit?.monthlyFee == null ? "" : String(edit.monthlyFee), model: edit?.model ?? "", routeName: edit?.routeName ?? "", pickupStart: edit?.pickupStart ?? "06:45", dropStart: edit?.dropStart ?? "15:30", status: edit?.status ?? "Active", note: edit?.note ?? "" });
  const [stops, setStops] = useState<StopDraft[]>(stopsOf(edit).map((s) => ({ ...s, landmark: s.landmark ?? "" })));
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setStop = (i: number, k: keyof StopDraft, v: string) => setStops((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const move = (i: number, d: -1 | 1) => setStops((p) => moveStop(p, i, d));
  const addStop = () => {
    if (!f.pickupStart) set("pickupStart", "06:45");
    if (!f.dropStart) set("dropStart", "15:30");
    setStops((p) => [...p, { id: nextStopId(p), name: "", pickupTime: p.at(-1)?.pickupTime ?? (f.pickupStart || "06:45"), dropTime: p.at(-1)?.dropTime ?? (f.dropStart || "15:30"), landmark: "" }]);
  };
  async function submit() {
    const e = validateBus(f, stops, existing, edit.id, onBus, !!edit.endPoint);
    if (edit.totalSeats != null && Number(f.capacity) > edit.totalSeats) e.capacity ??= "Student seating cannot exceed total seating";
    setErr(e); if (Object.keys(e).length) return;
    const body: Omit<Bus, "id" | "studentCount"> = { number: f.number.trim(), regNo: f.regNo.trim().toUpperCase().replace(/\s+/g, "-"), capacity: Number(f.capacity), routeName: f.routeName.trim(), pickupStart: f.pickupStart, dropStart: f.dropStart, status: f.status as BusStatus,
      stops: stops.map((s) => ({ id: s.id, name: s.name.trim(), pickupTime: s.pickupTime, dropTime: s.dropTime, ...(s.landmark.trim() ? { landmark: s.landmark.trim() } : {}) })), model: f.model.trim(), note: f.note.trim(), monthlyFee: f.monthlyFee.trim() ? Number(f.monthlyFee) : null };
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={`Edit ${busLabel(edit)}`} subtitle="Bus, route timings and stops in route order" width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bus number" required error={err.number}><Input value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="14" /></Field>
        <Field label="Registration no" required error={err.regNo}><Input value={f.regNo} onChange={(e) => set("regNo", e.target.value)} placeholder="DL-01-AB-4092" /></Field>
        <Field label="Capacity (seats)" required error={err.capacity}><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label="Model"><Input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="42-seater AC" /></Field>
        <Field label="Route name" required error={err.routeName} className="sm:col-span-2"><Input value={f.routeName} onChange={(e) => set("routeName", e.target.value)} placeholder="Route 4B" /></Field>
        <Field label="Pickup starts" hint="Leaves the first stop" error={err.pickupStart}><Input type="time" value={f.pickupStart} onChange={(e) => set("pickupStart", e.target.value)} /></Field>
        <Field label="Drop starts" hint="Leaves the school" error={err.dropStart}><Input type="time" value={f.dropStart} onChange={(e) => set("dropStart", e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => set("note", e.target.value)} className="min-h-16" placeholder="e.g. Fitness certificate due in March" /></Field>
      </div>
      <section className="mt-6 rounded-lg border border-outline-variant/60 p-4">
        <h3 className="mb-3 text-sm font-semibold">Transportation fee</h3>
        <Field label="Monthly transport fee (₹)" hint="Per student assigned to this bus. Leave blank if not yet decided, or enter 0 for free transport." error={err.monthlyFee}><Input type="number" min={0} max={10000000} step={0.01} value={f.monthlyFee} onChange={(e) => set("monthlyFee", e.target.value)} placeholder="e.g. 1200" /></Field>
      </section>
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between"><h3 className="t-label-caps text-on-surface-variant">Stops ({stops.length})</h3><Button size="sm" variant="outline" onClick={addStop}><Plus size={14} />Add stop</Button></div>
        {err.stops && <p className="mb-2 text-xs text-error" role="alert">{err.stops}</p>}
        {stops.length === 0 && <p className="rounded-lg bg-surface-container-low p-3 text-sm text-on-surface-variant">No stops yet. Add them in route order; the school itself is not a stop.</p>}
        <ol className="space-y-2">
          {stops.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-outline-variant/60 p-3">
              <div className="mb-2 flex items-center gap-2 text-xs text-outline"><span className="font-mono">{i + 1}. {s.id}</span>
                <span className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp size={14} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Move down" disabled={i === stops.length - 1} onClick={() => move(i, 1)}><ArrowDown size={14} /></Button>
                  <Button size="sm" variant="ghost" aria-label="Remove stop" onClick={() => setStops((p) => p.filter((_, j) => j !== i))}><Trash2 size={14} className="text-error" /></Button></span></div>
              <div className="grid gap-2 sm:grid-cols-[1fr_96px_96px_1fr]">
                <Input value={s.name} onChange={(e) => setStop(i, "name", e.target.value)} placeholder="Stop name" aria-label="Stop name" />
                <Input type="time" value={s.pickupTime} onChange={(e) => setStop(i, "pickupTime", e.target.value)} aria-label="Pickup time" />
                <Input type="time" value={s.dropTime} onChange={(e) => setStop(i, "dropTime", e.target.value)} aria-label="Drop time" />
                <Input value={s.landmark} onChange={(e) => setStop(i, "landmark", e.target.value)} placeholder="Landmark" aria-label="Landmark" />
              </div>
            </li>))}
        </ol>
      </section>
    </SlideOver>
  );
}
