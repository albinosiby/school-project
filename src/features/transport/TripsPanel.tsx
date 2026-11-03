"use client";
// Transport > Trips: tr_trips for one day (created by the driver app, contract 14.3). Row click opens the trip's attendance.
import { useMemo, useState } from "react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Select, type Column, type Tone } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { todayIso } from "@/features/ops/shared";
import { busLabel, isoTime } from "./shared";
import type { Bus, Checklist, Trip, TripStatus } from "./types";

const statusTone: Record<TripStatus, Tone> = { scheduled: "neutral", active: "info", completed: "success" };
const STATUS_LABEL: Record<TripStatus, string> = { scheduled: "Scheduled", active: "On the road", completed: "Completed" };
const CHECK: (keyof Checklist)[] = ["brakes", "lights", "tyres", "fuel", "firstAid", "cleanliness"];
export const checklistOk = (c?: Checklist) => !!c && CHECK.every((k) => c[k]);
/** by bus number ("Bus 9" before "Bus 14"), pickup before drop; tolerates trips without a `bus` label */
export const tripOrder = (a: Pick<Trip, "bus" | "kind">, b: Pick<Trip, "bus" | "kind">) => {
  const na = Number((a.bus ?? "").replace(/\D/g, "")) || 0, nb = Number((b.bus ?? "").replace(/\D/g, "")) || 0;
  return na - nb || (a.bus ?? "").localeCompare(b.bus ?? "") || (a.kind === b.kind ? 0 : a.kind === "pickup" ? -1 : 1);
};

export function TripsPanel({ onOpenTrip }: { onOpenTrip: (t: Trip) => void }) {
  const trips = useCollection<Trip>("tr_trips");
  const buses = useCollection<Bus>("tr_buses").rows;
  const [date, setDate] = useState(todayIso);
  const [busId, setBusId] = useState("");
  const view = useMemo(() => trips.rows.filter((t) => t.date === date && (!busId || t.busId === busId))
    .sort(tripOrder), [trips.rows, date, busId]);

  const cols: Column<Trip>[] = [
    { key: "bus", header: "Bus", sortValue: (t) => t.bus, render: (t) => <div><div className="font-semibold">{t.bus}</div><div className="t-caption text-outline">{t.routeName}</div></div> },
    { key: "kind", header: "Trip", sortValue: (t) => t.kind, render: (t) => <Badge tone={t.kind === "pickup" ? "brand" : "neutral"}>{t.kind === "pickup" ? "Pickup" : "Drop"}</Badge> },
    { key: "status", header: "Status", sortValue: (t) => t.status, render: (t) => <Badge tone={statusTone[t.status] ?? "neutral"}>{STATUS_LABEL[t.status] ?? t.status}</Badge> },
    { key: "crew", header: "Crew", render: (t) => <div className="text-sm"><div>{t.driver || <span className="text-outline">No driver</span>}</div><div className="t-caption text-outline">{t.attendant || "No attendant"}</div></div> },
    { key: "times", header: "Started / ended", sortValue: (t) => t.startedAt ?? "", render: (t) => <span className="font-mono text-sm">{isoTime(t.startedAt)} – {isoTime(t.endedAt)}</span> },
    { key: "boarded", header: "Boarded", sortValue: (t) => t.boarded, render: (t) => <span className="font-mono">{t.boarded ?? 0} / {t.total ?? 0}</span> },
    { key: "dropped", header: "Dropped", sortValue: (t) => t.dropped, render: (t) => <span className="font-mono">{t.dropped}</span> },
    { key: "absent", header: "Absent", sortValue: (t) => t.absent, render: (t) => <span className={t.absent ? "font-mono text-warning" : "font-mono"}>{t.absent}</span> },
    { key: "checklist", header: "Checklist", render: (t) => t.kind !== "pickup" ? <span className="text-outline">—</span> : !t.checklist ? <Badge>Not done</Badge> : checklistOk(t.checklist) ? <Badge tone="success">OK</Badge> : <Badge tone="warning">{CHECK.filter((k) => !t.checklist![k]).join(", ")}</Badge> },
  ];

  return (
    <Card className="pt-4">
      <div className="mb-3 flex flex-wrap items-end gap-3 px-5">
        <Field label="Date"><Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-44" /></Field>
        {date !== todayIso() && <Button variant="ghost" size="sm" onClick={() => setDate(todayIso())}>Today</Button>}
        <Field label="Bus"><Select value={busId} onChange={(e) => setBusId(e.target.value)} className="w-48"><option value="">All buses</option>{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)} · {b.routeName}</option>)}</Select></Field>
        <p className="t-caption ml-auto text-outline">Trips are created by the driver app when the crew opens it. Click a trip for its attendance.</p>
      </div>
      {!trips.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading trips…</p> : <DataTable rows={view} columns={cols} pageSize={12} onRowClick={onOpenTrip}
        empty={<EmptyState title="No trips on this day" hint="The driver app creates the pickup and drop trips when a crew member opens it." />} />}
    </Card>
  );
}
