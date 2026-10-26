"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Check, Download, FileText, Mail, MoreVertical, Pin, Plus, Send, Siren, Timer, TriangleAlert, Zap } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Modal, ProgressBar, SearchBox, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { CommHeader } from "./CommHeader";
import { Composer, VARS } from "./Composer";
import { downloadCsv } from "./csv";
import { AUDIENCES, CHANNELS, fmtWhen, type LogRec, type Notice, type Report, type Template } from "./types";
import { useMyName } from "@/lib/useMe";

const chTone: Record<string, string> = { WhatsApp: "bg-success-container text-success", "Mobile App": "bg-info-container text-secondary", "SMS Gateway": "bg-surface-container text-on-surface-variant" };
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

export function NoticesView() {
  const toast = useToast();
  const { rows, ready, update, remove, create } = useCollection<Notice>("com_notices");
  const log = useCollection<LogRec>("com_log");
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const [composer, setComposer] = useState<{ open: boolean; notice?: Notice | null }>({ open: false });
  const [ack, setAck] = useState<Notice | null>(null);

  const stats = useMemo(() => {
    const pub = rows.filter((n) => n.status === "Published");
    const rec = pub.reduce((s, n) => s + n.recipients, 0), del = pub.reduce((s, n) => s + n.delivered, 0), rd = pub.reduce((s, n) => s + n.read, 0);
    return { delivery: pct(del, rec), read: pct(rd, del), scheduled: rows.filter((n) => n.status === "Scheduled").length };
  }, [rows]);
  const reports = useCollection<Report>("com_reports").rows;
  const due = reports.filter((r) => r.tag.startsWith("Mandatory")).length;

  const counts = (s: string) => rows.filter((n) => s === "all" || n.status === s).length;
  const view = rows
    .filter((n) => (tab === "all" ? true : n.status === tab))
    .filter((n) => !q || `${n.title} ${n.audience} ${n.category} ${n.id} ${(n.grades ?? []).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) || +new Date(b.sentAt) - +new Date(a.sentAt));

  async function resend(n: Notice) {
    const unread = n.recipients - (n.acked ?? 0);
    // only logs the resend; acknowledgements come from the parent app (com_notices/{id}/acks, counted into `acked` by a function)
    try {
      await log.create({ noticeId: n.id, action: "Resent to unread", audience: n.audience, channels: n.channels, recipients: unread, at: new Date().toISOString() });
      toast(`Resent to ${unread} unread recipients (simulated)`);
    } catch { toast("Could not resend", "error"); }
  }
  async function act(n: Notice, what: "publish" | "delete" | "pin") {
    if (what === "delete" && !window.confirm(`Delete "${n.title}"? This cannot be undone.`)) return;
    if (what === "publish" && (!n.body?.trim() || !n.channels?.length)) { toast("Add a message and at least one channel (Edit Notice) before sending", "error"); return; }
    try {
      if (what === "delete") { await remove(n.id); toast("Notice deleted"); }
      else if (what === "pin") { await update(n.id, { pinned: !n.pinned }); toast(n.pinned ? "Notice unpinned" : "Notice pinned"); }
      else { await update(n.id, { status: "Published", sentAt: new Date().toISOString(), delivered: Math.round(n.recipients * 0.99), read: 0, acked: 0 });
        await log.create({ noticeId: n.id, action: "Sent", audience: n.audience, channels: n.channels, recipients: n.recipients, at: new Date().toISOString() }); toast("Notice published (simulated send)"); }
    } catch { toast("Action failed", "error"); }
  }

  return (
    <div>
      <CommHeader active="notices" />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Delivery rate (published)" icon={<Check size={16} />} tone="success"><span className="t-headline-md !text-3xl">{stats.delivery}%</span></Kpi>
        <Kpi label="Avg parent read receipt" icon={<Mail size={16} />} tone="info"><span className="t-headline-md !text-3xl">{stats.read}%</span><Badge tone={stats.read >= 80 ? "success" : "warning"} className="ml-2">{stats.read >= 80 ? "High" : "Low"}</Badge></Kpi>
        <Kpi label="Scheduled circulars" icon={<Timer size={16} />} tone="info"><span className="t-headline-md !text-3xl">{stats.scheduled} Pending</span></Kpi>
        <Kpi label="Mandatory statutory reports" icon={<TriangleAlert size={16} />} tone="danger"><span className="t-headline-md !text-3xl">{due} Reports</span></Kpi>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-3">
            <SearchBox value={q} onChange={setQ} placeholder="Search notices by title, grade, recipient or ID..." className="w-full max-w-xs" />
            <Tabs value={tab} onChange={setTab} items={[
              { id: "all", label: "All", count: counts("all") }, { id: "Published", label: "Published", count: counts("Published") },
              { id: "Scheduled", label: "Scheduled", count: counts("Scheduled") }, { id: "Draft", label: "Draft", count: counts("Draft") },
            ]} />
            <Button className="ml-auto" size="sm" onClick={() => setComposer({ open: true, notice: null })}><Plus size={14} />New Notice</Button>
          </Card>
          {!ready && <Card><p className="p-8 text-center text-on-surface-variant">Loading notices…</p></Card>}
          {ready && view.length === 0 && <Card><EmptyState title="No notices found" hint="Try a different search or filter, or compose a new notice." /></Card>}
          {view.map((n) => <NoticeCard key={n.id} n={n}
            onEdit={() => setComposer({ open: true, notice: n })} onAck={() => setAck(n)} onResend={() => resend(n)} onAct={(w) => act(n, w)} />)}
        </div>

        <div className="space-y-5">
          <QuickBroadcast onCreate={create} log={log.create} />
          <QuickReports />
        </div>
      </div>

      {composer.open && <Composer key={composer.notice?.id ?? "new"} open onClose={() => setComposer({ open: false })} notice={composer.notice} />}
      <Modal open={!!ack} onClose={() => setAck(null)} title="Acknowledgements" subtitle={ack?.title}
        footer={ack && <Button variant="outline" onClick={() => { downloadCsv(`acknowledgements-${ack.id}`, ["Metric", "Count", "Percent"], [
          ["Recipients", ack.recipients, "100"], ["Delivered", ack.delivered, pct(ack.delivered, ack.recipients)], ["Read", ack.read, pct(ack.read, ack.recipients)], ["Acknowledged", ack.acked ?? 0, pct(ack.acked ?? 0, ack.recipients)]]); }}><Download size={14} />Download CSV</Button>}>
        {ack && <div className="space-y-4">
          {([["Delivered", ack.delivered, "success"], ["Read", ack.read, "brand"], ["Acknowledged", ack.acked ?? 0, "warning"]] as const).map(([l, v, t]) => (
            <div key={l}><div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="font-mono">{v} / {ack.recipients} ({pct(v, ack.recipients)}%)</span></div><ProgressBar value={pct(v, ack.recipients)} tone={t} /></div>
          ))}
          <p className="text-on-surface-variant">Unread recipients: {ack.recipients - ack.read}</p>
        </div>}
      </Modal>
    </div>
  );
}

function Kpi({ label, icon, tone, children }: { label: string; icon: React.ReactNode; tone: "success" | "info" | "danger"; children: React.ReactNode }) {
  const t = { success: "bg-success-container text-success", info: "bg-info-container text-secondary", danger: "bg-error-container text-error" }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-2"><span className="t-label-caps text-on-surface-variant">{label}</span><span className={cn("grid size-8 place-items-center rounded-full", t)}>{icon}</span></div>
      <div className="mt-4 flex items-end">{children}</div>
    </Card>
  );
}

function NoticeCard({ n, onEdit, onAck, onResend, onAct }: { n: Notice; onEdit: () => void; onAck: () => void; onResend: () => void; onAct: (w: "publish" | "delete" | "pin") => void }) {
  const [menu, setMenu] = useState(false);
  const published = n.status === "Published";
  return (
    <Card className={cn("relative overflow-hidden p-5", n.urgent && published && "border-error/50 border-2")}>
      <div className="flex flex-wrap items-center gap-2">
        {n.pinned && <Badge tone="danger" className="uppercase"><Siren size={12} />{n.urgent ? "Pinned Emergency" : "Pinned"}</Badge>}
        <span className="rounded bg-surface-container px-2 py-1 text-xs font-semibold text-on-surface">{n.category}</span>
        <span className="text-outline">Target: {n.audience} ({n.recipients})</span>
        {!published && <Badge tone={n.status === "Draft" ? "neutral" : "warning"}>{n.status}</Badge>}
        <span className="ml-auto t-caption text-on-surface-variant">{n.status === "Scheduled" ? "Goes out " : ""}{fmtWhen(n.sentAt)}</span>
      </div>
      <h3 className="t-headline-md mt-3 !text-[20px]">{n.title}</h3>
      {n.grades && <div className="mt-2 flex flex-wrap gap-1.5">{n.grades.map((g) => <span key={g} className="rounded bg-surface-container px-2 py-0.5 text-xs text-on-surface-variant">{g}</span>)}</div>}
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <Avatar name={n.author.replace(/^(Dr|Mr|Mrs|Ms)\.? /, "")} size={24} /><span className="font-medium">{n.author}</span>
        <span className="text-outline">•</span><span className="text-outline">Channels:</span>
        {n.channels.map((c) => <span key={c} className={cn("rounded px-1.5 py-0.5 text-xs font-medium", chTone[c])}>{c}</span>)}
        {published && n.grades && <><span className="text-outline">•</span><span className="font-semibold text-success">{n.read} Read / {n.recipients} ({pct(n.read, n.recipients)}% Engagement)</span><span className="text-outline">•</span><span className="font-semibold text-secondary">{n.acked ?? 0} Acknowledged ({pct(n.acked ?? 0, n.recipients)}%)</span></>}
      </div>
      {published && !n.grades && (
        <div className="mt-4 flex flex-wrap items-center gap-6 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4">
          <div><div className="text-xs text-on-surface-variant">Delivery Success</div><div className="font-semibold"><span className="font-mono">{n.delivered} / {n.recipients}</span> <span className="text-success">({pct(n.delivered, n.recipients)}%)</span></div></div>
          <div><div className="text-xs text-on-surface-variant">Acknowledged Receipts</div><div className="font-semibold"><span className="font-mono">{n.acked ?? 0} Verified</span> <span className="text-secondary">({pct(n.acked ?? 0, n.recipients)}%)</span></div></div>
          {n.attachment && <div className="ml-auto flex items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm"><FileText size={16} className="text-error" />{n.attachment}<span className="t-caption text-outline">{n.attachmentSize}</span></div>}
        </div>
      )}
      {n.extra && <p className="mt-2 font-semibold text-secondary">{n.extra}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-outline-variant/40 pt-4">
        {published ? (<>
          <Button size="sm" onClick={onAck}>View Acknowledgements</Button>
          {n.recipients - (n.acked ?? 0) > 0 && <Button size="sm" variant="outline" onClick={onResend}>Resend to Unread ({n.recipients - (n.acked ?? 0)})</Button>}
        </>) : <Button size="sm" onClick={() => onAct("publish")}><Send size={14} />Send Now</Button>}
        <Button size="sm" variant="ghost" onClick={onEdit}>Edit Notice</Button>
        <div className="relative ml-auto">
          <button aria-label="More actions" onClick={() => setMenu((m) => !m)} className="cursor-pointer rounded p-1.5 text-outline hover:bg-surface-container"><MoreVertical size={16} /></button>
          {menu && (<>
            <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} />
            <div className="absolute right-0 z-20 w-40 rounded-lg border border-outline-variant bg-surface-container-lowest py-1 shadow-pop">
              <button className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-container-low" onClick={() => { setMenu(false); onAct("pin"); }}><Pin size={14} />{n.pinned ? "Unpin" : "Pin"}</button>
              <button className="w-full cursor-pointer px-3 py-2 text-left text-sm text-error hover:bg-surface-container-low" onClick={() => { setMenu(false); onAct("delete"); }}>Delete</button>
            </div>
          </>)}
        </div>
      </div>
    </Card>
  );
}

function QuickBroadcast({ onCreate, log }: { onCreate: (b: Omit<Notice, "id">) => Promise<Notice>; log: (b: Omit<LogRec, "id">) => Promise<LogRec> }) {
  const toast = useToast();
  const me = useMyName();
  const templates = useCollection<Template>("com_templates").rows;
  const [aud, setAud] = useState("All School");
  const [tpl, setTpl] = useState("tpl_1");
  const [body, setBody] = useState(templates[0]?.body ?? "");
  const [seeded, setSeeded] = useState(false);
  if (!seeded && templates.length) { setSeeded(true); setBody(templates.find((t) => t.id === "tpl_1")?.body ?? ""); }
  const [busy, setBusy] = useState(false);
  const max = 320;

  async function go() {
    if (!body.trim()) { toast("Write a message first", "error"); return; }
    setBusy(true);
    const a = AUDIENCES.find((x) => x.label === aud)!;
    const t = templates.find((x) => x.id === tpl);
    try {
      const n = await onCreate({ title: (t && t.id !== "tpl_4" ? t.name.replace(/ \(.*\)/, "") : "Quick Broadcast") + ` – ${aud}`, category: "General", audience: aud, recipients: a.count, sentAt: new Date().toISOString(), status: "Published", pinned: false, urgent: false,
        author: `${me.name}${me.title ? ` (${me.title})` : ""}`, channels: CHANNELS, delivered: Math.round(a.count * 0.99), acked: 0, read: 0, body });
      await log({ noticeId: n.id, action: "Quick broadcast", audience: aud, channels: CHANNELS, recipients: a.count, at: new Date().toISOString() });
      toast(`Broadcast dispatched to ${a.count} recipients (simulated)`);
    } catch { toast("Dispatch failed", "error"); } finally { setBusy(false); }
  }

  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded bg-info-container text-secondary"><Zap size={16} /></span>Quick Broadcast Console</span>} actions={<Badge tone="warning">Simulated</Badge>} />
      <div className="space-y-4 p-5 pt-2">
        <ul className="space-y-2 text-sm">
          {/* SMS/WhatsApp gateways are not built yet: say so instead of showing fake quotas. Parent app acks are live. */}
          {[["WhatsApp Meta API", "Not connected"], ["Transactional DLT SMS", "Not connected"], ["Parent Mobile App", "Live (acknowledgements)"]].map(([a, b]) => (
            <li key={a} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-on-surface-variant"><span className={cn("size-2 rounded-full", a === "Parent Mobile App" ? "bg-success" : "bg-outline")} />{a}</span><span className="font-medium text-on-surface-variant">{b}</span></li>
          ))}
        </ul>
        <div><div className="t-label-caps mb-2 !text-[11px] text-on-surface-variant">Target audience</div>
          <div className="grid grid-cols-2 gap-2">{AUDIENCES.map((a) => (
            <button key={a.label} onClick={() => setAud(a.label)} aria-pressed={aud === a.label}
              className={cn("cursor-pointer rounded border px-2 py-2 text-sm font-medium", aud === a.label ? "border-secondary bg-info-container text-secondary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low")}>{a.label}</button>))}</div></div>
        <div><div className="t-label-caps mb-2 !text-[11px] text-on-surface-variant">Predefined template</div>
          <Select value={tpl} onChange={(e) => { setTpl(e.target.value); setBody(templates.find((t) => t.id === e.target.value)?.body ?? ""); }}>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></div>
        <div><div className="mb-2 flex justify-between"><span className="t-label-caps !text-[11px] text-on-surface-variant">Message body</span><span className="font-mono text-xs text-outline">{body.length}/{max} chars</span></div>
          <Textarea value={body} maxLength={max} onChange={(e) => setBody(e.target.value)} className="min-h-32" aria-label="Message body" /></div>
        <div><div className="t-label-caps mb-2 !text-[11px] text-on-surface-variant">Insert merge variables</div>
          <div className="flex flex-wrap gap-2">{VARS.map((v) => <button key={v} onClick={() => setBody((b) => (b + v).slice(0, max))} className="cursor-pointer rounded bg-surface-container px-2 py-1 font-mono text-xs text-on-surface-variant hover:bg-surface-container-high">{v}</button>)}</div></div>
        <Button className="w-full" onClick={go} disabled={busy}><TriangleAlert size={16} />Dispatch Immediate Broadcast</Button>
      </div>
    </Card>
  );
}

function QuickReports() {
  const reports = useCollection<Report>("com_reports").rows.slice(0, 4);
  const all = useCollection<Report>("com_reports").rows.length;
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded bg-success-container text-success"><FileText size={16} /></span>Standard Reports Quick Access</span>} actions={<span className="text-xs text-on-surface-variant">{all} Ready</span>} />
      <div className="space-y-2 p-5 pt-2">
        {reports.map((r) => (
          <Link key={r.id} href={`/communication/reports?run=${r.id}`} className="flex items-center justify-between gap-2 rounded border border-outline-variant/60 p-3 hover:bg-surface-container-low">
            <span className="min-w-0"><span className="block truncate text-sm font-semibold">{r.title}</span><span className="t-caption text-outline">{r.category} · .{r.format}</span></span>
            <Download size={14} className="shrink-0 text-on-surface-variant" />
          </Link>))}
        <Link href="/communication/reports" className="flex items-center justify-between pt-2 text-sm font-semibold text-secondary">View all {all} reports in Standard Reports tab <ArrowRight size={16} /></Link>
      </div>
    </Card>
  );
}
