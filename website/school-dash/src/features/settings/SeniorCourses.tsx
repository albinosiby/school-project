"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui";
import type { AcademicClass } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { type Application, type Offer, type Seat } from "@/features/admissions/types";
import { DepartmentForm, type DepartmentRow } from "./DepartmentForm";

type CourseRow = DepartmentRow;

/** Senior secondary departments (Grades 11 and 12). `compact`: only the buttons and the form, for the capacity matrix header. */
export function SeniorCourses({ compact = false }: { compact?: boolean } = {}) {
  const matrix = useCollection<CourseRow>("set_sections");
  const classes = useCollection<AcademicClass>("classes");
  const seats = useCollection<Seat>("adm_seats");
  const students = useCollection<StudentRow>("students");
  const apps = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const [edit, setEdit] = useState<string | null>(null);
  const courses = new Map<string, CourseRow[]>();
  for (const row of matrix.rows) {
    if (row.streamId) courses.set(row.streamId, [...(courses.get(row.streamId) ?? []), row]);
  }
  const ready = [matrix, classes, seats, students, apps, offers].every((c) => c.ready);

  const form = edit !== null && <DepartmentForm key={edit} current={courses.get(edit) ?? []} existingIds={[...courses.keys()]}
    students={students.rows} held={computeSeatRows(seats.rows, apps.rows, offers.rows, students.rows)} onClose={() => setEdit(null)} />;
  if (compact) return (
    <span className="flex flex-wrap items-center gap-2">
      {[...courses].map(([id, rows]) => <Button key={id} variant="outline" size="sm" onClick={() => setEdit(id)}>Edit {rows[0]?.stream}</Button>)}
      <Button size="sm" disabled={!ready} onClick={() => setEdit("")}><Plus size={16} />Add department</Button>
      {form}
    </span>
  );
  return (
    <div className="mb-5 space-y-3 rounded-lg border border-outline-variant/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">Senior secondary departments</h3><p className="text-sm text-on-surface-variant">Name, head of department, subjects, divisions and seats for Grades 11 and 12.</p></div>
        <Button size="sm" disabled={!ready} onClick={() => setEdit("")}><Plus size={16} />Add department</Button>
      </div>
      {[...courses].map(([id, rows]) => (
        <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-low p-3">
          <div><p className="font-semibold">{rows[0]?.stream}</p><p className="text-sm text-on-surface-variant">{[...rows].sort((a, b) => a.grade.localeCompare(b.grade)).map((row) => `${row.grade}: ${row.cap} seats`).join(" · ")}</p></div>
          <Button variant="outline" size="sm" onClick={() => setEdit(id)}>Edit {rows[0]?.stream}</Button>
        </div>
      ))}
      {form}
    </div>
  );
}
