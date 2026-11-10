/** Daily marks from the student-specific attendance records used by the parent app. */
export type StudentAttendanceMonth = {
  id: string;
  studentId: string;
  days?: Record<string, "P" | "A" | "L" | "E">;
};

export function recordedAttendance(
  months: StudentAttendanceMonth[],
  students: { id: string; admissionDate?: string }[],
) {
  const admissionDates = new Map(students.map((student) => [student.id, student.admissionDate]));
  const totals = new Map<string, { days: number; attended: number }>();
  for (const month of months) {
    if (!admissionDates.has(month.studentId)) continue;
    const admissionDate = admissionDates.get(month.studentId);
    for (const [date, status] of Object.entries(month.days ?? {})) {
      if (admissionDate && date < admissionDate) continue;
      if (status !== "P" && status !== "L" && status !== "A" && status !== "E") continue;
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
