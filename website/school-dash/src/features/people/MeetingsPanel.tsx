"use client";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Avatar, Badge, Button, Card, Checkbox, DataTable, EmptyState, Field, Input, Modal, Select, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { ReasonModal } from "@/features/dashboard/approvals-shared";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { buildSlots, validMeetLink, type SlotDoc, type SlotForm } from "./studentLogic";

/** Parent-teacher meetings (data contract 13.7): the office publishes slots per teacher, parents book them in the parent app. */
type Slot = { id: string; teacherId: string; teacher: string; start: string; startMs: number; mins: number; modes: string[]; room?: string; link?: string; booked?: boolean };
type Booking = { id: string; slotId: string; teacherId: string; teacher: string; studentId: string; classId: string; studentName: string; parentName?: string;
  mode: string; agenda?: string; start: string; startMs: number; mins: number; room?: string; link?: string; status: "Scheduled" | "Cancelled" | "Attended" | "Missed" | string;
  cancelledBy?: string; cancelReason?: string; minutes?: string; joinedAt?: string };
type Stf = { id: string; name: string; status?: string; department?: string };
type Stu = { id: string; name: string; grn: string };

const tone = { Scheduled: "info", Attended: "success", Missed: "warning", Cancelled: "danger" } as const;
const when = (ms: number) => new Date(ms).toLocaleString("en-IN", { weekday: "short", day: "2-digit", month: "short", hour: "numeric", minute: "2-digit" });
const cls = (id?: string) => (id ?? "").replace(/^cls_(\d+)(\w)$/, "$1-$2");
/** tolerant read: rows written elsewhere may miss modes / names / mins */
const slotOf = (s: Slot): Slot => ({ ...s, teacher: s.teacher ?? "", modes: Array.isArray(s.modes) ? s.modes : [], mins: Number(s.mins) || 0, startMs: Number(s.startMs) || Date.parse(s.start) || 0 });
const bookingOf = (b: Booking): Booking => ({ ...b, teacher: b.teacher ?? "", studentName: b.studentName ?? "", mins: Number(b.mins) || 0, startMs: Number(b.startMs) || Date.parse(b.start) || 0 });

