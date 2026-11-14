import { collection, getDocs, query, runTransaction, where } from "firebase/firestore";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { activeStudent } from "@/features/ops/shared";
import { classStream, isSeniorGrade, streamFromClassId, type AcademicClass } from "@/lib/academicStreams";
import { db } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import { studentClassId } from "./studentLogic";
import type { Student } from "./StudentsView";

export type DivisionClass = AcademicClass & { studentCount?: number; divisionAssignmentRevision?: number };
export const studentDepartment = (student: Pick<Student, "streamId" | "stream" | "classId">) =>
  classStream(student) || streamFromClassId(student.classId);

/** A division assignment cannot change the student's grade or senior-secondary department. */
export function studentDivisions(student: Student, classes: DivisionClass[]) {
  const senior = isSeniorGrade(student.grade);
  const department = studentDepartment(student);
  return classes.filter((row) => String(row.grade) === String(student.grade) && row.section &&
    (senior ? !!department && classStream(row) === department : !classStream(row)))
    .sort((a, b) => a.section.localeCompare(b.section));
}

export function divisionCount(id: string, students: Student[]) {
  return students.filter((student) => activeStudent(student) && studentClassId(student) === id).length;
}

/** Existing legacy divisions may have no individual limit; configured limits are always enforced. */
export const divisionCapacity = (row: DivisionClass) =>
  Number.isSafeInteger(row.capacity) && Number(row.capacity) >= 0 ? row.capacity : undefined;

export async function assignStudentDivision(student: Student, classId: string, classes: DivisionClass[]) {
  const target = studentDivisions(student, classes).find((row) => row.id === classId);
  if (!target) throw new Error("Choose a configured division in this student's grade and department.");
  const oldClassId = studentClassId(student);
  const ids = [...new Set([oldClassId, classId].filter(Boolean))];
  const refs = ids.map((id) => schoolDoc("classes", id));
  const studentRef = schoolDoc("students", student.id);
  const schoolId = currentSchoolId();
  if (!schoolId) throw new Error("Not signed in");
  // Recount the affected divisions instead of trusting a cached class total after edits elsewhere.
  const roster = await getDocs(query(collection(db, "schools", schoolId, "students"), where("grade", "==", String(student.grade))));
  const rosterRefs = roster.docs.filter((row) => row.id !== student.id && ids.includes(studentClassId(row.data())))
    .map((row) => row.ref);

  await runTransaction(db, async (tx) => {
    const [saved, classSnaps, rosterSnaps] = await Promise.all([
      tx.get(studentRef), Promise.all(refs.map((ref) => tx.get(ref))), Promise.all(rosterRefs.map((ref) => tx.get(ref))),
    ]);
    if (!saved.exists() || !activeStudent(saved.data())) throw new Error("Only an active student can be assigned a division.");
    const current = { ...saved.data(), id: saved.id } as Student;
    if (String(current.grade) !== String(student.grade) || studentDepartment(current) !== studentDepartment(student) ||
        studentClassId(current) !== oldClassId)
      throw new Error("This student's grade or division changed. Reopen the assignment and try again.");
    const destination = classSnaps[ids.indexOf(classId)]!;
    if (!destination.exists() || !studentDivisions(current, [{ ...destination.data(), id: destination.id } as DivisionClass]).length)
      throw new Error("This division is no longer available for the student's grade and department.");
    if (oldClassId === classId) return;

    const students = [current, ...rosterSnaps.filter((row) => row.exists()).map((row) => ({ ...row.data(), id: row.id } as Student))];
    const counts = new Map<string, number>();
    for (const [index, id] of ids.entries()) {
      const snapshot = classSnaps[index]!;
      const expected = classes.find((row) => row.id === id);
      if (snapshot.exists() && (!expected ||
        (snapshot.get("divisionAssignmentRevision") ?? 0) !== (expected.divisionAssignmentRevision ?? 0) ||
        snapshot.get("studentCount") !== expected.studentCount))
        throw new Error("Division availability changed. Check the seats and try again.");
      counts.set(id, divisionCount(id, students));
    }
    const capacity = divisionCapacity(destination.data() as DivisionClass);
    if (capacity === undefined && destination.get("capacity") != null)
      throw new Error("Set a valid seating capacity for this division in Classes & Sections first.");
    if (capacity !== undefined && (counts.get(classId) ?? 0) >= capacity)
      throw new Error(`Division ${destination.get("section")} has no available seats. Choose another division.`);

    const audit = stamp();
    // Preserve grade, department, admission, guardian and transport information.
    tx.update(studentRef, { classId, section: destination.get("section"), roll: 0, rollAcademicYear: "", ...audit });
    for (const [index, id] of ids.entries()) {
      if (!classSnaps[index]!.exists()) continue;
      tx.update(refs[index]!, { studentCount: Math.max(0, (counts.get(id) ?? 0) + (id === classId ? 1 : -1)),
        divisionAssignmentRevision: (classSnaps[index]!.get("divisionAssignmentRevision") ?? 0) + 1, ...audit });
    }
  });
}
