"use client";
import { teachingStaff } from "@/features/ops/shared";
// Exams > Exam duties: invigilation allocation per paper (exm_duties, data contract section 12.3).
// The paper's chief invigilator (exm_papers.invigilatorId) is shown as its Chief row; editing it updates the paper.
import { useMemo, useState } from "react";
import { AlertTriangle, Plus, Printer, Trash2, UserPlus } from "lucide-react";
import { examAction } from "./examService";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { labelToClassId, fromMin, paperEnd, rosterOf, studentIdOf, staffClashes, toMin, type Slot, type StudentRow } from "./logic";
import type { Candidate, Cycle, Paper } from "./types";

export type DutyRole = "Chief Invigilator" | "Invigilator" | "Reliever";
export type Duty = {
  id: string; paperId: string; cycleId: string; staffId: string; role: DutyRole; hall: string; venue: string; date: string; start: string; end: string;
  grade: string; subject: string; code: string; classIds: string[]; candidates: number; status: "upcoming" | "completed"; reportBy: string; note?: string; createdAt: string;
};
type StaffRow = { id: string; name: string; department: string; staffRole?: string; status?: string };
const ROLES: DutyRole[] = ["Chief Invigilator", "Invigilator", "Reliever"];

const t12 = (t?: string) => { if (!t || !t.includes(":")) return "--:--"; const [h, m] = t.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
/** draft papers may have no date yet */
const dateLabel = (d?: string) => (d ? fmtDate(d) : "Date TBD");
const classOf = (c: Candidate) => c.classId || labelToClassId(c.cls);

export function ExamDuties({ cycles, papers, defaultCycleId }: { cycles: Cycle[]; papers: Paper[]; defaultCycleId: string }) {
  const toast = useToast();
  const duties = useCollection<Duty>("exm_duties");
  const candRows = useCollection<Candidate>("exm_candidates").rows;
  const students = useCollection<StudentRow>("students").rows;
  const cands = useMemo(() => rosterOf(candRows, students), [candRows, students]);
  const staff = teachingStaff(useCollection<StaffRow>("staff").rows);
  const [cycleId, setCycleId] = useState("");
  const [grade, setGrade] = useState("all");
  const [form, setForm] = useState<{ paper: Paper; edit?: Duty } | null>(null);
  const [del, setDel] = useState<Duty | null>(null);
  const [print, setPrint] = useState(false);
  const curId = cycleId || defaultCycleId;
  const name = (id?: string) => staff.find((s) => s.id === id)?.name ?? (id || "");

  const candidatesOf = (p: Paper) => p.studentIds ? cands.filter((candidate) => p.studentIds!.includes(studentIdOf(candidate))).length : p.classIds?.length ? cands.filter((c) => p.classIds!.includes(classOf(c))).length : cands.filter((c) => c.grade === p.grade).length;

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
  const clashes = (staffId: string, p: Pick<Paper, "id" | "date" | "start"> & { end: string }, exceptKey?: string) => staffClashes(slots, staffId, p, exceptKey);

  const cyclePapers = papers.filter((p) => p.cycleId === curId && !["Postponed", "Cancelled"].includes(p.scheduleStatus || ""));
  const grades = [...new Set(cyclePapers.map((p) => p.grade))].sort((a, b) => +a - +b);
  const view = cyclePapers.filter((p) => grade === "all" || p.grade === grade).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? "") || (a.start ?? "").localeCompare(b.start ?? "") || +a.grade - +b.grade);
  const dutiesOf = (p: Paper) => duties.rows.filter((d) => d.paperId === p.id).sort((a, b) => ROLES.indexOf(a.role) - ROLES.indexOf(b.role) || (a.hall ?? "").localeCompare(b.hall ?? ""));
  const cycleDuties = duties.rows.filter((d) => cyclePapers.some((p) => p.id === d.paperId));
  const dutySummary = staff.map((s) => {
    const assigned = cyclePapers.filter((p) => p.invigilatorId === s.id || cycleDuties.some((d) => d.paperId === p.id && d.staffId === s.id));
    return { ...s, count: assigned.length, hours: assigned.reduce((sum, p) => sum + p.duration, 0), chief: assigned.filter((p) => p.invigilatorId === s.id).length };
  }).filter((s) => s.count > 0);
  const noChief = cyclePapers.filter((p) => !p.invigilatorId).length;
  const clashCount = cyclePapers.reduce((n, p) => n + (p.invigilatorId && clashes(p.invigilatorId, { ...p, end: paperEnd(p) }, `chief_${p.id}`).length ? 1 : 0)
    + dutiesOf(p).filter((d) => clashes(d.staffId, { ...p, end: paperEnd(p) }, d.id).length).length, 0);

  const setChief = async (p: Paper, staffId: string) => {
    try {
      if (!staffId) await examAction(p.cycleId, "schedule", { changes: [{ paperId: p.id, revision: p.scheduleRevision || 0, date: p.date, start: p.start, duration: p.duration, venue: p.venue, invigilatorId: "", scheduleStatus: "Scheduled" }], reason: "Chief invigilator cleared", notify: true });
      else await examAction(p.cycleId, "duty", { paperId: p.id, dutyId: `chief_${p.id}`, staffId, role: "Chief Invigilator", hall: p.venue, venue: p.venue, candidates: candidatesOf(p) });
      toast(staffId ? `${name(staffId)} is chief invigilator; teacher notified` : "Chief invigilator cleared");
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update the paper", "error"); }
  };

  const saveDuty = async (p: Paper, v: { staffId: string; role: DutyRole; hall: string; venue: string; candidates: number; note: string; reportBy: string }, edit?: Duty) => {
    try {
      await examAction(p.cycleId, "duty", { paperId: p.id, ...v, ...(edit ? { dutyId: edit.id } : {}) });
      toast(edit ? "Duty updated" : `${name(v.staffId)} assigned; teacher notified`); setForm(null);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not save the duty", "error"); }
  };

  return (
    <Card className="mt-6" id="duties">
      <CardHeader title="EXAM DUTIES & INVIGILATION" subtitle="Allocate chief invigilators, invigilators and relievers per paper. Teachers see their duties in the app and are notified."
        actions={<span className="flex flex-wrap items-center gap-2 text-on-surface-variant"><span><b className="text-on-surface">{cycleDuties.length}</b> duties</span>
          {noChief > 0 && <Badge tone="warning">{noChief} without chief</Badge>}{clashCount > 0 && <Badge tone="danger"><AlertTriangle size={12} />{clashCount} clash{clashCount > 1 ? "es" : ""}</Badge>}</span>} />
      <div className="flex flex-wrap items-center gap-3 px-5 pb-4">
        <Button size="sm" variant="outline" onClick={() => setPrint(true)}><Printer size={14} />Print duty sheet</Button>
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

      {dutySummary.length > 0 && <div className="px-5 pb-5"><h3 className="mb-3 font-semibold">Staff duty summary</h3><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{dutySummary.map((s) => <div key={s.id} className="rounded border border-outline-variant/60 p-3"><p className="font-semibold">{s.name}</p><p className="mt-1 text-xs text-outline">{s.count} papers · {s.hours.toFixed(1)} hours · {s.chief} chief duties</p></div>)}</div></div>}
      {form && <DutyForm key={form.edit?.id ?? form.paper.id} paper={form.paper} edit={form.edit} staff={staff} candidates={candidatesOf(form.paper)}
        taken={[form.edit?.role === "Chief Invigilator" && form.edit.staffId === form.paper.invigilatorId ? "" : form.paper.invigilatorId ?? "", ...dutiesOf(form.paper).filter((d) => d.id !== form.edit?.id).map((d) => d.staffId)].filter(Boolean)}
        clashFor={(sid) => clashes(sid, { ...form.paper, end: paperEnd(form.paper) }, form.edit?.id)}
        onClose={() => setForm(null)} onSave={(v) => saveDuty(form.paper, v, form.edit)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove duty?" subtitle={del ? `${name(del.staffId)} · ${del.role}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          try { await examAction(del!.cycleId, "duty", { paperId: del!.paperId, dutyId: del!.id, remove: true }); toast("Duty removed"); } catch (e) { toast(e instanceof Error ? e.message : "Could not remove the duty", "error"); } setDel(null); }}>Remove</Button></>}>
        <p className="text-on-surface-variant">The duty disappears from the teacher&apos;s Exam duties screen.</p></Modal>
      <Modal open={print} onClose={() => setPrint(false)} title="Invigilation duty sheet" width="max-w-4xl" footer={<Button onClick={() => window.print()}><Printer size={15} />Print A4 duty sheet</Button>}>
        <style>{`@media print { @page { size: A4; margin: 15mm; } body * { visibility: hidden; } #exam-duty-print, #exam-duty-print * { visibility: visible; } #exam-duty-print { position: absolute; inset: 0; background: white; color: black; } #exam-duty-print tr { break-inside: avoid; } }`}</style>
        <div id="exam-duty-print"><h2 className="mb-4 text-lg font-semibold">{cycles.find((c) => c.id === curId)?.title} · Invigilation duties</h2><table className="w-full text-left text-xs"><thead><tr><th>Staff / role</th><th>Paper</th><th>Schedule</th><th>Hall</th><th>Report by</th><th>Candidates</th></tr></thead><tbody>{cyclePapers.flatMap((p) => [{ id: `chief_${p.id}`, staffId: p.invigilatorId || "", role: "Chief Invigilator", hall: p.venue, reportBy: fromMin(Math.max(0, toMin(p.start) - 30)), candidates: candidatesOf(p) }, ...dutiesOf(p).filter((d) => d.role !== "Chief Invigilator")].filter((d) => d.staffId).map((d) => <tr key={d.id} className="border-t border-outline-variant"><td className="py-3">{name(d.staffId)}<br />{d.role}</td><td>{p.subject} · Grade {p.grade}</td><td>{p.date}<br />{p.start}–{paperEnd(p)}</td><td>{d.hall}</td><td>{d.reportBy}</td><td>{d.candidates}</td></tr>))}</tbody></table></div>
      </Modal>
    </Card>
  );
}

function ClashNote({ list }: { list: Slot[] }) {
  if (!list.length) return null;
  return <span className="mt-0.5 flex items-center gap-1 text-xs text-warning"><AlertTriangle size={12} />Clash: {list.map((s) => `${s.label} ${t12(s.start)}`).join(", ")}</span>;
}

function DutyForm({ paper, edit, staff, candidates, taken, clashFor, onClose, onSave }: {
  paper: Paper; edit?: Duty; staff: StaffRow[]; candidates: number; taken: string[]; clashFor: (staffId: string) => Slot[]; onClose: () => void;
  onSave: (v: { staffId: string; role: DutyRole; hall: string; venue: string; candidates: number; note: string; reportBy: string }) => Promise<void>;
}) {
  const [v, setV] = useState({ staffId: edit?.staffId ?? "", role: edit?.role ?? "Invigilator" as DutyRole, hall: edit?.hall ?? "", venue: edit?.venue ?? paper.venue, candidates: edit?.candidates ?? candidates, note: edit?.note ?? "", reportBy: edit?.reportBy || fromMin(Math.max(0, toMin(paper.start) - 30)) });
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);
  const clash = v.staffId ? clashFor(v.staffId) : [];
  const dup = taken.includes(v.staffId);
  const submit = async () => {
    if (!v.staffId) return setErr("Pick a staff member");
    if (dup) return setErr("This staff member already has a duty on this paper");
    if (clash.length) return setErr("This staff member has an overlapping duty. Choose another invigilator.");
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
          <AlertTriangle size={16} className="mt-0.5 shrink-0" /><span>Overlapping duty on {dateLabel(paper.date)}: {clash.map((s) => `${s.label} (${s.start}–${s.end})`).join(", ")}. Choose another staff member or change the timetable.</span></div>}
        <Field label="Role"><Select value={v.role} onChange={(e) => setV({ ...v, role: e.target.value as DutyRole })}>{ROLES.map((r) => <option key={r}>{r}</option>)}</Select></Field>
        <Field label="Hall / room" required><Input value={v.hall} onChange={(e) => setV({ ...v, hall: e.target.value })} placeholder="e.g. Hall 3" /></Field>
        <Field label="Reporting time"><Input type="time" value={v.reportBy} onChange={(e) => setV({ ...v, reportBy: e.target.value })} /></Field>
        <Field label="Venue" hint="From the paper"><Input value={v.venue} onChange={(e) => setV({ ...v, venue: e.target.value })} /></Field>
        <Field label="Candidates" hint="From the paper's classes"><Input type="number" min={0} value={Number.isNaN(v.candidates) ? "" : v.candidates} onChange={(e) => setV({ ...v, candidates: e.target.value === "" ? NaN : Number(e.target.value) })} /></Field>
        <Field label="Note" className="sm:col-span-2"><Input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} placeholder="Optional instructions for the teacher" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Report by {t12(fromMin(toMin(paper.start) - 30))} (30 minutes before the paper starts).</p>
      {err && <p className="mt-2 text-xs text-error">{err}</p>}
    </Modal>
  );
}
