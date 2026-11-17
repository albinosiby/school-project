"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { LoadingSkeleton, Button } from "@/components/ui";
import { revealParentPassword } from "@/lib/parentAccount";

export function ParentPasswordField({ studentId, version }: { studentId: string; version: string }) {
  const labelId = useId();
  const visit = useRef<AbortController | null>(null);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useLayoutEffect(() => {
    const current = new AbortController();
    visit.current = current;
    return () => {
      current.abort();
      setPassword("");
      setLoading(false);
      setMessage("");
    };
  }, [studentId, version]);

  async function show() {
    if (loading) return;
    const signal = visit.current?.signal;
    setLoading(true);
    setMessage("");
    try {
      const result = await revealParentPassword(studentId, version);
      if (signal?.aborted) return;
      if (result.state === "revealed") setPassword(result.password);
      else setMessage("This password was issued before viewing was available. Use Replace parent password to create a password you can view here.");
    } catch {
      if (!signal?.aborted) setMessage("Could not show the parent password. Refresh Student Details and try again.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }

  async function copy() {
    const signal = visit.current?.signal;
    try {
      await navigator.clipboard.writeText(password);
      if (!signal?.aborted) setMessage("Password copied.");
    } catch {
      if (!signal?.aborted) setMessage("Select the password to copy it manually.");
    }
  }

  return <div className="mb-3 space-y-1 text-sm">
    <div id={labelId} className="font-semibold">Parent password</div>
    <div className="flex flex-wrap items-center gap-2">
      <output aria-labelledby={labelId} className="select-all font-mono tracking-widest">{password || "••••••"}</output>
      {password ? <>
        <Button type="button" variant="outline" size="sm" onClick={() => { setPassword(""); setMessage(""); }}>Hide password</Button>
        <Button type="button" variant="outline" size="sm" onClick={copy}>Copy password</Button>
      </> : <Button type="button" variant="outline" size="sm" disabled={loading} onClick={show}>
        {loading ? <LoadingSkeleton variant="inline" label="Loading parent password…" /> : "Show password"}
      </Button>}
    </div>
    {message && <p role="status" className="text-on-surface-variant">{message}</p>}
  </div>;
}
