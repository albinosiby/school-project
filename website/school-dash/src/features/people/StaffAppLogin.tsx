"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { Button, Field, Input } from "@/components/ui";
import type { StaffRole } from "@/lib/staffRoles";
import { blankStaffLogin, revealStaffAppPassword, setStaffAppLogin, staffFormError, staffLoginInput, type StaffCredentials, type StaffLoginDraft } from "./staffProfiles";

function generatePassword() {
  const value = new Uint32Array(1);
  do { crypto.getRandomValues(value); } while (value[0]! >= 4_294_000_000);
  return String(value[0]! % 1_000_000).padStart(6, "0");
}

export function StaffLoginFields({ draft, role, onChange }: {
  draft: StaffLoginDraft;
  role?: StaffRole;
  onChange: (draft: StaffLoginDraft) => void;
}) {
  return <>
    <Field label="Login email" required hint="This email is the username.">
      <Input type="email" autoComplete="off" maxLength={254} value={draft.email} onChange={(event) => onChange({ ...draft, email: event.target.value })} />
    </Field>
    {role && <p className="text-sm text-on-surface-variant">
      {role === "teacher" || role === "hod" ? "Teacher app" : role === "driver" || role === "helper" ? "Driver app" : "Staff account for the future Staff app"}
    </p>}
    <div className="flex flex-wrap items-start gap-2">
      <Field label="Password" hint="Generate six digits or enter your own password." className="min-w-40 flex-1">
        <Input type="password" autoComplete="new-password" maxLength={128} value={draft.password}
          onChange={(event) => onChange({ ...draft, password: event.target.value })} />
      </Field>
      <Button type="button" variant="outline" className="mt-5" onClick={() => onChange({ ...draft, password: generatePassword() })}>
        Generate password
      </Button>
    </div>
  </>;
}

export function StaffAppLogin({ staffId, existingEmail, role, onBusyChange, onLinked, initialDraft = blankStaffLogin,
  issuedCredentials = null, initialError = "", onHidePassword }: {
  staffId: string;
  existingEmail: string;
  role?: StaffRole;
  onBusyChange: (busy: boolean) => void;
  onLinked: (email: string) => void;
  initialDraft?: StaffLoginDraft;
  issuedCredentials?: StaffCredentials | null;
  initialError?: string;
  onHidePassword?: () => void;
}) {
  const emailId = useId();
  const pending = useRef(false);
  const visit = useRef<AbortController | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [linkedEmail, setLinkedEmail] = useState(existingEmail);
  const [generated, setCredentials] = useState<StaffCredentials | null>(null);
  const credentials = generated ?? issuedCredentials;
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [copyMessage, setCopyMessage] = useState("");

  useLayoutEffect(() => {
    const current = new AbortController();
    visit.current = current;
    return () => {
      current.abort();
      setCredentials(null);
      setDraft((current) => ({ ...current, password: "" }));
      setCopyMessage("");
      setConfirmReplace(false);
    };
  }, []);

  async function generate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || (linkedEmail && !confirmReplace)) return;
    const signal = visit.current?.signal;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const result = await setStaffAppLogin(staffId, linkedEmail ? { replace: true } : staffLoginInput(draft, role));
      setLinkedEmail(result.email);
      onLinked(result.email);
      setDraft((current) => ({ ...current, password: "" }));
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

  async function showPassword() {
    if (pending.current) return;
    const signal = visit.current?.signal;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError("");
    try {
      const result = await revealStaffAppPassword(staffId);
      if (signal?.aborted) return;
      if (result.state === "revealed") setCredentials(result);
      else setError("This password is unavailable to view. Use Replace password to save a new one.");
    } catch (error) {
      if (!signal?.aborted) setError(staffFormError(error));
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }

  return (
    <section className="space-y-3">
      <h3 className="text-base font-semibold">App login</h3>
      {credentials ? <div className="space-y-3 rounded-lg border border-outline-variant p-4 text-sm">
        <div><strong>Login email</strong><div className="break-all">{credentials.email}</div></div>
        <div><div id={emailId} className="font-semibold">App password</div>
          <div className="flex flex-wrap items-center gap-2">
            <output aria-labelledby={emailId} className="select-all break-all font-mono">{credentials.password}</output>
            <Button type="button" size="sm" variant="outline" onClick={copy}>Copy password</Button>
          </div>
        </div>
        <p>Share this login email and password with the staff member.</p>
        {copyMessage && <p role="status">{copyMessage}</p>}
        <Button type="button" variant="ghost" size="sm" onClick={() => { setCredentials(null); setCopyMessage(""); onHidePassword?.(); }}>Hide password</Button>
      </div> : <form onSubmit={generate} className="space-y-3">
        {linkedEmail ? <>
          <div className="text-sm"><strong>Login email</strong><div className="break-all">{linkedEmail}</div></div>
          {confirmReplace ? <>
            <p className="text-sm">The staff member will need the new password the next time they sign in.</p>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setConfirmReplace(false); setError(""); }}>Cancel</Button>
            <Button type="submit" disabled={busy}>{busy ? "Replacing…" : "Confirm replacement"}</Button>
          </> : <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={showPassword}>Show password</Button>
            <Button type="button" variant="outline" disabled={busy} onClick={() => setConfirmReplace(true)}>Replace password</Button>
          </div>}
        </> : <>
          <fieldset disabled={busy} className="space-y-3">
            <StaffLoginFields draft={draft} role={role} onChange={setDraft} />
            <Button type="submit" disabled={busy || !role || !draft.email.trim()}>{busy ? "Setting up login…" : "Save app login"}</Button>
          </fieldset>
        </>}
        {error && <p role="alert" className="text-sm text-error">{error}</p>}
      </form>}
    </section>
  );
}
