"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  PageHeader,
  Stat,
  Tabs,
} from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { classIdLabel } from "@/lib/academicStreams";
import { CollectionGuard } from "@/components/CollectionGuard";
import { consolidated, participates } from "../../../../functions/examOperations";
import { labelToClassId, rosterOf, studentIdOf, subjectTeacherId, type StudentRow } from "./logic";
import { evaluate, type Candidate, type Cycle, type Mark, type Paper } from "./types";
import { cycleState } from "./OperationalOverview";
import { ExamsPage, type GridFocus } from "./ExamsPage";
import { ExamDuties } from "./ExamDuties";
import { ReportCards } from "./ReportCards";
import { ScheduleManager } from "./ScheduleManager";
import { ClassResultsPanel } from "./ClassResultsPanel";
import { OpenEntryButton, SheetBoard } from "./SheetBoard";
import { legacySubmission, sheetCounts, type Sheet } from "./sheets";
import type { ExamActivity, ScheduleHistory, ReportBatch } from "./examService";

/** badge text for exm_cycles.stage (set by the server actions); the computed cycleState is the fallback */
export const stageLabel: Record<NonNullable<Cycle["stage"]>, string> = {
  setup: "Setup",
  scheduled: "Scheduled",
  entry: "Marks entry open",
  tabulation: "Tabulation",
  published: "Results published",
  closed: "Closed",
};

