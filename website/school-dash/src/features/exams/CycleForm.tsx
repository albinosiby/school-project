"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Plus, Trash2, X } from "lucide-react";
import {
  Button,
  Card,
  Checkbox,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { classStream, compareGrades, isSeniorGrade, streamName, type AcademicClass } from "@/lib/academicStreams";
import { useSchoolSubjects } from "@/lib/schoolSubjects";
import { useCollection } from "@/lib/useCollection";
import { teachingStaff, type StaffRef } from "@/features/ops/shared";
import {
  classKey,
  className,
  EXAM_TYPES,
  initialSetup,
  newAssessment,
  participants,
  SETUP_STEPS,
  setupErrors,
  studentClass,
  type Assessment,
  type ExamRules,
  type ExamSetup,
} from "./examSetup";
import { assessmentsFromScheme, schemeId, type ExamType, type SubjectScheme } from "./assessmentScheme";
import { isActiveStudent, paperEnd, subjectTeacherId, type StudentRow } from "./logic";
import { saveExamSetup } from "./saveExamSetup";
import type { Candidate, Cycle, Paper } from "./types";

type Assignment = {
  id: string;
  classId: string;
  subject: string;
  teacherId: string;
};
type Term = { id: string; name: string };
const gradeNumber = (grade: string) => Number(grade);
/** quick selections by school stage; non-numeric grades (LKG, UKG) count as primary */
const PRESETS: { label: string; test: (grade: string) => boolean }[] = [
  { label: "All classes", test: () => true },
  {
    label: "Primary 1–5",
    test: (grade) => Number.isNaN(gradeNumber(grade)) || gradeNumber(grade) <= 5,
  },
  {
    label: "Middle 6–8",
    test: (grade) => gradeNumber(grade) >= 6 && gradeNumber(grade) <= 8,
  },
  {
    label: "Secondary 9–10",
    test: (grade) => gradeNumber(grade) >= 9 && gradeNumber(grade) <= 10,
  },
  {
    label: "Senior 11–12",
    test: (grade) => gradeNumber(grade) >= 11 && gradeNumber(grade) <= 12,
  },
];
const classGroupTitle = (row: AcademicClass) =>
  "Grade " + row.grade + (classStream(row) ? " · " + (row.stream || streamName(classStream(row))) : "");

export function CycleForm({ cycleId }: { cycleId?: string }) {
  const cycles = useCollection<Cycle>("exm_cycles");
  const papers = useCollection<Paper>("exm_papers");
  const classes = useCollection<AcademicClass>("classes");
  const students = useCollection<StudentRow>("students");
  const candidates = useCollection<Candidate>("exm_candidates");
  const staff = useCollection<StaffRef>("staff");
  const assignments = useCollection<Assignment>("assignments");
  const school = useCollection<{ id: string; academicYear?: string }>("school");
  const catalog = useSchoolSubjects();
  const regional = useCollection<{ id: string; timezone?: string }>("set_config");
  const examTypes = useCollection<ExamType>("set_exam_types");
  const schemes = useCollection<SubjectScheme>("set_subject_schemes");
  const terms = useCollection<Term>("set_terms");
  if (
    !catalog.ready ||
    ![
      cycles,
      papers,
      classes,
      students,
      candidates,
      staff,
      assignments,
      school,
      regional,
      examTypes,
      schemes,
      terms,
    ].every((collection) => collection.ready)
  )
    return <p role="status">Loading examination setup…</p>;
  const cycle = cycles.rows.find(({ id }) => id === cycleId);
  if (cycleId && !cycle)
    return (
      <p>
        Exam not found. <Link href="/exams">Back to exams</Link>
      </p>
    );
  return (
    <ExamSetupForm
      key={cycleId ?? "new"}
      cycle={cycle}
      papers={papers.rows}
      classes={classes.rows}
      students={students.rows}
      candidates={candidates.rows}
      staff={teachingStaff(staff.rows)}
      assignments={assignments.rows}
      subjectCatalog={catalog.subjects.filter((subject) => subject.active).map((subject) => subject.name)}
      academicYear={school.rows[0]?.academicYear ?? ""}
      timeZone={regional.rows.find((row) => row.id === "regional")?.timezone ?? "Asia/Kolkata"}
      examTypes={examTypes.rows
        .filter((type) => type.active || type.id === cycle?.examTypeId)
        .sort((a, b) => a.order - b.order)}
      schemes={schemes.rows}
      terms={terms.rows}
    />
  );
}

function ExamSetupForm({
  cycle,
  papers,
  classes,
  students,
  candidates,
  staff,
  assignments,
  academicYear,
  subjectCatalog,
  timeZone,
  examTypes,
  schemes,
  terms,
}: {
  cycle?: Cycle;
  papers: Paper[];
  classes: AcademicClass[];
  students: StudentRow[];
  candidates: Candidate[];
  staff: StaffRef[];
  assignments: Assignment[];
  academicYear: string;
  subjectCatalog: string[];
  timeZone: string;
  examTypes: ExamType[];
  schemes: SubjectScheme[];
  terms: Term[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [setup, setSetup] = useState(() => ({
    ...initialSetup(
      cycle,
      papers.filter((paper) => paper.cycleId === cycle?.id),
      classes,
      academicYear,
    ),
    timeZone: cycle?.publicationTimezone ?? timeZone,
  }));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const id = useRef<string | undefined>(cycle?.id);
  const locked = !!cycle && cycle.status !== "Draft";
  const set = <K extends keyof ExamSetup>(key: K, value: ExamSetup[K]) =>
    setSetup((old) => ({ ...old, [key]: value }));
  const rule = <K extends keyof ExamRules>(key: K, value: ExamRules[K]) =>
    setSetup((old) => ({ ...old, rules: { ...old.rules, [key]: value } }));
  const update = (key: string, patch: Partial<Assessment>) =>
    set(
      "assessments",
      setup.assessments.map((paper) => (paper.key === key ? { ...paper, ...patch } : paper)),
    );
  const groups = [...new Set(classes.map(classKey))]
    .map((key) => ({
      key,
      rows: classes.filter((row) => classKey(row) === key).sort((a, b) => a.section.localeCompare(b.section)),
    }))
    .sort((a, b) => compareGrades(a.rows[0].grade, b.rows[0].grade) || a.key.localeCompare(b.key));
  const selected = classes.filter(({ id }) => setup.classIds.includes(id));
  const count = participants(setup, students).length;
  const selectedStudents = students.filter(
    (student) => isActiveStudent(student) && setup.classIds.includes(studentClass(student)),
  );
  const otherPapers = papers.filter((paper) => paper.cycleId !== cycle?.id && paper.setupPlanned !== false);
  const excluded = selectedStudents.filter((student) => setup.excludedStudentIds.includes(student.id));
  const suggestions = selectedStudents
    .filter(
      (student) =>
        !setup.excludedStudentIds.includes(student.id) &&
        (student.name + " " + student.grn).toLowerCase().includes(studentSearch.trim().toLowerCase()),
    )
    .slice(0, 8);

  const schemeOf = (key: string) => schemes.find((scheme) => scheme.id === schemeId(key));
  const groupOf = (classId: string) => {
    const row = classes.find((row) => row.id === classId);
    return row ? classKey(row) : "";
  };
  /** The subjects a class group gets from its scheme, scaled to the chosen exam type. */
  const schemeAssessments = (
    scheme: SubjectScheme,
    key: string,
    grade: string,
    classIds: string[],
    examTypeId: string,
  ) =>
    assessmentsFromScheme(
      scheme,
      examTypes.find((type) => type.id === examTypeId),
      { key, grade, classIds },
      assignments,
    );
  function selectClasses(ids: string[]) {
    setSetup((old) => {
      const added = ids.filter((id) => !old.classIds.includes(id));
      // divisions added to a group join the subjects already configured for that group
      const assessments = old.assessments.map((paper) => {
        const extra = added.filter((id) => groupOf(id) === paper.groupKey && !paper.classIds.includes(id));
        return {
          ...paper,
          classIds: [...paper.classIds.filter((id) => ids.includes(id)), ...extra],
          evaluatorIds: {
            ...paper.evaluatorIds,
            ...Object.fromEntries(extra.map((id) => [id, subjectTeacherId(assignments, paper.subject, id)])),
          },
        };
      });
      // a group selected for the first time is pre-filled from its subject scheme
      for (const { key, rows } of groups) {
        const groupIds = rows.filter((row) => ids.includes(row.id)).map((row) => row.id);
        const scheme = schemeOf(key);
        if (!groupIds.length || !scheme || assessments.some((paper) => paper.groupKey === key)) continue;
        assessments.push(...schemeAssessments(scheme, key, rows[0].grade, groupIds, old.examTypeId));
      }
      return { ...old, classIds: ids, assessments };
    });
  }
  function applyScheme(key: string, grade: string, classIds: string[]) {
    const scheme = schemeOf(key);
    if (!scheme) return;
    set("assessments", [
      ...setup.assessments.filter((paper) => paper.groupKey !== key),
      ...schemeAssessments(scheme, key, grade, classIds, setup.examTypeId),
    ]);
  }
  function chooseExamType(examTypeId: string) {
    const type = examTypes.find((row) => row.id === examTypeId);
    setSetup((old) => ({
      ...old,
      examTypeId: type?.id ?? "",
      examType: type?.name ?? old.examType,
      termId: type?.termId ?? "",
    }));
  }
  function toggleClass(id: string, checked: boolean) {
    selectClasses(checked ? [...setup.classIds, id] : setup.classIds.filter((value) => value !== id));
  }
  async function save(mode: "draft" | "publish" | "schedule") {
    if (saving || locked) return;
    const found =
      mode === "draft"
        ? !setup.title.trim()
          ? { title: "Examination name is required" }
          : {}
        : setupErrors(setup, classes, otherPapers);
    setErrors(found);
    if (Object.keys(found).length) {
      setStep(mode === "draft" ? 0 : 5);
      return;
    }
    setSaving(true);
    try {
      id.current ??= "cyc_" + crypto.randomUUID();
      await saveExamSetup(setup, mode, {
        id: id.current,
        cycle,
        papers,
        classes,
        students,
        candidates,
        staff,
        assignments,
      });
      toast(
        mode === "draft"
          ? "Exam draft saved"
          : mode === "schedule"
            ? "Exam publication scheduled"
            : "Exam and timetable published",
      );
      router.push("/exams");
    } catch (error) {
      setErrors({
        save: error instanceof Error ? error.message : "Could not save the exam",
      });
    } finally {
      setSaving(false);
    }
  }
  function number(
    paper: Assessment,
    key:
      | "theory"
      | "practical"
      | "internal"
      | "passMarks"
      | "theoryPass"
      | "practicalPass"
      | "internalPass"
      | "weight",
    label: string,
  ) {
    return (
      <Field key={key} label={label}>
        <Input
          type="number"
          min={0}
          value={paper[key]}
          onChange={(event) => update(paper.key, { [key]: Number(event.target.value) })}
        />
      </Field>
    );
  }
  const teacherSelect = (value: string, change: (id: string) => void) => (
    <Select value={value} onChange={(event) => change(event.target.value)}>
      <option value="">Not assigned</option>
      {value && !staff.some(({ id }) => id === value) && <option value={value}>Previous staff member</option>}
      {staff.map((teacher) => (
        <option key={teacher.id} value={teacher.id}>
          {teacher.name}
        </option>
      ))}
    </Select>
  );

  return (
    <div className="space-y-5 pb-8">
      <PageHeader
        title={cycle ? "Examination Setup" : "Create Examination"}
        subtitle="Configure participants, assessments, timetable and publication."
      />
      <nav aria-label="Examination setup steps" className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
        {SETUP_STEPS.map((title, index) => (
          <Button
            key={title}
            variant={step === index ? "primary" : "outline"}
            onClick={() => setStep(index)}
            aria-current={step === index ? "step" : undefined}
            className="h-auto min-h-12 whitespace-normal text-left"
          >
            {index + 1}. {title}
          </Button>
        ))}
      </nav>
      {locked && (
        <p role="status" className="rounded-lg bg-info-container p-3 text-sm">
          This exam is published. Its participant and assessment configuration is locked.
        </p>
      )}
      <Card className="p-5 sm:p-6">
        <h2 className="mb-5 text-lg font-semibold">{SETUP_STEPS[step]}</h2>
        <fieldset disabled={saving || locked} className="min-w-0 space-y-5">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Examination name" required error={errors.title}>
                <Input value={setup.title} onChange={(e) => set("title", e.target.value)} />
              </Field>
              <Field
                label="Exam type"
                required
                hint={
                  examTypes.length
                    ? "Sets the term, weightage and marks pattern (Settings → Assessment Scheme)"
                    : "Add exam types under Settings → Assessment Scheme to set term weightage"
                }
              >
                {examTypes.length ? (
                  <Select value={setup.examTypeId} onChange={(e) => chooseExamType(e.target.value)}>
                    {!setup.examTypeId && <option value="">{setup.examType || "Select exam type…"}</option>}
                    {examTypes.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name}
                        {type.termId && terms.some((term) => term.id === type.termId)
                          ? " · " + terms.find((term) => term.id === type.termId)!.name
                          : ""}
                        {type.pattern === "single" ? " · out of " + type.singleMax : ""}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Select value={setup.examType} onChange={(e) => set("examType", e.target.value)}>
                    {EXAM_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </Select>
                )}
              </Field>
              <Field label="Academic year" required error={errors.academicYear}>
                <Input
                  value={setup.academicYear}
                  onChange={(e) => set("academicYear", e.target.value)}
                  placeholder="2026–27"
                />
              </Field>
              <Field label="Description">
                <Textarea value={setup.description} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Exam start date" required error={errors.start}>
                <Input type="date" value={setup.start} onChange={(e) => set("start", e.target.value)} />
              </Field>
              <Field label="Exam end date" required error={errors.end}>
                <Input type="date" value={setup.end} onChange={(e) => set("end", e.target.value)} />
              </Field>
              <Field label="Instructions" className="sm:col-span-2">
                <Textarea value={setup.instructions} onChange={(e) => set("instructions", e.target.value)} />
              </Field>
            </div>
          )}
          {step === 1 && (
            <div className="grid gap-5 xl:grid-cols-[3fr_2fr]">
              <section className="space-y-4" aria-label="Divisions sitting this exam">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold">Which divisions sit this exam?</h3>
                  <span className="text-xs text-outline">Combine stages, grades and divisions; each click adds or removes</span>
                </div>
                {!classes.length && (
                  <p>Configure classes and divisions in Settings before creating an exam.</p>
                )}
                {classes.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.filter(({ test }) => groups.some(({ rows }) => test(rows[0].grade))).map(
                      ({ label, test }) => {
                        const ids = classes.filter((row) => test(row.grade)).map((row) => row.id);
                        const on = ids.length > 0 && ids.every((id) => setup.classIds.includes(id));
                        return (
                          <Button
                            key={label}
                            size="sm"
                            variant={on ? "primary" : "outline"}
                            aria-pressed={on}
                            onClick={() =>
                              selectClasses(
                                on
                                  ? setup.classIds.filter((id) => !ids.includes(id))
                                  : [...new Set([...setup.classIds, ...ids])],
                              )
                            }
                          >
                            {label}
                          </Button>
                        );
                      },
                    )}
                    <Button size="sm" variant="ghost" onClick={() => selectClasses([])}>
                      Clear
                    </Button>
                  </div>
                )}
                {[
                  {
                    title: "Classes LKG to 10",
                    list: groups.filter(({ rows }) => !isSeniorGrade(rows[0].grade)),
                  },
                  {
                    title: "Senior secondary 11 and 12",
                    list: groups.filter(({ rows }) => isSeniorGrade(rows[0].grade)),
                  },
                ]
                  .filter(({ list }) => list.length)
                  .map(({ title, list }) => (
                    <section key={title} aria-label={title} className="space-y-2">
                      <h4 className="text-sm font-semibold text-on-surface-variant">{title}</h4>
                      <div className="divide-y divide-outline-variant/60 rounded-lg border border-outline-variant/60">
                        {list.map(({ key, rows }) => {
                          const all = rows.every((row) => setup.classIds.includes(row.id));
                          const scheme = schemeOf(key);
                          return (
                            <div
                              key={key}
                              className="grid items-center gap-3 px-3 py-2 sm:grid-cols-[11rem_1fr]"
                            >
                              <button
                                type="button"
                                aria-pressed={all}
                                aria-label={"Select all " + classGroupTitle(rows[0])}
                                onClick={() =>
                                  selectClasses(
                                    all
                                      ? setup.classIds.filter((id) => !rows.some((row) => row.id === id))
                                      : [...new Set([...setup.classIds, ...rows.map((row) => row.id)])],
                                  )
                                }
                                className="flex items-center gap-2 text-left text-sm font-semibold hover:underline"
                              >
                                <span
                                  aria-hidden="true"
                                  className={"size-2 rounded-full " + (scheme ? "bg-success" : "bg-warning")}
                                />
                                {classGroupTitle(rows[0])}
                                <span className="sr-only">
                                  {scheme ? ", scheme ready" : ", no subject scheme"}
                                </span>
                              </button>
                              <div className="flex flex-wrap gap-2">
                                {rows.map((row) => {
                                  const on = setup.classIds.includes(row.id);
                                  const size = students.filter(
                                    (student) => isActiveStudent(student) && studentClass(student) === row.id,
                                  ).length;
                                  return (
                                    <button
                                      key={row.id}
                                      type="button"
                                      aria-pressed={on}
                                      aria-label={className(row)}
                                      onClick={() => toggleClass(row.id, !on)}
                                      className={
                                        "inline-flex h-8 items-center gap-1.5 rounded border px-2.5 text-sm " +
                                        (on
                                          ? "border-secondary bg-info-container text-secondary"
                                          : "border-outline-variant bg-surface-container-lowest")
                                      }
                                    >
                                      {on ? (
                                        <Check size={14} aria-hidden="true" />
                                      ) : (
                                        <Plus size={14} aria-hidden="true" />
                                      )}
                                      {row.section}
                                      <span className="text-xs text-outline">{size}</span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                <p className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-success" />
                    scheme ready
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className="size-2 rounded-full bg-warning" />
                    no subject scheme yet
                  </span>
                </p>
              </section>
              <aside className="space-y-4" aria-label="Selection summary">
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-4">
                    <p className="text-sm">Divisions</p>
                    <strong className="text-2xl">{selected.length}</strong>
                  </Card>
                  <Card className="p-4">
                    <p className="text-sm">Participating students</p>
                    <strong className="text-2xl">{count}</strong>
                  </Card>
                </div>
                <Card className="space-y-2 p-4 text-sm">
                  <h3 className="font-semibold">Selected</h3>
                  {!selected.length && <p className="text-on-surface-variant">Nothing selected yet.</p>}
                  {groups
                    .filter(({ rows }) => rows.some((row) => setup.classIds.includes(row.id)))
                    .map(({ key, rows }) => (
                      <p key={key}>
                        {classGroupTitle(rows[0])} ·{" "}
                        {rows
                          .filter((row) => setup.classIds.includes(row.id))
                          .map((row) => row.section)
                          .join(", ")}
                        {!schemeOf(key) && (
                          <span className="text-warning"> · no scheme, add subjects manually in step 3</span>
                        )}
                      </p>
                    ))}
                </Card>
                <Card className="space-y-3 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Excluded students</h3>
                    <span className="text-xs text-outline">{excluded.length} excluded</span>
                  </div>
                  <Field
                    label="Find student to exclude"
                    hint={
                      selected.length
                        ? "Name or admission number, within the selected divisions"
                        : "Select a division first"
                    }
                  >
                    <Input
                      type="search"
                      value={studentSearch}
                      disabled={!selected.length}
                      onChange={(e) => setStudentSearch(e.target.value)}
                    />
                  </Field>
                  {studentSearch.trim() && (
                    <div className="flex max-h-48 flex-col gap-1 overflow-y-auto">
                      {suggestions.map((student) => (
                        <Button
                          key={student.id}
                          size="sm"
                          variant="outline"
                          className="justify-start"
                          onClick={() => {
                            set("excludedStudentIds", [...setup.excludedStudentIds, student.id]);
                            setStudentSearch("");
                          }}
                        >
                          Exclude {student.name} · {student.grn}
                        </Button>
                      ))}
                      {!suggestions.length && (
                        <p className="text-xs text-outline">No matching student in the selected divisions.</p>
                      )}
                    </div>
                  )}
                  {excluded.length > 0 && (
                    <ul className="flex flex-wrap gap-2">
                      {excluded.map((student) => (
                        <li key={student.id}>
                          <button
                            type="button"
                            aria-label={"Remove exclusion " + student.name}
                            onClick={() =>
                              set(
                                "excludedStudentIds",
                                setup.excludedStudentIds.filter((id) => id !== student.id),
                              )
                            }
                            className="inline-flex h-8 items-center gap-1.5 rounded border border-outline-variant px-2.5 text-sm"
                          >
                            {student.name}
                            <span className="text-xs text-outline">
                              {classes.find((row) => row.id === studentClass(student))?.section ?? ""}
                            </span>
                            <X size={13} aria-hidden="true" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </aside>
            </div>
          )}
          {step === 2 && (
            <>
              {!selected.length && <p>Select classes and divisions in step 2.</p>}
              {groups
                .filter(({ rows }) => rows.some((row) => setup.classIds.includes(row.id)))
                .map(({ key, rows }) => {
                  const groupClasses = rows.filter((row) => setup.classIds.includes(row.id));
                  const configuredSubjects = [
                    ...new Set(
                      groupClasses.flatMap((row) => [
                        ...(row.subjects ?? []),
                        ...assignments.filter((a) => a.classId === row.id).map((a) => a.subject),
                      ]),
                    ),
                  ].sort();
                  const subjects = configuredSubjects.length ? configuredSubjects : subjectCatalog;
                  const scheme = schemeOf(key);
                  return (
                    <section key={key} className="space-y-3 rounded-lg bg-surface-container-low p-4">
                      <h3 className="font-semibold">{classGroupTitle(rows[0])}</h3>
                      {scheme ? (
                        <div className="flex flex-wrap items-center gap-3 text-sm">
                          <span>
                            Subject scheme: {scheme.subjects.length} subject
                            {scheme.subjects.length === 1 ? "" : "s"}
                            {examTypes.find((type) => type.id === setup.examTypeId)?.pattern === "single"
                              ? " · single paper out of " +
                                examTypes.find((type) => type.id === setup.examTypeId)!.singleMax
                              : ""}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              applyScheme(
                                key,
                                rows[0].grade,
                                groupClasses.map((row) => row.id),
                              )
                            }
                          >
                            Reset to {classGroupTitle(rows[0])} scheme
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm text-on-surface-variant">
                          No subject scheme for {classGroupTitle(rows[0])}. Add one under Settings →
                          Assessment Scheme to pre-fill subjects next time.
                        </p>
                      )}
                      <Field label={"Add subject for " + classGroupTitle(rows[0])}>
                        <Select
                          value=""
                          onChange={(event) => {
                            if (!event.target.value) return;
                            const subject = event.target.value;
                            const ids = groupClasses.map((row) => row.id);
                            const assessment = newAssessment(
                              crypto.randomUUID(),
                              rows[0].grade,
                              ids,
                              subject,
                            );
                            assessment.groupKey = key;
                            assessment.evaluatorIds = Object.fromEntries(
                              ids.map((id) => [id, subjectTeacherId(assignments, subject, id)]),
                            );
                            set("assessments", [...setup.assessments, assessment]);
                          }}
                        >
                          <option value="">Select configured subject…</option>
                          {subjects.map((subject) => (
                            <option key={subject}>{subject}</option>
                          ))}
                        </Select>
                      </Field>
                      {!subjects.length && (
                        <p className="text-sm">Add subjects while setting up a grade or department under Settings → Classes &amp; Sections.</p>
                      )}
                    </section>
                  );
                })}
              {setup.assessments.map((paper) => (
                <section
                  key={paper.key}
                  className="space-y-4 rounded-lg border border-outline-variant p-4"
                  aria-label={paper.subject + " assessment"}
                >
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">
                      {paper.subject} · Grade {paper.grade}
                    </h3>
                    <Button
                      variant="ghost"
                      aria-label={"Remove " + paper.subject}
                      onClick={() =>
                        set(
                          "assessments",
                          setup.assessments.filter((p) => p.key !== paper.key),
                        )
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-4">
                    {selected
                      .filter((row) => row.grade === paper.grade && classKey(row) === paper.groupKey)
                      .map((row) => (
                        <label key={row.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={paper.classIds.includes(row.id)}
                            onChange={(event) =>
                              update(paper.key, {
                                classIds: event.target.checked
                                  ? [...paper.classIds, row.id]
                                  : paper.classIds.filter((id) => id !== row.id),
                              })
                            }
                          />
                          {className(row)}
                        </label>
                      ))}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Assessment type">
                      <Select
                        value={paper.mode}
                        onChange={(e) =>
                          update(paper.key, {
                            mode: e.target.value as Assessment["mode"],
                          })
                        }
                      >
                        <option value="marks">Marks</option>
                        <option value="grade">Grade only</option>
                      </Select>
                    </Field>
                    <Field label="Subject code">
                      <Input
                        value={paper.code}
                        onChange={(e) => update(paper.key, { code: e.target.value })}
                      />
                    </Field>
                    <Field label="Exam duration (minutes)">
                      <Input
                        type="number"
                        min={1}
                        max={360}
                        value={paper.duration * 60}
                        onChange={(e) =>
                          update(paper.key, {
                            duration: Number(e.target.value) / 60,
                          })
                        }
                      />
                    </Field>
                    {paper.mode === "marks" ? (
                      <>
                        {number(paper, "theory", "Theory maximum")}
                        {number(paper, "practical", "Practical maximum")}
                        {number(paper, "internal", "Internal maximum")}
                        {number(paper, "passMarks", "Pass marks")}
                        <p className="self-center text-sm">
                          Maximum marks: {paper.theory + paper.practical + paper.internal}
                        </p>
                        {setup.rules.passCriteria === "components" && (
                          <>
                            {number(paper, "theoryPass", "Theory pass marks")}
                            {number(paper, "practicalPass", "Practical pass marks")}
                            {number(paper, "internalPass", "Internal pass marks")}
                          </>
                        )}
                      </>
                    ) : (
                      <Field label="Grades or descriptors" hint="One per line">
                        <Textarea
                          value={paper.gradeOptions.join("\n")}
                          onChange={(e) =>
                            update(paper.key, {
                              gradeOptions: e.target.value.split("\n"),
                            })
                          }
                        />
                      </Field>
                    )}
                    {setup.rules.calculation === "weighted" && number(paper, "weight", "Result weight")}
                  </div>
                  {paper.classIds.map((id) => (
                    <Field
                      key={id}
                      label={
                        "Marks entry teacher · " +
                        (classes.find((row) => row.id === id)
                          ? className(classes.find((row) => row.id === id)!)
                          : id)
                      }
                    >
                      {teacherSelect(paper.evaluatorIds[id] ?? "", (teacherId) =>
                        update(paper.key, {
                          evaluatorIds: {
                            ...paper.evaluatorIds,
                            [id]: teacherId,
                          },
                        }),
                      )}
                    </Field>
                  ))}
                </section>
              ))}
            </>
          )}
          {step === 3 && (
            <>
              {!setup.assessments.length && <p>Add subjects in step 3 to configure their timetable.</p>}
              {setup.assessments.map((paper) => (
                <section
                  key={paper.key}
                  aria-label={paper.subject + " timetable"}
                  className="space-y-3 rounded-lg border border-outline-variant p-4"
                >
                  <h3 className="font-semibold">
                    {paper.subject} ·{" "}
                    {paper.classIds
                      .map((id) => {
                        const row = classes.find((row) => row.id === id);
                        return row ? className(row) : id;
                      })
                      .join(", ")}
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <Field label="Paper date">
                      <Input
                        type="date"
                        min={setup.start}
                        max={setup.end}
                        value={paper.date}
                        onChange={(e) => update(paper.key, { date: e.target.value })}
                      />
                    </Field>
                    <Field label="Start time">
                      <Input
                        type="time"
                        value={paper.start}
                        onChange={(e) => update(paper.key, { start: e.target.value })}
                      />
                    </Field>
                    <Field label="End time" hint="Calculated from the subject duration">
                      <Input type="time" value={paperEnd(paper)} readOnly />
                    </Field>
                    <Field label="Examination room">
                      <Input
                        value={paper.venue}
                        onChange={(e) => update(paper.key, { venue: e.target.value })}
                      />
                    </Field>
                    <Field label="Invigilator">
                      {teacherSelect(paper.invigilatorId, (invigilatorId) =>
                        update(paper.key, { invigilatorId }),
                      )}
                    </Field>
                    <Field label="Paper instructions">
                      <Textarea
                        value={paper.instructions}
                        onChange={(e) => update(paper.key, { instructions: e.target.value })}
                      />
                    </Field>
                  </div>
                </section>
              ))}
            </>
          )}
          {step === 4 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Grading scheme">
                <Select value={setup.scale} onChange={(e) => set("scale", e.target.value)}>
                  {[
                    "Percentage only",
                    "CBSE 9-Point Scale (A1 to E2)",
                    "5-Point Letter Scale",
                    "GPA (4 point)",
                  ].map((scale) => (
                    <option key={scale}>{scale}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Pass criteria">
                <Select
                  value={setup.rules.passCriteria}
                  onChange={(e) => rule("passCriteria", e.target.value as ExamRules["passCriteria"])}
                >
                  <option value="aggregate">Overall subject pass marks</option>
                  <option value="components">Overall and component pass marks</option>
                </Select>
              </Field>
              <Field label="Result calculation method">
                <Select
                  value={setup.rules.calculation}
                  onChange={(e) => rule("calculation", e.target.value as ExamRules["calculation"])}
                >
                  <option value="total">Total obtained / total maximum</option>
                  <option value="average">Average subject percentage</option>
                  <option value="weighted">Weighted subject percentage</option>
                </Select>
              </Field>
              <Field label="Rounding">
                <Select
                  value={setup.rules.rounding}
                  onChange={(e) => rule("rounding", e.target.value as ExamRules["rounding"])}
                >
                  <option value="none">No rounding</option>
                  <option value="whole">Whole number</option>
                  <option value="one-decimal">One decimal place</option>
                  <option value="two-decimal">Two decimal places</option>
                </Select>
              </Field>
              <Field label="Rank calculation">
                <Select
                  value={setup.rules.rankScope}
                  onChange={(e) => rule("rankScope", e.target.value as ExamRules["rankScope"])}
                >
                  <option value="none">Disabled</option>
                  <option value="division">Within division</option>
                  <option value="class-course">Within class and course</option>
                </Select>
              </Field>
              <Field label="Absent marks">
                <Select
                  value={setup.rules.absentRule}
                  onChange={(e) => rule("absentRule", e.target.value as ExamRules["absentRule"])}
                >
                  <option value="incomplete">Keep the overall result incomplete</option>
                  <option value="zero">Count as zero</option>
                </Select>
              </Field>
              <p className="text-sm text-on-surface-variant">
                Exempt subjects are excluded from numeric totals. Missing marks remain incomplete. Grade-only
                subjects retain their descriptors.
              </p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={setup.rules.requireApproval}
                  onChange={(e) => rule("requireApproval", e.target.checked)}
                />
                Require result approval before publication
              </label>
              {setup.rules.calculation === "weighted" && (
                <p className="text-sm">Set each subject’s relative result weight in step 3.</p>
              )}
            </div>
          )}
          {step === 5 && (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="p-4">
                  <p className="text-sm">Participating divisions</p>
                  <strong className="text-2xl">{selected.length}</strong>
                </Card>
                <Card className="p-4">
                  <p className="text-sm">Participating students</p>
                  <strong className="text-2xl">{count}</strong>
                </Card>
                <Card className="p-4">
                  <p className="text-sm">Subject papers</p>
                  <strong className="text-2xl">{setup.assessments.length}</strong>
                </Card>
              </div>
              <p>
                {setup.title || "Untitled examination"} · {setup.academicYear} · {setup.examType}
              </p>
              <p className="text-sm">
                {setup.start || "Start date required"} — {setup.end || "End date required"}
              </p>
              <ul className="space-y-2 text-sm">
                {selected.map((row) => (
                  <li key={row.id}>
                    {className(row)} ·{" "}
                    {
                      participants(setup, students).filter((student) => studentClass(student) === row.id)
                        .length
                    }{" "}
                    students ·{" "}
                    {setup.assessments
                      .filter((paper) => paper.classIds.includes(row.id))
                      .map((paper) => paper.subject)
                      .join(", ") || "No subjects"}
                  </li>
                ))}
              </ul>
              <p className="text-sm">
                {
                  setup.excludedStudentIds.filter((id) =>
                    selectedStudents.some((student) => student.id === id),
                  ).length
                }{" "}
                students excluded · {setup.scale} · Result approval{" "}
                {setup.rules.requireApproval ? "required" : "optional"}
              </p>
              <Button variant="outline" onClick={() => setErrors(setupErrors(setup, classes, otherPapers))}>
                Check configuration and conflicts
              </Button>
              <Field
                label="Schedule publication"
                hint={setup.timeZone + ". Leave blank to publish immediately."}
              >
                <Input
                  type="datetime-local"
                  value={setup.publishAt}
                  onChange={(e) => set("publishAt", e.target.value)}
                />
              </Field>
              <p className="text-sm text-on-surface-variant">
                Publishing releases the examination setup and timetable. Marks and report cards are published
                separately after review.
              </p>
            </>
          )}
        </fieldset>
        {Object.keys(errors).length > 0 && (
          <ul
            role="alert"
            className="mt-5 list-inside list-disc space-y-1 rounded-lg bg-error-container/40 p-4 text-sm text-error"
          >
            {[...new Set(Object.values(errors))].map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        )}
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push("/exams")}>
          <ArrowLeft size={15} />
          Back to exams
        </Button>
        <div className="flex flex-wrap gap-2">
          {!locked && (
            <Button variant="outline" disabled={saving} onClick={() => save("draft")}>
              Save as Draft
            </Button>
          )}
          {step > 0 && (
            <Button variant="outline" disabled={saving} onClick={() => setStep(step - 1)}>
              Previous
            </Button>
          )}
          {step < 5 ? (
            <Button disabled={saving} onClick={() => setStep(step + 1)}>
              Next
              <ArrowRight size={15} />
            </Button>
          ) : (
            !locked && (
              <Button disabled={saving} onClick={() => save(setup.publishAt ? "schedule" : "publish")}>
                {saving ? "Saving…" : setup.publishAt ? "Schedule Publication" : "Publish Exam"}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
