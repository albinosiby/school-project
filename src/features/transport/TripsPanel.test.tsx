import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TripsPanel, checklistOk, tripOrder } from "./TripsPanel";
import { TransportView } from "./TransportView";
import { renderUI, screen, seed, setUrl } from "@/test/render";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const ok = { brakes: true, lights: true, tyres: true, fuel: true, firstAid: true, cleanliness: true };
const trip = (busId: string, bus: string, kind: "pickup" | "drop", extra: Record<string, unknown> = {}) => ({ id: `2026-11-03_${busId}_${kind}`, busId, bus, routeName: "R", date: "2026-11-03", kind,
  status: "scheduled", total: 5, boarded: 0, dropped: 0, absent: 0, ...extra });

describe("trips", () => {
  it("orders by bus number then pickup before drop, tolerating a missing label", () => {
    const rows = [trip("bus_02", "Bus 14", "drop"), trip("bus_03", "Bus 9", "pickup"), trip("bus_02", "Bus 14", "pickup"), { ...trip("bus_04", "", "pickup"), bus: undefined as never }];
    expect(rows.sort(tripOrder).map((t) => t.id)).toEqual(["2026-11-03_bus_04_pickup", "2026-11-03_bus_03_pickup", "2026-11-03_bus_02_pickup", "2026-11-03_bus_02_drop"]);
  });
  it("needs every checklist key true (driver app Checklist.complete)", () => {
    expect(checklistOk(ok)).toBe(true);
    expect(checklistOk({ ...ok, firstAid: false })).toBe(false);
    expect(checklistOk(undefined)).toBe(false);
  });
  it("shows today's trips with the contract statuses and checklist gaps", () => {
    seed({ tr_trips: [trip("bus_01", "Bus 14", "pickup", { status: "active", boarded: 3, checklist: { ...ok, tyres: false } }), trip("bus_01", "Bus 14", "drop"), { ...trip("bus_01", "Bus 14", "pickup"), id: "old", date: "2026-11-02", status: "completed" }] });
    renderUI(<TripsPanel onOpenTrip={vi.fn()} />);
    expect(screen.getByText("On the road")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.queryByText("Completed")).toBeNull();
    expect(screen.getByText("tyres")).toBeInTheDocument();
    expect(screen.getByText("3 / 5")).toBeInTheDocument();
  });
  it("counts only active students as riders on the Transport page", () => {
    seed({ students: [{ id: "s1", name: "A", busId: "bus_01" }, { id: "s2", name: "B", busId: "bus_01", deleted: true }, { id: "s3", name: "C" }] });
    setUrl("/transport?tab=trips");
    renderUI(<TransportView />);
    expect(screen.getByText("50% of students")).toBeInTheDocument();
  });
});
