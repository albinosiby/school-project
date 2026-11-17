"use client";

import { useState, type FormEvent } from "react";
import { runTransaction } from "firebase/firestore";
import { LoadingSkeleton, Badge, Button, Checkbox, Field, Input, Modal, useToast } from "@/components/ui";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { db } from "@/lib/firebase";
import { normalizeSubjects, subjectCatalogId, subjectKey, subjectName, subjectSettingsId, useSchoolSubjects, type SchoolDepartment, type SchoolSubject } from "@/lib/schoolSubjects";

const maxSubjectLength = 120;

const formatName = (value: string) => subjectName(value).split(" ").map((word) =>
  word === word.toLowerCase() ? word.replace(/\p{L}/u, (letter) => letter.toUpperCase()) : word,
).join(" ");

class SubjectChangeError extends Error {}

export function SubjectSettings() {
  const { subjects, departments, ready } = useSchoolSubjects();
  const [editing, setEditing] = useState<SchoolSubject>();
  const [deleting, setDeleting] = useState<SchoolSubject>();
  const [name, setName] = useState("");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const toast = useToast();

  function reset() {
    setEditing(undefined);
    setName("");
    setDepartmentIds([]);
    setError("");
  }

  function closeDelete() {
    if (busy) return;
    setDeleting(undefined);
    setError("");
  }

  async function saveSubject(next: SchoolSubject | null, previous?: SchoolSubject) {
    setBusy(true);
    setError("");
    try {
      const ref = schoolDoc("set_config", subjectSettingsId);
      await runTransaction(db, async (transaction) => {
        const snapshot = await transaction.get(ref);
        const current = normalizeSubjects(snapshot.get("subjects") ?? subjects);
        const index = previous ? current.findIndex((subject) => JSON.stringify(subject) === JSON.stringify(previous)) : -1;
        if (index < 0 && (previous || !next)) throw new SubjectChangeError("This subject changed. Close this action and try again.");
        if (next && current.some((subject, i) => i !== index && subjectKey(subject.name) === subjectKey(next.name))) {
          throw new SubjectChangeError("A subject with this name already exists.");
        }
        const currentDepartments = (snapshot.get("departments") as SchoolDepartment[] | undefined) ?? [];
        if (next?.departmentIds?.some((departmentId) => !currentDepartments.some(({ id }) => id === departmentId))) {
          throw new SubjectChangeError("Choose available departments.");
        }
        const updated = [...current];
        if (!next) updated.splice(index, 1);
        else if (index < 0) updated.push(...normalizeSubjects([next]));
        else updated[index] = normalizeSubjects([next])[0];
        transaction.set(ref, { id: subjectSettingsId, subjects: updated, ...stamp() }, { merge: true });
      });
      if (next || editing === previous) reset();
      setDeleting(undefined);
      toast(next ? "Subjects updated." : "Subject deleted.");
    } catch (cause) {
      setError(cause instanceof SubjectChangeError ? cause.message : `Could not ${next ? "save" : "delete"} the subject. Try again.`);
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = formatName(name);
    if (!cleanName) {
      setError("Enter a subject name.");
      return;
    }
    if (cleanName.length > maxSubjectLength) {
      setError(`Use ${maxSubjectLength} characters or fewer for the subject name.`);
      return;
    }
    const id = (editing && subjectCatalogId(editing)) || crypto.randomUUID();
    void saveSubject({ id, name: cleanName, active: editing?.active ?? true, departmentIds,
      aliasIds: editing?.aliasIds ?? [] }, editing);
  }

  if (!ready) return <LoadingSkeleton variant="table" label="Loading subjects…" className="text-sm text-on-surface-variant" />;

  return <fieldset disabled={busy} className="space-y-4">
    <section className="space-y-2 border-b border-outline-variant/60 pb-4">
      <h3 className="font-semibold">Departments</h3>
      <p className="text-sm text-on-surface-variant">Departments are created under Classes &amp; Sections → Senior Secondary → Add department, with their head, subjects and seats.</p>
      {departments.length ? <ul className="flex flex-wrap gap-2">
        {departments.map((department) => <li key={department.id}><Badge tone="neutral">{department.name}</Badge></li>)}
      </ul> : <p className="text-sm text-on-surface-variant">No departments yet.</p>}
    </section>
    <h3 className="font-semibold">Subjects</h3>
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <Field label="Subject name" className="min-w-40 flex-1">
        <Input value={name} maxLength={maxSubjectLength} onChange={(event) => setName(event.target.value)} />
      </Field>
      {departments.length > 0 && <fieldset className="w-full space-y-2">
        <legend className="text-sm font-semibold">Departments for subject</legend>
        <p className="text-sm text-on-surface-variant">Select every department that offers this subject. Leave all unchecked for a subject without a department.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {departments.map((department) => <label key={department.id} className="flex items-start gap-2 text-sm">
            <Checkbox checked={departmentIds.includes(department.id)} onChange={(event) => {
              const checked = event.currentTarget.checked;
              setDepartmentIds((current) => checked ? [...current, department.id] : current.filter((id) => id !== department.id));
            }} />
            <span>{department.name}</span>
          </label>)}
        </div>
      </fieldset>}
      <Button type="submit">{editing ? "Save subject" : "Add subject"}</Button>
      {editing && <Button type="button" variant="outline" onClick={reset}>Cancel</Button>}
    </form>
    {!deleting && error && <p role="alert" className="text-sm text-error">{error}</p>}
    {subjects.length === 0 ? <p className="text-sm text-on-surface-variant">Add a subject to make it available in the teacher form.</p>
      : <ul className="divide-y divide-outline-variant/60 rounded-lg border border-outline-variant/60">
        {[...subjects].sort((a, b) => Number(b.active) - Number(a.active) ||
          a.name.localeCompare(b.name)).map((subject) => {
          const label = subject.name;
          return <li key={subjectCatalogId(subject) || subject.name} className="flex flex-wrap items-center gap-2 p-3">
            <span className="min-w-0 flex-1 break-words font-medium">{label}</span>
            <div className="flex flex-wrap gap-1">
              {subject.departmentIds.map((id) => <Badge key={id} tone="neutral">{departments.find((department) => department.id === id)?.name}</Badge>)}
            </div>
            {!subject.active && <Badge tone="neutral">Inactive</Badge>}
            <Button type="button" size="sm" variant="ghost" aria-label={`Edit ${label}`}
              onClick={() => { setEditing(subject); setName(subject.name); setDepartmentIds(subject.departmentIds); setError(""); }}>Edit</Button>
            <Button type="button" size="sm" variant="ghost" className="text-error" aria-label={`Delete ${label}`}
              onClick={() => { setDeleting(subject); setError(""); }}>Delete</Button>
          </li>;
        })}
      </ul>}
    <Modal open={Boolean(deleting)} title="Delete subject?" onClose={closeDelete} footer={<>
      <Button type="button" variant="outline" disabled={busy} onClick={closeDelete}>Cancel</Button>
      <Button type="button" variant="danger" disabled={busy || !deleting} onClick={() => void saveSubject(null, deleting)}>
        {busy ? "Deleting…" : "Delete subject"}
      </Button>
    </>}>
      <p>Delete <strong>{deleting?.name}</strong> from the subject list? Existing teacher profiles and class assignments will keep their saved subject.</p>
      {error && <p role="alert" className="mt-2 text-sm text-error">{error}</p>}
    </Modal>
  </fieldset>;
}
