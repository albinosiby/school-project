"use client";

import { useState } from "react";
import { LoadingSkeleton, Button, Field, Input, Select, SlideOver } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { COMPLIANCE_FIELDS } from "./vehicleDetails";
import { PERMIT_TYPES, type Bus } from "./types";
import { complianceValues, validateCompliance, type ComplianceHistory, type ComplianceKey } from "./complianceRecords";

export function BusComplianceEditor({ bus, onSave, onClose }: {
  bus: Bus; onSave: (snapshot: Bus, patch: Partial<Bus>) => Promise<void>; onClose: () => void;
}) {
  const [snapshot] = useState(bus);
  const [values, setValues] = useState(() => complianceValues(bus));
  const [errors, setErrors] = useState<Partial<Record<ComplianceKey, string>>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving) return;
    const problems = validateCompliance(values);
    setErrors(problems);
    if (Object.keys(problems).length) return;
    setError(""); setSaving(true);
    try { await onSave(snapshot, Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]))); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not update compliance details."); }
    finally { setSaving(false); }
  }
  return <SlideOver open title="Update registration and compliance" subtitle="Save renewed documents and registration details. Changes are recorded in history."
    onClose={() => { if (!saving) onClose(); }} width="max-w-2xl" footer={<>
      <Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save update"}</Button></>}>
    {error && <p role="alert" className="mb-4 text-sm text-error">{error}</p>}
    <fieldset disabled={saving} className="grid gap-4 sm:grid-cols-2">
      {COMPLIANCE_FIELDS.map(({ key, label, kind }) => <Field key={key} label={label} error={errors[key]}>
        {kind === "select" ? <Select value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}>
          <option value="">Not specified</option>{PERMIT_TYPES.map((value) => <option key={value}>{value}</option>)}
          {values[key] && !(PERMIT_TYPES as readonly string[]).includes(values[key]) && <option>{values[key]}</option>}
        </Select> : <Input type={kind} value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))} />}
      </Field>)}
    </fieldset>
  </SlideOver>;
}

export function BusComplianceHistory({ busId }: { busId: string }) {
  const history = useCollection<ComplianceHistory>("tr_bus_compliance_history", true, [["busId", "==", busId]]);
  if (history.error) return <div role="alert" className="mt-4 text-sm text-error">Could not load compliance history. <Button variant="ghost" onClick={history.reload}>Retry</Button></div>;
  if (!history.ready) return <LoadingSkeleton variant="table" label="Loading compliance history…" className="mt-4 text-sm" />;
  const entries = history.rows.filter((entry) => entry.busId === busId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <section aria-label="Compliance history" className="mt-5 border-t border-outline-variant/50 pt-4">
    <h3 className="font-semibold">Compliance history</h3>
    <p className="mt-1 text-xs text-on-surface-variant">History includes updates saved from now on.</p>
    {!entries.length ? <p className="mt-3 text-sm text-on-surface-variant">No compliance updates recorded yet.</p> :
      <ol className="mt-3 max-h-96 space-y-4 overflow-y-auto">{entries.map((entry) => <li key={entry.id} className="rounded-lg border border-outline-variant/50 p-3 text-sm">
        <p className="font-medium">{new Date(entry.updatedAt).toLocaleString("en-IN")} · {entry.editor || entry.updatedBy}</p>
        <dl className="mt-2 space-y-2">{entry.changes.map((change) => <div key={change.field}>
          <dt className="text-xs text-on-surface-variant">{COMPLIANCE_FIELDS.find(({ key }) => key === change.field)?.label ?? change.field}</dt>
          <dd className="break-words">{change.before || "Not recorded"} → {change.after || "Cleared"}</dd>
        </div>)}</dl>
      </li>)}</ol>}
  </section>;
}
