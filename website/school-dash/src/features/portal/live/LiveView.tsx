"use client";
// Staff portal › Live classes: the teacher's own live_classes (client-filtered by teacherId, soft-deleted ones hidden),
// scheduling a new Google Meet session with the fields the teacher app's LiveClassesAdapter writes, cancelling
// (deleted: true, status: "cancelled") and join counts from the live_classes/{id}/joins subcollection.
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { classIdLabel } from "@/lib/academicStreams";
import { liveCancelPatch, liveClassDoc, liveFormErrors, livePhase, myClassIds, subjectsFor, today, type LiveClassDoc, type LiveForm, type LivePhase } from "../exams";

type Teaching = { id: string; teacherId?: string; classId?: string; subject?: string };

/** live join counts: `live_classes/{id}/joins` has one doc per member who tapped Join (teachers may read it) */
function useJoinCounts(schoolId: string, key: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!schoolId || !key) return;
    const ids = key.split("\0");
    const stops = ids.map((id) => onSnapshot(collection(db, "schools", schoolId, "live_classes", id, "joins"),
      (snap) => setCounts((c) => (c[id] === snap.size ? c : { ...c, [id]: snap.size })), () => {}));
    return () => stops.forEach((stop) => stop());
  }, [schoolId, key]);
  return counts;
}

const phaseBadge = (phase: LivePhase) => phase === "open" ? <Badge tone="success">Live now</Badge> : phase === "ended" ? <Badge tone="neutral">Ended</Badge>
  : phase === "cancelled" ? <Badge tone="danger">Cancelled</Badge> : <Badge tone="brand">Scheduled</Badge>;

const blankForm = (classId = ""): LiveForm => ({ classId, subject: "", title: "", date: today(), time: "16:30", mins: 45, link: "" });

