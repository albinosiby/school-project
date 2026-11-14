export type AssessmentResult = { state: "pending" | "invalid" | "medical" | "absent" | "exempt" | "verified" | "passed" | "failed"; total: number | null; pct: number | null; grade: string; passed?: boolean | null };
export type Rules = { passCriteria?: string; rounding?: string; calculation?: string; absentRule?: string };
export type AssessmentPaper = { theory: number; internal: number; practical?: number; assessmentMode?: string; gradeOptions?: string[]; passMarks?: number; theoryPass?: number; internalPass?: number; practicalPass?: number; resultRules?: Rules; scale?: string; weight?: number; setupVersion?: number };
export function assessMark(mark: { theory: number | null; internal: number | null; practical?: number | null; verified: boolean; medical: boolean; status?: string; gradeValue?: string; verificationFingerprint?: string } | undefined, paper: AssessmentPaper): AssessmentResult;
export function overallResult(entries: { paper: AssessmentPaper; result: AssessmentResult }[], rules?: Rules, scale?: string): { pct: number | null; total: number | null; maximum: number | null; grade: string; complete: boolean };
export function gradeFor(pct: number, scale?: string): string;

export function markFingerprint(mark: object | undefined, paper: AssessmentPaper): string;
