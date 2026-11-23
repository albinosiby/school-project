"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, EmptyState, LoadingSkeleton, Select, Tabs, type Column } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { classStream, compareGrades, streamFromClassId, streamName } from "@/lib/academicStreams";
import { studentFeeHref, type StudentDue } from "./studentDues";
import type { useStudentDues } from "./useStudentDues";

export function StudentDuesDirectory({ data }: { data: ReturnType<typeof useStudentDues> }) {
  const router = useRouter(); const [tab, setTab] = useState("due"); const [grade, setGrade] = useState("");
  if (data.failed) return <Card role="alert" className="p-5"><h2 className="font-semibold">Student dues unavailable</h2><p className="mt-1 text-sm">Could not load all fee records.</p><Button variant="outline" className="mt-3" onClick={data.retry}>Retry student dues</Button></Card>;
  if (!data.ready) return <Card className="p-5"><LoadingSkeleton variant="table" label="Loading student dues…" /></Card>;
  const due = data.rows.filter((row) => row.remaining > 0); const setup = data.rows.filter((row) => !row.complete); const settled = data.rows.filter((row) => row.settled);
  const view = (tab === "due" ? due : tab === "paid" ? settled : tab === "setup" ? setup : data.rows).filter((row) => !grade || row.student.grade === grade);
  const grades = [...new Set(data.rows.map((row) => row.student.grade))].sort(compareGrades);
  const columns: Column<StudentDue>[] = [
    { key: "student", header: "Student / GRN", sortValue: (row) => row.student.name, render: ({ student }) => <div className="flex items-center gap-3"><Avatar name={student.name} size={32} /><div><Link href={studentFeeHref(student.id)} onClick={(event) => event.stopPropagation()} className="font-semibold text-secondary hover:underline">{student.name}</Link><p className="text-xs text-outline">{student.grn}</p></div></div> },
    { key: "class", header: "Class", render: ({ student }) => <div>Grade {student.grade}{student.section ? ` · ${student.section}` : ""}{(classStream(student) || streamFromClassId(student.classId)) && <p className="text-xs text-outline">{student.stream || streamName(classStream(student) || streamFromClassId(student.classId))}</p>}</div> },
    { key: "guardian", header: "Guardian / contact", render: ({ student }) => <div>{student.guardian || "—"}<p className="text-xs text-outline">{student.phone || "Phone not recorded"}</p></div> },
    { key: "annual", header: "Annual fee", render: (row) => row.annual.complete ? inrFull(row.annual.net) : <span className="text-xs text-outline">Not configured</span> },
    { key: "paid", header: "Paid this year", sortValue: (row) => row.annual.paid, render: (row) => inrFull(row.annual.paid) },
    { key: "remaining", header: "Remaining to pay", sortValue: (row) => row.remaining, render: (row) => <div><b className={row.remaining > 0 ? "text-error" : ""}>{row.complete || row.remaining > 0 ? inrFull(row.remaining) : "Needs setup"}</b>{!row.complete && row.remaining > 0 && <p className="text-xs text-outline">Issued invoices only</p>}</div> },
    { key: "status", header: "Status", render: (row) => <Badge tone={!row.complete ? "warning" : row.settled ? "success" : "info"}>{!row.complete ? "Needs setup" : row.settled ? "Settled" : "Balance due"}</Badge> },
  ];
  return <Card>
    <CardHeader title="Student dues" subtitle={`Full academic year${data.academicYear ? ` · ${data.academicYear}` : ""}. Students appear even before an invoice is issued.`} />
    <div className="px-5 pb-4"><Tabs value={tab} onChange={setTab} items={[{ id: "due", label: `Remaining to pay (${due.length})` }, { id: "paid", label: `Settled (${settled.length})` }, { id: "all", label: `All (${data.rows.length})` }, ...(setup.length ? [{ id: "setup", label: `Needs setup (${setup.length})` }] : [])]} />
      {setup.length > 0 && <p className="mt-3 text-xs text-on-surface-variant">{setup.length} student{setup.length === 1 ? " needs" : "s need"} fee configuration or admission details reviewed. Their known invoice balances remain visible; full annual dues are not yet available.</p>}
    </div>
    <DataTable rows={view} columns={columns} pageSize={10} resetKey={`${tab}:${grade}`} onRowClick={(row) => router.push(studentFeeHref(row.id))}
      searchText={({ student }) => `${student.name} ${student.grn} ${student.guardian} ${student.phone} ${student.stream || streamName(classStream(student) || streamFromClassId(student.classId))}`}
      toolbar={<Select aria-label="Student grade" value={grade} onChange={(event) => setGrade(event.target.value)}><option value="">All grades</option>{grades.map((value) => <option key={value} value={value}>Grade {value}</option>)}</Select>}
      empty={<EmptyState title={tab === "due" ? "No students with a known balance" : "No students match"} hint={tab === "due" && setup.length ? "Review Needs setup to finish calculating annual dues." : "Try another search or filter."} />} />
  </Card>;
}
