// Pure logic of the portal's leave module: the exact documents the teacher app writes (store_adapters.dart
// StaffLeavesAdapter / StaffAttendanceAdapter / RegularizationsAdapter) and the Apply Leave validation.
import { isHHmm, isLate, type LeaveType } from "@/features/people/checkins";
import { leaveBalance, leaveDays, type StaffLeave } from "@/features/people/leaves";
import { portalStamp } from "../shared";

export type LeaveStatus = "Pending" | "Approved" | "Rejected" | "Cancelled" | "Completed";
/** staff_leaves/{id} as the app writes it (`from`/`to` plus the Apply Leave screen's `start`/`end`). */
export type PortalLeave = {
  id: string; staffId: string; teacherId?: string; from: string; to: string; start?: string; end?: string; type: string; days?: number; coverage?: string;
  reason: string; note?: string; handovers?: unknown[]; status: LeaveStatus | string; createdAt?: string; decidedBy?: string; decidedAt?: string; decisionNote?: string;
  withdrawnAt?: string; updatedAt?: string; updatedBy?: string;
};
export type StaffDay = { id: string; staffId: string; date: string; in: string | null; out: string | null; status: string; note?: string; source?: string };
export type PortalRegularization = { id: string; staffId: string; date: string; type: string; time: string; reason: string; note?: string; status: string; at?: string; decisionNote?: string; decidedAt?: string };

export const REG_TYPES = ["Check-in", "Check-out", "Both Punches"] as const;
export const MIN_REASON = 10;

export type LeaveDraft = { type: string; from: string; to: string; reason: string; note: string };
export const emptyLeaveDraft = (type: string, today: string): LeaveDraft => ({ type, from: today, to: today, reason: "", note: "" });

const ymd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Approved days used per policy type; `left` is what the Apply Leave screen calls the available quota. */
export const balanceOf = (types: LeaveType[], leaves: PortalLeave[], staffId: string) =>
  leaveBalance(types, leaves.map((l) => ({ staffId: l.staffId, type: l.type, status: l.status as StaffLeave["status"], days: Number(l.days) || leaveDays(l.from, l.to || l.from) })), staffId);

/** The Apply Leave screen's checks: valid dates, at least one non-Sunday, a reason of 10+ characters, within the quota. */
export function validateLeave(v: LeaveDraft, types: LeaveType[], leaves: PortalLeave[], staffId: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!v.type) e.type = "Pick a leave type";
  if (!ymd(v.from)) e.from = "Pick the first day of leave";
  if (!ymd(v.to)) e.to = "Pick the last day of leave";
  else if (ymd(v.from) && v.to < v.from) e.to = "End date cannot be before the start date";
  const days = !e.from && !e.to ? leaveDays(v.from, v.to) : 0;
  if (!e.from && !e.to && days === 0) e.to = "Selected dates only include Sundays";
  if (v.reason.trim().length < MIN_REASON) e.reason = `Please give a reason (at least ${MIN_REASON} characters)`;
  if (!e.to && !e.type) {
    const quota = balanceOf(types, leaves, staffId).find((t) => t.type === v.type);
    if (quota && days > quota.left) e.to = `Only ${quota.left} day(s) of ${v.type} available`;
    if (leaves.some((l) => l.staffId === staffId && l.status !== "Rejected" && l.status !== "Cancelled" && !!l.from && l.from <= v.to && (l.to || l.from) >= v.from)) e.from = "You already have leave on these dates";
  }
  if (v.note.length > 2000) e.note = "Keep the handover note under 2000 characters";
  return e;
}

/** staff_leaves/{id}: what StaffLeavesAdapter.write sends for a new request (keys limited by the rules' validStaffLeave). */
export function leaveDoc(id: string, v: LeaveDraft, staffId: string, uid: string, at = new Date()) {
  const note = v.note.trim();
  return {
    id, staffId, from: v.from, to: v.to, start: v.from, end: v.to, type: v.type, days: leaveDays(v.from, v.to), coverage: "Full Day",
    reason: v.reason.trim(), handovers: [] as unknown[], ...(note ? { note } : {}), status: "Pending" as const, createdAt: at.toISOString(),
    ...portalStamp(staffId, uid, at),
  };
}

/** lm_withdrawn/{id}: the private copy the app keeps when a pending request is withdrawn (status Cancelled + withdrawnAt). */
export function withdrawnDoc(cur: PortalLeave, staffId: string, uid: string, at = new Date()) {
  return { ...cur, status: "Cancelled" as const, withdrawnAt: at.toISOString(), ...portalStamp(staffId, uid, at) };
}

/** "HH:mm" of a moment in the browser's time zone (the app punches with the device clock). */
export const hhmm = (d = new Date()) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
export const dayId = (date: string, staffId: string) => `${date}_${staffId}`;

/** staff_attendance/{date}_{staffId} on the first punch of the day: Late after the policy's checkInBy, source "web". */
export function checkInDoc(staffId: string, uid: string, date: string, time: string, checkInBy: string, at = new Date()) {
  return { id: dayId(date, staffId), staffId, date, in: time, out: null, status: isLate(time, checkInBy) ? "Late" : "Present", note: "", source: "web", ...portalStamp(staffId, uid, at) };
}
/** The punch-out patch: only `out` changes, so an admin correction of the check-in is kept. */
export const checkOutPatch = (staffId: string, uid: string, time: string, at = new Date()) => ({ out: time, ...portalStamp(staffId, uid, at) });

export type RegDraft = { date: string; type: string; time: string; reason: string; note: string };
export const emptyRegDraft = (today: string): RegDraft => ({ date: today, type: REG_TYPES[0], time: "", reason: "", note: "" });
export function validateRegularization(v: RegDraft, today: string): Record<string, string> {
  const e: Record<string, string> = {};
  if (!ymd(v.date)) e.date = "Pick the day to correct";
  else if (v.date > today) e.date = "Pick today or an earlier day";
  if (!(REG_TYPES as readonly string[]).includes(v.type)) e.type = "Pick which punch to correct";
  if (!isHHmm(v.time)) e.time = "Enter the time as HH:mm (24-hour)";
  if (!v.reason.trim()) e.reason = "Give a reason for the correction";
  return e;
}
/** staff_regularizations/{id}: always Pending, with `at` as the app writes it. */
export function regularizationDoc(id: string, v: RegDraft, staffId: string, uid: string, at = new Date()) {
  return { id, staffId, date: v.date, type: v.type, time: v.time, reason: v.reason.trim(), note: v.note.trim(), status: "Pending" as const, at: at.toISOString(), ...portalStamp(staffId, uid, at) };
}

export const newLeaveId = () => `lr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
export const newRegId = () => `rg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** newest first by createdAt / at / date */
export const byNewest = <T extends { createdAt?: string; at?: string; date?: string; from?: string }>(rows: T[]) =>
  [...rows].sort((a, b) => String(b.createdAt ?? b.at ?? b.date ?? b.from ?? "").localeCompare(String(a.createdAt ?? a.at ?? a.date ?? a.from ?? "")));

export const statusTone = (s: string): "success" | "danger" | "neutral" | "warning" =>
  s === "Approved" || s === "Completed" ? "success" : s === "Rejected" ? "danger" : s === "Cancelled" ? "neutral" : "warning";
