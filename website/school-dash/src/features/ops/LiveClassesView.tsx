"use client";
import { useMemo, useState } from "react";
import { ExternalLink, Users, Video } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Input, PageHeader, Select, Stat, useToast, type Column } from "@/components/ui";
import { fmtDate } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { clsLabel, type StaffRef } from "./shared";
import { filterLive, joinLink, liveState, type LiveClass, type LiveState } from "./logic";

export { liveState, type LiveClass } from "./logic";
const tone = { Upcoming: "info", Live: "success", Ended: "neutral", Draft: "warning", Cancelled: "danger" } as const;
const STATES: LiveState[] = ["Live", "Upcoming", "Ended", "Draft", "Cancelled"];

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
  const [classId, setClassId] = useState(""); const [teacherId, setTeacherId] = useState(""); const [date, setDate] = useState(""); const [status, setStatus] = useState("");
  const name = (id: string) => staff.find((s) => s.id === id)?.name ?? id;
  // soft-deleted sessions (teacher app delete: deleted:true + status cancelled) are gone; a cancelled one still shows
  const rows = useMemo(() => live.rows.filter((r) => r.deleted !== true), [live.rows]);
  const classIds = useMemo(() => [...new Set(rows.map((r) => r.classId))].sort((a, b) => a.localeCompare(b, "en", { numeric: true })), [rows]);
  const teacherIds = useMemo(() => [...new Set(rows.map((r) => r.teacherId))], [rows]);
  const view = useMemo(() => filterLive(rows, { classId, teacherId, date, status }), [rows, classId, teacherId, date, status]);
  const n = (s: LiveState) => rows.filter((r) => liveState(r) === s).length;

  const cols: Column<LiveClass>[] = [
    { key: "title", header: "Session", sortValue: (c) => c.title, render: (c) => <div><div className="font-semibold">{c.title}</div><div className="t-caption text-outline">{c.subject} · {name(c.teacherId)}</div></div> },
    { key: "class", header: "Class", sortValue: (c) => c.classId, render: (c) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{clsLabel(c.classId)}</span> },
    { key: "when", header: "When", sortValue: (c) => `${c.date} ${c.time}`, render: (c) => <div>{c.date ? fmtDate(c.date) : "—"}<div className="t-caption font-mono text-outline">{c.time || "--:--"}{c.mins ? ` · ${c.mins} min` : ""}</div></div> },
    { key: "status", header: "Status", sortValue: (c) => liveState(c), render: (c) => { const s = liveState(c); return <Badge tone={tone[s]}>{s}</Badge>; } },
    { key: "joins", header: "Link opens", render: (c) => <JoinCount id={c.id} /> },
    { key: "link", header: "", className: "text-right", render: (c) => { const href = joinLink(c); return href ? (
      <div className="flex justify-end gap-1">
        {/* a styled link, not a <button> inside an <a> */}
        <a href={href} target="_blank" rel="noopener noreferrer" aria-label={`Open ${c.title} (new tab)`}
          className="inline-flex h-8 items-center gap-1.5 rounded border border-outline-variant bg-surface-container-lowest px-3 text-xs font-semibold text-on-surface hover:bg-surface-container-low focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"><ExternalLink size={14} />Open</a>
        <Button size="sm" variant="ghost" aria-label={`Copy link for ${c.title}`} onClick={() => (navigator.clipboard ? navigator.clipboard.writeText(href) : Promise.reject()).then(() => toast("Link copied"), () => toast("Copy failed", "error"))}>Copy</Button>
      </div>) : <span className="t-caption text-outline">{!c.link ? (c.medium === "In-App Live" ? "In-app room" : "No link") : "Not a valid Meet link"}</span>; } },
  ];

  return (
    <div>
      <PageHeader title="Live Classes" subtitle="Google Meet sessions scheduled by teachers. Read-only; “Link opens” counts students who tapped Join, not proof of presence." />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Sessions" value={rows.length} icon={<Video size={16} />} />
        <Stat label="Live now" value={n("Live")} subTone="success" sub={n("Live") ? "In progress" : undefined} />
        <Stat label="Upcoming" value={n("Upcoming")} />
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <Select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)} className="w-40"><option value="">All classes</option>{classIds.map((c) => <option key={c} value={c}>{clsLabel(c)}</option>)}</Select>
          <Select aria-label="Teacher" value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="w-56"><option value="">All teachers</option>{teacherIds.map((t) => <option key={t} value={t}>{name(t)}</option>)}</Select>
          <Input aria-label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-36"><option value="">All statuses</option>{STATES.map((s) => <option key={s} value={s}>{s}</option>)}</Select>
          {(classId || teacherId || date || status) && <Button variant="ghost" size="sm" onClick={() => { setClassId(""); setTeacherId(""); setDate(""); setStatus(""); }}>Clear filters</Button>}
        </div>
        {!live.ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading live classes…</p> : <DataTable rows={view} columns={cols} pageSize={10} empty={<EmptyState title={rows.length ? "No sessions match" : "No live classes"} hint={rows.length ? "Try clearing the filters." : "Sessions scheduled in the teacher app appear here."} />} />}
      </Card>
    </div>
  );
}
