"use client";

import { useState } from "react";
import { Badge, Button, Card, DataTable, Field, Input, Modal, Select, Textarea, useToast, type Column, type Tone } from "@/components/ui";
import { isActiveStudent } from "@/features/transport/logic";
import { busLabel } from "@/features/transport/shared";
import type { Bus, CrewAttendance, CrewLeave } from "@/features/transport/types";
import { auth } from "@/lib/firebase";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { localToday, t12, useLeavePolicy, type StaffAttendance } from "./checkins";
import { leaveDays, recordedLeave, validateRecordLeave, type StaffLeave } from "./leaves";
import type { Staff } from "./StaffView";

const attendanceTone: Record<StaffAttendance["status"] | CrewAttendance["status"], Tone> = {
  Present: "success", Late: "warning", Leave: "info", Irregular: "warning", Absent: "danger",
};

export function StaffActivityCards({ member, designation, today, crewId, busId, crewReady }: {
  member: Pick<Staff, "id" | "staffRole" | "role">;
  designation?: string;
  today: string;
  crewId?: string;
  busId?: string;
  crewReady: boolean;
}) {
  const transportRole = [designation, member.role, member.staffRole].some((value) =>
    ["driver", "bus attendant", "bus staff", "attendant", "helper"].includes(value?.trim().toLowerCase() ?? ""));

  return <>
    <StaffAttendanceCard staffId={member.id} crewId={crewId} currentMonth={today.slice(0, 7)} />
    {(transportRole || crewId) && <StaffBusCard crewId={crewId} busId={busId} crewReady={crewReady} />}
  </>;
}

type LeaveEntry = Pick<StaffLeave, "id" | "type" | "from" | "to" | "days" | "reason" | "status" | "decisionNote">;
const leaveTone: Record<string, Tone> = { Pending: "warning", Approved: "success", Rejected: "danger", Completed: "success" };
const leaveColumns: Column<LeaveEntry>[] = [
  { key: "type", header: "Leave type", render: (leave) => <div>
    {leave.type || "—"}
    {leave.reason && <div className="t-caption text-outline">{leave.reason}</div>}
  </div> },
  { key: "dates", header: "Dates", render: (leave) => <div>
    {leave.from ? fmtDate(leave.from) : "—"}{leave.to && leave.to !== leave.from && <> – {fmtDate(leave.to)}</>}
    {leave.days != null && <div className="t-caption text-outline">{leave.days} {leave.days === 1 ? "day" : "days"}</div>}
  </div> },
  { key: "status", header: "Status", render: (leave) => <div>
    <Badge tone={leaveTone[leave.status] ?? "neutral"}>{leave.status || "—"}</Badge>
    {leave.decisionNote && <div className="t-caption text-outline">{leave.decisionNote}</div>}
  </div> },
];

export function StaffLeaveHistory({ member, crewId, today }: {
  member: Pick<Staff, "id" | "name">;
  crewId?: string;
  today: string;
}) {
  const staffId = member.id;
  const [recording, setRecording] = useState(false);
  const { update } = useCollection<Staff>("staff");
  const toast = useToast();
  const staff = useCollection<StaffLeave>("staff_leaves");
  const transport = useCollection<StaffLeave | CrewLeave>(crewId ? "tr_crew_leaves" : "staff_leaves");
  const rows = staff.rows.filter((leave) => leave.staffId === staffId).map((leave) => ({ ...leave, id: `staff:${leave.id}` }));
  if (crewId) {
    const crewRows = transport.rows.filter((leave): leave is CrewLeave => "crewId" in leave && leave.crewId === crewId);
    rows.push(...crewRows.map((leave) => ({
      id: `crew:${leave.id}`, type: leave.type, from: leave.from, to: leave.to, days: leave.days,
      reason: leave.reason, status: leave.status, decisionNote: leave.decisionNote, staffId,
    })));
  }
  rows.sort((a, b) => (b.from || "").localeCompare(a.from || ""));

  return <Card className="min-w-0 p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="t-label-caps text-on-surface-variant">Leave history</h2>
      <Button size="sm" variant="outline" disabled={!staff.ready} onClick={() => setRecording(true)}>Record leave</Button>
    </div>
    {!staff.ready || (crewId && !transport.ready) ? <p role="status" className="text-sm">Loading leave history…</p>
      : rows.length ? <DataTable rows={rows} columns={leaveColumns} pageSize={5} />
        : <p className="text-sm text-on-surface-variant">No leave recorded.</p>}
    {recording && <LeaveModal s={member} leaves={staff.rows} onClose={() => setRecording(false)} onSave={async (values) => {
      try {
        await staff.create(recordedLeave({ staffId, ...values }, auth.currentUser?.uid ?? ""));
        const includesToday = values.from <= today && values.to >= today;
        if (includesToday) {
          await update(staffId, { status: "On leave", leaveFrom: values.from, leaveTo: values.to, leaveReason: values.reason || values.type });
        }
        toast(includesToday ? `${member.name} marked on leave` : `Leave recorded for ${member.name}`);
        setRecording(false);
      } catch {
        toast("Could not record the leave", "error");
      }
    }} />}
  </Card>;
}

