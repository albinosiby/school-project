"use client";

import { useState } from "react";
import { Button, Modal, useToast } from "@/components/ui";
import { classTitle, type ClassTeacher } from "./classDetails";
import { periodClass, type Assignment, type ClassRow, type Period } from "./logic";
import { saveClassTeacher } from "./classTeacherService";
import { belongsToTeacher, unassignClassTeaching, type NamedAssignment } from "./unassignClassTeaching";

export function UnassignTeacherAction({ teacher, cls, staff, assignments, periods }: {
  teacher: { id: string; name: string }; cls: ClassRow; staff: ClassTeacher[]; assignments: Assignment[]; periods: Period[];
}) {
  const toast = useToast();
  const [review, setReview] = useState<{ assignments: NamedAssignment[]; periods: Period[] } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const isClassTeacher = cls.classTeacherId === teacher.id;
  function open() {
    const allowName = teacher.id.startsWith("legacy:") || staff.filter((row) => row.name === teacher.name).length === 1;
    setReview({
      assignments: assignments.filter((row) => row.classId === cls.id && belongsToTeacher(row, teacher, allowName)),
      periods: periods.filter((row) => periodClass(row) === cls.id && belongsToTeacher(row, teacher, allowName)),
    });
    setError("");
  }
  async function remove(kind: "teaching" | "classTeacher") {
    if (saving || !review) return;
    setSaving(true); setError("");
    try {
      if (kind === "teaching") await unassignClassTeaching(cls.id, review.assignments, review.periods);
      else await saveClassTeacher(cls.id, "");
      toast(kind === "teaching" ? "Teaching assignments removed" : "Class teacher unassigned");
      setReview(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not unassign the teacher. Try again.");
    } finally { setSaving(false); }
  }
  const hasTeaching = !!review && (review.assignments.length > 0 || review.periods.length > 0);
  return <div onClick={(event) => event.stopPropagation()}>
    <Button variant="outline" size="sm" aria-label={`Unassign ${teacher.name}`} onClick={(event) => { event.stopPropagation(); open(); }}>Unassign</Button>
    <Modal open={!!review} title={`Unassign ${teacher.name}`} subtitle={classTitle(cls)} onClose={() => { if (!saving) setReview(null); }}
      footer={<Button variant="ghost" disabled={saving} onClick={() => setReview(null)}>Cancel</Button>}>
      <div className="space-y-5">
        {hasTeaching && <div className="space-y-3">
          <h3 className="font-semibold">Subject teaching</h3>
          <p className="text-sm text-on-surface-variant">Remove {review.assignments.length} subject assignment{review.assignments.length === 1 ? "" : "s"} and clear this teacher from {review.periods.length} weekly timetable slot{review.periods.length === 1 ? "" : "s"} in this class.</p>
          <p className="text-sm text-on-surface-variant">Timetable slots, subjects and recorded attendance are kept.{isClassTeacher ? " Their class teacher role is kept until you unassign it separately." : ""}</p>
          <Button variant="danger" disabled={saving} onClick={() => { void remove("teaching"); }}>{saving ? "Unassigning…" : "Unassign teaching"}</Button>
        </div>}
        {isClassTeacher && <div className="space-y-3">
          <h3 className="font-semibold">Class teacher</h3>
          <p className="text-sm text-on-surface-variant">Remove their class teacher role for this class. Subject and timetable assignments are kept.</p>
          <Button variant="danger" disabled={saving} onClick={() => { void remove("classTeacher"); }}>{saving ? "Unassigning…" : "Unassign class teacher"}</Button>
        </div>}
        {!hasTeaching && !isClassTeacher && <p className="text-sm text-on-surface-variant">No assignments remain for this teacher in this class.</p>}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </div>
    </Modal>
  </div>;
}
