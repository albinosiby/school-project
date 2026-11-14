"use client";

import { collection, getDocs, runTransaction, writeBatch } from "firebase/firestore";
import { createStamp, schoolDoc, stamp } from "@/features/fees/logic";
import type { AcademicClass } from "@/lib/academicStreams";
import { currentSchoolId } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import { candidateChanges, subjectTeacherId, type StudentRow } from "./logic";
import { participants, studentClass, setupCandidates, setupErrors, type ExamSetup } from "./examSetup";
import { publicationDate } from "./publicationTime";
import type { Candidate, Cycle, Paper } from "./types";
import { scheduleErrors } from "../../../../functions/examOperations";

export async function saveExamSetup(
  setup: ExamSetup,
  mode: "draft" | "publish" | "schedule",
  data: {
    id: string;
    cycle?: Cycle;
    papers: Paper[];
    classes: AcademicClass[];
    students: StudentRow[];
    candidates: Candidate[];
    assignments: { classId: string; subject: string; teacherId: string }[];
    staff: { id: string; name: string }[];
  },
) {
  if (!setup.title.trim()) throw new Error("Examination name is required");
  if (mode !== "draft") {
    const errors = setupErrors(
      setup,
      data.classes,
      data.papers.filter((paper) => paper.cycleId !== data.id && paper.setupPlanned !== false),
    );
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  }
  const publishDate = setup.publishAt ? publicationDate(setup.publishAt, setup.timeZone) : undefined;
  if (mode === "schedule" && (!publishDate || !Number.isFinite(+publishDate) || +publishDate <= Date.now())) {
    throw new Error("Choose a future publication date and time");
  }
  // Candidate records are shared across exams. Refresh them before publishing the
  // atomic exam configuration so a failed refresh cannot expose an incomplete exam.
  if (mode !== "draft") {
    const changes = candidateChanges(data.candidates, setupCandidates(setup, data.students));
    for (let offset = 0; offset < changes.length; offset += 400) {
      const batch = writeBatch(db);
      for (const candidate of changes.slice(offset, offset + 400))
        batch.set(schoolDoc("exm_candidates", candidate.id), { ...candidate, ...stamp() }, { merge: true });
      await batch.commit();
    }
  }
  const oldPapers = data.papers.filter((paper) => paper.cycleId === data.id);
  if (oldPapers.length + setup.assessments.length > 440)
    throw new Error("This exam has too many papers to save together. Split it into smaller exams.");
  const sid = currentSchoolId();
  if (!sid) throw new Error("Sign in before saving an exam");
  const guardRef = schoolDoc("exm_config", "schedule_guard");
  const cycleRef = schoolDoc("exm_cycles", data.id);
  const selected = participants(setup, data.students);
  const paperRefs = setup.assessments.map((assessment) =>
    schoolDoc("exm_papers", assessment.id ?? "pap_" + assessment.key),
  );
  const removed = oldPapers.filter(
    (paper) => !setup.assessments.some((assessment) => assessment.id === paper.id),
  );
  await runTransaction(db, async (tx) => {
    const [saved, guard] = await Promise.all([tx.get(cycleRef), tx.get(guardRef)]);
    if (mode !== "draft") {
      // All setup publications touch this guard. A competing publication retries
      // the transaction and rechecks the server's current schedule.
      const schedule = await getDocs(collection(db, "schools", sid, "exm_papers"));
      const conflicts = setupErrors(
        setup,
        data.classes,
        schedule.docs
          .map((doc) => ({ ...doc.data(), id: doc.id }) as Paper)
          .filter((paper) => paper.cycleId !== data.id && paper.setupPlanned !== false),
      );
      if (Object.keys(conflicts).length) throw new Error(Object.values(conflicts)[0]);
      const dutyRows = await getDocs(collection(db, "schools", sid, "exm_duties"));
      const proposed = setup.assessments.map((assessment, index) => ({ id: paperRefs[index].id, cycleId: data.id, grade: assessment.grade, subject: assessment.subject, classIds: assessment.classIds, date: assessment.date, start: assessment.start, duration: assessment.duration, venue: assessment.venue, invigilatorId: assessment.invigilatorId, setupPlanned: true }) as Paper);
      const dutyConflicts = scheduleErrors(proposed, [...schedule.docs.map((row) => ({ ...row.data(), id: row.id }) as Paper).filter((paper) => paper.cycleId !== data.id), ...proposed], dutyRows.docs.map((row) => row.data() as { paperId: string; staffId: string }), { start: setup.start, end: setup.end });
      if (dutyConflicts.length) throw new Error(dutyConflicts[0]);
    }
    const existingPapers = await Promise.all(
      oldPapers.map((paper) => tx.get(schoolDoc("exm_papers", paper.id))),
    );
    if (
      saved.exists() !== !!data.cycle ||
      (saved.exists() && (saved.get("setupVersion") ?? 0) !== (data.cycle?.setupVersion ?? 0))
    ) {
      throw new Error("This exam changed. Reload it before saving.");
    }
    if (saved.exists() && saved.get("status") !== "Draft")
      throw new Error("Published exams cannot be reconfigured.");
    if (existingPapers.some((paper) => paper.get("marksEntered") || paper.get("published")?.length))
      throw new Error("An exam with results cannot be reconfigured.");
    const version = (data.cycle?.setupVersion ?? 0) + 1;
    const published = mode === "publish";
    const now = stamp();
    const body: Omit<Cycle, "id"> = {
      title: setup.title.trim(),
      short: setup.title.trim(),
      term: setup.academicYear,
      category: setup.examType,
      academicYear: setup.academicYear.trim(),
      examType: setup.examType,
      examTypeId: setup.examTypeId,
      termId: setup.termId,
      description: setup.description.trim(),
      start: setup.start,
      end: setup.end,
      declaration: data.cycle?.declaration ?? "",
      instructions: setup.instructions.trim(),
      circular: data.cycle?.circular ?? "",
      classIds: setup.classIds,
      excludedStudentIds: setup.excludedStudentIds,
      grades: [
        ...new Set(data.classes.filter((row) => setup.classIds.includes(row.id)).map((row) => row.grade)),
      ],
      sections: "custom",
      enforceAttendance: false,
      theoryMax: 0,
      internalMax: 0,
      internalParts: [],
      scale: setup.scale,
      passRule: setup.rules.passCriteria,
      grace: "No grace marks",
      qr: false,
      sealed: false,
      biometric: false,
      status: published ? "Scheduled" : "Draft",
      publicationState: mode === "draft" ? "draft" : mode === "schedule" ? "scheduled" : "published",
      resultRules: setup.rules,
      publishAtLocal: mode === "schedule" ? setup.publishAt : "",
      publicationTimezone: setup.timeZone,
      publishAt: mode === "schedule" ? publishDate!.toISOString() : "",
      setupVersion: version,
    };
    tx.set(guardRef, { revision: (guard.get("revision") ?? 0) + 1, ...now });
    tx.set(cycleRef, { ...body, id: data.id, ...(saved.exists() ? now : createStamp()) });
    for (const paper of removed) tx.delete(schoolDoc("exm_papers", paper.id));
    setup.assessments.forEach((assessment, index) => {
      const ref = paperRefs[index];
      const evaluatorIds = Object.fromEntries(
        assessment.classIds.map((classId) => [
          classId,
          assessment.evaluatorIds[classId] ?? subjectTeacherId(data.assignments, assessment.subject, classId),
        ]),
      );
      const paper: Paper = {
        id: ref.id,
        cycleId: data.id,
        grade: assessment.grade,
        subject: assessment.subject.trim(),
        code: assessment.code.trim(),
        classIds: assessment.classIds,
        studentIds: selected
          .filter((student) => assessment.classIds.includes(studentClass(student)))
          .map((student) => student.id),
        assessmentMode: assessment.mode,
        gradeOptions: assessment.gradeOptions,
        theory: assessment.mode === "grade" ? 0 : assessment.theory,
        practical: assessment.mode === "grade" ? 0 : assessment.practical,
        internal: assessment.mode === "grade" ? 0 : assessment.internal,
        internalType: "Internal",
        passMarks: assessment.passMarks,
        theoryPass: assessment.theoryPass,
        practicalPass: assessment.practicalPass,
        internalPass: assessment.internalPass,
        weight: assessment.weight,
        date: assessment.date,
        start: assessment.start,
        duration: assessment.duration,
        venue: assessment.venue.trim(),
        invigilatorId: assessment.invigilatorId,
        invigilator: data.staff.find((teacher) => teacher.id === assessment.invigilatorId)?.name ?? "",
        instructions: assessment.instructions.trim(),
        evaluatorIds,
        resultRules: setup.rules,
        scale: setup.scale,
        setupPlanned: mode !== "draft",
        setupPublished: published,
        locked: !published,
        status: "Scheduled",
        marksEntered: false,
        published: [],
        setupVersion: version,
      };
      tx.set(ref, { ...paper, ...now });
    });
  });
}
