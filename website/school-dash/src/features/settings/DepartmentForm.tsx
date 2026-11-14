"use client";
// Settings → Classes & Sections → Senior Secondary → Add department. A department is the school's unit for Grades 11
// and 12 (Science, Commerce, Home Science…). The form walks three steps: 1 the department, its head and total seats;
// 2 the divisions and the seats of each; 3 the subjects of Grade 11 and of Grade 12 (usually the same list, so Grade 12
// can copy Grade 11). One save writes, for each grade: the capacity row, admission seats, one class per division, the
// subject scheme with that grade's subjects, and the department in the catalog.
import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { Button, Field, Input, Modal, Select, useToast } from "@/components/ui";
import { classIdOf, courseIdOf, sectionLabel, seniorClassParts, streamIdOf } from "@/lib/academicStreams";
import { db } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { normalizeSubjects, subjectKey, subjectSettingsId, useSchoolSubjects, type SchoolDepartment, type SchoolSubject } from "@/lib/schoolSubjects";
import { newScheme, newSchemeSubject, schemeId, type SchemeSubject } from "@/features/exams/assessmentScheme";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { teachingStaff, type StaffRef } from "@/features/ops/shared";

export const SENIOR_GRADES = ["11", "12"] as const;
export const DIVISION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];
export type DepartmentRow = { id: string; streamId?: string; stream: string; grade: string; cap: number; subjects?: string[]; sectionSeats?: number[]; hodId?: string; hod?: string };
/** "Science" keeps the built-in stream id so class ids stay `cls_11_science_A`; anything else becomes a course id. */
export const departmentId = (name: string) => streamIdOf(name) || courseIdOf(name);
/** total seats split evenly over the divisions, remainder on the first ones */
export function splitSeats(total: number, divisions: number) {
  const n = Math.max(1, Math.min(DIVISION_LETTERS.length, divisions));
  const base = Math.floor(Math.max(0, total) / n), extra = Math.max(0, total) - base * n;
  return Array.from({ length: n }, (_, index) => base + (index < extra ? 1 : 0));
}
export type SeniorGrade = (typeof SENIOR_GRADES)[number];
/** `subjects[i]` is the subject list of `SENIOR_GRADES[i]`: Grade 11 first, then Grade 12. */
export type DepartmentDraft = { name: string; total: number; seats: number[]; subjects: string[][] };
/** Every subject the department teaches, in order of first appearance across both grades. */
export function unionSubjects(subjects: string[][]) {
  const list: string[] = [];
  for (const name of subjects.flat()) if (!list.some((known) => subjectKey(known) === subjectKey(name))) list.push(name);
  return list;
}
/** The saved subjects of Grade 11 and of Grade 12, from their capacity rows; with one row only, its list counts for both. */
export function gradeSubjects(rows: DepartmentRow[]) {
  const of = (grade: SeniorGrade) => rows.find((row) => row.grade === `Grade ${grade}`)?.subjects;
  return SENIOR_GRADES.map((grade) => of(grade) ?? rows[0]?.subjects ?? []);
}
export const STEPS = ["Department and seats", "Divisions", "Subjects of Grade 11 and 12"] as const;
/** First problem with one step of a department draft, or "". `currentId` is the department being edited ("" when adding). */
export function stepError(step: 1 | 2 | 3, draft: DepartmentDraft, existingIds: string[], currentId: string): string {
  const title = draft.name.trim().replace(/\s+/g, " ");
  if (step === 1) {
    if (title.length < 2 || title.length > 48 || !/^[a-z0-9][a-z0-9 &'-]*$/i.test(title)) return "Enter a department name of 2–48 letters, digits, spaces, & ' or -.";
    if (departmentId(title) !== currentId && existingIds.includes(departmentId(title))) return "A department with this name already exists.";
    if (!Number.isInteger(draft.total) || draft.total < 1) return "Enter the total seats (1 or more).";
    return "";
  }
  if (step === 2) {
    if (!draft.seats.length || draft.seats.length > DIVISION_LETTERS.length) return "Choose 1 to 8 divisions.";
    if (draft.seats.some((n) => !Number.isInteger(n) || n < 1 || n > 999)) return "Every division needs 1–999 seats.";
    const sum = draft.seats.reduce((a, b) => a + b, 0);
    if (sum !== draft.total) return `Division seats add up to ${sum}, not the ${draft.total} total seats.`;
    return "";
  }
  const empty = SENIOR_GRADES.findIndex((_, index) => !draft.subjects[index]?.length);
  if (empty >= 0) return `Grade ${SENIOR_GRADES[empty]} needs at least one subject.`;
  return "";
}
/** First problem with a department draft, or "". */
export const departmentError = (draft: DepartmentDraft, existingIds: string[], currentId: string) =>
  stepError(1, draft, existingIds, currentId) || stepError(2, draft, existingIds, currentId) || stepError(3, draft, existingIds, currentId);
/** Rows of other collections that point at a class by id and move with a renamed department. */
const MOVING = ["assignments", "ops_periods"] as const;
type ClassLink = { id: string; classId?: string };
const occupancy = (students: StudentRow[], id: string) => students.filter((s) => !s.deleted && (!s.status || s.status === "Active") && s.classId === id).length;
const formatName = (value: string) => value.trim().replace(/\s+/g, " ").split(" ").map((word) => (word === word.toLowerCase() ? word.replace(/\p{L}/u, (letter) => letter.toUpperCase()) : word)).join(" ");
const NEW = "__new__";

export function DepartmentForm({ current, existingIds, students, held, onClose }: {
  current: DepartmentRow[]; existingIds: string[]; students: StudentRow[]; held: ReturnType<typeof computeSeatRows>; onClose: () => void;
}) {
  const toast = useToast();
  const catalog = useSchoolSubjects();
  const staff = useCollection<StaffRef>("staff");
  const assignments = useCollection<ClassLink>("assignments");
  const periods = useCollection<ClassLink>("ops_periods");
  const saved = current.find((row) => row.grade === "Grade 11") ?? current[0];
  const editing = current.length > 0;
  const savedId = saved ? saved.streamId || departmentId(saved.stream) : "";
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [name, setName] = useState(saved?.stream ?? "");
  const [hodId, setHodId] = useState(saved?.hodId ?? "");
  const [seats, setSeats] = useState<number[]>(saved?.sectionSeats ?? (saved ? [saved.cap] : [30]));
  const [total, setTotal] = useState(() => (saved?.sectionSeats ?? [saved?.cap ?? 30]).reduce((a, b) => a + b, 0));
  const [subjects, setSubjects] = useState<string[][]>(() => gradeSubjects(current));
  const [pick, setPick] = useState<{ grade: number; value: string }>({ grade: -1, value: "" });
  const [newSubject, setNewSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const minDivisions = saved?.sectionSeats?.length ?? 1;
  const teachers = teachingStaff(staff.rows);
  const title = name.trim().replace(/\s+/g, " ");
  const streamId = departmentId(title);
  const renaming = editing && streamId !== savedId;
  const oldClassIds = SENIOR_GRADES.flatMap((grade) => Array.from({ length: minDivisions }, (_, i) => classIdOf(grade, DIVISION_LETTERS[i]!, savedId)));
  // the name (and so the ids of the classes, seats and scheme) can change only while nothing is enrolled or admitted
  const occupied = editing && (oldClassIds.some((id) => occupancy(students, id) > 0)
    || SENIOR_GRADES.some((grade) => { const taken = held.find((row) => row.grade === `${grade}-${savedId}`); return (taken?.held ?? 0) > 0 || (taken?.rteSeats ?? 0) > 0; }));
  const draft: DepartmentDraft = { name: title, total, seats, subjects };
  const inGrade = (grade: number, subject: string) => (subjects[grade] ?? []).some((name) => subjectKey(name) === subjectKey(subject));

  function setDivisions(count: number) {
    const n = Math.max(minDivisions, Math.min(DIVISION_LETTERS.length, count || 1));
    setSeats(splitSeats(total, n));
    setError("");
  }
  function addSubject(grade: number, name: string) {
    if (inGrade(grade, name)) return;
    setSubjects((lists) => lists.map((list, index) => (index === grade ? [...list, name] : list)));
    setError("");
  }
  function chooseSubject(grade: number, value: string) {
    setPick({ grade, value });
    if (!value || value === NEW) return;
    addSubject(grade, value);
    setPick({ grade: -1, value: "" });
  }
  async function addNewSubject(grade: number) {
    const clean = formatName(newSubject);
    if (!clean || clean.length > 120) return setError("Enter a subject name up to 120 characters.");
    const known = catalog.subjects.find((subject) => subjectKey(subject.name) === subjectKey(clean));
    if (!known) {
      setBusy(true);
      try {
        const ref = schoolDoc("set_config", subjectSettingsId);
        await runTransaction(db, async (tx) => {
          const snapshot = await tx.get(ref);
          const list = normalizeSubjects(snapshot.get("subjects") ?? catalog.subjects);
          if (!list.some((subject) => subjectKey(subject.name) === subjectKey(clean)))
            list.push({ id: crypto.randomUUID(), name: clean, active: true, departmentIds: [], aliasIds: [] });
          tx.set(ref, { id: subjectSettingsId, subjects: list, departments: snapshot.get("departments") ?? catalog.departments, ...createStamp() }, { merge: true });
        });
        toast(clean + " added to the subject list");
      } catch (cause) {
        return setError(cause instanceof Error ? cause.message : "Could not add the subject.");
      } finally {
        setBusy(false);
      }
    }
    addSubject(grade, known?.name ?? clean);
    setNewSubject(""); setPick({ grade: -1, value: "" });
  }
  function next() {
    const problem = stepError(step, draft, existingIds, savedId);
    setError(problem);
    if (!problem && step < 3) setStep((step + 1) as 2 | 3);
  }

  async function save() {
    if (busy) return;
    const problem = departmentError(draft, existingIds, savedId);
    if (problem) return setError(problem);
    if (renaming && occupied) return setError("The name can change only while the department has no students or admissions.");
    const newClassId = (id: string) => { const parts = seniorClassParts(id); return parts ? classIdOf(parts[1]!, parts[3]!, streamId) : id; };
    const moving = renaming ? MOVING.flatMap((coll) => (coll === "assignments" ? assignments : periods).rows.filter((row) => oldClassIds.includes(row.classId ?? "")).map((row) => ({ coll, row }))) : [];
    if (moving.length > 300) return setError("Clear this department's timetable before renaming it.");
    for (const grade of SENIOR_GRADES) {
      const taken = held.find((row) => row.grade === `${grade}-${streamId}`);
      if (total < Math.max(taken?.held ?? 0, taken?.rteSeats ?? 0)) return setError(`Grade ${grade} seats cannot be below its occupied and reserved seats.`);
      for (const [index, capacity] of seats.entries())
        if (capacity < occupancy(students, classIdOf(grade, DIVISION_LETTERS[index]!, streamId))) return setError(`Grade ${grade} division ${DIVISION_LETTERS[index]} already has more students than ${capacity} seats.`);
    }
    const hod = teachers.find((teacher) => teacher.id === hodId);
    const names = unionSubjects(subjects);
    setError(""); setBusy(true);
    try {
      const stamp = createStamp();
      const sectionRefs = SENIOR_GRADES.map((grade) => schoolDoc("set_sections", `sec_grade${grade}_${streamId}`));
      const schemeRefs = SENIOR_GRADES.map((grade) => schoolDoc("set_subject_schemes", schemeId(`${grade}:${streamId}`)));
      // when renaming, the saved rows live under the old id: they are read for the conflict check and the marks split, then deleted
      const fromId = renaming ? savedId : streamId;
      const oldSectionRefs = SENIOR_GRADES.map((grade) => schoolDoc("set_sections", `sec_grade${grade}_${fromId}`));
      const oldSchemeRefs = SENIOR_GRADES.map((grade) => schoolDoc("set_subject_schemes", schemeId(`${grade}:${fromId}`)));
      const catalogRef = schoolDoc("set_config", subjectSettingsId);
      await runTransaction(db, async (tx) => {
        const [sectionSnaps, oldSectionSnaps, schemeSnaps, catalogSnap] = await Promise.all([
          Promise.all(sectionRefs.map((ref) => tx.get(ref))), Promise.all(oldSectionRefs.map((ref) => tx.get(ref))), Promise.all(oldSchemeRefs.map((ref) => tx.get(ref))), tx.get(catalogRef),
        ]);
        if ((!editing || renaming) && sectionSnaps.some((snapshot) => snapshot.exists())) throw new Error("A department with this name already exists.");
        if (renaming) {
          for (const [index, grade] of SENIOR_GRADES.entries()) {
            tx.delete(oldSectionRefs[index]!); tx.delete(oldSchemeRefs[index]!); tx.delete(schoolDoc("adm_seats", `seat_${grade}_${savedId}`));
          }
          for (const id of oldClassIds) tx.delete(schoolDoc("classes", id));
          for (const { coll, row } of moving) tx.update(schoolDoc(coll, row.id), { classId: newClassId(row.classId ?? ""), ...stamp });
        }
        for (const [index, grade] of SENIOR_GRADES.entries()) {
          const before = current.find((row) => row.id === oldSectionRefs[index]!.id);
          const snapshot = oldSectionSnaps[index]!;
          if (before && snapshot.exists() && (JSON.stringify(snapshot.get("subjects")) !== JSON.stringify(before.subjects) || JSON.stringify(snapshot.get("sectionSeats")) !== JSON.stringify(before.sectionSeats)))
            throw new Error("This department changed in another window. Reopen the editor and try again.");
          const taught = subjects[index] ?? [];
          // subjects the grade no longer teaches leave its scheme template; exams already created keep their papers
          const dropped = (before?.subjects ?? []).filter((name) => !taught.some((kept) => subjectKey(kept) === subjectKey(name)));
          const classRows = seats.map((capacity, i) => ({ ref: schoolDoc("classes", classIdOf(grade, DIVISION_LETTERS[i]!, streamId)), section: DIVISION_LETTERS[i]!, capacity }));
          tx.set(sectionRefs[index]!, {
            ...stamp, id: sectionRefs[index]!.id, grade: `Grade ${grade}`, stream: title, streamId, hodId: hod?.id ?? "", hod: hod?.name ?? "",
            sections: classRows.map((row) => sectionLabel(grade, row.section, streamId)), subjects: taught, sectionSeats: seats, cap: total,
            roster: classRows.reduce((sum, row) => sum + occupancy(students, row.ref.id), 0),
          }, { merge: true });
          tx.set(schoolDoc("adm_seats", `seat_${grade}_${streamId}`), {
            ...stamp, id: `seat_${grade}_${streamId}`, grade: `${grade}-${streamId}`, group: "senior", stream: title, streamId, capacity: total, ...(!before ? { rteSeats: 0, block: "" } : {}),
          }, { merge: true });
          for (const row of classRows) tx.set(row.ref, { ...stamp, id: row.ref.id, grade, section: row.section, stream: title, streamId, capacity: row.capacity, subjects: taught }, { merge: true });
          const schemeSnap = schemeSnaps[index]!;
          const existing: SchemeSubject[] = (schemeSnap.exists() ? (schemeSnap.get("subjects") ?? []) : []).filter((row: SchemeSubject) => !dropped.some((name) => subjectKey(name) === subjectKey(row.subject)));
          const merged = [...existing, ...taught.filter((name) => !existing.some((row) => subjectKey(row.subject) === subjectKey(name))).map(newSchemeSubject)];
          const base = renaming
            ? { ...newScheme(`${grade}:${streamId}`), ...(schemeSnap.exists() ? { scaleId: schemeSnap.get("scaleId") ?? "default", coScholastic: schemeSnap.get("coScholastic") ?? [] } : {}) }
            : schemeSnap.exists() ? {} : newScheme(`${grade}:${streamId}`);
          tx.set(schemeRefs[index]!, { ...base, id: schemeRefs[index]!.id, subjects: merged, ...stamp }, { merge: true });
        }
        const departments: SchoolDepartment[] = (catalogSnap.get("departments") as SchoolDepartment[] | undefined) ?? catalog.departments;
        const entry = { id: streamId, name: title, hodId: hod?.id ?? "" };
        const list: SchoolSubject[] = normalizeSubjects(catalogSnap.get("subjects") ?? catalog.subjects)
          .map((subject) => (renaming ? { ...subject, departmentIds: subject.departmentIds.map((id) => (id === savedId ? streamId : id)) } : subject))
          .map((subject) => names.some((name) => subjectKey(name) === subjectKey(subject.name)) && !subject.departmentIds.includes(streamId)
            ? { ...subject, departmentIds: [...subject.departmentIds, streamId] } : subject);
        for (const name of names) if (!list.some((subject) => subjectKey(subject.name) === subjectKey(name))) list.push({ id: crypto.randomUUID(), name, active: true, departmentIds: [streamId], aliasIds: [] });
        const matchId = renaming ? savedId : streamId;
        tx.set(catalogRef, { id: subjectSettingsId, subjects: list, departments: departments.some((d) => d.id === matchId) ? departments.map((d) => (d.id === matchId ? { ...d, ...entry } : d)) : [...departments, entry], ...stamp }, { merge: true });
      });
      toast("Department saved");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the department. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const sum = seats.reduce((a, b) => a + b, 0);
  return (
    <Modal open width="max-w-2xl" onClose={() => { if (!busy) onClose(); }} title={editing ? `Edit ${saved?.stream}` : "Add department"} subtitle="Applies to Grade 11 and Grade 12"
      footer={<>
        <Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button>
        {step > 1 && <Button variant="outline" disabled={busy} onClick={() => { setError(""); setStep((step - 1) as 1 | 2); }}>Back</Button>}
        {step < 3 ? <Button disabled={busy} onClick={next}>Next</Button>
          : <Button disabled={busy} onClick={save}>{busy ? "Saving…" : editing ? "Save department" : "Add department"}</Button>}
      </>}>
      <ol className="mb-5 grid grid-cols-3 gap-2 text-xs" aria-label="Steps">
        {STEPS.map((label, index) => { const n = (index + 1) as 1 | 2 | 3; const state = n === step ? "current" : n < step ? "done" : "todo"; return (
          <li key={label} aria-current={n === step ? "step" : undefined} className={"rounded-md border px-3 py-2 " + (state === "current" ? "border-secondary bg-info-container text-secondary" : state === "done" ? "border-outline-variant text-on-surface" : "border-outline-variant/60 text-outline")}>
            <span className="font-semibold">Step {n}</span> · {label}
          </li>); })}
      </ol>
      <fieldset disabled={busy} className="space-y-5">
        {step === 1 && <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Department name" required hint={occupied ? "Locked while the department has students or admissions" : renaming ? "Renaming moves its classes, seats, scheme and timetable to the new name" : undefined}>
            <Input value={name} disabled={occupied} onChange={(e) => { setName(e.target.value); setError(""); }} placeholder="Science" /></Field>
          <Field label="Head of department" hint="Optional">
            <Select value={hodId} onChange={(e) => setHodId(e.target.value)}>
              <option value="">Not assigned</option>
              {teachers.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
            </Select>
          </Field>
          <Field label="Total seats" required hint="Per grade; split over the divisions in the next step">
            <Input type="number" min={1} value={total} onChange={(e) => { const value = Number(e.target.value); setTotal(value); setSeats(splitSeats(value, seats.length)); setError(""); }} />
          </Field>
        </div>}
        {step === 2 && <div className="space-y-3">
          <Field label="Divisions" required hint={minDivisions > 1 ? `At least ${minDivisions} (existing divisions cannot be removed)` : "1 to 8"} className="sm:w-1/2">
            <Input type="number" min={minDivisions} max={8} value={seats.length} onChange={(e) => setDivisions(Number(e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {seats.map((count, index) => <Field key={DIVISION_LETTERS[index]} label={`Division ${DIVISION_LETTERS[index]} seats`} required>
              <Input type="number" min={1} max={999} value={count} onChange={(e) => { setSeats(seats.map((n, i) => (i === index ? Number(e.target.value) : n))); setError(""); }} />
            </Field>)}
          </div>
          <p className={"text-sm " + (sum === total ? "text-on-surface-variant" : "text-warning")}>Divisions add up to {sum} of {total} seats{sum !== total ? " · adjust so they match" : ""}.</p>
        </div>}
        {step === 3 && <div className="space-y-4">
          <p className="text-sm text-on-surface-variant">The combination usually continues from Grade 11 into 12, so Grade 12 can copy the Grade 11 list and you change only what differs. New subjects are saved to the subject list, so other departments can pick them too.</p>
          {SENIOR_GRADES.map((grade, index) => {
            const list = subjects[index] ?? [];
            const available = catalog.subjects.filter((subject) => subject.active && !inGrade(index, subject.name));
            return <section key={grade} aria-label={`Grade ${grade} subjects`} className="space-y-2 rounded-lg border border-outline-variant/60 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium">Grade {grade} <span className="font-normal text-outline">· {list.length} subject{list.length === 1 ? "" : "s"}</span></p>
                {index > 0 && <Button variant="ghost" size="sm" onClick={() => { setSubjects((lists) => lists.map((row, i) => (i === index ? [...(lists[0] ?? [])] : row))); setError(""); }}>Copy subjects from Grade 11</Button>}
              </div>
              {list.length ? <ul className="flex flex-wrap gap-2">
                {list.map((subject) => <li key={subject} className="inline-flex items-center gap-1 rounded border border-outline-variant bg-surface-container-low px-2 py-1 text-sm">{subject}
                  <button type="button" aria-label={`Remove ${subject} from Grade ${grade}`} className="text-outline hover:text-error" onClick={() => setSubjects((lists) => lists.map((row, i) => (i === index ? row.filter((name) => name !== subject) : row)))}>×</button></li>)}
              </ul> : <p className="text-sm text-on-surface-variant">No subjects yet.</p>}
              <div className="flex flex-wrap items-end gap-2">
                <Field label={`Add subject to Grade ${grade}`} className="min-w-56 flex-1">
                  <Select value={pick.grade === index ? pick.value : ""} onChange={(e) => chooseSubject(index, e.target.value)}>
                    <option value="">Choose a subject…</option>
                    {available.map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}
                    <option value={NEW}>+ Add a new subject…</option>
                  </Select>
                </Field>
                {pick.grade === index && pick.value === NEW && <>
                  <Field label="New subject name" className="min-w-48 flex-1"><Input value={newSubject} maxLength={120} onChange={(e) => setNewSubject(e.target.value)} placeholder="Food and Nutrition" /></Field>
                  <Button variant="outline" onClick={() => addNewSubject(index)}>Add subject</Button>
                </>}
              </div>
            </section>;
          })}
        </div>}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </fieldset>
    </Modal>
  );
}
