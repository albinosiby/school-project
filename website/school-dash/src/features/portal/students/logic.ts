// Pure helpers of "My classes": the teacher's classes, their rosters and the class teacher's decisions on parent leave
// requests (`student_leaves`: only status, decisionNote, decidedBy, decidedAt, updatedAt, updatedBy may change).
import type { Period } from "@/features/ops/logic";
import { myClassIds, mySubjects, type AssignmentDoc, type ClassDoc } from "../teaching";

/** a parent's leave request as the parent app writes it (plus the teacher's decision fields) */
export type StudentLeave = {
  id: string; studentId: string; classId: string; name?: string; roll?: number | string; from: string; to?: string; days?: number; reason?: string;
  type?: string; cat?: string; by?: string; status?: string; decisionNote?: string; decidedBy?: string; decidedAt?: string; appliedOn?: string; deleted?: boolean;
};
export type Decision = "Approved" | "Rejected";

export type MyClass = { id: string; grade: string; section: string; room?: string; subjects: string[]; classTeacher: boolean };

/** classes the teacher teaches or is class teacher of, class-teacher ones first (the app's ClassesAdapter order) */
export function myClasses(staffId: string, data: { assignments: AssignmentDoc[]; classes: ClassDoc[]; periods: Period[] }): MyClass[] {
  return myClassIds(staffId, data).flatMap((id) => {
    const c = data.classes.find((row) => row.id === id);
    if (!c || c.deleted === true) return [];
    return [{ id, grade: c.grade, section: c.section, room: c.room, subjects: mySubjects(staffId, id, data), classTeacher: c.classTeacherId === staffId }];
  }).sort((a, b) => Number(b.classTeacher) - Number(a.classTeacher) || a.id.localeCompare(b.id));
}

/** pending requests of the classes the teacher is class teacher of, oldest first */
export const pendingLeaves = (rows: StudentLeave[], classTeacherIds: string[]) => rows
  .filter((r) => r.deleted !== true && classTeacherIds.includes(r.classId) && (r.status ?? "Pending") === "Pending")
  .sort((a, b) => (a.from || "").localeCompare(b.from || "") || a.id.localeCompare(b.id));

/** decided requests of those classes, newest decision first */
export const decidedLeaves = (rows: StudentLeave[], classTeacherIds: string[]) => rows
  .filter((r) => r.deleted !== true && classTeacherIds.includes(r.classId) && (r.status === "Approved" || r.status === "Rejected"))
  .sort((a, b) => (b.decidedAt || "").localeCompare(a.decidedAt || ""));

/** the decision patch (StudentLeavesAdapter.write): status + decisionNote + decidedBy/decidedAt; the store adds updatedAt/updatedBy */
export const decisionPatch = (status: Decision, note: string, staffId: string, now = new Date().toISOString()) =>
  ({ status, decisionNote: note.trim(), decidedBy: staffId, decidedAt: now });

export const decisionNoteError = (note: string) => (note.trim().length > 2000 ? "Note is at most 2000 characters" : "");

/** "12 May – 14 May" style range from ISO days */
export const leaveRange = (l: Pick<StudentLeave, "from" | "to">) => (l.to && l.to !== l.from ? `${l.from} – ${l.to}` : l.from);
