// Pure helpers of class attendance marking: `ops_attendance/{date}_{classId}_{period}` exactly as the teacher app's
// `att_records` adapter writes it (marks hold only non-present students; validTeacherAttendance key set).
import { subStatus, type AttRec, type Mark, type Period, type Substitution } from "@/features/ops/logic";
import { activeSub, dayOfIso, gradeSectionOf, periodClassId } from "../teaching";

export type Slot = { period: number; classId: string; subject: string; kind: "period" | "sub"; status?: string };
export const MARKS: { v: Mark; label: string }[] = [
  { v: "P", label: "Present" }, { v: "A", label: "Absent" }, { v: "L", label: "Late" }, { v: "E", label: "Leave" },
];

/** the periods the teacher can mark on `date`: own timetable periods of that weekday + Assigned/Accepted covers dated that day */
export function slotsForDate(date: string, periods: Period[], subs: Substitution[]): Slot[] {
  const day = dayOfIso(date);
  const own: Slot[] = periods.filter((p) => p.day === day).map((p) => ({ period: Number(p.period), classId: periodClassId(p), subject: p.subject || "", kind: "period" }));
  const covers: Slot[] = subs.filter((s) => s.date === date && activeSub(s))
    .map((s) => ({ period: Number(s.period), classId: s.classId, subject: s.subject || "", kind: "sub", status: subStatus(s.status) }));
  const seen = new Set<string>();
  return [...covers, ...own].filter((s) => { const k = `${s.period}_${s.classId}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.period - b.period);
}

export const attendanceId = (date: string, classId: string, period: number) => `${date}_${classId}_${period}`;
export const slotKey = (s: Pick<Slot, "period" | "classId">) => `${s.period}_${s.classId}`;

/** marks to start editing from: the saved record (missing key = present), else everyone present */
export function initialMarks(roster: { id: string }[], saved?: Pick<AttRec, "marks">) {
  return Object.fromEntries(roster.map((s) => { const m = saved?.marks?.[s.id]; return [s.id, (m === "A" || m === "L" || m === "E" ? m : "P") as Mark]; }));
}

/** Why the record cannot be saved ("" when it can). */
export function saveError(v: { date: string; today: string; rosterSize: number; slot?: Slot; recordedBy?: string; staffId: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date)) return "Pick a valid date";
  if (v.date > v.today) return "Attendance cannot be saved for a future date";
  if (!v.slot) return "Pick one of your periods";
  if (!v.rosterSize) return "No students in this class";
  if (v.recordedBy && v.recordedBy !== v.staffId) return "This attendance was recorded by another teacher. Contact the school office for corrections.";
  return "";
}

/** the teacher record body (AttendanceAdapter.write): only non-present students in `marks`, + teacherId; the store adds updatedAt/updatedBy */
export function teacherRecord(v: { date: string; classId: string; period: number; rosterIds: string[]; marks: Record<string, Mark | undefined>; staffId: string; grade?: string; section?: string }) {
  const nonPresent: Record<string, "A" | "L" | "E"> = {};
  v.rosterIds.forEach((id) => { const m = v.marks[id]; if (m === "A" || m === "L" || m === "E") nonPresent[id] = m; });
  const parsed = gradeSectionOf(v.classId);
  return {
    date: v.date, classId: v.classId, grade: v.grade ?? parsed.grade, section: v.section ?? parsed.section, period: v.period,
    total: v.rosterIds.length, marks: nonPresent, submitted: true, teacherId: v.staffId,
  };
}

/** own submitted records, newest date first then by period */
export const ownHistory = (rows: AttRec[], staffId: string) => rows
  .filter((r) => r.teacherId === staffId && r.deleted !== true)
  .sort((a, b) => b.date.localeCompare(a.date) || (Number(a.period) || 0) - (Number(b.period) || 0));

/** present count from total + non-present marks */
export const presentOf = (r: Pick<AttRec, "total" | "marks">) => {
  const away = Object.values(r.marks ?? {}).filter((m) => m === "A" || m === "E").length;
  return Math.max(0, (Number(r.total) || 0) - away);
};
