"use client";
// Settings → Classes & Sections → Add grade: total seats, section allocation, then subjects.
import { useState } from "react";
import { runTransaction } from "firebase/firestore";
import { X } from "lucide-react";
import { Button, Field, Input, Select, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { normalizeSubjects, subjectKey, subjectName, subjectSettingsId, useSchoolSubjects } from "@/lib/schoolSubjects";
import { db } from "@/lib/firebase";
import { isSeniorGrade } from "@/lib/academicStreams";
import { CLASS_GRADES } from "@/features/ops/shared";
import { gradeName } from "@/features/onboarding/classSetup";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import type { Application, Offer, Seat } from "@/features/admissions/types";
import type { StudentRow } from "@/features/admissions/logic";
import { GRADE_STEPS, gradeRoomsError, gradeStepError, SECTION_LETTERS, sectionDocId, splitGradeSeats, totalCap, type GradeDraft, type GradeStep, type SectionRow } from "./gradeSetup";
import { saveRegularGrade } from "./saveRegularGrade";

const NEW_SUBJECT = "__new__";
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");
const formatName = (value: string) => subjectName(value).split(" ").map((word) =>
  word === word.toLowerCase() ? word.replace(/\p{L}/u, (letter) => letter.toUpperCase()) : word,
).join(" ");

export function AddGradeDrawer({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (sectionId: string, label: string) => void }) {
  if (!open) return null;
  return <Drawer onClose={onClose} onCreated={onCreated} />;
}

function Drawer({ onClose, onCreated }: { onClose: () => void; onCreated: (sectionId: string, label: string) => void }) {
  const toast = useToast();
  const sections = useCollection<SectionRow>("set_sections");
  const classes = useCollection<{ id: string; room?: string }>("classes");
  const students = useCollection<StudentRow>("students");
  const seats = useCollection<Seat>("adm_seats");
  const applications = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const catalog = useSchoolSubjects();
  const ready = sections.ready && classes.ready && students.ready && seats.ready && applications.ready && offers.ready && catalog.ready;
  const configured = new Set(sections.rows.map((row) => row.id));
  const free = CLASS_GRADES.filter((grade) => !isSeniorGrade(grade) && !configured.has(sectionDocId(grade)));
  const [step, setStep] = useState<GradeStep>(1);
  const [draft, setDraft] = useState<GradeDraft>({ grade: free[0] ?? "", streamId: "", totalSeats: 40, letters: ["A"], caps: { A: 40 }, subjects: [] });
  const [pick, setPick] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<GradeDraft>) => { setDraft((current) => ({ ...current, ...patch })); setError(""); };
  const title = draft.grade ? gradeName(draft.grade) : "New grade";
  const available = catalog.subjects.filter((subject) => subject.active && !draft.subjects.some((name) => subjectKey(name) === subjectKey(subject.name)));
  const sum = totalCap(draft.letters, draft.caps);

  function addSubject(name: string) {
    setDraft((current) => current.subjects.some((subject) => subjectKey(subject) === subjectKey(name))
      ? current : { ...current, subjects: [...current.subjects, name] });
    setPick(""); setError("");
  }

  async function addNewSubject() {
    if (busy || !ready) return;
    const clean = formatName(newSubject);
    if (!clean || clean.length > 120) return setError("Enter a subject name up to 120 characters.");
    setBusy(true); setError("");
    try {
      const ref = schoolDoc("set_config", subjectSettingsId);
      const result = await runTransaction(db, async (tx) => {
        const snapshot = await tx.get(ref);
        const list = normalizeSubjects(snapshot.get("subjects") ?? catalog.subjects);
        const known = list.find((subject) => subjectKey(subject.name) === subjectKey(clean));
        if (known) {
          if (!known.active) throw new Error("This subject is inactive. Choose another subject.");
          return { name: known.name, created: false };
        }
        list.push({ id: crypto.randomUUID(), name: clean, active: true, departmentIds: [], aliasIds: [] });
        tx.set(ref, { id: subjectSettingsId, subjects: list, departments: snapshot.get("departments") ?? catalog.departments, ...createStamp() }, { merge: true });
        return { name: clean, created: true };
      });
      addSubject(result.name);
      setNewSubject("");
      if (result.created) toast(result.name + " added to the subject list");
    } catch (cause) {
      setError("Could not add the subject: " + errText(cause));
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (busy || !ready) return;
    const problem = gradeStepError(step, draft, sections.rows) || (step === 2 ? gradeRoomsError(draft, classes.rows) : "");
    setError(problem);
    if (!problem && step < 3) setStep((step + 1) as GradeStep);
  }

  async function create() {
    if (busy || !ready) return;
    for (const candidate of [1, 2, 3] as const) {
      const problem = gradeStepError(candidate, draft, sections.rows) || (candidate === 2 ? gradeRoomsError(draft, classes.rows) : "");
      if (problem) { setStep(candidate); setError(problem); return; }
    }
    setBusy(true); setError("");
    try {
      const row = await saveRegularGrade(draft, { students: students.rows, seats: seats.rows, applications: applications.rows, offers: offers.rows, classes: classes.rows });
      toast(title + " created");
      onCreated(row.id, title);
    } catch (cause) {
      setError("Could not create the grade: " + errText(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Add grade">
      <button type="button" aria-label="Close" className="flex-1 bg-scrim/40" onClick={() => !busy && onClose()} />
      <aside className="flex h-full w-full max-w-lg flex-col bg-surface shadow-xl">
        <header className="flex items-start justify-between gap-3 border-b border-outline-variant/60 px-5 py-4">
          <div><h2 className="text-lg font-semibold">Add grade</h2><p className="text-sm text-on-surface-variant">Set total seats, divide them into sections, then add subjects.</p></div>
          <Button variant="ghost" aria-label="Close drawer" disabled={busy} onClick={onClose}><X size={16} /></Button>
        </header>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="Steps">
            {GRADE_STEPS.map((label, index) => <li key={label} aria-current={index + 1 === step ? "step" : undefined}
              className={"rounded-md border px-3 py-2 " + (index + 1 === step ? "border-secondary bg-info-container text-secondary" : "border-outline-variant/60 text-on-surface-variant")}>
              <span className="font-semibold">Step {index + 1}</span> · {label}
            </li>)}
          </ol>
          <fieldset disabled={busy || !ready} className="space-y-5">
            {step === 1 && <>
              <p className="text-xs text-outline">Grades 11 and 12 are added as departments from the Senior Secondary block.</p>
              <Field label="Grade" required>
                <Select value={free.includes(draft.grade) ? draft.grade : ""} onChange={(e) => set({ grade: e.target.value })}>
                  <option value="">{free.length ? "Choose a grade…" : "Every grade is configured"}</option>
                  {free.map((grade) => <option key={grade} value={grade}>{gradeName(grade)}</option>)}
                </Select>
              </Field>
              <Field label="Total seats" required hint="Split this capacity over the sections in the next step.">
                <Input type="number" min={1} step={1} value={draft.totalSeats ?? ""}
                  onChange={(e) => { const totalSeats = Number(e.target.value); set({ totalSeats, ...splitGradeSeats(totalSeats, draft.letters.length) }); }} />
              </Field>
            </>}
            {step === 2 && <>
              <p className="text-sm text-on-surface-variant">{title} · {draft.totalSeats} total seats. Set the seats and optional room number for each section.</p>
              <Field label="Sections" required hint="1 to 8. Changing the count divides the total evenly as a starting point.">
                <Select value={draft.letters.length} onChange={(e) => set(splitGradeSeats(draft.totalSeats ?? 0, Number(e.target.value)))}>
                  {SECTION_LETTERS.map((_, index) => <option key={index + 1} value={index + 1}>{index + 1} section{index ? "s" : ""}</option>)}
                </Select>
              </Field>
              <div className="space-y-3">
                {draft.letters.map((letter) => <div key={letter} className="grid grid-cols-2 gap-3">
                  <Field label={`Section ${letter} seats`} required>
                    <Input type="number" min={1} step={1} value={draft.caps[letter] ?? ""} onChange={(e) => set({ caps: { ...draft.caps, [letter]: Number(e.target.value) } })} />
                  </Field>
                  <Field label={`Section ${letter} room number`} hint="Optional">
                    <Input maxLength={20} value={draft.rooms?.[letter] ?? ""} placeholder="e.g. 204"
                      onChange={(e) => set({ rooms: { ...draft.rooms, [letter]: e.target.value } })} />
                  </Field>
                </div>)}
              </div>
              <p role="status" className={"text-sm " + (sum === draft.totalSeats ? "text-on-surface-variant" : "text-warning")}>
                Sections add up to {sum} of {draft.totalSeats} seats{sum !== draft.totalSeats ? " · adjust so they match" : ""}.
              </p>
            </>}
            {step === 3 && <section aria-label={`${title} subjects`} className="space-y-4">
              <p className="text-sm text-on-surface-variant">{title} · {draft.letters.length} section{draft.letters.length === 1 ? "" : "s"} · {draft.totalSeats} seats.</p>
              <p className="text-sm text-on-surface-variant">Choose the subjects taught in this grade. New subjects are saved to the shared subject list so other grades can use them too.</p>
              <p className="text-sm font-medium">Subjects · {draft.subjects.length} selected</p>
              {draft.subjects.length ? <ul className="flex flex-wrap gap-2">
                {draft.subjects.map((subject) => <li key={subject} className="inline-flex items-center gap-1 rounded border border-outline-variant bg-surface-container-low px-2 py-1 text-sm">{subject}
                  <button type="button" aria-label={`Remove ${subject} from ${title}`} className="text-outline hover:text-error"
                    onClick={() => set({ subjects: draft.subjects.filter((name) => name !== subject) })}>×</button>
                </li>)}
              </ul> : <p className="text-sm text-on-surface-variant">No subjects yet. Add at least one to continue.</p>}
              <Field label={`Add subject to ${title}`}>
                <Select value={pick} onChange={(e) => { const value = e.target.value; setPick(value); setError(""); if (value && value !== NEW_SUBJECT) addSubject(value); }}>
                  <option value="">Choose a subject…</option>
                  {available.map((subject) => <option key={subject.name} value={subject.name}>{subject.name}</option>)}
                  <option value={NEW_SUBJECT}>+ Add a new subject…</option>
                </Select>
              </Field>
              {pick === NEW_SUBJECT && <div className="flex flex-wrap items-end gap-2">
                <Field label="New subject name" className="min-w-40 flex-1"><Input value={newSubject} maxLength={120} onChange={(e) => setNewSubject(e.target.value)} placeholder="Environmental Studies" /></Field>
                <Button variant="outline" onClick={addNewSubject}>Add subject</Button>
              </div>}
            </section>}
          </fieldset>
          {error && <p role="alert" className="text-sm text-error">{error}</p>}
        </div>
        <footer className="flex items-center justify-end gap-2 border-t border-outline-variant/60 px-5 py-3">
          <Button variant="ghost" disabled={busy} onClick={onClose}>Cancel</Button>
          {step > 1 && <Button variant="outline" disabled={busy} onClick={() => { setError(""); setStep((step - 1) as GradeStep); }}>Back</Button>}
          {step < 3 ? <Button disabled={busy || !ready || !free.length} onClick={next}>Next</Button>
            : <Button disabled={busy || !ready} onClick={create}>{busy ? "Creating…" : "Create grade"}</Button>}
        </footer>
      </aside>
    </div>
  );
}
