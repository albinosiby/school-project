"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { LoadingSkeleton, Button, Card, Field, Select, useToast } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { FEE_FREQUENCIES, type FeeFrequency } from "@/features/fees/feePlan";
import { schoolDoc, stamp } from "@/features/transport/shared";

type Policy = { id: string; transportFrequency?: FeeFrequency | "" };

export function PaymentSettings() {
  const settings = useCollection<Policy>("set_config");
  if (settings.error) return <Card><p role="alert">Could not load payment settings.</p><Button onClick={settings.reload}>Retry</Button></Card>;
  if (!settings.ready) return <LoadingSkeleton variant="form" label="Loading payment settings…" />;
  return <PaymentForm policy={settings.rows.find((row) => row.id === "fee_policy")} />;
}

function PaymentForm({ policy }: { policy?: Policy }) {
  const toast = useToast();
  const [original, setOriginal] = useState(policy?.transportFrequency ?? "");
  const [frequency, setFrequency] = useState<FeeFrequency | "">(original);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      const ref = schoolDoc("set_config", "fee_policy");
      await runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        if ((current.get("transportFrequency") ?? "") !== original) throw new Error("Transport collection frequency changed in another window. Reopen Payments to review it.");
        const patch = { transportFrequency: frequency, ...stamp() };
        if (current.exists()) tx.update(ref, patch); else tx.set(ref, { id: "fee_policy", ...patch });
      });
      setOriginal(frequency); toast("Payment settings saved");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save payment settings."); }
    finally { setSaving(false); }
  }
  return <Card className="p-5">
    <h2 className="text-lg font-semibold">Transport payments</h2>
    <p className="mt-1 text-sm text-on-surface-variant">Set each student’s amount during bus assignment or in Student details → Transport. Choose how often that amount is collected here.</p>
    <div className="mt-5 max-w-md">
      <Field label="Transport collection frequency" hint="Saving this setting does not create invoices or charge families.">
        <Select disabled={saving} value={frequency} onChange={(event) => { setFrequency(event.target.value as FeeFrequency | ""); setError(""); }}>
          <option value="">Not configured</option>{FEE_FREQUENCIES.map((value) => <option key={value}>{value}</option>)}
        </Select>
      </Field>
    </div>
    {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    <Button className="mt-4" disabled={saving || frequency === original} onClick={save}>{saving ? "Saving…" : "Save payment settings"}</Button>
  </Card>;
}
