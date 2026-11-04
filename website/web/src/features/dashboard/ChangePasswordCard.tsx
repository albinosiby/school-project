"use client";
import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button, Card, Field, Input, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { changePassword, passwordError, passwordErrors } from "@/lib/password";

const EMPTY = { current: "", next: "", confirm: "" };

/** My Profile: the signed-in admin changes their own password. A product owner inside a school sees where to reset it instead. */
export function ChangePasswordCard() {
  const { user } = useAuth();
  const toast = useToast();
  const [v, setV] = useState(EMPTY);
  const [errs, setErrs] = useState<ReturnType<typeof passwordErrors>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => { setV((x) => ({ ...x, [k]: e.target.value })); setErrs((x) => ({ ...x, [k]: undefined })); };

  const head = (
    <div className="mb-4 flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-lg bg-info-container text-secondary"><KeyRound size={18} /></span>
      <div><h2 className="font-semibold">Password</h2><p className="text-xs text-on-surface-variant">Change the password you sign in with</p></div>
    </div>
  );
  if (user?.role === "owner") {
    return <Card className="p-5">{head}<p className="text-sm text-on-surface-variant">You are inside this school as the platform owner. Set a new password for its admin from the owner console, on the school&apos;s page.</p></Card>;
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = passwordErrors(v);
    setErrs(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    try { await changePassword(v.current, v.next); setV(EMPTY); toast("Password changed. Use the new one next time you sign in."); }
    catch (err) {
      const msg = passwordError(err);
      if (/current password/i.test(msg)) setErrs({ current: msg }); else toast(msg, "error");
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-5">
      {head}
      <form onSubmit={submit} className="space-y-3" noValidate>
        <Field label="Current password" error={errs.current}><Input type="password" autoComplete="current-password" value={v.current} onChange={set("current")} /></Field>
        <Field label="New password" hint="At least 8 characters" error={errs.next}><Input type="password" autoComplete="new-password" value={v.next} onChange={set("next")} /></Field>
        <Field label="Confirm new password" error={errs.confirm}><Input type="password" autoComplete="new-password" value={v.confirm} onChange={set("confirm")} /></Field>
        <Button type="submit" className="w-full" disabled={saving}>{saving ? "Changing…" : "Change password"}</Button>
      </form>
    </Card>
  );
}
