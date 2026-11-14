"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { Button, Field, Input, useToast } from "@/components/ui";
import { validNumberTemplate } from "@/features/admissions/numbering";
import { defaultEmployeeNumbering as defaults, formatEmployeeId, validGeneratedEmployeeId, type EmployeeNumbering } from "@/features/people/employeeNumbering";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

export function EmployeeNumberSettings() {
  const settings = useCollection<EmployeeNumbering>("set_config");
  const current: EmployeeNumbering = settings.rows.find((row) => row.id === defaults.id) ?? defaults;
  const [draft, setDraft] = useState<{ template: string; start: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const values = draft ?? { template: current.template, start: String(current.start) };
  const template = values.template.trim().toUpperCase();
  const start = Number(values.start);
  const preview = formatEmployeeId(template, Math.max(start || 1, current.next ?? 1));
  const valid = /^\d+$/.test(values.start) && Number.isSafeInteger(start) && start >= 1 && start < Number.MAX_SAFE_INTEGER &&
    validNumberTemplate(template) && validGeneratedEmployeeId(preview);

  async function save() {
    if (!valid) {
      setError("Enter a positive starting number and a pattern with one sequence token that produces an ID from 2 to 40 characters.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const ref = schoolDoc("set_config", defaults.id);
      await runTransaction(db, async (tx) => {
        const live = await tx.get(ref);
        const next = Math.max(start, live.get("next") ?? 1);
        if (!validGeneratedEmployeeId(formatEmployeeId(template, next))) {
          throw new Error("The employee ID is too long at the current sequence number.");
        }
        tx.set(ref, { id: defaults.id, template, start, ...stamp() }, { merge: true });
      });
      setDraft(undefined);
      toast("Employee ID numbering saved.");
    } catch (error) {
      setError(error instanceof Error && error.message.startsWith("The employee ID is too long")
        ? error.message : "Could not save employee ID numbering.");
    } finally {
      setBusy(false);
    }
  }

  return <fieldset disabled={!settings.ready || busy} className="grid gap-4 sm:grid-cols-2">
    <Field label="Employee ID pattern" hint="Use {YEAR} and {SEQ} or {SEQ:4}.">
      <Input maxLength={64} value={values.template} onChange={(event) => setDraft({ ...values, template: event.target.value })} />
    </Field>
    <Field label="Employee ID starting number" hint="The sequence continues from the next available number if that is higher.">
      <Input inputMode="numeric" value={values.start} onChange={(event) => setDraft({ ...values, start: event.target.value })} />
    </Field>
    <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-2">
      <p className="text-sm text-on-surface-variant">{valid ? `Preview · ${preview}` : "Enter a valid pattern to see a preview."}</p>
      <Button type="button" onClick={save}>{busy ? "Saving…" : "Save employee ID numbering"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-error sm:col-span-2">{error}</p>}
  </fieldset>;
}
