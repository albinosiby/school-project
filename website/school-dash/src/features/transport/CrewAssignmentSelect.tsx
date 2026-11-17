"use client";

import { Field, Select } from "@/components/ui";
import type { Bus, Crew, CrewRole } from "./types";

export function CrewAssignmentSelect({ bus, crew, role, label, busy, error, onAssign }: {
  bus: Bus; crew: Crew[]; role: CrewRole; label: string; busy: boolean; error?: string;
  onAssign: (role: CrewRole, crewId: string) => Promise<void>;
}) {
  const id = role === "driver" ? bus.driverId : bus.attendantId;
  const name = role === "driver" ? bus.driver : bus.attendant;
  const candidates = crew.filter((member) => member.role === role && member.status !== "Inactive")
    .sort((a, b) => a.name.localeCompare(b.name));
  const current = crew.find((member) => member.id === id);
  const missing = Boolean(id && !candidates.some((member) => member.id === id));
  // Keep a missing/inactive or name-only assignment visible until explicitly changed.
  const value = id || (name ? "__legacy__" : "");
  return <Field label={label} error={error}>
    <Select value={value} disabled={busy} onChange={(event) => { void onAssign(role, event.target.value); }}>
      <option value="">Unassigned</option>
      {missing && <option value={id} disabled>{current?.name || name || "Current assignment"} (unavailable)</option>}
      {!id && name && <option value="__legacy__" disabled>{name} (legacy assignment)</option>}
      {candidates.map((member) => <option key={member.id} value={member.id}>
        {member.name}{member.empId ? ` · ${member.empId}` : ""}{member.status === "On leave" ? " · On leave" : ""}{member.busId && member.busId !== bus.id ? ` (on ${member.bus || member.busId})` : ""}
      </option>)}
    </Select>
  </Field>;
}
