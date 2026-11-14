export type SchoolSubject = {
  id?: string;
  name: string;
  active: boolean;
  departmentId?: string;
  departmentIds?: string[];
  aliasIds?: string[];
};
export type CatalogSubject = SchoolSubject & { departmentIds: string[]; aliasIds: string[] };

export function subjectName(value: string): string;
export function subjectKey(value: string): string;
export function subjectCatalogId(subject: SchoolSubject): string;
export function normalizeSubjects(entries: SchoolSubject[]): CatalogSubject[];
export function subjectForSelection(subjects: SchoolSubject[], name: string, id?: string): SchoolSubject | undefined;
