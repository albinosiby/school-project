import { describe, expect, it } from "vitest";
import { deleteField, writeBatch } from "firebase/firestore";
import { applyAllot, busLabel, crewAttId, isLicenseWarning, planAllot, planBusEdit, stopsOf, tripId } from "./shared";
import { getRow, seed, writes } from "@/test/render";
import { db } from "@/lib/firebase";
import type { Bus, Crew } from "./types";

const DEL = deleteField();
const bus = (id: string, number: string, extra: Partial<Bus> = {}): Bus => ({ id, number, regNo: `DL-01-AB-${number}00`, capacity: 40, routeName: `Route ${number}`, stops: [], pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 0, ...extra });
const crewOf = (id: string, name: string, role: Crew["role"], busId?: string): Crew => ({ id, name, role, empId: id, phone: "", email: "", status: "Active", ...(busId ? { busId, bus: "Bus ?" } : {}) });
const obj = (m: Map<string, unknown>) => Object.fromEntries(m);

describe("ids and labels", () => {
  it("builds the trip / attendance id {date}_{busId}_{kind} and the crew day id {date}_{crewId}", () => {
    expect(tripId("2026-11-03", "bus_01", "pickup")).toBe("2026-11-03_bus_01_pickup");
    expect(tripId("2026-11-03", "bus_01", "drop")).toBe("2026-11-03_bus_01_drop");
    expect(crewAttId("2026-11-03", "crw_002")).toBe("2026-11-03_crw_002");
  });
  it("labels a bus by its number", () => {
    expect(busLabel({ number: "14" })).toBe("Bus 14");
    expect(busLabel(undefined)).toBe("");
  });
  it("reads stops tolerantly", () => {
    expect(stopsOf({ stops: undefined as never })).toEqual([]);
    expect(stopsOf(null)).toEqual([]);
  });
  it("keeps the 30-day license warning", () => {
    expect(isLicenseWarning("2026-11-20", "2026-11-03")).toBe("soon");
    expect(isLicenseWarning("2026-10-20", "2026-11-03")).toBe("expired");
    expect(isLicenseWarning("2027-11-20", "2026-11-03")).toBeNull();
  });
});

