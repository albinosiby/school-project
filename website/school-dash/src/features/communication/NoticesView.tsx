"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, CheckCheck, Download, Eye, FileText, Megaphone, Pencil, Pin, PinOff, Plus, Send, Siren, Smartphone, Trash2, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, LoadingSkeleton, ProgressBar, SearchBox, Select, SlideOver, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { CommHeader } from "./CommHeader";
import { Composer } from "./Composer";
import { dueScheduled, reachLabel } from "./logic";
import { downloadCsv } from "./csv";
import { fmtWhen, type LogRec, type Notice } from "./types";

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const num = (v: unknown) => Number(v) || 0;

/** "All School", "Parents by Grade · Grade 8", or for selected classes / people: "Class 8-A, Asha (8-A)" */
const audienceText = (n: Notice) => (n.targetSummary ? `To ${n.targetSummary}` : `${n.audience}${n.grades?.length ? ` · ${n.grades.join(", ")}` : ""}`);

/** colour of a category: the left bar of a row and the badge in the reading pane */
export function categoryTone(c: string): { bar: string; badge: "brand" | "success" | "warning" | "danger" | "neutral" | "info" } {
  const l = c.toLowerCase();
  if (l.includes("academic") || l.includes("event")) return { bar: "bg-secondary", badge: "brand" };
  if (l.includes("safety") || l.includes("transport")) return { bar: "bg-error", badge: "danger" };
  if (l.includes("fee")) return { bar: "bg-warning", badge: "warning" };
  if (l.includes("holiday")) return { bar: "bg-success", badge: "success" };
  if (l.includes("staff")) return { bar: "bg-primary", badge: "info" };
  return { bar: "bg-outline", badge: "neutral" };
}

