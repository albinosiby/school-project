import { describe, expect, it } from "vitest";
import type { Cycle, Mark, Paper } from "@/features/exams/types";
import { attendanceHistory, classDay, classExams, classResults, classRoster, classTeachers, defaultClassExam, genderCounts, periodRecords, studentPeriodMark,
  type ClassAttendanceRecord, type ClassStudent } from "./classDetails";

const cls = { id: "cls_10B", grade: "10", section: "B" };
const students: ClassStudent[] = [
  { id: "boy", name: "Aarav", grade: "10", section: "B", gender: "Male", admissionDate: "2026-06-01" },
  { id: "girl", name: "Ananya", grade: "10", section: "B", gender: "Female", admissionDate: "2026-06-01" },
];
const record: ClassAttendanceRecord = { id: "r", classId: cls.id, date: "2026-11-11", period: 2, total: 2, marks: { girl: "A" }, submitted: true };
const cycle = { id: "exam", title: "Term 1", start: "2026-10-01", end: "2026-10-10", declaration: "2026-10-20", status: "Completed", passRule: "Min 33% aggregate" } as Cycle;
const paper = { id: "math", cycleId: cycle.id, grade: "10", subject: "Mathematics", theory: 80, internal: 20, classIds: [cls.id], published: ["10-B"] } as Paper;
const mark = (studentId: string, theory: number | null, internal: number | null, more: Partial<Mark> = {}): Mark =>
  ({ id: `${studentId}_math`, paperId: paper.id, candId: `cand_${studentId}`, studentId, classId: cls.id, theory, internal, medical: false, verified: true, ...more });

describe("Class roster and teachers", () => {
  it("counts active students of the exact class, including legacy class ids, without guessing a gender", () => {
    const roster = classRoster([...students,
      { ...students[0], id: "deleted", deleted: true }, { ...students[0], id: "transferred", status: "Transferred" },
      { ...students[0], id: "other", classId: "cls_10A" }, { ...students[0], id: "unknown", gender: "" },
    ], cls.id);
    expect(genderCounts(roster)).toEqual({ total: 3, boys: 1, girls: 1, other: 1 });
  });
  it("groups subjects by stable teacher id across assignments and the timetable", () => {
    const staff = [{ id: "teacher", name: "Teacher One", phone: "9000000000" }];
    const result = classTeachers({ ...cls, classTeacherId: "teacher" }, [
      { id: "a", classId: cls.id, subject: "Mathematics", teacherId: "teacher" },
      { id: "other", classId: "cls_10A", subject: "Secret subject", teacherId: "teacher" },
    ], [{ id: "p", classId: cls.id, grade: "10", section: "B", day: "Wed", period: 2, subject: "Science", teacher: "Old name", teacherId: "teacher", room: "1" }], staff);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "teacher", name: "Teacher One", subjects: ["Mathematics", "Science"] });
    expect(result[0].staff?.phone).toBe("9000000000");
  });
  it("includes the class teacher before any subject is assigned and preserves a missing staff reference", () => {
    expect(classTeachers({ ...cls, classTeacherId: "teacher", classTeacher: "Outdated name" }, [], [], [{ id: "teacher", name: "Current name" }]))
      .toMatchObject([{ id: "teacher", name: "Current name", subjects: [] }]);
    expect(classTeachers({ ...cls, classTeacherId: "former", classTeacher: "Former Teacher" }, [], [], []))
      .toEqual([{ id: "former", name: "Former Teacher", staff: undefined, subjects: [] }]);
    expect(classTeachers(cls, [], [], [{ id: "other", name: "Other class teacher" }])).toEqual([]);
  });
});

