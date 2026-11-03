// Pure Transport logic (no Firebase): validation, time and date maths, counts. Unit tested in logic.test.ts.
import type { BusStop, CrewAttStatus, CrewRole, Mark } from "./types";

// ---------- times and dates ----------
/** "HH:mm", 24 h, zero padded (contract section 2) */
export const isHHmm = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);
/** minutes after midnight of "HH:mm" (also tolerates a legacy "6:45"); null when not a time */
export const toMinutes = (t: string | null | undefined): number | null => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return null;
  const h = Number(m[1]), min = Number(m[2]);
  return h > 23 || min > 59 ? null : h * 60 + min;
};
export const isIsoDate = (d: unknown): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));
/** "2026-10-31" + n days (calendar maths in UTC, so the result never depends on the machine's time zone) */
export const addDays = (iso: string, n: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- crew attendance (contract 14.5) ----------
export const DEFAULT_CHECK_IN_BY = "06:30";
/** a punch strictly after `checkInBy` is Late (the driver app: hhmm(now) > checkInBy) */
export const isLateIn = (inTime: string | null | undefined, checkInBy: string) => {
  const a = toMinutes(inTime), b = toMinutes(checkInBy) ?? toMinutes(DEFAULT_CHECK_IN_BY)!;
  return a !== null && a > b;
};
/** what a day shows: a "Present" day with a late punch reads as "Late" */
export const effectiveCrewStatus = (r: { status: CrewAttStatus; in?: string | null }, checkInBy: string): CrewAttStatus =>
  r.status === "Present" && isLateIn(r.in, checkInBy) ? "Late" : r.status;
export const CREW_ATT_STATUS: CrewAttStatus[] = ["Present", "Late", "Absent", "Leave"];
export type CrewDayInput = { in: string; out: string; status: string };
/** admin correction of one crew day: errors keyed by field ("" map when valid) */
export function validateCrewDay(v: CrewDayInput): Record<string, string> {
  const e: Record<string, string> = {};
  if (!(CREW_ATT_STATUS as string[]).includes(v.status)) e.status = "Pick a status";
  if (v.status === "Absent" || v.status === "Leave") return e;
  if (!v.in) e.in = "Enter the check-in time";
  else if (!isHHmm(v.in)) e.in = "Enter a time as HH:mm";
  if (v.out && !isHHmm(v.out)) e.out = "Enter a time as HH:mm";
  else if (v.out && isHHmm(v.in) && toMinutes(v.out)! <= toMinutes(v.in)!) e.out = "Check-out must be after check-in";
  return e;
}
/** the doc fields of a corrected day: Absent / Leave carry no punches; Present with a late punch is stored as Late */
export function crewDayBody(v: CrewDayInput & { note: string }, checkInBy: string) {
  const noTimes = v.status === "Absent" || v.status === "Leave";
  const inT = noTimes ? null : v.in || null, outT = noTimes ? null : v.out || null;
  const status = effectiveCrewStatus({ status: v.status as CrewAttStatus, in: inT }, checkInBy);
  return { in: inT, out: outT, status, note: v.note.trim(), source: "admin" as const };
}

// ---------- crew leave (contract 14.5) ----------
export const LEAVE_TYPES = ["Casual", "Sick", "Emergency", "Other"] as const;
/** calendar days from `from` to `to`, both included (the driver app's CrewLeave.days); 0 when the range is invalid */
export const leaveDays = (from?: string, to?: string) => {
  if (!isIsoDate(from)) return 0;
  const end = isIsoDate(to) ? to : from;
  const d = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  return d < 0 ? 0 : d + 1;
};
export const leaveCovers = (l: { from?: string; to?: string }, day: string) => !!l.from && l.from <= day && (l.to || l.from) >= day;
/** a rejection needs a reason the crew member sees in the app; an approval note is optional */
export const decisionNoteError = (to: "Approved" | "Rejected", note: string) => (to === "Rejected" && note.trim().length < 5 ? "Please enter at least 5 characters." : "");

// ---------- student bus attendance (contract 14.4) ----------
export const MARK_STATUSES = ["boarded", "absent", "dropped"] as const;
/** boarded / dropped / absent counts of a marks map (unknown legacy statuses are not counted) */
export function markCounts(marks: Record<string, Pick<Mark, "status"> | null | undefined> | null | undefined) {
  const c = { boarded: 0, dropped: 0, absent: 0 };
  for (const m of Object.values(marks ?? {})) if (m && (MARK_STATUSES as readonly string[]).includes(m.status)) c[m.status]++;
  return c;
}

// ---------- drivers' licences ----------
/** "expired" (before today), "soon" (expires within `days` days, today included) or null */
export const licenseStatus = (expiry?: string, today?: string, days = 30): "expired" | "soon" | null => {
  if (!expiry || !today || !isIsoDate(expiry)) return null;
  if (expiry < today) return "expired";
  return expiry <= addDays(today, days) ? "soon" : null;
};

// ---------- students on buses (contract 14.2) ----------
type Rider = { id: string; busId?: string; deleted?: boolean };
export const isActiveStudent = (s: { deleted?: unknown }) => s.deleted !== true;
/**
 * tr_buses.studentCount per bus after applying `moves` (studentId -> new busId, "" = off every bus). Soft-deleted students
 * never count (the driver app hides them too).
 */
export function busStudentCounts(students: Rider[], moves: Map<string, string> = new Map()) {
  const out = new Map<string, number>();
  for (const s of students) {
    if (!isActiveStudent(s)) continue;
    const b = moves.has(s.id) ? moves.get(s.id)! : s.busId ?? "";
    if (b) out.set(b, (out.get(b) ?? 0) + 1);
  }
  return out;
}
/** error when adding `adding` students to a bus that has `onBus` of `capacity` seats taken ("" when they fit) */
export const capacityError = (capacity: number, onBus: number, adding: number, busName: string) => {
  const left = Math.max(0, capacity - onBus);
  return adding > left ? `${busName} has ${left} seat${left === 1 ? "" : "s"} left; ${adding} student${adding === 1 ? "" : "s"} selected.` : "";
};

// ---------- buses and stops ----------
/** Indian registration number: "DL-01-AB-4092" / "DL01AB4092" / "MH 12 DE 1433" / "KA-05-4092" / BH series "22-BH-1234-AA" */
export const isRegNo = (v: string) => {
  const s = v.trim().toUpperCase();
  return /^[A-Z]{2}[- ]?\d{1,2}[- ]?[A-Z]{0,3}[- ]?\d{1,4}$/.test(s) || /^\d{2}[- ]?BH[- ]?\d{4}[- ]?[A-Z]{1,2}$/.test(s);
};
/** separators and case do not make two registrations different */
export const regKey = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const moveStop = <T,>(stops: T[], i: number, d: -1 | 1): T[] => {
  const j = i + d;
  if (i < 0 || i >= stops.length || j < 0 || j >= stops.length) return stops;
  const n = [...stops]; [n[i], n[j]] = [n[j]!, n[i]!]; return n;
};
export const nextStopId = (stops: Pick<BusStop, "id">[]) => `stp_${String(Math.max(0, ...stops.map((s) => Number(/^stp_(\d+)$/.exec(s.id)?.[1] ?? 0))) + 1).padStart(2, "0")}`;
export const nextBusId = (ids: string[]) => `bus_${String(Math.max(0, ...ids.map((i) => Number(/^bus_(\d+)$/.exec(i)?.[1] ?? 0))) + 1).padStart(2, "0")}`;

/**
 * Stops are in route order (the school is not a stop): every stop has a unique name and HH:mm pickup / drop times, the
 * pickup times never go back along the route and start at or after `pickupStart`, the drop times likewise from `dropStart`
 * (the bus leaves school and drops along the same order, as in the seed). Returns the first problem, "" when fine.
 */
export function stopsError(stops: Pick<BusStop, "name" | "pickupTime" | "dropTime">[], pickupStart: string, dropStart: string): string {
  if (stops.some((s) => !s.name.trim())) return "Every stop needs a name";
  const seen = new Set<string>();
  for (const s of stops) { const k = s.name.trim().toLowerCase(); if (seen.has(k)) return `Two stops are named "${s.name.trim()}"`; seen.add(k); }
  for (const [i, s] of stops.entries()) if (!isHHmm(s.pickupTime) || !isHHmm(s.dropTime)) return `Stop ${i + 1} (${s.name.trim()}) needs pickup and drop times (HH:mm)`;
  for (const key of ["pickupTime", "dropTime"] as const) {
    const start = key === "pickupTime" ? pickupStart : dropStart, what = key === "pickupTime" ? "pickup" : "drop";
    for (const [i, s] of stops.entries()) {
      const prev = i === 0 ? start : stops[i - 1]![key];
      if (isHHmm(prev) && toMinutes(s[key])! < toMinutes(prev)!) return i === 0
        ? `Stop 1 (${s.name.trim()}): ${what} time is before the ${what} start (${start})`
        : `Stop ${i + 1} (${s.name.trim()}): ${what} time is earlier than the stop before it`;
    }
  }
  return "";
}

export type BusInput = { number: string; regNo: string; capacity: string; routeName: string; pickupStart: string; dropStart: string };
/** Add / edit bus: errors keyed by field ("stops" for the stop list); `onBus` = students currently on the edited bus */
export function validateBus(f: BusInput, stops: Pick<BusStop, "name" | "pickupTime" | "dropTime">[], existing: { id: string; number?: string; regNo?: string }[], editId?: string, onBus = 0) {
  const e: Record<string, string> = {};
  const others = existing.filter((b) => b.id !== editId);
  const num = f.number.trim();
  if (!num) e.number = "Bus number is required";
  else if (!/^[A-Za-z0-9-]{1,8}$/.test(num)) e.number = "Use up to 8 letters or digits (e.g. 14)";
  else if (others.some((b) => (b.number ?? "").trim().toLowerCase() === num.toLowerCase())) e.number = "Another bus has this number";
  if (!f.regNo.trim()) e.regNo = "Registration number is required";
  else if (!isRegNo(f.regNo)) e.regNo = "Enter a registration number like DL-01-AB-4092";
  else if (others.some((b) => regKey(b.regNo ?? "") === regKey(f.regNo))) e.regNo = "Another bus has this registration number";
  const cap = f.capacity.trim();
  if (!/^\d+$/.test(cap) || Number(cap) < 1 || Number(cap) > 120) e.capacity = "Enter the seat count (a whole number, 1 to 120)";
  else if (Number(cap) < onBus) e.capacity = `${onBus} students are on this bus; capacity cannot be lower`;
  if (!f.routeName.trim()) e.routeName = "Route name is required";
  if (!isHHmm(f.pickupStart)) e.pickupStart = "Enter a time as HH:mm";
  if (!isHHmm(f.dropStart)) e.dropStart = "Enter a time as HH:mm";
  else if (isHHmm(f.pickupStart) && toMinutes(f.dropStart)! <= toMinutes(f.pickupStart)!) e.dropStart = "The drop must start after the pickup";
  const s = stopsError(stops, f.pickupStart, f.dropStart);
  if (s) e.stops = s;
  return e;
}

// ---------- crew (drivers / bus staff, contract 14.1) ----------
export const isPhone = (v: string) => /^[+\d][\d\s-]{7,}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 8;
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
export type CrewInput = { name: string; empId: string; phone: string; email: string; licenseNo: string; licenseExpiry: string; emergencyPhone: string };
export function validateCrew(f: CrewInput, role: CrewRole, ctx: { today: string; emailTaken: (email: string) => boolean; empIdTaken: (empId: string) => boolean }) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Name is required";
  if (!isPhone(f.phone)) e.phone = "Enter a valid phone number";
  if (!isEmail(f.email)) e.email = "A valid email is required (it is the driver-app login)";
  else if (ctx.emailTaken(f.email)) e.email = "Another crew member already uses this email";
  if (f.empId.trim() && !/^[A-Za-z0-9-]{2,20}$/.test(f.empId.trim())) e.empId = "Use letters, digits and hyphens (e.g. TR-1001)";
  else if (f.empId.trim() && ctx.empIdTaken(f.empId)) e.empId = "Another crew member has this employee ID";
  if (f.emergencyPhone.trim() && !isPhone(f.emergencyPhone)) e.emergencyPhone = "Enter a valid phone number";
  if (role === "driver") {
    if (!f.licenseNo.trim()) e.licenseNo = "License number is required for a driver";
    else if (!/^[A-Za-z0-9][A-Za-z0-9 -]{6,19}$/.test(f.licenseNo.trim())) e.licenseNo = "Enter a valid license number";
    if (!f.licenseExpiry) e.licenseExpiry = "License expiry is required for a driver";
    else if (!isIsoDate(f.licenseExpiry)) e.licenseExpiry = "Enter a valid date";
    else if (f.licenseExpiry < ctx.today) e.licenseExpiry = "The license has expired; enter the renewed expiry date";
  }
  return e;
}
