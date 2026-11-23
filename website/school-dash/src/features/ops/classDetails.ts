import type { Student } from "@/features/people/StudentsView";
import type { Staff } from "@/features/people/StaffView";
import type { Cycle, Mark as ExamMark, Paper } from "@/features/exams/types";
import { classStream, sectionLabel, streamFromClassId, streamName } from "@/lib/academicStreams";
import { currentLessons, currentPeriodAttendance, schoolDaySchedule, teachingPeriods, workingDay, type ClassActivityConfig, type PeriodClock } from "./classActivity";
import { isCounted, latestRecord, periodClass, type Assignment, type AttRec, type ClassRow, type Period, type Substitution } from "./logic";
import { activeStudent, dayOfIso, studentClassId } from "./shared";

export type ClassStudent = Pick<Student, "id" | "name" | "grade" | "section"> & Partial<Student>;
export type ClassTeacher = Pick<Staff, "id" | "name"> & Partial<Staff> & { updatedAt?: string };
export type ClassAttendanceRecord = AttRec & { studentIds?: string[]; rosterIds?: string[] };
export const classDetailsHref = (id: string) => `/classes/${encodeURIComponent(id)}`;
export const studentHref = (id: string) => `/students/${encodeURIComponent(id)}`;
export const teacherHref = (id: string) => `/staff/${encodeURIComponent(id)}`;
export const classTitle = (row: ClassRow) => [
  /^\d+$/.test(row.grade) ? `Grade ${row.grade}` : row.grade,
  row.stream || streamName(classStream(row) || streamFromClassId(row.id)), `Section ${row.section || "—"}`,
].filter(Boolean).join(" · ");

export function classRoster(students: ClassStudent[], classId: string) {
  return students.filter((student) => activeStudent(student) && studentClassId(student) === classId)
    .sort((a, b) => (Number(a.roll) || Infinity) - (Number(b.roll) || Infinity) || a.name.localeCompare(b.name));
}
/** Roll numbers 1..N for a division in name order (case-insensitive, stable for equal names by id). Every student is
 * renumbered so the order is consistent; the class teacher's app refuses to move a number another student holds. */
export function rollPlan(roster: ClassStudent[]) {
  const byName = [...roster].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id));
  return byName.map((student, index) => ({ id: student.id, name: student.name, roll: index + 1, previous: Number(student.roll) || 0 }));
}
export function genderCounts(students: ClassStudent[]) {
  const boys = students.filter((student) => /^(male|boy)$/i.test(student.gender?.trim() ?? "")).length;
  const girls = students.filter((student) => /^(female|girl)$/i.test(student.gender?.trim() ?? "")).length;
  return { total: students.length, boys, girls, other: students.length - boys - girls };
}