function StaffAttendanceCard({ staffId, crewId, currentMonth }: {
  staffId: string;
  crewId?: string;
  currentMonth: string;
}) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const month = selectedMonth || currentMonth;
  const attendance = useCollection<StaffAttendance | CrewAttendance>(crewId ? "tr_crew_attendance" : "staff_attendance");
  const rows = attendance.rows.filter((row) => {
    if (row.date?.slice(0, 7) !== month) return false;
    if (crewId) return "crewId" in row && row.crewId === crewId;
    return "staffId" in row && row.staffId === staffId;
  }).sort((a, b) => b.date.localeCompare(a.date));

  return <Card className="min-w-0 p-5">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="t-label-caps text-on-surface-variant">Attendance</h2>
      <Input type="month" aria-label="Attendance month" className="max-w-44" value={month} max={currentMonth}
        onChange={(event) => setSelectedMonth(event.target.value)} />
    </div>
    {!attendance.ready ? <p role="status" className="text-sm text-on-surface-variant">Loading attendance…</p>
      : !rows.length ? <p className="text-sm text-on-surface-variant">No attendance recorded for this month.</p>
        : <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm" aria-label="Monthly attendance">
            <thead className="text-on-surface-variant">
              <tr>
                <th scope="col" className="py-2 pr-3 font-medium">Date</th>
                <th scope="col" className="py-2 pr-3 font-medium">Check-in</th>
                <th scope="col" className="py-2 pr-3 font-medium">Check-out</th>
                <th scope="col" className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 border-t border-outline-variant/60">
              {rows.map((row) => <tr key={row.id}>
                <td className="py-2 pr-3">{fmtDate(row.date)}</td>
                <td className="py-2 pr-3">{t12(row.in)}</td>
                <td className="py-2 pr-3">{t12(row.out)}</td>
                <td className="py-2"><Badge tone={attendanceTone[row.status] ?? "neutral"}>{row.status || "—"}</Badge></td>
              </tr>)}
            </tbody>
          </table>
        </div>}
  </Card>;
}

function StaffBusCard({ crewId, busId, crewReady }: { crewId?: string; busId?: string; crewReady: boolean }) {
  const buses = useCollection<Bus>("tr_buses");
  const assigned = buses.rows.find((bus) => bus.id === busId)
    ?? buses.rows.find((bus) => crewId && (bus.driverId === crewId || bus.attendantId === crewId));

  return <Card className="min-w-0 p-5">
    <h2 className="t-label-caps mb-3 text-on-surface-variant">Assigned bus</h2>
    {!crewReady || !buses.ready ? <p role="status" className="text-sm text-on-surface-variant">Loading bus assignment…</p>
      : assigned ? <div className="space-y-1">
        <p className="text-sm font-semibold">{busLabel(assigned)}</p>
        {assigned.routeName && <p className="text-sm text-on-surface-variant">{assigned.routeName}</p>}
        <AssignedStudentCount busId={assigned.id} />
      </div> : <p className="text-sm text-on-surface-variant">No bus assigned.</p>}
  </Card>;
}

function AssignedStudentCount({ busId }: { busId: string }) {
  const students = useCollection<{ id: string; busId?: string; deleted?: boolean }>("students");
  if (!students.ready) return <p role="status" className="text-sm text-on-surface-variant">Loading student count…</p>;
  const count = students.rows.filter((student) => student.busId === busId && isActiveStudent(student)).length;
  return <p className="text-sm">{count} {count === 1 ? "student" : "students"} assigned</p>;
}

function LeaveModal({ s, leaves, onClose, onSave }: { s: Pick<Staff, "id" | "name">; leaves: StaffLeave[]; onClose: () => void; onSave: (v: { type: string; from: string; to: string; reason: string }) => Promise<void> }) {
  const today = localToday(); // local date (toISOString is UTC and gives yesterday early in the morning in India)
  const { types } = useLeavePolicy();
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today);
  const [type, setType] = useState(types[0]?.type ?? "Casual Leave"); const [reason, setReason] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const days = leaveDays(from, to);
  return (
    <Modal open onClose={onClose} title="Record leave" subtitle={s.name} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={async () => {
      const e = validateRecordLeave({ from, to, type }, leaves, s.id);
      setErr(e); if (Object.keys(e).length) return;
      setSaving(true); try { await onSave({ type, from, to, reason: reason.trim() }); } finally { setSaving(false); } }}>{saving ? "Saving…" : "Mark on leave"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" error={err.from}><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setErr({}); }} /></Field>
        <Field label="To" error={err.to ?? (from && to && to < from ? "End date is before start" : undefined)} hint={days ? `${days} day${days === 1 ? "" : "s"} (Sundays not counted)` : undefined}><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setErr({}); }} /></Field>
        <Field label="Leave type" className="sm:col-span-2" error={err.type}><Select value={type} onChange={(e) => setType(e.target.value)}>{[...new Set([...types.map((t) => t.type), type])].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Reason" className="sm:col-span-2"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Medical leave, certificate submitted" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Saved as an approved leave request: it counts against the teacher&apos;s leave balance in the app.</p>
    </Modal>
  );
}
