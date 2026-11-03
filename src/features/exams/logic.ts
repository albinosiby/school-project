// Pure exam logic (unit tested in logic.test.ts): candidates, marks bounds, clash checks, publish labels, cycle validation.
import type { Candidate, Eval, Paper } from "./types";

// ---- classes, candidates ---------------------------------------------------------------------------------------
/** "10" + "B" → "10-B" (the label exm_papers.published and exm_candidates.cls use) */
export const classLabel = (grade: string, section: string) => `${grade}-${section}`;
/** "10" + "B" → "cls_10B" (contract 2) */
export const classIdOf = (grade: string, section: string) => `cls_${grade}${String(section).toUpperCase()}`;
/** "10-B" → "cls_10B" */
export const labelToClassId = (label: string) => `cls_${label.replace("-", "")}`;
/** "#8A-01": the admin display roll of a candidate (contract 9); the integer roll lives on students.roll */
export const rollLabel = (grade: string, section: string, roll: number) => `#${grade}${section}-${String(roll).padStart(2, "0")}`;

export type StudentRow = { id: string; name: string; grn?: string; grade?: string; section?: string; classId?: string; roll?: number | string; status?: string; deleted?: boolean };
export const isActiveStudent = (s: StudentRow) => !s.deleted && (s.status ?? "Active") === "Active";

/**
 * One exm_candidates row per active student of the given grades (all grades when omitted): id cand_{studentId}.
 * Students without an integer roll get the next numbers of their class, in name order.
 */
export function candidatesFor(students: StudentRow[], grades?: string[]): Candidate[] {
  const byClass = new Map<string, StudentRow[]>();
  for (const s of students) {
    const grade = String(s.grade ?? "").trim(), section = String(s.section ?? "").trim().toUpperCase();
    if (!grade || !section || !isActiveStudent(s) || (grades && !grades.includes(grade))) continue;
    const k = classLabel(grade, section);
    byClass.set(k, [...(byClass.get(k) ?? []), { ...s, grade, section }]);
  }
  const out: Candidate[] = [];
  for (const list of byClass.values()) {
    const rollOf = (s: StudentRow) => { const n = Number(s.roll); return Number.isInteger(n) && n > 0 ? n : null; };
    let next = Math.max(0, ...list.map((s) => rollOf(s) ?? 0));
    const sorted = [...list].sort((a, b) => (rollOf(a) ?? Infinity) - (rollOf(b) ?? Infinity) || a.name.localeCompare(b.name));
    for (const s of sorted) {
      const roll = rollOf(s) ?? ++next;
      out.push({ id: `cand_${s.id}`, studentId: s.id, name: s.name, roll: rollLabel(s.grade!, s.section!, roll), grn: s.grn ?? "", cls: classLabel(s.grade!, s.section!), grade: s.grade!, section: s.section! });
    }
  }
  return out.sort((a, b) => a.cls.localeCompare(b.cls, "en", { numeric: true }) || a.roll.localeCompare(b.roll, "en", { numeric: true }));
}

const CAND_KEYS = ["studentId", "name", "roll", "grn", "cls", "grade", "section"] as const;
/** the generated candidates that are missing from `existing` or differ from it (what a sync has to write) */
export const candidateChanges = (existing: Candidate[], wanted: Candidate[]) => {
  const by = new Map(existing.map((c) => [c.id, c]));
  return wanted.filter((w) => { const e = by.get(w.id); return !e || CAND_KEYS.some((k) => (e[k] ?? "") !== (w[k] ?? "")); });
};
/** persisted candidates plus generated ones for students who have none yet (a new school has no exm_candidates) */
export const rosterOf = (persisted: Candidate[], students: StudentRow[]) => {
  const have = new Set(persisted.map((c) => c.id));
  return [...persisted, ...candidatesFor(students).filter((c) => !have.has(c.id))];
};
/** studentId of a candidate (its field, else cand_{studentId}) */
export const studentIdOf = (c: Pick<Candidate, "id" | "studentId">) => c.studentId || c.id.replace(/^cand_/, "");
/** does a paper cover this class? (no classIds = every class of its grade, as in the teacher app) */
export const paperCoversClass = (p: Pick<Paper, "grade" | "classIds">, cls: string) =>
  p.classIds?.length ? p.classIds.includes(labelToClassId(cls)) : cls.split("-")[0] === p.grade;

