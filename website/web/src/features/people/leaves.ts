"use client";
// staff_leaves (written by the teacher app) <-> approvals mirror rows (data contract sections 4 and 9).
// Mirror row convention: approvals/lv_{leaveId} with source "staff_leaves" + sourceId; either side may create it.
import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { nowLocal, type Approval } from "@/features/dashboard/data";
import { orphanMirrors, type LeaveType } from "./checkins";

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type StaffLeave = { id: string; staffId: string; type: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; decidedBy?: string; decidedAt?: string; decisionNote?: string; createdAt?: string; source?: string };
type StaffRef = { id: string; name: string; department: string };

export const mirrorId = (leaveId: string) => `lv_${leaveId}`;
export const toApprovalStatus = (s: LeaveStatus): Approval["status"] => (s === "Approved" ? "approved" : s === "Rejected" ? "rejected" : "pending");
export const toLeaveStatus = (s: Approval["status"]): LeaveStatus => (s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending");

/** The approvals row of a leave: by sourceId, else by the conventional id. */
export const findMirror = <A extends Pick<Approval, "id" | "sourceId">>(approvals: A[], leaveId: string) =>
  approvals.find((a) => a.sourceId === leaveId) ?? approvals.find((a) => a.id === mirrorId(leaveId));

/** Approvals mirror row for a leave (contract 9): id lv_{leaveId}, kind "leave", source "staff_leaves", sourceId. */
export function mirrorRow(l: StaffLeave, s?: StaffRef, status: Approval["status"] = "pending"): Approval {
  const days = Number(l.days) || leaveDays(l.from, l.to || l.from);
  return {
    id: mirrorId(l.id), requester: s?.name ?? l.staffId, ref: `LV-${l.id.slice(-6).toUpperCase()}`, kind: "leave", dept: s?.department ?? "Staff",
    title: /leave$/i.test(l.type ?? "") ? l.type : `${l.type || "Staff"} Leave`, detail: `${days} day${days === 1 ? "" : "s"} · ${l.from}${l.to && l.to !== l.from ? ` to ${l.to}` : ""}`, remark: l.reason || "—",
    submitted: l.createdAt && l.createdAt.length >= 19 ? l.createdAt.slice(0, 19) : nowLocal(), urgency: "Standard", tone: "neutral", status,
    source: "staff_leaves", sourceId: l.id,
  };
}

/** The leave fields a decision writes (contract 4). Moving back to Pending clears who/when decided. */
export const decisionPatch = (status: LeaveStatus, uid: string, note = "", at = new Date().toISOString()) =>
  ({ status, decidedBy: status === "Pending" ? "" : uid, decidedAt: status === "Pending" ? "" : at, decisionNote: note });

const ymd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "") ? new Date(`${s}T00:00:00Z`) : null;
/** Leave days from `from` to `to` inclusive, Sundays not counted (same as the teacher app's Apply Leave). 0 when invalid. */
export function leaveDays(from: string, to: string) {
  const a = ymd(from), b = ymd(to);
  if (!a || !b || b < a) return 0;
  let n = 0;
  for (let d = a; d <= b; d = new Date(d.getTime() + 864e5)) if (d.getUTCDay() !== 0) n++;
  return n;
}

/** Approved (or completed) leave counts against the balance, like the teacher app's `usedLeave`. */
const counts = (l: Pick<StaffLeave, "status">) => l.status === "Approved" || (l.status as string) === "Completed";
/** Entitlement per policy type with used = approved days of that type (contract 12.2; matched on `type`, case-insensitive). */
export function leaveBalance(types: LeaveType[], leaves: Pick<StaffLeave, "staffId" | "type" | "status" | "days">[], staffId: string) {
  const mine = leaves.filter((l) => l.staffId === staffId && counts(l));
  return types.map((t) => {
    const used = mine.filter((l) => (l.type ?? "").trim().toLowerCase() === t.type.trim().toLowerCase()).reduce((a, l) => a + (Number(l.days) || 0), 0);
    return { ...t, used, left: Math.max(0, t.total - used) };
  });
}

/** Does the leave include `date` (YYYY-MM-DD)? */
export const covers = (l: Pick<StaffLeave, "from" | "to">, date: string) => !!l.from && l.from <= date && (l.to || l.from) >= date;
/** The approved leave of `staffId` that includes `date`, if any. */
export const approvedLeaveOn = <L extends Pick<StaffLeave, "staffId" | "status" | "from" | "to">>(leaves: L[], staffId: string, date: string) =>
  leaves.find((l) => l.staffId === staffId && counts(l) && covers(l, date));
