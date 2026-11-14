"use client";

import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { Button, Card, useToast } from "@/components/ui";
import { BellScheduleEditor } from "@/features/onboarding/BellScheduleEditor";
import { bellError, bellRecord, initialBell, toMin, type Bell } from "@/features/onboarding/bellSchedule";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { schoolDaySchedule, teachingPeriods, type ClassActivityConfig } from "./classActivity";

function formValue(saved?: ClassActivityConfig): Bell {
  if (saved && [saved.start, saved.end, saved.periodCount, saved.periodLength, saved.breaks].some((value) => value !== undefined))
    return initialBell({ gates: saved.gates, start: saved.start, end: saved.end, periods: saved.periodCount, len: saved.periodLength, breaks: saved.breaks ?? [] });
  // Preserve the legacy timetable's actual gaps and period lengths when first making them editable.
  const periods = teachingPeriods(schoolDaySchedule(saved));
  return { gates: saved?.gates && /^\d{2}:\d{2}$/.test(saved.gates) ? saved.gates : "07:45", start: periods[0].from, end: periods.at(-1)!.to,
    periods: periods.length, len: toMin(periods[0].to) - toMin(periods[0].from),
    breaks: periods.slice(1).flatMap((period, index) => {
      const previous = periods[index];
      const duration = toMin(period.from) - toMin(previous.to);
      return duration > 0 ? [{ name: duration >= 30 ? "Lunch" : "Morning break", start: previous.to, duration }] : [];
    }) };
}
const hours = (minutes: number) => Number.isFinite(minutes) && minutes >= 0 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : "Check timings";

// Firestore map key order can differ between listener and transaction reads.
// Compare the timing values in a fixed shape so unchanged breaks never look stale.
function timingValues(saved?: ClassActivityConfig) {
  return JSON.stringify({ gates: saved?.gates, start: saved?.start, end: saved?.end,
    periodCount: saved?.periodCount, periodLength: saved?.periodLength,
    breaks: saved?.breaks?.map(({ name, start, duration }) => ({ name, start, duration })) });
}

export function SchoolTimingSettings({ bell, ready }: { bell?: ClassActivityConfig; ready: boolean }) {
  const toast = useToast();
  const [draft, setDraft] = useState<Bell | null>(null);
  const [original, setOriginal] = useState<ClassActivityConfig>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (!draft || busy) return;
    const problem = bellError(draft);
    if (problem) { setError(problem); return; }
    setBusy(true); setError("");
    try {
      const ref = schoolDoc("set_config", "bell");
      await runTransaction(db, async (tx) => {
        const current = await tx.get(ref);
        if (current.exists() !== !!original || timingValues(current.data() as ClassActivityConfig | undefined) !== timingValues(original))
          throw new Error("School timings changed in another window. Cancel and reopen the editor to review them.");
        tx.set(ref, { id: "bell", ...bellRecord(draft), ...createStamp() }, { merge: true });
      });
      setDraft(null); toast("School timings saved. Timetables now use the updated bells.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save school timings. Try again."); }
    finally { setBusy(false); }
  }
  const schoolMinutes = draft ? toMin(draft.end) - toMin(draft.start) : 0;
  const teachingMinutes = draft ? draft.periods * draft.len : 0;
  const breakMinutes = draft?.breaks.reduce((sum, row) => sum + row.duration, 0) ?? 0;
  return <Card id="school-timings" className="mt-6 p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-lg font-semibold">School hours &amp; breaks</h2>
        <p className="mt-1 text-sm text-on-surface-variant">Set school hours, daily periods, lunch and other breaks. These timings apply to all classes.</p></div>
      {!draft && <Button variant="outline" disabled={!ready} onClick={() => { setOriginal(bell); setDraft(formValue(bell)); setError(""); }}>Edit school timings</Button>}
    </div>
    {draft && <div className="mt-5 space-y-5">
      <dl className="grid gap-3 rounded-lg bg-surface-container-low p-4 text-sm sm:grid-cols-4">
        {[["Total school hours", schoolMinutes], ["Teaching time", teachingMinutes], ["Break time", breakMinutes], ["Unallocated time", schoolMinutes - teachingMinutes - breakMinutes]].map(([label, minutes]) =>
          <div key={String(label)}><dt className="text-on-surface-variant">{label}</dt><dd className="mt-1 font-semibold">{hours(Number(minutes))}</dd></div>)}
      </dl>
      <BellScheduleEditor value={draft} onChange={(value) => { setDraft(value); setError(""); }} disabled={busy} />
      <p className="text-sm text-on-surface-variant">Saved lessons beyond a reduced period count are kept separately for review. Adjust or clear those lessons in the timetable.</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="ghost" disabled={busy} onClick={() => setDraft(null)}>Cancel timing changes</Button>
        <Button disabled={busy} onClick={() => { void save(); }}>{busy ? "Saving…" : "Save school timings"}</Button></div>
    </div>}
  </Card>;
}
