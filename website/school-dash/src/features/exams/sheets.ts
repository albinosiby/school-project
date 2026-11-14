// Mark sheets and compiled class results (docs/EXAMS_SHEETS_RESULTS_CONTRACT.md sections 1–2): data shapes plus the
// pure UI helpers the sheet board, the marks grid and the results panel share. Every mutation goes through
// examService.examAction; nothing here touches Firestore.
import type { Tone } from "@/components/ui";
import type { Cycle } from "./types";

export type SheetStatus = "NotStarted" | "InProgress" | "Submitted" | "Returned" | "Approved" | "Locked";
export type SheetComponents = {
  mode: "marks" | "grade";
  theory: number;
  practical: number;
  internal: number;
  passMarks: number;
  gradeOptions: string[];
};
export type SheetSummary = {
  total: number;
  entered: number;
  absent: number;
  medical: number;
  exempt: number;
  outOfRange: number;
  highest: number | null;
  lowest: number | null;
  mean: number | null;
};
/** `exm_sheets/{paperId}__{classId}`: one subject paper × one division */
export type Sheet = {
  id: string;
  cycleId: string;
  paperId: string;
  classId: string;
  classLabel: string;
  subject: string;
  grade: string;
  components: SheetComponents;
  ownerId: string;
  ownerName: string;
  reviewerId: string;
  rosterIds: string[];
  status: SheetStatus;
  version: number;
  submittedAt?: string;
  submittedBy?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  returnNote?: string;
  reopenReason?: string;
  summary: SheetSummary;
  needsRecheck: boolean;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type ResultStatus = "Compiled" | "Approved" | "Published" | "Superseded";
/** `exm_class_results/{cycleId}__{classId}` */
export type ClassResult = {
  id: string;
  cycleId: string;
  classId: string;
  classLabel: string;
  status: ResultStatus;
  version: number;
  stale: boolean;
  students: number;
  passed: number;
  failed: number;
  incomplete: number;
  passPct: number | null;
  compiledAt: string;
  approvedAt?: string;
  publishedAt?: string;
  /** scheduled publication (ISO) */
  publishAt?: string;
  sourceHash: string;
  updatedAt?: string;
  updatedBy?: string;
};
export type StudentResultSubject = {
  paperId: string;
  subject: string;
  code: string;
  mode: "marks" | "grade";
  theory: number | null;
  practical: number | null;
  internal: number | null;
  gradeValue: string;
  total: number | null;
  max: number | null;
  pct: number | null;
  grade: string;
  state: string;
  passed: boolean | null;
  weight: number;
};
/** `exm_results/{cycleId}__{studentId}` */
export type StudentResult = {
  id: string;
  cycleId: string;
  studentId: string;
  classId: string;
  classLabel: string;
  name: string;
  grn: string;
  roll: string;
  termId: string;
  examTypeId: string;
  subjects: StudentResultSubject[];
  total: number | null;
  maximum: number | null;
  pct: number | null;
  grade: string;
  passed: boolean | null;
  complete: boolean;
  rank: number | null;
  term: null | {
    termId: string;
    contributions: { cycleId: string; examTypeId: string; short: string; weight: number; pct: number | null }[];
    pct: number | null;
  };
  status: ResultStatus;
  version: number;
  stale: boolean;
  compiledAt: string;
  compiledBy: string;
  approvedAt?: string;
  approvedBy?: string;
  publishedAt?: string;
  supersededBy?: string;
  sourceHash: string;
  updatedAt?: string;
  updatedBy?: string;
};

export const SHEET_STATUSES: SheetStatus[] = ["NotStarted", "InProgress", "Submitted", "Returned", "Approved", "Locked"];
/** statuses in which marks may still be entered (teacher rule and the admin grid agree) */
export const OPEN_SHEET_STATUSES: SheetStatus[] = ["NotStarted", "InProgress", "Returned"];
export const sheetId = (paperId: string, classId: string) => `${paperId}__${classId}`;
export const isSheetOpen = (status: SheetStatus) => OPEN_SHEET_STATUSES.includes(status);
/** the message the marks grid shows (and save() throws) while a sheet is not editable */
export const sheetLockedMessage = (status: SheetStatus) => `Sheet is ${status}. Return or reopen it to edit marks.`;
export const sheetStatusLabel: Record<SheetStatus, string> = {
  NotStarted: "Not started",
  InProgress: "In progress",
  Submitted: "Submitted",
  Returned: "Returned",
  Approved: "Approved",
  Locked: "Locked",
};
export const sheetTone = (status: SheetStatus): Tone =>
  status === "Approved" || status === "Locked" ? "success" : status === "Submitted" ? "brand" : status === "Returned" ? "warning" : "neutral";

/** admin sheet actions (manageExamination action names) */
export type SheetAction = "sheetSubmit" | "sheetApprove" | "sheetReturn" | "sheetReopen";
export const sheetActionLabel: Record<SheetAction, string> = {
  sheetSubmit: "Submit on behalf",
  sheetApprove: "Approve",
  sheetReturn: "Return…",
  sheetReopen: "Reopen…",
};
/** which admin actions apply to a sheet in this status (contract 1, transitions table) */
export function sheetActions(status: SheetStatus): SheetAction[] {
  if (isSheetOpen(status)) return ["sheetSubmit"];
  if (status === "Submitted") return ["sheetApprove", "sheetReturn"];
  return ["sheetReopen"];
}
/** a note (Return) or reason (Reopen) must be 5–2000 characters */
export const noteError = (text: string) => {
  const n = text.trim().length;
  return n < 5 ? "Enter at least 5 characters" : n > 2000 ? "Keep it under 2000 characters" : "";
};

export type SheetCounts = Record<SheetStatus, number> & { total: number; approved: number };
/** sheets per status; `approved` counts Approved and Locked (both are approved for compilation) */
export function sheetCounts(sheets: Pick<Sheet, "status">[]): SheetCounts {
  const counts = Object.fromEntries(SHEET_STATUSES.map((s) => [s, 0])) as Record<SheetStatus, number>;
  for (const sheet of sheets) counts[sheet.status] = (counts[sheet.status] ?? 0) + 1;
  return { ...counts, total: sheets.length, approved: counts.Approved + counts.Locked };
}

export type ClassResultActions = {
  canCompile: boolean;
  canApprove: boolean;
  canPublish: boolean;
  canWithdraw: boolean;
  /** why the next step is not available yet ("" when something can be done) */
  reason: string;
};
/**
 * Which result actions apply to one class (contract 2, actions table). Compile needs every sheet of the class
 * Approved or Locked; a published, current result is not recompiled (reopen a sheet first). Approve applies to a
 * Compiled result when the cycle requires approval. Publish needs Approved, or Compiled when approval is not
 * required, and never a stale result. Withdraw applies to a Published result.
 */
export function classResultActions(
  result: Pick<ClassResult, "status" | "stale"> | undefined,
  cycle: { resultRules?: Pick<NonNullable<Cycle["resultRules"]>, "requireApproval"> | Partial<NonNullable<Cycle["resultRules"]>> },
  sheets: Pick<Sheet, "status">[],
): ClassResultActions {
  const counts = sheetCounts(sheets);
  const allApproved = counts.total > 0 && counts.approved === counts.total;
  const requireApproval = cycle.resultRules?.requireApproval !== false;
  const stale = !!result?.stale;
  const canCompile = allApproved && (!result || stale || result.status !== "Published");
  const canApprove = !!result && result.status === "Compiled" && !stale && requireApproval;
  const canPublish = !!result && !stale && (result.status === "Approved" || (result.status === "Compiled" && !requireApproval));
  const canWithdraw = !!result && result.status === "Published";
  let reason = "";
  if (!counts.total) reason = "No mark sheets for this class yet";
  else if (!allApproved) reason = `${counts.approved} of ${counts.total} sheets approved`;
  else if (stale) reason = "A sheet was reopened; compile again";
  else if (!result) reason = "Ready to compile";
  else if (result.status === "Compiled" && requireApproval) reason = "Awaiting approval";
  else if (result.status === "Superseded") reason = "Superseded by a newer version";
  return { canCompile, canApprove, canPublish, canWithdraw, reason: canCompile || canApprove || canPublish || canWithdraw ? "" : reason };
}

/**
 * "Teacher submission" cell: the sheet status when a sheet exists, else the legacy `att_exam_state` row
 * (`{paperId}@{classId}`, status "Submitted").
 */
export function legacySubmission(sheet?: Pick<Sheet, "status"> | null, attExamState?: { status?: string } | null) {
  if (sheet) {
    const submitted = !isSheetOpen(sheet.status);
    return { submitted, label: sheetStatusLabel[sheet.status], tone: sheetTone(sheet.status), source: "sheet" as const };
  }
  const submitted = attExamState?.status === "Submitted";
  return { submitted, label: submitted ? "Submitted" : "Not submitted", tone: (submitted ? "success" : "neutral") as Tone, source: "legacy" as const };
}
