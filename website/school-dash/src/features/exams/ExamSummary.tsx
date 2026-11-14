"use client";
import { useState } from "react";
import { Badge, Card, CardHeader, DataTable, Input, Select, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { consolidated, type ResultRow } from "../../../../functions/examOperations";
import type { Candidate, Cycle, Mark, Paper } from "./types";

export function ExamSummary({
  cycle,
  papers,
  candidates,
  marks,
  initialClass,
  termPct,
}: {
  cycle: Cycle;
  papers: Paper[];
  candidates: Candidate[];
  marks: Mark[];
  /** division label ("10-A") the grid opens on (results tab: the selected class) */
  initialClass?: string;
  /** exm_results.term.pct per studentId; adds a "Term so far" column when given */
  termPct?: Record<string, number | null>;
}) {
  const classes = useCollection<{ id: string; streamId?: string; stream?: string }>("classes").rows;
  const [cls, setCls] = useState(initialClass || "all"),
    [grade, setGrade] = useState("all"),
    [status, setStatus] = useState("all"),
    [pass, setPass] = useState("all"),
    [query, setQuery] = useState("");
  const rows = consolidated(cycle, papers, candidates, marks, classes);
  const visible = rows.filter(
    (r) =>
      (cls === "all" || r.cls === cls) &&
      (grade === "all" || r.classGrade === grade) &&
      (status === "all" || r.complete === (status === "complete")) &&
      (pass === "all" || r.passed === (pass === "pass")) &&
      `${r.name} ${r.grn}`.toLowerCase().includes(query.toLowerCase()),
  );
  const columns: Column<ResultRow>[] = [
    {
      key: "name",
      header: "Student / admission no.",
      render: (r) => (
        <div className="font-semibold">
          {r.name}
          <span className="block text-xs font-normal text-outline">
            {r.grn || "—"} · {r.cls}
          </span>
        </div>
      ),
    },
    ...papers
      .filter((p) => p.scheduleStatus !== "Cancelled")
      .map((paper) => ({
        key: paper.id,
        header: `${paper.subject} (${paper.code || paper.grade})`,
        render: (r: ResultRow) => {
          const entry = r.entries.find((e) => e.paper.id === paper.id);
          return !entry ? (
            <span className="text-outline">N/A</span>
          ) : (
            <div>
              {entry.result.total === null
                ? entry.result.grade
                : `${entry.result.total} / ${paper.theory + paper.internal + (paper.practical || 0)}`}
              <span className="block text-xs text-outline">
                {entry.result.grade} · {entry.result.state}
              </span>
            </div>
          );
        },
      })),
    {
      key: "total",
      header: "Total marks",
      render: (r) => (r.complete && r.total !== null ? `${r.total} / ${r.maximum}` : "—"),
    },
    {
      key: "percent",
      header: "Calculated result",
      render: (r) => (r.complete && r.pct !== null ? `${r.pct}%` : "—"),
    },
    { key: "grade", header: "Grade", render: (r) => (r.complete ? r.grade : "—") },
    {
      key: "passed",
      header: "Result",
      render: (r) => (
        <Badge tone={r.passed === null ? "neutral" : r.passed ? "success" : "warning"}>
          {r.passed === null ? "Awaited" : r.pct === null ? "Grade only" : r.passed ? "Pass" : "Fail"}
        </Badge>
      ),
    },
    {
      key: "complete",
      header: "Completion",
      render: (r) => (
        <Badge tone={r.complete ? "success" : "warning"}>{r.complete ? "Complete" : "Incomplete"}</Badge>
      ),
    },
    ...(cycle.resultRules?.rankScope && cycle.resultRules.rankScope !== "none"
      ? [{ key: "rank", header: "Rank", render: (r: ResultRow) => r.rank ?? "—" }]
      : []),
    ...(termPct
      ? [{
          key: "term",
          header: "Term so far",
          render: (r: ResultRow) => {
            const pct = termPct[r.studentId];
            return pct == null ? <span className="text-outline">—</span> : `${pct}%`;
          },
        }]
      : []),
  ];
  return (
    <Card className="mt-6">
      <CardHeader
        title="Overall exam results"
        subtitle="Complete results use the configured calculation, pass criteria and ranking rules. Grade-only subjects and exempt entries are excluded from numeric totals."
      />
      <div className="grid gap-3 px-5 pb-4 sm:grid-cols-2 xl:grid-cols-5">
        <Input
          aria-label="Find result by student or admission number"
          placeholder="Student or admission number…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          aria-label="Result class"
          value={grade}
          onChange={(e) => {
            setGrade(e.target.value);
            setCls("all");
          }}
        >
          <option value="all">All classes</option>
          {[...new Set(rows.map((r) => r.classGrade))].map((g) => (
            <option key={g}>{g}</option>
          ))}
        </Select>
        <Select aria-label="Result division" value={cls} onChange={(e) => setCls(e.target.value)}>
          <option value="all">All divisions</option>
          {[...new Set(rows.filter((r) => grade === "all" || r.classGrade === grade).map((r) => r.cls))].map(
            (c) => (
              <option key={c}>{c}</option>
            ),
          )}
        </Select>
        <Select aria-label="Result completion" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All completion states</option>
          <option value="complete">Complete</option>
          <option value="incomplete">Incomplete</option>
        </Select>
        <Select aria-label="Pass or fail" value={pass} onChange={(e) => setPass(e.target.value)}>
          <option value="all">All outcomes</option>
          <option value="pass">Pass</option>
          <option value="fail">Fail</option>
        </Select>
      </div>
      <DataTable rows={visible} columns={columns} pageSize={10} />
    </Card>
  );
}
