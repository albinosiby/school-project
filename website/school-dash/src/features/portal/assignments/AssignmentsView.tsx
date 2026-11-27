"use client";
// /me/assignments: every assignment across the teacher's classes (assignments_screen.dart): what needs reviewing,
// what is due, what is scheduled and what is closed. A card opens the assignment; "New assignment" opens the form.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronRight, MessageSquareText, Paperclip, Plus } from "lucide-react";
import { Badge, Card, EmptyState, LoadingSkeleton, PageHeader, Tabs } from "@/components/ui";
import { cn } from "@/lib/cn";
import { classIdLabel, todayIso } from "../teaching";
import { useAssignments } from "./useAssignments";
import {
  TABS, assignmentBoard, assignmentItems, attachmentsOf, badgeTone, cardLine, daysLeft, groupActive, isGraded, maxMarksOf, monthShort,
  type Item, type Tab,
} from "./logic";

const EMPTY: Record<Tab, [string, string]> = {
  active: ["No active assignments", "Use New assignment to set one for a class."],
  review: ["Nothing to review", "Hand-ins waiting for marks show here."],
  upcoming: ["Nothing scheduled", "Assignments set to publish later show here."],
  closed: ["No closed assignments", "Use New assignment to set one for a class."],
};

export function AssignmentsView() {
  const { data, rows, rosterOf, ready } = useAssignments();
  const today = todayIso();
  const [tab, setTab] = useState<Tab>("active");
  const [classId, setClassId] = useState("");
  const everyone = useMemo(() => data.students.map((s) => ({ id: s.id, name: s.name, roll: s.roll })), [data.students]);
  const all = useMemo(() => assignmentItems(rows, rosterOf, everyone), [rows, rosterOf, everyone]);

  if (!data.teaching) return <EmptyState title="Only teachers have assignments" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!ready) return <LoadingSkeleton variant="table" label="Loading assignments…" />;

  const usedClasses = [...new Set(all.map((a) => a.hw.classId))].sort();
  const mine = all.filter((a) => !classId || a.hw.classId === classId);
  const board = assignmentBoard(mine, today);
  const list = board.lists[tab];
  const newHref = classId ? `/me/assignments/new?classId=${encodeURIComponent(classId)}` : "/me/assignments/new";
  const firstReview = board.lists.review[0];

  return <div className="space-y-5">
    <PageHeader title="Assignments" subtitle={`${board.active} active • ${board.toReview} to review`}
      actions={data.classIds.length ? <Link href={newHref} className="inline-flex h-10 items-center gap-2 rounded bg-secondary px-4 text-sm font-semibold text-on-secondary shadow-card hover:bg-secondary-container"><Plus size={16} />New assignment</Link> : undefined} />

    <section aria-label="Overview" className="rounded-xl bg-linear-to-br from-secondary to-navy-800 p-5 text-on-secondary shadow-card">
      <div className="flex flex-wrap items-end gap-3">
        <p className="text-4xl leading-none font-bold tabular-nums">{board.toReview}</p>
        <p className="flex-1 pb-0.5 font-semibold">{board.toReview === 1 ? "hand-in to review" : "hand-ins to review"}</p>
        {firstReview && <Link href={`/me/assignments/${firstReview.hw.id}?filter=toGrade`} className="inline-flex items-center gap-1 rounded-full bg-surface-container-lowest px-3.5 py-1.5 text-sm font-semibold text-secondary hover:opacity-90">Review<ChevronRight size={16} /></Link>}
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        {([["Active", board.active], ["Due this week", board.dueWeek], ["Late hand-ins", board.late]] as const).map(([label, v]) =>
          <div key={label} className="min-w-0 rounded-lg bg-white/15 px-3 py-2"><dd className="text-lg font-bold tabular-nums">{v}</dd><dt className="truncate text-xs opacity-80">{label}</dt></div>)}
      </dl>
    </section>

    {usedClasses.length > 1 && <div role="group" aria-label="Class filter" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {[["", "All classes"], ...usedClasses.map((id) => [id, `Class ${classIdLabel(id)}`])].map(([id, label]) =>
        <button key={id} type="button" aria-pressed={classId === id} onClick={() => setClassId(id!)}
          className={cn("shrink-0 cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors",
            classId === id ? "border-inverse-surface bg-inverse-surface text-inverse-on-surface" : "border-outline-variant bg-surface-container-lowest text-on-surface hover:bg-surface-container-low")}>{label}</button>)}
    </div>}

    <Tabs items={TABS.map(([id, label]) => ({ id, label, count: board.lists[id].length }))} value={tab} onChange={(t) => setTab(t as Tab)} />

    {!list.length ? <Card><EmptyState title={EMPTY[tab][0]} hint={EMPTY[tab][1]} /></Card>
      : tab === "active" ? groupActive(list, today).map((g) => <section key={g.group} aria-label={g.group} className="space-y-2.5">
        <h2 className={cn("t-label-caps px-0.5", g.group === "Overdue" ? "text-error" : "text-on-surface-variant")}>{g.group} <span className="opacity-70">{g.items.length}</span></h2>
        {g.items.map((a) => <AssignmentCard key={a.hw.id} a={a} today={today} />)}
      </section>)
      : <div className="space-y-2.5">{list.map((a) => <AssignmentCard key={a.hw.id} a={a} today={today} />)}</div>}
  </div>;
}

