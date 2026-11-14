import { classStream, classIdOf, sectionLabel, type AcademicClass } from "@/lib/academicStreams";
import { candidatesFor, isActiveStudent, paperEnd, timesOverlap, type StudentRow } from "./logic";
import type { Cycle, Paper } from "./types";

export const SETUP_STEPS = [
  "Basic Information",
  "Classes & Divisions",
  "Subjects & Assessment",
  "Timetable",
  "Grading & Result Rules",
  "Review & Publish",
];
export const EXAM_TYPES = [
  "Unit Test",
  "Term Exam",
  "Annual Exam",
  "Practical",
  "Continuous Assessment",
  "Other",
];
export type ExamRules = {
  calculation: "total" | "average" | "weighted";
  rounding: "none" | "whole" | "one-decimal" | "two-decimal";
  rankScope: "none" | "division" | "class-course";
  requireApproval: boolean;
  passCriteria: "aggregate" | "components";
  absentRule: "incomplete" | "zero";
  exemptRule: "exclude";
};
export type Assessment = {
  key: string;
  id?: string;
  groupKey: string;
  classIds: string[];
  grade: string;
  subject: string;
  code: string;
  mode: "marks" | "grade";
  theory: number;
  practical: number;
  internal: number;
  passMarks: number;
  theoryPass: number;
  practicalPass: number;
  internalPass: number;
  weight: number;
  gradeOptions: string[];
  duration: number;
  date: string;
  start: string;
  venue: string;
  invigilatorId: string;
  instructions: string;
  evaluatorIds: Record<string, string>;
};
export type ExamSetup = {
  timeZone: string;
  title: string;
  examType: string;
  /** `set_exam_types` id and its term ("" when the school has not configured exam types) */
  examTypeId: string;
  termId: string;
  academicYear: string;
  description: string;
  start: string;
  end: string;
  instructions: string;
  classIds: string[];
  excludedStudentIds: string[];
  assessments: Assessment[];
  scale: string;
  rules: ExamRules;
  publishAt: string;
};
export const defaultRules: ExamRules = {
  calculation: "total",
  rounding: "one-decimal",
  rankScope: "none",
  requireApproval: true,
  passCriteria: "aggregate",
  absentRule: "incomplete",
  exemptRule: "exclude",
};
export const classKey = (row: AcademicClass) => row.grade + ":" + classStream(row);
export const className = (row: AcademicClass) => sectionLabel(row.grade, row.section, classStream(row));
export const studentClass = (row: StudentRow) =>
  row.classId || classIdOf(row.grade ?? "", row.section ?? "", row.streamId);
export const participants = (
  setup: Pick<ExamSetup, "classIds" | "excludedStudentIds">,
  students: StudentRow[],
) =>
  students.filter(
    (student) =>
      isActiveStudent(student) &&
      setup.classIds.includes(studentClass(student)) &&
      !setup.excludedStudentIds.includes(student.id),
  );

