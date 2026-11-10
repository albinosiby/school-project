"use client";

import { useState } from "react";
import { setDoc } from "firebase/firestore";
import { Button, Field, Modal, Select, useToast } from "@/components/ui";
import { useSchoolUsers } from "@/lib/parentAccount";
import { useCollection } from "@/lib/useCollection";
import { schoolDoc, stamp } from "./shared";

type Settings = { id: string; recipientUid?: string };

export function ExpiryReminderSettings({ onClose }: { onClose: () => void }) {
  const settings = useCollection<Settings>("tr_settings");
  const { users, ready } = useSchoolUsers();
  const toast = useToast();
  const [draft, setDraft] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const saved = settings.rows.find(({ id }) => id === "expiry_notifications")?.recipientUid ?? "";
  const admins = users.filter(({ role }) => role === "admin");
  const selected = draft ?? saved;
  const unavailable = !!selected && !admins.some(({ id }) => id === selected);
  const loaded = settings.ready && ready;
  async function save() {
    if (!loaded || saving || unavailable) return;
    setSaving(true);
    setError("");
    try {
      await setDoc(schoolDoc("tr_settings", "expiry_notifications"), {
        id: "expiry_notifications", recipientUid: selected, ...stamp(),
      }, { merge: true });
      toast("Expiry reminder settings saved");
      onClose();
    } catch { setError("Could not save the expiry reminder settings. Try again."); }
    finally { setSaving(false); }
  }

  return <Modal open onClose={() => { if (!saving) onClose(); }} title="Bus expiry reminders"
    subtitle="Choose the school administrator who will see reminders in their dashboard notifications."
    footer={<><Button variant="outline" disabled={saving} onClick={onClose}>Cancel</Button>
      <Button disabled={!loaded || saving || unavailable || selected === saved} onClick={save}>{saving ? "Saving…" : "Save settings"}</Button></>}>
    <Field label="Transport administrator" error={error} hint="Each document sends one reminder when its expiry is 30 days away or less.">
      <Select disabled={!loaded || saving} value={selected} onChange={(event) => setDraft(event.target.value)}>
        <option value="">{loaded ? "No administrator selected" : "Loading…"}</option>
        {unavailable && <option value={selected}>Previous administrator is unavailable</option>}
        {admins.map(({ id, name, email }) => <option key={id} value={id}>{[name, email].filter(Boolean).join(" · ") || id}</option>)}
      </Select>
    </Field>
  </Modal>;
}
