"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { LoadingSkeleton, Button, Field, Input, useToast } from "@/components/ui";
import { db } from "@/lib/firebase";
import { attendanceThresholdInput, minimumAttendance, type AttendancePolicy } from "@/lib/attendancePolicy";
import { useCollection } from "@/lib/useCollection";
import { schoolDoc, stamp } from "@/features/transport/shared";

export function AttendancePolicySettings() {
  const settings = useCollection<AttendancePolicy>("set_config");
  if (settings.error) return <div role="alert"><p>Could not load attendance settings.</p><Button variant="outline" onClick={settings.reload}>Retry</Button></div>;
  if (!settings.ready) return <LoadingSkeleton variant="form" label="Loading attendance settings…" />;
  return <AttendancePolicyForm policy={settings.rows.find((row) => row.id === "attendance_policy")} />;
}

function AttendancePolicyForm({ policy }: { policy?: AttendancePolicy }) {
  const toast = useToast();
  const [original, setOriginal] = useState(policy?.minimumPercent ?? null);
  const [input, setInput] = useState(String(minimumAttendance(original)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  async function save() {
    if (saving) return;
    const value = attendanceThresholdInput(input);
    if (value === undefined) { setError("Enter a percentage from 0 to 100."); return; }
    setSaving(true); setError(""); setConflict(false);
    try {
      const ref = schoolDoc("set_config", "attendance_policy");
      await runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        if ((current.get("minimumPercent") ?? null) !== original) {
          const cause = new Error("Attendance settings changed in another window. Reload the saved value before saving.");
          cause.name = "AttendancePolicyConflict";
          throw cause;
        }
        const patch = { minimumPercent: value, ...stamp() };
        if (current.exists()) tx.update(ref, patch); else tx.set(ref, { id: "attendance_policy", ...patch });
      });
      setOriginal(value); setInput(String(value)); toast("Attendance settings saved");
    } catch (cause) {
      setConflict(cause instanceof Error && cause.name === "AttendancePolicyConflict");
      setError(cause instanceof Error ? cause.message : "Could not save attendance settings.");
    }
    finally { setSaving(false); }
  }
  return <div className="mt-5 border-t border-outline-variant/60 pt-5">
    <h3 className="font-semibold">Attendance requirement</h3>
    <p className="mt-1 text-sm text-on-surface-variant">Set the school-wide minimum used for attendance warnings and report checks.</p>
    <div className="mt-4 max-w-sm"><Field label="Minimum attendance (%)" error={error} hint="Enter 0–100. Students below this percentage are flagged for follow-up.">
      <Input type="number" min="0" max="100" step="any" inputMode="decimal" value={input} disabled={saving}
        onChange={(event) => { setInput(event.target.value); setError(""); }} />
    </Field></div>
    <div className="mt-4 flex flex-wrap gap-2">
      <Button disabled={saving || (original !== null && Number(input) === original && input.trim() !== "")} onClick={save}>{saving ? "Saving…" : "Save attendance settings"}</Button>
      {conflict && <Button variant="outline" disabled={saving} onClick={() => {
        setOriginal(policy?.minimumPercent ?? null); setInput(String(minimumAttendance(policy?.minimumPercent))); setConflict(false); setError("");
      }}>Reload saved value</Button>}
    </div>
  </div>;
}