describe("Hourly attendance history", () => {
  it("keeps saved lesson and attendance timings on an alternate Saturday off without scheduling an empty day", () => {
    const bell = { id: "bell", start: "09:00", end: "13:00", periodCount: 4, periodLength: 40, breaks: [{ name: "Morning break", start: "10:20", duration: 20 }] };
    const regional = { id: "regional", workingWeek: "Mon – Sat (2nd & 4th Saturday Off)" };
    const lesson = { id: "sat", classId: cls.id, grade: "10", section: "B", day: "Sat", period: 2, subject: "Mathematics", teacher: "Teacher", room: "204" };
    const attendance = { ...record, date: "2026-11-14", period: 3 };
    const day = classDay(cls.id, "2026-11-14", bell, regional, [lesson], [], [], [attendance]);
    expect(day.nonWorkingDay).toBe(true);
    expect(day.scheduleAvailable).toBe(true);
    expect(day.rows).toHaveLength(4);
    expect(day.rows[1]).toMatchObject({ period: 2, from: "09:40", to: "10:20" });
    expect(day.rows[2]).toMatchObject({ period: 3, from: "10:40", to: "11:20" });
    expect(day.breaks).toMatchObject([{ label: "Morning break", from: "10:20", to: "10:40" }]);
    expect(classDay(cls.id, "2026-11-14", bell, regional, [], [], [], []).rows).toEqual([]);
    expect(classDay(cls.id, "2026-11-14", bell, regional, [], [], [], []).breaks).toEqual([]);
  });
  it("keeps the newest submitted revision for each hour and excludes daily, draft and deleted rolls", () => {
    const records = periodRecords([record, { ...record, id: "new", updatedAt: "2026-11-11T10:00:00Z", marks: {} },
      { ...record, id: "day", period: 0 }, { ...record, id: "draft", submitted: false, updatedAt: "2027-01-01" },
      { ...record, id: "deleted", deleted: true }, { ...record, id: "other", classId: "cls_10A" }], cls.id);
    expect(records.map((row) => row.id)).toEqual(["new"]);
    expect(attendanceHistory(records, cls.id, "2026-11")).toEqual([{ id: record.date, periods: 1, present: 2, total: 2, invalid: 0 }]);
  });
  it("uses sparse present marks only with a known roster or a consistent current-day roll", () => {
    expect(studentPeriodMark(students[0], record, record.date, students)).toBe("P");
    expect(studentPeriodMark(students[1], record, record.date, students)).toBe("A");
    expect(studentPeriodMark(students[0], record, "2026-11-12", students)).toBe("Unavailable");
    expect(studentPeriodMark(students[1], record, "2026-11-12", students)).toBe("A");
    expect(studentPeriodMark(students[0], { ...record, studentIds: ["boy", "girl"] }, "2026-11-12", students)).toBe("P");
    expect(studentPeriodMark(students[0], { ...record, studentIds: ["girl"] }, "2026-11-12", students)).toBe("Not enrolled");
    expect(studentPeriodMark(students[0], { ...record, total: 3 }, record.date, students)).toBe("Unavailable");
    expect(studentPeriodMark(students[0], undefined, record.date, students)).toBe("Not marked");
  });
  it("does not infer pre-admission attendance and flags malformed saved records", () => {
    expect(studentPeriodMark({ ...students[0], admissionDate: "2026-11-12" }, record, record.date, students)).toBe("Not enrolled");
    expect(studentPeriodMark(students[0], { ...record, marks: { girl: "unknown" } }, record.date, students)).toBe("Unavailable");
    expect(attendanceHistory([{ ...record, total: -1 }], cls.id, "2026-11")[0].invalid).toBe(1);
    expect(attendanceHistory([record], cls.id, "2026-10")).toHaveLength(0);
  });
  it("combines submitted hours using period totals and counts late students as attended", () => {
    expect(attendanceHistory([record, { ...record, id: "p3", period: 3, marks: { girl: "L" } }], cls.id, "2026-11")[0])
      .toMatchObject({ periods: 2, present: 3, total: 4 });
  });
  it("builds saved school bells and applies cover for the chosen day only", () => {
    const bell = { id: "bell", start: "09:00", end: "13:00", periodCount: 4, periodLength: 40, breaks: [{ name: "Break", start: "10:20", duration: 20 }] };
    const periods = [{ id: "p", classId: cls.id, grade: "10", section: "B", day: "Wed", period: 2, subject: "Mathematics", teacher: "Teacher", teacherId: "t1", room: "1" }];
    const day = classDay(cls.id, record.date, bell, undefined, periods, [{ id: "cover", date: record.date, day: "Wed", period: 2, classId: cls.id, subject: "Mathematics", absentTeacherId: "t1", substituteTeacherId: "t2", status: "Accepted" }], [{ id: "t2", name: "Substitute" }], [record]);
    expect(day.rows).toHaveLength(4);
    expect(day.rows[1]).toMatchObject({ from: "09:40", to: "10:20", lesson: { teacher: "Substitute", teacherId: "t2", substitute: true }, count: { present: 1, total: 2 } });
    expect(day.breaks[0].label).toBe("Break");
    expect(classDay(cls.id, "2026-11-15", bell, undefined, periods, [], [], []).rows).toHaveLength(0);
    expect(classDay(cls.id, "", bell, undefined, periods, [], [], [record]).rows).toHaveLength(0);
    expect(classDay(cls.id, "2026-02-31", bell, undefined, periods, [], [], [record]).rows).toHaveLength(0);
  });
});

