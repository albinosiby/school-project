"use client";
// Transport: buses, crew (drivers / bus staff), trips, bus attendance, crew attendance and leaves (data contract section 14).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Bus as BusIcon, Route, UserCog, Users, Wrench } from "lucide-react";
import { PageHeader, Stat, Tabs } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { todayIso } from "@/features/ops/shared";
import type { Student } from "@/features/people/StudentsView";
import { BusesPanel } from "./BusesPanel";
import { CrewPanel } from "./CrewPanel";
import { TripsPanel } from "./TripsPanel";
import { AttendancePanel } from "./AttendancePanel";
import { CrewAttendancePanel } from "./CrewAttendancePanel";
import { LeavesPanel } from "./LeavesPanel";
import type { Bus, Crew, CrewLeave, Trip } from "./types";

const TABS = ["buses", "drivers", "staff", "trips", "attendance", "crew-attendance", "leaves"] as const;
type Tab = (typeof TABS)[number];

export function TransportView() {
  const buses = useCollection<Bus>("tr_buses").rows;
  const crew = useCollection<Crew>("tr_crew").rows;
  const students = useCollection<Student>("students").rows;
  const trips = useCollection<Trip>("tr_trips").rows;
  const leaves = useCollection<CrewLeave>("tr_crew_leaves").rows;
  // deep-linkable: /transport?tab=buses&bus=bus_01 | ?tab=attendance&date=…&bus=…&kind=pickup
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab: Tab = (TABS as readonly string[]).includes(params.get("tab") ?? "") ? (params.get("tab") as Tab) : "buses";
  const go = (q: Record<string, string | null>) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(q)) if (v) p.set(k, v); const s = p.toString(); router.replace(s ? `${path}?${s}` : path, { scroll: false }); };
  const setTab = (t: string) => go({ tab: t === "buses" ? null : t });
  const today = todayIso();
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const drivers = crew.filter((c) => c.role === "driver"), attendants = crew.filter((c) => c.role === "attendant");
  const onBuses = students.filter((s) => !!s.busId).length;
  const tripsToday = trips.filter((t) => t.date === today);

  return (
    <div>
      <PageHeader title="Transport" subtitle="Buses and routes, drivers and bus staff, daily trips and bus attendance." />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="Buses" value={buses.length} sub={buses.some((b) => b.status === "Maintenance") ? `${buses.filter((b) => b.status === "Maintenance").length} in maintenance` : undefined} subTone="warning" icon={<BusIcon size={16} />} />
        <Stat label="Drivers" value={drivers.length} sub={drivers.some((c) => c.status === "On leave") ? `${drivers.filter((c) => c.status === "On leave").length} on leave` : undefined} subTone="warning" icon={<UserCog size={16} />} />
        <Stat label="Bus staff" value={attendants.length} sub={attendants.some((c) => c.status === "On leave") ? `${attendants.filter((c) => c.status === "On leave").length} on leave` : undefined} subTone="warning" icon={<Wrench size={16} />} />
        <Stat label="Students on buses" value={onBuses} sub={students.length ? `${Math.round((onBuses / students.length) * 100)}% of students` : undefined} icon={<Users size={16} />} />
        <Stat label="Trips today" value={tripsToday.length} sub={tripsToday.some((t) => t.status === "active") ? `${tripsToday.filter((t) => t.status === "active").length} on the road` : undefined} subTone="info" icon={<Route size={16} />} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[
        { id: "buses", label: "Buses", count: buses.length }, { id: "drivers", label: "Drivers", count: drivers.length }, { id: "staff", label: "Bus staff", count: attendants.length },
        { id: "trips", label: "Trips" }, { id: "attendance", label: "Attendance" }, { id: "crew-attendance", label: "Crew attendance" }, { id: "leaves", label: "Leaves", count: pendingLeaves }]} />
      {tab === "buses" && <BusesPanel openBusId={params.get("bus")} onOpenBus={(id) => go({ tab: null, bus: id })} />}
      {tab === "drivers" && <CrewPanel role="driver" />}
      {tab === "staff" && <CrewPanel role="attendant" />}
      {tab === "trips" && <TripsPanel onOpenTrip={(t) => go({ tab: "attendance", date: t.date, bus: t.busId, kind: t.kind })} />}
      {tab === "attendance" && <AttendancePanel key={`${params.get("date")}_${params.get("bus")}_${params.get("kind")}`} init={{ date: params.get("date") ?? undefined, bus: params.get("bus") ?? undefined, kind: params.get("kind") ?? undefined }} />}
      {tab === "crew-attendance" && <CrewAttendancePanel />}
      {tab === "leaves" && <LeavesPanel />}
    </div>
  );
}
