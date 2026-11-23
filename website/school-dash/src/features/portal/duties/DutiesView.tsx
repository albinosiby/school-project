"use client";
// Staff portal › Exam duties: the teacher's invigilation duties (exm_duties where staffId == staffId, plus papers she is
// chief invigilator of), the candidates of each paper's classes with present / absent ticks kept in the private
// ed_cand_state overlay and the duty checklist / final-list submission in ed_duty_state, exactly as the teacher app's
// ExamDutiesAdapter / ExamCandidatesAdapter store them.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardHeader, Checkbox, EmptyState, PageHeader, Select, Tabs, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import type { Candidate, Cycle, Paper } from "@/features/exams/types";
import {
  DUTY_CHECKLIST, candStateDoc, dutyStateDoc, emptyCandState, emptyDutyState, myDuties, overlayId, paperCandidates, today,
  type CandState, type DutyDoc, type DutyRow, type DutyState,
} from "../exams";

type DutyStateRow = DutyState & { id: string; dutyId: string };
type CandStateRow = CandState & { id: string; dutyId: string; candId: string };

export function DutiesView() {
  const { staffId, teaching } = useStaffProfile();
  const duties = useCollection<DutyDoc>("exm_duties", teaching, [["staffId", "==", staffId]]);
  const papers = useCollection<Paper>("exm_papers", teaching);
  const cycles = useCollection<Cycle>("exm_cycles", teaching);
  const dutyStates = useCollection<DutyStateRow>("ed_duty_state", teaching, [["teacherId", "==", staffId]]);
  const [tab, setTab] = useState<"upcoming" | "completed">("upcoming");
  const [openId, setOpenId] = useState<string | null>(null);
  if (!teaching) return <EmptyState title="Only teachers have exam duties" hint="Invigilation duties are allotted to teaching staff by the exam office." />;

  const rows = myDuties(duties.rows, papers.rows, cycles.rows, staffId, today());
  const open = openId ? rows.find((d) => d.id === openId) : undefined;
  if (open) return <DutyHall duty={open} paper={papers.rows.find((p) => p.id === open.paperId)} state={dutyStates.rows.find((s) => s.id === overlayId(open.id, staffId))} onBack={() => setOpenId(null)} />;

  const shown = rows.filter((d) => d.status === tab);
  const counts = { upcoming: rows.filter((d) => d.status === "upcoming").length, completed: rows.filter((d) => d.status === "completed").length };
  return <div className="space-y-5">
    <PageHeader title="Exam duties" subtitle="Your invigilation duties. Open a hall to take the candidates' attendance and submit the final list." />
    <Tabs items={[{ id: "upcoming", label: "Upcoming", count: counts.upcoming }, { id: "completed", label: "Past", count: counts.completed }]} value={tab} onChange={(id) => setTab(id as typeof tab)} />
    {!duties.ready ? <p className="text-on-surface-variant">Loading…</p>
      : !shown.length ? <EmptyState title={tab === "upcoming" ? "No upcoming duties" : "No past duties"} hint="Duties allotted by the exam office appear here." />
      : <div className="grid gap-3 md:grid-cols-2">
        {shown.map((d) => {
          const submitted = dutyStates.rows.find((s) => s.id === overlayId(d.id, staffId))?.submitted;
          return <Card key={d.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-semibold">{d.subject}{d.grade ? ` — Class ${d.grade}` : ""}</p><p className="text-xs text-on-surface-variant">{[d.cycle, d.code, d.note].filter(Boolean).join(" • ")}</p></div>
              <Badge tone={d.chief ? "brand" : "neutral"}>{d.role}</Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-on-surface-variant">Date</dt><dd>{d.date || "TBD"}</dd>
              <dt className="text-on-surface-variant">Time</dt><dd>{d.start} – {d.end}</dd>
              <dt className="text-on-surface-variant">Hall</dt><dd>{d.hall || "—"}</dd>
              <dt className="text-on-surface-variant">Classes</dt><dd>{d.classLabels.length ? d.classLabels.join(", ") : d.grade ? `All of grade ${d.grade}` : "—"}</dd>
              <dt className="text-on-surface-variant">Report by</dt><dd>{d.report} · {d.control}</dd>
            </dl>
            <div className="mt-3 flex items-center justify-between gap-2">
              {submitted ? <Badge tone="success">Attendance submitted</Badge> : <span />}
              <Button size="sm" variant="outline" aria-label={`Open hall for ${d.subject}`} onClick={() => setOpenId(d.id)}>Open hall</Button>
            </div>
          </Card>;
        })}
      </div>}
  </div>;
}

function DutyHall({ duty, paper, state, onBack }: { duty: DutyRow; paper?: Paper; state?: DutyStateRow; onBack: () => void }) {
  const toast = useToast();
  const { staffId } = useStaffProfile();
  const candidates = useCollection<Candidate>("exm_candidates");
  const dutyStates = useCollection<DutyStateRow>("ed_duty_state", true, [["teacherId", "==", staffId]]);
  const candStates = useCollection<CandStateRow>("ed_cand_state", true, [["teacherId", "==", staffId]]);
  const hall = paperCandidates(paper, candidates.rows);
  const dutyState: DutyState = { ...emptyDutyState(), ...(state ?? {}) };
  const stateOf = (candId: string): CandState => ({ ...emptyCandState(), ...(candStates.rows.find((s) => s.id === overlayId(`${duty.id}__${candId}`, staffId)) ?? {}) });
  const present = hall.filter((c) => stateOf(c.id).status !== "absent").length;

  const writeDuty = async (patch: Partial<DutyState>) => {
    try { await dutyStates.create({ id: overlayId(duty.id, staffId), ...dutyStateDoc(duty.id, { ...dutyState, ...patch }), teacherId: staffId } as DutyStateRow & { teacherId: string }); }
    catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not save", "error"); }
  };
  const mark = async (c: Candidate, status: CandState["status"]) => {
    const id = `${duty.id}__${c.id}`;
    try {
      await candStates.create({ id: overlayId(id, staffId), ...candStateDoc(duty.id, c.id, { ...stateOf(c.id), status }), teacherId: staffId } as CandStateRow & { teacherId: string });
      toast(`${c.name} marked ${status}`);
    } catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not save", "error"); }
  };
  const submit = async () => { await writeDuty({ submitted: true }); toast("Final attendance list submitted"); };

  return <div className="space-y-5">
    <PageHeader title={`${duty.subject}${duty.grade ? ` — Class ${duty.grade}` : ""}`} subtitle={`${duty.date || "Date TBD"} · ${duty.start} – ${duty.end} · ${duty.hall || "Hall TBD"} · ${duty.role}`}
      actions={<>
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} />All duties</Button>
        {dutyState.submitted ? <Badge tone="success">Attendance submitted</Badge> : <Button onClick={submit} disabled={!hall.length}>Submit final attendance</Button>}
      </>} />
    <Card className="p-4">
      <p className="mb-2 font-semibold">Invigilation checklist</p>
      <ul className="space-y-2 text-sm">
        {DUTY_CHECKLIST.map((item, index) => <li key={item} className="flex items-center gap-2">
          <Checkbox aria-label={item} checked={dutyState.checked.includes(index)}
            onChange={(e) => writeDuty({ checked: e.target.checked ? [...new Set([...dutyState.checked, index])].sort((a, b) => a - b) : dutyState.checked.filter((i) => i !== index) })} />
          <span>{item}</span>
        </li>)}
      </ul>
    </Card>
    <Card>
      <CardHeader title="Candidates" subtitle={`${present} present · ${hall.length - present} absent of ${hall.length}`} />
      {!hall.length ? <EmptyState title="No candidates listed" hint="Candidates appear once the exam office has generated the candidate list for this paper." />
        : <table className="w-full border-collapse text-left text-sm">
          <thead><tr className="border-y border-outline-variant/60 bg-surface-container-low text-xs uppercase text-on-surface-variant">
            <th className="px-5 py-2.5">Desk</th><th className="px-4 py-2.5">Candidate</th><th className="px-4 py-2.5">Class</th><th className="px-4 py-2.5">Attendance</th>
          </tr></thead>
          <tbody>{hall.map((c, n) => {
            const s = stateOf(c.id);
            return <tr key={c.id} className="border-b border-outline-variant/40">
              <td className="px-5 py-2 font-mono text-xs">D-{String(n + 1).padStart(2, "0")}</td>
              <td className="px-4 py-2"><div className="font-semibold">{c.name}</div><div className="text-xs text-outline">{[c.roll, c.grn && `GRN ${c.grn}`].filter(Boolean).join(" · ")}</div></td>
              <td className="px-4 py-2">{c.cls || `${c.grade}-${c.section}`}</td>
              <td className="px-4 py-2"><Select aria-label={`Attendance for ${c.name}`} value={s.status} disabled={dutyState.submitted} className="w-32" onChange={(e) => mark(c, e.target.value as CandState["status"])}>
                <option value="present">Present</option><option value="absent">Absent</option></Select></td>
            </tr>;
          })}</tbody>
        </table>}
    </Card>
  </div>;
}
