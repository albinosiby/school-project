"use client";
// Firestore reads of one class (teachers may read these collections whole; the queries keep them to the class and the
// rows are filtered again client-side): its timetable, registers, marks (+ papers / cycles), leave requests, homework.
import { useMemo } from "react";
import type { AttRec, Period } from "@/features/ops/logic";
import { useCollection } from "@/lib/useCollection";
import { classRoster, useTeachingData } from "../teaching";
import {
  classMarks, classRecords, classTimetable, type CycleDoc, type HomeworkDoc, type MarkDoc, type PaperDoc, type RosterStudent, type StudentLeave,
} from "./logic";

/** the school's attendance minimum (`school/mobile.minimumAttendance`, published from the attendance policy), else 75 */
export const minimumOf = (policy: unknown) => {
  const v = (policy as { minimumAttendance?: unknown } | undefined)?.minimumAttendance;
  return typeof v === "number" && v >= 0 && v <= 100 ? v : 75;
};

export function useClassData(classId: string, want: { marks?: boolean; leaves?: boolean; homework?: boolean } = {}) {
  const data = useTeachingData();
  const mine = data.teaching && data.classIds.includes(classId);
  const by = [["classId", "==", classId]] as const;
  const periods = useCollection<Period>("ops_periods", mine, by);
  const attendance = useCollection<AttRec>("ops_attendance", mine, by);
  const marks = useCollection<MarkDoc>("exm_marks", mine && !!want.marks, by);
  const papers = useCollection<PaperDoc>("exm_papers", mine && !!want.marks);
  const cycles = useCollection<CycleDoc>("exm_cycles", mine && !!want.marks);
  const leaves = useCollection<StudentLeave>("student_leaves", mine && !!want.leaves, by);
  const homework = useCollection<HomeworkDoc>("ops_homework", mine && !!want.homework, by);

  const roster = useMemo(() => classRoster(data.students, classId) as RosterStudent[], [data.students, classId]);
  const timetable = useMemo(() => classTimetable(periods.rows, classId), [periods.rows, classId]);
  const records = useMemo(() => classRecords(attendance.rows, classId), [attendance.rows, classId]);
  const marksOf = useMemo(() => classMarks(marks.rows.filter((m) => !m.classId || m.classId === classId), papers.rows, cycles.rows, roster.map((s) => s.id)),
    [marks.rows, papers.rows, cycles.rows, roster, classId]);
  const leaveRows = useMemo(() => leaves.rows.filter((l) => l.classId === classId && l.deleted !== true), [leaves.rows, classId]);
  const homeworkRows = useMemo(() => homework.rows.filter((h) => h.classId === classId && h.deleted !== true), [homework.rows, classId]);

  const extra = [want.marks && marks, want.marks && papers, want.marks && cycles, want.leaves && leaves, want.homework && homework].filter((c) => !!c);
  const ready = data.ready && (!mine || [periods, attendance, ...extra].every((c) => c.ready));
  return {
    data, mine, ready, cls: data.classOf(classId), classTeacher: data.isClassTeacher(classId), subjects: data.subjectsFor(classId),
    roster, timetable, records, marks: marksOf, leaves: leaveRows, homework: homeworkRows, updateLeave: leaves.update, minimum: minimumOf(data.policy),
  };
}
