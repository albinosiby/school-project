import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";
import type { ClassRow } from "./logic";

export async function saveClassTeacher(classId: string, teacherId: string, create?: Pick<ClassRow, "grade" | "section" | "streamId" | "stream" | "room" | "wing">) {
  const { data } = await httpsCallable<{ classId: string; teacherId: string; schoolId: string | null; create?: typeof create }, Pick<ClassRow, "classTeacherId" | "classTeacher">>(functions, "setClassTeacher")({ classId, teacherId, schoolId: currentSchoolId(), ...(create ? { create } : {}) });
  return data;
}
