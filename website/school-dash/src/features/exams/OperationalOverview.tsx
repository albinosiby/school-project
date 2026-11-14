"use client";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, ClipboardList } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { consolidated, participates } from "../../../../functions/examOperations";
import { evaluate, type Candidate, type Cycle, type Mark, type Paper } from "./types";
import type { ExamActivity, ReportBatch, ScheduleHistory } from "./examService";

export const cycleState = (cycle: Cycle, papers: Paper[], date: string) =>
  cycle.status === "Draft"
    ? "Draft"
    : cycle.operationalStatus === "Postponed"
      ? "Postponed"
      : (papers.length &&
            papers.every((p) => p.scheduleStatus === "Cancelled" || p.status === "Completed")) ||
          (cycle.end && cycle.end < date)
        ? "Completed"
        : cycle.start && cycle.start <= date && date <= cycle.end
          ? "Ongoing"
          : "Upcoming";

export function OperationalOverview({
  cycles,
  papers,
  active,
  candidates,
  marks,
}: {
  cycles: Cycle[];
  papers: Paper[];
  active?: Cycle;
  candidates: Candidate[];
  marks: Mark[];
}) {
  const { date, timezone } = useSchoolClock();
  const activity = useCollection<ExamActivity>(
    "exm_activity",
    !!active,
    active ? [["cycleId", "==", active.id]] : [],
  ).rows;
  const batches = useCollection<ReportBatch>(
    "exm_report_batches",
    !!active,
    active ? [["cycleId", "==", active.id]] : [],
  ).rows;
  const history = useCollection<ScheduleHistory>(
    "exm_schedule_history",
    !!active,
    active ? [["cycleId", "==", active.id]] : [],
  ).rows;
  const sources = new Set([
    ...history.map((h) => `exam:schedule:${h.id}`),
    ...batches.map((b) => `exam:reports:${b.id}`),
  ]);
  const deliveries = useCollection<{ id: string; source: string; status: string }>(
    "push_deliveries",
  ).rows.filter((d) => sources.has(d.source));
  const selected = papers.filter((p) => p.cycleId === active?.id && p.scheduleStatus !== "Cancelled");
  const entries = selected.flatMap((paper) =>
    candidates
      .filter((c) => participates(paper, c))
      .map((c) => ({
        paper,
        result: evaluate(
          marks.find((m) => m.paperId === paper.id && (m.candId === c.id || m.studentId === c.studentId)),
          paper.theory,
          paper.internal,
          paper,
        ),
      })),
  );
  const entered = entries.filter((e) => !["pending", "invalid"].includes(e.result.state)).length;
  const unverified = entries.filter((e) => ["passed", "failed"].includes(e.result.state)).length;
  const upcoming = papers
    .filter(
      (p) =>
        p.date >= date &&
        !["Postponed", "Cancelled"].includes(p.scheduleStatus || "") &&
        p.status !== "Completed" &&
        p.setupPublished !== false,
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, 5);
  const attention = [
    {
      label: "Entries awaiting marks",
      count: entries.filter((e) => ["pending", "invalid"].includes(e.result.state)).length,
      tab: "marks",
    },
    { label: "Marks pending verification", count: unverified, tab: "verification" },
    {
      label: "Papers without a chief invigilator",
      count: selected.filter((p) => !p.invigilatorId && p.scheduleStatus !== "Postponed").length,
      tab: "invigilation",
    },
    {
      label: "Postponed papers awaiting a new date",
      count: selected.filter((p) => p.scheduleStatus === "Postponed").length,
      tab: "timetable",
    },
    {
      label: "Results awaiting approval",
      count: batches.filter((b) => b.status === "Pending approval").length,
      tab: "reports",
    },
    {
      label: "Failed / undelivered notifications",
      count:
        deliveries.filter((d) => ["Failed", "No devices"].includes(d.status)).length +
        history.filter((h) => h.notificationStatus === "Failed").length +
        batches.filter((b) => b.notificationStatus === "Failed").length,
      tab: "activity",
    },
  ];
  const complete = active
    ? consolidated(active, selected, candidates, marks).filter((r) => r.complete && r.pct !== null)
    : [];
  return (
    <div className="mt-6 space-y-5">
      <Card>
        <CardHeader title="Examination overview" subtitle="Live operational status across this school" />
        <div className="grid grid-cols-2 gap-4 px-5 pb-5 sm:grid-cols-3 xl:grid-cols-6">
          {["Total", "Upcoming", "Ongoing", "Completed", "Postponed", "Draft"].map((state) => (
            <div key={state}>
              <p className="text-xs text-on-surface-variant">{state === "Total" ? "Exam cycles" : state}</p>
              <p className="mt-1 text-2xl font-semibold">
                {state === "Total"
                  ? cycles.length
                  : cycles.filter(
                      (c) =>
                        cycleState(
                          c,
                          papers.filter((p) => p.cycleId === c.id),
                          date,
                        ) === state,
                    ).length}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title={active?.title || "Active examination"}
            subtitle={`${active?.academicYear || active?.term || "Academic year not set"} · ${timezone}`}
            actions={
              active && (
                <Link
                  href={`/exams/${active.id}`}
                  className="flex items-center gap-1 text-sm font-semibold text-secondary"
                >
                  Open examination <ArrowUpRight size={16} />
                </Link>
              )
            }
          />
          {!active ? (
            <EmptyState title="No exam cycles" hint="Create an exam cycle to start planning." />
          ) : (
            <div className="space-y-4 px-5 pb-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone="brand">{cycleState(active, selected, date)}</Badge>
                <Badge>{new Set(selected.flatMap((p) => p.classIds || [])).size} divisions</Badge>
                <Badge>{selected.length} papers</Badge>
                <Badge>{selected.filter((p) => p.status === "Completed").length} completed</Badge>
              </div>
              <div>
                <div className="flex justify-between text-sm">
                  <span>Marks-entry completion</span>
                  <b>
                    {entered} / {entries.length}
                  </b>
                </div>
                <progress
                  className="mt-2 h-2 w-full accent-secondary"
                  value={entered}
                  max={entries.length || 1}
                />
              </div>
              <div className="flex flex-wrap justify-between gap-2 text-sm text-on-surface-variant">
                <span>
                  {batches.filter((b) => b.status === "Published").length} divisions with published report
                  cards
                </span>
                <span>{complete.length} complete numeric results</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  ["Manage timetable", "timetable"],
                  ["Enter marks", "marks"],
                  ["Manage invigilation", "invigilation"],
                  ["Review results", "results"],
                  ["Download reports", "reports"],
                ].map(([label, tab]) => (
                  <Link key={tab} href={`/exams/${active.id}?tab=${tab}`}>
                    <Button size="sm" variant="outline">
                      {label}
                    </Button>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Attention required" subtitle="Open an item to resolve it" />
          <div className="space-y-2 px-5 pb-5">
            {attention.map((item) => (
              <Link
                key={item.tab + item.label}
                href={active ? `/exams/${active.id}?tab=${item.tab}` : "/exams/new"}
                className="flex items-center justify-between gap-4 rounded border border-outline-variant/60 px-3 py-2 text-sm hover:bg-surface-container-low"
              >
                <span>{item.label}</span>
                <Badge tone={item.count ? "warning" : "neutral"}>{item.count}</Badge>
              </Link>
            ))}
          </div>
        </Card>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming timetable" subtitle="Next scheduled papers · school local time" />
          <div className="divide-y divide-outline-variant/60">
            {upcoming.map((p) => (
              <Link
                key={p.id}
                href={`/exams/${p.cycleId}?tab=timetable`}
                className="flex items-start gap-3 px-5 py-3 hover:bg-surface-container-low"
              >
                <CalendarClock size={17} className="mt-1 text-secondary" />
                <div className="flex-1">
                  <p className="font-semibold">
                    Grade {p.grade} · {p.subject}
                  </p>
                  <p className="text-xs text-on-surface-variant">
                    {p.date} · {p.start} · {p.venue || "Room unassigned"}
                  </p>
                  <p className="text-xs text-outline">
                    {p.invigilator || "Chief unassigned"} · {(p.classIds || []).length} divisions
                  </p>
                </div>
                <Badge>{p.scheduleStatus || p.status}</Badge>
              </Link>
            ))}
            {!upcoming.length && <EmptyState title="No upcoming papers" />}
          </div>
        </Card>
        <Card>
          <CardHeader title="Recent activity" subtitle="Server-recorded events for the selected exam" />
          <div className="divide-y divide-outline-variant/60">
            {[...activity]
              .sort((a, b) => b.at.localeCompare(a.at))
              .slice(0, 5)
              .map((a) => (
                <div key={a.id} className="flex gap-3 px-5 py-3">
                  <ClipboardList size={17} className="mt-1 text-outline" />
                  <div>
                    <p className="text-sm font-semibold">{a.action}</p>
                    <p className="text-xs text-outline">
                      {a.actorName || a.actorId} ·{" "}
                      {new Date(a.at).toLocaleString("en-IN", { timeZone: timezone })}
                    </p>
                  </div>
                </div>
              ))}
            {!activity.length && (
              <EmptyState
                title="No recorded activity yet"
                hint="New examination actions will appear here."
              />
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
