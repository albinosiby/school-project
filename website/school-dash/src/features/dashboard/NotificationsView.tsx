"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CheckCheck, Mail, MailOpen, Trash2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, SearchBox, Tabs, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { errMsg, relTime, useHydrated, TODAY, type Notif } from "./data";
import { filterNotifs, groupNotifs, notifAt, notifGroup, unreadCount } from "./logic";

const PER = 7;

export function NotificationsView() {
  const router = useRouter();
  const { rows, update, remove, ready: r0 } = useCollection<Notif>("notifications");
  const ready = useHydrated() && r0;
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const count = (c: string) => rows.filter((r) => c === "all" || r.category === c).length;
  const view = useMemo(() => filterNotifs(rows, tab, q), [rows, tab, q]);
  const pages = Math.max(1, Math.ceil(view.length / PER));
  const cur = Math.min(page, pages);
  const slice = view.slice((cur - 1) * PER, cur * PER);
  const groupOf = (n: Notif) => notifGroup(n, TODAY);
  const groups = groupNotifs(slice, TODAY);
  const unread = unreadCount(rows);

  const markAll = async (items: Notif[], label: string) => {
    const t = items.filter((n) => !n.read);
    if (!t.length) { toast("Nothing to mark — already read"); return; }
    try { await Promise.all(t.map((n) => update(n.id, { read: true }))); toast(label); } catch (e) { toast(errMsg(e), "error"); }
  };
  const safe = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); } catch (e) { toast(errMsg(e), "error"); } };
  const tabs = [{ id: "all", label: "All", count: count("all") }, { id: "urgent", label: "Urgent", count: count("urgent") }, { id: "approvals", label: "Approvals", count: count("approvals") },
    { id: "statutory", label: "Statutory", count: count("statutory") }, { id: "finance", label: "Finance", count: count("finance") }, { id: "ops", label: "Operations", count: count("ops") }];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-3"><h1 className="t-headline-lg">Notifications & Alerts</h1><Badge tone="brand"><span className="size-1.5 rounded-full bg-secondary" />Live Feed</Badge></div>
          <p className="mt-1 text-on-surface-variant">Stay informed on critical school activities, approvals, statutory timelines, and operations.</p></div>
        <Button variant="outline" onClick={() => markAll(rows, "All notifications marked as read")} disabled={!unread}><CheckCheck size={15} />Mark all as read{unread ? ` (${unread})` : ""}</Button>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
        <Tabs items={tabs} value={tab} onChange={(t) => { setTab(t); setPage(1); }} className="flex-wrap" />
        <SearchBox value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Filter alerts or keywords…" className="w-full sm:w-72" />
      </div>
      {!ready ? null : groups.length === 0 ? <Card><EmptyState title="No notifications" hint={q ? "No alerts match your filter." : "You're all caught up."} /></Card> :
        groups.map(({ g, items }) => (
          <section key={g} className="mb-6">
            <div className="mb-2 flex items-center gap-3 px-1"><h2 className="text-xs font-bold tracking-wide">{g}</h2><Badge tone="brand">{view.filter((n) => groupOf(n) === g).length} updates</Badge>
              <button className="ml-auto cursor-pointer text-sm font-semibold text-secondary" onClick={() => markAll(view.filter((n) => groupOf(n) === g), `${g.charAt(0)}${g.slice(1).toLowerCase()} marked as read`)}>Mark section as read</button></div>
            <Card className="overflow-hidden">
              {items.map((n) => (
                <div key={n.id} className={cn("group flex items-center gap-3 border-b border-outline-variant/40 px-5 py-3.5 last:border-0 hover:bg-surface-container-low", !n.read && "bg-info-container/30")}>
                  <button className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left" onClick={async () => { if (!n.read) await safe(() => update(n.id, { read: true })); if (n.href) router.push(n.href); }}>
                    <span className={cn("size-2 shrink-0 rounded-full", n.read ? "bg-transparent" : "bg-secondary")} aria-label={n.read ? "Read" : "Unread"} />
                    <span className="min-w-0 flex-1"><b className={cn(n.read && "font-semibold")}>{n.title}:</b> <span className="text-on-surface-variant">{n.body}</span>
                      {n.category === "urgent" && <Badge tone="danger" className="ml-2">Urgent</Badge>}</span>
                    <span className="shrink-0 text-xs text-outline">{relTime(notifAt(n))}</span></button>
                  <button aria-label={n.read ? "Mark unread" : "Mark read"} title={n.read ? "Mark unread" : "Mark read"} className="cursor-pointer rounded p-1.5 text-outline hover:bg-surface-container" onClick={() => safe(() => update(n.id, { read: !n.read }))}>{n.read ? <Mail size={15} /> : <MailOpen size={15} />}</button>
                  <button aria-label="Delete notification" className="cursor-pointer rounded p-1.5 text-outline hover:bg-error-container hover:text-error" onClick={() => safe(() => remove(n.id), "Notification deleted")}><Trash2 size={15} /></button>
                </div>))}
            </Card>
          </section>))}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-on-surface-variant">
        <span>Showing <b>{slice.length}</b> of <b>{view.length}</b> notifications</span>
        <div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Previous</Button><span className="font-semibold text-on-surface">Page {cur} of {pages}</span><Button variant="outline" size="sm" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</Button></div>
      </div>
    </>
  );
}
