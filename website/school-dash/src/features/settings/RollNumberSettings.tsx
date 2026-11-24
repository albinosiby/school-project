"use client";

import { useMemo, useState } from "react";
import { increment, writeBatch } from "firebase/firestore";
import { Button, Modal, Switch, useToast } from "@/components/ui";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { alphabeticalPlan, DEFAULT_ROLLS, missingRolls, rollsAuto, type DivisionPlan, type RollClass, type RollSettings, type RollStudent } from "./rollNumbers";

const CHUNK = 400; // Firestore batches take 500 writes; keep room for the class revision bumps

/**
 * Settings → Classes & Sections → Roll numbers: the automatic-assignment switch (set_config/rolls) and
 * "Number all classes", which renumbers every division 1..n in name order for the current academic year.
 */
export function RollNumberSettings({ academicYear }: { academicYear: string }) {
  const cfg = useCollection<RollSettings>("set_config");
  const students = useCollection<RollStudent>("students");
  const classes = useCollection<RollClass>("classes");
  const toast = useToast();
  const saved = cfg.rows.find((row) => row.id === "rolls");
  const auto = rollsAuto(saved ?? DEFAULT_ROLLS);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const plans = useMemo(() => alphabeticalPlan(students.rows, classes.rows, academicYear), [students.rows, classes.rows, academicYear]);
  const total = plans.reduce((n, p) => n + p.rows.length, 0);
  const changed = plans.reduce((n, p) => n + p.changed, 0);
  const missing = missingRolls(students.rows, academicYear);

  async function setAuto(next: boolean) {
    setBusy(true);
    try {
      if (saved) await cfg.update("rolls", { auto: next });
      else await cfg.create({ id: "rolls", auto: next });
      toast(next ? "New students get the next roll number automatically" : "Roll numbers are now allotted manually");
    } catch { toast("Could not save the roll number setting", "error"); } finally { setBusy(false); }
  }

  async function numberAll(plan: DivisionPlan[]) {
    setBusy(true); setError("");
    try {
      const rows = plan.flatMap((p) => p.rows.filter((r) => r.previous !== r.roll).map((r) => ({ ...r, classId: p.classId })));
      for (let i = 0; i < rows.length; i += CHUNK) {
        const batch = writeBatch(db);
        const touched = new Set<string>();
        for (const r of rows.slice(i, i + CHUNK)) {
          batch.update(schoolDoc("students", r.id), { roll: r.roll, rollAcademicYear: academicYear, ...stamp() });
          touched.add(r.classId);
        }
        for (const classId of touched) batch.update(schoolDoc("classes", classId), { rollRevision: increment(1), ...stamp() });
        await batch.commit();
      }
      toast(`Roll numbers assigned to ${rows.length} students in ${plan.filter((p) => p.changed).length} classes`);
      setOpen(false);
    } catch (cause) { setError("Could not assign roll numbers: " + (cause instanceof Error ? cause.message : "Unknown error")); } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-4">
      <div className="min-w-0">
        <p className="font-medium">Assign automatically</p>
        <p className="text-sm text-on-surface-variant">A division without roll numbers is numbered 1 to n in name order. A student who joins a numbered division gets the next number, so nobody else&apos;s roll changes mid-year.</p>
      </div>
      <Switch checked={auto} onChange={setAuto} label="Assign roll numbers automatically" />
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-on-surface-variant">
        {students.ready && classes.ready ? <>{plans.length} {plans.length === 1 ? "class" : "classes"} · {total} students · {missing ? <span className="font-semibold text-warning">{missing} without a roll number</span> : "every student has a roll number"}{changed && !missing ? ` · ${changed} out of name order` : ""}</> : "Loading roster…"}
      </p>
      <Button variant="outline" disabled={busy || !students.ready || !classes.ready || !plans.length} onClick={() => setOpen(true)}>Number all classes alphabetically</Button>
    </div>
    <Modal open={open} onClose={() => { if (!busy) setOpen(false); }} title="Number all classes alphabetically" subtitle={`${total} students in ${plans.length} classes${academicYear ? ` · ${academicYear}` : ""}`}
      footer={<><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
        <Button disabled={busy || !changed} onClick={() => numberAll(plans)}>{busy ? "Assigning…" : changed ? `Assign ${changed} roll number${changed === 1 ? "" : "s"}` : "Already in order"}</Button></>}>
      <p className="mb-3 text-sm text-on-surface-variant">Every division is renumbered 1 to n by name. Attendance and marks already recorded keep their student links; printed registers and hall tickets from before today show the old numbers.</p>
      <div className="max-h-72 overflow-y-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left text-sm">
        <thead className="bg-surface-container-low text-xs text-on-surface-variant"><tr><th className="p-2">Class</th><th className="p-2">Students</th><th className="p-2">Changes</th><th className="p-2">First · last</th></tr></thead>
        <tbody>{plans.map((p) => <tr key={p.classId} className="border-t border-outline-variant/40"><td className="p-2 font-semibold">{p.label}</td><td className="p-2 font-mono">{p.rows.length}</td><td className="p-2">{p.changed || "In order"}</td><td className="p-2 text-on-surface-variant">{p.rows[0]?.name} · {p.rows.at(-1)?.name}</td></tr>)}</tbody>
      </table></div>
      {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
    </Modal>
  </div>;
}
