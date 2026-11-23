"use client";
// Teaching-staff helpers shared by the portal's timetable, attendance, students, homework and substitution views.
// Mirrors the teacher app's store adapters (mobile app/teacher/lib/utils/services/firebase/store_adapters.dart):
// `myClassIds`, `gradeSectionOf`, the week window of substitutions and the school bell schedule (`school/mobile`).
import { useMemo } from "react";
import { schoolDaySchedule, teachingPeriods, withTimetableBreaks, type SchoolSlot } from "@/features/ops/classActivity";
import { subStatus, type Period, type Substitution } from "@/features/ops/logic";
import { activeStudent, dayOfIso, studentClassId, todayIso } from "@/features/ops/shared";
import { classIdLabel, seniorClassParts } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";

export type ClassDoc = { id: string; grade: string; section: string; classTeacherId?: string; classTeacher?: string; room?: string; deleted?: boolean };
export type AssignmentDoc = { id: string; classId: string; subject: string; teacherId: string; topic?: string };
export type StudentDoc = {
  id: string; name: string; grn?: string; admissionNumber?: string; grade?: string; section?: string; classId?: string; streamId?: string;
  roll?: number | string; guardian?: string; phone?: string; status?: string; deleted?: boolean;
};
export type StaffDoc = { id: string; name: string; department?: string };
/** `school/mobile` (functions/mobileSync.js): the bell schedule the teacher app reads */
export type MobilePolicy = { id: string; schedule?: { label: string; start: string; end: string; isBreak?: boolean; isGap?: boolean }[] };

export { classIdLabel, dayOfIso, todayIso };

/** grade + section of a class id, as the teacher app's `gradeSectionOf` parses it (cls_10B, cls_11_science_A) */
export function gradeSectionOf(classId: string) {
  const senior = seniorClassParts(classId);
  if (senior) return { grade: senior[1]!, section: senior[3]! };
  const m = /^cls_(LKG|UKG|\d+)([A-Za-z]+)$/.exec(classId);
  return { grade: m?.[1] ?? "", section: m?.[2] ?? "" };
}

/** the class a period belongs to (`classId`, else grade + section) */
export const periodClassId = (p: Pick<Period, "classId" | "grade" | "section">) => p.classId || `cls_${p.grade}${p.section}`;

/** class ids the teacher teaches or is class teacher of (assignments, classes, own periods), sorted */
export function myClassIds(staffId: string, data: { assignments: AssignmentDoc[]; classes: ClassDoc[]; periods: Period[] }) {
  const ids = new Set<string>();
  data.assignments.forEach((a) => { if (a.teacherId === staffId && a.classId) ids.add(a.classId); });
  data.classes.forEach((c) => { if (c.classTeacherId === staffId) ids.add(c.id); });
  data.periods.forEach((p) => { if (p.teacherId === staffId && periodClassId(p)) ids.add(periodClassId(p)); });
  return [...ids].sort();
}

/** subjects the teacher teaches in a class (assignments + periods), in first-seen order */
export function mySubjects(staffId: string, classId: string, data: { assignments: AssignmentDoc[]; periods: Period[] }) {
  const out: string[] = [];
  const add = (s?: string) => { const v = String(s ?? "").trim(); if (v && !out.includes(v)) out.push(v); };
  data.assignments.forEach((a) => { if (a.teacherId === staffId && a.classId === classId) add(a.subject); });
  data.periods.forEach((p) => { if (p.teacherId === staffId && periodClassId(p) === classId) add(p.subject); });
  return out;
}

/** roster of a class: active, not deleted, by roll then name */
export const classRoster = (students: StudentDoc[], classId: string) => students
  .filter((s) => activeStudent(s) && studentClassId(s) === classId)
  .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0) || String(a.name).localeCompare(String(b.name)));

/** local ISO day of a Date */
export const isoDay = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDay(d); };

