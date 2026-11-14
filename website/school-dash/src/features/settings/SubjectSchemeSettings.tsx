"use client";
// Settings → Assessment Scheme → Subject schemes (`set_subject_schemes`). Per class group (Grade 9, Grade 11 ·
// Science…): the subjects assessed, their components and pass marks, and who enters each. The exam wizard
// pre-fills its Subjects & Assessment step from the scheme of every selected class group.
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Field, Input, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useSchoolSubjects } from "@/lib/schoolSubjects";
import type { AcademicClass } from "@/lib/academicStreams";
import { classGroups, ENTERED_BY, enteredByLabel, newScheme, newSchemeSubject, schemeError, schemeId, type SchemeSubject, type SubjectScheme } from "@/features/exams/assessmentScheme";

const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");

export function SubjectSchemeSettings() {
  const schemes = useCollection<SubjectScheme>("set_subject_schemes");
  const classes = useCollection<AcademicClass>("classes");
  const catalog = useSchoolSubjects();
  const [picked, setPicked] = useState("");
  if (!schemes.ready || !classes.ready || !catalog.ready) return <p className="text-sm text-on-surface-variant">Loading subject schemes…</p>;
  const groups = classGroups(classes.rows);
  const group = groups.find((row) => row.key === picked) ?? groups[0];
  if (!group) return <section aria-label="Subject schemes"><h3 className="font-semibold">Subject schemes</h3><p className="text-sm text-on-surface-variant">Configure classes and sections first. Each class group then gets its own subject scheme here.</p></section>;
  const saved = schemes.rows.find((row) => row.id === schemeId(group.key));
  return <section className="space-y-4" aria-label="Subject schemes">
    <div><h3 className="font-semibold">Subject schemes</h3>
      <p className="text-sm text-on-surface-variant">Which subjects each class group is assessed in, the theory / practical / internal split, pass marks and who enters the marks. Set once a year; every exam starts from it.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <Field label="Class group" className="min-w-56"><Select value={group.key} onChange={(e) => setPicked(e.target.value)}>
        {groups.map((row) => <option key={row.key} value={row.key}>{row.title}{schemes.rows.some((scheme) => scheme.id === schemeId(row.key)) ? "" : " · no scheme yet"}</option>)}</Select></Field>
    </div>
    <SchemeEditor key={group.key} initial={saved ?? newScheme(group.key)} exists={!!saved} title={group.title} managedBy={group.key.includes(":") && group.key.split(":")[1] ? "its department" : undefined}
      subjects={catalog.subjects.filter((subject) => subject.active).map((subject) => subject.name)}
      onSave={(scheme) => (saved ? schemes.update(scheme.id, scheme) : schemes.create(scheme))} />
  </section>;
}

