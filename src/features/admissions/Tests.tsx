"use client";
import { useMemo, useState } from "react";
import { CalendarPlus, Download, MessageSquare, UserPlus, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, Checkbox, DataTable, Field, Input, Modal, ProgressBar, Select, Stat, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { downloadCsv, todayISO, useAdm } from "./lib";
import { GRADES, PANEL_LABEL, gradeLabel, type Application, type PanelStatus, type Slot, type SlotStatus } from "./types";

const PANEL_TONE: Record<PanelStatus, "success" | "info" | "warning" | "neutral" | "danger"> = { cleared: "success", scheduled: "info", hall_ticket: "neutral", in_review: "warning", waitlisted: "neutral", rejected: "danger" };
const SLOT_TONE: Record<SlotStatus, "info" | "success" | "brand" | "warning"> = { scheduled: "warning", completed: "success", scores_entered: "brand", published: "info" };
const SLOT_LABEL: Record<SlotStatus, string> = { scheduled: "Scheduled", completed: "Completed", scores_entered: "Scores Entered", published: "Results Published" };
const NEXT: Partial<Record<SlotStatus, [SlotStatus, string]>> = { scheduled: ["completed", "Mark completed"], completed: ["scores_entered", "Confirm scores entered"], scores_entered: ["published", "Publish results"] };

export function Tests() {
  const { apps, slots, logMessage, ready } = useAdm();
  const toast = useToast();
  const [grade, setGrade] = useState("");
  const [pstat, setPstat] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [slotModal, setSlotModal] = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [scoring, setScoring] = useState<string | null>(null);

  const slotOf = (a: Application) => slots.rows.find((s) => s.id === (a.interviewSlotId || a.testSlotId));
  const cands = useMemo(() => apps.rows.filter((a) => a.testSlotId || a.interviewSlotId), [apps.rows]);
  const stats = useMemo(() => {
    const sc = cands.filter((a) => a.writtenScore != null);
    const up = cands.filter((a) => slots.rows.find((s) => s.id === a.testSlotId)?.status === "scheduled").length;
    return { total: cands.length, up, short: apps.rows.filter((a) => a.status === "shortlisted").length, avg: sc.length ? Math.round((sc.reduce((x, a) => x + (a.writtenScore ?? 0), 0) / sc.length) * 10) / 10 : 0 };
  }, [cands, apps.rows, slots.rows]);

  const rows = useMemo(() => cands.filter((a) => (!grade || a.grade === grade) && (!pstat || a.panelStatus === pstat)).sort((x, y) => (slotOf(y)?.date ?? "").localeCompare(slotOf(x)?.date ?? "")), [cands, grade, pstat, slots.rows]); // eslint-disable-line react-hooks/exhaustive-deps

  const cols: Column<Application>[] = [
    { key: "name", header: "Candidate Details", sortValue: (a) => a.name, render: (a) => <div className="flex items-center gap-3"><Avatar name={a.name} size={34} /><div><div className="font-semibold">{a.name}</div><div className="text-xs text-on-surface-variant">{a.ref}</div></div></div> },
    { key: "grade", header: "Grade", sortValue: (a) => GRADES.findIndex((g) => g.id === a.grade), render: (a) => <Badge>{gradeLabel(a.grade)}</Badge> },
    { key: "batch", header: "Test Batch & Date", sortValue: (a) => slotOf(a)?.date ?? "", render: (a) => { const s = slotOf(a); return s ? <span className="text-sm">{s.batch.replace("BATCH #", "Batch ")} · {fmtDate(s.date)}</span> : "—"; } },
    { key: "score", header: "Written Score", sortValue: (a) => a.writtenScore ?? -1, render: (a) => a.writtenScore == null ? <span className="italic text-on-surface-variant">Diagnostic Pending</span> : <div className="flex items-center gap-2"><ProgressBar className="w-20" value={a.writtenScore} tone={a.writtenScore >= 80 ? "success" : a.writtenScore >= 65 ? "brand" : "warning"} /><b className="text-sm">{a.writtenScore}/100</b></div> },
    { key: "panel", header: "Panel Status", render: (a) => a.panelStatus ? <Badge tone={PANEL_TONE[a.panelStatus]}>{PANEL_LABEL[a.panelStatus]}{a.panelStatus === "waitlisted" && a.waitlistNo ? ` (WL-${String(a.waitlistNo).padStart(2, "0")})` : ""}</Badge> : "—" },
    { key: "panelist", header: "Assigned Panelist", render: (a) => a.panelist || "—" },
    { key: "act", header: "", render: (a) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setScoring(a.id); }}>{a.writtenScore == null ? "Enter score" : "Edit result"}</Button> },
  ];

  const selected = apps.rows.filter((a) => sel.includes(a.id));
  const sortedSlots = [...slots.rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="TOTAL CANDIDATES" value={stats.total} /><Stat label="UPCOMING (SCHEDULED)" value={stats.up} /><Stat label="INTERVIEW SHORTLIST" value={stats.short} /><Stat label="DIAGNOSTIC AVERAGE" value={`${stats.avg}%`} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="t-headline-md">Active Assessment Batches</h2>
        <div className="flex gap-2"><Button variant="outline" onClick={() => setAssignModal(true)}><UserPlus size={16} />Assign candidates</Button><Button onClick={() => setSlotModal(true)}><CalendarPlus size={16} />Schedule slot</Button></div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sortedSlots.map((s) => {
          const c = apps.rows.filter((a) => a.testSlotId === s.id || a.interviewSlotId === s.id);
          const scored = c.filter((a) => a.writtenScore != null);
          const avg = scored.length ? Math.round((scored.reduce((x, a) => x + (a.writtenScore ?? 0), 0) / scored.length) * 10) / 10 : null;
          const nx = NEXT[s.status];
          return (
            <Card key={s.id} className="flex flex-col p-5">
              <div className="flex items-center justify-between"><Badge tone="info">{s.batch}</Badge><Badge tone={SLOT_TONE[s.status]}>{SLOT_LABEL[s.status]}</Badge></div>
              <h3 className="mt-3 t-headline-md !text-[17px]">{s.title}</h3>
              <p className="text-on-surface-variant">{c.length}/{s.capacity} {s.type === "test" ? "candidates registered" : "candidates"} · {s.venue}</p>
              <p className="text-xs text-on-surface-variant">{fmtDate(s.date)} · {s.time} · {s.invigilator}</p>
              {s.type === "test" && <><div className="mt-3 flex justify-between text-sm"><span>Score entry</span><b>{scored.length}/{c.length}</b></div><ProgressBar value={c.length ? (scored.length / c.length) * 100 : 0} tone="success" className="mt-1" /></>}
              <div className="mt-auto flex items-center justify-between pt-3 text-sm"><span>{avg != null ? `Average: ${avg}%` : "No scores yet"}</span>
                {nx && <button className="cursor-pointer font-semibold text-secondary" onClick={() => slots.update(s.id, { status: nx[0] }).then(() => toast(`${s.batch}: ${SLOT_LABEL[nx[0]]}`)).catch(() => toast("Could not update slot", "error"))}>{nx[1]} →</button>}</div>
            </Card>);
        })}
      </div>

      <Card>
        <CardHeader title="Candidate Evaluation & Interview" subtitle={`${rows.length} active`} />
        {!ready ? <p className="p-5">Loading…</p> : <DataTable rows={rows} columns={cols} pageSize={6} selectable selected={sel} onSelectedChange={setSel} searchText={(a) => `${a.name} ${a.ref}`}
          toolbar={<><Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-40"><option value="">Grade: All</option>{GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>
            <Select aria-label="Status" value={pstat} onChange={(e) => setPstat(e.target.value)} className="w-44"><option value="">Status: All</option>{Object.entries(PANEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></>} />}
      </Card>

      {sel.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-secondary/30 bg-info-container px-4 py-3 shadow-pop">
          <b className="text-sm">{sel.length} Candidates Selected</b>
          <Button size="sm" variant="outline" onClick={async () => { try { await Promise.all(selected.map((a) => logMessage("WhatsApp time-slot", a.phone, `${a.name}: your slot is ${slotOf(a)?.date ?? "TBD"} ${slotOf(a)?.time ?? ""} at ${slotOf(a)?.venue ?? ""}.`))); toast(`Time-slot sent to ${selected.length} guardians (simulated)`); setSel([]); } catch { toast("Could not log messages", "error"); } }}><MessageSquare size={14} />WhatsApp Time-Slot</Button>
          <Button size="sm" variant="outline" onClick={() => downloadCsv("candidates.csv", [["App ID", "Candidate", "Grade", "Batch", "Date", "Score", "Panel"], ...selected.map((a) => [a.ref, a.name, gradeLabel(a.grade), slotOf(a)?.batch, slotOf(a)?.date, a.writtenScore ?? "", a.panelStatus ?? ""])])}><Download size={14} />Export</Button>
          <button aria-label="Clear selection" onClick={() => setSel([])} className="cursor-pointer"><X size={16} /></button>
        </div>)}

      <SlotModal open={slotModal} onClose={() => setSlotModal(false)} />
      <AssignModal open={assignModal} onClose={() => setAssignModal(false)} />
      {/* keyed so a cancelled edit never pre-fills the next candidate */}
      <ScoreModal key={scoring ?? "none"} id={scoring} onClose={() => setScoring(null)} />
    </div>
  );
}

function SlotModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { slots } = useAdm();
  const toast = useToast();
  const [f, setF] = useState({ title: "", type: "test", date: "", time: "09:30", venue: "", capacity: "40", invigilator: "Mrs. S. Rao" });
  const [err, setErr] = useState("");
  if (!open) return null;
  const save = async () => {
    if (!f.title.trim() || !f.date || !f.venue.trim()) return setErr("Title, date and venue are required");
    if (f.date < todayISO()) return setErr("Date cannot be in the past");
    if (!Number.isInteger(Number(f.capacity)) || Number(f.capacity) < 1) return setErr("Capacity must be a whole number of at least 1");
    const n = slots.rows.filter((s) => s.type === f.type).length + 1;
    try { await slots.create({ batch: f.type === "test" ? `BATCH #${String(n).padStart(2, "0")}` : `PANEL ${String.fromCharCode(64 + n)}`, title: f.title.trim(), type: f.type as Slot["type"], date: f.date, time: f.time, venue: f.venue.trim(), capacity: Number(f.capacity), invigilator: f.invigilator, status: "scheduled" }); }
    catch { return setErr("Could not save the slot — try again"); }
    toast("Slot scheduled"); onClose(); setF({ ...f, title: "", venue: "" }); setErr("");
  };
  return (
    <Modal open onClose={onClose} title="Schedule test / interview slot" footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save}>Schedule</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2"><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Grade 3 Diagnostic Assessment" /></Field>
        <Field label="Type"><Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}><option value="test">Written test</option><option value="interview">Interview panel</option></Select></Field>
        <Field label="Capacity"><Input type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} /></Field>
        <Field label="Date" required><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Time"><Input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></Field>
        <Field label="Venue" required><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></Field>
        <Field label="Invigilator / panel lead"><Input value={f.invigilator} onChange={(e) => setF({ ...f, invigilator: e.target.value })} /></Field>
      </div>
      {err && <p className="mt-3 text-sm text-error">{err}</p>}
    </Modal>
  );
}

function AssignModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { apps, slots } = useAdm();
  const toast = useToast();
  const [slotId, setSlotId] = useState("");
  const [pick, setPick] = useState<string[]>([]);
  if (!open) return null;
  const slot = slots.rows.find((s) => s.id === slotId);
  const used = slot ? apps.rows.filter((a) => a.testSlotId === slot.id || a.interviewSlotId === slot.id).length : 0;
  const eligible = slot ? apps.rows.filter((a) => (slot.type === "test" ? ["verified", "docs_pending"].includes(a.status) && !a.testSlotId && a.feePaid : ["tested", "shortlisted"].includes(a.status) && !a.interviewSlotId)) : [];
  const save = async () => {
    if (!slot) return;
    if (used + pick.length > slot.capacity) return toast(`Only ${slot.capacity - used} places left in this slot`, "error");
    try { await Promise.all(pick.map((id) => slot.type === "test" ? apps.update(id, { testSlotId: slot.id, status: "test_scheduled", panelStatus: "hall_ticket", panelist: slot.invigilator }) : apps.update(id, { interviewSlotId: slot.id, panelStatus: "scheduled", panelist: slot.invigilator }))); }
    catch { return toast("Some assignments failed — check the roster and retry", "error"); }
    toast(`${pick.length} candidates assigned to ${slot.batch}`); setPick([]); onClose();
  };
  return (
    <Modal open onClose={onClose} title="Assign candidates to a slot" subtitle="Tests: fee-paid applicants awaiting a test. Interviews: tested / shortlisted candidates." footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={!pick.length} onClick={save}>Assign {pick.length || ""}</Button></>}>
      <Field label="Slot"><Select value={slotId} onChange={(e) => { setSlotId(e.target.value); setPick([]); }}><option value="">Choose a slot…</option>{slots.rows.filter((s) => s.status === "scheduled").map((s) => <option key={s.id} value={s.id}>{s.batch} · {s.title} · {fmtDate(s.date)}</option>)}</Select></Field>
      {slot && <ul className="mt-4 max-h-72 divide-y divide-outline-variant/40 overflow-y-auto rounded-lg border border-outline-variant/60">
        {eligible.length === 0 && <li className="p-4 text-on-surface-variant">No eligible candidates.</li>}
        {eligible.map((a) => <li key={a.id}><label className="flex cursor-pointer items-center gap-3 px-3 py-2"><Checkbox checked={pick.includes(a.id)} onChange={(e) => setPick(e.target.checked ? [...pick, a.id] : pick.filter((x) => x !== a.id))} /><span className="flex-1">{a.name} <span className="text-xs text-on-surface-variant">{a.ref}</span></span><Badge>{gradeLabel(a.grade)}</Badge></label></li>)}
      </ul>}
      {slot && <p className="mt-2 text-xs text-on-surface-variant">{used}/{slot.capacity} places used</p>}
    </Modal>
  );
}

