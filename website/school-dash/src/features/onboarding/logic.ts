// Pure setup-wizard logic (no React / Firestore): step progress, per-step validation and the contract-shaped records
// (data contract sections 2-3) the wizard writes into school, set_terms, classes and staff.
import { isEmail } from "@/features/admissions/logic";
import { addressErrors, type SchoolAddress } from "./address";
import { INDIA_STATES, type AddressState } from "./locations";

// Stored steps 7 (Data Import) and 8 (Parent Invite) are retired.
export const STEPS = [
  { no: 1, title: "School Profile", blurb: "Who you are: name, board and affiliation." },
  { no: 2, title: "Academic Year & Terms", blurb: "Set the year and the terms that structure it." },
  { no: 3, title: "Classes & Sections", blurb: "Choose grades, sections and seat capacity." },
  { no: 4, title: "Bell Schedule", blurb: "Define the school day and its periods." },
  { no: 5, title: "Fee Structure", blurb: "Define fee items, applicable classes, collection schedules, and payment preferences." },
  { no: 6, title: "Staff Allocations", blurb: "Optional. Add staff and assign class teachers now, or finish this later from the dashboard." },
] as const;

export const LAST_STORED_SETUP_STEP = 8;
const LAST_SETUP_STEP = STEPS[STEPS.length - 1]!.no;
/** The last step stays reachable until the wizard is marked complete. */
export const firstOpenStep = (completed: number[]) => STEPS.find(({ no }) => !completed.includes(no))?.no ?? LAST_SETUP_STEP;
/** Retain completed legacy steps in stored history. */
export const markCompleted = (completed: number[], no: number) => [...new Set([...completed, no])].filter((n) => n >= 1 && n <= LAST_STORED_SETUP_STEP).sort((a, b) => a - b);
export const progressPct = (completed: number[]) => Math.round((STEPS.filter(({ no }) => completed.includes(no)).length / STEPS.length) * 100);
/** Steps can be opened up to the first unfinished one. */
export const canOpenStep = (no: number, completed: number[]) => STEPS.some((step) => step.no === no) && no <= firstOpenStep(completed);

/** current academic year start (Apr–Mar): Nov 2026 → 2026, Feb 2027 → 2026 */
export const ayStart = (d = new Date()) => (d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1);
export const ayLabel = (y: number) => `${y}-${String(y + 1).slice(2)}`;

// ---------- 1 · school profile ----------
export type Profile = SchoolAddress & { name: string; short: string; board: string; affiliation: string; phone: string; email: string };
export function profileErrors(v: Profile, states: AddressState[] = INDIA_STATES) {
  const x: Record<string, string> = addressErrors(v, states);
  if (!v.name.trim()) x.name = "School name is required.";
  if (!/^\d{5,7}$/.test(v.affiliation.trim().replace(/^#/, ""))) x.affiliation = "Enter the 5–7 digit affiliation number.";
  const digits = v.phone.replace(/\D/g, "");
  if (!/^[+\d][\d\s()-]*$/.test(v.phone.trim()) || digits.length < 10 || digits.length > 13) x.phone = "Enter a phone number with at least 10 digits.";
  if (!isEmail(v.email)) x.email = "Enter a valid email address.";
  return x;
}

// ---------- 2 · academic year & terms ----------
export type Term = { name: string; start: string; end: string };
export function termErrors(list: Term[], workingDays: number) {
  const x: string[] = [];
  if (list.length === 0) x.push("Add at least one term.");
  list.forEach((t, i) => {
    if (!t.name.trim() || !t.start || !t.end) x.push(`Term ${i + 1}: fill in the name and both dates.`);
    else if (t.end <= t.start) x.push(`${t.name}: end date must be after the start date.`);
  });
  const names = list.map((t) => t.name.trim().toLowerCase()).filter(Boolean);
  if (new Set(names).size !== names.length) x.push("Term names must be different.");
  const sorted = list.filter((t) => t.start && t.end).sort((a, b) => a.start.localeCompare(b.start));
  sorted.forEach((t, i) => { if (i && t.start <= sorted[i - 1]!.end) x.push(`${t.name} overlaps ${sorted[i - 1]!.name}.`); });
  if (!Number.isInteger(workingDays) || workingDays < 100 || workingDays > 300) x.push("Working days should be between 100 and 300.");
  return x;
}
/** set_terms status of a term on `today` (same strings as Settings: Closed / In Progress / Scheduled). */
export const termStatus = (t: Term, today: string) => (t.end < today ? "Closed" : t.start <= today ? "In Progress" : "Scheduled");
/** `school.term` (contract section 3): the term running today, else the next one, else the last. */
export function currentTermName(list: Term[], today: string) {
  const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
  return (sorted.find((t) => t.start <= today && today <= t.end) ?? sorted.find((t) => t.start > today) ?? sorted[sorted.length - 1])?.name.trim() ?? "";
}
/** Teaching days of a term: its share of the statutory working days by calendar length. */
export const termDays = (t: Term, workingDays: number) => Math.round((Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / 864e5) * workingDays) / 365);

// ---------- 3 · classes & sections ----------
export { SETUP_GRADES, gradeName, sectionLetters, sectionsError, bandOf, classesFor, sectionRowsFor, classIdOfLabel, type GradeCfg } from "./classSetup";

// ---------- 4 · bell schedule ----------
export { bellError, bellRecord, buildSchedule, fmtMin, initialBell, normalizedBell, toMin, type Bell, type BellBreak } from "./bellSchedule";

// ---------- 6 · staff ----------
/** Assignments are optional, but a section can have only one class teacher. */
export function allocationError(assign: Record<string, string>) {
  const chosen = Object.values(assign).filter(Boolean);
  if (new Set(chosen).size !== chosen.length) return "A section can have only one class teacher.";
  return "";
}
