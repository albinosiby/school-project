"use client";
// Exams > Exam duties: invigilation allocation per paper (exm_duties, data contract section 12.3).
// The paper's chief invigilator (exm_papers.invigilatorId) is shown as its Chief row; editing it updates the paper.
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Trash2, UserPlus } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import type { Candidate, Cycle, Paper } from "./types";

export type DutyRole = "Chief Invigilator" | "Invigilator" | "Reliever";
export type Duty = {
  id: string; paperId: string; cycleId: string; staffId: string; role: DutyRole; hall: string; venue: string; date: string; start: string; end: string;
  grade: string; subject: string; code: string; classIds: string[]; candidates: number; status: "upcoming" | "completed"; reportBy: string; note?: string; createdAt: string;
};
type StaffRow = { id: string; name: string; department: string; status?: string };
const ROLES: DutyRole[] = ["Chief Invigilator", "Invigilator", "Reliever"];

const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const fromMin = (n: number) => { const x = ((n % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
const paperEnd = (p: Paper) => fromMin(toMin(p.start) + Math.round((p.duration || 0) * 60));
const t12 = (t?: string) => { if (!t || !t.includes(":")) return "--:--"; const [h, m] = t.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
/** draft papers may have no date yet */
const dateLabel = (d?: string) => (d ? fmtDate(d) : "Date TBD");
const dutyId = (paperId: string) => `dut_${paperId}_${Date.now().toString(36)}`;
const classOf = (c: Candidate) => `cls_${c.grade}${c.section}`;

/** One staff member's time on a paper (duty row or chief of the paper). */
type Slot = { key: string; staffId: string; paperId: string; date: string; start: string; end: string; label: string };

export function ExamDuties({ cycles, papers, defaultCycleId }: { cycles: Cycle[]; papers: Paper[]; defaultCycleId: string }) {
  const toast = useToast();
  const duties = useCollection<Duty>("exm_duties");
  const paperCol = useCollection<Paper>("exm_papers");
  const cands = useCollection<Candidate>("exm_candidates").rows;
  const staff = useCollection<StaffRow>("staff").rows.filter((s) => s.department !== "Administration").sort((a, b) => a.name.localeCompare(b.name));
  const [cycleId, setCycleId] = useState("");
  const [grade, setGrade] = useState("all");
  const [form, setForm] = useState<{ paper: Paper; edit?: Duty } | null>(null);
  const [del, setDel] = useState<Duty | null>(null);
  const curId = cycleId || defaultCycleId;
  const name = (id?: string) => staff.find((s) => s.id === id)?.name ?? (id || "");

  const candidatesOf = (p: Paper) => p.classIds?.length ? cands.filter((c) => p.classIds!.includes(classOf(c))).length : cands.filter((c) => c.grade === p.grade).length;

  // every assignment in every cycle, timed from the paper (duty rows keep a copy for the teacher app)
  const slots: Slot[] = useMemo(() => {
    const byId = new Map(papers.map((p) => [p.id, p]));
    const out: Slot[] = [];
    for (const p of papers) if (p.invigilatorId) out.push({ key: `chief_${p.id}`, staffId: p.invigilatorId, paperId: p.id, date: p.date, start: p.start, end: paperEnd(p), label: `Grade ${p.grade} ${p.subject}` });
    for (const d of duties.rows) {
      const p = byId.get(d.paperId);
      out.push({ key: d.id, staffId: d.staffId, paperId: d.paperId, date: p?.date ?? d.date, start: p?.start ?? d.start, end: p ? paperEnd(p) : d.end, label: p ? `Grade ${p.grade} ${p.subject}` : `Grade ${d.grade} ${d.subject}` });
    }
    return out;
  }, [papers, duties.rows]);
  /** Other assignments of this staff member on the same date with overlapping time (other papers only). */
  const clashes = (staffId: string, p: Pick<Paper, "id" | "date" | "start"> & { end: string }, exceptKey?: string) =>
    slots.filter((s) => s.staffId === staffId && s.key !== exceptKey && s.paperId !== p.id && !!p.date && s.date === p.date && toMin(s.start) < toMin(p.end) && toMin(p.start) < toMin(s.end));

  const cyclePapers = papers.filter((p) => p.cycleId === curId);
  const grades = [...new Set(cyclePapers.map((p) => p.grade))].sort((a, b) => +a - +b);
  const view = cyclePapers.filter((p) => grade === "all" || p.grade === grade).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.start ?? "").localeCompare(b.start ?? "") || +a.grade - +b.grade);
  const dutiesOf = (p: Paper) => duties.rows.filter((d) => d.paperId === p.id).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || (a.hall ?? "").localeCompare(b.hall ?? ""));
  const cycleDuties = duties.rows.filter((d) => cyclePapers.some((p) => p.id === d.paperId));
  const noChief = cyclePapers.filter((p) => !p.invigilatorId).length;
  const clashCount = cyclePapers.reduce((n, p) => n + (p.invigilatorId && clashes(p.invigilatorId, { ...p, end: paperEnd(p) }, `chief_${p.id}`).length ? 1 : 0)
    + dutiesOf(p).filter((d) => clashes(d.staffId, { ...p, end: paperEnd(p) }, d.id).length).length, 0);

  const setChief = async (p: Paper, staffId: string) => {
    try { await paperCol.update(p.id, { invigilatorId: staffId, invigilator: name(staffId) }); toast(staffId ? `${name(staffId)} is chief invigilator; teacher notified` : "Chief invigilator cleared"); }
    catch { toast("Could not update the paper", "error"); }
  };

  const saveDuty = async (p: Paper, v: { staffId: string; role: DutyRole; hall: string; venue: string; candidates: number; note: string }, edit?: Duty) => {
    const end = paperEnd(p);
    const body = {
      paperId: p.id, cycleId: p.cycleId, staffId: v.staffId, role: v.role, hall: v.hall.trim(), venue: v.venue.trim(), date: p.date, start: p.start, end,
      grade: p.grade, subject: p.subject, code: p.code, classIds: p.classIds ?? [], candidates: v.candidates,
      status: p.status === "Completed" ? "completed" as const : "upcoming" as const, reportBy: fromMin(toMin(p.start) - 30), note: v.note.trim(),
    };
    try {
      if (edit) await duties.update(edit.id, body);
      else await duties.create({ id: dutyId(p.id), ...body, createdAt: new Date().toISOString() });
      toast(edit ? "Duty updated" : `${name(v.staffId)} assigned; teacher notified`); setForm(null);
    } catch { toast("Could not save the duty", "error"); }
  };

  return (
    <Card className="mt-6" id="duties">
      <CardHeader title="EXAM DUTIES & INVIGILATION" subtitle="Allocate chief invigilators, invigilators and relievers per paper. Teachers see their duties in the app and are notified."
        actions={<span className="flex flex-wrap items-center gap-2 text-on-surface-variant"><span><b className="text-on-surface">{cycleDuties.length}</b> duties</span>
          {noChief > 0 && <Badge tone="warning">{noChief} without chief</Badge>}{clashCount > 0 && <Badge tone="danger"><AlertTriangle size={12} />{clashCount} clash{clashCount > 1 ? "es" : ""}</Badge>}</span>} />
      <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
        <Select aria-label="Exam cycle" value={curId} onChange={(e) => { setCycleId(e.target.value); setGrade("all"); }} className="!w-72">
          {cycles.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}</Select>
        <Select aria-label="Filter grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="!w-40">
          <option value="all">All Grades</option>{grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
      </div>
      {view.length === 0 ? <div className="pb-5"><EmptyState title="No papers in this cycle" hint="Add paper slots to the cycle first." /></div> : (
        <div className="space-y-4 px-5 pb-5">{view.map((p) => {
          const end = paperEnd(p), list = dutiesOf(p), n = candidatesOf(p);
          const chiefClash = p.invigilatorId ? clashes(p.invigilatorId, { ...p, end }, `chief_${p.id}`) : [];
          return (
            <div key={p.id} className="rounded-lg border border-outline-variant/60">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-outline-variant/50 bg-surface-container-low px-4 py-2.5">
                <span className="font-semibold">Grade {p.grade} · {p.subject}</span>
                <span className="font-mono text-xs text-on-surface-variant">{p.code}</span>
                <span className="text-sm">{dateLabel(p.date)} · {t12(p.start)} – {t12(end)}</span>
                <span className="text-sm text-on-surface-variant">{p.venue}</span>
                <span className="text-sm text-on-surface-variant">{n} candidates</span>
                {p.status === "Completed" && <Badge tone="success">Completed</Badge>}
                <Button size="sm" variant="outline" className="ml-auto" onClick={() => setForm({ paper: p })}><UserPlus size={14} />Add invigilator</Button>
              </div>
              <div className="overflow-x-auto"><table className="w-full text-left text-sm">
                <thead className="t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="px-4 py-2">Role</th><th className="px-4 py-2">Staff</th><th className="px-4 py-2">Hall</th><th className="px-4 py-2">Venue</th><th className="px-4 py-2">Candidates</th><th className="px-4 py-2">Report by</th><th className="px-4 py-2" /></tr></thead>
                <tbody>
                  <tr className="border-t border-outline-variant/40">
                    <td className="px-4 py-2"><Badge tone="brand">Chief Invigilator</Badge></td>
                    <td className="px-4 py-2"><Select aria-label={`Chief invigilator for ${p.subject} grade ${p.grade}`} value={p.invigilatorId ?? ""} onChange={(e) => setChief(p, e.target.value)} className="!h-9 min-w-56">
                      <option value="">{p.invigilator && !p.invigilatorId ? `${p.invigilator} (not linked)` : "Not assigned"}</option>
                      {staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department}</option>)}</Select>
                      <ClashNote list={chiefClash} /></td>
                    <td className="px-4 py-2 text-outline">Paper</td><td className="px-4 py-2">{p.venue}</td><td className="px-4 py-2">{n}</td><td className="px-4 py-2 font-mono">{t12(fromMin(toMin(p.start) - 30))}</td>
                    <td className="px-4 py-2 text-right text-xs text-outline">from the paper</td>
                  </tr>
                  {list.map((d) => (
                    <tr key={d.id} className="border-t border-outline-variant/40">
                      <td className="px-4 py-2"><Badge tone={d.role === "Chief Invigilator" ? "brand" : d.role === "Reliever" ? "neutral" : "info"}>{d.role}</Badge></td>
                      <td className="px-4 py-2"><div className="font-medium">{name(d.staffId)}</div><ClashNote list={clashes(d.staffId, { ...p, end }, d.id)} /></td>
                      <td className="px-4 py-2">{d.hall || "—"}</td><td className="px-4 py-2">{d.venue || "—"}</td><td className="px-4 py-2">{d.candidates}</td><td className="px-4 py-2 font-mono">{t12(d.reportBy)}</td>
                      <td className="px-4 py-2 text-right whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setForm({ paper: p, edit: d })}>Edit</Button>
                        <Button size="sm" variant="ghost" aria-label="Remove duty" onClick={() => setDel(d)}><Trash2 size={14} className="text-error" /></Button></td>
                    </tr>))}
                </tbody></table></div>
            </div>);
        })}</div>)}

      {form && <DutyForm key={form.edit?.id ?? form.paper.id} paper={form.paper} edit={form.edit} staff={staff} candidates={candidatesOf(form.paper)}
        taken={[form.paper.invigilatorId ?? "", ...dutiesOf(form.paper).filter((d) => d.id !== form.edit?.id).map((d) => d.staffId)].filter(Boolean)}
        clashFor={(sid) => clashes(sid, { ...form.paper, end: paperEnd(form.paper) }, form.edit?.id)}
        onClose={() => setForm(null)} onSave={(v) => saveDuty(form.paper, v, form.edit)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove duty?" subtitle={del ? `${name(del.staffId)} · ${del.role}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await duties.remove(del!.id); toast("Duty removed"); } catch { toast("Could not remove the duty", "error"); } setDel(null); }}>Remove</Button></>}>
        <p className="text-on-surface-variant">The duty disappears from the teacher&apos;s Exam duties screen.</p></Modal>
    </Card>
  );
}

function ClashNote({ list }: { list: Slot[] }) {
  if (!list.length) return null;
  return <span className="mt-0.5 flex items-center gap-1 text-xs text-warning"><AlertTriangle size={12} />Clash: {list.map((s) => `${s.label} ${t12(s.start)}`).join(", ")}</span>;
}

function DutyForm({ paper, edit, staff, candidates, taken, clashFor, onClose, onSave }: {
  paper: Paper; edit?: Duty; staff: StaffRow[]; candidates: number; taken: string[]; clashFor: (staffId: string) => Slot[]; onClose: () => void;
  onSave: (v: { staffId: string; role: DutyRole; hall: string; venue: string; candidates: number; note: string }) => Promise<void>;
}) {
  const [v, setV] = useState({ staffId: edit?.staffId ?? "", role: edit?.role ?? "Invigilator" as DutyRole, hall: edit?.hall ?? "", venue: edit?.venue ?? paper.venue, candidates: edit?.candidates ?? candidates, note: edit?.note ?? "" });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const clash = v.staffId ? clashFor(v.staffId) : [];
  const dup = taken.includes(v.staffId);
  const submit = async () => {
    if (!v.staffId) return setErr("Pick a staff member");
    if (dup) return setErr("This staff member already has a duty on this paper");
    if (!v.hall.trim()) return setErr("Enter the hall / room");
    if (!Number.isInteger(v.candidates) || v.candidates < 0) return setErr("Candidates must be a whole number");
    setErr(""); setSaving(true);
    try { await onSave(v); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={edit ? "Edit exam duty" : "Add invigilator"} subtitle={`Grade ${paper.grade} · ${paper.subject} · ${dateLabel(paper.date)} ${paper.start ?? ""}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}><Plus size={14} />{saving ? "Saving…" : edit ? "Save duty" : "Assign duty"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Staff member" required className="sm:col-span-2"><Select value={v.staffId} onChange={(e) => { setV({ ...v, staffId: e.target.value }); setErr(""); }}>
          <option value="">Select a teacher</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name} · {s.department}{taken.includes(s.id) ? " (on this paper)" : ""}</option>)}</Select></Field>
        {clash.length > 0 && <div className="sm:col-span-2 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-container/60 p-3 text-sm text-warning">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Overlapping duty on {dateLabel(paper.date)}: {clash.map((s) => `${s.label} (${s.start}–${s.end})`).join(", ")}. You can still assign, but the teacher cannot be in two halls.</span></div>}
        <Field label="Role"><Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as DutyRole })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Hall / room" required><Input value={v.hall} onChange={(e) => setV({ ...v, hall: e.target.value })} placeholder="e.g. Hall 3" /></Field>
        <Field label="Venue" hint="From the paper"><Input value={v.venue} onChange={(e) => setV({ ...v, venue: e.target.value })} /></Field>
        <Field label="Candidates" hint="From the paper's classes"><Input type="number" min={0} value={Number.isNaN(v.candidates) ? "" : v.candidates} onChange={(e) => setV({ ...v, candidates: e.target.value === "" ? NaN : Number(e.target.value) })} /></Field>
        <Field label="Note" className="sm:col-span-2"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Optional instructions for the teacher" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Report by {t12(fromMin(toMin(paper.start) - 30))} (30 minutes before the paper starts).</p>
      {err && <p className="mt-2 text-xs text-error">{err}</p>}
    </Modal>
  );
}