function ScoreModal({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { apps } = useAdm();
  const toast = useToast();
  const a = id ? apps.rows.find((x) => x.id === id) : null;
  const [score, setScore] = useState<string | null>(null);
  const [panel, setPanel] = useState<string | null>(null);
  if (!a) return null;
  const sc = score ?? (a.writtenScore?.toString() ?? ""), pn = (panel ?? a.panelStatus ?? "in_review") as PanelStatus;
  const bad = sc !== "" && (isNaN(Number(sc)) || Number(sc) < 0 || Number(sc) > 100);
  const save = async () => {
    if (bad || sc === "") return;
    const patch: Partial<Application> = { writtenScore: Number(sc), panelStatus: pn };
    const locked = ["offered", "enrolled", "withdrawn", "lapsed"].includes(a.status);
    if (!locked) {
      patch.status = pn === "cleared" ? "shortlisted" : pn === "waitlisted" ? "waitlisted" : pn === "rejected" ? "rejected" : "tested";
      if (pn === "waitlisted" && !a.waitlistNo) patch.waitlistNo = apps.rows.filter((x) => x.status === "waitlisted" && x.grade === a.grade).reduce((m, x) => Math.max(m, x.waitlistNo), 0) + 1;
    }
    try { await apps.update(a.id, patch); } catch { return toast("Could not save result", "error"); }
    toast(`Result saved for ${a.name}`); setScore(null); setPanel(null); onClose();
  };
  return (
    <Modal open onClose={() => { setScore(null); setPanel(null); onClose(); }} title={`Enter result · ${a.name}`} subtitle={`${a.ref} · ${gradeLabel(a.grade)}`} footer={<><Button variant="outline" onClick={() => { setScore(null); setPanel(null); onClose(); }}>Cancel</Button><Button onClick={save} disabled={bad || sc === ""}>Save result</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Written score (0–100)" required error={bad ? "Enter a number between 0 and 100" : undefined}><Input type="number" min={0} max={100} value={sc} onChange={(e) => setScore(e.target.value)} /></Field>
        <Field label="Panel outcome"><Select value={pn} onChange={(e) => setPanel(e.target.value)}>{Object.entries(PANEL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select></Field>
      </div>
      <p className="mt-3 text-xs text-on-surface-variant">Cleared moves the application to Shortlisted; Waitlisted adds it to the waitlist ranking.</p>
    </Modal>
  );
}
