"use client";

import { useState } from "react";
import { Badge, Button, Field, Input, Select, SlideOver } from "@/components/ui";
import { localToday } from "./checkins";
import { staffBody, validateStaff, type StaffDraft } from "./staffLogic";
import { isTeachingStaff } from "./staffProfiles";
import type { Staff } from "./StaffView";

export const legacyStaffDepartments = ["Administration", "English", "Hindi", "Mathematics", "Physical Education", "Science", "Social Science"];
const ROLES = ["Clerk", "Coordinator", "HOD", "Lab Assistant", "Teacher"];

export function LegacyStaffForm({ edit, rows, onClose, onSave, onComplete }: { edit: Staff; rows: Staff[]; onClose: () => void; onSave: (v: Partial<Staff>) => void | Promise<void>; onComplete?: () => void }) {
  const [f, setF] = useState<StaffDraft>({ name: edit.name ?? "", empId: edit.empId ?? "", department: edit.department ?? legacyStaffDepartments[0]!, role: edit.role ?? "Teacher", phone: edit.phone ?? "", email: edit.email ?? "", designation: edit.designation ?? "", subjects: edit.subjects ?? "", joined: edit.joined ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const locked = !!edit.authUid; // the login email cannot change once the account exists
  const driver = edit.staffRole === "driver" || f.role === "Driver" || f.designation === "Driver";
  const teaching = !driver && isTeachingStaff({ ...edit, role: f.role, designation: f.designation });
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    const e = validateStaff(f, rows, edit.id, localToday());
    setErr(e); if (Object.keys(e).length) return;
    const body: Partial<Staff> = staffBody(f, rows);
    if (driver) body.department = "Transport";
    if (teaching) body.subjects = f.subjects.trim();
    if (locked) body.email = edit.email; // the login email is fixed once the account exists
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title="Edit Staff" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button></>}>
      <div className="space-y-4">
        {onComplete && <Button type="button" size="sm" variant="outline" onClick={onComplete}>Complete staff profile</Button>}
        <Field label="Full name" required error={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Employee ID" hint="Auto-generated if blank" error={err.empId}><Input value={f.empId} onChange={(e) => set("empId", e.target.value)} /></Field>
        {teaching ? <Field label="Subject"><Input value={f.subjects} onChange={(e) => set("subjects", e.target.value)} placeholder="e.g. Mathematics" /></Field>
          : !driver && <Field label="Department"><Select value={f.department} onChange={(e) => set("department", e.target.value)}>{[...new Set([f.department, ...legacyStaffDepartments])].map((d) => <option key={d}>{d}</option>)}</Select></Field>}
        <Field label="Role"><Select value={f.role} disabled={!!edit.staffRole} onChange={(e) => set("role", e.target.value)}>{[...new Set([f.role, ...ROLES])].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Phone" error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email (teacher login)" required error={err.email} hint={locked ? "Login already created; the email cannot be changed here." : "Use Create login on Staff Details after saving."}>
          <Input type="email" value={f.email} disabled={locked} onChange={(e) => set("email", e.target.value)} /></Field>
        <div className="rounded-lg bg-surface-container-low p-3 text-sm"><span className="text-on-surface-variant">Account status: </span>
          {edit.authUid ? <Badge tone="success">Login active</Badge> : <Badge tone="warning">No login yet</Badge>}</div>
        <Field label="Designation"><Input value={f.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Faculty" /></Field>
        {!teaching && <Field label="Subjects"><Input value={f.subjects} onChange={(e) => set("subjects", e.target.value)} placeholder="e.g. Math & Science" /></Field>}
        <Field label="Joined" error={err.joined}><Input type="date" value={f.joined} onChange={(e) => set("joined", e.target.value)} /></Field>
      </div>
    </SlideOver>
  );
}
