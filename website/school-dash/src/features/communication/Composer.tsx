"use client";
import { useMemo, useState } from "react";
import { Button, Checkbox, Field, Input, Modal, Select, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { AUDIENCES, CHANNELS, type LogRec, type Notice, type Template } from "./types";
import { useMyName } from "@/lib/useMe";
import { TargetPicker } from "./TargetPicker";
import { resolveTargets, TARGETED, type Roster, type Target } from "./targets";
import { audienceCount, gradeLabel, placeholders, reachLabel, statusOf, validateNotice, type AudienceCtx, type ComposeMode } from "./logic";

const CATS = ["General", "Academic & Events", "Campus Safety & Transport", "Fees & Accounts", "Holidays", "Staff"];

/** the live roster the recipient counts come from (contract: students, staff, tr_crew) */
export function useAudienceCtx(): AudienceCtx & { grades: string[] } {
  const students = useCollection<AudienceCtx["students"][number] & { id: string }>("students").rows;
  const staff = useCollection<{ id: string; status?: string }>("staff").rows;
  const crew = useCollection<{ id: string; status?: string }>("tr_crew").rows;
  const grades = useMemo(() => [...new Set(students.map((s) => String(s.grade ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [students]);
  return { students, staff, crew, grades };
}

/** classes, students, staff and assignments for the class / person search */
function useRoster(): Roster {
  const classes = useCollection<Roster["classes"][number]>("classes").rows;
  const students = useCollection<Roster["students"][number]>("students").rows;
  const staff = useCollection<Roster["staff"][number]>("staff").rows;
  const assignments = useCollection<Roster["assignments"][number] & { id: string }>("assignments").rows;
  return useMemo(() => ({ classes, students, staff, assignments }), [classes, students, staff, assignments]);
}

export function Composer({ open, onClose, notice }: { open: boolean; onClose: () => void; notice?: Notice | null }) {
  const toast = useToast();
  const me = useMyName();
  const { create, update } = useCollection<Notice>("com_notices");
  const log = useCollection<LogRec>("com_log");
  const templates = useCollection<Template>("com_templates").rows;
  const ctx = useAudienceCtx();
  const roster = useRoster();
  const [f, setF] = useState(() => init(notice));
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => { setF((p) => ({ ...p, [k]: v })); setErr((e) => (e[k] ? { ...e, [k]: "" } : e)); };
  const byGrade = f.audience === "Parents by Grade";
  const targeted = f.audience === TARGETED;
  const resolved = useMemo(() => resolveTargets(f.targets, roster), [f.targets, roster]);
  const recipients = targeted ? resolved.count : audienceCount(f.audience, ctx, byGrade ? f.grades : []);

  function save(mode: ComposeMode) {
    if (busy) return;
    const e = validateNotice(f, mode);
    setErr(e);
    if (Object.keys(e).length) return;
    const status = statusOf(mode);
    const keepLive = notice?.status === "Published" && mode === "now";
    const sentAt = keepLive ? notice!.sentAt : mode === "schedule" ? new Date(f.when).toISOString() : new Date().toISOString();
    // Functions resolve registered recipients and count feed availability after publication.
    const delivered = 0;
    // nobody has read/acknowledged a notice at the moment it is sent — don't invent engagement.
    // parentVisible is never sent: the onNoticeForParents function owns it (contract 13.6)
    const body = {
      title: f.title.trim(), category: f.category, audience: f.audience, grades: byGrade ? f.grades : [], recipients, sentAt, status, pinned: f.urgent, urgent: f.urgent,
      author: `${me.name}${me.title ? ` (${me.title})` : ""}`, channels: f.channels, delivered, acked: 0, read: 0, body: f.body.trim(),
      // who a "Selected classes or people" circular reaches, resolved now (empty for the other audiences)
      targets: targeted ? f.targets : [], targetClassIds: targeted ? resolved.classIds : [], targetStudentIds: targeted ? resolved.studentIds : [],
      targetStaffIds: targeted ? resolved.staffIds : [], targetSummary: targeted ? resolved.summary : "",
    } as Omit<Notice, "id">;
    // editing an already published notice must keep the live counters (parents' acks drive `acked`/`read` via a function)
    if (notice?.status === "Published") { const keep = body as Partial<Notice>; delete keep.acked; delete keep.read; delete keep.delivered; delete keep.recipients; }
    const run = async () => {
      let id = notice?.id;
      if (notice) await update(notice.id, body); else id = (await create(body)).id;
      if (mode === "now" && !keepLive) await log.create({ noticeId: id, action: "Sent", audience: f.audience, channels: f.channels, recipients, at: new Date().toISOString() });
      toast(mode === "now" ? (keepLive ? "Notice updated" : "Notice published. Firebase push notifications are queued for registered devices.") : mode === "schedule" ? "Notice scheduled" : "Draft saved");
      onClose();
    };
    setBusy(true);
    run().catch(() => toast("Could not save notice", "error")).finally(() => setBusy(false));
  }

  const previewBody = f.body.trim() || "Your message appears here.";
  return (
    <Modal open={open} onClose={onClose} title={notice ? "Edit Circular" : "New Circular"} subtitle="Write it, choose who gets it, then send now or schedule" width="max-w-5xl"
      footer={<>
        <span className="mr-auto hidden text-sm text-on-surface-variant sm:block">{recipients} recipient{recipients === 1 ? "" : "s"} · {reachLabel(f.audience).replace(/^Shown in: /, "")}</span>
        <Button variant="ghost" disabled={busy} onClick={() => save("draft")}>Save Draft</Button>
        <Button variant="outline" disabled={busy} onClick={() => save("schedule")}>Schedule</Button>
        <Button disabled={busy} onClick={() => save("now")}>Send Now</Button>
      </>}>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Section n={1} title="Message">
            <Field label="Title" required error={err.title}><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. School closed on Monday" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category"><Select value={f.category} onChange={(e) => set("category", e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</Select></Field>
              <Field label="Template">
                <Select value="" onChange={(e) => { const t = templates.find((x) => x.id === e.target.value); if (t) set("body", t.body); }}>
                  <option value="">Apply a template…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </Select>
              </Field>
            </div>
            <Field label="Message" required error={err.body}>
              <Textarea value={f.body} onChange={(e) => set("body", e.target.value)} className="min-h-40" placeholder="Write the circular…" />
            </Field>
            {placeholders(f.body).length > 0 && !err.body && <p className="text-xs text-warning">Replace {placeholders(f.body).join(", ")} before sending: circulars are not personalised.</p>}
          </Section>

          <Section n={2} title="Who receives it">
            <Field label="Audience" required error={err.audience} hint={`${recipients} recipient${recipients === 1 ? "" : "s"} · ${reachLabel(f.audience)}`}><Select value={f.audience} onChange={(e) => set("audience", e.target.value)}>
              {AUDIENCES.map((a) => <option key={a.label} value={a.label}>{a.label}{a.label === TARGETED ? "" : ` (${audienceCount(a.label, ctx, a.label === "Parents by Grade" ? f.grades : [])})`}</option>)}</Select></Field>
            {targeted && <>
              <TargetPicker roster={roster} value={f.targets} onChange={(t) => set("targets", t)} error={err.targets} />
              <p className="text-xs text-on-surface-variant">A class reaches its students&apos; parents, the class teacher and every teacher who teaches it. A student reaches that student&apos;s parents.</p>
            </>}
            {byGrade && <div>
              <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Grades<span className="text-error"> *</span></span>
              <div className="flex flex-wrap gap-2">{ctx.grades.length === 0 && <span className="text-sm text-outline">No students on the roll yet.</span>}
                {ctx.grades.map((g) => { const l = gradeLabel(g); const on = f.grades.includes(l); return <label key={g} className={cn("flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm", on ? "border-secondary bg-info-container text-secondary" : "border-outline-variant")}><Checkbox checked={on}
                  onChange={(e) => set("grades", e.target.checked ? [...f.grades, l] : f.grades.filter((x) => x !== l))} />{l}</label>; })}</div>
              {err.grades && <span className="mt-1 block text-xs text-error">{err.grades}</span>}
            </div>}
          </Section>

          <Section n={3} title="Delivery">
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Channels</span>
              <div className="flex flex-wrap gap-4">
                {CHANNELS.map((c) => (
                  <label key={c} className="flex cursor-pointer items-center gap-2 text-sm"><Checkbox checked={f.channels.includes(c)}
                    onChange={(e) => set("channels", e.target.checked ? [...f.channels, c] : f.channels.filter((x) => x !== c))} />{c}</label>
                ))}
              </div>
              {err.channels && <span className="mt-1 block text-xs text-error">{err.channels}</span>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Schedule for (only when scheduling)" error={err.when}><Input type="datetime-local" value={f.when} onChange={(e) => set("when", e.target.value)} /></Field>
              <label className={cn("flex cursor-pointer items-center gap-2 self-end rounded-lg border px-3 py-2.5 text-sm", f.urgent ? "border-error bg-error-container text-on-error-container" : "border-outline-variant")}>
                <Checkbox checked={f.urgent} onChange={(e) => set("urgent", e.target.checked)} />Pin as urgent / emergency</label>
            </div>
          </Section>
        </div>

        {/* live preview of the app card */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="t-label-caps mb-2 !text-[11px] text-on-surface-variant">Preview in the app</div>
          <div className="rounded-[28px] border-8 border-surface-container-high bg-surface-container-low p-3 shadow-sm">
            <div className={cn("rounded-2xl border bg-surface-container-lowest p-4", f.urgent ? "border-error/60" : "border-outline-variant/60")}>
              <div className={cn("text-[10px] font-bold uppercase tracking-wide", f.urgent ? "text-error" : "text-on-surface-variant")}>{f.urgent ? "Urgent · " : ""}{f.category}</div>
              <div className="mt-1.5 font-semibold leading-snug text-on-surface">{f.title.trim() || "Circular title"}</div>
              <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-sm text-on-surface-variant">{previewBody}</p>
              <div className="mt-3 flex items-center justify-between text-[11px] text-outline"><span className="truncate">{me.name || "School Office"}</span><span>Just now</span></div>
            </div>
            <div className="mt-3 rounded-xl bg-secondary py-2 text-center text-xs font-semibold text-on-secondary">Acknowledge</div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-3 flex items-center gap-2 font-semibold"><span className="grid size-6 place-items-center rounded-full bg-secondary text-xs text-on-secondary">{n}</span>{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function init(n?: Notice | null) {
  return {
    title: n?.title ?? "", category: n?.category ?? "General", audience: n?.audience && AUDIENCES.some((a) => a.label === n.audience) ? n.audience : "All School",
    grades: n?.grades ?? [], targets: (n?.targets ?? []) as Target[], body: n?.body ?? "", channels: ["Mobile App"], when: n?.status === "Scheduled" ? localInput(n.sentAt) : "", urgent: n?.urgent ?? false,
  };
}

/** ISO -> value for <input type="datetime-local"> in local time (keeps the scheduled time when editing). */
function localInput(iso: string) {
  const d = new Date(iso);
  return isNaN(+d) ? "" : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