// ---- marks ---------------------------------------------------------------------------------------------------------
/** "" when `raw` is a blank (no mark) or a whole number 0..max, else the message */
export function markError(raw: string, max: number, what: string) {
  const v = raw.trim();
  if (v === "") return "";
  if (!/^\d+$/.test(v)) return `${what} marks must be a whole number`;
  return Number(v) > max ? `${what} marks must be between 0 and ${max}` : "";
}
/** blank → null, else the number (call markError first) */
export const markValue = (raw: string) => (raw.trim() === "" ? null : Number(raw.trim()));

/** subject match used by the teacher app and functions ("Science" covers "Physics") */
export function subjectCovers(paper: string, assigned: string) {
  const p = (paper ?? "").toLowerCase(), a = (assigned ?? "").toLowerCase();
  if (!p || !a) return false;
  if (p === a || p.includes(a) || a.includes(p)) return true;
  const sci = (x: string) => /physics|chemistry|biology/.test(x) || (x.includes("science") && !x.includes("social") && !x.includes("computer"));
  return sci(p) && sci(a);
}
/** the teacher of the paper's subject in that class (exm_marks.teacherId, so the teacher app lists and may edit the mark) */
export const subjectTeacherId = (assignments: { classId: string; subject: string; teacherId: string }[], subject: string, classId: string) =>
  assignments.find((a) => a.classId === classId && subjectCovers(subject, a.subject))?.teacherId ?? "";

/** states a class can be published with */
const FINAL: Eval["state"][] = ["verified", "passed", "failed", "medical", "absent"];
/** why a class cannot be published yet ("" = it can) */
export function publishBlocker(evals: Eval[]) {
  if (!evals.length) return "No candidates in this class";
  const bad = evals.filter((e) => e.state === "invalid").length;
  if (bad) return `Resolve ${bad} invalid mark entr${bad > 1 ? "ies" : "y"} first`;
  const pending = evals.filter((e) => !FINAL.includes(e.state)).length;
  return pending ? `${pending} candidate${pending > 1 ? "s" : ""} still ${pending > 1 ? "have" : "has"} no marks` : "";
}
/** exm_papers.published after publishing / unpublishing a class label ("10-B") */
export const withLabel = (published: string[] | undefined, cls: string) => [...(published ?? []).filter((x) => x !== cls), cls];
export const withoutLabel = (published: string[] | undefined, cls: string) => (published ?? []).filter((x) => x !== cls);