/** "2h ago", "Yesterday", "12 Nov" */
function ago(iso: string) {
  const t = +new Date(iso);
  if (isNaN(t)) return "—";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 0) return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  if (m < 60) return m <= 1 ? "Just now" : `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  if (m < 2880) return "Yesterday";
  return new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Circulars & notices: the list on the left, the selected circular in a reading pane on the right. */
export function NoticesView() {
  const toast = useToast();
  const { rows, ready, update, remove } = useCollection<Notice>("com_notices");
  const log = useCollection<LogRec>("com_log");
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<string | null>(null);
  const [composer, setComposer] = useState<{ open: boolean; notice?: Notice | null }>({ open: false });

  // Scheduled notices go live once their time has passed. The publishScheduledNotices function does it every 5 minutes;
  // while this page is open the admin web also does it every minute (both check status first, so a notice is sent once).
  // The Published write then triggers the push functions.
  const done = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const tick = () => {
      for (const n of dueScheduled(rows)) {
        if (done.current.has(n.id)) continue;
        done.current.add(n.id);
        update(n.id, { status: "Published", delivered: 0, read: 0, acked: 0 })
          .then(() => log.create({ noticeId: n.id, action: "Sent (scheduled)", audience: n.audience, channels: n.channels ?? [], recipients: Number(n.recipients) || 0, at: new Date().toISOString() }))
          .catch(() => done.current.delete(n.id));
      }
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [ready, rows, update, log.create]); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    const pub = rows.filter((n) => n.status === "Published");
    const rec = pub.reduce((s, n) => s + num(n.recipients), 0), rd = pub.reduce((s, n) => s + num(n.read), 0), ak = pub.reduce((s, n) => s + num(n.acked), 0);
    return { published: pub.length, scheduled: rows.filter((n) => n.status === "Scheduled").length, drafts: rows.filter((n) => n.status === "Draft").length,
      read: pct(rd, rec), acked: pct(ak, rec) };
  }, [rows]);

  const counts = (s: string) => rows.filter((n) => s === "all" || n.status === s).length;
  const view = rows
    .filter((n) => (tab === "all" ? true : n.status === tab))
    .filter((n) => cat === "all" || n.category === cat)
    .filter((n) => !q || `${n.title} ${n.audience} ${n.category} ${n.id} ${n.body ?? ""} ${(n.grades ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.sentAt) - +new Date(a.sentAt));
  const current = rows.find((n) => n.id === sel) ?? null;
  const categories = [...new Set(rows.map((n) => n.category).filter(Boolean))].sort();

  async function act(n: Notice, what: "publish" | "delete" | "pin") {
    if (what === "delete" && !window.confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    if (what === "publish" && (!n.body?.trim() || !n.channels?.length)) { toast("Add a message and at least one channel (Edit) before sending", "error"); return; }
    try {
      if (what === "delete") { await remove(n.id); setSel(null); toast("Circular deleted"); }
      else if (what === "pin") { await update(n.id, { pinned: !n.pinned }); toast(n.pinned ? "Unpinned" : "Pinned to the top"); }
      else {
        await update(n.id, { status: "Published", sentAt: new Date().toISOString(), delivered: 0, read: 0, acked: 0 });
        await log.create({ noticeId: n.id, action: "Sent", audience: n.audience, channels: n.channels, recipients: n.recipients, at: new Date().toISOString() });
        toast("Circular published");
      }
    } catch { toast("Action failed", "error"); }
  }

  return (
    <div>
      <CommHeader active="notices" />

      {/* ---- summary */}
      <Card className="mb-4 grid grid-cols-2 divide-outline-variant/60 sm:grid-cols-5 sm:divide-x">
        <Stat label="Published" value={stats.published} icon={<Megaphone size={15} />} />
        <Stat label="Scheduled" value={stats.scheduled} icon={<CalendarClock size={15} />} />
        <Stat label="Drafts" value={stats.drafts} icon={<Pencil size={15} />} />
        <Stat label="Read rate" value={`${stats.read}%`} icon={<Eye size={15} />} />
        <Stat label="Acknowledged" value={`${stats.acked}%`} icon={<CheckCheck size={15} />} />
      </Card>

      {/* ---- filters */}
      <Card className="mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search title, audience or message…" /></div>
        <Tabs value={tab} onChange={setTab} items={[
          { id: "all", label: "All", count: counts("all") }, { id: "Published", label: "Published", count: counts("Published") },
          { id: "Scheduled", label: "Scheduled", count: counts("Scheduled") }, { id: "Draft", label: "Drafts", count: counts("Draft") },
        ]} />
        <div className="flex items-center gap-2 lg:ml-auto">
          <Select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Category" className="w-48">
            <option value="all">All categories</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Button onClick={() => setComposer({ open: true, notice: null })}><Plus size={14} />New Circular</Button>
        </div>
      </Card>

      {/* ---- list */}
      <Card className="overflow-hidden p-0">
        {!ready && <LoadingSkeleton variant="table" label="Loading circulars…" className="p-8 text-center text-on-surface-variant" />}
        {ready && view.length === 0 && <EmptyState title={rows.length ? "No circulars match" : "No circulars yet"} hint={rows.length ? "Try a different search, status or category." : "Click New Circular to send the first one."} />}
        {view.length > 0 && (
          <table className="w-full text-sm">
            <thead className="hidden border-b border-outline-variant/60 bg-surface-container-low text-left text-xs text-on-surface-variant md:table-header-group">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Circular</th>
                <th className="px-4 py-2.5 font-semibold">Audience</th>
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="w-44 px-4 py-2.5 font-semibold">Read</th>
                <th className="w-44 px-4 py-2.5 font-semibold">Acknowledged</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {view.map((n) => <Row key={n.id} n={n} onOpen={() => setSel(n.id)} />)}
            </tbody>
          </table>
        )}
      </Card>

      {/* ---- the circular, read in a side panel */}
      <SlideOver open={!!current} onClose={() => setSel(null)} title="Circular" subtitle={current ? `${current.category} · ${fmtWhen(current.sentAt)}` : undefined} width="max-w-2xl">
        {current && <Detail n={current} log={log.rows.filter((l) => l.noticeId === current.id)}
          onEdit={() => setComposer({ open: true, notice: current })} onAct={(w) => act(current, w)} />}
      </SlideOver>

      {composer.open && <Composer key={composer.notice?.id ?? "new"} open onClose={() => setComposer({ open: false })} notice={composer.notice} />}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 px-5 py-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-info-container text-secondary">{icon}</span>
      <div className="min-w-0"><div className="text-xl font-semibold leading-tight">{value}</div><div className="truncate text-xs text-on-surface-variant">{label}</div></div>
    </div>
  );
}