const BADGE = {
  upcoming: "bg-tertiary-fixed text-on-tertiary-fixed-variant", closed: "bg-surface-container text-on-surface-variant",
  overdue: "bg-error-container text-on-error-container", soon: "bg-warning-container text-warning", brand: "bg-info-container text-secondary",
};

function AssignmentCard({ a, today }: { a: Item; today: string }) {
  const { hw: h, stats: st } = a;
  const tone = badgeTone(a, today);
  const due = /^\d{4}-\d{2}-(\d{2})/.exec(h.due ?? "");
  const left = daysLeft(h.due, today);
  const files = attachmentsOf(h).length;
  const pct = (n: number) => (st.total ? (n * 100) / st.total : 0);
  return <Link href={`/me/assignments/${h.id}`} aria-label={`Assignment ${h.title}`}
    className="block rounded-xl border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-card transition-colors hover:border-secondary/50">
    <div className="flex items-start gap-3">
      <div className={cn("grid w-12 shrink-0 place-items-center rounded-lg py-1.5 text-center", BADGE[tone])} aria-hidden>
        <span className="text-xl leading-tight font-bold">{due ? Number(due[1]) : "—"}</span>
        <span className="t-caption uppercase">{due ? monthShort(h.due) : ""}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="t-caption truncate tracking-wide text-on-surface-variant uppercase">{[`Class ${classIdLabel(h.classId)}`, h.subject].filter(Boolean).join(" • ")}</p>
        <p className="line-clamp-2 font-semibold text-on-surface">{h.title}</p>
        <p className={cn("text-xs font-semibold", a.phase === "upcoming" ? "text-on-tertiary-fixed-variant" : a.phase === "active" && left !== null && left < 0 ? "text-error" : "text-on-surface-variant")}>{cardLine(a, today)}</p>
      </div>
      <ChevronRight size={20} className="mt-1 shrink-0 text-outline" />
    </div>
    {a.phase !== "upcoming" && <div className="mt-3 flex items-center gap-3">
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high" role="progressbar" aria-label="Handed in" aria-valuenow={Math.round(pct(st.turnedIn))} aria-valuemin={0} aria-valuemax={100}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-secondary/35" style={{ width: `${pct(st.turnedIn)}%` }} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-success" style={{ width: `${pct(st.graded)}%` }} />
      </div>
      <span className="text-xs whitespace-nowrap text-on-surface tabular-nums">{st.turnedIn}/{st.total} handed in</span>
    </div>}
    <div className="mt-2.5 flex flex-wrap gap-1.5">
      {st.toGrade > 0 && <Badge tone="warning"><MessageSquareText size={12} />{st.toGrade} to review</Badge>}
      {st.late > 0 && <Badge tone="danger">{st.late} late</Badge>}
      {a.phase !== "upcoming" && st.graded > 0 && <Badge tone="success">{st.graded} graded</Badge>}
      <Badge>{isGraded(h) ? `Out of ${maxMarksOf(h)}` : "Not graded"}</Badge>
      {files > 0 && <Badge><Paperclip size={12} />{files} {files === 1 ? "file" : "files"}</Badge>}
    </div>
  </Link>;
}
