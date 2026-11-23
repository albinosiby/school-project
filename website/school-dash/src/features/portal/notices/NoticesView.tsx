"use client";
// Notices (contract §2 /me/notices): published `com_notices` for staff, newest first, with the teacher app's private
// read / acknowledge state in `att_circulars/{noticeId}` (store_adapters.dart CircularsAdapter). Every staff role uses it.
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Megaphone, Paperclip, Pin } from "lucide-react";
import { Badge, Button, Card, EmptyState, Tabs, useToast } from "@/components/ui";
import type { Notice } from "@/features/communication/types";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { isoNow, portalStamp } from "../shared";
import { setPortalDoc } from "../leave/writes";

/** att_circulars/{noticeId}: the app's private per-teacher state of a notice */
export type CircularState = { id: string; teacherId: string; read?: boolean; ack?: boolean; pinned?: boolean; ackAt?: string };
/** the audiences the teacher app shows to staff (CircularsAdapter._staffAudience) */
export const STAFF_AUDIENCE = /staff|teacher|faculty|all school/i;
/** CIR-{year}-{last 4 of the id}, as the app labels a notice */
export const circularRef = (id: string, sentAt: string) => {
  const tail = id.replace(/[^A-Za-z0-9]/g, "");
  const year = sentAt.length >= 4 ? sentAt.slice(0, 4) : String(new Date().getFullYear());
  return `CIR-${year}-${tail.slice(Math.max(0, tail.length - 4)).toUpperCase()}`;
};
export const categoryOf = (c: string) => {
  const l = c.toLowerCase();
  if (l.includes("event")) return "Events";
  if (l.includes("academic")) return "Academic";
  if (/staff|holiday|fee|campus|transport/.test(l)) return "Admin";
  return "General";
};
/** published staff notices, pinned first then newest */
export function staffNotices(rows: Notice[], states: CircularState[]) {
  const st = new Map(states.map((s) => [s.id, s]));
  return rows.filter((n) => n.status === "Published" && STAFF_AUDIENCE.test(n.audience ?? ""))
    .map((n) => ({ ...n, state: st.get(n.id), isPinned: st.get(n.id)?.pinned ?? n.pinned === true }))
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || String(b.sentAt ?? "").localeCompare(String(a.sentAt ?? "")));
}

export function useStaffNotices() {
  const { staffId } = useStaffProfile();
  const notices = useCollection<Notice>("com_notices", true, [["status", "==", "Published"]] as const);
  const states = useCollection<CircularState>("att_circulars", !!staffId, [["teacherId", "==", staffId]] as const);
  const rows = useMemo(() => staffNotices(notices.rows, states.rows.filter((s) => s.teacherId === staffId)), [notices.rows, states.rows, staffId]);
  return { rows, ready: notices.ready, unread: rows.filter((n) => !n.state?.read).length };
}

export function NoticesView() {
  const { user, staffId, ready } = useStaffProfile();
  const uid = user?.id ?? "";
  const { rows, ready: loaded, unread } = useStaffNotices();
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [open, setOpen] = useState<string | null>(null);
  const view = tab === "unread" ? rows.filter((n) => !n.state?.read) : tab === "ack" ? rows.filter((n) => n.state?.ack) : rows;

  const save = async (id: string, patch: Record<string, unknown>, failure: string) => {
    try { await setPortalDoc("att_circulars", id, { id, ...patch, ...portalStamp(staffId, uid) }, true); }
    catch { toast(failure, "error"); }
  };
  const toggle = (n: (typeof rows)[number]) => {
    const next = open === n.id ? null : n.id;
    setOpen(next);
    if (next && !n.state?.read && staffId) void save(n.id, { read: true }, "Could not mark the notice as read");
  };
  const acknowledge = async (n: (typeof rows)[number]) => {
    await save(n.id, { read: true, ack: true, ackAt: isoNow() }, "Could not acknowledge the notice");
    toast("Notice acknowledged");
  };

  if (!ready || !loaded) return <p className="text-on-surface-variant">Loading…</p>;
  return (
    <div className="space-y-5">
      <div><h1 className="t-headline-lg">Notices</h1><p className="text-sm text-on-surface-variant">Circulars the office published for staff.</p></div>
      <Tabs items={[{ id: "all", label: "All", count: rows.length }, { id: "unread", label: "Unread", count: unread }, { id: "ack", label: "Acknowledged" }]} value={tab} onChange={setTab} />
      {view.length === 0 ? <Card><EmptyState title={tab === "unread" ? "You are up to date" : "No notices yet"} hint="Published circulars for staff appear here." /></Card> : (
        <div className="space-y-3">
          {view.map((n) => {
            const expanded = open === n.id;
            const read = !!n.state?.read, acked = !!n.state?.ack;
            return (
              <Card key={n.id} className="p-0">
                <button type="button" onClick={() => toggle(n)} aria-expanded={expanded} className="flex w-full cursor-pointer items-start gap-3 p-4 text-left hover:bg-surface-container-low">
                  <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-info-container text-secondary"><Megaphone size={16} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className={read ? "font-medium" : "font-semibold"}>{n.title}</span>
                      {!read && <Badge tone="brand">New</Badge>}
                      {n.urgent && <Badge tone="danger">Urgent</Badge>}
                      {n.isPinned && <Pin size={14} className="text-outline" aria-label="Pinned" />}
                      {acked && <Badge tone="success">Acknowledged</Badge>}
                    </span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">{circularRef(n.id, n.sentAt ?? "")} · {categoryOf(n.category ?? "")} · {(n.sentAt ?? "").slice(0, 10)}{n.author ? ` · ${n.author}` : ""}</span>
                  </span>
                  {expanded ? <ChevronUp size={16} className="text-outline" /> : <ChevronDown size={16} className="text-outline" />}
                </button>
                {expanded && (
                  <div className="border-t border-outline-variant/60 px-4 py-4">
                    <p className="whitespace-pre-wrap text-sm">{n.body || "—"}</p>
                    {n.attachment && <p className="mt-3 flex items-center gap-1.5 text-xs text-on-surface-variant"><Paperclip size={14} />{n.attachment}{n.attachmentSize ? ` (${n.attachmentSize})` : ""}</p>}
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="text-xs text-on-surface-variant">{acked ? `Acknowledged ${String(n.state?.ackAt ?? "").slice(0, 10)}` : "Let the office know you have read this."}</span>
                      {!acked && <Button size="sm" onClick={() => acknowledge(n)}><CheckCircle2 size={14} />Acknowledge</Button>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