/** read / acknowledged share of the recipients, as a thin bar with the figure */
function Meter({ v, of, tone }: { v: number; of: number; tone: "brand" | "warning" }) {
  const p = pct(v, of);
  return (
    <div className="flex items-center gap-2">
      <ProgressBar value={p} tone={tone} className="h-1.5 flex-1" />
      <span className="w-12 shrink-0 text-right text-xs font-medium">{p}%</span>
    </div>
  );
}

function StatusBadge({ n }: { n: Notice }) {
  if (n.status === "Draft") return <Badge>Draft</Badge>;
  if (n.status === "Scheduled") return <Badge tone="warning"><CalendarClock size={12} />Scheduled</Badge>;
  return <Badge tone="success">Published</Badge>;
}

function Row({ n, onOpen }: { n: Notice; onOpen: () => void }) {
  const t = categoryTone(n.category);
  const published = n.status === "Published";
  const rec = num(n.recipients);
  return (
    <tr onClick={onOpen} className="cursor-pointer align-top hover:bg-surface-container-low md:align-middle">
      <td className="px-4 py-3.5">
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="flex w-full cursor-pointer items-start gap-3 text-left">
          <span className={cn("mt-1.5 size-2.5 shrink-0 rounded-full", n.urgent ? "bg-error" : t.bar)} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              {n.pinned && <Pin size={13} className="shrink-0 text-secondary" aria-label="Pinned" />}
              {n.urgent && <Siren size={13} className="shrink-0 text-error" aria-label="Urgent" />}
              <span className="truncate font-semibold text-on-surface">{n.title}</span>
            </span>
            <span className="mt-0.5 line-clamp-1 text-xs text-on-surface-variant">{n.category} · {(n.body ?? "").replace(/\s+/g, " ").slice(0, 90) || "No message yet"}</span>
            {/* phones: the other columns fold under the title */}
            <span className="mt-2 flex flex-wrap items-center gap-2 md:hidden"><StatusBadge n={n} /><span className="text-xs text-on-surface-variant">{audienceText(n)}</span>
              {published && <span className="text-xs text-on-surface-variant">{pct(num(n.read), rec)}% read</span>}</span>
          </span>
        </button>
      </td>
      <td className="hidden max-w-56 px-4 py-3.5 md:table-cell"><span className="line-clamp-2 text-on-surface-variant">{audienceText(n)}</span><span className="text-xs text-outline">{rec} recipients</span></td>
      <td className="hidden whitespace-nowrap px-4 py-3.5 md:table-cell"><StatusBadge n={n} /><div className="mt-1 text-xs text-outline">{n.status === "Scheduled" ? fmtWhen(n.sentAt).replace(" IST", "") : ago(n.sentAt)}</div></td>
      <td className="hidden px-4 py-3.5 md:table-cell">{published ? <Meter v={num(n.read)} of={rec} tone="brand" /> : <span className="text-xs text-outline">—</span>}</td>
      <td className="hidden px-4 py-3.5 md:table-cell">{published ? <Meter v={num(n.acked)} of={rec} tone="warning" /> : <span className="text-xs text-outline">—</span>}</td>
    </tr>
  );
}

