"use client";

import Link from "next/link";
import { LoadingSkeleton, Badge, Card, CardHeader, DataTable, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { defaultMissingDocuments, useAdmissionDocuments } from "./admissionDocuments";
import type { Student } from "@/features/people/StudentsView";
import { studentProfileHref } from "@/features/people/studentLogic";

export function AdmittedStudents() {
  const students = useCollection<Student>("students");
  const documents = useAdmissionDocuments();
  const rows = students.rows.filter((row) => !row.deleted && (row.admissionNumber || row.admissionDate || row.offerId));
  const columns: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (row) => row.name,
      render: (row) => <Link className="font-semibold text-secondary hover:underline" href={studentProfileHref(row.id)}>{row.name}</Link> },
    { key: "number", header: "Admission number", render: (row) => row.admissionNumber || row.grn || "—" },
    { key: "grade", header: "Grade / division", render: (row) => [row.grade, row.stream, row.section || "Unassigned"].filter(Boolean).join(" · ") },
    { key: "date", header: "Admission date", sortValue: (row) => row.admissionDate || "", render: (row) => row.admissionDate ? fmtDate(row.admissionDate) : "—" },
    { key: "documents", header: "Documents", render: (row) => {
      const count = documents.missing.get(row.id) ?? defaultMissingDocuments;
      return <Badge tone={count ? "warning" : "success"}>{count} missing</Badge>;
    } },
  ];
  return <Card>
    <CardHeader title="Admitted students" />
    {students.ready && documents.ready ? <DataTable rows={rows} columns={columns} pageSize={10}
      searchText={(row) => [row.name, row.admissionNumber, row.grn, row.guardian].filter(Boolean).join(" ")} />
      : <LoadingSkeleton variant="table" label="Loading admissions…" className="p-5 text-on-surface-variant" />}
  </Card>;
}