describe("Class pass percentage", () => {
  it("counts students with complete published results, with no result invented for missing marks", () => {
    const result = classResults(cls, [...students, { ...students[0], id: "pending" }], cycle, [paper], [mark("boy", 60, 20), mark("girl", 10, 5)]);
    expect(result).toMatchObject({ passed: 1, failed: 1, assessed: 2, pending: 1, percentage: 50 });
    expect(result.rows[2].state).toBe("Pending");
    expect(classResults(cls, students, undefined, [], []).percentage).toBeNull();
    expect(classResults(cls, students, cycle, [paper], []).percentage).toBeNull();
  });
  it("respects independent component passes and distinguishes a true 0% pass rate", () => {
    const marks = students.map((student) => mark(student.id, 20, 20));
    expect(classResults(cls, students, cycle, [paper], marks).percentage).toBe(100);
    expect(classResults(cls, students, { ...cycle, passRule: "Min 33% independently in Theory & Practical" }, [paper], marks))
      .toMatchObject({ passed: 0, failed: 2, percentage: 0 });
  });
  it("requires every subject to be published and passed, and supports zero-mark components", () => {
    const english = { ...paper, id: "english", theory: 100, internal: 0, subject: "English" };
    const marks = [mark("boy", 70, 20), mark("boy", 20, null, { id: "boy_english", paperId: "english" })];
    expect(classResults(cls, [students[0]], cycle, [paper, english], marks).rows[0].state).toBe("Failed");
    expect(classResults(cls, [students[0]], cycle, [paper, { ...english, published: [] }], marks).rows[0].state).toBe("Pending");
  });
  it("counts absence as failed, medical re-exams as pending and rejects conflicting or invalid marks", () => {
    expect(classResults(cls, students, cycle, [paper], [mark("boy", null, null, { status: "Absent" }), mark("girl", null, null, { medical: true })]))
      .toMatchObject({ passed: 0, failed: 1, assessed: 1, pending: 1, percentage: 0 });
    expect(classResults(cls, [students[0]], cycle, [paper], [mark("boy", 90, 20)]).rows[0].state).toBe("Unavailable");
    expect(classResults(cls, [students[0]], cycle, [paper], [mark("boy", 60, 20), mark("boy", 70, 20, { id: "duplicate" })]).rows[0].state).toBe("Unavailable");
    expect(classResults(cls, students, { ...cycle, passRule: "Custom rule" }, [paper], []).percentage).toBeNull();
  });
  it("defaults to the latest fully published exam and keeps senior streams separate", () => {
    const newer = { ...cycle, id: "newer", declaration: "2026-11-20" };
    const papers = [paper, { ...paper, id: "new_math", cycleId: newer.id }, { ...paper, id: "new_english", cycleId: newer.id, published: [] }];
    expect(classExams(cls, [cycle, newer], papers).map((row) => row.id)).toEqual(["newer", "exam"]);
    expect(defaultClassExam(cls, [cycle, newer], papers)?.id).toBe(cycle.id);
    const science = { id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" };
    expect(classExams(science, [cycle], [{ ...paper, grade: "11", classIds: ["cls_11_commerce_A"], published: ["11-Commerce-A"] }])).toHaveLength(0);
  });
});
