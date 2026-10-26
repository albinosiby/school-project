"use client";
import { useMemo, useState } from "react";
import { ExternalLink, Users, Video } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Stat, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import type { StaffRef } from "./shared";

export type LiveClass = { id: string; title: string; classId: string; subject: string; teacherId: string; date: string; time: string; mins: number; medium: string; link: string; status?: string };
const clsLabel = (id: string) => id.replace(/^cls_(\d+)(.*)$/, "Grade $1-$2");

/** status derived from the clock, never from a stale stored field (contract section 6) */
export function liveState(c: LiveClass, now = new Date()): "Upcoming" | "Live" | "Ended" {
  const start = new Date(`${c.date}T${c.time || "00:00"}:00`).getTime();
  const end = start + (c.mins || 0) * 60000;
  const t = now.getTime();
  return t < start - 10 * 60000 ? "Upcoming" : t <= end ? "Live" : "Ended";
}
const tone = { Upcoming: "info", Live: "success", Ended: "neutral" } as const;
/** teacher-entered link -> safe absolute https URL (contract allows "meet.google.com/…" without a scheme; never javascript: etc.) */
const safeLink = (raw?: string) => {
  const v = (raw ?? "").trim(); if (!v) return null;
  try { const u = new URL(/^[a-z][a-z\d+.-]*:/i.test(v) ? v : `https://${v}`); return u.protocol === "https:" || u.protocol === "http:" ? u.href : null; } catch { return null; }
};

/** One listener per visible session: live_classes/{id}/joins holds one doc per link open. */
function JoinCount({ id }: { id: string }) {
  const { rows, ready } = useCollection<{ id: string }>(`live_classes/${id}/joins`);
  return <span className="inline-flex items-center gap-1 font-mono text-sm"><Users size={14} className="text-outline" />{ready ? rows.length : "…"}</span>;
}

/** Read-only oversight list of teacher-created Google Meet sessions. */
export function LiveClassesView() {
  const toast = useToast();
  const live = useCollection<LiveClass>("live_classes");
  const staff = useCollection<StaffRef>("staff").rows;
  const [classId, setClassId] = useState(""); const [teacherId, setTeacherId] = useState(""); const [date, setDate] = useState("");
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  const classIds = useMemo(() => [...new Set(live.rows.map((r) => r.classId))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })), [live.rows]);
  const teacherIds = useMemo(() => [...new Set(live.rows.map((r) => r.teacherId))], [live.rows]);
  const view = useMemo(() => live.rows.filter((r) => (!classId || r.classId === classId) && (!teacherId || r.teacherId === teacherId) && (!date || r.date === date))
    .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)), [live.rows, classId, teacherId, date]);
  const n = (s: string) => live.rows.filter((r) => liveState(r) === s).length;

  const cols: Column<LiveClass>[] = [
    { key: "title", header: "Session", sortValue: (c) => c.title, render: (c) => <div><div className="font-semibold">{c.title}</div><div className="t-caption text-outline">{c.subject} · {name(c.teacherId)}</div></div> },
    { key: "class", header: "Class", sortValue: (c) => c.classId, render: (c) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{clsLabel(c.classId)}</span> },
    { key: "when", header: "When", sortValue: (c) => `${c.date} ${c.time}`, render: (c) => <div>{c.date ? fmtDate(c.date) : "—"}<div className="t-caption font-mono text-outline">{c.time || "--:--"}{c.mins ? ` · ${c.mins} min` : ""}</div></div> },
    { key: "status", header: "Status", sortValue: (c) => liveState(c), render: (c) => { const s = liveState(c); return <Badge tone={tone[s]}>{s}</Badge>; } },
    { key: "joins", header: "Link opens", render: (c) => <JoinCount id={c.id} /> },
    { key: "link", header: "", className: "text-right", render: (c) => { const href = safeLink(c.link); return href ? (
      <div className="flex justify-end gap-1">
        {/* a styled link, not a <button> inside an <a> */}
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${c.title} (new tab)`}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"><ExternalLink size={14} />Open</a>
        <Button size="sm" variant="ghost" aria-label={`Copy link for ${c.title}`} onClick={() => (navigator.clipboard ? navigator.clipboard.writeText(href) : Promise.reject()).then(() => toast("Link copied"), () => toast("Copy failed", "error"))}>Copy</Button>
      </div>) : <span className="t-caption text-outline">No valid link</span>; } },
  ];

  return (
    <div>
      <PageHeader title="Live Classes" subtitle="Google Meet sessions scheduled by teachers. Read-only; “Link opens” counts students who tapped Join, not proof of presence." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Sessions" value={live.rows.length} icon={<Video size={16} />} />
        <Stat label="Live now" value={n("Live")} subTone="success" sub={n("Live") ? "In progress" : undefined} />
        <Stat label="Upcoming" value={n("Upcoming")} />
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <Select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="w-40"><option value="">All classes</option>{classIds.map((c) => <option key={c} value={c}>{clsLabel(c)}</option>)}</Select>
          <Select aria-label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-56"><option value="">All teachers</option>{teacherIds.map((t) => <option key={t} value={t}>{name(t)}</option>)}</Select>
          <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          {(classId || teacherId || date) && <Button variant="ghost" size="sm" onClick={() => { setClassId(""); setTeacherId(""); setDate(""); }}>Clear filters</Button>}
        </div>
        {!live.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading live classes…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title={live.rows.length ? "No sessions match" : "No live classes"} hint={live.rows.length ? "Try clearing the filters." : "Sessions scheduled in the teacher app appear here."} />} />}
      </Card>
    </div>
  );
}
