"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { Button, Field, Input, Select, useToast } from "@/components/ui";
import { defaultNumbering, formatAdmissionNumber, validAdmissionNumber, validNumberTemplate, type AdmissionNumbering } from "@/features/admissions/numbering";
import { useToday } from "@/features/admissions/lib";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";

export function AdmissionNumberSettings() {
  const settings = useCollection<AdmissionNumbering>("adm_config");
  const current = settings.rows.find((row) => row.id === "numbering") ?? defaultNumbering;
  const [draft, setDraft] = useState<Pick<AdmissionNumbering, "mode" | "template"> & { start: string }>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();
  const today = useToday();
  const values = draft ?? { mode: current.mode, template: current.template, start: String(current.start) };
  const preview = formatAdmissionNumber(values.template.trim(), today, Math.max(Number(values.start) || 1, current.next ?? 1));

  async function save() {
    const start = Number(values.start);
    const template = values.template.trim();
    if (!/^\d+$/.test(values.start) || !Number.isSafeInteger(start) || start < 1 || !validNumberTemplate(template) || !validAdmissionNumber(preview)) {
      setError("Enter a positive starting number and a valid template containing one sequence token.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const ref = schoolDoc("adm_config", "numbering");
      await runTransaction(db, async (tx) => {
        const live = await tx.get(ref);
        const next = live.get("next") as number | undefined;
        tx.set(ref, { id: ref.id, mode: values.mode, template, start, ...(next ? { next } : {}), ...stamp() });
      });
      setDraft(undefined);
      toast("Admission numbering saved");
    } catch {
      setError("Could not save admission numbering.");
    } finally { setBusy(false); }
  }

  return <fieldset disabled={!settings.ready || busy} className="grid gap-4 sm:grid-cols-3">
    <Field label="Number assignment"><Select value={values.mode} onChange={(e) => setDraft({ ...values, mode: e.target.value as AdmissionNumbering["mode"] })}>
      <option value="automatic">Automatic</option><option value="manual">Manual</option>
    </Select></Field>
    <Field label="Number template" hint="Use {YEAR} and {SEQ} or {SEQ:4}."><Input maxLength={64} value={values.template} onChange={(e) => setDraft({ ...values, template: e.target.value })} /></Field>
    <Field label="Starting number"><Input inputMode="numeric" value={values.start} onChange={(e) => setDraft({ ...values, start: e.target.value })} /></Field>
    <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
      <p className="text-sm text-on-surface-variant">{values.mode === "manual" ? "Staff enter a unique number on each admission." : `Preview · ${preview}`}</p>
      <Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save admission numbering"}</Button>
    </div>
    {error && <p role="alert" className="text-sm text-error sm:col-span-3">{error}</p>}
  </fieldset>;
}
