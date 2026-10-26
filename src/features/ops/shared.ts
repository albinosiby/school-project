export const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
export const SECTIONS = ["A", "B", "C", "D"];
export const SUBJECTS = ["Mathematics", "English", "Science", "Social Science", "Hindi", "Physical Education", "Physics", "Remedial Lab"];
export const todayIso = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
export const classIdOf = (grade: string, section: string) => `cls_${grade}${section}`;
export type StaffRef = { id: string; name: string; department: string; role?: string };
/** staff who can be put on a timetable (everyone except pure administration) */
export const teachingStaff = (staff: StaffRef[]) => staff.filter((s) => s.department !== "Administration").sort((a, b) => a.name.localeCompare(b.name));
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** Mon..Sat name for an ISO date (Sunday -> "Sun") */
export const dayOfIso = (iso: string) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(`${iso}T12:00:00`).getDay()]!;
/** numeric id suffix helper: next `prefix_001` style id */
export const nextId = (prefix: string, ids: string[]) => `${prefix}_${String(Math.max(0, ...ids.map((i) => Number(new RegExp(`^${prefix}_(\\d+)$`).exec(i)?.[1] ?? 0))) + 1).padStart(3, "0")}`;
