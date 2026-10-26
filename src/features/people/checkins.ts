"use client";
// Staff check-in (teacher app punches) and regularization requests, data contract section 12.1 / 12.2.
import { useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { useCollection } from "@/lib/useCollection";
import { nowLocal, type Approval } from "@/features/dashboard/data";

export type PunchStatus = "Present" | "Late" | "Leave" | "Irregular";
/** staff_attendance/{date}_{staffId} */
export type StaffAttendance = { id: string; staffId: string; teacherId: string; date: string; in: string | null; out: string | null; status: PunchStatus; note?: string; source: "app" | "admin" };
export type RegStatus = "Pending" | "Approved" | "Rejected";
/** staff_regularizations/{id}; type is "Check-in" | "Check-out" | "Both Punches" (teacher app) */
export type Regularization = { id: string; staffId: string; teacherId: string; date: string; type: string; time: string; reason: string; note?: string; status: RegStatus; at?: string; decidedBy?: string; decidedAt?: string; decisionNote?: string };

export type LeaveType = { id: string; name: string; type: string; total: number };
export type LeavePolicy = { id: string; types: LeaveType[]; checkInBy: string };

/** Built-in defaults (same as the teacher app's) used when set_leave_policy/policy is missing. */
export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 },
  { id: "ML", name: "Medical (ML)", type: "Medical Leave", total: 10 },
  { id: "DL", name: "Duty Leave (DL)", type: "Duty Leave", total: 6 },
  { id: "SDL", name: "Special Duty (SDL)", type: "Special Duty Leave", total: 5 },
  { id: "AW", name: "Academic Workshop (AW)", type: "Academic Workshop", total: 6 },
];
export const DEFAULT_CHECK_IN_BY = "08:15";

export function useLeavePolicy() {
  const col = useCollection<LeavePolicy>("set_leave_policy");
  const doc = col.rows.find((r) => r.id === "policy");
  return {
    ready: col.ready, exists: !!doc,
    types: doc?.types?.length ? doc.types : DEFAULT_LEAVE_TYPES,
    checkInBy: doc?.checkInBy || DEFAULT_CHECK_IN_BY,
    save: (v: Omit<LeavePolicy, "id">) => (doc ? col.update("policy", v) : col.create({ id: "policy", ...v })),
  };
}

export const attId = (date: string, staffId: string) => `${date}_${staffId}`;
/** Today's date (YYYY-MM-DD) in the browser's time zone. */
export const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
export const isLate = (time: string | null | undefined, checkInBy: string) => !!time && time > checkInBy;
/** "14:05" -> "02:05 PM" */
export const t12 = (t: string | null | undefined) => {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

/** approvals mirror row of a regularization (like `lv_{id}` for staff leaves) */
export const regMirrorId = (regId: string) => `rg_${regId}`;
const toApproval = (s: RegStatus): Approval["status"] => (s === "Approved" ? "approved" : s === "Rejected" ? "rejected" : "pending");
type StaffRef = { id: string; name: string; department: string };

/**
 * Regularization requests with their Approvals-inbox mirror rows (backfilled for every pending request) and one decide()
 * used by both Staff > Check-ins and the Approvals inbox, so either place fixes the day's check-in the same way.
 */
export function useRegularizations() {
  const regs = useCollection<Regularization>("staff_regularizations");
  const att = useCollection<StaffAttendance>("staff_attendance");
  const approvals = useCollection<Approval>("approvals");
  const staff = useCollection<StaffRef>("staff").rows;
  const done = useRef(new Set<string>());

  useEffect(() => {
    if (!regs.ready || !approvals.ready) return;
    for (const r of regs.rows) {
      if (r.status !== "Pending" || done.current.has(r.id)) continue;
      done.current.add(r.id);
      if (approvals.rows.some((a) => a.sourceId === r.id || a.id === regMirrorId(r.id))) continue;
      const s = staff.find((x) => x.id === r.staffId);
      approvals.create({
        id: regMirrorId(r.id), requester: s?.name ?? r.staffId, ref: `RG-${r.id.slice(-6).toUpperCase()}`, kind: "attendance", dept: s?.department ?? "Staff",
        title: `${r.type} correction`, detail: `${r.date} · proposed ${t12(r.time)}`, remark: [r.reason, r.note].filter(Boolean).join(" — ") || "—",
        submitted: r.at && r.at.length >= 19 ? r.at.slice(0, 19) : nowLocal(), urgency: "Standard", tone: "neutral", status: "pending",
        source: "staff_regularizations", sourceId: r.id,
      } as never).catch(() => done.current.delete(r.id));
    }
  }, [regs.ready, approvals.ready, regs.rows, approvals.rows, staff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Writes the admin's version of a day; keeps whatever else the teacher app stored on the doc. */
  const saveDay = async (staffId: string, d: string, v: { in: string | null; out: string | null; status: PunchStatus; note: string }) => {
    const id = attId(d, staffId);
    const body = { staffId, teacherId: staffId, date: d, ...v, source: "admin" as const };
    if (att.rows.some((a) => a.id === id)) await att.update(id, body); else await att.create({ id, ...body });
  };

  /** Approve / reject (or reopen) a request: the request, its inbox row and, when approved, the day's check-in (contract 12.1). */
  const decide = async (r: Regularization, to: RegStatus, note = "", { mirror = true } = {}) => {
    const pending = to === "Pending";
    await regs.update(r.id, { status: to, decidedBy: pending ? "" : auth.currentUser?.uid ?? "", decidedAt: pending ? "" : new Date().toISOString(), decisionNote: note });
    if (to === "Approved") {
      const cur = att.rows.find((a) => a.id === attId(r.date, r.staffId));
      const both = /both/i.test(r.type);
      const isOut = /out/i.test(r.type) && !both;
      await saveDay(r.staffId, r.date, {
        in: isOut ? cur?.in ?? null : r.time, out: isOut ? r.time : cur?.out ?? null, status: "Present",
        note: `Regularized (${r.type}${r.reason ? `: ${r.reason}` : ""})`,
      });
    }
    if (!mirror) return;
    const m = approvals.rows.find((a) => a.sourceId === r.id || a.id === regMirrorId(r.id));
    if (m) await approvals.update(m.id, { status: toApproval(to), decidedAt: pending ? "" : nowLocal(), reason: note });
  };
  return { regs, att, saveDay, decide };
}
