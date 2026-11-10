"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { Button, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { db } from "@/lib/firebase";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { useAdm } from "@/features/admissions/lib";
import { GRADES } from "@/features/admissions/types";

export function AdmissionSeatSettings() {
  const { ready, seatRows } = useAdm();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-4">
        <div><h3 className="font-semibold">Admissions seat capacity</h3><p className="text-sm text-on-surface-variant">Set seats for regular grades and streams. Manage custom course seats in Senior secondary courses above.</p></div>
        <Button size="sm" variant="outline" disabled={!ready} onClick={() => setOpen(true)}>Edit admissions seats</Button>
      </div>
      {open && <SeatEditor rows={seatRows} onClose={() => setOpen(false)} />}
    </>
  );
}

function SeatEditor({ rows, onClose }: { rows: ReturnType<typeof useAdm>["seatRows"]; onClose: () => void }) {
  const toast = useToast();
  const [grade, setGrade] = useState("");
  const [draft, setDraft] = useState<string>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cohort = GRADES.find((item) => item.id === grade);
  const row = rows.find((item) => item.grade === grade);
  const capacity = draft ?? (row ? String(row.capacity) : "");

  async function save() {
    if (busy || !cohort) return;
    const number = Number(capacity);
    if (!/^\d+$/.test(capacity.trim()) || !Number.isSafeInteger(number)) return setError("Enter a nonnegative whole number of seats.");
    const minimum = Math.max(row?.held ?? 0, row?.rteSeats ?? 0);
    if (number < minimum) return setError(`Capacity cannot be below ${minimum} occupied or reserved seats.`);
    setBusy(true);
    setError("");
    try {
      const ref = schoolDoc("adm_seats", row?.id ?? `adm_seat_${cohort.id.toLowerCase()}`);
      await runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        if (current.exists() !== !!row || (row && (
          current.get("capacity") !== row.capacity || (current.get("reservationRevision") ?? 0) !== (row.reservationRevision ?? 0)
        ))) throw new Error("Seat availability changed. Reopen this editor and try again.");
        tx.set(ref, { id: ref.id, grade: cohort.id, group: cohort.group, capacity: number,
          ...(!row ? { rteSeats: 0, block: "" } : {}), ...createStamp() }, { merge: true });
      });
      toast("Admissions capacity saved");
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save capacity."); }
    finally { setBusy(false); }
  }

  return (
    <Modal open onClose={() => { if (!busy) onClose(); }} title="Edit admissions seats"
      footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !cohort} onClick={save}>{busy ? "Saving…" : "Save capacity"}</Button></>}>
      <div className="grid gap-4">
        <Field label="Grade or stream"><Select value={grade} disabled={busy} onChange={(event) => { setGrade(event.target.value); setDraft(undefined); setError(""); }}>
          <option value="">Choose a grade or stream</option>{GRADES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </Select></Field>
        {cohort && <Field label="Capacity" error={error} hint={row ? `${row.held} seats occupied or reserved` : "No capacity set yet"}><Input type="number" min={0} disabled={busy} value={capacity} onChange={(event) => setDraft(event.target.value)} /></Field>}
      </div>
    </Modal>
  );
}
