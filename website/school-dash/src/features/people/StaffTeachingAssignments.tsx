"use client";

import { Badge, Card } from "@/components/ui";
import type { Assignment, ClassRow } from "@/features/ops/logic";
import { clsLabel } from "@/features/ops/shared";
import { classStream, streamName } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";

export function StaffTeachingAssignments({ staffId }: { staffId: string }) {
  const classes = useCollection<ClassRow>("classes");
  const assignments = useCollection<Assignment>("assignments");
  const assigned = assignments.rows.filter((assignment) => assignment.teacherId === staffId);
  const classTeacherOf = classes.rows.filter((row) => row.classTeacherId === staffId);
  const classIds = new Set([...assigned.map((assignment) => assignment.classId), ...classTeacherOf.map((row) => row.id)]);

  function classLabel(id: string) {
    const row = classes.rows.find((entry) => entry.id === id);
    if (!row?.grade) return clsLabel(id);
    const grade = /^\d+$/.test(row.grade) ? `Grade ${row.grade}` : row.grade;
    const stream = row.stream || streamName(classStream(row));
    return [grade, stream, row.section].filter(Boolean).join(" · ");
  }

  const rows = [...classIds].filter(Boolean).map((classId) => ({
    classId,
    label: classLabel(classId),
    subjects: [...new Set(assigned.filter((assignment) => assignment.classId === classId)
      .map((assignment) => assignment.subject).filter(Boolean))].sort(),
    classTeacher: classTeacherOf.some((row) => row.id === classId),
  })).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  return <Card className="min-w-0 p-5">
    <h2 className="t-label-caps mb-3 text-on-surface-variant">Assigned classes</h2>
    {!classes.ready || !assignments.ready ? <p role="status" className="text-sm text-on-surface-variant">Loading teaching assignments…</p>
      : <>
        <dl className="mb-4 grid gap-1 text-sm">
          <dt className="text-outline">Class teacher of</dt>
          <dd className="font-semibold">{classTeacherOf.length
            ? classTeacherOf.map((row) => classLabel(row.id)).join(", ") : "Not assigned"}</dd>
        </dl>
        {rows.length ? <div className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-label="Teaching assignments">
            <thead className="text-on-surface-variant">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Class / section</th>
                <th scope="col" className="py-2 font-medium">Subjects</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 border-t border-outline-variant/60">
              {rows.map((row) => <tr key={row.classId}>
                <td className="py-2 pr-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{row.label}</span>
                    {row.classTeacher && <Badge tone="info">Class teacher</Badge>}
                  </div>
                </td>
                <td className="py-2">{row.subjects.join(", ") || "—"}</td>
              </tr>)}
            </tbody>
          </table>
        </div> : <p className="text-sm text-on-surface-variant">No classes assigned.</p>}
      </>}
  </Card>;
}
