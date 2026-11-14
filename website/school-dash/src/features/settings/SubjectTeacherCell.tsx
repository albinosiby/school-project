"use client";

import { useState } from "react";
import { Select, useToast } from "@/components/ui";
import type { SectionRow } from "./gradeSetup";
import { saveSubjectTeacher, subjectTeachers, type SubjectTeacher, type TeachingAssignment } from "./subjectTeacherAssignment";

export function SubjectTeacherCell({ section, classId, label, subject, staff, assignments, classExists }: {
  section: SectionRow; classId: string; label: string; subject: string; staff: SubjectTeacher[];
  assignments: TeachingAssignment[]; classExists: boolean;
}) {
  const toast = useToast();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const choices = subjectTeachers(staff, subject);
  const nameCounts = new Map<string, number>();
  for (const teacher of choices) {
    const name = teacher.name.trim().toLowerCase();
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }
  const assigned = assignments[0];
  const currentId = assigned?.teacherId || (assigned?.teacher ? "__legacy__" : "");
  const currentName = staff.find((teacher) => teacher.id === assigned?.teacherId)?.name || assigned?.teacher || "Previous teacher";
  const unavailable = !!currentId && !choices.some((teacher) => teacher.id === currentId);

  async function save(teacherId: string) {
    if (pending !== null || teacherId === currentId || !classExists) return;
    setPending(teacherId); setError("");
    try {
      await saveSubjectTeacher({ section, classId, subject, teacherId, expected: assignments });
      toast(teacherId ? `Teacher assigned for ${subject} · ${label}` : `Teacher unassigned for ${subject} · ${label}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the teacher assignment. Try again.");
    } finally { setPending(null); }
  }

  return <div className="min-w-44 space-y-1.5">
    <Select aria-label={`${subject} teacher for ${label}`} value={pending ?? currentId}
      disabled={pending !== null || !classExists || (!choices.length && !assigned)}
      onChange={(event) => { void save(event.target.value); }}>
      <option value="">Not assigned</option>
      {unavailable && <option value={currentId} hidden disabled>{currentName}</option>}
      {choices.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}
        {(nameCounts.get(teacher.name.trim().toLowerCase()) ?? 0) > 1 ? ` · ${teacher.empId || teacher.id}` : ""}
      </option>)}
    </Select>
    {pending !== null && <p role="status" className="text-xs text-on-surface-variant">Saving…</p>}
    {!classExists && <p className="text-xs text-on-surface-variant">Create this section&apos;s class record first.</p>}
    {classExists && !choices.length && <p className="text-xs text-on-surface-variant">No matching teachers. Add this subject to a teaching profile.</p>}
    {unavailable && <p className="text-xs text-on-surface-variant">Current teacher no longer matches. Update their profile or choose another teacher.</p>}
    {error && <p role="alert" className="text-xs text-error">{error}</p>}
  </div>;
}
