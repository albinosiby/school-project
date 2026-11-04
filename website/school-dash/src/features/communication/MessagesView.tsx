"use client";
import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { Avatar, Badge, Card, DataTable, EmptyState, SearchBox, Select, SlideOver, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { db } from "@/lib/firebase";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { CommHeader } from "./CommHeader";

/** msg_threads / msg_messages (data contract 13.3). Parents and teachers write; the admin only reads (oversight). */
type Thread = { id: string; studentId: string; classId?: string; studentName?: string; parentUids?: string[]; guardian?: string; teacherId?: string; teacher?: string; role?: string;
  lastMessage?: string; lastAt?: unknown; lastFrom?: "parent" | "teacher"; unreadParent?: number; unreadTeacher?: number };
type Msg = { id: string; threadId: string; from: "parent" | "teacher"; uid?: string; name?: string; text: string; at: unknown };

const ms = (v: unknown): number => typeof v === "string" ? Date.parse(v) || 0 : typeof v === "number" ? v : (v as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
const when = (v: unknown) => { const t = ms(v); return t ? new Date(t).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "—"; };
const clsLabel = (id?: string) => id ? id.replace(/^cls_(\d+)(\w)$/, "$1-$2") : "—";

export function MessagesView() {
  const { rows, ready } = useCollection<Thread>("msg_threads");
  const [q, setQ] = useState(""); const [cls, setCls] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const classIds = [...new Set(rows.map((t) => t.classId).filter(Boolean) as string[])].sort((a, b) => clsLabel(a).localeCompare(clsLabel(b), undefined, { numeric: true }));
  const view = useMemo(() => rows.filter((t) => (!cls || t.classId === cls)
    && (!q || `${t.studentName} ${t.guardian} ${t.teacher} ${t.lastMessage}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => ms(b.lastAt) - ms(a.lastAt)), [rows, q, cls]);
  const live = open ? rows.find((t) => t.id === open) ?? null : null;

  const cols: Column<Thread>[] = [
    { key: "student", header: "Student", sortValue: (t) => t.studentName ?? "", render: (t) => <div className="flex items-center gap-3"><Avatar name={t.studentName ?? "?"} /><div><div className="font-semibold">{t.studentName ?? t.studentId}</div><div className="t-caption text-outline">Grade {clsLabel(t.classId)}</div></div></div> },
    { key: "guardian", header: "Guardian", sortValue: (t) => t.guardian ?? "", render: (t) => t.guardian || "—" },
    { key: "teacher", header: "Teacher", sortValue: (t) => t.teacher ?? "", render: (t) => <div><div>{t.teacher || t.teacherId || "—"}</div>{t.role && <div className="t-caption text-outline">{t.role}</div>}</div> },
    { key: "last", header: "Last message", render: (t) => <div className="max-w-[320px]"><span className="block truncate text-sm">{t.lastFrom && <span className="font-semibold">{t.lastFrom === "parent" ? "Parent: " : "Teacher: "}</span>}{t.lastMessage || "—"}</span>
      <span className="flex gap-1">{!!t.unreadTeacher && <Badge tone="warning">{t.unreadTeacher} unread by teacher</Badge>}{!!t.unreadParent && <Badge>{t.unreadParent} unread by parent</Badge>}</span></div> },
    { key: "at", header: "Time", sortValue: (t) => ms(t.lastAt), render: (t) => <span className="whitespace-nowrap text-sm text-on-surface-variant">{when(t.lastAt)}</span> },
  ];

  return (
    <div>
      <CommHeader active="messages" />
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <SearchBox value={q} onChange={setQ} placeholder="Search student, guardian, teacher or text…" className="w-full max-w-xs" />
          <Select aria-label="Class" value={cls} onChange={(e) => setCls(e.target.value)} className="w-40"><option value="">All classes</option>{classIds.map((c) => <option key={c} value={c}>Grade {clsLabel(c)}</option>)}</Select>
          <p className="t-caption ml-auto text-outline">Parent ↔ teacher conversations from the apps. Read-only for oversight.</p>
        </div>
        {!ready ? <p className="px-5 pb-5 text-on-surface-variant">Loading conversations…</p>
          : <DataTable rows={view} columns={cols} pageSize={12} onRowClick={(t) => setOpen(t.id)} empty={<EmptyState title={rows.length ? "No conversations match" : "No conversations yet"} hint="Messages between parents and teachers appear here." />} />}
      </Card>
      <SlideOver open={!!live} onClose={() => setOpen(null)} width="max-w-lg" title={live?.studentName ?? "Conversation"}
        subtitle={live ? `${live.guardian || "Guardian"} ↔ ${live.teacher || "Teacher"} · Grade ${clsLabel(live.classId)}` : ""}>
        {live && <ThreadMessages key={live.id} threadId={live.id} />}
      </SlideOver>
    </div>
  );
}

/** Messages of one thread, live. Filtered by threadId only (sorted here) so no composite index is needed. */
function ThreadMessages({ threadId }: { threadId: string }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const sid = currentSchoolId(); if (!sid) return;
    return onSnapshot(query(collection(db, "schools", sid, "msg_messages"), where("threadId", "==", threadId)),
      (snap) => { setErr(false); setMsgs(snap.docs.map((d) => ({ ...(d.data() as Omit<Msg, "id">), id: d.id })).sort((a, b) => ms(a.at) - ms(b.at))); },
      () => { setErr(true); setMsgs([]); });
  }, [threadId]);
  if (err) return <p className="text-error">Could not load the messages.</p>;
  if (!msgs) return <p className="text-on-surface-variant">Loading messages…</p>;
  if (!msgs.length) return <EmptyState title="No messages yet" />;
  return (
    <ul className="space-y-3">{msgs.map((m) => (
      <li key={m.id} className={cn("flex", m.from === "teacher" ? "justify-end" : "justify-start")}>
        <div className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.from === "teacher" ? "bg-info-container" : "bg-surface-container")}>
          <div className="t-caption mb-0.5 text-outline">{m.name || (m.from === "teacher" ? "Teacher" : "Parent")} · {when(m.at)}</div>
          <p className="whitespace-pre-wrap break-words">{m.text}</p>
        </div>
      </li>))}</ul>
  );
}
