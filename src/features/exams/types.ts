export type Cycle = {
  id: string; title: string; short: string; term: string; category: string; start: string; end: string; declaration: string;
  instructions: string; circular: string; grades: string[]; sections: "all" | "custom"; enforceAttendance: boolean;
  theoryMax: number; internalMax: number; internalParts: number[]; scale: string; passRule: string; grace: string;
  qr: boolean; sealed: boolean; biometric: boolean; status: "Draft" | "Scheduled" | "Live" | "Completed";
};
export type Paper = {
  id: string; cycleId: string; grade: string; subject: string; code: string; date: string; start: string; duration: number;
  theory: number; internal: number; internalType: string; venue: string; invigilator: string;
  status: "Scheduled" | "Completed"; marksEntered: boolean; published: string[];
  /** staff id of the chief invigilator (exam duty; the teacher is notified) */
  invigilatorId?: string;
  /** classes sitting the paper (contract section 3) */
  classIds?: string[];
  /** marks entry closed for teachers (they are notified) */
  locked?: boolean;
};
/** exm_candidates (contract 3): id cand_{studentId}, roll is the display string "#8A-01", cls the label "8-A" */
export type Candidate = { id: string; studentId?: string; name: string; roll: string; grn: string; cls: string; grade: string; section: string };
/**
 * exm_marks (contract 4 / 11): id {paperId}__cand_{studentId}. The teacher app writes theory, status ("Present" | "Absent" |
 * "Medical Slip" | "Disqualified"), tag, note, teacherId; internal, medical and verified belong to the admin.
 */
export type Mark = {
  id: string; paperId: string; candId: string; theory: number | null; internal: number | null; medical: boolean; verified: boolean;
  studentId?: string; classId?: string; teacherId?: string; status?: string;
};

export const GRADE_STUDENTS: Record<string, number> = { "8": 128, "9": 142, "10": 150, "11": 118, "12": 112 };

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
export type Eval = { state: "pending" | "invalid" | "medical" | "absent" | "verified" | "passed" | "failed"; total: number | null; pct: number | null; grade: string };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
/**
 * A candidate's result on a paper. Out-of-range marks are "invalid"; no theory mark with the medical flag (or the teacher
 * app's "Medical Slip") is "medical"; no theory mark with the teacher app's "Absent" / "Disqualified" is "absent" (AB / DQ).
 */
export function evaluate(m: Pick<Mark, "theory" | "internal" | "medical" | "verified"> & { status?: string } | undefined, tMax: number, iMax: number): Eval {
  const th = num(m?.theory), it = num(m?.internal);
  if (th !== null && (th > tMax || th < 0) || it !== null && (it > iMax || it < 0)) return { state: "invalid", total: (th ?? 0) + (it ?? 0), pct: null, grade: "ERR" };
  const st = String(m?.status ?? "").toLowerCase();
  if (th === null && (m?.medical || st.startsWith("medical"))) return { state: "medical", total: null, pct: null, grade: "--" };
  if (th === null && (st === "absent" || st === "disqualified")) return { state: "absent", total: null, pct: null, grade: st === "absent" ? "AB" : "DQ" };
  if (th === null || it === null) return { state: "pending", total: null, pct: null, grade: "--" };
  const total = th + it, pct = (total / (tMax + iMax)) * 100;
  const pass = pct >= 33;
  return { state: m?.verified ? "verified" : pass ? "passed" : "failed", total, pct, grade: cbseGrade(pct) };
}
