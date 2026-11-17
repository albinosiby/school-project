"use client";

import { useState } from "react";
import { LoadingSkeleton, Button, Field, Input, SlideOver, Textarea } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { MAINTENANCE_RECORD_FIELDS, maintenancePatch, maintenanceValues, validateMaintenance, type MaintenanceHistory, type MaintenanceKey } from "./maintenanceRecords";
import type { Bus } from "./types";

export function BusMaintenanceEditor({ bus, onSave, onClose }: {
  bus: Bus; onSave: (snapshot: Bus, patch: Partial<Bus>) => Promise<void>; onClose: () => void;
}) {
  const [snapshot] = useState(bus);
  const [values, setValues] = useState(() => maintenanceValues(bus));
  const [errors, setErrors] = useState<Partial<Record<MaintenanceKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving) return;
    const problems = validateMaintenance(values);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setSaving(true); setError("");
    try { await onSave(snapshot, maintenancePatch(values)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update maintenance details."); }
    finally { setSaving(false); }
  }
  return <SlideOver open title="Update maintenance" subtitle="Update service dates, odometer readings and maintenance notes. Changes are recorded in history." width="max-w-2xl"
    onClose={() => { if (!saving) onClose(); }} footer={<>
      <Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save update"}</Button>
    </>}>
    {error && <p role="alert" className="mb-4 text-sm text-error">{error}</p>}
    <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
      {MAINTENANCE_RECORD_FIELDS.map(({ key, label, kind }) => <Field key={key} label={label} error={errors[key]} className={kind === "text" ? "sm:col-span-2" : undefined}>
        {kind === "text" ? <Textarea value={values[key]} onChange={(event) => setValues((old) => ({ ...old, [key]: event.target.value }))} /> :
          <Input type={kind} min={kind === "number" ? key === "serviceIntervalKm" ? 1 : 0 : undefined} step={kind === "number" ? 1 : undefined}
            value={values[key]} onChange={(event) => setValues((old) => ({ ...old, [key]: event.target.value }))} />}
      </Field>)}
    </fieldset>
  </SlideOver>;
}

export function BusMaintenanceHistory({ busId }: { busId: string }) {
  const history = useCollection<MaintenanceHistory>("tr_bus_maintenance_history", true, [["busId", "==", busId]]);
  if (history.error) return <div role="alert" className="mt-4 text-sm text-error">Could not load maintenance history. <Button variant="ghost" onClick={history.reload}>Retry</Button></div>;
  if (!history.ready) return <LoadingSkeleton variant="table" label="Loading maintenance history…" className="mt-4 text-sm" />;
  const entries = history.rows.filter((entry) => entry.busId === busId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <section aria-label="Maintenance history" className="mt-5 border-t border-outline-variant/50 pt-4">
    <h3 className="font-semibold">Maintenance history</h3>
    <p className="mt-1 text-xs text-on-surface-variant">History includes updates saved from now on.</p>
    {!entries.length ? <p className="mt-3 text-sm text-on-surface-variant">No maintenance updates recorded yet.</p> :
      <ol className="mt-3 max-h-96 space-y-4 overflow-y-auto">{entries.map((entry) => <li key={entry.id} className="rounded-lg border border-outline-variant/50 p-3 text-sm">
        <p className="font-medium">{new Date(entry.updatedAt).toLocaleString("en-IN")} · {entry.editor || entry.updatedBy}</p>
        <dl className="mt-2 space-y-2">{entry.changes.map((change) => <div key={change.field}>
          <dt className="text-xs text-on-surface-variant">{MAINTENANCE_RECORD_FIELDS.find(({ key }) => key === change.field)?.label ?? change.field}</dt>
          <dd className="whitespace-pre-line break-words">{change.before === null || change.before === "" ? "Not recorded" : change.before} → {change.after === null || change.after === "" ? "Cleared" : change.after}</dd>
        </div>)}</dl>
      </li>)}</ol>}
  </section>;
}
