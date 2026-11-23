"use client";
// /me/attendance: mark class attendance for one of the teacher's periods on a date, the way the teacher app does
// (`ops_attendance/{date}_{classId}_{period}`, marks hold only non-present students), plus own submitted records.
import { useMemo, useState } from "react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, LoadingSkeleton, PageHeader, Select, useToast } from "@/components/ui";
import type { AttRec, Mark } from "@/features/ops/logic";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, classRoster, todayIso, useTeachingData } from "../teaching";
import { MARKS, attendanceId, initialMarks, ownHistory, presentOf, saveError, slotKey, slotsForDate, teacherRecord, type Slot } from "./logic";

const ON: Record<Mark, string> = { P: "bg-success text-white border-success", A: "bg-error text-on-error border-error", L: "bg-warning text-white border-warning", E: "bg-secondary text-on-secondary border-secondary" };

export function MarkAttendance() {
  const toast = useToast();
  const data = useTeachingData();
  const att = useCollection<AttRec>("ops_attendance", data.teaching);
  const today = todayIso();
  const [date, setDate] = useState(today);
  const [slotId, setSlotId] = useState("");
  const slots = useMemo(() => slotsForDate(date, data.periods, data.subs), [date, data.periods, data.subs]);
  // a record opened from the history keeps its own slot even when that period is no longer on the timetable
  const opened = slotId ? att.rows.find((r) => r.teacherId === data.staffId && r.date === date && slotKey({ period: Number(r.period), classId: r.classId }) === slotId) : undefined;
  const slot: Slot | undefined = slots.find((s) => slotKey(s) === slotId) ?? (opened ? { period: Number(opened.period), classId: opened.classId, subject: "", kind: "period" } : slots[0]);
  const roster = slot ? classRoster(data.students, slot.classId) : [];
  const recId = slot ? attendanceId(date, slot.classId, slot.period) : "";
  const saved = att.rows.find((r) => r.id === recId);
  const foreign = !!saved && saved.teacherId !== data.staffId;

  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [dirty, setDirty] = useState(false);
  const sig = `${recId}|${JSON.stringify(saved?.marks ?? null)}|${roster.map((s) => s.id).join(",")}`;
  const [prevSig, setPrevSig] = useState("");
  if (sig !== prevSig) { setPrevSig(sig); setDirty(false); setMarks(initialMarks(roster, saved)); }

  const counts = { P: 0, A: 0, L: 0, E: 0 };
  roster.forEach((s) => { counts[marks[s.id] ?? "P"]++; });
  const setM = (id: string, m: Mark) => { setMarks((x) => ({ ...x, [id]: m })); setDirty(true); };
  const markAll = (m: Mark) => { setMarks(Object.fromEntries(roster.map((s) => [s.id, m]))); setDirty(true); };
  const [saving, setSaving] = useState(false);

  async function submit() {
    const why = saveError({ date, today, rosterSize: roster.length, slot, recordedBy: saved?.teacherId, staffId: data.staffId });
    if (why || !slot) { toast(why || "Pick a period", "error"); return; }
    setSaving(true);
    try {
      const cls = data.classOf(slot.classId);
      const body = teacherRecord({ date, classId: slot.classId, period: slot.period, rosterIds: roster.map((s) => s.id), marks, staffId: data.staffId, grade: cls?.grade, section: cls?.section });
      if (saved) await att.update(recId, body); else await att.create({ id: recId, ...body });
      setDirty(false);
      toast(`Attendance ${saved ? "updated" : "submitted"} · ${counts.P + counts.L}/${roster.length} present`);
    } catch { toast("Could not save attendance", "error"); } finally { setSaving(false); }
  }

  if (!data.teaching) return <EmptyState title="Only teachers have class attendance" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !att.ready) return <LoadingSkeleton variant="form" label="Loading attendance…" />;
  const history = ownHistory(att.rows, data.staffId);

  return <div className="space-y-5">
    <PageHeader title="Class attendance" subtitle="Mark one of your periods. Only non-present students are stored in the record." />
    <Card className="p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date"><Input type="date" value={date} max={today} onChange={(e) => { setDate(e.target.value); setSlotId(""); }} /></Field>
        <Field label="Period" hint={slots.length ? undefined : "You have no periods or substitutions on this day"}>
          <Select value={slot ? slotKey(slot) : ""} onChange={(e) => setSlotId(e.target.value)} disabled={!slots.length && !opened}>
            {slots.map((s) => <option key={slotKey(s)} value={slotKey(s)}>P{s.period} · {classIdLabel(s.classId)} · {s.subject || "—"}{s.kind === "sub" ? " (Substitution)" : ""}</option>)}
            {opened && !slots.some((s) => slotKey(s) === slotId) && <option value={slotId}>P{opened.period} · {classIdLabel(opened.classId)} · (recorded)</option>}
            {!slots.length && !opened && <option value="">No periods</option>}
          </Select>
        </Field>
      </div>
      {slot && <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{classIdLabel(slot.classId)} · Period {slot.period}</span>
        <span className="text-on-surface-variant">{roster.length} registered</span>
        {saved && !foreign && <Badge tone="success">Submitted · editable</Badge>}
        {foreign && <Badge tone="warning">Recorded by {data.staffName(saved!.teacherId ?? "")}</Badge>}
        {dirty && <Badge tone="info">Unsaved changes</Badge>}
      </div>}
    </Card>

    {slot && <Card>
      <CardHeader title="Roll" subtitle={`${counts.P} present · ${counts.A} absent · ${counts.L} late · ${counts.E} leave`}
        actions={<>
          <Button size="sm" variant="outline" disabled={foreign || !roster.length} onClick={() => markAll("P")}>Mark all present</Button>
          <Button size="sm" variant="outline" disabled={foreign || !roster.length} onClick={() => markAll("A")}>Mark all absent</Button>
        </>} />
      {foreign && <p role="alert" className="mx-5 mb-4 rounded-lg bg-warning-container/40 p-3 text-sm text-warning">Attendance already recorded by another teacher for this period. Contact the school office for corrections.</p>}
      {!roster.length ? <EmptyState title="No students in this class" /> : <ul className="divide-y divide-outline-variant/40 px-5 pb-5">
        {roster.map((s) => <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div className="min-w-0"><p className="font-medium">{s.name}</p><p className="text-xs text-on-surface-variant">Roll {s.roll ?? "—"}{s.grn ? ` · ${s.grn}` : ""}</p></div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Attendance for ${s.name}`}>
            {MARKS.map((o) => <button key={o.v} type="button" aria-pressed={(marks[s.id] ?? "P") === o.v} disabled={foreign} onClick={() => setM(s.id, o.v)}
              className={cn("h-8 cursor-pointer rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                (marks[s.id] ?? "P") === o.v ? ON[o.v] : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{o.label}</button>)}
          </div>
        </li>)}
      </ul>}
      <div className="flex justify-end border-t border-outline-variant/60 p-4">
        <Button onClick={submit} disabled={saving || foreign || !roster.length}>{saved ? "Update attendance" : "Submit attendance"}</Button>
      </div>
    </Card>}

    <Card>
      <CardHeader title="My submitted records" subtitle={history.length ? `${history.length} records` : "Nothing submitted yet"} />
      {history.length > 0 && <div className="overflow-x-auto px-5 pb-5">
        <table aria-label="Attendance history" className="w-full text-left text-sm">
          <thead className="text-xs text-on-surface-variant"><tr><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Class</th><th className="py-2 pr-3">Period</th><th className="py-2 pr-3">Present</th><th className="py-2 pr-3">Status</th><th className="py-2"></th></tr></thead>
          <tbody>{history.map((r) => <tr key={r.id} className="border-t border-outline-variant/40">
            <td className="py-2 pr-3 tabular-nums">{r.date}</td><td className="py-2 pr-3">{classIdLabel(r.classId)}</td><td className="py-2 pr-3">P{r.period}</td>
            <td className="py-2 pr-3 tabular-nums">{presentOf(r)}/{r.total}</td>
            <td className="py-2 pr-3">{r.submitted === false ? <Badge tone="neutral">Draft</Badge> : <Badge tone="success">Submitted</Badge>}</td>
            <td className="py-2 text-right"><Button size="sm" variant="ghost" onClick={() => { setDate(r.date); setSlotId(`${r.period}_${r.classId}`); }}>Open</Button></td>
          </tr>)}</tbody>
        </table>
      </div>}
    </Card>
  </div>;
}
