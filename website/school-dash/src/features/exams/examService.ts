import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
import { currentSchoolId } from "@/lib/useCollection";

export async function examAction(
  cycleId: string,
  action: string,
  payload: Record<string, unknown> = {},
  requestId = crypto.randomUUID(),
) {
  const { data } = await httpsCallable<Record<string, unknown>, { ok: boolean; batchId?: string }>(
    functions,
    "manageExamination",
  )({ ...payload, cycleId, action, requestId, schoolId: currentSchoolId() });
  return data;
}
export async function downloadReport(batchId: string, studentId?: string) {
  const { data } = await httpsCallable<Record<string, unknown>, { content: string; filename: string }>(
    functions,
    "downloadExamReport",
  )({ schoolId: currentSchoolId(), batchId, ...(studentId ? { studentId } : {}) });
  const bytes = Uint8Array.from(atob(data.content), (char) => char.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export type ExamActivity = {
  id: string;
  cycleId: string;
  action: string;
  actorName?: string;
  actorId: string;
  at: string;
  paperId?: string;
  studentId?: string;
  reason?: string;
  previous?: unknown;
  next?: unknown;
};
export type ScheduleHistory = {
  id: string;
  cycleId: string;
  paperId: string;
  subject: string;
  previous: { date: string; start: string; venue: string };
  next: { date: string; start: string; venue: string; scheduleStatus: string };
  reason: string;
  notes?: string;
  actorName: string;
  at: string;
  notificationStatus: string;
};
export type ReportTemplate = {
  teacherSignatureImage?: string;
  principalSignatureImage?: string;
  id: string;
  name: string;
  classIds: string[];
  showComponents: boolean;
  showAttendance: boolean;
  showRemarks: boolean;
  showRank: boolean;
  teacherSignature: string;
  principalSignature: string;
  footer: string;
};
export type ReportBatch = {
  id: string;
  cycleId: string;
  classId: string;
  classLabel: string;
  status: "Preview" | "Pending approval" | "Approved" | "Published" | "Superseded";
  students: number;
  createdAt: string;
  publishedAt?: string;
  notificationStatus?: string;
};
