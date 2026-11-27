// Callables behind the class teacher's student details (functions/classTeacherStudents.js, region asia-south1).
// The server checks that the signed-in teacher is the class teacher of the student's division.
import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { parseDetails, type DetailsPatch, type StudentDetails } from "./details";

/** the server's message (HttpsError), else a plain fallback */
function messageOf(error: unknown, fallback: string) {
  const e = error as { code?: string; message?: string } | null;
  const code = String(e?.code ?? "");
  if (e?.message && code && !/internal|unavailable|unknown|deadline/.test(code)) return e.message;
  return fallback;
}

export async function fetchStudentDetails(studentId: string): Promise<StudentDetails> {
  try {
    const { data } = await httpsCallable<{ studentId: string }, unknown>(functions, "getClassStudentDetails")({ studentId });
    return parseDetails(data);
  } catch (error) {
    throw new Error(messageOf(error, "Could not load the student details. Check your connection and try again."));
  }
}

export async function saveStudentDetails(studentId: string, patch: DetailsPatch): Promise<StudentDetails> {
  try {
    const { data } = await httpsCallable<Record<string, unknown>, unknown>(functions, "updateClassStudentDetails")({ studentId, ...patch });
    return parseDetails(data);
  } catch (error) {
    throw new Error(messageOf(error, "Could not save the changes. Check your connection and try again."));
  }
}
