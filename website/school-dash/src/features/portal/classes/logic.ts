// Pure helpers of the teacher's classes, mirroring the teacher app (mobile app/teacher/lib/modules/classes):
// the "My class" / "Classes you teach" split (classes_screen.dart), the class management figures
// (bloc/class_management_states.dart) and the student profile (bloc/student_profile_states.dart).
// Shapes follow store_adapters.dart: ClassTimetableAdapter (ops_periods by classId), ClassMarksAdapter (exm_marks +
// exm_papers + exm_cycles), AttendanceAdapter (ops_attendance: marks hold only non-present students) and
// StudentLeavesAdapter (student_leaves: a teacher changes only status, decisionNote, decidedBy, decidedAt, updatedAt,
// updatedBy). Nothing here touches Firestore.
import type { AttRec, Period } from "@/features/ops/logic";
import { myClassIds, mySubjects, periodClassId, type AssignmentDoc, type ClassDoc, type StudentDoc } from "../teaching";

// ---- classes -------------------------------------------------------------------------------------------------------

export type MyClass = { id: string; grade: string; section: string; room?: string; subjects: string[]; classTeacher: boolean };

/** classes the teacher teaches or is class teacher of, class-teacher ones first (the app's ClassesAdapter order) */
export function myClasses(staffId: string, data: { assignments: AssignmentDoc[]; classes: ClassDoc[]; periods: Period[] }): MyClass[] {
  return myClassIds(staffId, data).flatMap((id) => {
    const c = data.classes.find((row) => row.id === id);
    if (!c || c.deleted === true) return [];
    return [{ id, grade: c.grade, section: c.section, room: c.room, subjects: mySubjects(staffId, id, data), classTeacher: c.classTeacherId === staffId }];
  }).sort((a, b) => Number(b.classTeacher) - Number(a.classTeacher) || a.id.localeCompare(b.id));
}

/** "Classes you teach": every class with a subject of hers; her own class only when she teaches a subject there */
export const teachingClasses = (rows: MyClass[]) => rows.filter((c) => !c.classTeacher || c.subjects.length > 0);

/** two or three letters for a subject tile ("Social Science" → SS, "English" → ENG) */
export function subjectCode(subject = "") {
  const words = subject.split(/[\s&]+/).filter(Boolean);
  if (words.length > 1) return words.slice(0, 2).map((w) => w[0]!).join("").toUpperCase();
  return subject.slice(0, 3).toUpperCase() || "—";
}

/** a roster student, with the optional admission date the registers are counted from */
export type RosterStudent = StudentDoc & { admissionDate?: string; academicAttendance?: { percentage?: number } };

// ---- attendance registers ------------------------------------------------------------------------------------------

export type Code = "P" | "A" | "L" | "E";
export const CODE_LABEL: Record<Code, string> = { P: "Present", A: "Absent", L: "Late", E: "Excused" };

/** a student's mark in a register (a missing key means present) */
export const codeOf = (r: Pick<AttRec, "marks">, studentId: string): Code => {
  const m = r.marks?.[studentId];
  return m === "A" || m === "L" || m === "E" ? m : "P";
};

/** present / late / absent / excused counts of one register */
export function countsOf(r: Pick<AttRec, "total" | "marks">) {
  const v = Object.values(r.marks ?? {});
  const absent = v.filter((x) => x === "A").length, late = v.filter((x) => x === "L").length, excused = v.filter((x) => x === "E").length;
  const total = Number(r.total) || 0;
  return { total, present: Math.max(0, total - absent - late - excused), late, absent, excused };
}

/** present or late, in percent of the register */
export const rateOf = (r: Pick<AttRec, "total" | "marks">) => { const c = countsOf(r); return c.total ? ((c.present + c.late) * 100) / c.total : 0; };

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** the class's submitted registers (drafts and deleted ones ignored), oldest first then by period */
export const classRecords = (rows: AttRec[], classId: string) => rows
  .filter((r) => r.classId === classId && r.submitted !== false && r.deleted !== true && ISO_DAY.test(String(r.date)))
  .sort((a, b) => a.date.localeCompare(b.date) || (Number(a.period) || 0) - (Number(b.period) || 0));

/** the latest register of `date` (the class's "today"), else null */
export function registerOn(records: AttRec[], date: string) {
  const day = records.filter((r) => r.date === date);
  return day.length ? day.reduce((a, b) => ((Number(b.period) || 0) >= (Number(a.period) || 0) ? b : a)) : null;
}

