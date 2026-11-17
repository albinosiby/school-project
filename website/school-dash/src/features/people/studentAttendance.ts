/** Daily marks from the student-specific attendance records used by the parent app. */
export type StudentAttendanceMonth = {
  id: string;
  studentId: string;
  days?: Record<string, "P" | "A" | "L" | "E">;
};

export type AttendanceRange = { start: string; end: string };

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

/** Current terms define the school's academic calendar, including non-April starts. */
export function attendanceAcademicRange(terms: { start?: string; end?: string }[]): AttendanceRange | undefined {
  const valid = terms.filter((term): term is AttendanceRange => Boolean(term.start && term.end
    && validDate(term.start) && validDate(term.end) && term.start <= term.end));
  if (!valid.length) return undefined;
  return { start: valid.map((term) => term.start).sort()[0]!, end: valid.map((term) => term.end).sort().at(-1)! };
}

export function recordedAttendance(
  months: StudentAttendanceMonth[],
  students: { id: string; admissionDate?: string }[],
  range?: AttendanceRange,
) {
  const admissionDates = new Map(students.map((student) => [student.id, student.admissionDate]));
  const totals = new Map<string, { days: number; attended: number }>();
  const counted = new Set<string>();
  for (const month of months) {
    if (!admissionDates.has(month.studentId)) continue;
    const admissionDate = admissionDates.get(month.studentId);
    for (const [date, status] of Object.entries(month.days ?? {})) {
      if (!validDate(date) || (range && (date < range.start || date > range.end))) continue;
      if (admissionDate && date < admissionDate) continue;
      if (status !== "P" && status !== "L" && status !== "A" && status !== "E") continue;
      const key = `${month.studentId}:${date}`;
      if (counted.has(key)) continue;
      counted.add(key);
      const total = totals.get(month.studentId) ?? { days: 0, attended: 0 };
      total.days++;
      if (status === "P" || status === "L") total.attended++;
      totals.set(month.studentId, total);
    }
  }
  return new Map([...totals].map(([id, total]) => [id, {
    ...total,
    pct: Math.round(total.attended * 1000 / total.days) / 10,
  }]));
}