/** Monday..Saturday of the week holding `today` (the teacher app's substitution window), with the date of each day */
export function weekOf(today: string) {
  const dow = new Date(`${today}T12:00:00`).getDay(); // 0 = Sun
  const monday = addDays(today, dow === 0 ? -6 : 1 - dow);
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
  const dates = Object.fromEntries(days.map((day, i) => [day, addDays(monday, i)])) as Record<(typeof days)[number], string>;
  return { from: monday, to: addDays(monday, 5), days: [...days], dates };
}

/** substitutions the teacher still has to cover (Assigned / Accepted; Declined ones are gone) */
export const activeSub = (s: Pick<Substitution, "status">) => subStatus(s.status) !== "Declined";

/** the school bells as `SchoolSlot`s: `school/mobile.schedule` when published, else the shared default bells */
export function bellSlots(policy?: MobilePolicy): SchoolSlot[] {
  const rows = policy?.schedule;
  if (Array.isArray(rows) && rows.length) {
    return rows.map((row) => ({ label: row.label, from: row.start, to: row.end, break: row.isBreak === true, gap: row.isGap === true }));
  }
  return schoolDaySchedule(undefined) ?? [];
}
/** teaching periods and the configured breaks, in bell order */
export function bellTimeline(policy?: MobilePolicy) {
  const slots = bellSlots(policy);
  const periods = teachingPeriods(slots);
  return { periods, timeline: withTimetableBreaks(periods, slots.filter((slot) => slot.break)) };
}

/**
 * Everything the teaching views share: own periods and substitutions, own assignments, all classes/students (readable
 * whole by teachers), the staff directory and the bell schedule. Rows are also filtered client-side by staffId so a
 * view never shows another teacher's data even when the store ignores the query filter.
 */
export function useTeachingData() {
  const profile = useStaffProfile();
  const { staffId, teaching } = profile;
  const periods = useCollection<Period>("ops_periods", teaching, [["teacherId", "==", staffId]]);
  const subs = useCollection<Substitution>("ops_substitutions", teaching, [["substituteTeacherId", "==", staffId]]);
  const assignments = useCollection<AssignmentDoc>("assignments", teaching, [["teacherId", "==", staffId]]);
  const classes = useCollection<ClassDoc>("classes", teaching);
  const students = useCollection<StudentDoc>("students", teaching);
  const staff = useCollection<StaffDoc>("staff", teaching);
  const school = useCollection<MobilePolicy>("school", teaching);
  const myPeriods = useMemo(() => periods.rows.filter((p) => p.teacherId === staffId), [periods.rows, staffId]);
  const mySubs = useMemo(() => subs.rows.filter((s) => s.substituteTeacherId === staffId), [subs.rows, staffId]);
  const myAssignments = useMemo(() => assignments.rows.filter((a) => a.teacherId === staffId), [assignments.rows, staffId]);
  const liveClasses = useMemo(() => classes.rows.filter((c) => c.deleted !== true), [classes.rows]);
  const classIds = useMemo(() => myClassIds(staffId, { assignments: myAssignments, classes: liveClasses, periods: myPeriods }), [staffId, myAssignments, liveClasses, myPeriods]);
  const ready = [periods, subs, assignments, classes, students, staff, school].every((c) => c.ready);
  return {
    ...profile, ready,
    periods: myPeriods, subs: mySubs, assignments: myAssignments, classes: liveClasses, students: students.rows, staff: staff.rows,
    classIds, policy: school.rows.find((row) => row.id === "mobile"),
    classOf: (id: string) => liveClasses.find((c) => c.id === id),
    staffName: (id: string) => staff.rows.find((s) => s.id === id)?.name ?? id,
    subjectsFor: (classId: string) => mySubjects(staffId, classId, { assignments: myAssignments, periods: myPeriods }),
    isClassTeacher: (classId: string) => liveClasses.some((c) => c.id === classId && c.classTeacherId === staffId),
  };
}