export function LiveView() {
  const toast = useToast();
  const { user } = useAuth();
  const { staffId, teaching } = useStaffProfile();
  const live = useCollection<LiveClassDoc>("live_classes", teaching);
  const classes = useCollection<{ id: string; grade?: string; section?: string; classTeacherId?: string }>("classes", teaching);
  const assignments = useCollection<Teaching>("assignments", teaching, [["teacherId", "==", staffId]]);
  const periods = useCollection<Teaching>("ops_periods", teaching, [["teacherId", "==", staffId]]);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const [form, setForm] = useState<LiveForm | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof LiveForm, string>>>({});
  const [busy, setBusy] = useState(false);
  const mine = live.rows.filter((r) => r.teacherId === staffId && !r.deleted).sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
  const joins = useJoinCounts(user?.schoolId ?? "", mine.map((r) => r.id).join("\0"));
  if (!teaching) return <EmptyState title="Only teachers schedule live classes" hint="Live classes are run by teaching staff for their classes." />;

  const now = new Date();
  const withPhase = mine.map((r) => ({ row: r, phase: livePhase(r, now) }));
  const shown = withPhase.filter(({ phase }) => (tab === "upcoming" ? phase === "scheduled" || phase === "open" : phase === "ended" || phase === "cancelled"));
  const classIds = myClassIds(staffId, assignments.rows, periods.rows, classes.rows);
  const subjects = form ? subjectsFor(form.classId, staffId, assignments.rows, periods.rows) : [];

  const openForm = () => { setErrors({}); setForm(blankForm(classIds[0] ?? "")); };
  const set = (patch: Partial<LiveForm>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const save = async () => {
    if (!form) return;
    const next = liveFormErrors(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await live.create({ ...liveClassDoc(form, `Class ${classIdLabel(form.classId)}`, new Date().toISOString()), teacherId: staffId } as unknown as Omit<LiveClassDoc, "id">);
      toast("Live class scheduled");
      setForm(null);
    } catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not schedule the class", "error"); }
    finally { setBusy(false); }
  };
  const cancel = async (row: LiveClassDoc) => {
    if (!window.confirm(`Cancel "${row.title}"? Students and parents will no longer see it.`)) return;
    try { await live.update(row.id, liveCancelPatch()); toast("Live class cancelled"); }
    catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not cancel the class", "error"); }
  };

  return <div className="space-y-5">
    <PageHeader title="Live classes" subtitle="Schedule Google Meet sessions for your classes; students and parents get the link in their app."
      actions={<Button onClick={openForm}>Schedule live class</Button>} />
    <Tabs items={[{ id: "upcoming", label: "Upcoming" }, { id: "past", label: "Past" }]} value={tab} onChange={(id) => setTab(id as typeof tab)} />
    {!live.ready ? <p className="text-on-surface-variant">Loading…</p>
      : !shown.length ? <EmptyState title={tab === "upcoming" ? "No upcoming live classes" : "No past live classes"} hint={tab === "upcoming" ? "Schedule one to share a Google Meet link with a class." : undefined} />
      : <div className="grid gap-3 md:grid-cols-2">
        {shown.map(({ row, phase }) => <Card key={row.id} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0"><p className="font-semibold">{row.title}</p><p className="text-xs text-on-surface-variant">{row.audience || `Class ${classIdLabel(row.classId)}`}{row.subject ? ` · ${row.subject}` : ""}</p></div>
            {phaseBadge(phase)}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <dt className="text-on-surface-variant">When</dt><dd>{row.date} {row.time} · {row.mins} min</dd>
            <dt className="text-on-surface-variant">Joined</dt><dd aria-label={`Joined ${row.title}`}>{Math.max(joins[row.id] ?? 0, row.joined ?? 0)}</dd>
            <dt className="text-on-surface-variant">Link</dt><dd className="truncate">{row.link ? <a href={row.link} target="_blank" rel="noreferrer" className="text-secondary hover:underline">{row.link}</a> : "In-app room"}</dd>
          </dl>
          {(phase === "scheduled" || phase === "open") && <div className="mt-3 flex justify-end">
            <Button size="sm" variant="danger" aria-label={`Cancel ${row.title}`} onClick={() => cancel(row)}>Cancel</Button>
          </div>}
        </Card>)}
      </div>}
    <Modal open={!!form} onClose={() => setForm(null)} title="Schedule live class" subtitle="A Google Meet session for one of your classes"
      footer={<><Button variant="ghost" onClick={() => setForm(null)}>Close</Button><Button onClick={save} disabled={busy}>Schedule</Button></>}>
      {form && <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Class" required error={errors.classId}>
          <Select value={form.classId} onChange={(e) => set({ classId: e.target.value, subject: "" })}>
            <option value="">Select class</option>{classIds.map((id) => <option key={id} value={id}>{classIdLabel(id)}</option>)}
          </Select>
        </Field>
        <Field label="Subject" required error={errors.subject} hint={form.classId && !subjects.length ? "No subject of yours is assigned to this class" : undefined}>
          <Select value={form.subject} onChange={(e) => set({ subject: e.target.value })}>
            <option value="">Select subject</option>{subjects.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
        <Field label="Title" required error={errors.title} className="sm:col-span-2"><Input value={form.title} maxLength={200} placeholder="e.g. Quadratic equations — doubt clearing" onChange={(e) => set({ title: e.target.value })} /></Field>
        <Field label="Date" required error={errors.date}><Input type="date" value={form.date} onChange={(e) => set({ date: e.target.value })} /></Field>
        <Field label="Start time" required error={errors.time}><Input type="time" value={form.time} onChange={(e) => set({ time: e.target.value })} /></Field>
        <Field label="Duration (minutes)" required error={errors.mins}><Input type="number" min={5} max={480} value={form.mins} onChange={(e) => set({ mins: Number(e.target.value) })} /></Field>
        <Field label="Google Meet link" required error={errors.link} hint="Create the meeting in Google Meet and paste its link here"><Input value={form.link} placeholder="https://meet.google.com/abc-defg-hij" onChange={(e) => set({ link: e.target.value })} /></Field>
      </div>}
    </Modal>
  </div>;
}
