"use client";

import Link from "next/link";
import { LoadingSkeleton, Badge, Card, CardHeader, DataTable, Stat, type Column } from "@/components/ui";
import { useAdm, type SeatRow } from "./lib";
import { gradeLabel } from "./types";

const columns: Column<SeatRow>[] = [
  { key: "grade", header: "Grade or course", render: (row) => row.stream ? `Grade ${row.grade.slice(0, 2)} (${row.stream})` : gradeLabel(row.grade) },
  { key: "capacity", header: "Total", sortValue: (row) => row.capacity },
  { key: "reserved", header: "Reserved", sortValue: (row) => row.held - row.enrolled, render: (row) => row.held - row.enrolled },
  { key: "enrolled", header: "Filled", sortValue: (row) => row.enrolled },
  { key: "free", header: "Available", sortValue: (row) => row.free, render: (row) => <Badge tone={row.free > 0 ? "success" : row.free < 0 ? "danger" : "neutral"}>{row.free < 0 ? `${-row.free} over capacity` : row.free}</Badge> },
];

export function Seats() {
  const { seatRows, ready } = useAdm();
  const total = seatRows.reduce((sum, row) => sum + row.capacity, 0);
  const reserved = seatRows.reduce((sum, row) => sum + row.held - row.enrolled, 0);
  const filled = seatRows.reduce((sum, row) => sum + row.enrolled, 0);
  const available = seatRows.reduce((sum, row) => sum + Math.max(0, row.free), 0);
  if (!ready) return <LoadingSkeleton variant="table" label="Loading seats…" />;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Total seats" value={total} /><Stat label="Reserved" value={reserved} />
        <Stat label="Filled" value={filled} /><Stat label="Available" value={available} />
      </div>
      <Card>
        <CardHeader title="Seats by grade and course" subtitle="Pending and accepted offers reserve a seat until enrolment or release."
          actions={<Link href="/settings#capacity" className="font-semibold text-secondary">Configure capacity</Link>} />
        <DataTable rows={seatRows} columns={columns} pageSize={25} empty={<p className="p-5 text-on-surface-variant">No seats configured yet. Add capacity under Settings → Classes &amp; Sections.</p>} />
      </Card>
    </div>
  );
}
