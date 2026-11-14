// Settings → Classes & Sections: one `set_sections` row per grade (or per senior stream). These helpers build the
// rows, the matching `classes` records and the scheme key the Add-grade drawer and the grade page share.
import { classIdOf, compareGrades, isSeniorGrade, sectionLabel, streamName } from "@/lib/academicStreams";
import { bandOf, gradeName } from "@/features/onboarding/classSetup";

export const SENIOR_STAGE = "Senior Secondary";
const STAGES = ["Pre-Primary", "Primary", "Middle", "Secondary", SENIOR_STAGE];
/** stage of a section row: the grade's band, with every 11–12 stream (and custom course) under Senior Secondary */
export const stageOf = (row: Pick<SectionRow, "grade" | "streamId">) =>
  isSeniorGrade(gradeOfLabel(row.grade)) || row.streamId ? SENIOR_STAGE : bandOf(gradeOfLabel(row.grade));
/** rows grouped by stage in school order; a stage with no rows is left out */
export function stageGroups<T extends Pick<SectionRow, "grade" | "streamId" | "stream">>(rows: T[]) {
  const sorted = [...rows].sort(compareSectionRows);
  return STAGES.map((stage) => ({ stage, rows: sorted.filter((row) => stageOf(row) === stage) })).filter((group) => group.rows.length);
}
/** like stageGroups, but the Senior Secondary block is always present (its header carries the course controls) */
export function stageGroupsWithSenior<T extends Pick<SectionRow, "grade" | "streamId" | "stream">>(rows: T[]) {
  const groups = stageGroups(rows);
  return groups.some((group) => group.stage === SENIOR_STAGE) ? groups : [...groups, { stage: SENIOR_STAGE, rows: [] as T[] }];
}

export type SectionRow = { id: string; grade: string; stream: string; streamId?: string; sections: string[]; roster: number; cap: number };
export const SECTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

/** "Grade 8" → "8"; "LKG" → "LKG" */
export const gradeOfLabel = (label: string) => String(label ?? "").replace(/^grade\s+/i, "").trim();
/** `sec_grade8`, `sec_grade11_science`, `sec_lkg` (the onboarding convention) */
export const sectionDocId = (grade: string, streamId = "") =>
  `sec_${gradeName(grade).replace(/\W+/g, "").toLowerCase()}${streamId ? `_${streamId}` : ""}`;
export const gradeHref = (id: string) => `/settings/grades/${id}`;
/** exam wizard / subject scheme group key for a row */
export const groupKeyOf = (row: Pick<SectionRow, "grade" | "streamId">) => `${gradeOfLabel(row.grade)}:${row.streamId ?? ""}`;
export const compareSectionRows = (a: Pick<SectionRow, "grade" | "stream">, b: Pick<SectionRow, "grade" | "stream">) =>
  compareGrades(gradeOfLabel(a.grade), gradeOfLabel(b.grade)) || (a.stream ?? "").localeCompare(b.stream ?? "");