export function MeetingsPanel({ students }: { students: Stu[] }) {
  const toast = useToast();
  const slots = useCollection<Slot>("ptm_slots");
  const bookings = useCollection<Booking>("ptm_bookings");
  const staff = useCollection<Stf>("staff").rows;
  const [tab, setTab] = useState("upcoming");
  const [teacher, setTeacher] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [cancelling, setCancelling] = useState<Booking | null>(null);
  const [notes, setNotes] = useState<{ b: Booking; kind: "link" | "notes" } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const now = useNow();
  const grn = (id: string) => students.find((s) => s.id === id)?.grn ?? id;

  const slotRows = useMemo(() => slots.rows.map(slotOf), [slots.rows]);
  const bookingRows = useMemo(() => bookings.rows.map(bookingOf), [bookings.rows]);
  const mine = <T extends { teacherId: string }>(rows: T[]) => rows.filter((r) => !teacher || r.teacherId === teacher);
  const upcoming = mine(bookingRows).filter((b) => b.status === "Scheduled" && b.startMs + b.mins * 6e4 > now).sort((a, b) => a.startMs - b.startMs);
  const past = mine(bookingRows).filter((b) => !(b.status === "Scheduled" && b.startMs + b.mins * 6e4 > now)).sort((a, b) => b.startMs - a.startMs);
  const open = mine(slotRows).filter((s) => !s.booked && s.startMs > now).sort((a, b) => a.startMs - b.startMs);
  const teachers = useMemo(() => [...new Map([...slotRows, ...bookingRows].map((r) => [r.teacherId, r.teacher])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [slotRows, bookingRows]);

  async function setStatus(b: Booking, status: Booking["status"]) {
    setBusy(b.id);
    try { await bookings.update(b.id, { status }); toast(`Marked ${status.toLowerCase()}`); } catch { toast("Could not save", "error"); } finally { setBusy(null); }
  }
  async function removeSlot(s: Slot) {
    setBusy(s.id);
    try { await slots.remove(s.id); toast("Slot withdrawn"); } catch { toast("Could not withdraw the slot", "error"); } finally { setBusy(null); }
  }

  const who: Column<Booking> = { key: "student", header: "Student", sortValue: (b) => b.studentName, render: (b) => <div className="flex items-center gap-3"><Avatar name={b.studentName || "?"} />
    <div><div className="font-semibold">{b.studentName}</div><div className="t-caption text-outline">{cls(b.classId)} · <span className="font-mono">{grn(b.studentId)}</span>{b.parentName ? ` · ${b.parentName}` : ""}</div></div></div> };
  const meeting: Column<Booking> = { key: "when", header: "Meeting", sortValue: (b) => b.startMs, render: (b) => <div><div className="font-medium">{when(b.startMs)}</div>
    <div className="t-caption text-outline">{b.teacher} · {b.mins} min · {b.mode === "Virtual" ? (b.link ? "Google Meet" : "Virtual (no link yet)") : b.room || "In person"}</div></div> };
  const agenda: Column<Booking> = { key: "agenda", header: "Agenda", render: (b) => <span className="block max-w-[240px] text-sm text-on-surface-variant">{b.agenda || "—"}</span> };
  const upcomingCols: Column<Booking>[] = [who, meeting, agenda,
    { key: "act", header: "", className: "text-right", render: (b) => <div className="flex justify-end gap-2">
      {b.mode === "Virtual" && <Button size="sm" variant="ghost" onClick={() => setNotes({ b, kind: "link" })}>{b.link ? "Edit link" : "Add link"}</Button>}
      <Button size="sm" variant="ghost" className="!text-error" disabled={busy === b.id} onClick={() => setCancelling(b)}>Cancel</Button></div> }];
  const pastCols: Column<Booking>[] = [who, meeting,
    { key: "status", header: "Status", sortValue: (b) => b.status, render: (b) => <div><Badge tone={tone[b.status as keyof typeof tone] ?? "neutral"}>{b.status === "Scheduled" ? "Awaiting outcome" : b.status}</Badge>
      {b.status === "Cancelled" && <div className="t-caption mt-0.5 text-outline">by {b.cancelledBy === "parent" ? "parent" : "school"}{b.cancelReason ? ` · ${b.cancelReason}` : ""}</div>}
      {b.minutes && <div className="t-caption mt-0.5 max-w-[260px] text-outline">Notes: {b.minutes}</div>}</div> },
    { key: "act", header: "", className: "text-right", render: (b) => b.status === "Cancelled" ? null : <div className="flex justify-end gap-2">
      {b.status === "Scheduled" && <><Button size="sm" variant="outline" disabled={busy === b.id} onClick={() => setStatus(b, "Attended")}>Attended</Button>
        <Button size="sm" variant="ghost" disabled={busy === b.id} onClick={() => setStatus(b, "Missed")}>Missed</Button></>}
      <Button size="sm" variant="ghost" onClick={() => setNotes({ b, kind: "notes" })}>{b.minutes ? "Edit notes" : "Add notes"}</Button></div> }];
  const slotCols: Column<Slot>[] = [
    { key: "when", header: "Slot", sortValue: (s) => s.startMs, render: (s) => <div><div className="font-medium">{when(s.startMs)}</div><div className="t-caption text-outline">{s.mins} min</div></div> },
    { key: "teacher", header: "Teacher", sortValue: (s) => s.teacher, render: (s) => s.teacher },
    { key: "mode", header: "Mode", render: (s) => <div className="flex flex-wrap gap-1">{s.modes.map((m) => <Badge key={m}>{m}</Badge>)}<span className="t-caption text-outline">{s.room}</span></div> },
    { key: "act", header: "", className: "text-right", render: (s) => <Button size="sm" variant="ghost" className="!text-error" disabled={busy === s.id} onClick={() => removeSlot(s)}>Withdraw</Button> },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
        <Tabs value={tab} onChange={setTab} items={[{ id: "upcoming", label: "Booked", count: upcoming.length }, { id: "open", label: "Open slots", count: open.length }, { id: "past", label: "Past & cancelled", count: past.length }]} />
        <Select aria-label="Teacher" value={teacher} onChange={(e) => setTeacher(e.target.value)} className="w-48"><option value="">All teachers</option>{teachers.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</Select>
        <Button className="ml-auto" onClick={() => setPublishing(true)}><Plus size={16} />Publish slots</Button>
      </div>
      <p className="t-caption mb-3 px-5 text-outline">Parents book these slots in the parent app (More &gt; Parent-Teacher Meeting). The teacher is notified of each booking.</p>
      {!slots.ready || !bookings.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading meetings…</p>
        : tab === "open" ? <DataTable rows={open} columns={slotCols} pageSize={10} empty={<EmptyState title="No open slots" hint="Publish slots so parents can book a meeting." />} />
        : <DataTable rows={tab === "past" ? past : upcoming} columns={tab === "past" ? pastCols : upcomingCols} pageSize={10}
            empty={<EmptyState title={tab === "past" ? "No past meetings" : "No meetings booked"} hint="Meetings booked by parents show up here." />} />}
      <PublishSlotsModal open={publishing} now={now} staff={staff.filter((s) => (s.status ?? "Active") !== "Inactive")} existing={slotRows}
        onClose={() => setPublishing(false)} onCreate={async (rows) => { for (const r of rows) await slots.create(r); toast(`${rows.length} slot${rows.length === 1 ? "" : "s"} published`); }} />
      <ReasonModal ids={cancelling ? [cancelling.id] : null} title="Cancel meeting" label="Note to the parent" cta="Cancel meeting" onClose={() => setCancelling(null)}
        onSubmit={async (_ids, reason) => { if (cancelling) { await bookings.update(cancelling.id, { status: "Cancelled", cancelledBy: "school", cancelReason: reason, cancelledAt: new Date().toISOString() } as Partial<Booking>); toast("Meeting cancelled"); } }} />
      <NotesModal key={notes ? `${notes.b.id}_${notes.kind}` : "none"} target={notes} onClose={() => setNotes(null)} onSave={async (b, patch) => { await bookings.update(b.id, patch); toast("Saved"); }} />
    </Card>
  );
}

function PublishSlotsModal({ open, now, staff, existing, onClose, onCreate }: {
  open: boolean; now: number; staff: Stf[]; existing: Slot[]; onClose: () => void; onCreate: (rows: SlotDoc[]) => Promise<void>;
}) {
  const [f, setF] = useState<SlotForm>({ teacherId: "", date: "", from: "15:00", count: "4", mins: "15", gap: "5", room: "", link: "", inPerson: true, virtual: false });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof SlotForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }); setErr(""); };
  const close = () => { setErr(""); onClose(); };

  async function submit() {
    // `now` from useNow can be up to a minute old; the future check uses the real clock
    const r = buildSlots(f, { staff, existing, now: Math.max(now, Date.now()), when });
    if ("error" in r) return setErr(r.error);
    setBusy(true);
    try { await onCreate(r.rows); close(); } catch { setErr("Could not publish the slots."); } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={close} title="Publish meeting slots" subtitle="Parents of this teacher's students can book them in the parent app."
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={submit}>{busy ? "Publishing…" : "Publish"}</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Teacher" required className="sm:col-span-2"><Select value={f.teacherId} onChange={set("teacherId")}><option value="">Choose a teacher</option>
          {[...staff].sort((a, b) => a.name.localeCompare(b.name)).map((s) => <option key={s.id} value={s.id}>{s.name}{s.department ? ` · ${s.department}` : ""}</option>)}</Select></Field>
        <Field label="Date" required><Input type="date" value={f.date} onChange={set("date")} /></Field>
        <Field label="First slot at" required><Input type="time" value={f.from} onChange={set("from")} /></Field>
        <Field label="Number of slots"><Input type="number" min={1} max={20} value={f.count} onChange={set("count")} /></Field>
        <Field label="Minutes each"><Input type="number" min={5} max={120} value={f.mins} onChange={set("mins")} /></Field>
        <Field label="Gap between slots (min)"><Input type="number" min={0} max={60} value={f.gap} onChange={set("gap")} /></Field>
        <div className="flex items-end gap-4 pb-2 text-sm">
          <label className="flex items-center gap-2"><Checkbox checked={f.inPerson} onChange={set("inPerson")} />In person</label>
          <label className="flex items-center gap-2"><Checkbox checked={f.virtual} onChange={set("virtual")} />Virtual</label>
        </div>
        {f.inPerson && <Field label="Room" required hint="Where the parent should come" className="sm:col-span-2"><Input value={f.room} onChange={set("room")} placeholder="e.g. Room 204" /></Field>}
        {f.virtual && <Field label="Google Meet link" hint="Optional now; you can add it to each booking later" className="sm:col-span-2"><Input value={f.link} onChange={set("link")} placeholder="https://meet.google.com/…" /></Field>}
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
    </Modal>
  );
}

