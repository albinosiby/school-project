"use client";
import { useState } from "react";
import { Button, Field, Input, Select, Textarea } from "@/components/ui";
import { isEmail, isPhone } from "./lib";
import type { FormField, FormSection } from "./types";

export function FieldInput({ f, value, onChange, disabled }: { f: FormField; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const common = { disabled, placeholder: f.placeholder, "aria-label": f.label };
  switch (f.type) {
    case "radio":
      return <div role="radiogroup" aria-label={f.label} className="flex flex-wrap gap-2">{(f.options ?? []).map((o) => (
        <button type="button" key={o} role="radio" aria-checked={value === o} disabled={disabled} onClick={() => onChange(o)}
          className={`cursor-pointer rounded border px-3 py-1.5 text-sm ${value === o ? "border-secondary bg-info-container font-semibold text-secondary" : "border-outline-variant"}`}>{o}</button>))}</div>;
    case "select":
      return <Select {...common} value={value} onChange={(e) => onChange(e.target.value)}><option value="">Select…</option>{(f.options ?? []).map((o) => <option key={o}>{o}</option>)}</Select>;
    case "textarea": return <Textarea {...common} value={value} onChange={(e) => onChange(e.target.value)} />;
    case "date": return <Input {...common} type="date" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "number": return <Input {...common} type="number" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "email": return <Input {...common} type="email" value={value} onChange={(e) => onChange(e.target.value)} />;
    case "tel": return <Input {...common} type="tel" inputMode="tel" value={value} onChange={(e) => onChange(e.target.value)} />;
    default: return <Input {...common} value={value} onChange={(e) => onChange(e.target.value)} />;
  }
}

/** Renders the builder schema as a working form. In `preview` mode inputs are editable but nothing is submitted. */
export function DynamicForm({ sections, onSubmit, preview, submitLabel = "Submit enquiry" }: {
  sections: FormSection[]; onSubmit?: (v: Record<string, string>) => Promise<void> | void; preview?: boolean; submitLabel?: string;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [formErr, setFormErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (preview) return;
    const er: Record<string, string> = {};
    for (const s of sections) for (const f of s.fields) {
      const val = (v[f.key] ?? "").trim();
      if (f.required && !val) er[f.key] = `${f.label} is required`;
      else if (val && f.type === "tel" && !isPhone(val)) er[f.key] = "Enter a valid mobile number";
      else if (val && f.type === "email" && !isEmail(val)) er[f.key] = "Enter a valid email address";
      else if (val && f.key === "aadhaar" && !/^\d{12}$/.test(val.replace(/\s/g, ""))) er[f.key] = "Aadhaar must be 12 digits";
      else if (val && f.type === "date" && new Date(val) > new Date()) er[f.key] = "Date cannot be in the future";
    }
    setErr(er);
    if (Object.keys(er).length) return;
    setBusy(true); setFormErr("");
    // surface failures (network, cap reached, duplicate) instead of an unhandled rejection
    try { await onSubmit?.(v); setV({}); } catch (x) { setFormErr((x as Error)?.message || "Could not submit — please try again"); } finally { setBusy(false); }
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {sections.map((s) => (
        <fieldset key={s.id} className="space-y-4">
          <legend className="t-label-caps w-full border-b border-outline-variant/60 pb-2">{s.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {s.fields.map((f) => (
              <div key={f.id} className={f.type === "textarea" || f.type === "radio" ? "sm:col-span-2" : ""}>
                <Field label={f.label} required={f.required} error={err[f.key]} hint={f.rule}>
                  <FieldInput f={f} value={v[f.key] ?? ""} onChange={(x) => setV((p) => ({ ...p, [f.key]: x }))} />
                </Field>
              </div>))}
          </div>
        </fieldset>))}
      {formErr && <p role="alert" className="rounded bg-error-container px-3 py-2 text-sm text-on-error-container">{formErr}</p>}
      <Button type="submit" disabled={busy || preview} className="w-full">{preview ? "Submit (disabled in preview)" : submitLabel}</Button>
    </form>
  );
}
