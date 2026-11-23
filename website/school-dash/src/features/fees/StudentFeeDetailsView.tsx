"use client";
import Link from "next/link";
import { Avatar, Badge, Button, Card, EmptyState, LoadingSkeleton } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { classStream, streamFromClassId, streamName } from "@/lib/academicStreams";
import type { Student } from "@/features/people/StudentsView";
import { StudentFeesPanel } from "@/features/people/StudentFeesPanel";
import { studentProfileHref } from "@/features/people/studentLogic";
import type { AdmissionDetails } from "@/features/admissions/admissionDetails";

export function StudentFeeDetailsView({ studentId }: { studentId: string }) {
  const { user } = useAuth(); const allowed = user?.role === "admin" || user?.role === "owner";
  const students = useCollection<Student>("students", allowed);
  const admissions = useCollection<AdmissionDetails & { id: string }>("adm_student_details", allowed);
  const failed = [students, admissions].filter((source) => source.error);
  if (!allowed) return <EmptyState title="Administrator access required" />;
  if (failed.length) return <Card role="alert" className="p-5"><p>Could not load student fee details.</p><Button className="mt-3" variant="outline" onClick={() => failed.forEach((source) => source.reload())}>Retry student details</Button></Card>;
  if (!students.ready || !admissions.ready) return <LoadingSkeleton variant="details" label="Loading student fee details…" />;
  const raw = students.rows.find((row) => row.id === studentId);
  if (!raw) return <><Link href="/fees" className="text-sm font-semibold text-secondary">← Back to student dues</Link><Card className="mt-5"><EmptyState title="Student record unavailable" hint="The student may no longer be available to your account." /></Card></>;
  const admission = admissions.rows.find((row) => row.id === studentId);
  const contact = admission?.contacts?.[admission.primary];
  const student = { ...raw, admissionDate: raw.admissionDate || admission?.admissionDate };
  const phone = student.phone || contact?.phone || ""; const email = student.guardianEmail || contact?.email || "";
  const stream = student.stream || streamName(classStream(student) || streamFromClassId(student.classId));
  return <>
    <Link href="/fees" className="text-sm font-semibold text-secondary hover:underline">← Back to student dues</Link>
    <Card className="mt-5 p-5"><div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex items-center gap-3"><Avatar name={student.name} size={48} /><div><h1 className="t-headline-md">{student.name}</h1><p className="mt-1 text-sm text-on-surface-variant">{student.grn} · Grade {student.grade}{student.section ? ` · Division ${student.section}` : ""}{stream ? ` · ${stream}` : ""}</p></div></div>
      <div className="flex items-center gap-3"><Badge tone={student.deleted ? "neutral" : "info"}>{student.deleted ? "Removed student" : student.status || "Active"}</Badge><Link href={studentProfileHref(student.id)} className="text-sm font-semibold text-secondary hover:underline">Student profile</Link></div>
    </div><dl className="mt-5 grid gap-4 border-t border-outline-variant/50 pt-4 text-sm sm:grid-cols-2 xl:grid-cols-4">
      <div><dt className="text-xs text-outline">Guardian</dt><dd className="mt-1 font-medium">{student.guardian || contact?.name || "—"}</dd></div>
      <div><dt className="text-xs text-outline">Phone</dt><dd className="mt-1">{phone ? <a className="text-secondary hover:underline" href={`tel:${phone.replace(/[^\d+]/g, "")}`}>{phone}</a> : "Not recorded"}</dd></div>
      <div><dt className="text-xs text-outline">Email</dt><dd className="mt-1 break-all">{email ? <a className="text-secondary hover:underline" href={`mailto:${email}`}>{email}</a> : "Not recorded"}</dd></div>
      <div><dt className="text-xs text-outline">Class / roll</dt><dd className="mt-1">{student.classId || `Grade ${student.grade}${student.section ? ` · ${student.section}` : ""}`}{student.roll ? ` · Roll ${student.roll}` : " · Roll unassigned"}</dd></div>
    </dl></Card>
    <StudentFeesPanel key={student.id} student={student} students={students.rows} invoiceActionLabel="Create invoice for remaining fees" />
  </>;
}