// ---- class timetable -----------------------------------------------------------------------------------------------

/** one period of the class timetable (any subject / teacher); `day` is 1 (Mon) … 7 (Sun) */
export type ClassPeriod = { day: number; period: number; subject: string; teacher: string; teacherId?: string };
const DAY_INDEX: Record<string, number> = { mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6, sun: 7 };

/** ISO weekday of a YYYY-MM-DD (Mon 1 … Sun 7) */
export const weekdayOf = (iso: string) => { const d = new Date(`${iso}T12:00:00`).getDay(); return d === 0 ? 7 : d; };

/** the class's timetable from `ops_periods` (ClassTimetableAdapter) */
export function classTimetable(periods: Period[], classId: string): ClassPeriod[] {
  return periods.flatMap((p) => {
    const day = DAY_INDEX[String(p.day ?? "").toLowerCase().slice(0, 3)];
    if (!day || periodClassId(p) !== classId) return [];
    return [{ day, period: Number(p.period) || 0, subject: String(p.subject ?? ""), teacher: String(p.teacher ?? ""), teacherId: p.teacherId }];
  }).sort((a, b) => a.day - b.day || a.period - b.period);
}

/** subject of a register: the timetable's period on that weekday, else "Period n" */
export function subjectOf(r: Pick<AttRec, "date" | "period">, timetable: ClassPeriod[]) {
  const wd = weekdayOf(r.date);
  const p = timetable.find((x) => x.day === wd && x.period === Number(r.period));
  return p?.subject || `Period ${r.period}`;
}

/** periods on the timetable for the weekday of `date` */
export const scheduledOn = (date: string, timetable: ClassPeriod[]) => { const wd = weekdayOf(date); return timetable.filter((p) => p.day === wd).length; };

/** periods of `subject` each week */
export const weeklyPeriods = (subject: string, timetable: ClassPeriod[]) => timetable.filter((p) => p.subject === subject).length;

// ---- marks ---------------------------------------------------------------------------------------------------------

export type MarkDoc = {
  id: string; paperId?: string; candId?: string; studentId?: string; classId?: string; theory?: number | null; practical?: number | null; internal?: number | null;
  gradeValue?: string; status?: string; deleted?: boolean;
};
export type PaperDoc = { id: string; cycleId?: string; subject?: string; title?: string; date?: string; theory?: number; practical?: number; internal?: number; assessmentMode?: string; deleted?: boolean };
export type CycleDoc = { id: string; title?: string; short?: string; start?: string; startDate?: string };

/** one mark of a student in one subject of one exam (ClassMarksAdapter); `pct` null for grade-only, absent or missing scores */
export type ClassMark = { id: string; studentId: string; paperId: string; subject: string; exam: string; cycleId: string; date: string; score: number | null; max: number; grade: string; status: string; pct: number | null };

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const examKey = (m: Pick<ClassMark, "cycleId" | "exam">) => m.cycleId || m.exam;

/** the marks of `studentIds` with each paper's subject and maximum and its exam's name */
export function classMarks(marks: MarkDoc[], papers: PaperDoc[], cycles: CycleDoc[], studentIds: Iterable<string>): ClassMark[] {
  const roster = new Set(studentIds);
  const paperOf = new Map(papers.map((p) => [p.id, p]));
  const cycleOf = new Map(cycles.map((c) => [c.id, c]));
  return marks.flatMap((m) => {
    const sid = m.studentId || String(m.candId ?? "").replace(/^cand_/, "");
    if (m.deleted === true || !roster.has(sid)) return [];
    const paper = paperOf.get(String(m.paperId));
    if (!paper || paper.deleted === true) return [];
    const cycle = cycleOf.get(String(paper.cycleId ?? ""));
    const hasScore = m.theory != null || m.practical != null || m.internal != null;
    const grade = String(m.gradeValue ?? "");
    if (!hasScore && !grade && m.status == null) return [];
    const max = paper.assessmentMode === "grade" ? 0 : num(paper.theory) + num(paper.practical) + num(paper.internal);
    const status = String(m.status ?? (hasScore || grade ? "Present" : "Absent"));
    const score = hasScore ? num(m.theory) + num(m.practical) + num(m.internal) : null;
    return [{
      id: m.id, studentId: sid, paperId: paper.id, subject: String(paper.subject ?? ""), exam: String(cycle?.short || cycle?.title || paper.title || "Exam"),
      cycleId: String(paper.cycleId ?? ""), date: String(paper.date || cycle?.start || cycle?.startDate || ""), score, max, grade, status,
      pct: score == null || max <= 0 ? null : (score * 100) / max,
    }];
  });
}

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const scored = (marks: ClassMark[]) => marks.filter((m): m is ClassMark & { pct: number } => m.pct != null);

