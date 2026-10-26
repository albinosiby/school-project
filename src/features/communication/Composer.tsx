"use client";
import { useState } from "react";
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { AUDIENCES, CHANNELS, type LogRec, type Notice, type Template } from "./types";
import { useMyName } from "@/lib/useMe";

export const VARS = ["{StudentName}", "{GradeSection}", "{FeeDueAmount}", "{PTMSlotTime}"];
const CATS = ["General", "Academic & Events", "Campus Safety & Transport", "Fees & Accounts", "Holidays", "Staff"];

export function Composer({ open, onClose, notice }: { open: boolean; onClose: () => void; notice?: Notice | null }) {
  const toast = useToast();
  const me = useMyName();
  const { create, update } = useCollection<Notice>("com_notices");
  const log = useCollection<LogRec>("com_log");
  const templates = useCollection<Template>("com_templates").rows;
  const [f, setF] = useState(() => init(notice));
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setF((p) => ({ ...p, [k]: v }));

  function save(mode: "now" | "schedule" | "draft") {
    if (busy) return;
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = "Title is required";
    if (mode !== "draft" && !f.body.trim()) e.body = "Message body is required";
    if (mode !== "draft" && f.channels.length === 0) e.channels = "Select at least one channel";
    if (mode === "schedule" && (!f.when || new Date(f.when) <= new Date())) e.when = "Pick a future date and time";
    setErr(e);
    if (Object.keys(e).length) return;
    const aud = AUDIENCES.find((a) => a.label === f.audience)!;
    const recipients = f.audience === "Parents by Grade" ? aud.count : aud.count;
    const status = mode === "now" ? "Published" : mode === "schedule" ? "Scheduled" : "Draft";
    const sentAt = mode === "schedule" ? new Date(f.when).toISOString() : new Date().toISOString();
    const delivered = mode === "now" ? Math.round(recipients * 0.99) : 0;
    // nobody has read/acknowledged a notice at the moment it is sent — don't invent engagement
    const body = {
      title: f.title.trim(), category: f.category, audience: f.audience, recipients, sentAt, status, pinned: f.urgent, urgent: f.urgent,
      author: `${me.name}${me.title ? ` (${me.title})` : ""}`, channels: f.channels, delivered, acked: 0, read: 0, body: f.body,
    } as Omit<Notice, "id">;
    const run = async () => {
      let id = notice?.id;
      if (notice) await update(notice.id, body); else id = (await create(body)).id;
      if (mode === "now") await log.create({ noticeId: id, action: "Sent", audience: f.audience, channels: f.channels, recipients, at: new Date().toISOString() });
      toast(mode === "now" ? `Notice sent to ${recipients} recipients (simulated)` : mode === "schedule" ? "Notice scheduled" : "Draft saved");
      onClose();
    };
    setBusy(true);
    run().catch(() => toast("Could not save notice", "error")).finally(() => setBusy(false));
  }

  return (
    <Modal open={open} onClose={onClose} title={notice ? "Edit Notice" : "Compose Notice"} subtitle="Audience, channels and delivery time" width="max-w-2xl"
      footer={<>
        <Button variant="ghost" disabled={busy} onClick={() => save("draft")}>Save Draft</Button>
        <Button variant="outline" disabled={busy} onClick={() => save("schedule")}>Schedule</Button>
        <Button disabled={busy} onClick={() => save("now")}>Send Now</Button>
      </>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Title" required error={err.title} className="sm:col-span-2"><Input value={f.title} onChange={(e) => set("title", e.target.value)} /></Field>
        <Field label="Category"><Select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
        <Field label="Audience"><Select value={f.audience} onChange={(e) => set("audience", e.target.value)}>{AUDIENCES.map((a) => <option key={a.label} value={a.label}>{a.label} ({a.count})</option>)}</Select></Field>
        <Field label="Template" className="sm:col-span-2">
          <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) set("body", t.body); }}>
            <option value="">Apply a template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </Select>
        </Field>
        <Field label="Message" required error={err.body} className="sm:col-span-2">
          <Textarea value={f.body} onChange={(e) => set("body", e.target.value)} />
        </Field>
        <div className="sm:col-span-2 flex flex-wrap gap-2">
          {VARS.map((v) => <button key={v} type="button" onClick={() => set("body", f.body + v)} className="cursor-pointer rounded bg-surface-container px-2 py-1 font-mono text-xs text-on-surface-variant hover:bg-surface-container-high">{v}</button>)}
        </div>
        <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Channels</span>
          <div className="flex flex-wrap gap-4">
            {CHANNELS.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={f.channels.includes(c)}
                onChange={(e) => set("channels", e.target.checked ? [...f.channels, c] : f.channels.filter((x) => x !== c))} />{c}</label>
            ))}
          </div>
          {err.channels && <span className="mt-1 block text-xs text-error">{err.channels}</span>}
        </div>
        <Field label="Schedule for (only when scheduling)" error={err.when}><Input type="datetime-local" value={f.when} onChange={(e) => set("when", e.target.value)} /></Field>
        <label className="flex cursor-pointer items-center gap-2 self-end pb-2 text-sm"><Checkbox checked={f.urgent} onChange={(e) => set("urgent", e.target.checked)} />Pin as urgent / emergency</label>
      </div>
    </Modal>
  );
}

function init(n?: Notice | null) {
  return {
    title: n?.title ?? "", category: n?.category ?? "General", audience: n?.audience && AUDIENCES.some((a) => a.label === n.audience) ? n.audience : "All School",
    body: n?.body ?? "", channels: n?.channels ?? ["Mobile App"], when: n?.status === "Scheduled" ? localInput(n.sentAt) : "", urgent: n?.urgent ?? false,
  };
}

/** ISO -> value for <input type="datetime-local"> in local time (keeps the scheduled time when editing). */
function localInput(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
