"use client";

import { useCollection } from "./useCollection";
import { normalizeSubjects, subjectKey, subjectName, type SchoolSubject } from "../../../functions/subjectCatalog";

export { normalizeSubjects, subjectCatalogId, subjectForSelection, subjectKey, subjectName, type SchoolSubject } from "../../../functions/subjectCatalog";

export type SchoolDepartment = { id: string; name: string };
export const subjectSettingsId = "subjects";
export type SubjectSettings = { id: string; subjects: SchoolSubject[]; departments?: SchoolDepartment[] };

export function useSchoolSubjects() {
  const settings = useCollection<SubjectSettings>("set_config");
  const classes = useCollection<{ id: string; subjects?: string[] }>("classes");
  const assignments = useCollection<{ id: string; subject?: string }>("assignments");
  const saved = settings.rows.find((row) => row.id === subjectSettingsId);
  if (saved) return { subjects: normalizeSubjects(saved.subjects), departments: saved.departments ?? [], ready: settings.ready };

  const subjects = new Map<string, SchoolSubject>();
  for (const value of [...classes.rows.flatMap((row) => row.subjects ?? []), ...assignments.rows.map((row) => row.subject ?? "")]) {
    const name = subjectName(value);
    const key = subjectKey(name);
    if (key && !subjects.has(key)) subjects.set(key, { name, active: true });
  }
  return { subjects: normalizeSubjects([...subjects.values()]), departments: [], ready: settings.ready && classes.ready && assignments.ready };
}