/** every exam mark averaged (null without marks) */
export const marksAverage = (marks: ClassMark[]) => avg(scored(marks).map((m) => m.pct));

/** exams in order (by latest paper date, then name) with the class average of each */
export function examAverages(marks: ClassMark[]) {
  const by = new Map<string, (ClassMark & { pct: number })[]>();
  scored(marks).forEach((m) => { const k = examKey(m); by.set(k, [...(by.get(k) ?? []), m]); });
  return [...by.entries()].map(([cycleId, rows]) => ({
    exam: rows[0]!.exam, cycleId, date: rows.reduce((d, m) => (m.date > d ? m.date : d), ""), avg: avg(rows.map((m) => m.pct))!,
  })).sort((a, b) => a.date.localeCompare(b.date) || a.exam.localeCompare(b.exam)).map(({ exam, cycleId, avg: a }) => ({ exam, cycleId, avg: a }));
}

/** a student's average per exam, in the class's exam order (null where they have no score) */
export const studentExamProgress = (marks: ClassMark[], studentId: string) => examAverages(marks).map((e) => ({
  exam: e.exam, classAvg: e.avg, avg: avg(scored(marks).filter((m) => m.studentId === studentId && examKey(m) === e.cycleId).map((m) => m.pct)),
}));

/** a student's marks grouped by subject, each in exam order */
export function studentSubjectMarks(marks: ClassMark[], studentId: string) {
  const order = new Map(examAverages(marks).map((e, i) => [e.cycleId, i]));
  const out = new Map<string, ClassMark[]>();
  marks.filter((m) => m.studentId === studentId).forEach((m) => out.set(m.subject, [...(out.get(m.subject) ?? []), m]));
  out.forEach((rows) => rows.sort((a, b) => (order.get(examKey(a)) ?? 99) - (order.get(examKey(b)) ?? 99) || a.date.localeCompare(b.date)));
  return [...out.entries()].map(([subject, rows]) => ({ subject, rows, avg: avg(scored(rows).map((m) => m.pct)) })).sort((a, b) => a.subject.localeCompare(b.subject));
}

// ---- class management (class_management_states.dart) ---------------------------------------------------------------

/** one school day of the class across every period marked that day (all subjects): period-marks summed */
export type ClassDay = { date: string; periods: number; present: number; late: number; absent: number; excused: number; total: number; absentees: string[] };

