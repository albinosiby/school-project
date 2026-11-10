"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui";
import { staffRoleLabels, type StaffRole } from "@/lib/staffRoles";
import { setStaffAppLogin, staffFormError, type StaffCredentials } from "./staffProfiles";

export function StaffAppLogin({ staffId, existingEmail, roles, onBusyChange, onLinked }: {
  staffId: string;
  existingEmail: string;
  roles: StaffRole[];
  onBusyChange: (busy: boolean) => void;
  onLinked: (email: string) => void;
}) {
  const emailId = useId();
  const pending = useRef(false);
  const visit = useRef<AbortController | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole | "">(roles.length === 1 ? roles[0]! : "");
  const [linkedEmail, setLinkedEmail] = useState(existingEmail);
  const [credentials, setCredentials] = useState<StaffCredentials | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");

  useLayoutEffect(() => {
    const current = new AbortController();
    visit.current = current;
    return () => {
      current.abort();
      setCredentials(null);
      setCopyMessage("");
      setConfirmReplace(false);
    };
  }, []);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (linkedEmail ? !confirmReplace : !role)) return;
    const signal = visit.current?.signal;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const result = await setStaffAppLogin(staffId, linkedEmail ? { replace: true } : { email: email.trim(), role: role as StaffRole });
      setLinkedEmail(result.email);
      onLinked(result.email);
      if (!signal?.aborted) setCredentials(result);
      setConfirmReplace(false);
    } catch (error) {
      setError(staffFormError(error));
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  async function copy() {
    if (!credentials) return;
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopyMessage("Password copied.");
    } catch {
      setCopyMessage("Select the password to copy it manually.");
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">App login</h3>
      {credentials ? <div className="space-y-3 rounded-lg border border-outline-variant p-4 text-sm">
        <div><strong>Login email</strong><div className="break-all">{credentials.email}</div></div>
        <div><div id={emailId} className="font-semibold">Generated password</div>
          <div className="flex flex-wrap items-center gap-2">
            <output aria-labelledby={emailId} className="select-all break-all font-mono">{credentials.password}</output>
            <Button type="button" size="sm" variant="outline" onClick={copy}>Copy password</Button>
          </div>
        </div>
        <p>Copy the password before closing this section.</p>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCredentials(null); setCopyMessage(""); }}>Hide password</Button>
      </div> : <form onSubmit={generate} className="space-y-3">
        {linkedEmail ? <>
          <div className="text-sm"><strong>Login email</strong><div className="break-all">{linkedEmail}</div></div>
          {confirmReplace ? <>
            <p className="text-sm">The staff member will need the new password the next time they sign in.</p>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setConfirmReplace(false); setError(""); }}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Replacing…" : "Confirm replacement"}</Button>
          </> : <Button type="button" variant="outline" onClick={() => setConfirmReplace(true)}>Replace password</Button>}
        </> : <>
          <p className="text-sm text-on-surface-variant">Optional. The login email is the username.</p>
          <Field label="Login email" required><Input type="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} disabled={busy} /></Field>
          {roles.length > 1 && <Field label="App access role" required>
            <Select required value={role} onChange={(event) => setRole(event.target.value as StaffRole)} disabled={busy}>
              <option value="">Choose an access role</option>
              {roles.map((item) => <option key={item} value={item}>{staffRoleLabels[item]}</option>)}
            </Select>
          </Field>}
          {roles.length === 1 && role && <p className="text-sm">App access role: {staffRoleLabels[role]}</p>}
          {role && <p className="text-sm text-on-surface-variant">
            {role === "teacher" || role === "hod" ? "Teacher app" : role === "driver" || role === "helper" ? "Driver app" : "Staff account for the future Staff app"}
          </p>}
          <Button type="submit" disabled={busy || !email.trim() || !role}>{busy ? "Generating…" : "Generate password"}</Button>
        </>}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </form>}
    </section>
  );
}