/** A pending or approved leave of `staffId` overlapping from..to (rejected ones do not block). */
export const overlappingLeave = <L extends Pick<StaffLeave, "staffId" | "status" | "from" | "to">>(leaves: L[], staffId: string, from: string, to: string) =>
  leaves.find((l) => l.staffId === staffId && l.status !== "Rejected" && !!l.from && l.from <= to && (l.to || l.from) >= from);

/** Id of a leave the office records directly (the teacher app uses its own ids). */
export const adminLeaveId = (staffId: string, from: string) => `sl_${staffId}_${from}`;

/** Validates the office's "Record leave" form. */
export function validateRecordLeave(v: { from: string; to: string; type: string }, others: Pick<StaffLeave, "staffId" | "status" | "from" | "to">[], staffId: string) {
  const e: Record<string, string> = {};
  if (!ymd(v.from)) e.from = "Pick the first day of leave";
  if (!ymd(v.to)) e.to = "Pick the last day of leave";
  else if (ymd(v.from) && v.to < v.from) e.to = "End date is before start";
  if (!v.type.trim()) e.type = "Pick a leave type";
  if (!e.from && !e.to && leaveDays(v.from, v.to) === 0) e.to = "The selected dates only include Sundays";
  if (!e.from && !e.to && overlappingLeave(others, staffId, v.from, v.to)) e.from = "This staff member already has leave on these dates";
  return e;
}

/** staff_leaves doc for a leave the office records directly: already Approved, so no inbox row and no teacher push. */
export function recordedLeave(v: { staffId: string; type: string; from: string; to: string; reason: string }, uid: string, at = new Date().toISOString()): StaffLeave {
  return { id: adminLeaveId(v.staffId, v.from), staffId: v.staffId, type: v.type, from: v.from, to: v.to, days: leaveDays(v.from, v.to), reason: v.reason.trim(),
    status: "Approved", decidedBy: uid, decidedAt: at, decisionNote: "Recorded by the office", createdAt: at, source: "admin" };
}

export function useStaffLeaves() {
  const leaves = useCollection<StaffLeave>("staff_leaves");
  const approvals = useCollection<Approval>("approvals");
  const staff = useCollection<StaffRef>("staff").rows;
  const done = useRef(new Set<string>());

  // backfill: every pending leave shows in the Approvals queue
  useEffect(() => {
    if (!leaves.ready || !approvals.ready) return;
    for (const l of leaves.rows) {
      if (l.status !== "Pending" || done.current.has(l.id)) continue;
      if (findMirror(approvals.rows, l.id)) { done.current.add(l.id); continue; }
      done.current.add(l.id);
      approvals.create(mirrorRow(l, staff.find((x) => x.id === l.staffId)) as never).catch(() => done.current.delete(l.id));
    }
    // a leave the teacher withdrew (the app deletes it while Pending) leaves its inbox row behind: remove it
    // (skipped while the list is empty: a failed listener also reports an empty, "ready" collection)
    if (leaves.rows.length) for (const a of orphanMirrors(approvals.rows as (Approval & { updatedAt?: string })[], "staff_leaves", new Set(leaves.rows.map((l) => l.id)))) {
      if (done.current.has(`x_${a.id}`)) continue;
      done.current.add(`x_${a.id}`);
      approvals.remove(a.id).catch(() => done.current.delete(`x_${a.id}`));
    }
  }, [leaves.ready, approvals.ready, leaves.rows, approvals.rows, staff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Decide a leave from the leave screen: updates the leave and its approvals mirror (created when missing). */
  const decide = async (leave: StaffLeave, status: LeaveStatus, note = "") => {
    await leaves.update(leave.id, decisionPatch(status, auth.currentUser?.uid ?? "", note));
    const m = findMirror(approvals.rows, leave.id);
    const pending = status === "Pending";
    const patch = { status: toApprovalStatus(status), decidedAt: pending ? "" : nowLocal(), reason: note };
    if (m) await approvals.update(m.id, patch);
    else await approvals.create({ ...mirrorRow(leave, staff.find((x) => x.id === leave.staffId)), ...patch } as never);
  };
  return { leaves: leaves.rows, ready: leaves.ready, decide, updateLeave: leaves.update };
}
