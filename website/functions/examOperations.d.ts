import type { Candidate, Cycle, Mark, Paper } from "../school-dash/src/features/exams/types";
import type { AssessmentResult } from "./examAssessment";
export type ResultRow = Candidate & { classGrade: string; studentId: string; classId: string; entries: { paper: Paper; mark?: Mark; result: AssessmentResult }[]; total: number | null; maximum: number | null; pct: number | null; grade: string; complete: boolean; passed: boolean | null; group: string; rank: number | null };
export function consolidated(cycle: Cycle, papers: Paper[], candidates: Candidate[], marks: Mark[], classes?: { id: string; streamId?: string; stream?: string }[]): ResultRow[];
export function readyForReport(row: ResultRow, rules?: Cycle["resultRules"]): boolean;
export function participates(paper: Paper, candidate: Candidate): boolean;
export function scheduleErrors(changes: Partial<Paper>[], all: Paper[], duties?: { paperId: string; staffId: string }[], window?: { start: string; end: string }, events?: { blocksExams?: boolean; date?: string; title?: string }[]): string[];
