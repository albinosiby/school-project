"use client";

import { LoadingSkeleton, Button, Card, PageHeader } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { CertificatesPanel } from "./CertificatesPanel";
import type { Student } from "./StudentsView";

export function CertificatesView() {
  const students = useCollection<Student>("students");

  return <div>
    <PageHeader title="Certificates" subtitle="Manage student certificate requests, issue certificates and upload signed copies." />
    {students.error ? <Card className="p-5">
      <p role="alert">Could not load students for certificates.</p>
      <Button variant="outline" className="mt-3" onClick={students.reload}>Retry</Button>
    </Card> : students.ready
      ? <CertificatesPanel students={students.rows.filter((student) => student.deleted !== true)} />
      : <LoadingSkeleton variant="table" label="Loading certificates…" />}
  </div>;
}
