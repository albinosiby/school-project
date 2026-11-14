"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Card, Field, Input } from "@/components/ui";
import { mfaCall, mfaError, verifyAdminPasskey, type MfaResult } from "./adminMfa";
export function AdminMfaChallenge({ onComplete, onCancel }: { onComplete: (token: string) => Promise<void>; onCancel: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [recovery, setRecovery] = useState(false), [code, setCode] = useState("");
  async function verify() {
    setBusy(true); setError("");
    try { const result = recovery ? await mfaCall<MfaResult>("recover", { code }) : await verifyAdminPasskey(); await onComplete(result.token); }
    catch (e) { setError(mfaError(e)); } finally { setBusy(false); }
  }
  return <main className="grid min-h-screen place-items-center bg-surface p-5"><Card className="w-full max-w-md space-y-5 p-7">
    <ShieldCheck className="text-secondary" size={32} /><h1 className="text-2xl font-semibold">Verify administrator access</h1>
    <p className="text-sm text-on-surface-variant">{recovery ? "Enter one of the recovery codes saved when you enabled MFA. Each code works once." : "Use your registered security key or passkey to finish signing in."}</p>
    {recovery && <Field label="Recovery code"><Input autoComplete="off" value={code} onChange={(e) => setCode(e.target.value)} /></Field>}
    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <Button className="w-full" disabled={busy || (recovery && !code.trim())} onClick={() => void verify()}>{busy ? "Verifying…" : recovery ? "Use recovery code" : "Verify passkey"}</Button>
    <div className="flex flex-wrap justify-between gap-2"><Button variant="ghost" disabled={busy} onClick={() => { setRecovery(!recovery); setError(""); }}>{recovery ? "Use passkey" : "Use a recovery code"}</Button><Button variant="ghost" disabled={busy} onClick={() => void onCancel()}>Sign out</Button></div>
  </Card></main>;
}
