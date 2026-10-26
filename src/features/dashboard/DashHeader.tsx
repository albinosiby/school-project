"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, Cloud, FileClock, LayoutGrid, ListChecks, Megaphone, Plus, SlidersHorizontal } from "lucide-react";
import { Badge, Button, Field, Input, Modal, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { AddEventPanel } from "./AddEventPanel";
import { addDays, downloadCsv, errMsg, parse, TODAY, upcomingEvents, useApprovals, useEvents, MONTHS, type Notif, type SetupStep, nowLocal } from "./data";

type Me = { id: string; name: string };
type School = { id: string; name: string; affiliation: string; board?: string };
type Audit = { id: string; at: string; actor: string; action: string; detail: string };

export function useSetupProgress() {
  const { rows } = useCollection<SetupStep>("setup_steps");
  const done = rows.filter((s) => s.done).length;
  return { steps: [...rows].sort((a, b) => a.no - b.no), done, total: rows.length, pct: rows.length ? Math.round((done / rows.length) * 100) : 0 };
}

export function DashHeader({ active }: { active: "dashboard" | "setup" | "approvals" | "calendar" }) {
  const { rows: me } = useCollection<Me>("me");
  const { rows: school } = useCollection<School>("school");
  const { rows: approvals } = useApprovals();
  const { rows: events } = useEvents();
  const { pct } = useSetupProgress();
  const { create: notify } = useCollection<Notif>("notifications");
  const { rows: audit } = useCollection<Audit>("set_audit");
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [time, setTime] = useState("");
  const [hour, setHour] = useState(9);
  const [addOpen, setAddOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [notice, setNotice] = useState({ title: "", body: "" });
  const [nerr, setNerr] = useState("");
  useEffect(() => {
    const f = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" }).toUpperCase());
      setHour(Number(now.toLocaleString("en-IN", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" })));
    };
    f(); const t = setInterval(f, 30000); return () => clearInterval(t);
  }, []);

  const pending = approvals.filter((a) => a.status === "pending").length;
  const horizon = addDays(TODAY, 30);
  const upcoming = upcomingEvents(events).filter((e) => e.start <= horizon).length;
  const d = parse(TODAY);
  const dateStr = `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]!.slice(0, 3)} ${d.getFullYear()}`;

  const chips = [
    { id: "dashboard", href: "/dashboard", icon: LayoutGrid, label: "Live Operations", badge: <Badge className="!bg-inverse-surface !text-inverse-on-surface">LIVE</Badge> },
    { id: "setup", href: "/setup", icon: SlidersHorizontal, label: "Setup Wizard", badge: <Badge tone="brand" className="font-mono">{pct}% Done</Badge> },
    { id: "approvals", href: "/approvals", icon: ListChecks, label: "Approvals Inbox", badge: <Badge tone={pending ? "danger" : "success"}>{pending} Pending</Badge> },
    { id: "calendar", href: "/calendar", icon: CalendarDays, label: "Academic Calendar", badge: <Badge tone="brand">{upcoming} Upcoming</Badge> },
  ] as const;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="t-headline-lg">{hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}, {me[0]?.name ?? "…"}</h1>
            <Badge tone="success" className="!px-3 !py-1"><span className="size-2 rounded-full bg-success" />Campus Active</Badge>
          </div>
          <p className="mt-1 text-on-surface-variant">{dateStr} <span className="mx-1 text-outline">•</span> {school[0]?.name ?? "—"}{school[0]?.affiliation ? ` (${school[0].board || "CBSE"} Affiliation ${school[0].affiliation})` : ""} <span className="mx-1 text-outline">•</span>
            {time && <span className="rounded bg-info-container px-1.5 py-0.5 font-mono text-xs text-secondary">{time} IST</span>}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            if (!audit.length) { toast("No audit events recorded yet", "error"); return; }
            downloadCsv("audit-log.csv", [["Time", "Actor", "Action", "Detail"], ...[...audit].sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).map((a) => [a.at, a.actor, a.action, a.detail])]);
            toast(`Audit log downloaded (${audit.length} events)`);
          }}><FileClock size={14} />System Audit Log</Button>
          <Button variant="outline" size="sm" onClick={() => setNoticeOpen(true)}><Megaphone size={14} />Quick Notice</Button>
          <Button size="sm" onClick={() => setAddOpen(true)}><Plus size={14} />Add Academic Event</Button>
        </div>
      </div>
      <nav aria-label="Dashboard sections" className="mb-6 flex flex-wrap items-center gap-1 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-2 shadow-card">
        {chips.map((c) => (
          <Link key={c.id} href={c.href} aria-current={active === c.id ? "page" : undefined}
            className={cn("flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium", active === c.id ? "bg-info-container text-secondary ring-1 ring-secondary/20" : "text-on-surface-variant hover:bg-surface-container-low")}>
            <c.icon size={16} /><span>{c.label}</span>{c.badge}
          </Link>
        ))}
        <span className="ml-auto flex items-center gap-2 px-3 text-xs text-on-surface-variant"><Cloud size={15} className="text-success" />Live data · updates in real time</span>
      </nav>

      <AddEventPanel open={addOpen} onClose={() => setAddOpen(false)} />
      <Modal open={noticeOpen} onClose={() => { setNoticeOpen(false); setNerr(""); }} title="Quick Notice" subtitle="Broadcast a short notice to the notification feed"
        footer={<><Button variant="outline" onClick={() => { setNoticeOpen(false); setNerr(""); }}>Cancel</Button>
          <Button disabled={sending} onClick={async () => {
            if (!notice.title.trim() || !notice.body.trim()) { setNerr("Title and message are required"); return; }
            setSending(true);
            try {
              await notify({ category: "ops", title: notice.title.trim(), body: notice.body.trim(), createdAt: nowLocal(), read: false, href: "" } as never);
              toast("Notice posted to the notification feed (parent push simulated)"); setNotice({ title: "", body: "" }); setNerr(""); setNoticeOpen(false);
            } catch (e) { setNerr(errMsg(e, "Could not post the notice")); } finally { setSending(false); }
          }}>{sending ? "Sending…" : "Send Notice"}</Button></>}>
        <div className="space-y-4">
          <Field label="Title" required><Input value={notice.title} maxLength={120} onChange={(e) => { setNotice({ ...notice, title: e.target.value }); setNerr(""); }} /></Field>
          <Field label="Message" required error={nerr}><Textarea value={notice.body} onChange={(e) => { setNotice({ ...notice, body: e.target.value }); setNerr(""); }} /></Field>
        </div>
      </Modal>
    </>
  );
}
