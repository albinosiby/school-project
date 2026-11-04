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

/** "8:05" / "08:05" -> 485 minutes (NaN when not a time). The teacher app compares minutes too (store_adapters `_mins`). */
export const toMins = (t: string | null | undefined) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t ?? "").trim());
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};
/** strict HH:mm (00:00–23:59), the contract's time format */
export const isHHmm = (t: string | null | undefined) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(t ?? ""));
/** tolerant read of `checkInBy`: accepts "8:15" like the teacher app (`^\d{1,2}:\d{2}$`), else the default; returns HH:mm */
export const normalizeCheckInBy = (v: unknown) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v ?? "").trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return DEFAULT_CHECK_IN_BY;
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
};
/** tolerant read of the policy's types: drops non-objects, coerces totals like the teacher app (`leavePolicy`) */
export const normalizeLeaveTypes = (v: unknown): LeaveType[] => {
  if (!Array.isArray(v) || !v.length) return DEFAULT_LEAVE_TYPES;
  const out = v.filter((t): t is Record<string, unknown> => !!t && typeof t === "object").map((t) => ({
    id: String(t.id ?? ""), name: String(t.name ?? t.id ?? ""), type: String(t.type ?? t.name ?? ""),
    total: Math.trunc(Number(t.total)) || 0,
  }));
  return out.length ? out : DEFAULT_LEAVE_TYPES;
};

export function useLeavePolicy() {
  const col = useCollection<LeavePolicy>("set_leave_policy");
  const doc = col.rows.find((r) => r.id === "policy");
  return {
    ready: col.ready, exists: !!doc,
    types: normalizeLeaveTypes(doc?.types),
    checkInBy: normalizeCheckInBy(doc?.checkInBy),
    save: (v: Omit<LeavePolicy, "id">) => (doc ? col.update("policy", v) : col.create({ id: "policy", ...v })),
  };
}

/** Validates a leave policy draft (Settings > Leave policy). Returns the first problem, or "" when it can be saved. */
export function validateLeavePolicy(v: { types: LeaveType[]; checkInBy: string }): string {
  const types = v.types;
  if (!types.length) return "Add at least one leave type";
  if (types.some((t) => !t.id.trim() || !t.name.trim() || !t.type.trim())) return "Every leave type needs a code, a label and a leave type";
  const uniq = (xs: string[]) => new Set(xs.map((x) => x.trim().toLowerCase())).size === xs.length;
  if (!uniq(types.map((t) => t.id))) return "Leave codes must be unique";
  if (!uniq(types.map((t) => t.name))) return "Leave labels must be unique";
  if (!uniq(types.map((t) => t.type))) return "Each leave type can appear only once";
  if (types.some((t) => !Number.isInteger(t.total) || t.total < 0 || t.total > 365)) return "Yearly totals must be whole numbers between 0 and 365";
  if (!isHHmm(v.checkInBy)) return "Enter the check-in time as HH:mm (24-hour)";
  return "";
}

export const attId = (date: string, staffId: string) => `${date}_${staffId}`;
/** A date (YYYY-MM-DD) in the browser's time zone (toISOString is UTC and gives yesterday early in the morning in India). */
export const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Today's date (YYYY-MM-DD) in the browser's time zone. */
export const localToday = () => localDate(new Date());
/** Late = check-in after the school's start time (contract 12.1). Compared in minutes, so "9:05" vs "08:15" works. */
export const isLate = (time: string | null | undefined, checkInBy: string) => {
  const a = toMins(time), b = toMins(checkInBy);
  return !Number.isNaN(a) && !Number.isNaN(b) && a > b;
};
/** "14:05" -> "02:05 PM" */
export const t12 = (t: string | null | undefined) => {
  const n = toMins(t);
  if (Number.isNaN(n)) return "—";
  const h = Math.floor(n / 60), m = n % 60;
  return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};

export type DayStatus = PunchStatus | "Not checked in" | "On leave";
/** What Staff > Check-ins shows for one staff member on one day. */
export function dayStatus(rec: Pick<StaffAttendance, "in" | "out" | "status"> | undefined, onApprovedLeave: boolean, checkInBy: string): DayStatus {
  if (rec && (rec.in || rec.out || rec.status === "Leave")) {
    const st = (["Present", "Late", "Leave", "Irregular"] as const).includes(rec.status) ? rec.status : "Present";
    return st === "Present" && isLate(rec.in, checkInBy) ? "Late" : st;
  }
  return onApprovedLeave ? "On leave" : "Not checked in";
}

