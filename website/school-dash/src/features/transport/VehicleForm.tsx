"use client";

import { useState, type ReactNode } from "react";
import { Button, Field, Input, Select, SlideOver, Textarea } from "@/components/ui";
import { todayIso } from "@/features/ops/shared";
import { busLabel } from "./shared";
import { FUEL_TYPES, PERMIT_TYPES, VEHICLE_TYPES, type Bus } from "./types";
import { COMPLIANCE_FIELDS, EQUIPMENT_FIELDS, MAINTENANCE_FIELDS, validateVehicle, vehicleInput, type VehicleInput } from "./vehicleDetails";

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return <section className="space-y-3 rounded-lg border border-outline-variant/60 p-4">
    <h3 className="font-semibold">{title}</h3>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>;
}

type VehicleValues = NonNullable<ReturnType<typeof validateVehicle>["values"]>;

export function VehicleForm({ bus, existing, assigned, onSave, onClose }: {
  bus?: Bus; existing: Bus[]; assigned: number;
  onSave: (values: VehicleValues) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState(() => vehicleInput(bus));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const set = (key: keyof VehicleInput, value: string) => setForm((old) => ({ ...old, [key]: value }));
  const input = (key: keyof VehicleInput, label: string, kind = "text", required = false) => (
    <Field key={key} label={label} required={required} error={errors[key]}>
      <Input type={kind} value={form[key]} onChange={(event) => set(key, event.target.value)} />
    </Field>
  );
  const select = (key: keyof VehicleInput, label: string, options: readonly string[], required = false) => (
    <Field key={key} label={label} required={required} error={errors[key]}>
      <Select value={form[key]} onChange={(event) => set(key, event.target.value)}>
        <option value="">{required ? "Select…" : "Not specified"}</option>
        {options.map((value) => <option key={value}>{value}</option>)}
        {form[key] && !options.includes(form[key]) && <option>{form[key]}</option>}
      </Select>
    </Field>
  );

  async function submit() {
    if (saving) return;
    setSaveError("");
    const result = validateVehicle(form, existing, Number(todayIso().slice(0, 4)), bus, assigned);
    setErrors(result.errors);
    if (!result.values) return;
    setSaving(true);
    try { await onSave(result.values); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save the bus."); }
    finally { setSaving(false); }
  }

  return <SlideOver open title={bus ? `Vehicle details · ${busLabel(bus)}` : "Add Bus"} subtitle="Vehicle details, compliance and seating"
    width="max-w-2xl" onClose={() => { if (!saving) onClose(); }}
    footer={<><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving} onClick={submit}>{saving ? "Saving…" : bus ? "Save vehicle details" : "Add Bus"}</Button></>}>
    {saveError && <p role="alert" className="mb-4 text-sm text-error">{saveError}</p>}
    <fieldset disabled={saving} className="min-w-0 space-y-4">
      <FormSection title="Vehicle details">
        <Field label="Bus ID"><Input value={bus?.id ?? "Generated when saved"} readOnly /></Field>
        {input("number", "Bus number / Fleet number", "text", true)}
        {input("regNo", "Registration number", "text", true)}
        {input("displayName", "Bus name / Display name")}
        {select("vehicleType", "Vehicle type", VEHICLE_TYPES, true)}
        {input("model", "Model", "text", true)}
        {input("manufacturingYear", "Manufacturing year", "number", true)}
        {input("chassisNumber", "Chassis number", "text", true)}
        {input("engineNumber", "Engine number", "text", true)}
        {select("fuelType", "Fuel type", FUEL_TYPES, true)}
      </FormSection>
      <FormSection title="Route">
        {input("endPoint", "End-point location", "text", true)}
      </FormSection>
      <FormSection title="Seating and equipment">
        {input("totalSeats", "Total seating capacity", "number", true)}
        {input("capacity", "Student seating capacity", "number", true)}
        {EQUIPMENT_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            <Select value={form[key]} onChange={(event) => set(key, event.target.value)}>
              <option value="no">No</option><option value="yes">Yes</option>
            </Select>
          </Field>
        ))}
      </FormSection>
      <FormSection title="Registration and compliance">
        {COMPLIANCE_FIELDS.map(({ key, label, kind }) =>
          kind === "select" ? select(key, label, PERMIT_TYPES) : input(key, label, kind))}
      </FormSection>
      <FormSection title="Maintenance">
        {MAINTENANCE_FIELDS.map(({ key, label, kind }) => input(key, label, kind))}
        <Field label="Maintenance notes" className="sm:col-span-2">
          <Textarea value={form.maintenanceNotes} onChange={(event) => set("maintenanceNotes", event.target.value)} />
        </Field>
      </FormSection>
    </fieldset>
  </SlideOver>;
}