export function classDays(records: AttRec[]): ClassDay[] {
  const by = new Map<string, AttRec[]>();
  records.forEach((r) => by.set(r.date, [...(by.get(r.date) ?? []), r]));
  return [...by.entries()].map(([date, rows]) => {
    const d: ClassDay = { date, periods: rows.length, present: 0, late: 0, absent: 0, excused: 0, total: 0, absentees: [] };
    const away = new Set<string>();
    rows.forEach((r) => {
      const c = countsOf(r);
      d.present += c.present; d.late += c.late; d.absent += c.absent; d.excused += c.excused; d.total += c.total;
      Object.entries(r.marks ?? {}).forEach(([sid, m]) => { if (m === "A") away.add(sid); });
    });
    return { ...d, absentees: [...away].sort() };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

/** present or late out of every period-mark of the day */
export const dayRate = (d: Pick<ClassDay, "present" | "late" | "total">) => (d.total ? ((d.present + d.late) * 100) / d.total : 0);

/** class attendance over every period-mark recorded (null before the first register) */
export function overallRate(days: ClassDay[]) {
  const all = days.reduce((s, d) => s + d.total, 0);
  return all ? (days.reduce((s, d) => s + d.present + d.late, 0) * 100) / all : null;
}

/** "1 of 6 periods marked", or "3 periods marked" without a timetable for that day */
export function markedLabel(d: Pick<ClassDay, "date" | "periods">, timetable: ClassPeriod[]) {
  const planned = scheduledOn(d.date, timetable);
  return planned > d.periods ? `${d.periods} of ${planned} periods marked` : `${d.periods} ${d.periods === 1 ? "period" : "periods"} marked`;
}

/** every subject of the class: the timetable's (most periods a week first), then any only in marks or registers */
export function classSubjects(timetable: ClassPeriod[], marks: ClassMark[], records: AttRec[]) {
  const weekly = new Map<string, number>();
  timetable.forEach((p) => { if (p.subject) weekly.set(p.subject, (weekly.get(p.subject) ?? 0) + 1); });
  const out = [...weekly.keys()].sort((a, b) => weekly.get(b)! - weekly.get(a)! || a.localeCompare(b));
  const add = (s: string) => { if (s && !out.includes(s)) out.push(s); };
  marks.forEach((m) => add(m.subject));
  records.forEach((r) => add(subjectOf(r, timetable)));
  return out;
}

/** class attendance per subject (average register rate), registers recorded and weekly periods; rate null without registers */
export function subjectAttendance(records: AttRec[], timetable: ClassPeriod[], subjects: string[]) {
  const sums = new Map<string, { sum: number; n: number }>();
  records.forEach((r) => { const s = subjectOf(r, timetable); const cur = sums.get(s) ?? { sum: 0, n: 0 }; sums.set(s, { sum: cur.sum + rateOf(r), n: cur.n + 1 }); });
  return subjects.map((subject) => {
    const s = sums.get(subject);
    return { subject, rate: s ? s.sum / s.n : null, registers: s?.n ?? 0, weekly: weeklyPeriods(subject, timetable) };
  });
}

/** class average per subject (%), with how many exams it covers; avg null where no mark is entered yet */
export const subjectMarks = (marks: ClassMark[], subjects: string[]) => subjects.map((subject) => {
  const rows = scored(marks).filter((m) => m.subject === subject);
  return { subject, avg: avg(rows.map((m) => m.pct)), exams: new Set(rows.map(examKey)).size };
});

/** a student's attendance per subject: periods attended (present or late) out of periods recorded since admission */
export function studentSubjectAttendance(student: Pick<RosterStudent, "id" | "admissionDate">, records: AttRec[], timetable: ClassPeriod[], subjects: string[]) {
  const out = new Map(subjects.map((s) => [s, { attended: 0, total: 0 }]));
  records.forEach((r) => {
    if (student.admissionDate && r.date < student.admissionDate) return;
    const k = subjectOf(r, timetable), code = codeOf(r, student.id), cur = out.get(k) ?? { attended: 0, total: 0 };
    out.set(k, { attended: cur.attended + (code === "P" || code === "L" ? 1 : 0), total: cur.total + 1 });
  });
  return [...out.entries()].map(([subject, v]) => ({ subject, ...v, rate: v.total ? (v.attended * 100) / v.total : null }));
}

/** a student's standing: attendance over every period marked since admission, marks average, days with an absence */
export type Standing = { student: RosterStudent; attendance: number | null; marks: number | null; absences: number };

export function standings(roster: RosterStudent[], records: AttRec[], marks: ClassMark[]): Standing[] {
  return roster.map((student) => {
    const recs = records.filter((r) => !student.admissionDate || r.date >= student.admissionDate);
    const ok = recs.filter((r) => { const c = codeOf(r, student.id); return c === "P" || c === "L"; }).length;
    const fallback = student.academicAttendance?.percentage;
    return {
      student,
      attendance: recs.length ? (ok * 100) / recs.length : typeof fallback === "number" && fallback > 0 ? fallback : null,
      marks: avg(scored(marks).filter((m) => m.studentId === student.id).map((m) => m.pct)),
      absences: new Set(recs.filter((r) => codeOf(r, student.id) === "A").map((r) => r.date)).size,
    };
  });
}

export const MARK_BANDS = ["<40", "40–60", "60–75", "75–90", "90+"];
/** students by marks average band: <40, 40-60, 60-75, 75-90, 90+ */
export function marksBands(rows: Standing[]) {
  const b = [0, 0, 0, 0, 0];
  rows.forEach(({ marks: m }) => { if (m != null) b[m < 40 ? 0 : m < 60 ? 1 : m < 75 ? 2 : m < 90 ? 3 : 4]!++; });
  return b;
}

/** the three best marks averages */
export const topPerformers = (rows: Standing[]) => rows.filter((s) => s.marks != null).sort((a, b) => b.marks! - a.marks!).slice(0, 3);

/** below the attendance minimum or under 40% in marks, weakest first */
export const needsSupport = (rows: Standing[], minimum: number) => rows
  .filter((s) => (s.attendance != null && s.attendance < minimum) || (s.marks != null && s.marks < 40))
  .sort((a, b) => (a.marks ?? a.attendance ?? 0) - (b.marks ?? b.attendance ?? 0));

// ---- student profile (student_profile_states.dart) -----------------------------------------------------------------

/** one register per school day (the latest written, else the later period), since admission, oldest first */
export function dailyRecords(records: AttRec[], from = "") {
  const by = new Map<string, AttRec>();
  records.forEach((r) => {
    if (from && r.date < from) return;
    const cur = by.get(r.date);
    const at = String(r.updatedAt ?? ""), curAt = String(cur?.updatedAt ?? "");
    if (!cur || at > curAt || (at === curAt && Number(r.period) > Number(cur.period))) by.set(r.date, r);
  });
  return [...by.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** days marked, by code, and the rate (present or late) */
export function attendanceSummary(daily: AttRec[], studentId: string) {
  const n = { P: 0, A: 0, L: 0, E: 0 };
  daily.forEach((r) => { n[codeOf(r, studentId)]++; });
  return { days: daily.length, present: n.P, absent: n.A, late: n.L, excused: n.E, rate: daily.length ? ((n.P + n.L) * 100) / daily.length : null };
}

/** a period of a day: subject, teacher and the student's mark (`code` null = not marked yet) */
export type DaySlot = { period: number; subject: string; teacher: string; code: Code | null };

/** the periods of `date` in order: the timetable's for that weekday plus any other period marked that day */
export function slotsOn(date: string, timetable: ClassPeriod[], records: AttRec[], studentId: string, teacherName: (p: ClassPeriod) => string = (p) => p.teacher): DaySlot[] {
  if (!ISO_DAY.test(date)) return [];
  const wd = weekdayOf(date);
  const regs = new Map(records.filter((r) => r.date === date).map((r) => [Number(r.period), r]));
  const planned = new Map(timetable.filter((p) => p.day === wd).map((p) => [p.period, p]));
  return [...new Set([...planned.keys(), ...regs.keys()])].sort((a, b) => a - b).map((n) => {
    const p = planned.get(n), r = regs.get(n);
    return { period: n, subject: p?.subject || `Period ${n}`, teacher: p ? teacherName(p) : "", code: r ? codeOf(r, studentId) : null };
  });
}

/** how a calendar day reads: no periods, not marked, absent in some period, or present in every marked one */
export function dayState(slots: DaySlot[]): "none" | "unmarked" | "absent" | "present" {
  if (!slots.length) return "none";
  const marked = slots.filter((s) => s.code);
  if (!marked.length) return "unmarked";
  return marked.some((s) => s.code === "A") ? "absent" : "present";
}

/** the day dialog's subtitle */
export function daySummary(slots: DaySlot[]) {
  if (!slots.length) return "No periods on the timetable";
  const absent = slots.filter((s) => s.code === "A").length;
  if (absent) return `Absent in ${absent} of ${slots.length} periods`;
  return slots.every((s) => !s.code) ? "Not marked yet" : "Present in every marked period";
}

/** a month (YYYY-MM) as Monday-first calendar cells: `null` pads the first week */
export function monthCells(month: string): (string | null)[] {
  const [y, m] = month.split("-").map(Number);
  const first = new Date(y!, m! - 1, 1), days = new Date(y!, m!, 0).getDate();
  const lead = (first.getDay() + 6) % 7;
  return [...Array<null>(lead).fill(null), ...Array.from({ length: days }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
}

/** the month next to `month` (step −1 / +1) */
export function shiftMonth(month: string, step: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y!, m! - 1 + step, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const monthLabel = (month: string) => { const [y, m] = month.split("-").map(Number); return `${MONTHS[m! - 1]} ${y}`; };
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Tue 25 Nov" */
export const shortDay = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${DOW[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`; };
/** "25 Nov" */
export const dayMonth = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)}`; };

// ---- homework ------------------------------------------------------------------------------------------------------

export type HomeworkDoc = {
  id: string; classId: string; title: string; subject?: string; due?: string; assigned?: string; status?: string; maxMarks?: number; teacherId?: string; deleted?: boolean;
  submissions?: Record<string, { status?: string; marks?: number } | null>;
};
const hwClosed = (h: HomeworkDoc) => /^(closed|completed)$/i.test(String(h.status ?? ""));
/** where a homework stands: scheduled (assigned later), open or closed */
export const homeworkState = (h: HomeworkDoc, today: string): "scheduled" | "open" | "closed" =>
  hwClosed(h) ? "closed" : h.assigned && h.assigned > today ? "scheduled" : "open";

/** a class's homework (the teacher's own when `staffId` is given): open and scheduled first by due date, then closed, newest first */
export function classHomework(rows: HomeworkDoc[], classId: string, today: string, staffId?: string) {
  return rows.filter((h) => h.classId === classId && h.deleted !== true && (!staffId || h.teacherId === staffId))
    .sort((a, b) => Number(homeworkState(a, today) === "closed") - Number(homeworkState(b, today) === "closed")
      || (homeworkState(a, today) === "closed" ? String(b.due ?? "").localeCompare(String(a.due ?? "")) : String(a.due ?? "").localeCompare(String(b.due ?? ""))));
}

/** hand-ins: turned in (submitted or graded), waiting to be graded, and the class size */
export function handIns(h: HomeworkDoc) {
  const subs = Object.values(h.submissions ?? {});
  return { turnedIn: subs.filter((s) => s?.status === "submitted" || s?.status === "graded").length, toGrade: subs.filter((s) => s?.status === "submitted").length, total: subs.length };
}

/** a student's homework with their status (pending / turned in / graded), latest due first */
export const studentHomework = (rows: HomeworkDoc[], studentId: string) => rows
  .filter((h) => h.deleted !== true && !!h.submissions && studentId in h.submissions)
  .map((h) => { const s = h.submissions![studentId]; return { h, status: s?.status === "graded" ? "graded" : s?.status === "submitted" ? "submitted" : "pending", marks: s?.marks }; })
  .sort((a, b) => String(b.h.due ?? "").localeCompare(String(a.h.due ?? "")));

// ---- leave requests ------------------------------------------------------------------------------------------------

/** a parent's leave request as the parent app writes it (plus the teacher's decision fields) */
export type StudentLeave = {
  id: string; studentId: string; classId: string; name?: string; roll?: number | string; from: string; to?: string; days?: number; reason?: string;
  type?: string; cat?: string; by?: string; status?: string; decisionNote?: string; decidedBy?: string; decidedAt?: string; appliedOn?: string; deleted?: boolean;
};
export type Decision = "Approved" | "Rejected";

/** pending requests of the classes the teacher is class teacher of, oldest first */
export const pendingLeaves = (rows: StudentLeave[], classTeacherIds: string[]) => rows
  .filter((r) => r.deleted !== true && classTeacherIds.includes(r.classId) && (r.status ?? "Pending") === "Pending")
  .sort((a, b) => (a.from || "").localeCompare(b.from || "") || a.id.localeCompare(b.id));

/** decided requests of those classes, newest decision first */
export const decidedLeaves = (rows: StudentLeave[], classTeacherIds: string[]) => rows
  .filter((r) => r.deleted !== true && classTeacherIds.includes(r.classId) && (r.status === "Approved" || r.status === "Rejected"))
  .sort((a, b) => (b.decidedAt || b.from || "").localeCompare(a.decidedAt || a.from || ""));

/** the decision patch (StudentLeavesAdapter.write): status + decisionNote + decidedBy/decidedAt; the store adds updatedAt/updatedBy */
export const decisionPatch = (status: Decision, note: string, staffId: string, now = new Date().toISOString()) =>
  ({ status, decisionNote: note.trim(), decidedBy: staffId, decidedAt: now });

export const decisionNoteError = (note: string) => (note.trim().length > 2000 ? "Note is at most 2000 characters" : "");

/** "2026-05-12 – 2026-05-14" style range from ISO days */
export const leaveRange = (l: Pick<StudentLeave, "from" | "to">) => (l.to && l.to !== l.from ? `${l.from} – ${l.to}` : l.from);

/** does an approved request cover `date`? */
export const leaveCovers = (l: Pick<StudentLeave, "from" | "to" | "status">, date: string) => l.status === "Approved" && l.from <= date && date <= (l.to || l.from);

// ---- formatting ----------------------------------------------------------------------------------------------------

/** "92.4%" (one decimal) or "—" */
export const pct1 = (v: number | null | undefined) => (v == null ? "—" : `${v.toFixed(1)}%`);
/** "92%" or "—" */
export const pct0 = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v)}%`);