const sections = [
  { id: "overview", label: "Overview" },
  { id: "participants", label: "Participants" },
  { id: "assessment", label: "Assessment Configuration" },
  { id: "timetable", label: "Timetable" },
  { id: "invigilation", label: "Invigilation" },
  { id: "marks", label: "Marks Entry" },
  { id: "verification", label: "Verification" },
  { id: "results", label: "Results" },
  { id: "reports", label: "Reports" },
  { id: "activity", label: "Activity Log" },
];
export function ExamDetailPage() {
  const { id } = useParams<{ id: string }>(),
    search = useSearchParams(),
    router = useRouter();
  const cycles = useCollection<Cycle>("exm_cycles"),
    paperCol = useCollection<Paper>("exm_papers");
  const students = useCollection<StudentRow>("students").rows,
    candidateRows = useCollection<Candidate>("exm_candidates").rows;
  const candidates = rosterOf(candidateRows, students),
    marks = useCollection<Mark>("exm_marks").rows;
  const { date } = useSchoolClock();
  const sheets = useCollection<Sheet>("exm_sheets", true, [["cycleId", "==", id]]).rows.filter((s) => s.cycleId === id);
  const [focus, setFocus] = useState<GridFocus | null>(null);
  const cycle = cycles.rows.find((c) => c.id === id),
    papers = paperCol.rows.filter((p) => p.cycleId === id);
  const selected = search.get("tab") || "overview",
    tab = sections.some((s) => s.id === selected) ? selected : "overview";
  const participating = candidates.filter((c) => papers.some((p) => participates(p, c)));
  if (!cycle)
    return (
      <CollectionGuard>
        <Card className="p-6">
          {cycles.ready ? (
            <EmptyState
              title="Examination not found"
              hint="It may have been removed or belong to another school."
              action={
                <Link href="/exams">
                  <Button>Back to exams</Button>
                </Link>
              }
            />
          ) : (
            <p>Loading examination…</p>
          )}
        </Card>
      </CollectionGuard>
    );
  const overall = consolidated(cycle, papers, candidates, marks);
  return (
    <CollectionGuard>
      <Link href="/exams" className="mb-4 inline-flex items-center gap-2 text-sm text-secondary">
        <ArrowLeft size={15} />
        Exams & Results
      </Link>
      <PageHeader
        title={cycle.title}
        subtitle={`${cycle.academicYear || cycle.term || ""} · ${cycle.examType || cycle.category || "Examination"} · ${cycle.start || "Date pending"} – ${cycle.end || "Date pending"}`}
        actions={
          <>
            <Badge tone={cycle.status === "Draft" ? "neutral" : cycle.stage === "published" ? "success" : "brand"}>
              {cycle.stage ? stageLabel[cycle.stage] : cycleState(cycle, papers, date)}
            </Badge>
            <Link href={`/exams/${id}/edit`}>
              <Button variant="outline">
                {cycle.status === "Draft" ? "Continue setup" : "View exam setup"}
              </Button>
            </Link>
          </>
        }
      />
      <Tabs
        variant="underline"
        items={sections}
        value={tab}
        onChange={(next) => router.replace(`/exams/${id}?tab=${next}`, { scroll: false })}
        className="mb-6"
      />
      <div role="tabpanel" aria-label={sections.find((s) => s.id === tab)?.label}>
        {tab === "overview" && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Stat
                label="PARTICIPATING STUDENTS"
                value={participating.length}
                sub={`${new Set(participating.map((c) => c.cls)).size} divisions`}
              />
              <Stat
                label="SUBJECTS & PAPERS"
                value={papers.filter((p) => p.scheduleStatus !== "Cancelled").length}
                sub={`${new Set(papers.map((p) => p.subject)).size} subjects`}
              />
              <Stat
                label="TIMETABLE COMPLETION"
                value={`${papers.filter((p) => p.date && p.start && !["Postponed", "Cancelled"].includes(p.scheduleStatus || "")).length}/${papers.length}`}
              />
              <Stat
                label="COMPLETE RESULTS"
                value={`${overall.filter((r) => r.complete).length}/${overall.length}`}
              />
            </div>
            <Card>
              <CardHeader
                title="Examination details"
                subtitle={cycle.description || "No description added"}
              />
              <div className="space-y-4 px-5 pb-5">
                <p className="text-sm text-on-surface-variant">
                  {cycle.instructions || "No additional examination instructions."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge>Calculation: {cycle.resultRules?.calculation || "total"}</Badge>
                  <Badge>Scale: {cycle.scale || "Default"}</Badge>
                  <Badge>
                    {cycle.resultRules?.requireApproval ? "Approval required" : "Administrator publication"}
                  </Badge>
                  {cycle.correctionPending && <Badge tone="warning">Corrections in progress</Badge>}
                  {sheets.length > 0 && (
                    <Badge tone="info">
                      {sheetCounts(sheets).approved} / {sheets.length} sheets approved
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {sections
                    .filter((s) => ["timetable", "marks", "invigilation", "results", "reports"].includes(s.id))
                    .map((s) => (
                      <Link key={s.id} href={`/exams/${id}?tab=${s.id}`}>
                        <Button variant="outline" size="sm">
                          {s.label}
                        </Button>
                      </Link>
                    ))}
                  {!sheets.length && cycle.status !== "Draft" && !!cycle.end && date > cycle.end && (
                    <OpenEntryButton cycle={cycle} size="sm" />
                  )}
                </div>
              </div>
            </Card>
            <MarksProgress cycle={cycle} papers={papers} candidates={candidates} marks={marks} sheets={sheets} />
          </div>
        )}
        {tab === "participants" && (
          <Card>
            <CardHeader
              title="Participating students"
              subtitle={`${participating.length} students · ${cycle.excludedStudentIds?.length || 0} explicitly excluded from this examination`}
            />
            <DataTable
              rows={participating}
              searchText={(c) => `${c.name} ${c.grn} ${c.cls}`}
              columns={[
                { key: "name", header: "Student", render: (c) => c.name },
                { key: "grn", header: "Admission no.", render: (c) => c.grn || "—" },
                { key: "class", header: "Class / division", render: (c) => c.cls },
                { key: "roll", header: "Roll", render: (c) => c.roll },
                {
                  key: "papers",
                  header: "Papers",
                  render: (c) => papers.filter((p) => participates(p, c)).length,
                },
              ]}
            />
          </Card>
        )}
        {tab === "assessment" && (
          <Card>
            <CardHeader
              title="Assessment configuration"
              subtitle="The published setup is preserved. Operational schedule changes are managed in Timetable."
            />
            <DataTable
              rows={papers}
              columns={[
                {
                  key: "subject",
                  header: "Subject / divisions",
                  render: (p) => (
                    <span>
                      {p.subject}
                      <span className="block text-xs text-outline">
                        {p.classIds?.map(classIdLabel).join(", ") || `Grade ${p.grade}`}
                      </span>
                    </span>
                  ),
                },
                {
                  key: "mode",
                  header: "Assessment",
                  render: (p) =>
                    p.assessmentMode === "grade"
                      ? `Grade only: ${p.gradeOptions?.join(", ")}`
                      : `${p.theory} theory / ${p.practical || 0} practical / ${p.internal} internal`,
                },
                {
                  key: "pass",
                  header: "Pass marks",
                  render: (p) =>
                    p.assessmentMode === "grade"
                      ? "N/A"
                      : `${p.passMarks ?? (p.theory + p.internal + (p.practical || 0)) * 0.33} aggregate`,
                },
                {
                  key: "duration",
                  header: "Duration",
                  render: (p) => `${Math.round(p.duration * 60)} minutes`,
                },
                { key: "weight", header: "Weight", render: (p) => p.weight ?? 1 },
              ]}
            />
          </Card>
        )}
        {tab === "timetable" && <ScheduleManager cycle={cycle} papers={papers} allPapers={paperCol.rows} />}
        {tab === "invigilation" && <ExamDuties cycles={[cycle]} papers={paperCol.rows} defaultCycleId={id} />}
        {(tab === "marks" || tab === "verification") && (
          <>
            <SheetBoard
              cycle={cycle}
              selectedId={focus ? `${focus.paperId}__${labelToClassId(focus.cls)}` : undefined}
              onSelect={(sheet) => setFocus({ cls: sheet.classLabel, paperId: sheet.paperId })}
            />
            <MarksProgress cycle={cycle} papers={papers} candidates={candidates} marks={marks} sheets={sheets} />
            <ExamsPage cycleOverride={id} embedded focus={focus} />
          </>
        )}
        {tab === "results" && (
          <ClassResultsPanel cycle={cycle} papers={papers} candidates={candidates} marks={marks} />
        )}
        {tab === "reports" && (
          <ReportCards cycle={cycle} papers={papers} candidates={candidates} marks={marks} />
        )}
        {tab === "activity" && <ExamActivityLog cycleId={id} />}
      </div>
    </CollectionGuard>
  );
}

function MarksProgress({
  cycle,
  papers,
  candidates,
  marks,
  sheets,
}: {
  cycle: Cycle;
  papers: Paper[];
  candidates: Candidate[];
  marks: Mark[];
  sheets: Sheet[];
}) {
  const staff = useCollection<{ id: string; name: string }>("staff").rows;
  const submissions = useCollection<{ id: string; status?: string; submittedAt?: string }>("att_exam_state").rows;
  const assignments = useCollection<{ id: string; classId: string; subject: string; teacherId: string }>(
    "assignments",
  ).rows;
  const rows = papers
    .filter((p) => p.scheduleStatus !== "Cancelled")
    .flatMap((paper) =>
      [...new Set(candidates.filter((c) => participates(paper, c)).map((c) => c.cls))].map((cls) => {
        const roster = candidates.filter((c) => c.cls === cls && participates(paper, c));
        const results = roster.map((c) =>
          evaluate(
            marks.find(
              (m) => m.paperId === paper.id && (m.candId === c.id || m.studentId === studentIdOf(c)),
            ),
            paper.theory,
            paper.internal,
            paper,
          ),
        );
        const classId = roster[0]?.classId || labelToClassId(cls);
        const sheet = sheets.find((s) => s.paperId === paper.id && s.classId === classId);
        const teacherId =
          sheet?.ownerId ||
          paper.evaluatorIds?.[roster[0]?.classId || ""] ||
          subjectTeacherId(assignments, paper.subject, roster[0]?.classId || "");
        return {
          id: paper.id + "__" + cls,
          subject: paper.subject,
          cls,
          total: roster.length,
          entered: results.filter((r) => !["pending", "invalid", "medical"].includes(r.state)).length,
          verified: results.filter((r) => r.state === "verified").length,
          teacher: staff.find((s) => s.id === teacherId)?.name || sheet?.ownerName || "Unassigned",
          submission: legacySubmission(sheet, submissions.find((s) => s.id === `${paper.id}@${classId}`)),
          locked: sheet ? sheet.status !== "NotStarted" && sheet.status !== "InProgress" && sheet.status !== "Returned" : paper.locked || paper.lockedClassIds?.includes(roster[0]?.classId || ""),
          published: (paper.published || []).includes(cls),
        };
      }),
    );
  return (
    <Card className="mt-5">
      <CardHeader
        title="Marks submission & verification"
        subtitle={`${cycle.title} · Per-paper, division and examiner progress`}
      />
      <DataTable
        rows={rows}
        columns={[
          { key: "paper", header: "Paper / division", render: (r) => `${r.subject} · ${r.cls}` },
          { key: "teacher", header: "Examiner", render: (r) => r.teacher },
          {
            key: "entry",
            header: "Entered / not entered",
            render: (r) => `${r.entered} / ${r.total - r.entered}`,
          },
          { key: "submission", header: "Teacher submission", render: (r) => <Badge tone={r.submission.tone}>{r.submission.label}</Badge> },
          {
            key: "verification",
            header: "Verified / remaining",
            render: (r) => `${r.verified} / ${r.total - r.verified}`,
          },
          {
            key: "lock",
            header: "Entry window",
            render: (r) => <Badge>{r.locked ? "Locked" : "Open"}</Badge>,
          },
          {
            key: "published",
            header: "Subject results",
            render: (r) => (
              <Badge tone={r.published ? "success" : "neutral"}>
                {r.published ? "Published" : "Unpublished"}
              </Badge>
            ),
          },
        ]}
      />
    </Card>
  );
}

function ExamActivityLog({ cycleId }: { cycleId: string }) {
  const activities = useCollection<ExamActivity>("exm_activity", true, [["cycleId", "==", cycleId]]).rows;
  const history = useCollection<ScheduleHistory>("exm_schedule_history", true, [
    ["cycleId", "==", cycleId],
  ]).rows;
  const batches = useCollection<ReportBatch>("exm_report_batches", true, [["cycleId", "==", cycleId]]).rows;
  const sources = new Set([
    ...history.map((h) => `exam:schedule:${h.id}`),
    ...batches.map((b) => `exam:reports:${b.id}`),
  ]);
  const jobs = useCollection<{
    id: string;
    source: string;
    status: string;
    accepted: number;
    failed: number;
    attempts: number;
  }>("push_deliveries").rows.filter((j) => sources.has(j.source));
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="Activity log"
          subtitle="Server-written history. Records cannot be edited from the application."
        />
        <DataTable
          rows={[...activities].sort((a, b) => b.at.localeCompare(a.at))}
          searchText={(a) => `${a.action} ${a.actorName} ${a.reason || ""}`}
          columns={[
            {
              key: "action",
              header: "Action",
              render: (a) => (
                <span>
                  {a.action}
                  <span className="block text-xs text-outline">{a.reason}</span>
                </span>
              ),
            },
            { key: "by", header: "User", render: (a) => a.actorName || a.actorId },
            { key: "at", header: "Timestamp (UTC)", render: (a) => a.at.slice(0, 19).replace("T", " ") },
            { key: "references", header: "Reference", render: (a) => a.studentId || a.paperId || a.cycleId },
            {
              key: "details",
              header: "Details",
              render: (a) =>
                a.previous || a.next ? (
                  <details>
                    <summary className="cursor-pointer text-secondary">View changes</summary>
                    <pre className="mt-2 max-h-64 max-w-sm overflow-auto text-xs">
                      {JSON.stringify({ previous: a.previous, next: a.next }, null, 2)}
                    </pre>
                  </details>
                ) : (
                  "—"
                ),
            },
          ]}
        />
      </Card>
      <Card>
        <CardHeader
          title="Notification deliveries"
          subtitle="Accepted means Firebase accepted the push request. No devices means the account has no registered app device. In-app feed entries are retained."
        />
        <DataTable
          rows={jobs}
          columns={[
            { key: "source", header: "Source", render: (j) => j.source },
            {
              key: "status",
              header: "Status",
              render: (j) => <Badge tone={j.status === "Failed" ? "danger" : "neutral"}>{j.status}</Badge>,
            },
            { key: "attempts", header: "Attempts", render: (j) => j.attempts },
            {
              key: "accepted",
              header: "Accepted / failed devices",
              render: (j) => `${j.accepted || 0} / ${j.failed || 0}`,
            },
          ]}
        />
      </Card>
    </div>
  );
}
