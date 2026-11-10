"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { runTransaction } from "firebase/firestore";
import { Button, Checkbox, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { classIdOf, courseIdOf, isCourseId, sectionLabel, streamIdOf, type AcademicClass } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { type Application, type Offer, type Seat } from "@/features/admissions/types";

const grades = ["11", "12"] as const;
const letters = ["A", "B", "C", "D", "E", "F", "G", "H"];
type Grade = typeof grades[number];
type GradeDraft = { enabled: boolean; subjects: string; seats: string[] };
type CourseRow = { id: string; streamId?: string; stream: string; grade: string; cap: number; subjects?: string[]; sectionSeats?: number[] };
const blankGrade = (): GradeDraft => ({ enabled: false, subjects: "", seats: ["30"] });
const occupancy = (students: StudentRow[], id: string) =>
  students.filter((s) => !s.deleted && (!s.status || s.status === "Active") && s.classId === id).length;

export function SeniorCourses() {
  const matrix = useCollection<CourseRow>("set_sections");
  const classes = useCollection<AcademicClass>("classes");
  const seats = useCollection<Seat>("adm_seats");
  const students = useCollection<StudentRow>("students");
  const apps = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const [edit, setEdit] = useState<string | null>(null);
  const courses = new Map<string, CourseRow[]>();
  for (const row of matrix.rows) {
    if (row.streamId && isCourseId(row.streamId)) courses.set(row.streamId, [...(courses.get(row.streamId) ?? []), row]);
  }
  const ready = [matrix, classes, seats, students, apps, offers].every((c) => c.ready);

  return (
    <div className="mb-5 space-y-3 rounded-lg border border-outline-variant/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">Senior secondary courses</h3><p className="text-sm text-on-surface-variant">Configure subjects, sections and seats for Grades 11 and 12.</p></div>
        <Button size="sm" disabled={!ready} onClick={() => setEdit("")}><Plus size={16} />Add course</Button>
      </div>
      {[...courses].map(([id, rows]) => (
        <div key={id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-surface-container-low p-3">
          <div><p className="font-semibold">{rows[0]?.stream}</p><p className="text-sm text-on-surface-variant">{[...rows].sort((a, b) => a.grade.localeCompare(b.grade)).map((row) => `${row.grade}: ${row.cap} seats`).join(" · ")}</p></div>
          <Button variant="outline" size="sm" onClick={() => setEdit(id)}>Edit {rows[0]?.stream}</Button>
        </div>
      ))}
      {edit !== null && <CourseForm key={edit} current={courses.get(edit) ?? []} existingIds={[...courses.keys()]}
        students={students.rows} held={computeSeatRows(seats.rows, apps.rows, offers.rows, students.rows)} onClose={() => setEdit(null)} />}
    </div>
  );
}

function CourseForm({ current: savedCourse, existingIds, students, held, onClose }: {
  current: CourseRow[]; existingIds: string[]; students: StudentRow[];
  held: ReturnType<typeof computeSeatRows>; onClose: () => void;
}) {
  const toast = useToast();
  const [current] = useState(savedCourse);
  const [name, setName] = useState(current[0]?.stream ?? "");
  const [draft, setDraft] = useState<Record<Grade, GradeDraft>>(() => {
    const initial = (grade: Grade) => {
      const row = current.find((r) => r.grade === `Grade ${grade}`);
      return row ? { enabled: true, subjects: (row.subjects ?? []).join("\n"), seats: (row.sectionSeats ?? [row.cap]).map(String) } : blankGrade();
    };
    return { "11": initial("11"), "12": initial("12") };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const patch = (grade: Grade, value: Partial<GradeDraft>) => setDraft((prev) => ({ ...prev, [grade]: { ...prev[grade], ...value } }));

  async function save() {
    if (busy) return;
    const title = name.trim().replace(/\s+/g, " ");
    const streamId = courseIdOf(title);
    if (!streamId || title.length < 2 || title.length > 48 || !/^[a-z0-9][a-z0-9 &'-]*$/i.test(title) || streamIdOf(title)) {
      return setError("Enter a distinct course name (2–48 characters).");
    }
    if (!current.length && existingIds.includes(streamId)) return setError("A course with this name already exists.");
    const selected = grades.filter((grade) => draft[grade].enabled);
    if (!selected.length) return setError("Choose Grade 11, Grade 12, or both.");
    const records = selected.map((grade) => {
      const input = draft[grade];
      const subjects = input.subjects.split(/[,\n]/).map((subject) => subject.trim()).filter(Boolean);
      return { grade, subjects, values: input.seats.map(Number) };
    });
    for (const record of records) {
      const { grade, subjects, values } = record;
      if (!subjects.length || subjects.length > 30 || subjects.some((subject) => subject.length > 60)) return setError(`Enter 1–30 subjects for Grade ${grade}, with names up to 60 characters.`);
      if (new Set(subjects.map((subject) => subject.toLowerCase())).size !== subjects.length) return setError(`Grade ${grade} has duplicate subjects.`);
      if (values.some((n) => !Number.isInteger(n) || n < 1 || n > 999)) return setError(`Grade ${grade} needs 1–999 seats in each section.`);
      const taken = held.find((row) => row.grade === `${grade}-${streamId}`);
      if (values.reduce((sum, n) => sum + n, 0) < Math.max(taken?.held ?? 0, taken?.rteSeats ?? 0)) return setError(`Grade ${grade} capacity cannot be below its occupied and reserved seats.`);
      for (const [index, capacity] of values.entries()) {
        if (capacity < occupancy(students, classIdOf(grade, letters[index]!, streamId))) return setError(`Grade ${grade} section ${letters[index]} already has more students than this capacity.`);
      }
    }

    setError("");
    setBusy(true);
    try {
      const stamp = createStamp();
      const sectionRefs = grades.map((grade) => schoolDoc("set_sections", `sec_grade${grade}_${streamId}`));
      const targets = records.map(({ grade, subjects, values }) => {
        const section = sectionRefs[grades.indexOf(grade)]!;
        const seat = schoolDoc("adm_seats", `seat_${grade}_${streamId}`);
        const classRows = values.map((capacity, index) => {
          const letter = letters[index]!;
          return { ref: schoolDoc("classes", classIdOf(grade, letter, streamId)), section: letter, capacity };
        });
        return { grade, subjects, values, section, seat, classRows };
      });
      await runTransaction(db, async (tx) => {
        const snapshots = await Promise.all(sectionRefs.map((ref) => tx.get(ref)));
        if (!current.length && snapshots.some((snapshot) => snapshot.exists())) throw new Error("A course with this name already exists.");
        for (const target of targets) {
          const before = current.find((row) => row.id === target.section.id);
          const saved = snapshots[grades.indexOf(target.grade)]!;
          if (saved.exists() !== !!before || (before && (
            JSON.stringify(saved.get("subjects")) !== JSON.stringify(before.subjects) ||
            JSON.stringify(saved.get("sectionSeats")) !== JSON.stringify(before.sectionSeats)
          ))) throw new Error("This course changed in another window. Reopen the editor and try again.");
          const capacity = target.values.reduce((sum, n) => sum + n, 0);
          tx.set(target.section, {
            ...stamp, id: target.section.id, grade: `Grade ${target.grade}`, stream: title, streamId,
            sections: target.classRows.map((row) => sectionLabel(target.grade, row.section, streamId)),
            subjects: target.subjects, sectionSeats: target.values, cap: capacity,
            roster: target.classRows.reduce((sum, row) => sum + occupancy(students, row.ref.id), 0),
          }, { merge: true });
          tx.set(target.seat, {
            ...stamp, id: target.seat.id, grade: `${target.grade}-${streamId}`, group: "senior", stream: title, streamId,
            capacity, ...(!before ? { rteSeats: 0, block: "" } : {}),
          }, { merge: true });
          for (const row of target.classRows) {
            tx.set(row.ref, { ...stamp, id: row.ref.id, grade: target.grade, section: row.section, stream: title, streamId, capacity: row.capacity, subjects: target.subjects }, { merge: true });
          }
        }
      });
      toast("Course saved");
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the course. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open width="max-w-2xl" onClose={() => { if (!busy) onClose(); }} title={current.length ? `Edit ${name}` : "Add course"}
      footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save course"}</Button></>}>
      <div className="space-y-4">
        <Field label="Course name" required><Input value={name} disabled={!!current.length || busy} onChange={(e) => setName(e.target.value)} placeholder="Home Science" /></Field>
        {grades.map((grade) => {
          const value = draft[grade];
          const saved = current.find((row) => row.grade === `Grade ${grade}`);
          return <fieldset key={grade} className="space-y-3 rounded-lg border border-outline-variant/60 p-3" disabled={busy}>
            <label className="flex items-center gap-2 font-semibold"><Checkbox checked={value.enabled} disabled={!!saved} onChange={(e) => patch(grade, { enabled: e.target.checked })} />Grade {grade}</label>
            {value.enabled && <>
              <Field label={`Grade ${grade} subjects`} required hint="Enter one subject per line, or separate them with commas."><Textarea value={value.subjects} onChange={(e) => patch(grade, { subjects: e.target.value })} rows={3} /></Field>
              <div className="grid grid-cols-2 gap-3">{value.seats.map((count, index) => <Field key={letters[index]} label={`Grade ${grade} section ${letters[index]} seats`} required>
                <Input type="number" min={1} max={999} value={count} onChange={(e) => patch(grade, { seats: value.seats.map((n, i) => i === index ? e.target.value : n) })} />
              </Field>)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" disabled={value.seats.length >= letters.length} onClick={() => patch(grade, { seats: [...value.seats, "30"] })}>Add Grade {grade} section</Button>
                {value.seats.length > (saved?.sectionSeats?.length ?? 1) && <Button variant="ghost" size="sm" onClick={() => patch(grade, { seats: value.seats.slice(0, -1) })}>Remove last new section</Button>}
              </div>
            </>}
          </fieldset>;
        })}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </div>
    </Modal>
  );
}
