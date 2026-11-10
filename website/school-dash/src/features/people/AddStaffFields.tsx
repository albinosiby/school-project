"use client";

import { useRef, useState } from "react";
import { Button, Field, Input, Select, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { createStaffInvitation } from "@/lib/staffInvitation";
import { assignableStaffRoles, staffRoleLabels, type StaffRole } from "@/lib/staffRoles";
import { EMAIL_RE, emailTaken } from "./staffLogic";

export function AddStaffFields({ rows = [], onAdded, buttonLabel = "Add Staff", disabled = false }: {
  rows?: { id: string; email?: string }[];
  onAdded?: () => void;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  const { user } = useAuth();
  const roles = assignableStaffRoles(user);
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole | "">("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const invitation = useRef<{ key: string; id: string } | null>(null);
  const pending = useRef(false);

  if (!roles.length) return null;

  const submit = async () => {
    if (disabled || pending.current) return;
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const key = JSON.stringify([cleanName, cleanEmail, role]);
    const next: Record<string, string> = {};
    if (cleanName.length < 2 || cleanName.length > 120) next.name = "Enter a name from 2 to 120 characters.";
    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) next.email = "Enter a valid email address.";
    else if (invitation.current?.key !== key && emailTaken(rows, cleanEmail)) next.email = "Another staff member already uses this email.";
    if (!role || !roles.includes(role)) next.role = "Choose a role.";
    setErrors(next);
    if (Object.keys(next).length || !role) return;

    if (invitation.current?.key !== key) invitation.current = { key, id: crypto.randomUUID() };
    pending.current = true;
    setBusy(true);
    try {
      const sent = await createStaffInvitation({ name: cleanName, email: cleanEmail, role, invitationId: invitation.current.id });
      toast(sent ? `Login created. Password email sent to ${cleanEmail}` : "Staff account created.");
      setName("");
      setEmail("");
      setRole("");
      invitation.current = null;
      onAdded?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not add staff. Try again.";
      setErrors({ submit: message });
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  const onEnter = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") { event.preventDefault(); void submit(); }
  };

  return (
    <fieldset disabled={busy || disabled} className="min-w-0 space-y-4">
      <legend className="sr-only">Staff invitation</legend>
      <Field label="Name" required error={errors.name}><Input autoComplete="name" maxLength={120} value={name} onChange={(event) => setName(event.target.value)} onKeyDown={onEnter} /></Field>
      <Field label="Email" required error={errors.email}><Input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} onKeyDown={onEnter} /></Field>
      <Field label="Role" required error={errors.role}>
        <Select value={role} onChange={(event) => setRole(event.target.value as StaffRole | "")}>
          <option value="">Select a role</option>
          {roles.map((item) => <option key={item} value={item}>{staffRoleLabels[item]}</option>)}
        </Select>
      </Field>
      {errors.submit && <p className="text-sm text-error" role="alert">{errors.submit}</p>}
      <Button type="button" onClick={submit}>{busy ? "Adding…" : buttonLabel}</Button>
    </fieldset>
  );
}
