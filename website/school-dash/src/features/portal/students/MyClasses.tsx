"use client";
// /me/students: the teacher's classes (assignments, periods, class teacher) with their student lists, and — for classes
// the teacher is class teacher of — parent leave requests (`student_leaves`) to approve or reject.
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, LoadingSkeleton, Modal, PageHeader, Tabs, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, classRoster, useTeachingData } from "../teaching";
import { decidedLeaves, decisionNoteError, decisionPatch, leaveRange, myClasses, pendingLeaves, type Decision, type StudentLeave } from "./logic";

export function MyClasses() {
  const toast = useToast();
  const data = useTeachingData();
  const leaves = useCollection<StudentLeave>("student_leaves", data.teaching);
  const [open, setOpen] = useState<string[]>([]);
  const [tab, setTab] = useState("pending");
  const [decide, setDecide] = useState<{ leave: StudentLeave; status: Decision } | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  if (!data.teaching) return <EmptyState title="Only teachers have classes" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !leaves.ready) return <LoadingSkeleton variant="card" label="Loading your classes…" />;
  const classes = myClasses(data.staffId, { assignments: data.assignments, classes: data.classes, periods: data.periods });
  const classTeacherIds = classes.filter((c) => c.classTeacher).map((c) => c.id);
  const pending = pendingLeaves(leaves.rows, classTeacherIds);
  const decided = decidedLeaves(leaves.rows, classTeacherIds);
  const toggle = (id: string) => setOpen((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  const studentName = (l: StudentLeave) => l.name || data.students.find((s) => s.id === l.studentId)?.name || l.studentId;

  async function confirmDecision() {
    if (!decide) return;
    const why = decisionNoteError(note);
    if (why) { toast(why, "error"); return; }
    setBusy(true);
    try {
      await leaves.update(decide.leave.id, decisionPatch(decide.status, note, data.staffId));
      toast(`Leave ${decide.status.toLowerCase()} for ${studentName(decide.leave)}`);
      setDecide(null); setNote("");
    } catch { toast("Could not save the decision", "error"); } finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <PageHeader title="My classes" subtitle={`${classes.length} ${classes.length === 1 ? "class" : "classes"}${classTeacherIds.length ? ` · class teacher of ${classTeacherIds.map(classIdLabel).join(", ")}` : ""}`} />
    {!classes.length && <Card><EmptyState title="No classes yet" hint="Classes appear here once the school assigns you subjects or periods." /></Card>}
    {classes.map((c) => {
      const roster = classRoster(data.students, c.id);
      const expanded = open.includes(c.id);
      return <Card key={c.id} role="region" aria-label={`Class ${classIdLabel(c.id)}`}>
        <button type="button" className="flex w-full cursor-pointer items-center gap-3 p-5 text-left" aria-expanded={expanded} onClick={() => toggle(c.id)}>
          {expanded ? <ChevronDown size={18} className="text-outline" /> : <ChevronRight size={18} className="text-outline" />}
          <div className="min-w-0 flex-1">
            <p className="font-semibold">Grade {classIdLabel(c.id)}{c.room ? <span className="ml-2 text-xs font-normal text-on-surface-variant">Room {c.room}</span> : null}</p>
            <p className="text-sm text-on-surface-variant">{c.subjects.length ? c.subjects.join(", ") : "No subject assigned"} · {roster.length} students</p>
          </div>
          {c.classTeacher && <Badge tone="brand">Class teacher</Badge>}
        </button>
        {expanded && (roster.length ? <div className="overflow-x-auto px-5 pb-5">
          <table aria-label={`Students of ${classIdLabel(c.id)}`} className="w-full text-left text-sm">
            <thead className="text-xs text-on-surface-variant"><tr><th className="py-2 pr-3">Roll</th><th className="py-2 pr-3">Name</th><th className="py-2 pr-3">GRN</th><th className="py-2 pr-3">Guardian</th><th className="py-2">Phone</th></tr></thead>
            <tbody>{roster.map((s) => <tr key={s.id} className="border-t border-outline-variant/40">
              <td className="py-2 pr-3 tabular-nums">{s.roll ?? "—"}</td><td className="py-2 pr-3 font-medium">{s.name}</td>
              <td className="py-2 pr-3">{s.grn || s.admissionNumber || "—"}</td><td className="py-2 pr-3">{s.guardian || "—"}</td><td className="py-2 tabular-nums">{s.phone || "—"}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="px-5 pb-5 text-sm text-on-surface-variant">No active students in this class.</p>)}
      </Card>;
    })}

    {classTeacherIds.length > 0 && <Card>
      <CardHeader title="Student leave requests" subtitle="Requests from parents of your class. Approving or rejecting records your decision for the parent app." />
      <div className="px-5 pb-3"><Tabs items={[{ id: "pending", label: "Pending", count: pending.length }, { id: "decided", label: "Decided", count: decided.length }]} value={tab} onChange={setTab} /></div>
      {(tab === "pending" ? pending : decided).length === 0 && <EmptyState title={tab === "pending" ? "No pending requests" : "No decisions yet"} />}
      <ul className="divide-y divide-outline-variant/40 px-5 pb-5">
        {(tab === "pending" ? pending : decided).map((l) => <li key={l.id} className="flex flex-wrap items-start justify-between gap-3 py-3" aria-label={`Leave request of ${studentName(l)}`}>
          <div className="min-w-0">
            <p className="font-medium">{studentName(l)} <span className="text-xs font-normal text-on-surface-variant">· {classIdLabel(l.classId)}{l.roll ? ` · Roll ${l.roll}` : ""}</span></p>
            <p className="text-sm">{leaveRange(l)}{l.type ? ` · ${l.type}` : ""}{l.by ? ` · by ${l.by}` : ""}</p>
            {l.reason && <p className="text-sm text-on-surface-variant">{l.reason}</p>}
            {l.decisionNote && <p className="text-xs text-on-surface-variant">Note: {l.decisionNote}</p>}
          </div>
          {l.status === "Approved" || l.status === "Rejected" ? <Badge tone={l.status === "Approved" ? "success" : "danger"}>{l.status}</Badge> : <div className="flex gap-2">
            <Button size="sm" onClick={() => { setNote(""); setDecide({ leave: l, status: "Approved" }); }}>Approve</Button>
            <Button size="sm" variant="danger" onClick={() => { setNote(""); setDecide({ leave: l, status: "Rejected" }); }}>Reject</Button>
          </div>}
        </li>)}
      </ul>
    </Card>}

    <Modal open={!!decide} onClose={() => setDecide(null)} title={decide ? `${decide.status === "Approved" ? "Approve" : "Reject"} leave` : ""}
      subtitle={decide ? `${studentName(decide.leave)} · ${leaveRange(decide.leave)}` : undefined}
      footer={<>
        <Button variant="outline" onClick={() => setDecide(null)}>Cancel</Button>
        <Button variant={decide?.status === "Rejected" ? "danger" : "primary"} disabled={busy} onClick={confirmDecision}>{decide?.status === "Rejected" ? "Reject" : "Approve"}</Button>
      </>}>
      <Field label="Note to parent" hint="Optional. Shown with the decision in the parent app." error={decisionNoteError(note) || undefined}>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
    </Modal>
  </div>;
}
