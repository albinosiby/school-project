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
  const [f, setF] = useState({ number: edit?.number ?? "", regNo: edit?.regNo ?? "", capacity: String(edit?.capacity ?? 40), model: edit?.model ?? "", endPoint: edit.endPoint || edit.routeName || "", status: edit?.status ?? "Active", note: edit?.note ?? "" });
  const [stops, setStops] = useState<StopDraft[]>(stopsOf(edit).map((s) => ({ ...s, landmark: s.landmark ?? "" })));
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setStop = (i: number, k: keyof StopDraft, v: string) => setStops((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const move = (i: number, d: -1 | 1) => setStops((p) => moveStop(p, i, d));
  const addStop = () => setStops((previous) => [...previous, {
    id: nextStopId(previous), name: "", pickupTime: "", dropTime: "", landmark: "",
  }]);
  async function submit() {
    const e = validateBus({ ...f, routeName: f.endPoint }, stops, existing, edit.id, onBus);
    if (e.routeName) { e.endPoint = "Final stop name is required"; delete e.routeName; }
    if (edit.totalSeats != null && Number(f.capacity) > edit.totalSeats) e.capacity ??= "Student seating cannot exceed total seating";
    setErr(e); if (Object.keys(e).length) return;
    const body: Omit<Bus, "id" | "studentCount"> = { number: f.number.trim(), regNo: f.regNo.trim().toUpperCase().replace(/\s+/g, "-"), capacity: Number(f.capacity), endPoint: f.endPoint.trim(),
      routeName: !edit.routeName || edit.routeName === edit.endPoint ? f.endPoint.trim() : edit.routeName,
      pickupStart: edit.pickupStart ?? "", dropStart: edit.dropStart ?? "", status: f.status as BusStatus,
      stops: stops.map((s) => ({ id: s.id, name: s.name.trim(), pickupTime: s.pickupTime ?? "", dropTime: s.dropTime ?? "", ...(s.landmark.trim() ? { landmark: s.landmark.trim() } : {}) })), model: f.model.trim(), note: f.note.trim() };
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={`Edit ${busLabel(edit)}`} subtitle="Bus, final stop and stops in route order" width="max-w-xl"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bus number" required error={err.number}><Input value={f.number} onChange={(e) => set("number", e.target.value)} placeholder="14" /></Field>
        <Field label="Registration no" required error={err.regNo}><Input value={f.regNo} onChange={(e) => set("regNo", e.target.value)} placeholder="DL-01-AB-4092" /></Field>
        <Field label="Capacity (seats)" required error={err.capacity}><Input type="number" min={1} value={f.capacity} onChange={(e) => set("capacity", e.target.value)} /></Field>
        <Field label="Model"><Input value={f.model} onChange={(e) => set("model", e.target.value)} placeholder="42-seater AC" /></Field>
        <Field label="Final stop name" required error={err.endPoint} hint="The last stop on this bus route." className="sm:col-span-2">
          <Input value={f.endPoint} onChange={(e) => set("endPoint", e.target.value)} placeholder="e.g. Edappally Junction" />
        </Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{STATUS.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Note" className="sm:col-span-2"><Textarea value={f.note} onChange={(e) => set("note", e.target.value)} className="min-h-16" placeholder="e.g. Fitness certificate due in March" /></Field>
      </div>
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
              <div className="grid gap-2 sm:grid-cols-2">
                <Input value={s.name} onChange={(e) => setStop(i, "name", e.target.value)} placeholder="Stop name" aria-label="Stop name" />
                <Input value={s.landmark} onChange={(e) => setStop(i, "landmark", e.target.value)} placeholder="Landmark" aria-label="Landmark" />
              </div>
            </li>))}
        </ol>
      </section>
    </SlideOver>
  );
}
