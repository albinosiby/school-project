"use client";
// /settings/grades/[gradeId]: one grade (or senior stream) from Settings → Classes & Sections: its sections with
// class records and teachers, capacity, and subjects with the teacher assigned in each section.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, School, Trash2 } from "lucide-react";
import { LoadingSkeleton, Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, Stat, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { subjectKey } from "@/lib/schoolSubjects";
import { labelToClassId } from "@/lib/academicStreams";
import { schemeId, type SubjectScheme } from "@/features/exams/assessmentScheme";
import { classDetailsHref } from "@/features/ops/classDetails";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { activeStudent, studentClassId } from "@/features/ops/shared";
import type { Application, Offer, Seat as SeatRow } from "@/features/admissions/types";
import { DepartmentForm } from "./DepartmentForm";
import { capsError, gradeOfLabel, groupKeyOf, SECTION_LETTERS, totalCap, type Caps, type SectionRow } from "./gradeSetup";
import { saveRegularGrade, type ClassLink } from "./saveRegularGrade";
import { SubjectTeacherCell } from "./SubjectTeacherCell";
import type { SubjectTeacher } from "./subjectTeacherAssignment";

type ClassRow = { id: string; grade: string; section: string; classTeacherId?: string; classTeacher?: string; room?: string; capacity?: number };
type Student = StudentRow;
type Staff = SubjectTeacher;
type SectionRowWithHod = SectionRow & { hod?: string; subjects?: string[] };
type Assignment = { id: string; classId: string; subject?: string; teacherId?: string; teacher?: string };
type PeriodRow = ClassLink;
type Seat = { id: string; grade?: string; streamId?: string };

export function GradeDetailsView({ gradeId }: { gradeId: string }) {
  const toast = useToast();
  const sections = useCollection<SectionRowWithHod>("set_sections");
  const classes = useCollection<ClassRow>("classes");
  const students = useCollection<Student>("students");
  const staff = useCollection<Staff>("staff");
  const schemes = useCollection<SubjectScheme>("set_subject_schemes");
  const assignments = useCollection<Assignment>("assignments");
  const periods = useCollection<PeriodRow>("ops_periods");
  const seats = useCollection<Seat & SeatRow>("adm_seats");
  const apps = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(false);
  const [removing, setRemoving] = useState(false);
  const back = <Link href="/settings?section=capacity" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline"><ArrowLeft size={16} aria-hidden="true" />Back to Classes &amp; Sections</Link>;
  const row = sections.rows.find((item) => item.id === gradeId);
  if (!sections.ready || !classes.ready || !students.ready || !staff.ready || !schemes.ready || !assignments.ready)
    return <div>{back}<LoadingSkeleton variant="details" label="Loading grade…" /></div>;
  if (!row) return <div>{back}<Card><EmptyState title="Grade not found" hint="It may have been removed from Classes & Sections." /></Card></div>;
  const grade = gradeOfLabel(row.grade);
  const key = groupKeyOf(row);
  const title = row.grade + (row.streamId ? " · " + row.stream : "");
  const active = students.rows.filter(activeStudent);
  const capacityReady = seats.ready && apps.ready && offers.ready && assignments.ready && periods.ready;
  const rows = (row.sections ?? []).map((label) => {
    const classId = labelToClassId(label);
    const cls = classes.rows.find((item) => item.id === classId);
    const count = active.filter((student) => (student.classId ?? labelToClassId(`${student.grade}-${student.section}`)) === classId).length;
    return { label, classId, cls, count, teacher: staff.rows.find((member) => member.id === cls?.classTeacherId)?.name || cls?.classTeacher || "" };
  });
  const roster = rows.reduce((sum, item) => sum + item.count, 0);
  const saved = schemes.rows.find((scheme) => scheme.id === schemeId(key));
  // Setup supplies the subjects; older grades can use their existing scheme as a fallback.
  const subjects = row.subjects?.length ? row.subjects : (saved?.subjects.map((subject) => subject.subject) ?? []);
  return <div className="min-w-0">
    {back}
    <Card className="mb-5 flex flex-wrap items-center gap-5 p-5 sm:p-6">
      <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-info-container text-secondary"><School size={30} aria-hidden="true" /></div>
      <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">Grade details</p>
        <h1 className="t-headline-lg break-words">{title}</h1>
        <p className="mt-2 text-sm text-on-surface-variant">{row.streamId ? `Senior secondary department${row.hod ? " · HOD " + row.hod : ""}` : row.stream || "Grade"} · {rows.length} section{rows.length === 1 ? "" : "s"}</p></div>
      <div className="flex flex-wrap gap-2">
        {row.streamId ? <Button variant="outline" disabled={!seats.ready || !apps.ready || !offers.ready} onClick={() => setEditingDepartment(true)}><Pencil size={15} />Edit department</Button>
          : <Button variant="outline" disabled={!capacityReady} onClick={() => setEditing(true)}>Edit sections and capacity</Button>}
        <Button variant="danger" onClick={() => setRemoving(true)}><Trash2 size={15} />{row.streamId ? "Remove department" : "Remove grade"}</Button>
      </div>
    </Card>
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <Stat label="Sections" value={rows.length} />
      <Stat label="Students" value={roster} sub={`of ${row.cap} seats`} />
      <Stat label="Subjects" value={subjects.length} subTone={subjects.length ? "success" : "warning"}
        sub={subjects.length ? undefined : row.streamId ? "None in the department" : "None configured"} />
    </div>
    <Card className="mb-5">
      <CardHeader title="Sections" subtitle="Each section is a class with its own teacher and roster." />
      <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Sections">
        <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Section</th><th className="p-3">Class teacher</th><th className="p-3">Students / capacity</th><th className="p-3">Room</th><th className="p-3" /></tr></thead>
        <tbody>{rows.map((item) => <tr key={item.label} className="border-t border-outline-variant/50">
          <td className="p-3 font-semibold">{item.label}{!item.cls && <Badge tone="warning" className="ml-2">No class record</Badge>}</td>
          <td className="p-3">{item.teacher || <span className="text-on-surface-variant">Not assigned</span>}</td>
          <td className="p-3 font-mono">{item.count} / {item.cls?.capacity ?? "—"}</td>
          <td className="p-3">{item.cls?.room || "—"}</td>
          <td className="p-3 text-right">{item.cls && <Link href={classDetailsHref(item.classId)} className="text-sm font-semibold text-secondary hover:underline">Open class</Link>}</td>
        </tr>)}</tbody></table></div>
    </Card>
    <Card>
      <CardHeader title="Subjects and teachers" subtitle="Choose a teacher for each subject and division. Only teaching staff with that subject in their profile are listed. Changes save automatically." />
      {subjects.length ? <div className="overflow-x-auto"><table className="w-full text-left text-sm" aria-label="Subjects and teachers">
        <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Subject</th>{rows.map((item) => <th key={item.label} className="p-3">{item.label}</th>)}</tr></thead>
        <tbody>{subjects.map((subject) => <tr key={subject} className="border-t border-outline-variant/50">
          <td className="p-3 font-semibold">{subject}</td>
          {rows.map((item) => <td key={item.label} className="p-3 align-top"><SubjectTeacherCell
            section={row} classId={item.classId} label={item.label} subject={subject} staff={staff.rows} classExists={!!item.cls}
            assignments={assignments.rows.filter((assignment) => assignment.classId === item.classId && subjectKey(assignment.subject ?? "") === subjectKey(subject))} /></td>)}
        </tr>)}</tbody></table></div>
        : <p className="px-5 pb-5 text-sm text-on-surface-variant">{row.streamId
          ? <>No subjects yet. Add them from Edit {row.stream} under Classes &amp; Sections.</>
          : "No subjects configured for this grade yet."}</p>}
    </Card>
    {editingDepartment && row.streamId && <DepartmentForm current={sections.rows.filter((item) => item.streamId === row.streamId)} students={students.rows}
      existingIds={[...new Set(sections.rows.map((item) => item.streamId).filter((id): id is string => !!id))]}
      held={computeSeatRows(seats.rows, apps.rows, offers.rows, students.rows)} onClose={() => setEditingDepartment(false)} />}
    {removing && <RemoveStream title={title} kind={row.streamId ? "department" : "grade"} classIds={rows.map((item) => item.classId)}
      counts={{ sections: rows.length, students: roster, assignments: assignments.rows.filter((item) => rows.some((r) => r.classId === item.classId)).length,
        periods: periods.rows.filter((item) => rows.some((r) => r.classId === studentClassId(item))).length }}
      onClose={() => setRemoving(false)}
      onConfirm={async () => {
        const ids = new Set(rows.map((item) => item.classId));
        for (const student of active.filter((item) => ids.has(item.classId ?? labelToClassId(`${item.grade}-${item.section}`))))
          await students.update(student.id, { deleted: true, deletedReason: (row.streamId ? "Department removed: " : "Grade removed: ") + title } as Partial<Student>);
        for (const item of assignments.rows.filter((item) => ids.has(item.classId))) await assignments.remove(item.id);
        for (const item of periods.rows.filter((item) => ids.has(studentClassId(item)))) await periods.remove(item.id);
        for (const seat of seats.rows.filter((seat) => (row.streamId ? seat.streamId === row.streamId && String(seat.grade ?? "").startsWith(grade) : !seat.streamId && String(seat.grade ?? "") === grade))) await seats.remove(seat.id);
        for (const item of rows) if (item.cls) await classes.remove(item.classId);
        if (saved) await schemes.remove(saved.id);
        await sections.remove(row.id);
        toast(title + " removed");
        router.push("/settings?section=capacity");
      }} />}
    {editing && <EditSections row={row} grade={grade} rows={rows.map((item) => ({ ...item, capacity: item.cls?.capacity }))} onClose={() => setEditing(false)}
      onSave={async (letters, caps, original) => {
        if (!capacityReady) throw new Error("Wait for admissions and timetable data to load before saving.");
        await saveRegularGrade({ grade, streamId: "", letters, caps, subjects: [] }, {
          students: students.rows, seats: seats.rows, applications: apps.rows, offers: offers.rows,
          assignments: assignments.rows, periods: periods.rows,
        }, original);
        toast("Sections and capacity saved");
        setEditing(false);
      }} />}
  </div>;
}

/** section letter of a label like "9-A" or "11-Science-B" */
const letterOf = (label: string) => label.slice(label.lastIndexOf("-") + 1).toUpperCase();

function EditSections({ row, grade, rows, onClose, onSave }: {
  row: SectionRow; grade: string; rows: { label: string; count: number; capacity?: number }[]; onClose: () => void; onSave: (letters: string[], caps: Caps, original: SectionRow) => Promise<void>;
}) {
  const [original] = useState(row);
  const current = (row.sections ?? []).map(letterOf);
  const fallback = Math.max(1, Math.round(row.cap / Math.max(1, current.length)));
  const [letters, setLetters] = useState(current);
  const [caps, setCaps] = useState<Caps>(() => Object.fromEntries(current.map((letter) => [letter, rows.find((item) => letterOf(item.label) === letter)?.capacity || fallback])));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");
  async function save() {
    if (busy) return;
    const problem = capsError(letters, caps);
    if (problem) return setError(problem);
    const occupied = rows.find((item) => item.count > 0 && !letters.includes(letterOf(item.label)));
    if (occupied) return setError(`${occupied.label} still has ${occupied.count} student${occupied.count === 1 ? "" : "s"}. Move them before removing the section.`);
    const tooSmall = rows.find((item) => letters.includes(letterOf(item.label)) && caps[letterOf(item.label)] < item.count);
    if (tooSmall) return setError(`Capacity of section ${letterOf(tooSmall.label)} cannot be below its ${tooSmall.count} enrolled students.`);
    setError(""); setBusy(true);
    try { await onSave([...letters].sort(), caps, original); } catch (cause) { setError("Could not save: " + errText(cause)); } finally { setBusy(false); }
  }
  return <Modal open onClose={() => !busy && onClose()} title="Edit sections and capacity" subtitle={row.grade + (row.streamId ? " · " + row.stream : "")}
    footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button></>}>
    <fieldset disabled={busy} className="space-y-4">
      <ul className="space-y-2">
        {SECTION_LETTERS.map((letter) => {
          const on = letters.includes(letter);
          const seated = rows.find((item) => letterOf(item.label) === letter)?.count ?? 0;
          return <li key={letter} className="flex items-center gap-3">
            <button type="button" aria-pressed={on} aria-label={"Section " + letter}
              onClick={() => { setLetters(on ? letters.filter((item) => item !== letter) : [...letters, letter]); if (!on && !caps[letter]) setCaps({ ...caps, [letter]: fallback }); setError(""); }}
              className={"h-9 w-10 shrink-0 rounded border text-sm font-medium " + (on ? "border-secondary bg-info-container text-secondary" : "border-outline-variant bg-surface-container-lowest")}>{letter}</button>
            {on ? <>
              <Input type="number" min={1} aria-label={"Capacity for section " + letter} className="!w-28" value={caps[letter] ?? ""} onChange={(e) => { setCaps({ ...caps, [letter]: Number(e.target.value) }); setError(""); }} />
              <span className="text-xs text-outline">seats{seated ? ` · ${seated} enrolled` : ""}</span>
            </> : <span className="text-xs text-outline">Not offered</span>}
          </li>;
        })}
      </ul>
      <p className="text-xs text-outline">Admissions capacity follows the total below. Removing an empty section also removes its class, teacher assignments and weekly timetable.</p>
      <p className="text-sm text-on-surface-variant">{letters.length} section{letters.length === 1 ? "" : "s"} · {totalCap(letters, caps)} seats in Grade {grade}</p>
      {error && <p role="alert" className="text-sm text-error">{error}</p>}
    </fieldset>
  </Modal>;
}

