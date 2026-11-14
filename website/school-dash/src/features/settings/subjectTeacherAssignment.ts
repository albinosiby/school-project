import { runTransaction } from "firebase/firestore";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { isTeachingStaff, staffSubjects } from "@/features/people/staffProfiles";
import type { Staff } from "@/features/people/StaffView";
import { db } from "@/lib/firebase";
import { subjectKey } from "@/lib/schoolSubjects";
import { classStream, labelToClassId } from "@/lib/academicStreams";
import { gradeOfLabel, groupKeyOf, type SectionRow } from "./gradeSetup";
import { schemeId } from "@/features/exams/assessmentScheme";

export type SubjectTeacher = Pick<Staff, "id" | "name"> & Partial<Staff> & { deleted?: boolean };
export type TeachingAssignment = { id: string; classId: string; subject?: string; teacherId?: string; teacher?: string };

/** The staff directory's subjectNames projection includes both primary and additional profile subjects. */
export function canTeachSubject(teacher: SubjectTeacher, subject: string) {
  return !teacher.deleted && isTeachingStaff({ ...teacher, role: teacher.role ?? "" }) &&
    ["active", "probation", "on leave"].includes((teacher.status ?? "Active").trim().toLowerCase()) &&
    staffSubjects(teacher).some((name) => subjectKey(name) === subjectKey(subject));
}

export function subjectTeachers(staff: SubjectTeacher[], subject: string) {
  return staff.filter((teacher) => canTeachSubject(teacher, subject)).sort((a, b) => a.name.localeCompare(b.name));
}

/** One stable assignment per subject/division, including replacement of older generated assignment IDs. */
export async function saveSubjectTeacher({ section, classId, subject, teacherId, expected }: {
  section: SectionRow; classId: string; subject: string; teacherId: string; expected: TeachingAssignment[];
}) {
  const cleanSubject = subject.trim().replace(/\s+/g, " ");
  if (!cleanSubject || cleanSubject.length > 120) throw new Error("Choose a valid subject.");
  const id = `asg_${classId}__${encodeURIComponent(subjectKey(cleanSubject))}`;
  const assignmentRef = schoolDoc("assignments", id);
  const oldRefs = expected.filter((row) => row.id !== id).map((row) => schoolDoc("assignments", row.id));
  const classRef = schoolDoc("classes", classId);
  const sectionRef = schoolDoc("set_sections", section.id);
  const schemeRef = schoolDoc("set_subject_schemes", schemeId(groupKeyOf(section)));
  const teacherRef = teacherId ? schoolDoc("staff", teacherId) : null;
  await runTransaction(db, async (tx) => {
    const [assignment, old, cls, grade, scheme, teacher] = await Promise.all([
      tx.get(assignmentRef), Promise.all(oldRefs.map((ref) => tx.get(ref))), tx.get(classRef), tx.get(sectionRef), tx.get(schemeRef),
      teacherRef ? tx.get(teacherRef) : null,
    ]);
    const labels = grade.get("sections") as string[] | undefined;
    if (!cls.exists() || !grade.exists() || String(cls.get("grade")) !== gradeOfLabel(grade.get("grade")) ||
        classStream(cls.data()) !== (grade.get("streamId") ?? "") || !labels?.some((label) => labelToClassId(label) === classId))
      throw new Error("This division changed or was removed. Refresh the grade and try again.");
    const configured = grade.get("subjects") as string[] | undefined;
    const subjects = configured?.length ? configured : (scheme.get("subjects") as { subject: string }[] | undefined)?.map((row) => row.subject) ?? [];
    if (!subjects.some((name) => subjectKey(name) === subjectKey(cleanSubject)))
      throw new Error("This subject is no longer configured for the grade.");

    const snapshots = [assignment, ...old];
    for (const snapshot of snapshots) {
      const before = expected.find((row) => row.id === snapshot.id);
      if (snapshot.exists() !== !!before || (before && (snapshot.get("classId") !== classId ||
        subjectKey(snapshot.get("subject") ?? "") !== subjectKey(cleanSubject) ||
        (snapshot.get("teacherId") ?? "") !== (before.teacherId ?? "") || (snapshot.get("teacher") ?? "") !== (before.teacher ?? ""))))
        throw new Error("This teacher assignment changed. Review the latest selection and try again.");
    }
    if (teacherId && (!teacher?.exists() || !canTeachSubject({ ...teacher.data(), id: teacher.id } as SubjectTeacher, cleanSubject)))
      throw new Error("This teacher is no longer available for this subject. Update their profile or choose another teacher.");

    if (teacherId) {
      const previous = assignment.exists() ? assignment.data() : old.find((snapshot) => snapshot.exists())?.data();
      tx.set(assignmentRef, { ...previous, id, classId, subject: cleanSubject, teacherId, teacher: teacher!.get("name"), ...createStamp() }, { merge: true });
    } else if (assignment.exists()) tx.delete(assignmentRef);
    for (const ref of oldRefs) tx.delete(ref);
  });
}
