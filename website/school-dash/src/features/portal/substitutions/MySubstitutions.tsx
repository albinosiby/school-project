"use client";
// /me/substitutions: duties where the teacher is the substitute (`ops_substitutions`), upcoming and past, with
// Accept / Decline writing only `status` (+ updatedAt / updatedBy) as the teacher app does.
import { Badge, Button, Card, CardHeader, EmptyState, LoadingSkeleton, PageHeader, useToast } from "@/components/ui";
import { subStatus, type Substitution } from "@/features/ops/logic";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, todayIso, useTeachingData } from "../teaching";
import { canDecide, decisionPatch, groupSubstitutions, subTone, type SubDecision } from "./logic";

export function MySubstitutions() {
  const toast = useToast();
  const data = useTeachingData();
  const subs = useCollection<Substitution>("ops_substitutions", data.teaching, [["substituteTeacherId", "==", data.staffId]]);
  const today = todayIso();
  if (!data.teaching) return <EmptyState title="Only teachers have substitutions" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !subs.ready) return <LoadingSkeleton variant="card" label="Loading substitutions…" />;
  const mine = subs.rows.filter((s) => s.substituteTeacherId === data.staffId);
  const { upcoming, past } = groupSubstitutions(mine, today);

  async function decide(s: Substitution, status: SubDecision) {
    try { await subs.update(s.id, decisionPatch(status)); toast(`Substitution ${status.toLowerCase()} · ${classIdLabel(s.classId)} P${s.period} on ${s.date}`); }
    catch { toast("Could not update the substitution", "error"); }
  }

  const list = (rows: Substitution[], empty: string) => (rows.length ? <ul className="divide-y divide-outline-variant/40 px-5 pb-5">
    {rows.map((s) => <li key={s.id} className="flex flex-wrap items-start justify-between gap-3 py-3" aria-label={`Substitution ${s.date} period ${s.period} ${classIdLabel(s.classId)}`}>
      <div className="min-w-0">
        <p className="font-medium">{s.date} · {s.day} · Period {s.period} · {classIdLabel(s.classId)}</p>
        <p className="text-sm">{s.subject || "—"} · covering {data.staffName(s.absentTeacherId)}</p>
        {s.topic && <p className="text-sm text-on-surface-variant">Topic: {s.topic}</p>}
        {s.note && <p className="text-sm text-on-surface-variant">Note: {s.note}</p>}
      </div>
      <div className="flex items-center gap-2">
        <Badge tone={subTone(s.status)}>{subStatus(s.status) === "Assigned" ? "Pending" : subStatus(s.status)}</Badge>
        {canDecide(s, today) && <>
          <Button size="sm" onClick={() => decide(s, "Accepted")}>Accept</Button>
          <Button size="sm" variant="outline" onClick={() => decide(s, "Declined")}>Decline</Button>
        </>}
      </div>
    </li>)}
  </ul> : <EmptyState title={empty} />);

  return <div className="space-y-5">
    <PageHeader title="Substitutions" subtitle={`${upcoming.filter((s) => subStatus(s.status) === "Assigned").length} awaiting your answer`} />
    <Card><CardHeader title="Upcoming" subtitle={`${upcoming.length} ${upcoming.length === 1 ? "duty" : "duties"}`} />{list(upcoming, "No upcoming substitutions")}</Card>
    <Card><CardHeader title="Past" subtitle={`${past.length} ${past.length === 1 ? "duty" : "duties"}`} />{list(past, "No past substitutions")}</Card>
  </div>;
}