function Detail({ n, log, onEdit, onAct }: { n: Notice; log: LogRec[]; onEdit: () => void; onAct: (w: "publish" | "delete" | "pin") => void }) {
  const t = categoryTone(n.category);
  const published = n.status === "Published";
  const rec = num(n.recipients);
  const metrics = [
    { label: "Available in app", v: num(n.delivered), tone: "success" as const },
    { label: "Read", v: num(n.read), tone: "brand" as const },
    { label: "Acknowledged", v: num(n.acked), tone: "warning" as const },
  ];
  const author = n.author || "School Office";
  return (
    <div className="min-w-0 space-y-4">
      <Card className="overflow-hidden p-0">
        <div className={cn("h-1.5", n.urgent ? "bg-error" : t.bar)} />
        <div className="p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={t.badge}>{n.category}</Badge>
            {n.urgent && <Badge tone="danger"><Siren size={12} />Urgent</Badge>}
            {n.pinned && <Badge tone="brand"><Pin size={12} />Pinned</Badge>}
            <StatusBadge n={n} />
            <div className="ml-auto flex flex-wrap gap-2">
              {!published && <Button size="sm" onClick={() => onAct("publish")}><Send size={14} />Send Now</Button>}
              <Button size="sm" variant="outline" onClick={onEdit} aria-label="Edit Notice"><Pencil size={14} />Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => onAct("pin")} aria-label={n.pinned ? "Unpin" : "Pin"}>{n.pinned ? <PinOff size={14} /> : <Pin size={14} />}</Button>
              <Button size="sm" variant="ghost" onClick={() => onAct("delete")} aria-label="Delete"><Trash2 size={14} className="text-error" /></Button>
            </div>
          </div>

          <h2 className="t-headline-md mt-4 !text-[24px] leading-snug">{n.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-on-surface-variant">
            <span className="flex items-center gap-2"><Avatar name={author.replace(/^(Dr|Mr|Mrs|Ms)\.? /, "")} size={24} /><span className="font-medium text-on-surface">{author}</span></span>
            <span className="flex items-center gap-1.5"><CalendarClock size={15} />{n.status === "Scheduled" ? "Goes out " : n.status === "Draft" ? "Created " : ""}{fmtWhen(n.sentAt)}</span>
          </div>

          <div className="mt-5 whitespace-pre-wrap rounded-xl border border-outline-variant/60 bg-surface-container-low p-5 leading-relaxed text-on-surface">
            {n.body?.trim() || <span className="text-outline">No message yet.</span>}
          </div>

          {n.attachment && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm">
              <FileText size={16} className="text-error" />{n.attachment}<span className="t-caption text-outline">{n.attachmentSize}</span>
            </div>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Info icon={<Users size={15} />} label="Audience" value={audienceText(n)} />
            <Info icon={<Smartphone size={15} />} label="Shown in" value={reachLabel(n.audience).replace(/^Shown in: /, "")} />
            <Info icon={<Megaphone size={15} />} label="Recipients" value={`${rec} · ${(n.channels ?? []).join(", ") || "No channel"}`} />
          </div>
        </div>
      </Card>

      {published && (
        <Card className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <h3 className="font-semibold">Engagement</h3>
            <span className="text-xs text-on-surface-variant">Read and acknowledged in the apps</span>
            <Button size="sm" variant="outline" className="ml-auto" onClick={() => downloadCsv(`acknowledgements-${n.id}`, ["Metric", "Count", "Percent"], [
              ["Recipients", rec, "100"], ...metrics.map((m) => [m.label, m.v, pct(m.v, rec)] as [string, number, number])])}><Download size={14} />CSV</Button>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            {metrics.map((m) => (
              <div key={m.label}>
                <div className="flex items-baseline justify-between"><span className="text-sm text-on-surface-variant">{m.label}</span><span className="font-semibold">{pct(m.v, rec)}%</span></div>
                <ProgressBar value={pct(m.v, rec)} tone={m.tone} className="mt-2" />
                <div className="mt-1 font-mono text-xs text-outline">{m.v} / {rec}</div>
              </div>
            ))}
          </div>
          <Readers id={n.id} />
        </Card>
      )}

      {log.length > 0 && (
        <Card className="p-6">
          <h3 className="mb-3 font-semibold">Activity</h3>
          <ol className="space-y-3">
            {[...log].sort((a, b) => +new Date(b.at) - +new Date(a.at)).map((l) => (
              <li key={l.id} className="flex items-center gap-3 text-sm">
                <span className="grid size-7 place-items-center rounded-full bg-info-container text-secondary"><Send size={13} /></span>
                <span className="font-medium">{l.action}</span>
                <span className="text-on-surface-variant">to {l.recipients} · {l.audience}</span>
                <span className="ml-auto text-xs text-outline">{fmtWhen(l.at)}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </div>
  );
}

function Info({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-outline-variant/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-on-surface-variant">{icon}{label}</div>
      <div className="mt-1 truncate text-sm font-medium text-on-surface" title={value}>{value}</div>
    </div>
  );
}

type Receipt = { id: string; uid: string; role: string; name?: string; readAt?: string; ackAt?: string };
type Delivery = { id: string; uid: string; role: string; name?: string };
const roleLabel: Record<string, string> = { parent: "Parent", teacher: "Teacher", driver: "Driver", attendant: "Attendant" };

/** Who read / acknowledged the circular (receipts written by functions/noticeReceipts.js) and who has not yet. */
function Readers({ id }: { id: string }) {
  const receipts = useCollection<Receipt>(`com_notices/${id}/receipts`).rows;
  const sent = useCollection<Delivery>("push_deliveries", true, [["source", "==", `notice:${id}`]]).rows;
  const [tab, setTab] = useState("read");
  const [all, setAll] = useState(false);
  const byUid = new Map(receipts.map((r) => [r.uid || r.id, r]));
  const read = [...receipts].sort((a, b) => String(b.readAt).localeCompare(String(a.readAt)));
  const acked = read.filter((r) => r.ackAt);
  const unread = sent.filter((d) => !byUid.has(d.uid)).sort((a, b) => String(a.name ?? "").localeCompare(String(b.name ?? "")));
  const rows: { key: string; name: string; role: string; when?: string; ack?: boolean }[] =
    tab === "read" ? read.map((r) => ({ key: r.id, name: r.name || "Unknown", role: r.role, when: r.readAt, ack: !!r.ackAt }))
      : tab === "acked" ? acked.map((r) => ({ key: r.id, name: r.name || "Unknown", role: r.role, when: r.ackAt, ack: true }))
        : unread.map((d) => ({ key: d.id, name: d.name || "Unknown", role: d.role }));
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <div className="mt-6 border-t border-outline-variant/50 pt-4">
      <Tabs value={tab} onChange={(t) => { setTab(t); setAll(false); }} items={[
        { id: "read", label: "Read", count: read.length }, { id: "acked", label: "Acknowledged", count: acked.length }, { id: "unread", label: "Not read yet", count: unread.length },
      ]} />
      {rows.length === 0
        ? <p className="mt-3 text-sm text-on-surface-variant">{tab === "unread" ? (sent.length ? "Everyone has read it." : "No delivery list for this circular.") : "Nobody yet."}</p>
        : <ul className="mt-3 divide-y divide-outline-variant/40">
            {shown.map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-2 text-sm">
                <Avatar name={r.name} size={28} />
                <span className="min-w-0 flex-1 truncate font-medium">{r.name}</span>
                <Badge tone={r.role === "teacher" ? "brand" : "neutral"}>{roleLabel[r.role] ?? r.role}</Badge>
                {r.ack && tab === "read" && <CheckCheck size={15} className="text-success" aria-label="Acknowledged" />}
                {r.when && <span className="w-32 shrink-0 text-right text-xs text-outline">{ago(r.when)}</span>}
              </li>
            ))}
          </ul>}
      {rows.length > 12 && <button className="mt-2 cursor-pointer text-sm font-semibold text-secondary" onClick={() => setAll((v) => !v)}>{all ? "Show less" : `Show all ${rows.length}`}</button>}
    </div>
  );
}
