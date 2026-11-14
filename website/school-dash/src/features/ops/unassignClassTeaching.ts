import { runTransaction } from "firebase/firestore";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { periodClass, type Assignment, type Period } from "./logic";

export type NamedAssignment = Assignment & { teacher?: string };
type TeacherIdentity = { id: string; name: string };

export function belongsToTeacher(row: { teacherId?: string; teacher?: string }, teacher: TeacherIdentity, allowName: boolean) {
  return row.teacherId ? row.teacherId === teacher.id : allowName && !!row.teacher && row.teacher === teacher.name;
}

/** Remove the reviewed teaching links together; retain timetable slots and historical records. */
export async function unassignClassTeaching(classId: string, assignments: NamedAssignment[], periods: Period[]) {
  if (!assignments.length && !periods.length) return;
  if (assignments.length + periods.length > 450) throw new Error("Too many assignments to remove at once. Remove them in smaller groups from the timetable.");
  if (assignments.some((row) => row.classId !== classId) || periods.some((row) => periodClass(row) !== classId))
    throw new Error("Only assignments for this class can be removed.");
  const links = [
    ...assignments.map((row) => ({ ref: schoolDoc("assignments", row.id), row, period: false })),
    ...periods.map((row) => ({ ref: schoolDoc("ops_periods", row.id), row, period: true })),
  ];
  await runTransaction(db, async (tx) => {
    const [cls, snapshots] = await Promise.all([
      tx.get(schoolDoc("classes", classId)), Promise.all(links.map(({ ref }) => tx.get(ref))),
    ]);
    if (!cls.exists()) throw new Error("This class was removed. Refresh and try again.");
    for (let i = 0; i < links.length; i++) {
      const { row, period } = links[i], current = snapshots[i];
      const fields = period ? ["classId", "grade", "section", "subject", "teacherId", "teacher", "day", "period"]
        : ["classId", "subject", "teacherId", "teacher"];
      if (!current.exists() || fields.some((field) => (current.get(field) ?? "") !== (row[field as keyof typeof row] ?? "")))
        throw new Error("These assignments changed. Close this dialog and review the latest assignments before trying again.");
    }
    for (const { ref, period } of links) {
      if (period) tx.update(ref, { teacherId: "", teacher: "", ...createStamp() });
      else tx.delete(ref);
    }
  });
}
