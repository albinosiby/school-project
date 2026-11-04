"use client";
// Helpers shared by the Transport panels: stamps, ids, crew <-> bus allotment plan, settings.
import { deleteField, doc, type WriteBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import type { Student } from "@/features/people/StudentsView";
import type { Bus, BusStop, Crew, CrewRole, TransportSettings, TripKind } from "./types";
import { DEFAULT_CHECK_IN_BY, isActiveStudent, isHHmm, licenseStatus } from "./logic";
export { DEFAULT_CHECK_IN_BY } from "./logic";

/** contract section 2: every write carries updatedAt + updatedBy */
export const stamp = () => ({ updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" });
export const schoolDoc = (col: string, id: string) => { const sid = currentSchoolId(); if (!sid) throw new Error("Not signed in"); return doc(db, "schools", sid, col, id); };
export const busLabel = (b: Pick<Bus, "number"> | undefined | null) => (b ? `Bus ${b.number}` : "");
export const tripId = (date: string, busId: string, kind: TripKind) => `${date}_${busId}_${kind}`;
export const crewAttId = (date: string, crewId: string) => `${date}_${crewId}`;
export const ROLE_LABEL: Record<CrewRole, string> = { driver: "Driver", attendant: "Bus staff" };
/** "2026-10-31T06:52:11.000Z" -> "06:52" (local) */
export const isoTime = (iso?: string | null) => (iso ? new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) : "—");
/** "14:05" -> "02:05 PM" */
export const t12 = (t: string | null | undefined) => { if (!t) return "—"; const [h, m] = t.split(":").map(Number); return `${String(h % 12 || 12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
export const studentLabel = (s: Pick<Student, "grade" | "section">) => `Grade ${s.grade}-${s.section}`;

/** tr_settings/policy.checkInBy (contract 14.5), default "06:30" when the doc or the field is missing / not HH:mm */
export function useTransportSettings() {
  const col = useCollection<TransportSettings>("tr_settings");
  const policy = col.rows.find((r) => r.id === "policy");
  return { ready: col.ready, checkInBy: isHHmm(policy?.checkInBy) ? policy.checkInBy : DEFAULT_CHECK_IN_BY, save: (checkInBy: string) => (policy ? col.update("policy", { checkInBy }) : col.create({ id: "policy", checkInBy })) };
}

type Patch = Record<string, unknown>;
export type AllotPlan = { crew: Map<string, Patch>; buses: Map<string, Patch> };
/**
 * Contract 14.1: a crew member belongs to at most one bus, a bus has one driver and one attendant. Plans the patches that move
 * crew `c` to `toBusId` (or off every bus when empty): the target bus's driverId/driver (or attendantId/attendant; the role
 * picks the seat, so a driver never lands in the attendant seat), the previous holder of that seat loses busId/bus, and every
 * other bus that still lists `c` (in either seat) loses them. Allotting to the bus `c` already holds only refreshes a changed
 * name. Only docs present in `crew` / `buses` are patched (an update of a missing doc would fail the whole batch), except `c`
 * itself, which the caller may be creating (skip it in applyAllot). Apply with applyAllot() in one batch.
 */
export function planAllot(c: { id: string; name: string; role: CrewRole; busId?: string }, toBusId: string, crew: Pick<Crew, "id" | "busId">[], buses: Bus[]): AllotPlan {
  const idKey = c.role === "driver" ? "driverId" : "attendantId";
  const nameKey = c.role === "driver" ? "driver" : "attendant";
  const plan: AllotPlan = { crew: new Map(), buses: new Map() };
  const patchBus = (id: string, p: Patch) => plan.buses.set(id, { ...(plan.buses.get(id) ?? {}), ...p });
  const to = toBusId ? buses.find((b) => b.id === toBusId) : undefined;
  const currentBusId = c.busId || crew.find((x) => x.id === c.id)?.busId || "";
  // free every seat `c` holds except the target one
  for (const b of buses) {
    for (const [k, n] of [["driverId", "driver"], ["attendantId", "attendant"]] as const) {
      if (b[k] === c.id && !(to && b.id === to.id && k === idKey)) patchBus(b.id, { [k]: deleteField(), [n]: deleteField() });
    }
  }
  if (to) {
    const prev = to[idKey];
    if (prev && prev !== c.id) {
      const p = crew.find((x) => x.id === prev);
      // the displaced holder goes off the bus (unless their own doc already points at another bus)
      if (p && (!p.busId || p.busId === to.id)) plan.crew.set(prev, { busId: deleteField(), bus: deleteField() });
    }
    if (prev !== c.id || to[nameKey] !== c.name) patchBus(to.id, { [idKey]: c.id, [nameKey]: c.name });
    if (currentBusId !== to.id || prev !== c.id) plan.crew.set(c.id, { busId: to.id, bus: busLabel(to) });
  } else if (currentBusId) plan.crew.set(c.id, { busId: deleteField(), bus: deleteField() });
  return plan;
}
export function applyAllot(batch: WriteBatch, plan: AllotPlan, skipCrewId?: string) {
  const s = stamp();
  plan.crew.forEach((p, id) => { if (id !== skipCrewId) batch.update(schoolDoc("tr_crew", id), { ...p, ...s }); });
  plan.buses.forEach((p, id) => batch.update(schoolDoc("tr_buses", id), { ...p, ...s }));
}
/** "expired" / "soon" (within 30 days) / null */
export const isLicenseWarning = (expiry?: string, today?: string) => licenseStatus(expiry, today, 30);
/** tolerant read: legacy / partial bus docs may lack stops */
export const stopsOf = (b: Pick<Bus, "stops"> | undefined | null): BusStop[] => (Array.isArray(b?.stops) ? b.stops : []);

type Rider = { id: string; busId?: string; bus?: string; busStopId?: string; busStop?: string; deleted?: boolean };
/**
 * After a bus is edited, the names other docs keep for it (contract 14.1 / 14.2: `students.bus` / `busStop`, `tr_crew.bus`)
 * must follow: a new number relabels its riders and crew, a renamed stop renames `busStop`, a removed stop clears the
 * rider's stop. Returns only the patches that change something, plus the recomputed `studentCount`.
 */
export function planBusEdit(bus: Pick<Bus, "id" | "number" | "stops">, students: Rider[], crew: Pick<Crew, "id" | "busId" | "bus">[]) {
  const label = busLabel(bus);
  const stops = stopsOf(bus);
  const studentPatches = new Map<string, Patch>(), crewPatches = new Map<string, Patch>();
  let count = 0;
  for (const s of students) {
    if (s.busId !== bus.id) continue;
    if (isActiveStudent(s)) count++;
    const p: Patch = {};
    if (s.bus !== label) p.bus = label;
    if (s.busStopId) {
      const st = stops.find((x) => x.id === s.busStopId);
      if (!st) { p.busStopId = deleteField(); p.busStop = deleteField(); }
      else if (s.busStop !== st.name) p.busStop = st.name;
    }
    if (Object.keys(p).length) studentPatches.set(s.id, p);
  }
  for (const c of crew) if (c.busId === bus.id && c.bus !== label) crewPatches.set(c.id, { bus: label });
  return { students: studentPatches, crew: crewPatches, studentCount: count };
}