function RemoveStream({ title, kind, classIds, counts, onClose, onConfirm }: {
  title: string; kind: "department" | "grade"; classIds: string[]; counts: { sections: number; students: number; assignments: number; periods: number };
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ready = typed.trim().toLowerCase() === title.trim().toLowerCase();
  async function confirm() {
    setBusy(true); setError("");
    try { await onConfirm(); } catch (cause) { setError(`Could not remove the ${kind}: ` + (cause instanceof Error ? cause.message : "Unknown error")); setBusy(false); }
  }
  return <Modal open onClose={() => !busy && onClose()} title={"Remove " + title + "?"} subtitle="This cannot be undone from the dashboard."
    footer={<><Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" disabled={busy || !ready} onClick={confirm}>{busy ? "Removing…" : `Remove ${kind}`}</Button></>}>
    <div className="space-y-3 text-sm">
      <p>Removing this {kind} deletes:</p>
      <ul className="list-inside list-disc space-y-1">
        <li>{counts.sections} section{counts.sections === 1 ? "" : "s"} ({classIds.join(", ")}) and their class records</li>
        <li>{counts.students} student{counts.students === 1 ? "" : "s"}, marked as removed (hidden everywhere, restorable by an administrator)</li>
        <li>{counts.assignments} teacher assignment{counts.assignments === 1 ? "" : "s"} and {counts.periods} timetable period{counts.periods === 1 ? "" : "s"}</li>
        <li>Admission seats and the subject scheme of this {kind}</li>
      </ul>
      <p className="text-on-surface-variant">Fee, attendance and exam records of the students are kept for reference.</p>
      <Field label={`Type "${title}" to confirm`} required><Input value={typed} onChange={(e) => setTyped(e.target.value)} /></Field>
      {error && <p role="alert" className="text-error">{error}</p>}
    </div>
  </Modal>;
}
