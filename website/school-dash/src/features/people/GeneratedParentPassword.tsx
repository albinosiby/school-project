"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import type { ParentCredentials } from "@/lib/parentAccount";

export function GeneratedParentPassword({ credentials }: { credentials: ParentCredentials }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(credentials.password);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }

  return <div className="space-y-2 rounded-lg border border-outline-variant p-3 text-sm">
    <p><strong>Parent username</strong> {credentials.email}</p>
    <p id="generated-parent-password-label" className="font-semibold">Parent password</p>
    <div className="flex flex-wrap items-center gap-3">
      <output aria-labelledby="generated-parent-password-label" className="select-all font-mono text-lg tracking-widest">{credentials.password}</output>
      <Button type="button" size="sm" variant="ghost" onClick={copy}>{copied ? "Copied" : "Copy password"}</Button>
    </div>
    {copyError && <p role="status">Select the password to copy it manually.</p>}
    <p className="text-on-surface-variant">Copy this password before closing. The parent can use it until the school replaces it.</p>
  </div>;
}
