"use client";
// staff_leaves (written by the teacher app) <-> approvals mirror rows (data contract section 4).
// Mirror row convention: approvals/lv_{leaveId} with source "staff_leaves" + sourceId; either side may create it.
import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { nowLocal, type Approval } from "@/features/dashboard/data";

export type LeaveStatus = "Pending" | "Approved" | "Rejected";
export type StaffLeave = { id: string; staffId: string; type: string; from: string; to: string; days: number; reason: string; status: LeaveStatus; decidedBy?: string; decidedAt?: string; decisionNote?: string; createdAt?: string };
type StaffRef = { id: string; name: string; department: string };

export const mirrorId = (leaveId: string) => `lv_${leaveId}`;
export const toApprovalStatus = (s: LeaveStatus): Approval["status"] => (s === "Approved" ? "approved" : s === "Rejected" ? "rejected" : "pending");
export const toLeaveStatus = (s: Approval["status"]): LeaveStatus => (s === "approved" ? "Approved" : s === "rejected" ? "Rejected" : "Pending");

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
      if (approvals.rows.some((a) => a.sourceId === l.id || a.id === mirrorId(l.id))) { done.current.add(l.id); continue; }
      done.current.add(l.id);
      const s = staff.find((x) => x.id === l.staffId);
      approvals.create({
        id: mirrorId(l.id), requester: s?.name ?? l.staffId, ref: `LV-${l.id.slice(-6).toUpperCase()}`, kind: "leave", dept: s?.department ?? "Staff",
        title: /leave$/i.test(l.type) ? l.type : `${l.type} Leave`, detail: `${l.days} day${l.days === 1 ? "" : "s"} · ${l.from}${l.to !== l.from ? ` to ${l.to}` : ""}`, remark: l.reason || "—",
        submitted: l.createdAt && l.createdAt.length >= 19 ? l.createdAt.slice(0, 19) : nowLocal(), urgency: "Standard", tone: "neutral", status: "pending",
        source: "staff_leaves", sourceId: l.id,
      } as never).catch(() => done.current.delete(l.id));
    }
  }, [leaves.ready, approvals.ready, leaves.rows, approvals.rows, staff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Decide a leave from the leave screen: updates the leave and its approvals mirror. */
  const decide = async (leave: StaffLeave, status: LeaveStatus, note = "") => {
    const at = new Date().toISOString();
    await leaves.update(leave.id, { status, decidedBy: auth.currentUser?.uid ?? "", decidedAt: at, decisionNote: note });
    const m = approvals.rows.find((a) => a.sourceId === leave.id || a.id === mirrorId(leave.id));
    if (m) await approvals.update(m.id, { status: toApprovalStatus(status), decidedAt: nowLocal(), reason: note });
  };
  return { leaves: leaves.rows, ready: leaves.ready, decide, updateLeave: leaves.update };
}