export type Caps = Record<string, number>;
export const totalCap = (letters: string[], caps: Caps) => letters.reduce((sum, letter) => sum + (caps[letter] || 0), 0);
/** One `set_sections` row; `cap` is the sum of the per-section capacities (older screens read the total). */
export function newSectionRow(grade: string, streamId: string, letters: string[], caps: Caps): SectionRow {
  const senior = isSeniorGrade(grade) && streamId;
  return {
    id: sectionDocId(grade, senior ? streamId : ""),
    grade: gradeName(grade),
    stream: senior ? streamName(streamId) : bandOf(grade),
    ...(senior ? { streamId } : {}),
    sections: letters.map((letter) => sectionLabel(grade, letter, senior ? streamId : undefined)),
    roster: 0,
    cap: totalCap(letters, caps),
  };
}
/** `classes` records for the sections; each carries its own `capacity` (admissions reserve seats against it). */
export function classRowsFor(grade: string, streamId: string, letters: string[], caps: Caps = {}) {
  const senior = isSeniorGrade(grade) && streamId;
  return letters.map((letter) => ({
    id: classIdOf(grade, letter, senior ? streamId : undefined),
    grade,
    section: letter,
    ...(senior ? { streamId, stream: streamName(streamId) } : {}),
    ...(caps[letter] ? { capacity: caps[letter] } : {}),
    classTeacherId: "",
    classTeacher: "",
    room: "",
    wing: "",
  }));
}
export type GradeDraft = { grade: string; streamId: string; letters: string[]; caps: Caps; subjects: string[]; totalSeats?: number; rooms?: Record<string, string> };
export const cleanGradeRoom = (room: string) => room.trim().replace(/\s+/g, " ");
/** Optional home rooms are distinct across the new sections and other configured classes. */
export function gradeRoomsError(draft: Pick<GradeDraft, "grade" | "streamId" | "letters" | "rooms">, classes: { id: string; room?: string }[] = []) {
  const entered = draft.letters.filter((letter) => draft.rooms?.[letter] !== undefined);
  const editedIds = new Set(entered.map((letter) => classIdOf(draft.grade, letter, draft.streamId || undefined)));
  const used = new Set<string>();
  for (const letter of entered) {
    const room = cleanGradeRoom(draft.rooms![letter]);
    if (room.length > 20) return `Section ${letter}: room number must be at most 20 characters.`;
    if (!room) continue;
    const key = room.toLowerCase();
    if (used.has(key)) return `Room ${room} is assigned to more than one section. Choose a different room for section ${letter}.`;
    const other = classes.find((row) => !editedIds.has(row.id) && cleanGradeRoom(row.room ?? "").toLowerCase() === key);
    if (other) return `Room ${room} is already assigned to another class (${other.id.replace(/^cls_/, "")}).`;
    used.add(key);
  }
  return "";
}
export const GRADE_STEPS = ["Grade and seats", "Sections", "Subjects"] as const;
export type GradeStep = 1 | 2 | 3;
/** Distribute a grade's total across its chosen sections, with the remainder on the first sections. */
export function splitGradeSeats(total: number, count: number) {
  const size = Math.max(1, Math.min(SECTION_LETTERS.length, Math.floor(count) || 1));
  const seats = Number.isSafeInteger(total) && total > 0 ? total : 0;
  const letters = SECTION_LETTERS.slice(0, size);
  const base = Math.floor(seats / size), extra = seats % size;
  return { letters, caps: Object.fromEntries(letters.map((letter, index) => [letter, base + (index < extra ? 1 : 0)])) };
}
const totalSeatsError = (total: number | undefined) =>
  total === undefined || !Number.isSafeInteger(total) || total < 1 ? "Enter the total seats as a whole number of at least 1." : "";
/** First problem with a set of section capacities, or "". */
export function capsError(letters: string[], caps: Caps): string {
  if (!letters.length) return "Pick at least one section";
  const bad = letters.find((letter) => !Number.isSafeInteger(caps[letter]) || caps[letter] < 1);
  if (!bad && !Number.isSafeInteger(totalCap(letters, caps))) return "Total capacity must be a safe whole number";
  return bad ? `Capacity of section ${bad} must be a whole number of at least 1` : "";
}
/** Explicit totals are used by the setup wizard; older section editors derive their total. */
export function gradeCapacityError(draft: Pick<GradeDraft, "letters" | "caps" | "totalSeats">): string {
  const problem = capsError(draft.letters, draft.caps);
  if (problem) return problem;
  if (draft.totalSeats === undefined) return "";
  const invalid = totalSeatsError(draft.totalSeats);
  if (invalid) return invalid;
  const sum = totalCap(draft.letters, draft.caps);
  return sum !== draft.totalSeats ? `Section seats add up to ${sum}, not the ${draft.totalSeats} total seats. Adjust them so they match.` : "";
}
function gradeIdentityError(draft: GradeDraft, existing: Pick<SectionRow, "id">[]): string {
  if (!draft.grade) return "Choose a grade";
  if (isSeniorGrade(draft.grade) && !draft.streamId) return "Choose a stream for " + gradeName(draft.grade);
  const id = sectionDocId(draft.grade, isSeniorGrade(draft.grade) ? draft.streamId : "");
  return existing.some((row) => row.id === id)
    ? gradeName(draft.grade) + (draft.streamId ? " · " + streamName(draft.streamId) : "") + " is already configured" : "";
}
/** Validate only the current wizard step so subjects come after the seat allocation. */
export function gradeStepError(step: GradeStep, draft: GradeDraft, existing: Pick<SectionRow, "id">[]): string {
  if (step === 1) return gradeIdentityError(draft, existing) || totalSeatsError(draft.totalSeats);
  if (step === 2) return totalSeatsError(draft.totalSeats) || gradeCapacityError(draft);
  return draft.subjects.some((subject) => subject.trim()) ? "" : "Add at least one subject for this grade.";
}
/** First problem with an Add-grade draft, or "". */
export function gradeSetupError(draft: GradeDraft, existing: Pick<SectionRow, "id">[]): string {
  return gradeIdentityError(draft, existing) || gradeCapacityError(draft);
}
