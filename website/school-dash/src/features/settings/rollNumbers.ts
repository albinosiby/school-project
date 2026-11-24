/** Roll numbers: set_config/rolls `{ auto }` (DATA_CONTRACT section 3a) and the whole-school alphabetical renumbering. */
export type RollSettings = { id: string; auto?: boolean };
export const DEFAULT_ROLLS: RollSettings = { id: "rolls", auto: true };
/** automatic assignment is on unless the office switched it off */
export const rollsAuto = (settings?: Partial<RollSettings>) => settings?.auto !== false;

export type RollStudent = { id: string; name: string; classId?: string; roll?: number | string; rollAcademicYear?: string; status?: string; deleted?: boolean };
export type RollClass = { id: string; grade: string; section: string; stream?: string; rollRevision?: number };
export type DivisionPlan = { classId: string; label: string; rows: { id: string; name: string; roll: number; previous: number }[]; changed: number };

export const validRoll = (value: unknown) => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 999;
export const activeStudent = (s: RollStudent) => !s.deleted && (!s.status || s.status === "Active");
const byName = (a: RollStudent, b: RollStudent) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }) || a.id.localeCompare(b.id);
export const classLabel = (c: RollClass) => `${c.grade}-${c.section}${c.stream ? ` · ${c.stream}` : ""}`;

/** Every division numbered 1..n in name order (the office's yearly renumbering); divisions already in order have `changed` 0. */
export function alphabeticalPlan(students: RollStudent[], classes: RollClass[], year: string): DivisionPlan[] {
  const byClass = new Map<string, RollStudent[]>();
  for (const s of students) {
    if (!activeStudent(s) || !s.classId) continue;
    byClass.set(s.classId, [...(byClass.get(s.classId) ?? []), s]);
  }
  const plans: DivisionPlan[] = [];
  for (const c of [...classes].sort((a, b) => classLabel(a).localeCompare(classLabel(b), "en", { numeric: true }))) {
    const roster = byClass.get(c.id);
    if (!roster?.length) continue;
    const rows = [...roster].sort(byName).map((s, i) => ({ id: s.id, name: s.name, roll: i + 1, previous: validRoll(Number(s.roll)) && (!year || !s.rollAcademicYear || s.rollAcademicYear === year) ? Number(s.roll) : 0 }));
    plans.push({ classId: c.id, label: classLabel(c), rows, changed: rows.filter((r) => r.previous !== r.roll).length });
  }
  return plans;
}

/** students in a division without a valid roll number for [year] */
export const missingRolls = (students: RollStudent[], year: string) =>
  students.filter((s) => activeStudent(s) && s.classId && !(validRoll(Number(s.roll)) && (!year || !s.rollAcademicYear || s.rollAcademicYear === year))).length;