describe("planAllot (contract 14.1)", () => {
  const b1 = bus("bus_01", "14", { driverId: "crw_001", driver: "Ramesh", attendantId: "crw_002", attendant: "Suresh" });
  const b2 = bus("bus_02", "15");
  const ramesh = crewOf("crw_001", "Ramesh", "driver", "bus_01"), suresh = crewOf("crw_002", "Suresh", "attendant", "bus_01");
  const vijay = crewOf("crw_003", "Vijay", "driver"), anil = crewOf("crw_004", "Anil", "attendant");
  const crew = [ramesh, suresh, vijay, anil];

  it("moves a driver to another bus: the previous bus loses its driver, the target gets them", () => {
    const p = planAllot(ramesh, "bus_02", crew, [b1, b2]);
    expect(obj(p.buses)).toEqual({ bus_01: { driverId: DEL, driver: DEL }, bus_02: { driverId: "crw_001", driver: "Ramesh" } });
    expect(obj(p.crew)).toEqual({ crw_001: { busId: "bus_02", bus: "Bus 15" } });
  });
  it("frees the seat of the driver who held it; the attendant is not touched", () => {
    const p = planAllot(vijay, "bus_01", crew, [b1, b2]);
    expect(obj(p.buses)).toEqual({ bus_01: { driverId: "crw_003", driver: "Vijay" } });
    expect(obj(p.crew)).toEqual({ crw_001: { busId: DEL, bus: DEL }, crw_003: { busId: "bus_01", bus: "Bus 14" } });
  });
  it("puts an attendant in the attendant seat only, never the driver seat", () => {
    const p = planAllot(anil, "bus_01", crew, [b1, b2]);
    expect(obj(p.buses)).toEqual({ bus_01: { attendantId: "crw_004", attendant: "Anil" } });
    expect(p.crew.get("crw_002")).toEqual({ busId: DEL, bus: DEL });
    expect(p.buses.get("bus_01")).not.toHaveProperty("driverId");
  });
  it("is a no-op when allotting to the bus the crew member already holds", () => {
    const p = planAllot(ramesh, "bus_01", crew, [b1, b2]);
    expect(p.buses.size).toBe(0);
    expect(p.crew.size).toBe(0);
  });
  it("only refreshes the bus's copy of the name when it changed", () => {
    const p = planAllot({ ...ramesh, name: "Ramesh Kumar" }, "bus_01", crew, [b1, b2]);
    expect(obj(p.buses)).toEqual({ bus_01: { driverId: "crw_001", driver: "Ramesh Kumar" } });
    expect(p.crew.size).toBe(0);
  });
  it("unallots: the bus seat is cleared and the crew member loses busId / bus", () => {
    const p = planAllot(suresh, "", crew, [b1, b2]);
    expect(obj(p.buses)).toEqual({ bus_01: { attendantId: DEL, attendant: DEL } });
    expect(obj(p.crew)).toEqual({ crw_002: { busId: DEL, bus: DEL } });
  });
  it("writes nothing when unallotting someone who is on no bus", () => {
    const p = planAllot(vijay, "", crew, [b1, b2]);
    expect(p.buses.size + p.crew.size).toBe(0);
  });
  it("repairs a crew member listed on two buses: every other seat is cleared", () => {
    const dup = bus("bus_03", "16", { driverId: "crw_001", driver: "Ramesh" });
    const p = planAllot(ramesh, "bus_02", crew, [b1, b2, dup]);
    expect(p.buses.get("bus_01")).toEqual({ driverId: DEL, driver: DEL });
    expect(p.buses.get("bus_03")).toEqual({ driverId: DEL, driver: DEL });
    expect(p.buses.get("bus_02")).toEqual({ driverId: "crw_001", driver: "Ramesh" });
  });
  it("never patches a displaced holder whose crew doc no longer exists", () => {
    const p = planAllot(vijay, "bus_01", [suresh, vijay], [b1]);
    expect(p.crew.has("crw_001")).toBe(false);
    expect(p.buses.get("bus_01")).toEqual({ driverId: "crw_003", driver: "Vijay" });
  });
  it("applies in one batch with stamps, skipping the crew doc being created", async () => {
    seed({ tr_buses: [b1, b2], tr_crew: crew });
    const batch = writeBatch(db);
    applyAllot(batch, planAllot(vijay, "bus_01", crew, [b1, b2]), "crw_003");
    await batch.commit();
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ driverId: "crw_003", driver: "Vijay", updatedBy: "admin_uid" });
    expect(getRow("tr_crew", "crw_001")).not.toHaveProperty("busId");
    expect(writes.map((w) => `${w.coll}/${w.id}`).sort()).toEqual(["tr_buses/bus_01", "tr_crew/crw_001"]);
  });
});

describe("planBusEdit", () => {
  const stops = [{ id: "stp_01", name: "Lajpat Nagar", pickupTime: "06:45", dropTime: "15:40" }, { id: "stp_02", name: "GK-1", pickupTime: "06:58", dropTime: "15:55" }];
  const students = [
    { id: "s1", busId: "bus_01", bus: "Bus 14", busStopId: "stp_01", busStop: "Lajpat Nagar" },
    { id: "s2", busId: "bus_01", bus: "Bus 14", busStopId: "stp_02", busStop: "Greater Kailash" },
    { id: "s3", busId: "bus_01", bus: "Bus 14", busStopId: "stp_03", busStop: "Nehru Place" },
    { id: "s4", busId: "bus_01", bus: "Bus 14", deleted: true },
    { id: "s5", busId: "bus_02", bus: "Bus 15" },
  ];
  it("renames stops, clears removed stops and counts only active riders", () => {
    const p = planBusEdit({ id: "bus_01", number: "14", stops }, students, []);
    expect(obj(p.students)).toEqual({ s2: { busStop: "GK-1" }, s3: { busStopId: DEL, busStop: DEL } });
    expect(p.studentCount).toBe(3);
  });
  it("relabels riders and crew when the bus number changes", () => {
    const p = planBusEdit({ id: "bus_01", number: "41", stops }, students, [{ id: "crw_001", busId: "bus_01", bus: "Bus 14" }, { id: "crw_009", busId: "bus_02", bus: "Bus 15" }]);
    expect(p.students.get("s1")).toEqual({ bus: "Bus 41" });
    expect(p.students.has("s5")).toBe(false);
    expect(obj(p.crew)).toEqual({ crw_001: { bus: "Bus 41" } });
  });
});
