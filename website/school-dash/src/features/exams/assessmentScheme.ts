// Stage A of the exam workflow (docs/EXAMS_WORKFLOW_PROPOSAL.md): yearly academic setup that every exam is
// created from. `set_exam_types` says what kinds of exam the school runs and how they weigh into a term;
// `set_subject_schemes` says, per class group, which subjects are assessed and with which components.
// Both live under Settings → Assessment Scheme and are admin-only like every `set_*` collection.
import { classStream, compareGrades, streamName, type AcademicClass } from "@/lib/academicStreams";
import { classKey, newAssessment, type Assessment } from "./examSetup";
import { subjectTeacherId } from "./logic";

/** "Grade 9" / "Grade 11 · Science": the class group a scheme applies to */
export const groupTitle = (grade: string, streamId: string) => "Grade " + grade + (streamId ? " · " + streamName(streamId) : "");
/** Distinct class groups of the school's configured classes, lowest grade first. */
export function classGroups(classes: AcademicClass[]) {
  const groups = new Map<string, { key: string; grade: string; streamId: string; title: string; classIds: string[] }>();
  for (const row of classes) {
    const key = classKey(row);
    const group = groups.get(key) ?? { key, grade: row.grade, streamId: classStream(row), title: groupTitle(row.grade, classStream(row)), classIds: [] };
    group.classIds.push(row.id);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => compareGrades(a.grade, b.grade) || a.streamId.localeCompare(b.streamId));
}

/** `set_exam_types/{id}` */
export type ExamType = {
  id: string;
  name: string;
  short: string;
  /** `set_terms` id the exam counts towards ("" = not tied to a term) */
  termId: string;
  /** share of the term result, in percent */
  weight: number;
  /** "scheme": subject components as in the class scheme; "single": one paper out of `singleMax` marks */
  pattern: "scheme" | "single";
  singleMax: number;
  /** unit-test style: approved subject marks go to parents as soon as each sheet is approved */
  shareSubjectWise: boolean;
  countsInTerm: boolean;
  order: number;
  active: boolean;
};
export const ENTERED_BY = ["subjectTeacher", "classTeacher", "office"] as const;
export type EnteredBy = (typeof ENTERED_BY)[number];
export const enteredByLabel: Record<EnteredBy, string> = {
  subjectTeacher: "Subject teacher",
  classTeacher: "Class teacher",
  office: "Exam office",
};
/** One subject row of a scheme. Marks fields are the maximum for a full-pattern exam. */
export type SchemeSubject = {
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
  /** hours */
  duration: number;
  enteredBy: EnteredBy;
};
/** `set_subject_schemes/{schemeId(groupKey)}`; `groupKey` is examSetup's classKey, e.g. "9:" or "11:science" */
export type SubjectScheme = {
  id: string;
  groupKey: string;
  grade: string;
  streamId: string;
  /** grading scale; "default" is the school's `set_grading` bands */
  scaleId: string;
  subjects: SchemeSubject[];
  coScholastic: string[];
};

export const schemeId = (groupKey: string) => "scheme_" + groupKey.replace(/:$/, "").replace(":", "_");
export const examTypeId = (name: string) =>
  "ext_" + name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

export function newExamType(order: number): ExamType {
  return {
    id: "",
    name: "",
    short: "",
    termId: "",
    weight: 0,
    pattern: "scheme",
    singleMax: 20,
    shareSubjectWise: false,
    countsInTerm: true,
    order,
    active: true,
  };
}
/** CBSE-style starter set offered when a school has no exam types yet. Term ids are filled by the caller. */
export const STARTER_EXAM_TYPES: Omit<ExamType, "id" | "termId">[] = [
  { name: "Periodic Test 1", short: "PT1", weight: 10, pattern: "single", singleMax: 20, shareSubjectWise: true, countsInTerm: true, order: 1, active: true },
  { name: "Notebook Submission", short: "NB", weight: 5, pattern: "single", singleMax: 5, shareSubjectWise: false, countsInTerm: true, order: 2, active: true },
  { name: "Subject Enrichment", short: "SE", weight: 5, pattern: "single", singleMax: 5, shareSubjectWise: false, countsInTerm: true, order: 3, active: true },
  { name: "Half-Yearly Examination", short: "HY", weight: 80, pattern: "scheme", singleMax: 80, shareSubjectWise: false, countsInTerm: true, order: 4, active: true },
  { name: "Periodic Test 2", short: "PT2", weight: 10, pattern: "single", singleMax: 20, shareSubjectWise: true, countsInTerm: true, order: 5, active: true },
  { name: "Annual Examination", short: "AN", weight: 80, pattern: "scheme", singleMax: 80, shareSubjectWise: false, countsInTerm: true, order: 6, active: true },
];
const whole = (value: number, max = 1000) => Number.isInteger(value) && value >= 0 && value <= max;
/** First problem with an exam type draft, or "". */
export function examTypeError(type: ExamType, all: ExamType[]): string {
  const name = type.name.trim();
  if (!name) return "Exam type name is required";
  if (name.length > 60) return "Use 60 characters or fewer for the name";
  if (!type.short.trim() || type.short.trim().length > 8) return "Enter a short code of up to 8 characters";
  const others = all.filter((row) => row.id !== type.id);
  if (others.some((row) => row.name.trim().toLowerCase() === name.toLowerCase())) return "Another exam type already has this name";
  if (!whole(type.weight, 100)) return "Weight must be a whole percentage from 0 to 100";
  if (type.pattern === "single" && (!whole(type.singleMax) || type.singleMax <= 0)) return "Single-paper exams need maximum marks above 0";
  return "";
}
/** Sum of active weights per term, so the Settings page can warn when a term does not add up to 100. */
export function termWeightTotals(types: ExamType[]) {
  const totals: Record<string, number> = {};
  for (const type of types) if (type.active && type.countsInTerm && type.termId) totals[type.termId] = (totals[type.termId] ?? 0) + type.weight;
  return totals;
}

