"use client";
import { useEffect, useState } from "react";
import { LoadingSkeleton, Button, Field, Input } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { confirmPassword, mfaCall, mfaError, registerAdminPasskey, type MfaResult, type PasskeyStatus } from "./adminMfa";
export function AdminPasskeyCard() {
  const { user, completeAdminMfa } = useAuth();
  const [status, setStatus] = useState<PasskeyStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [password, setPassword] = useState(""), [label, setLabel] = useState("Security key / passkey");
  async function load() { try { setStatus(await mfaCall<PasskeyStatus>("status")); setError(""); } catch (e) { setError(mfaError(e)); } }
  useEffect(() => {
    if (user?.role !== "admin") return;
    let active = true;
    mfaCall<PasskeyStatus>("status").then((result) => { if (active) { setStatus(result); setError(""); } }).catch((e) => { if (active) setError(mfaError(e)); });
    return () => { active = false; };
  }, [user?.id, user?.role]);
  if (user?.role !== "admin") return null;
  async function run(action: "register" | "disable" | "removeCredential", id?: string) {
    setBusy(true); setError("");
    try {
      let result: MfaResult;
      if (action === "register") result = await registerAdminPasskey(password, label);
      else { await confirmPassword(password); result = await mfaCall<MfaResult>(action, id ? { id } : {}); }
      setPassword(""); await completeAdminMfa(result.token, result.recoveryCodes); await load();
    } catch (e) { setError(mfaError(e)); } finally { setBusy(false); }
  }
  return <div className="mt-4 space-y-3 rounded-lg border border-outline-variant/60 p-4">
    <p className="font-semibold">Hardware MFA (FIDO2)</p>{status ? <p className="text-xs text-on-surface-variant">{status.enabled ? "A passkey is required after your email and password." : "Register a security key or passkey to enable two-step sign-in."}</p> : !error && <LoadingSkeleton variant="card" label="Loading passkey settings…" />}
    {error && <div role="alert" className="space-y-2 text-sm text-error"><p>{error}</p><Button variant="outline" size="sm" onClick={() => void load()}>Retry</Button></div>}
    {status && <>
      <ul className="space-y-2">{status.credentials.map((key) => <li key={key.id} className="rounded border border-outline-variant/60 p-2 text-sm"><p className="font-medium">{key.label}</p><p className="break-all text-xs text-outline">{key.rpId}</p><Button size="sm" variant="ghost" disabled={busy || !password || status.credentials.length <= 1} onClick={() => void run("removeCredential", key.id)}>Remove passkey</Button></li>)}</ul>
      <Field label="Passkey name"><Input maxLength={80} value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <Field label="Current password" hint="Confirm your password before changing security settings."><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
      <Button variant="outline" size="sm" className="w-full" disabled={busy || !password} onClick={() => void run("register")}>{busy ? "Verifying…" : status.enabled ? "Add passkey" : "Register passkey"}</Button>
      {status.enabled && <Button variant="ghost" size="sm" className="w-full !text-error" disabled={busy || !password} onClick={() => void run("disable")}>Disable two-step sign-in</Button>}
    </>}
  </div>;
}