/** `managedBy`: where the subject list is set (e.g. the department form); the editor then only adjusts marks for the subjects it has. */
export function SchemeEditor({ initial, exists, title, subjects, managedBy, onSave }: {
  initial: SubjectScheme; exists: boolean; title: string; subjects: string[]; managedBy?: string;
  onSave: (scheme: SubjectScheme) => Promise<unknown>;
}) {
  const toast = useToast();
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(!exists && initial.subjects.length > 0);
  const edit = (next: SubjectScheme) => { setDraft(next); setDirty(true); };
  const update = (index: number, patch: Partial<SchemeSubject>) => edit({ ...draft, subjects: draft.subjects.map((row, i) => (i === index ? { ...row, ...patch } : row)) });
  const available = subjects.filter((subject) => !draft.subjects.some((row) => row.subject.toLowerCase() === subject.toLowerCase()));
  const number = (index: number, row: SchemeSubject, key: "theory" | "practical" | "internal" | "passMarks" | "theoryPass" | "practicalPass" | "internalPass" | "weight", label: string) => (
    <Field key={key} label={label}><Input type="number" min={0} value={row[key]} onChange={(e) => update(index, { [key]: Number(e.target.value) })} /></Field>
  );
  const save = async () => {
    const problem = draft.subjects.length ? schemeError(draft) : "Add at least one subject";
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      const clean: SubjectScheme = { ...draft, subjects: draft.subjects.map((row) => ({ ...row, subject: row.subject.trim(), code: row.code.trim(), gradeOptions: row.gradeOptions.map((grade) => grade.trim()).filter(Boolean) })), coScholastic: draft.coScholastic.map((area) => area.trim()).filter(Boolean) };
      await onSave(clean);
      setDraft(clean); setDirty(false);
      toast(title + " scheme saved");
    } catch (cause) {
      setError("Could not save: " + errText(cause));
    } finally {
      setBusy(false);
    }
  };
  return <fieldset disabled={busy} className="space-y-4 rounded-lg border border-outline-variant/60 p-4" aria-label={title + " scheme"}>
    <div className="flex flex-wrap items-end gap-3">
      {managedBy ? <p className="text-sm text-on-surface-variant">Subjects of {title} are set in {managedBy}. Adjust the marks split and pass marks here.</p>
        : <Field label={"Add subject to " + title} className="min-w-56"><Select value="" onChange={(e) => { if (e.target.value) edit({ ...draft, subjects: [...draft.subjects, newSchemeSubject(e.target.value)] }); }}>
          <option value="">Select subject…</option>{available.map((subject) => <option key={subject}>{subject}</option>)}</Select></Field>}
      {!managedBy && !subjects.length && <p className="text-sm">Add subjects while setting up a grade or department under Settings → Classes &amp; Sections.</p>}
    </div>
    {!draft.subjects.length && <p className="text-sm text-on-surface-variant">No subjects in this scheme yet.</p>}
    {draft.subjects.map((row, index) => <section key={index} aria-label={row.subject + " scheme row"} className="space-y-3 rounded-lg bg-surface-container-low p-3">
      <div className="flex items-center justify-between gap-3"><h4 className="font-semibold">{row.subject}</h4>
        <Button variant="ghost" aria-label={"Remove " + row.subject} onClick={() => edit({ ...draft, subjects: draft.subjects.filter((_, i) => i !== index) })}><Trash2 size={15} /></Button></div>
      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <Field label="Subject code"><Input value={row.code} onChange={(e) => update(index, { code: e.target.value })} /></Field>
        <Field label="Assessment"><Select value={row.mode} onChange={(e) => update(index, { mode: e.target.value as SchemeSubject["mode"] })}><option value="marks">Marks</option><option value="grade">Grade only</option></Select></Field>
        <Field label="Entered by"><Select value={row.enteredBy} onChange={(e) => update(index, { enteredBy: e.target.value as SchemeSubject["enteredBy"] })}>{ENTERED_BY.map((who) => <option key={who} value={who}>{enteredByLabel[who]}</option>)}</Select></Field>
        <Field label="Duration (minutes)"><Input type="number" min={1} max={360} value={Math.round(row.duration * 60)} onChange={(e) => update(index, { duration: Number(e.target.value) / 60 })} /></Field>
        {row.mode === "marks" ? <>
          {number(index, row, "theory", "Theory maximum")}{number(index, row, "practical", "Practical maximum")}{number(index, row, "internal", "Internal maximum")}{number(index, row, "passMarks", "Pass marks")}
          <p className="self-center text-sm">Maximum: {row.theory + row.practical + row.internal}</p>
          {number(index, row, "theoryPass", "Theory pass (optional)")}{number(index, row, "practicalPass", "Practical pass (optional)")}{number(index, row, "internalPass", "Internal pass (optional)")}
        </> : <Field label="Grades or descriptors" hint="One per line" className="sm:col-span-2"><Textarea value={row.gradeOptions.join("\n")} onChange={(e) => update(index, { gradeOptions: e.target.value.split("\n") })} /></Field>}
        {number(index, row, "weight", "Result weight")}
      </div>
    </section>)}
    <Field label="Co-scholastic areas" hint="Comma separated; graded on report cards, not examined"><Input value={draft.coScholastic.join(", ")} onChange={(e) => edit({ ...draft, coScholastic: e.target.value.split(",") })} /></Field>
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <Button disabled={busy || !dirty} onClick={save}><Plus size={14} />{busy ? "Saving…" : exists ? "Save scheme" : "Create scheme"}</Button>
  </fieldset>;
}
