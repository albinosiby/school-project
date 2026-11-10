"use client";
import { useState } from "react";
import { Unlink } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Switch, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { consentGiven, setParentAppAccess, normEmail, validEmail, type Consent, type ParentCredentials, type SchoolUser } from "@/lib/parentAccount";

import { GeneratedParentPassword } from "./GeneratedParentPassword";
import { ParentPasswordField } from "./ParentPasswordField";
import type { Student } from "./StudentsView";

const fmtAt = (v: unknown) => {
  const ms = typeof v === "string" ? Date.parse(v) : typeof v === "number" ? v : (v as { toMillis?: () => number } | null)?.toMillis?.() ?? NaN;
  return isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};
const yesNo = (v?: boolean) => v === undefined ? <span className="text-outline">—</span> : v ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge>;

/** Student profile > Parent login (data contract 13.1) and consent state (13.3). */
export function ParentLoginSection({ s, students, users, consents }: { s: Student; students: Student[]; users: SchoolUser[]; consents: Map<string, Consent> }) {
  const toast = useToast();
  const admin = useAuth().user;
  const [busy, setBusy] = useState<string | null>(null);
  const [unlink, setUnlink] = useState<{ uid: string; label: string } | null>(null);
  const uids = s.guardianUids ?? [];
  const linkedParent = uids.length === 1 ? users.find((user) => user.id === uids[0] && user.role === "parent") : undefined;
  const loginEmail = normEmail(s.guardianEmail || linkedParent?.email || "");
  const pendingEmail = normEmail(s.pendingParentLoginEmail ?? "");
  const username = loginEmail || pendingEmail;
  const account = loginEmail ? users.find((u) => u.role === "parent" && uids.includes(u.id) &&
    normEmail(u.email ?? "") === loginEmail) : undefined;

  const [editAccess, setEditAccess] = useState<boolean | null>(null);
  const [email, setEmail] = useState("");
  const [accessError, setAccessError] = useState("");
  const [savingAccess, setSavingAccess] = useState(false);
  const [confirmReplacement, setConfirmReplacement] = useState(false);
  const [credentials, setCredentials] = useState<ParentCredentials | null>(null);
  const savedAccess = !!loginEmail || uids.length > 0;
  const enabled = editAccess ?? savedAccess;

  async function saveAccess(useSavedEmail = false, regenerate = false) {
    if (savingAccess) return;
    const proposedEmail = normEmail(useSavedEmail ? loginEmail : email);
    if (enabled && !validEmail(proposedEmail)) {
      setAccessError("Enter a valid login email.");
      return;
    }
    setSavingAccess(true);
    setAccessError("");
    try {
      const result = await setParentAppAccess(s.id, enabled ? { enabled: true, email: proposedEmail, ...(regenerate ? { regenerate: true } : {}) } : { enabled: false });
      setEditAccess(null);
      setEmail("");
      if (result.state === "issued") setCredentials({ email: result.email, password: result.password });
      setConfirmReplacement(false);
      if (result.state === "active") toast("Parent app access enabled.");
      if (result.state === "off") toast("Parent app access turned off for this student.");
    } catch (error) {
      const message = error instanceof Error && !/^internal(?:\s*\[\d+\])?$/i.test(error.message)
        ? error.message : "Could not reach the parent password service.";
      setAccessError(message);
      setConfirmReplacement(false);
    } finally {
      setSavingAccess(false);
    }
  }

  async function confirmUnlink() {
    if (!unlink) return;
    setBusy(unlink.uid);
    try { await setParentAppAccess(s.id, { enabled: false, unlinkUid: unlink.uid }); toast("Parent login unlinked"); setUnlink(null); } catch { toast("Could not unlink the parent login", "error"); } finally { setBusy(null); }
  }

  return (
    <section>
      <h3 className="t-label-caps mb-2 text-on-surface-variant">Parent app access</h3>
      <div className="mb-3 space-y-2">
        <div className="flex items-center gap-3">
          <fieldset disabled={savingAccess}>
            <Switch label="Enable parent app access" checked={enabled} onChange={(next) => {
              setEditAccess(next === savedAccess ? null : next);
              setEmail(next ? pendingEmail : "");
              setAccessError("");
            }} />
          </fieldset>
          <span className="text-sm">{savingAccess ? "Saving…" : savedAccess ? "Enabled" : pendingEmail ? "Setup pending" : "Off"}</span>
        </div>
        {editAccess === true && !savedAccess && <>
          <Field label="Login email" error={accessError}>
            <Input type="email" autoComplete="off" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} disabled={savingAccess} />
          </Field>
          <Button size="sm" disabled={savingAccess} onClick={() => saveAccess()}>
            {savingAccess ? "Saving…" : "Enable parent app access"}
          </Button>
        </>}
        {editAccess === false && savedAccess && <Button size="sm" variant="danger" disabled={savingAccess} onClick={() => saveAccess()}>
          {savingAccess ? "Saving…" : "Turn off access for this student"}
        </Button>}
        {accessError && editAccess !== true && <p role="alert" className="text-sm text-error">{accessError}</p>}
      </div>
      {username && <dl className="mb-3 text-sm">
        <dt className="font-semibold">Parent username</dt>
        <dd className="break-all text-on-surface-variant">{username}</dd>
      </dl>}
      {admin?.role === "admin" && enabled && account?.parentCredentialVersion && <ParentPasswordField
        key={JSON.stringify([admin.schoolId, admin.id, s.id, account.id, account.parentCredentialVersion])}
        studentId={s.id} version={account.parentCredentialVersion} />}
      {uids.length === 0 ? <p className="mb-3 text-sm text-on-surface-variant">No parent app login linked yet.</p> : (
        <ul className="mb-3 space-y-2">{uids.map((uid) => {
          const u = users.find((x) => x.id === uid);
          const c = consents.get(uid);
          const siblings = students.filter((o) => o.id !== s.id && o.guardianUids?.includes(uid)).map((o) => o.name);
          return (
            <li key={uid} className="rounded-lg border border-outline-variant/60 p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold">{u?.name || s.guardian || "Parent"}</div>
                  <div className="truncate text-on-surface-variant">{u?.email ?? <span className="font-mono text-xs text-outline">{uid}</span>}</div>
                  {!u && <Badge tone="warning">Account not found</Badge>}
                  {u && u.role !== "parent" && <Badge tone="danger">Not a parent login ({u.role})</Badge>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant="ghost" aria-label="Unlink parent login" disabled={busy === uid} onClick={() => setUnlink({ uid, label: u?.email ?? uid })}><Unlink size={14} className="text-error" />Unlink</Button>
                </div>
              </div>
              <div className="mt-2 border-t border-outline-variant/40 pt-2">
                {consentGiven(c) && c ? (
                  <dl className="grid grid-cols-[110px_1fr] gap-y-1">
                    <dt className="text-outline">Consent</dt><dd><Badge tone="success">Given</Badge> <span className="t-caption text-outline">v{String(c.version ?? "—")} · {fmtAt(c.acceptedAt)}</span></dd>
                    <dt className="text-outline">Photos</dt><dd>{yesNo(c.items?.photos)}</dd>
                    <dt className="text-outline">Notifications</dt><dd>{yesNo(c.items?.notifications)}</dd>
                  </dl>
                ) : c ? <div><span className="text-outline">Consent </span><Badge tone="danger">Withdrawn</Badge><span className="t-caption ml-1 text-outline">{fmtAt(c.acceptedAt) !== "—" ? `given ${fmtAt(c.acceptedAt)}, then withdrawn` : "withdrawn by the parent"}</span></div>
                  : <div><span className="text-outline">Consent </span><Badge tone="warning">Pending</Badge><span className="t-caption ml-1 text-outline">recorded at the parent&apos;s first sign-in</span></div>}
                {siblings.length > 0 && <p className="t-caption mt-1 text-outline">Also linked to {siblings.join(", ")}</p>}
              </div>
            </li>);
        })}</ul>)}
      {loginEmail && enabled && <div className="space-y-2">
        {account?.parentCredentialVersion
          ? <p className="t-caption text-outline">The parent signs in with the password provided by the school.</p>
          : <p className="t-caption text-outline">Generate a school-managed password for {loginEmail}.</p>}
        <Button size="sm" variant="outline" disabled={savingAccess || !!credentials}
          onClick={() => account?.parentCredentialVersion ? setConfirmReplacement(true) : void saveAccess(true)}>
          {account?.parentCredentialVersion ? "Replace parent password" : "Generate parent password"}
        </Button>
      </div>}
      <Modal open={confirmReplacement} onClose={() => { if (!savingAccess) setConfirmReplacement(false); }}
        title="Replace parent password?" subtitle={loginEmail}
        footer={<><Button variant="ghost" disabled={savingAccess} onClick={() => setConfirmReplacement(false)}>Cancel</Button>
          <Button disabled={savingAccess} onClick={() => saveAccess(true, true)}>{savingAccess ? "Replacing…" : "Replace password"}</Button></>}>
        <p className="text-on-surface-variant">The new password applies to every student linked to this parent. The parent will need it the next time they sign in.</p>
      </Modal>
      <Modal open={!!credentials} onClose={() => setCredentials(null)} title="Parent password"
        footer={<Button onClick={() => setCredentials(null)}>Done</Button>}>
        {credentials && <GeneratedParentPassword credentials={credentials} />}
      </Modal>
      <Modal open={!!unlink} onClose={() => setUnlink(null)} title="Unlink parent login?" subtitle={unlink?.label}
        footer={<><Button variant="ghost" onClick={() => setUnlink(null)}>Cancel</Button><Button variant="danger" disabled={!!unlink && busy === unlink.uid} onClick={confirmUnlink}>{unlink && busy === unlink.uid ? "Unlinking…" : "Unlink"}</Button></>}>
        <p className="text-on-surface-variant">This parent will no longer see {s.name} in the parent app. They can still sign in for any linked siblings.</p>
      </Modal>
    </section>
  );
}
