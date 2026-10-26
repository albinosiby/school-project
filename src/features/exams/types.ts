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
export type Candidate = { id: string; name: string; roll: string; grn: string; cls: string; grade: string; section: string };
export type Mark = { id: string; paperId: string; candId: string; theory: number | null; internal: number | null; medical: boolean; verified: boolean };

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
export type Eval = { state: "pending" | "invalid" | "medical" | "verified" | "passed" | "failed"; total: number | null; pct: number | null; grade: string };
export function evaluate(m: Pick<Mark, "theory" | "internal" | "medical" | "verified"> | undefined, tMax: number, iMax: number): Eval {
  const th = m?.theory ?? null, it = m?.internal ?? null;
  if (th !== null && (th > tMax || th < 0) || it !== null && (it > iMax || it < 0)) return { state: "invalid", total: (th ?? 0) + (it ?? 0), pct: null, grade: "ERR" };
  if (m?.medical && th === null) return { state: "medical", total: null, pct: null, grade: "--" };
  if (th === null || it === null) return { state: "pending", total: null, pct: null, grade: "--" };
  const total = th + it, pct = (total / (tMax + iMax)) * 100;
  const pass = pct >= 33;
  return { state: m?.verified ? "verified" : pass ? "passed" : "failed", total, pct, grade: cbseGrade(pct) };
}