// ---- times and clashes ---------------------------------------------------------------------------------------------
export const toMin = (t: string) => { const [h, m] = (t || "0:0").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
export const fromMin = (n: number) => { const x = ((n % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`; };
/** "HH:mm" end of a paper (start + duration hours) */
export const paperEnd = (p: Pick<Paper, "start" | "duration">) => fromMin(toMin(p.start) + Math.round((p.duration || 0) * 60));
/** [aStart, aEnd) and [bStart, bEnd) overlap (touching ends do not) */
export const timesOverlap = (aStart: string, aEnd: string, bStart: string, bEnd: string) => toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd);

/** One staff member's time on a paper (duty row or chief of the paper). */
export type Slot = { key: string; staffId: string; paperId: string; date: string; start: string; end: string; label: string };
/** Other assignments of this staff member on the same date with overlapping time (other papers only). Contract 12.3. */
export const staffClashes = (slots: Slot[], staffId: string, p: { id: string; date: string; start: string; end: string }, exceptKey?: string) =>
  slots.filter((s) => s.staffId === staffId && s.key !== exceptKey && s.paperId !== p.id && !!p.date && s.date === p.date && timesOverlap(s.start, s.end, p.start, p.end));

// ---- cycle form ----------------------------------------------------------------------------------------------------
export type CycleSlot = { key: string; id?: string; subject: string; code: string; grade: string; date: string; start: string; duration: number; venue: string; invigilator: string; invigilatorId?: string };
export type CycleFields = { title: string; term: string; start: string; end: string; declaration: string; grades: string[]; theoryMax: number; internalMax: number; internalParts: number[] };

/** paper slots that clash with another slot: same date, overlapping time, and the same grade, venue or invigilator */
export function slotClashes(slots: CycleSlot[]) {
  const who = (s: CycleSlot) => s.invigilatorId || s.invigilator.trim();
  const end = (s: CycleSlot) => paperEnd(s);
  return slots.filter((s, i) => slots.some((o, j) => j !== i && !!o.date && o.date === s.date && !!s.start && !!o.start && timesOverlap(s.start, end(s), o.start, end(o))
    && (o.grade === s.grade || (!!o.venue.trim() && o.venue.trim().toLowerCase() === s.venue.trim().toLowerCase()) || (!!who(o) && who(o) === who(s)))));
}

/** Errors of a cycle about to be scheduled (empty = valid). Keys: title, term, start, end, declaration, grades, weight, parts, slots. */
export function cycleErrors(f: CycleFields, slots: CycleSlot[]) {
  const e: Record<string, string> = {};
  if (!f.title.trim()) e.title = "Title is required";
  if (!f.term) e.term = "Required";
  if (!f.start) e.start = "Required";
  if (!f.end) e.end = "Required";
  else if (f.start && f.end < f.start) e.end = "End must be after start";
  if (!f.declaration) e.declaration = "Required";
  else if (f.end && f.declaration < f.end) e.declaration = "Must be on/after end date";
  if (!f.grades.length) e.grades = "Select at least one grade";
  const ok = (n: number) => Number.isInteger(n);
  if (!ok(f.theoryMax) || !ok(f.internalMax)) e.weight = "Max marks must be whole numbers";
  else if (f.theoryMax < 0 || f.internalMax < 0) e.weight = "Marks cannot be negative";
  else if (f.theoryMax <= 0) e.weight = "Theory max marks must be above 0";
  else if (f.theoryMax + f.internalMax !== 100) e.weight = "Theory + Internal must total 100";
  const partsSum = f.internalParts.reduce((a, b) => a + (Number(b) || 0), 0);
  if (f.internalParts.some((p) => !(p >= 0))) e.parts = "Internal components cannot be negative";
  else if (partsSum !== f.internalMax) e.parts = `Internal components total ${partsSum}, expected ${f.internalMax}`;
  if (!slots.length) e.slots = "Add at least one subject paper slot";
  slots.forEach((s) => {
    if (!s.subject.trim() || !s.code.trim() || !s.date || !s.start || !s.venue.trim() || !s.invigilator.trim()) e.slots = "Complete all paper slot fields";
    else if (!(s.duration > 0) || s.duration > 6) e.slots = "Paper duration must be between 0.5 and 6 hours";
    else if (toMin(s.start) + Math.round(s.duration * 60) > 24 * 60) e.slots = "A paper must end before midnight";
    else if (f.start && f.end && (s.date < f.start || s.date > f.end)) e.slots = "Paper dates must fall within the cycle window";
    if (!f.grades.includes(s.grade)) e.slots = "A paper slot targets a grade that is not selected";
  });
  const codes = slots.map((s) => `${s.grade}|${s.code.trim().toUpperCase()}`).filter((k) => !k.endsWith("|"));
  if (!e.slots && new Set(codes).size !== codes.length) e.slots = "Each grade can have a paper code only once";
  if (slotClashes(slots).length) e.slots = "Resolve schedule clashes before saving";
  return e;
}
