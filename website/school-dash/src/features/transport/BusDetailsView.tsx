"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Bus as BusIcon, Pencil } from "lucide-react";
import { Badge, Button, Card, EmptyState, Stat, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { fmtDate, inrFull } from "@/lib/format";
import type { Student } from "@/features/people/StudentsView";
import { BusAssignments } from "./BusAssignments";
import { BusForm } from "./BusForm";
import { VehicleForm } from "./VehicleForm";
import { saveBusEdit } from "./busRecords";
import { isActiveStudent, isIsoDate } from "./logic";
import { busLabel, stopsOf, t12 } from "./shared";
import { COMPLIANCE_FIELDS, EQUIPMENT_FIELDS, MAINTENANCE_FIELDS } from "./vehicleDetails";
import type { Bus, Crew } from "./types";

type DetailsField = [string, ReactNode];

function DetailsCard({ title, fields, children }: { title: string; fields?: DetailsField[]; children?: ReactNode }) {
  return <Card className="min-w-0 p-5">
    <h2 className="t-label-caps mb-4 text-on-surface-variant">{title}</h2>
    {fields && <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-5 gap-y-3 text-sm">
      {fields.map(([label, value]) => <div key={label} className="contents">
        <dt className="text-outline">{label}</dt>
        <dd className="whitespace-pre-line break-words">{value === undefined || value === null || value === "" ? "Not recorded" : value}</dd>
      </div>)}
    </dl>}
    {children}
  </Card>;
}

const dateValue = (value?: string) => value && isIsoDate(value) ? fmtDate(value) : value;

function CrewCard({ title, member, id, name }: { title: string; member?: Crew; id?: string; name?: string }) {
  return <DetailsCard title={title} fields={member || id || name ? [
    ["Name", member?.name || name || "Details unavailable"], ["Employee ID", member?.empId],
    ["Mobile number", member?.phone], ["Email", member?.email], ["Status", member?.status],
    ...(title === "Assigned driver" ? [["Driving licence number", member?.licenseNo],
      ["Licence expiry date", dateValue(member?.licenseExpiry)]] as DetailsField[] : []),
  ] : undefined}>
    {!member && !id && !name && <p className="text-sm text-on-surface-variant">Not assigned.</p>}
    {member?.staffId && <Link href={`/staff/${encodeURIComponent(member.staffId)}`} className="mt-4 inline-block text-sm font-semibold text-secondary hover:underline">View staff profile</Link>}
  </DetailsCard>;
}

export function BusDetailsView({ busId }: { busId: string }) {
  const { user } = useAuth();
  const canManage = Boolean(user?.schoolId && (user.role === "admin" || user.role === "owner"));
  const buses = useCollection<Bus>("tr_buses", canManage);
  const crew = useCollection<Crew>("tr_crew", canManage);
  const roster = useCollection<Student>("students", canManage);
  const toast = useToast();
  const [editing, setEditing] = useState<"vehicle" | "operations" | null>(null);
  const scope = JSON.stringify([user?.id, user?.schoolId, busId]);
  useLayoutEffect(() => () => setEditing(null), [scope]);

  const back = <Link href="/transport" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline">
    <ArrowLeft size={16} aria-hidden="true" /> Back to buses
  </Link>;
  if (canManage && (!buses.ready || !crew.ready || !roster.ready)) return <div>{back}<p role="status">Loading bus details…</p></div>;
  const bus = buses.rows.find((row) => row.id === busId);
  if (!bus || !canManage) return <div>{back}<Card><EmptyState title="Bus record unavailable"
    hint="The bus may have been removed or may not be available to your account." /></Card></div>;

  const students = roster.rows.filter(isActiveStudent);
  const assigned = students.filter((student) => student.busId === bus.id);
  const stops = stopsOf(bus);
  const available = Number.isFinite(bus.capacity) ? Math.max(0, bus.capacity - assigned.length) : undefined;
  const driver = crew.rows.find((member) => member.id === bus.driverId);
  const attendant = crew.rows.find((member) => member.id === bus.attendantId);

  async function save(patch: Partial<Bus>, message: string) {
    await saveBusEdit(bus!, patch, roster.rows, crew.rows);
    toast(message);
    setEditing(null);
  }

  return <div>
    {back}
    <Card className="mb-5 flex flex-wrap items-center gap-5 p-5 sm:p-6">
      <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-primary-container text-secondary"><BusIcon size={36} aria-hidden="true" /></div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="t-headline-lg">{busLabel(bus)}</h1>
          <Badge tone={bus.status === "Active" ? "success" : bus.status === "Maintenance" ? "warning" : "neutral"}>{bus.status}</Badge>
          {Number.isFinite(bus.capacity) && assigned.length > bus.capacity && <Badge tone="danger">Over capacity</Badge>}
        </div>
        <p className="mt-1 break-words text-on-surface-variant">{[bus.displayName, bus.regNo, bus.endPoint || bus.routeName].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setEditing("vehicle")}>Edit vehicle details</Button>
        <Button onClick={() => setEditing("operations")}><Pencil size={16} aria-hidden="true" />Edit bus</Button>
      </div>
    </Card>

    <div className="mb-5 grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <CrewCard title="Assigned driver" member={driver} id={bus.driverId} name={bus.driver} />
      <CrewCard title="Assigned attendant" member={attendant} id={bus.attendantId} name={bus.attendant} />
    </div>

    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Stat label="Assigned students" value={assigned.length} />
      <Stat label="Available student seats" value={available ?? "—"} />
      <Stat label="Route stops" value={stops.length} />
      <Stat label="Monthly fee per student" value={bus.monthlyFee == null ? "Not configured" : inrFull(bus.monthlyFee)} />
    </div>

    <div className="mb-5 grid min-w-0 items-start gap-4 xl:grid-cols-2">
      <div className="grid min-w-0 gap-4">
        <DetailsCard title="Vehicle details" fields={[
          ["Bus ID", bus.id], ["Bus number / Fleet number", bus.number], ["Bus name / Display name", bus.displayName],
          ["Registration number", bus.regNo], ["Vehicle type", bus.vehicleType], ["Model", bus.model],
          ["Manufacturing year", bus.manufacturingYear], ["Chassis number", bus.chassisNumber],
          ["Engine number", bus.engineNumber], ["Fuel type", bus.fuelType], ["Status", bus.status],
        ]} />
        <DetailsCard title="Route and seating" fields={[
          ["Route name", bus.routeName], ["End-point location", bus.endPoint],
          ["Pickup starts", bus.pickupStart ? t12(bus.pickupStart) : undefined], ["Drop starts", bus.dropStart ? t12(bus.dropStart) : undefined],
          ["Total seating capacity", bus.totalSeats], ["Student seating capacity", bus.capacity],
          ["Assigned students", assigned.length], ["Available student seats", available],
          ["Monthly fee per student", bus.monthlyFee == null ? "Not configured" : inrFull(bus.monthlyFee)], ["Note", bus.note],
        ]} />
        <DetailsCard title="Safety and equipment" fields={EQUIPMENT_FIELDS.map(([key, label]) =>
          [label, typeof bus[key] === "boolean" ? bus[key] ? "Yes" : "No" : undefined])} />
      </div>
      <div className="grid min-w-0 gap-4">
        <DetailsCard title="Registration and compliance" fields={COMPLIANCE_FIELDS.map(({ key, label, kind }) =>
          [label, kind === "date" ? dateValue(bus[key]) : bus[key]])} />
        <DetailsCard title="Maintenance" fields={[
          ...MAINTENANCE_FIELDS.map(({ key, label, kind }): DetailsField => [label, kind === "date" ? dateValue(bus[key] as string | undefined) : bus[key]]),
          ["Maintenance notes", bus.maintenanceNotes],
        ]} />
      </div>
    </div>

    <Card role="region" aria-label="Bus assignments" className="min-w-0 p-5">
      <h2 className="t-label-caps mb-4 text-on-surface-variant">Crew, students and stops</h2>
      <BusAssignments key={scope} bus={bus} crew={crew.rows} students={students} buses={buses.rows} onEdit={() => setEditing("operations")} />
    </Card>

    {editing === "operations" && <BusForm key={`${scope}:operations`} edit={bus} existing={buses.rows} onBus={assigned.length}
      onClose={() => setEditing(null)} onSave={async (patch) => {
        try { await save(patch, "Bus updated"); }
        catch { toast("Could not save the bus", "error"); }
      }} />}
    {editing === "vehicle" && <VehicleForm key={`${scope}:vehicle`} bus={bus} existing={buses.rows} assigned={assigned.length}
      onClose={() => setEditing(null)} onSave={(patch) => save({ ...patch,
        routeName: !bus.routeName || bus.routeName === bus.endPoint ? patch.endPoint : bus.routeName,
      }, "Vehicle details saved")} />}
  </div>;
}
