"use client";
// Notify parent / guardian (teacher app notify_parent_sheet.dart): pick a preset, edit the message, optionally copy it
// into the chat with the guardian, send. The notice goes to `att_notices` (functions/parent.js
// `onTeacherNoticeForParents` delivers it to the parent app with a push); the chat copy is a msg_messages row in the
// teacher's thread with the student's guardians (created first when missing), exactly as /me/messages writes it.
import { useState } from "react";
import { MessageCircle, Phone, Send, UserRound } from "lucide-react";
import { Badge, Button, Modal, Switch, Textarea, useToast } from "@/components/ui";
import { useAuth } from "@/lib/authContext";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { messageDoc, threadDoc, threadIdOf, threadReadPatch, threadRole, type MessageDoc, type ThreadDoc } from "../exams";
import { NOTICE_MAX, NOTICE_TEMPLATES, dialDigits, noticeError, noticeId, noticeText, parentNotice, type NoticeTemplate } from "./logic";

export type NotifyStudent = { id: string; name: string; classId?: string; roll?: number | string; guardian?: string; phone?: string; guardianUids?: string[] };
type Ctx = {
  staffId: string; staffName: string; classLabel?: string; minimum: number;
  classes: { id: string; classTeacherId?: string }[]; assignments: { teacherId?: string; classId?: string; subject?: string }[]; roleFallback?: string;
};

/** Writes the app's teacher notice; `useNotices().log` also records a phone call (channels ["Call"]). */
export function useParentNotices(staffId: string) {
  const notices = useCollection<{ id: string; teacherId?: string }>("att_notices", !!staffId, [["teacherId", "==", staffId]]);
  const send = (v: { student: NotifyStudent; channels: string[]; message: string; template?: string }) => {
    const at = new Date();
    return notices.create({ id: noticeId(at), ...parentNotice({ studentId: v.student.id, classId: v.student.classId ?? "", channels: v.channels, message: v.message, template: v.template, staffId, at }) });
  };
  const logCall = (student: NotifyStudent) => {
    const digits = dialDigits(student.phone);
    return send({ student, channels: ["Call"], message: `Phone call placed to ${student.guardian ?? ""} (${digits})` });
  };
  return { send, logCall };
}

export function NotifyParentDialog({ student, absent, mondays, ctx, onClose }: { student: NotifyStudent | null; absent: number; mondays: number; ctx: Ctx; onClose: () => void }) {
  return <Modal open={!!student} onClose={onClose} title="Notify parent / guardian" width="max-w-lg"
    subtitle={student ? `${student.name} · Roll #${student.roll ?? "—"}${ctx.classLabel ? ` · Class ${ctx.classLabel}` : ""}` : undefined}>
    {student && <NotifyForm key={student.id} student={student} absent={absent} mondays={mondays} ctx={ctx} onClose={onClose} />}
  </Modal>;
}