function NotesModal({ target, onClose, onSave }: { target: { b: Booking; kind: "link" | "notes" } | null; onClose: () => void; onSave: (b: Booking, patch: Partial<Booking>) => Promise<void> }) {
  const booking = target?.b ?? null;
  const linkOnly = target?.kind === "link";
  const [text, setText] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const value = text ?? (booking ? (linkOnly ? booking.link ?? "" : booking.minutes ?? "") : "");
  const close = () => { setText(null); setErr(""); onClose(); };
  async function save() {
    if (!booking) return;
    const v = value.trim();
    if (linkOnly && v && !validMeetLink(v)) return setErr("Enter a valid meeting link starting with https://.");
    if (!linkOnly && !v) return setErr("Write the notes to share with the parent.");
    setBusy(true);
    try { await onSave(booking, linkOnly ? { link: v } : { minutes: v }); close(); } catch { setErr("Could not save."); } finally { setBusy(false); }
  }
  return (
    <Modal open={!!booking} onClose={close} title={linkOnly ? "Google Meet link" : "Meeting notes"} subtitle={booking ? `${booking.studentName} · ${booking.teacher}` : undefined}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button></>}>
      {linkOnly ? <Field label="Link" error={err} hint="The parent sees it on the meeting and can join 10 minutes before the start"><Input value={value} onChange={(e) => { setText(e.target.value); setErr(""); }} placeholder="https://meet.google.com/…" autoFocus /></Field>
        : <Field label="Notes shared with the parent" error={err} hint="The parent is notified and sees them under past meetings"><Textarea value={value} onChange={(e) => { setText(e.target.value); setErr(""); }} autoFocus /></Field>}
    </Modal>
  );
}