export function classTeachers(cls: ClassRow, assignments: Assignment[], periods: Period[], staff: ClassTeacher[]) {
  const byTeacher = new Map<string, { id: string; name: string; staff?: ClassTeacher; subjects: Set<string> }>();
  function add(id: string | undefined, name: string | undefined, subject: string) {
    if (!id && !name) return;
    const matches = !id && name ? staff.filter((row) => row.name === name) : [];
    const member = id ? staff.find((row) => row.id === id) : matches.length === 1 ? matches[0] : undefined;
    const key = member?.id || id || `legacy:${name || "Unassigned"}`;
    const entry = byTeacher.get(key) ?? { id: key, name: member?.name || name || "Not assigned", staff: member, subjects: new Set<string>() };
    if (subject) entry.subjects.add(subject);
    byTeacher.set(key, entry);
  }
  if (cls.classTeacherId) add(cls.classTeacherId, cls.classTeacher, "");
  assignments.filter((row) => row.classId === cls.id).forEach((row) => add(row.teacherId, (row as Assignment & { teacher?: string }).teacher, row.subject));
  periods.filter((row) => periodClass(row) === cls.id).forEach((row) => add(row.teacherId, row.teacher, row.subject));
  return [...byTeacher.values()].map((entry) => ({ ...entry, subjects: [...entry.subjects].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** One submitted revision per period. Day-level records stay separate from hourly attendance. */
export function periodRecords(rows: ClassAttendanceRecord[], classId: string, date?: string) {
  const chosen = new Map<string, ClassAttendanceRecord>();
  for (const row of rows) {
    if (row.classId !== classId || (date && row.date !== date) || !isCounted(row) || !Number.isInteger(Number(row.period)) || Number(row.period) < 1) continue;
    const key = `${row.date}:${row.period}`;
    chosen.set(key, latestRecord([...(chosen.has(key) ? [chosen.get(key)!] : []), row])!);
  }
  return [...chosen.values()].sort((a, b) => b.date.localeCompare(a.date) || Number(a.period) - Number(b.period));
}
export function periodCount(record: AttRec) {
  return currentPeriodAttendance({ state: "period", period: Number(record.period), date: record.date } as PeriodClock, [record]).get(record.classId);
}
export type StudentPeriodMark = "P" | "A" | "L" | "E" | "Not marked" | "Not enrolled" | "Unavailable";
export function studentPeriodMark(student: ClassStudent, record: ClassAttendanceRecord | undefined, today: string, roster: ClassStudent[]): StudentPeriodMark {
  if (!record) return "Not marked";
  if (student.admissionDate && student.admissionDate > record.date) return "Not enrolled";
  if (periodCount(record)?.state !== "marked") return "Unavailable";
  const mark = record.marks?.[student.id];
  if (mark === "P" || mark === "A" || mark === "L" || mark === "E") return mark;
  const savedRoster = record.studentIds ?? record.rosterIds;
  if (Array.isArray(savedRoster)) return savedRoster.includes(student.id) ? "P" : "Not enrolled";
  // Older rolls store only exceptions. Current roster membership cannot establish a historical presence mark.
  const ids = new Set(roster.map((row) => row.id));
  return record.date === today && Number(record.total) === roster.length && Object.keys(record.marks ?? {}).every((id) => ids.has(id)) ? "P" : "Unavailable";
}

export function classDay(classId: string, date: string, bell: ClassActivityConfig | undefined, regional: ClassActivityConfig | undefined,
  periods: Period[], substitutions: Substitution[], teachers: ClassTeacher[], attendance: ClassAttendanceRecord[]) {
  const parsedDate = new Date(`${date}T12:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return { scheduleAvailable: false, nonWorkingDay: false, breaks: [], rows: [], outsideRows: [] };
  }
  const day = dayOfIso(date);
  const records = periodRecords(attendance, classId, date);
  const schedule = schoolDaySchedule(bell);
  const nonWorkingDay = !workingDay(date, day, regional?.workingWeek);
  const lessonRows = periods.filter((row) => periodClass(row) === classId && row.day === day);
  const savedNumbers = [...new Set([...records, ...lessonRows].map((row) => Number(row.period)))].filter((number) => Number.isInteger(number) && number > 0).sort((a, b) => a - b);
  const slots = schedule && (!nonWorkingDay || savedNumbers.length) ? schedule : [];
  const configured = teachingPeriods(schedule).map((slot) => slot.period);
  const numbers = schedule ? teachingPeriods(slots).map((slot) => slot.period) : savedNumbers;
  const makeRows = (numbers: number[]) => numbers.map((period) => {
    const clock = { date, day, period, state: "period" } as PeriodClock;
    const slot = schedule?.find((row) => row.label === `Period ${period}`);
    const record = records.find((row) => Number(row.period) === period);
    return { id: String(period), period, from: slot?.from, to: slot?.to,
      lesson: currentLessons(clock, lessonRows, substitutions, teachers).get(classId), record, count: record ? periodCount(record) : undefined };
  });
  return {
    scheduleAvailable: Boolean(schedule),
    nonWorkingDay,
    breaks: slots.filter((slot) => slot.break),
    rows: makeRows(numbers),
    outsideRows: makeRows(schedule ? savedNumbers.filter((number) => !configured.includes(number)) : []),
  };
}

export function attendanceHistory(records: ClassAttendanceRecord[], classId: string, month: string) {
  const days = new Map<string, { id: string; periods: number; present: number; total: number; invalid: number }>();
  for (const record of periodRecords(records, classId).filter((row) => row.date.startsWith(`${month}-`))) {
    const day = days.get(record.date) ?? { id: record.date, periods: 0, present: 0, total: 0, invalid: 0 };
    const count = periodCount(record);
    day.periods++;
    if (count?.state === "marked") { day.present += count.present; day.total += count.total; } else day.invalid++;
    days.set(record.date, day);
  }
  return [...days.values()].sort((a, b) => b.id.localeCompare(a.id));
}

function coversClass(paper: Paper, cls: ClassRow) {
  return paper.classIds?.length ? paper.classIds.includes(cls.id) : paper.grade === cls.grade;
}
function publishedFor(paper: Paper, cls: ClassRow) {
  const label = sectionLabel(cls.grade, cls.section, classStream(cls) || streamFromClassId(cls.id));
  return (paper.published ?? []).some((value) => value === label || value === cls.id);
}
export function classExams(cls: ClassRow, cycles: Cycle[], papers: Paper[]) {
  return cycles.filter((cycle) => cycle.status !== "Draft" && papers.some((paper) => paper.cycleId === cycle.id && coversClass(paper, cls) && publishedFor(paper, cls)))
    .sort((a, b) => (b.declaration || b.end || b.start || "").localeCompare(a.declaration || a.end || a.start || ""));
}
export function defaultClassExam(cls: ClassRow, cycles: Cycle[], papers: Paper[]) {
  const options = classExams(cls, cycles, papers);
  return options.find((cycle) => papers.filter((paper) => paper.cycleId === cycle.id && coversClass(paper, cls)).every((paper) => publishedFor(paper, cls))) ?? options[0];
}
export type ClassResult = { id: string; name: string; state: "Passed" | "Failed" | "Pending" | "Re-exam" | "Unavailable"; percentage: number | null; obtained: number; maximum: number };
/** Only complete, published results enter the denominator. Pass every subject under the cycle's component/aggregate rule. */
export function classResults(cls: ClassRow, roster: ClassStudent[], cycle: Cycle | undefined, papers: Paper[], marks: ExamMark[]) {
  const relevant = cycle ? papers.filter((paper) => paper.cycleId === cycle.id && coversClass(paper, cls)) : [];
  const paperIds = new Set(relevant.map((paper) => paper.id));
  const marksByStudentPaper = new Map<string, ExamMark[]>();
  for (const mark of marks) {
    if (!paperIds.has(mark.paperId) || (mark.classId && mark.classId !== cls.id)) continue;
    const studentId = mark.studentId || String(mark.candId ?? "").replace(/^cand_/, "");
    const key = JSON.stringify([studentId, mark.paperId]);
    const entries = marksByStudentPaper.get(key) ?? [];
    entries.push(mark); marksByStudentPaper.set(key, entries);
  }
  const independent = /33% independently/i.test(cycle?.passRule ?? "");
  const knownRule = independent || /33% aggregate/i.test(cycle?.passRule ?? "");
  const rows: ClassResult[] = roster.map((student) => {
    let incomplete = false, reexam = false, invalid = false, failed = false, absent = false, obtained = 0, maximum = 0;
    for (const paper of relevant) {
      if (!publishedFor(paper, cls)) { incomplete = true; continue; }
      const found = marksByStudentPaper.get(JSON.stringify([student.id, paper.id])) ?? [];
      if (!found.length) { incomplete = true; continue; }
      if (found.length > 1) { invalid = true; continue; }
      const mark = found[0]!, status = mark.status?.trim().toLowerCase();
      if (status === "absent" || status === "disqualified") { failed = true; absent = true; continue; }
      if (mark.theory == null && (mark.medical || status?.startsWith("medical"))) { reexam = true; continue; }
      const tMax = paper.theory, iMax = paper.internal, theory = tMax === 0 && mark.theory == null ? 0 : mark.theory,
        internal = iMax === 0 && mark.internal == null ? 0 : mark.internal;
      if (![tMax, iMax].every((value) => Number.isInteger(value) && value >= 0) || tMax + iMax <= 0) { invalid = true; continue; }
      if (theory == null || internal == null) { incomplete = true; continue; }
      if (!Number.isInteger(theory) || !Number.isInteger(internal) || theory < 0 || theory > tMax || internal < 0 || internal > iMax) { invalid = true; continue; }
      obtained += theory + internal; maximum += tMax + iMax;
      if (independent ? (tMax > 0 && theory / tMax < 0.33) || (iMax > 0 && internal / iMax < 0.33) : (theory + internal) / (tMax + iMax) < 0.33) failed = true;
    }
    const state = !relevant.length || !knownRule || invalid ? "Unavailable" : reexam ? "Re-exam" : incomplete ? "Pending" : failed ? "Failed" : "Passed";
    return { id: student.id, name: student.name, state, obtained, maximum,
      percentage: !absent && maximum > 0 && ["Passed", "Failed"].includes(state) ? Math.round(obtained * 1000 / maximum) / 10 : null };
  });
  const passed = rows.filter((row) => row.state === "Passed").length, failed = rows.filter((row) => row.state === "Failed").length;
  return { rows, passed, failed, assessed: passed + failed, pending: rows.length - passed - failed,
    percentage: passed + failed ? Math.round(passed * 1000 / (passed + failed)) / 10 : null };
}
