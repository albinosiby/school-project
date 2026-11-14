import { httpsCallable } from "firebase/functions";
import { functions } from "@/lib/firebase";
export type RolloverParameters = { sectionPolicy: "preserve" | "unassigned"; grade10Targets: Record<string, string> };
export type RolloverPlan = { fromYear: string; toYear: string; planHash: string; promoted: number; graduated: number; moves: {studentId: string; name: string; fromGrade: string; toGrade: string; classId: string; graduated: boolean}[]; issues: {studentId: string; name: string; message: string}[] };
export type RolloverJob = { id: string; fromYear: string; toYear: string; status: "Running" | "Failed" | "Completed"; phase: string; archiveIndex: number; processed: number; total: number; promoted: number; graduated: number; createdAt: string; completedAt?: string; error?: string };
export async function rolloverCall<T>(action: string, fields: Record<string, unknown>) { return (await httpsCallable<Record<string, unknown>, T>(functions,"manageAcademicRollover")({action,...fields})).data; }
