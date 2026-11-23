"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { runTransaction } from "firebase/firestore";
import { LoadingSkeleton, Badge, Button, Card, DataTable, EmptyState, useToast, type Column, type Tone } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import type { Student } from "@/features/people/StudentsView";
import { busLabel, schoolDoc, stamp, stopsOf } from "./shared";
import { isActiveStudent, nextBusId } from "./logic";
import type { Bus, BusStatus } from "./types";
import { busDetailsHref } from "./busRecords";
import { VehicleForm } from "./VehicleForm";

const statusTone: Record<BusStatus, Tone> = { Active: "success", Maintenance: "warning", Inactive: "neutral" };

export function BusesPanel() {
  const router = useRouter();
  const toast = useToast();
  const buses = useCollection<Bus>("tr_buses");
  const roster = useCollection<Student>("students");
  const students = roster.rows.filter(isActiveStudent);
  const [adding, setAdding] = useState(false);
  const onBus = (busId: string) => students.filter((student) => student.busId === busId);

  const cols: Column<Bus>[] = [
    { key: "number", header: "Bus", sortValue: (b) => Number(b.number) || b.number, render: (b) => <div><Link href={busDetailsHref(b.id)} onClick={(event) => event.stopPropagation()} className="font-semibold text-secondary hover:underline">{busLabel(b)}</Link><div className="t-caption text-outline">{[b.displayName, b.model].filter(Boolean).join(" · ") || "—"}</div></div> },
    { key: "regNo", header: "Reg no", sortValue: (b) => b.regNo, render: (b) => <span className="font-mono text-sm">{b.regNo}</span> },
    { key: "route", header: "Route", sortValue: (b) => b.endPoint || b.routeName, render: (b) => <div>{b.endPoint || b.routeName}
      {stopsOf(b).length > 0 && <div className="t-caption text-outline">{stopsOf(b).length} stops</div>}</div> },
    { key: "capacity", header: "Capacity", sortValue: (b) => b.capacity, render: (b) => b.capacity },
    { key: "driver", header: "Driver", sortValue: (b) => b.driver ?? "", render: (b) => b.driver || <span className="text-outline">Unassigned</span> },
    { key: "attendant", header: "Attendant", sortValue: (b) => b.attendant ?? "", render: (b) => b.attendant || <span className="text-outline">Unassigned</span> },
    { key: "students", header: "Students", sortValue: (b) => onBus(b.id).length, render: (b) => { const n = onBus(b.id).length; return <span className={n > b.capacity ? "font-semibold text-error" : ""}>{n}{b.capacity ? ` / ${b.capacity}` : ""}</span>; } },
    { key: "status", header: "Status", sortValue: (b) => b.status, render: (b) => <Badge tone={statusTone[b.status] ?? "neutral"}>{b.status}</Badge> },
  ];

  return <>
    <Card className="pt-4">
      <p className="px-5 pb-3 text-on-surface-variant">Click a bus to view its details, crew, students and stops.</p>
      {buses.ready && roster.ready ? <DataTable rows={buses.rows} columns={cols} pageSize={10} onRowClick={(bus) => router.push(busDetailsHref(bus.id))}
        searchText={(bus) => `${bus.number} ${bus.regNo} ${bus.displayName ?? ""} ${bus.endPoint ?? ""} ${bus.routeName} ${bus.driver ?? ""} ${bus.attendant ?? ""}`}
        toolbarActions={<Button onClick={() => setAdding(true)}><Plus size={16} />Add Bus</Button>}
        empty={<EmptyState title="No buses yet" hint="Add a bus with its vehicle details and route end point." />} />
        : <LoadingSkeleton variant="table" label="Loading buses…" className="px-5 pb-5 text-on-surface-variant" />}
    </Card>
    {adding && <VehicleForm existing={buses.rows} assigned={0} onClose={() => setAdding(false)} onSave={async (values) => {
      const id = nextBusId(buses.rows.map((bus) => bus.id));
      const ref = schoolDoc("tr_buses", id);
      await runTransaction(db, async (transaction) => {
        if ((await transaction.get(ref)).exists()) throw new Error("Another bus was just added. Check the form and try again.");
        transaction.set(ref, {
          ...values, id, routeName: values.endPoint, stops: [], pickupStart: "", dropStart: "",
          status: "Active", studentCount: 0, _o: Date.now(), ...stamp(),
        });
      });
      toast("Bus added");
      setAdding(false);
    }} />}
  </>;
}
