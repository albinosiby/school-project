"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { School } from "lucide-react";
import { LoadingField, Button, Field, Modal, Select, useToast } from "@/components/ui";
import { activeStudent } from "@/features/ops/shared";
import { gradeName } from "@/features/onboarding/classSetup";
import { isSeniorGrade, streamName } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";
import { studentClassId } from "./studentLogic";
import { assignStudentDivision, divisionCapacity, divisionCount, studentDepartment, studentDivisions, type DivisionClass } from "./studentDivisionAssignment";
import type { Student } from "./StudentsView";

export function StudentDivisionAssignment({ student, students }: { student: Student; students: Student[] }) {
  const [editing, setEditing] = useState(false);
  useLayoutEffect(() => () => setEditing(false), [student.id]);
  return <>
    <Button variant="outline" disabled={!activeStudent(student)} onClick={() => setEditing(true)}>
      <School size={14} />{student.section ? "Change division" : "Assign division"}
    </Button>
    {editing && <DivisionForm student={student} students={students} onClose={() => setEditing(false)} />}
  </>;
}

function DivisionForm({ student, students, onClose }: { student: Student; students: Student[]; onClose: () => void }) {
  const classes = useCollection<DivisionClass>("classes");
  const toast = useToast();
  const [original] = useState(student);
  const [classId, setClassId] = useState(studentClassId(student));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const choices = studentDivisions(student, classes.rows);
  const currentId = studentClassId(student);
  const selected = choices.find((row) => row.id === classId);
  const grade = gradeName(student.grade);
  const department = studentDepartment(student);
  const scope = [grade, isSeniorGrade(student.grade) ? student.stream || streamName(department) : ""].filter(Boolean).join(" · ");
  const seatsLeft = (row: DivisionClass) => {
    const capacity = divisionCapacity(row);
    return capacity === undefined ? undefined : Math.max(0, capacity - divisionCount(row.id, students));
  };
  const full = !!selected && selected.id !== currentId && seatsLeft(selected) === 0;

  async function save() {
    if (saving || !classes.ready || !selected || classId === currentId || full) return;
    setSaving(true); setError("");
    try {
      await assignStudentDivision(original, classId, classes.rows);
      toast("Division assigned");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not assign the division. Try again.");
    } finally { setSaving(false); }
  }

  return <Modal open title={original.section ? "Change division" : "Assign division"} subtitle={student.name}
    onClose={() => { if (!saving) onClose(); }}
    footer={<><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={saving || !classes.ready || !selected || classId === currentId || full} onClick={save}>{saving ? "Saving…" : "Save division"}</Button></>}>
    <div className="space-y-4">
      <p className="text-sm font-medium">{scope}</p>
      <Field label="Division" required hint="Only divisions configured for this grade and department are listed.">
        <LoadingField loading={!classes.ready} label="Loading divisions…"><Select disabled={saving || !classes.ready} value={selected ? classId : ""} onChange={(event) => { setClassId(event.target.value); setError(""); }}>
          <option value="">Select a division…</option>
          {choices.map((row) => {
            const left = seatsLeft(row);
            return <option key={row.id} value={row.id} disabled={left === 0 && row.id !== currentId}>
              Division {row.section}{row.id === currentId ? " · Current" : left === undefined ? " · Seat limit not set" : left === 0 ? " · Full" : ` · ${left} seats available`}
            </option>;
          })}
        </Select></LoadingField>
      </Field>
      {selected && classId !== currentId && <p className="text-sm text-on-surface-variant">The roll number will be unassigned. The class teacher can assign a roll number in the new division.</p>}
      {classes.ready && !choices.length && <p className="text-sm text-on-surface-variant">
        {isSeniorGrade(student.grade) && !department ? "Choose the student's department in Edit first." : <>No divisions configured for {scope}. Add them in <Link href="/settings?section=capacity" className="text-secondary underline">Classes &amp; Sections</Link>.</>}
      </p>}
      {full && <p role="alert" className="text-sm text-error">This division has no available seats.</p>}
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </div>
  </Modal>;
}
