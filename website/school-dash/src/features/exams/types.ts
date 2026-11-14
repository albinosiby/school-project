import type { ExamRules } from "./examSetup";
export type Cycle = {
  operationalStatus?: "Scheduled" | "Postponed"; correctionPending?: boolean;
  classIds?: string[]; excludedStudentIds?: string[]; academicYear?: string; examType?: string; description?: string;
  /** set_exam_types id and set_terms id the exam was created from (assessment scheme, step 1 of the workflow) */
  examTypeId?: string; termId?: string;
  /** workflow stage (contract: openEntry → "entry", compile → "tabulation", publishResults → "published") */
  stage?: "setup" | "scheduled" | "entry" | "tabulation" | "published" | "closed";
  entryOpenedAt?: string;
  resultRules?: ExamRules; publishAt?: string; publishAtLocal?: string; publicationTimezone?: string; publicationState?: "draft" | "scheduled" | "published";
  setupVersion?: number; updatedAt?: string;
  id: string; title: string; short: string; term: string; category: string; start: string; end: string; declaration: string;
  instructions: string; circular: string; grades: string[]; sections: "all" | "custom"; enforceAttendance: boolean;
  theoryMax: number; internalMax: number; internalParts: number[]; scale: string; passRule: string; grace: string;
  qr: boolean; sealed: boolean; biometric: boolean; status: "Draft" | "Scheduled" | "Live" | "Completed";
};
export type Paper = {
  scheduleStatus?: "Scheduled" | "Postponed" | "Cancelled"; scheduleRevision?: number;
  publishedClassIds?: string[];
  lockedClassIds?: string[];
  id: string; cycleId: string; grade: string; subject: string; code: string; date: string; start: string; duration: number;
  theory: number; internal: number; internalType: string; venue: string; invigilator: string;
  status: "Scheduled" | "Completed"; marksEntered: boolean; published: string[];
  /** staff id of the chief invigilator (exam duty; the teacher is notified) */
  invigilatorId?: string;
  /** classes sitting the paper (contract section 3) */
  classIds?: string[];
  /** marks entry closed for teachers (they are notified) */
  locked?: boolean;
  assessmentMode?: "marks" | "grade"; practical?: number; passMarks?: number; theoryPass?: number; practicalPass?: number; internalPass?: number;
  gradeOptions?: string[]; weight?: number; instructions?: string; evaluatorIds?: Record<string, string>;
  studentIds?: string[]; resultRules?: ExamRules; scale?: string; setupVersion?: number; setupPublished?: boolean; setupPlanned?: boolean;
};
/** exm_candidates (contract 3): id cand_{studentId}, roll is the display string "#8A-01", cls the label "8-A" */
export type Candidate = { id: string; studentId?: string; name: string; roll: string; grn: string; classId?: string; cls: string; grade: string; section: string };
/**
 * exm_marks (contract 4 / 11): id {paperId}__cand_{studentId}. The teacher app writes theory, status ("Present" | "Absent" |
 * "Medical Slip" | "Disqualified"), tag, note, teacherId; internal, medical and verified belong to the admin.
 */
export type Mark = {
  id: string; paperId: string; candId: string; theory: number | null; internal: number | null; medical: boolean; verified: boolean;
  studentId?: string; classId?: string; teacherId?: string; status?: string; practical?: number | null; gradeValue?: string; verificationFingerprint?: string;
};

export function cbseGrade(pct: number) {
  return pct >= 91 ? "A1" : pct >= 81 ? "A2" : pct >= 71 ? "B1" : pct >= 61 ? "B2" : pct >= 51 ? "C1" : pct >= 41 ? "C2" : pct >= 33 ? "D" : "E";
}
export function endTime(start: string, duration: number) {
  const [h, m] = start.split(":").map(Number);
  const t = h * 60 + m + Math.round(duration * 60);
  const hh = Math.floor(t / 60) % 24, mm = t % 60;
  return `${String(hh % 12 || 12).padStart(2, "0")}:${String(mm).padStart(2, "0")} ${hh >= 12 ? "PM" : "AM"}`;
}
export function startLabel(start: string) {
  const [h, m] = start.split(":").map(Number);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
export type { AssessmentResult as Eval } from "../../../../functions/examAssessment";
import { assessMark, type AssessmentResult } from "../../../../functions/examAssessment";
export function evaluate(mark: Pick<Mark, "theory" | "internal" | "medical" | "verified"> & { status?: string; practical?: number | null; gradeValue?: string; verificationFingerprint?: string } | undefined, theory: number, internal: number, paper?: Partial<Paper>): AssessmentResult {
  const result = assessMark(!paper && typeof mark?.theory === "number" ? { ...mark, medical: false, status: "Present" } : mark, { ...paper, theory, internal });
  if (paper) return result;
  const { passed, ...legacy } = result;
  void passed;
  return legacy;
}
