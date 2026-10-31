"use client";
// Helpers shared by the Transport panels: stamps, ids, crew <-> bus allotment plan, settings.
import { deleteField, doc, type WriteBatch } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import type { Student } from "@/features/people/StudentsView";
import type { Bus, Crew, CrewRole, TransportSettings, TripKind } from "./types";

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

export const DEFAULT_CHECK_IN_BY = "06:30";
export function useTransportSettings() {
  const col = useCollection<TransportSettings>("tr_settings");
  const policy = col.rows.find((r) => r.id === "policy");
  return { ready: col.ready, checkInBy: policy?.checkInBy || DEFAULT_CHECK_IN_BY, save: (checkInBy: string) => (policy ? col.update("policy", { checkInBy }) : col.create({ id: "policy", checkInBy })) };
}

type Patch = Record<string, unknown>;
export type AllotPlan = { crew: Map<string, Patch>; buses: Map<string, Patch> };
/**
 * Contract 14.1: a crew member belongs to at most one bus, a bus has one driver and one attendant. Plans the patches that move
 * crew `c` to `toBusId` (or off every bus when empty): the target bus's driverId/driver (or attendantId/attendant), the previous
 * holder of that seat loses busId/bus, and the crew member's previous bus loses them. Apply with applyAllot() in one batch.
 */
export function planAllot(c: { id: string; name: string; role: CrewRole; busId?: string }, toBusId: string, crew: Crew[], buses: Bus[]): AllotPlan {
  const idKey = c.role === "driver" ? "driverId" : "attendantId";
  const nameKey = c.role === "driver" ? "driver" : "attendant";
  const plan: AllotPlan = { crew: new Map(), buses: new Map() };
  const patchBus = (id: string, p: Patch) => plan.buses.set(id, { ...(plan.buses.get(id) ?? {}), ...p });
  const from = c.busId || crew.find((x) => x.id === c.id)?.busId;
  if (from && from !== toBusId && buses.find((b) => b.id === from)?.[idKey] === c.id) patchBus(from, { [idKey]: deleteField(), [nameKey]: deleteField() });
  const to = toBusId ? buses.find((b) => b.id === toBusId) : undefined;
  if (to) {
    const prev = to[idKey];
    if (prev && prev !== c.id) plan.crew.set(prev, { busId: deleteField(), bus: deleteField() });
    patchBus(to.id, { [idKey]: c.id, [nameKey]: c.name });
    plan.crew.set(c.id, { busId: to.id, bus: busLabel(to) });
  } else plan.crew.set(c.id, { busId: deleteField(), bus: deleteField() });
  return plan;
}
export function applyAllot(batch: WriteBatch, plan: AllotPlan, skipCrewId?: string) {
  const s = stamp();
  plan.crew.forEach((p, id) => { if (id !== skipCrewId) batch.update(schoolDoc("tr_crew", id), { ...p, ...s }); });
  plan.buses.forEach((p, id) => batch.update(schoolDoc("tr_buses", id), { ...p, ...s }));
}
export const isLicenseWarning = (expiry?: string, today?: string) => {
  if (!expiry || !today) return null;
  if (expiry < today) return "expired" as const;
  const soon = new Date(`${today}T12:00:00`); soon.setDate(soon.getDate() + 30);
  return expiry <= soon.toISOString().slice(0, 10) ? ("soon" as const) : null;
};