function NotifyForm({ student, absent, mondays, ctx, onClose }: { student: NotifyStudent; absent: number; mondays: number; ctx: Ctx; onClose: () => void }) {
  const toast = useToast();
  const { user } = useAuth();
  const notices = useParentNotices(ctx.staffId);
  const threads = useCollection<ThreadDoc>("msg_threads", true, [["teacherId", "==", ctx.staffId]]);
  const messages = useCollection<MessageDoc>("msg_messages", true, [["teacherId", "==", ctx.staffId]]);
  const text = (t: NoticeTemplate) => noticeText(t, { name: student.name, roll: student.roll, guardian: student.guardian, classLabel: ctx.classLabel, absent, mondays, minimum: ctx.minimum });
  const [tpl, setTpl] = useState<NoticeTemplate>(mondays >= 2 ? "Monday absences" : "Low attendance");
  const [msg, setMsg] = useState(() => text(mondays >= 2 ? "Monday absences" : "Low attendance"));
  const [chat, setChat] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const chatBlocked = (student.guardianUids ?? []).length ? "" : "No parent app login yet";
  const digits = dialDigits(student.phone);
  const guardian = student.guardian?.trim() || "the guardian";
  const len = msg.trim().length;

  async function sendChat(body: string) {
    const id = threadIdOf(student.id, ctx.staffId);
    let t = threads.rows.find((row) => row.id === id);
    const now = new Date().toISOString();
    if (!t) {
      const role = threadRole(student.classId ?? "", ctx.staffId, ctx.classes, ctx.assignments, ctx.roleFallback || "Teacher");
      t = await threads.create({ id, ...threadDoc(student, ctx.staffId, ctx.staffName, role, now) } as ThreadDoc);
    }
    await messages.create(messageDoc(t, user?.id ?? "", ctx.staffName, body, now));
    await threads.update(t.id, threadReadPatch());
  }

  async function send() {
    const why = noticeError(msg);
    if (why) { setError(why); return; }
    const withChat = chat && !chatBlocked;
    setBusy(true);
    try {
      await notices.send({ student, channels: ["App", ...(withChat ? ["Chat"] : [])], message: msg, template: tpl });
      if (withChat) {
        try { await sendChat(msg.trim()); } catch { toast("Sent to the parent app, but the chat copy failed", "error"); onClose(); return; }
      }
      toast(withChat ? "Sent to the parent app and chat" : "Sent to the parent app");
      onClose();
    } catch { setError("Could not send the notice"); } finally { setBusy(false); }
  }

  return <div className="space-y-4">
    <div className="space-y-3 rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
      {(absent > 0 || mondays >= 2) && <p className="flex items-center gap-2 text-sm font-medium text-error">
        <span aria-hidden className="size-2 rounded-full bg-error" />{mondays >= 2 ? `${mondays} Monday absences recently` : `${absent} absences in this period`}
      </p>}
      <div className="flex items-center gap-2 text-sm">
        <UserRound size={16} className="text-on-surface-variant" />
        <span className="min-w-0 flex-1 truncate font-semibold">{student.guardian?.trim() || "Guardian"}</span>
        {student.phone && <span className="text-xs tabular-nums text-on-surface-variant">{student.phone}</span>}
      </div>
    </div>

    <div>
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-on-surface-variant">Message</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Message preset">
        {NOTICE_TEMPLATES.map((t) => <button key={t} type="button" role="radio" aria-checked={tpl === t} onClick={() => { setTpl(t); setMsg(text(t)); setError(""); }}
          className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
            tpl === t ? "border-secondary bg-info-container text-secondary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{t}</button>)}
      </div>
      <Textarea aria-label="Message to the parent" className="mt-3 min-h-32" value={msg} onChange={(e) => { setMsg(e.target.value); setError(""); }} placeholder="Write to the parent…" />
      <p className={cn("mt-1 text-right text-xs tabular-nums", len > NOTICE_MAX ? "text-error" : "text-on-surface-variant")}>{len} / {NOTICE_MAX}</p>
    </div>

    <div className={cn("flex items-center gap-3 rounded-lg bg-surface-container-low p-3", chatBlocked && "opacity-70")}>
      <span className={cn("grid size-9 shrink-0 place-items-center rounded-lg", chatBlocked ? "bg-surface-container text-outline" : "bg-info-container text-secondary")}><MessageCircle size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">Also send in chat</p>
        <p className="text-xs text-on-surface-variant">{chatBlocked ? `${chatBlocked} — chat not available` : `Posts the same message in your chat with ${guardian}`}</p>
      </div>
      {chatBlocked ? <Badge tone="neutral">Off</Badge> : <Switch checked={chat} onChange={setChat} label="Also send in chat" />}
    </div>

    {error && <p role="alert" className="text-sm text-error">{error}</p>}
    <div className="flex flex-col-reverse gap-2 sm:flex-row">
      {digits ? <a href={`tel:${digits}`} onClick={() => { void notices.logCall(student).catch(() => {}); }}
        className="inline-flex h-10 items-center justify-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-on-surface hover:bg-surface-container-low sm:flex-1">
        <Phone size={16} />Call
      </a> : <Button variant="outline" disabled className="sm:flex-1"><Phone size={16} />No phone on file</Button>}
      <Button className="sm:flex-[2]" disabled={busy} onClick={send}><Send size={16} />Send notification now</Button>
    </div>
  </div>;
}
