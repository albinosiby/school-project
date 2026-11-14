"use client";

import Link from "next/link";
import { Badge, Card, DataTable, EmptyState, Field, Select, Stat, type Column, type Tone } from "@/components/ui";
import type { Cycle } from "@/features/exams/types";
import { studentHref, type ClassResult, type classResults } from "./classDetails";

export type ClassPerformance = ReturnType<typeof classResults>;
const tones: Record<ClassResult["state"], Tone> = { Passed: "success", Failed: "danger", Pending: "neutral", "Re-exam": "warning", Unavailable: "warning" };
export function ClassResults({ cycles, cycle, result, ready, onSelect }: {
  cycles: Cycle[]; cycle?: Cycle; result: ClassPerformance; ready: boolean; onSelect: (id: string) => void;
}) {
  const columns: Column<ClassResult>[] = [
    { key: "name", header: "Student", sortValue: (row) => row.name, render: (row) => <Link href={studentHref(row.id)} className="font-medium text-secondary hover:underline">{row.name}</Link> },
    { key: "total", header: "Total marks", render: (row) => row.percentage == null ? "—" : `${row.obtained} / ${row.maximum}` },
    { key: "percentage", header: "Percentage", render: (row) => row.percentage == null ? "—" : `${row.percentage}%` },
    { key: "state", header: "Result", render: (row) => <Badge tone={tones[row.state]}>{row.state}</Badge> },
  ];
  return <div className="grid min-w-0 gap-5">
    <Card className="flex flex-wrap items-center justify-between gap-4 p-5"><div><h2 className="text-lg font-semibold">Class results</h2><p className="mt-1 text-sm text-on-surface-variant">Published exam results for the current class roster.</p></div>
      <Field label="Exam"><Select value={cycle?.id || ""} disabled={!ready || !cycles.length} onChange={(event) => onSelect(event.target.value)}>
        {!cycles.length && <option value="">No published exams</option>}{cycles.map((row) => <option key={row.id} value={row.id}>{row.title || row.short}</option>)}
      </Select></Field>
    </Card>
    {!ready ? <p role="status">Loading results…</p> : !cycle ? <Card><EmptyState title="No published results" hint="The pass percentage will be available after results are published for this class." /></Card> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat label="Pass percentage" value={result.percentage == null ? "Not available" : `${result.percentage}%`} sub={`${result.assessed} assessed`} />
        <Stat label="Passed" value={result.passed} /><Stat label="Failed" value={result.failed} /><Stat label="Pending / unavailable" value={result.pending} /></div>
      <Card className="min-w-0 overflow-hidden"><div className="p-5"><h3 className="font-semibold">{cycle.title || cycle.short}</h3>
        <p className="mt-2 text-sm text-on-surface-variant">Pass rule: {cycle.passRule || "Not configured"}. Students must pass every subject. The class pass percentage uses complete published results; pending and re-exam results are excluded.</p></div>
        <DataTable rows={result.rows} columns={columns} pageSize={10} searchText={(row) => row.name} />
      </Card>
    </>}
  </div>;
}
