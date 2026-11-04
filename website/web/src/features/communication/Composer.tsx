"use client";
import { useMemo, useState } from "react";
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { AUDIENCES, CHANNELS, type LogRec, type Notice, type Template } from "./types";
import { useMyName } from "@/lib/useMe";
import { audienceCount, gradeLabel, reachLabel, statusOf, validateNotice, type AudienceCtx, type ComposeMode } from "./logic";

export const VARS = ["{StudentName}", "{GradeSection}", "{FeeDueAmount}", "{PTMSlotTime}"];
const CATS = ["General", "Academic & Events", "Campus Safety & Transport", "Fees & Accounts", "Holidays", "Staff"];

/** the live roster the recipient counts come from (contract: students, staff, tr_crew) */
export function useAudienceCtx(): AudienceCtx & { grades: string[] } {
  const students = useCollection<AudienceCtx["students"][number] & { id: string }>("students").rows;
  const staff = useCollection<{ id: string; status?: string }>("staff").rows;
  const crew = useCollection<{ id: string; status?: string }>("tr_crew").rows;
  const grades = useMemo(() => [...new Set(students.map((s) => String(s.grade ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [students]);
  return { students, staff, crew, grades };
}

export function Composer({ open, onClose, notice }: { open: boolean; onClose: () => void; notice?: Notice | null }) {
  const toast = useToast();
  const me = useMyName();
  const { create, update } = useCollection<Notice>("com_notices");
  const log = useCollection<LogRec>("com_log");
  const templates = useCollection<Template>("com_templates").rows;
  const ctx = useAudienceCtx();
  const [f, setF] = useState(() => init(notice));
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => { setF((p) => ({ ...p, [k]: v })); setErr((e) => (e[k] ? { ...e, [k]: "" } : e)); };
  const byGrade = f.audience === "Parents by Grade";
  const recipients = audienceCount(f.audience, ctx, byGrade ? f.grades : []);

  function save(mode: ComposeMode) {
    if (busy) return;
    const e = validateNotice(f, mode);
    setErr(e);
    if (Object.keys(e).length) return;
    const status = statusOf(mode);
    const keepLive = notice?.status === "Published" && mode === "now";
    const sentAt = keepLive ? notice!.sentAt : mode === "schedule" ? new Date(f.when).toISOString() : new Date().toISOString();
    // no delivery receipts exist yet: a published notice counts as delivered to the app feed of every recipient
    const delivered = mode === "now" ? recipients : 0;
    // nobody has read/acknowledged a notice at the moment it is sent — don't invent engagement.
    // parentVisible is never sent: the onNoticeForParents function owns it (contract 13.6)
    const body = {
      title: f.title.trim(), category: f.category, audience: f.audience, grades: byGrade ? f.grades : [], recipients, sentAt, status, pinned: f.urgent, urgent: f.urgent,
      author: `${me.name}${me.title ? ` (${me.title})` : ""}`, channels: f.channels, delivered, acked: 0, read: 0, body: f.body.trim(),
    } as Omit<Notice, "id">;
    // editing an already published notice must keep the live counters (parents' acks drive `acked`/`read` via a function)
    if (notice?.status === "Published") { const keep = body as Partial<Notice>; delete keep.acked; delete keep.read; }
    const run = async () => {
      let id = notice?.id;
      if (notice) await update(notice.id, body); else id = (await create(body)).id;
      if (mode === "now" && !keepLive) await log.create({ noticeId: id, action: "Sent", audience: f.audience, channels: f.channels, recipients, at: new Date().toISOString() });
      toast(mode === "now" ? (keepLive ? "Notice updated" : `Notice sent to ${recipients} recipients (simulated)`) : mode === "schedule" ? "Notice scheduled" : "Draft saved");
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
        <Field label="Audience" required error={err.audience} hint={`${recipients} recipient${recipients === 1 ? "" : "s"} · ${reachLabel(f.audience)}`}><Select value={f.audience} onChange={(e) => set("audience", e.target.value)}>
          {AUDIENCES.map((a) => <option key={a.label} value={a.label}>{a.label} ({audienceCount(a.label, ctx, a.label === "Parents by Grade" ? f.grades : [])})</option>)}</Select></Field>
        {byGrade && <div className="sm:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Grades<span className="text-error"> *</span></span>
          <div className="flex flex-wrap gap-3">{ctx.grades.length === 0 && <span className="text-sm text-outline">No students on the roll yet.</span>}
            {ctx.grades.map((g) => { const l = gradeLabel(g); return <label key={g} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={f.grades.includes(l)}
              onChange={(e) => set("grades", e.target.checked ? [...f.grades, l] : f.grades.filter((x) => x !== l))} />{l}</label>; })}</div>
          {err.grades && <span className="mt-1 block text-xs text-error">{err.grades}</span>}
        </div>}
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
    grades: n?.grades ?? [], body: n?.body ?? "", channels: n?.channels ?? ["Mobile App"], when: n?.status === "Scheduled" ? localInput(n.sentAt) : "", urgent: n?.urgent ?? false,
  };
}

/** ISO -> value for <input type="datetime-local"> in local time (keeps the scheduled time when editing). */
function localInput(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