export function initialSetup(
  cycle: Cycle | undefined,
  papers: Paper[],
  classes: AcademicClass[],
  academicYear: string,
): ExamSetup {
  const scoped =
    cycle?.classIds ?? classes.filter((row) => cycle?.grades.includes(row.grade)).map((row) => row.id);
  return {
    timeZone: cycle?.publicationTimezone ?? "Asia/Kolkata",
    title: cycle?.title ?? "",
    examType: cycle?.examType ?? "Term Exam",
    examTypeId: cycle?.examTypeId ?? "",
    termId: cycle?.termId ?? "",
    academicYear: cycle?.academicYear || academicYear,
    description: cycle?.description ?? "",
    start: cycle?.start ?? "",
    end: cycle?.end ?? "",
    instructions: cycle?.instructions ?? "",
    classIds: scoped,
    excludedStudentIds: cycle?.excludedStudentIds ?? [],
    scale: cycle?.scale ?? "Percentage only",
    rules: { ...defaultRules, ...(cycle ? { requireApproval: false } : {}), ...cycle?.resultRules },
    publishAt: cycle?.publishAtLocal ?? "",
    assessments: papers.map((paper) => ({
      key: paper.id,
      id: paper.id,
      groupKey: classes.find((row) => paper.classIds?.includes(row.id))
        ? classKey(classes.find((row) => paper.classIds?.includes(row.id))!)
        : paper.grade + ":",
      grade: paper.grade,
      classIds: paper.classIds?.length
        ? paper.classIds
        : scoped.filter((id) => classes.find((row) => row.id === id)?.grade === paper.grade),
      subject: paper.subject,
      code: paper.code,
      mode: paper.assessmentMode ?? "marks",
      theory: paper.theory,
      practical: paper.practical ?? 0,
      internal: paper.internal,
      passMarks: paper.passMarks ?? Math.ceil((paper.theory + paper.internal) * 0.33),
      theoryPass: paper.theoryPass ?? 0,
      practicalPass: paper.practicalPass ?? 0,
      internalPass: paper.internalPass ?? 0,
      weight: paper.weight ?? 1,
      gradeOptions: paper.gradeOptions ?? ["A", "B", "C", "D"],
      duration: paper.duration,
      date: paper.date,
      start: paper.start,
      venue: paper.venue,
      invigilatorId: paper.invigilatorId ?? "",
      instructions: paper.instructions ?? "",
      evaluatorIds: paper.evaluatorIds ?? {},
    })),
  };
}
export function newAssessment(key: string, grade: string, classIds: string[], subject: string): Assessment {
  return {
    key,
    groupKey: grade + ":",
    grade,
    classIds,
    subject,
    code: "",
    mode: "marks",
    theory: 80,
    practical: 0,
    internal: 20,
    passMarks: 33,
    theoryPass: 0,
    practicalPass: 0,
    internalPass: 0,
    weight: 1,
    gradeOptions: ["A", "B", "C", "D"],
    duration: 2,
    date: "",
    start: "09:00",
    venue: "",
    invigilatorId: "",
    instructions: "",
    evaluatorIds: {},
  };
}
const validDate = (date: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  Number.isFinite(Date.parse(date)) &&
  new Date(date).toISOString().slice(0, 10) === date;
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
export function setupErrors(
  setup: ExamSetup,
  classes: AcademicClass[],
  otherPapers: Paper[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!setup.title.trim()) errors.title = "Examination name is required";
  if (!setup.academicYear.trim()) errors.academicYear = "Academic year is required";
  if (!setup.examType.trim()) errors.examType = "Exam type is required";
  if (!validDate(setup.start)) errors.start = "Choose a valid start date";
  if (!validDate(setup.end)) errors.end = "Choose a valid end date";
  else if (setup.start > setup.end) errors.end = "End date must be on or after start date";
  if (!setup.classIds.length) errors.classIds = "Select at least one class and division";
  if (setup.classIds.some((id) => !classes.some((row) => row.id === id)))
    errors.classIds = "A selected class is no longer configured";
  const papers = setup.assessments;
  if (!papers.length) errors.assessments = "Add at least one subject";
  for (const id of setup.classIds)
    if (!papers.some((paper) => paper.classIds.includes(id)))
      errors.assessments = "Every selected division needs at least one subject";
  const seen = new Set<string>();
  for (const paper of papers) {
    const label = paper.subject || "Subject";
    if (
      !paper.subject.trim() ||
      !paper.classIds.length ||
      paper.classIds.some((id) => !setup.classIds.includes(id))
    )
      errors[paper.key] = label + ": select participating divisions";
    for (const id of paper.classIds) {
      const key = id + ":" + paper.subject.trim().toLowerCase();
      if (seen.has(key)) errors[paper.key] = label + ": this subject is already configured for the division";
      seen.add(key);
    }
    const total = paper.theory + paper.internal + paper.practical;
    if (
      paper.mode === "marks" &&
      (![paper.theory, paper.internal, paper.practical, paper.passMarks].every(nonnegative) ||
        total <= 0 ||
        paper.passMarks > total)
    ) {
      errors[paper.key] = label + ": check maximum and pass marks";
    }
    if (
      paper.mode === "marks" &&
      setup.rules.passCriteria === "components" &&
      (paper.theoryPass > paper.theory ||
        paper.internalPass > paper.internal ||
        paper.practicalPass > paper.practical ||
        ![paper.theoryPass, paper.internalPass, paper.practicalPass].every(nonnegative))
    )
      errors[paper.key] = label + ": component pass marks must fit their maximums";
    if (
      paper.mode === "grade" &&
      (paper.gradeOptions.length < 2 ||
        paper.gradeOptions.some((grade) => !grade.trim()) ||
        new Set(paper.gradeOptions).size !== paper.gradeOptions.length)
    )
      errors[paper.key] = label + ": add at least two distinct grades or descriptors";
    if (!nonnegative(paper.weight) || paper.weight <= 0)
      errors[paper.key] = label + ": weight must be positive";
    if (!validDate(paper.date) || paper.date < setup.start || paper.date > setup.end)
      errors[paper.key] = label + ": choose a date within the exam dates";
    if (
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(paper.start) ||
      !Number.isFinite(paper.duration) ||
      paper.duration <= 0 ||
      paper.duration > 6 ||
      Number(paper.start.slice(0, 2)) * 60 + Number(paper.start.slice(3)) + paper.duration * 60 > 1440
    )
      errors[paper.key] = label + ": check start time and duration";
  }
  const scheduled = [...papers.map((paper) => ({ ...paper, id: paper.key })), ...otherPapers];
  for (const paper of papers) {
    const clash = scheduled.find(
      (other) =>
        other.id !== paper.key &&
        other.date === paper.date &&
        paper.date &&
        timesOverlap(paper.start, paperEnd(paper), other.start, paperEnd(other)) &&
        (other.classIds?.some((id) => paper.classIds.includes(id)) ||
          (!other.classIds?.length && other.grade === paper.grade) ||
          (paper.venue.trim() && other.venue.trim().toLowerCase() === paper.venue.trim().toLowerCase()) ||
          (paper.invigilatorId && other.invigilatorId === paper.invigilatorId)),
    );
    if (clash) errors[paper.key] = paper.subject + ": timetable conflict with " + clash.subject;
  }
  return errors;
}
export function setupCandidates(setup: ExamSetup, students: StudentRow[]) {
  return candidatesFor(participants(setup, students));
}