export type DayCorrection = { in: string | null; out: string | null; status: PunchStatus; note: string };
/**
 * Validates an admin correction of a day and returns the doc fields to write. Present/Late is derived from the check-in
 * time (like the teacher app does on punch-in), Leave clears both punches.
 */
export function validateCorrection(v: { in: string; out: string; status: string; note: string }, checkInBy: string): { errors: Record<string, string>; value?: DayCorrection } {
  const e: Record<string, string> = {};
  if (!(["Present", "Late", "Leave", "Irregular"] as string[]).includes(v.status)) e.status = "Pick a status";
  const leave = v.status === "Leave";
  const inT = leave ? "" : v.in.trim(), outT = leave ? "" : v.out.trim();
  if (inT && !isHHmm(inT)) e.in = "Use the HH:mm format";
  if (outT && !isHHmm(outT)) e.out = "Use the HH:mm format";
  if ((v.status === "Present" || v.status === "Late") && !inT) e.in = "Enter the check-in time";
  if (v.status === "Irregular" && !inT && !outT) e.in = "Enter at least one punch";
  if (!e.in && !e.out && inT && outT && toMins(outT) <= toMins(inT)) e.out = "Check-out must be after check-in";
  if (Object.keys(e).length) return { errors: e };
  let status = v.status as PunchStatus;
  if (status === "Present" || status === "Late") status = isLate(inT, checkInBy) ? "Late" : "Present";
  return { errors: {}, value: { in: inT || null, out: outT || null, status, note: v.note.trim() } };
}

/** The staff_attendance fields an approved regularization sets (contract 12.1: in/out from type/time, status Present). */
export function regularizationPatch(r: Pick<Regularization, "type" | "time" | "reason">, cur?: Pick<StaffAttendance, "in" | "out"> | null): DayCorrection {
  const both = /both/i.test(r.type);
  const isOut = /out/i.test(r.type) && !both;
  return {
    in: isOut ? cur?.in ?? null : r.time, out: isOut ? r.time : cur?.out ?? null, status: "Present",
    note: `Regularized (${r.type}${r.reason ? `: ${r.reason}` : ""})`,
  };
}

/** A mirror row (approvals) whose source request was deleted (the teacher withdrew it) and is still pending, older than `graceMs`. */
export function orphanMirrors<A extends { id: string; status: string; source?: string; sourceId?: string; updatedAt?: string }>(
  approvals: A[], source: string, liveIds: Set<string>, now = Date.now(), graceMs = 120_000,
): A[] {
  return approvals.filter((a) => a.source === source && a.status === "pending" && !!a.sourceId && !liveIds.has(a.sourceId)
    && (!a.updatedAt || now - Date.parse(a.updatedAt) > graceMs));
}

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
    // a request the teacher withdrew (deleted while Pending) leaves its inbox row behind: remove it
    // (skipped while the list is empty: a failed listener also reports an empty, "ready" collection)
    if (regs.rows.length) for (const a of orphanMirrors(approvals.rows as (Approval & { updatedAt?: string })[], "staff_regularizations", new Set(regs.rows.map((r) => r.id)))) {
      if (done.current.has(`x_${a.id}`)) continue;
      done.current.add(`x_${a.id}`);
      approvals.remove(a.id).catch(() => done.current.delete(`x_${a.id}`));
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
      const cur = att.rows.find((a) => a.id === attId(r.date, r.staffId)) ?? att.rows.find((a) => a.staffId === r.staffId && a.date === r.date);
      await saveDay(r.staffId, r.date, regularizationPatch(r, cur));
    }
    if (!mirror) return;
    const m = approvals.rows.find((a) => a.sourceId === r.id || a.id === regMirrorId(r.id));
    if (m) await approvals.update(m.id, { status: toApproval(to), decidedAt: pending ? "" : nowLocal(), reason: note });
  };
  return { regs, att, saveDay, decide };
}