export function newSchemeSubject(subject: string): SchemeSubject {
  return {
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
    duration: 3,
    enteredBy: "subjectTeacher",
  };
}
export function newScheme(groupKey: string): SubjectScheme {
  const [grade, streamId = ""] = groupKey.split(":");
  return { id: schemeId(groupKey), groupKey, grade, streamId, scaleId: "default", subjects: [], coScholastic: [] };
}
/** First problem with a scheme draft, or "". */
export function schemeError(scheme: SubjectScheme): string {
  const seen = new Set<string>();
  for (const row of scheme.subjects) {
    const label = row.subject.trim() || "Subject";
    if (!row.subject.trim()) return "Every row needs a subject";
    const key = row.subject.trim().toLowerCase();
    if (seen.has(key)) return label + " is listed twice";
    seen.add(key);
    if (row.mode === "marks") {
      const total = row.theory + row.practical + row.internal;
      if (![row.theory, row.practical, row.internal, row.passMarks, row.theoryPass, row.practicalPass, row.internalPass].every((value) => whole(value)))
        return label + ": marks must be whole numbers";
      if (total <= 0) return label + ": maximum marks must be above 0";
      if (row.passMarks > total) return label + ": pass marks cannot exceed the maximum";
      if (row.theoryPass > row.theory || row.practicalPass > row.practical || row.internalPass > row.internal)
        return label + ": component pass marks must fit their maximums";
    } else if (row.gradeOptions.filter((grade) => grade.trim()).length < 2 || new Set(row.gradeOptions.map((grade) => grade.trim())).size !== row.gradeOptions.length) {
      return label + ": add at least two distinct grades or descriptors";
    }
    if (!(row.weight > 0)) return label + ": weight must be positive";
    if (!(row.duration > 0 && row.duration <= 6)) return label + ": duration must be between 1 minute and 6 hours";
  }
  return "";
}

/**
 * Wizard pre-fill: the assessments one class group gets when an exam is created from its scheme.
 * A "single" exam type (unit test out of N) replaces the components with one theory paper of N marks.
 */
export function assessmentsFromScheme(
  scheme: SubjectScheme,
  examType: Pick<ExamType, "pattern" | "singleMax"> | undefined,
  group: { key: string; grade: string; classIds: string[] },
  assignments: { classId: string; subject: string; teacherId: string }[],
  nextKey: () => string = () => crypto.randomUUID(),
): Assessment[] {
  return scheme.subjects.map((row) => {
    const base = newAssessment(nextKey(), group.grade, group.classIds, row.subject);
    const single = examType?.pattern === "single" && row.mode === "marks";
    const marks = single
      ? {
          theory: examType!.singleMax,
          practical: 0,
          internal: 0,
          passMarks: Math.ceil(examType!.singleMax * 0.33),
          theoryPass: 0,
          practicalPass: 0,
          internalPass: 0,
        }
      : {
          theory: row.theory,
          practical: row.practical,
          internal: row.internal,
          passMarks: row.passMarks,
          theoryPass: row.theoryPass,
          practicalPass: row.practicalPass,
          internalPass: row.internalPass,
        };
    return {
      ...base,
      groupKey: group.key,
      code: row.code,
      mode: row.mode,
      ...marks,
      weight: row.weight,
      gradeOptions: row.gradeOptions,
      duration: single ? Math.min(row.duration, 1) : row.duration,
      evaluatorIds: Object.fromEntries(group.classIds.map((id) => [id, subjectTeacherId(assignments, row.subject, id)])),
    };
  });
}
