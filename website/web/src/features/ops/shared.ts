export const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
/** contract section 9: sections are A-D */
export const SECTIONS = ["A", "B", "C", "D"];
export const SUBJECTS = ["Mathematics", "English", "Science", "Social Science", "Hindi", "Physical Education", "Physics", "Remedial Lab"];
export const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
/** contract section 2: class id = cls_{grade}{SECTION} (grade "10", section "b" -> cls_10B) */
export const classIdOf = (grade: string, section: string) => `cls_${String(grade ?? "").trim()}${String(section ?? "").trim().toUpperCase()}`;
/** "cls_10B" -> "Grade 10-B" (anything else is shown as is) */
export const clsLabel = (id: string) => String(id ?? "").replace(/^cls_(\d+)(.*)$/, "Grade $1-$2");
export type StaffRef = { id: string; name: string; department: string; role?: string };
/** staff who can be put on a timetable (everyone except pure administration) */
export const teachingStaff = (staff: StaffRef[]) => staff.filter((s) => s.department !== "Administration").sort((a, b) => a.name.localeCompare(b.name));
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Mon..Sat name for an ISO date (Sunday -> "Sun") */
export const dayOfIso = (iso: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${iso}T12:00:00`).getDay()] ?? "";
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/** numeric id suffix helper: next `prefix_001` style id (ids of other shapes are ignored) */
export const nextId = (prefix: string, ids: string[]) => {
  const re = new RegExp(`^${escapeRe(prefix)}_(\\d+)$`);
  const max = Math.max(0, ...ids.map((i) => Number(re.exec(i)?.[1] ?? 0)));
  return `${prefix}_${String(max + 1).padStart(3, "0")}`;
};
/** the class a student sits in: `classId`, else derived from grade + section (rows written before the contract) */
export const studentClassId = (s: { classId?: string; grade?: string; section?: string }) => s.classId || classIdOf(s.grade ?? "", s.section ?? "");
/** students who count in a class roster: not soft-deleted and Active (or no status), same rule as functions/parent.js */
export const activeStudent = (s: { deleted?: boolean; status?: string } | null | undefined) => !!s && s.deleted !== true && (!s.status || /^active$/i.test(String(s.status)));
