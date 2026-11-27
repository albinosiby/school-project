"use client";
// /me/resources: the teacher's class resources (`cl_resources`) — uploaded files, YouTube videos and links (Google Drive
// or any web page), each shared with the class's parents or kept to the teacher; pinned first. Mirrors the teacher app's
// Resources screen (modules/classes/screens/resources_screen.dart).
import { useMemo, useState } from "react";
import {
  ExternalLink, FileImage, FileSpreadsheet, FileText, FileType2, HardDrive, Link2, Lock, Pencil, Pin, PinOff, Play, Presentation, Plus, Trash2, Users,
  type LucideIcon,
} from "lucide-react";
import { Badge, Button, Card, EmptyState, LoadingSkeleton, PageHeader, SearchBox, Select, Tabs, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, useTeachingData } from "../teaching";
import { FILTERS, badgeOf, sizeLabel, thumbnailOf, visibleResources, type BadgeKey, type Filter, type Resource, type ResourceDoc } from "./logic";
import { ResourceDialog } from "./ResourceDialog";

export const BADGE_STYLE: Record<BadgeKey, { icon: LucideIcon; tint: string }> = {
  youtube: { icon: Play, tint: "bg-error-container text-error" },
  pdf: { icon: FileText, tint: "bg-error-container text-error" },
  doc: { icon: FileType2, tint: "bg-info-container text-secondary" },
  ppt: { icon: Presentation, tint: "bg-warning-container text-warning" },
  xls: { icon: FileSpreadsheet, tint: "bg-success-container text-success" },
  drive: { icon: HardDrive, tint: "bg-success-container text-success" },
  image: { icon: FileImage, tint: "bg-tertiary-container/15 text-tertiary" },
  link: { icon: Link2, tint: "bg-surface-container text-on-surface-variant" },
  file: { icon: FileText, tint: "bg-surface-container text-on-surface-variant" },
};

const dateLabel = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

export function MyResources() {
  const toast = useToast();
  const data = useTeachingData();
  const res = useCollection<ResourceDoc>("cl_resources", data.teaching, [["teacherId", "==", data.staffId]]);
  const [classId, setClassId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [dialog, setDialog] = useState<{ editing: Resource | null } | null>(null);
  const view = useMemo(() => visibleResources(res.rows, { staffId: data.staffId, classId, filter, q }), [res.rows, data.staffId, classId, filter, q]);

  if (!data.teaching) return <EmptyState title="Only teachers have class resources" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !res.ready) return <LoadingSkeleton variant="card" label="Loading resources…" />;

  const { all, list, counts } = view;

  async function toggleVisibility(r: Resource) {
    const next = r.visibility === "parents" ? "private" : "parents";
    try { await res.update(r.id, { visibility: next }); toast(next === "parents" ? "Shared with parents" : "Now visible only to you"); }
    catch { toast("Could not change who can see it", "error"); }
  }
  async function togglePin(r: Resource) {
    try { await res.update(r.id, { pinned: !r.pinned }); toast(r.pinned ? "Unpinned" : "Pinned to top"); } catch { toast("Could not pin the resource", "error"); }
  }
  async function remove(r: Resource) {
    const msg = r.visibility === "parents" ? "It disappears for you and for the parents of the class." : "It is removed from your resources.";
    if (!window.confirm(`Delete "${r.title}"? ${msg}`)) return;
    try { await res.remove(r.id); toast("Deleted"); } catch { toast("Could not delete the resource", "error"); }
  }

  const stats = [
    { label: "Shared with parents", value: counts.shared, icon: Users, tint: "text-success" },
    { label: "Only you", value: counts.mine, icon: Lock, tint: "text-on-surface-variant" },
    { label: "Videos", value: counts.videos, icon: Play, tint: "text-error" },
  ];

  return <div className="space-y-5">
    <PageHeader title="Resources" subtitle={`${classId ? classIdLabel(classId) : "All classes"} · ${all.length} item${all.length === 1 ? "" : "s"}`}
      actions={<>
        <Select aria-label="Class" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="">All classes</option>
          {data.classIds.map((id) => <option key={id} value={id}>{classIdLabel(id)}</option>)}
        </Select>
        <Button onClick={() => setDialog({ editing: null })} disabled={!data.classIds.length}><Plus size={16} />Add resource</Button>
      </>} />

    <div className="grid grid-cols-3 gap-3">
      {stats.map(({ label, value, icon: Icon, tint }) => (
        <Card key={label} className="flex items-center gap-3 p-3 sm:p-4">
          <Icon size={18} className={`shrink-0 ${tint}`} aria-hidden />
          <div className="min-w-0"><p className={`t-headline-md !text-xl !leading-7 ${tint}`}>{value}</p><p className="truncate text-xs text-on-surface-variant">{label}</p></div>
        </Card>
      ))}
    </div>

    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <SearchBox value={q} onChange={setQ} placeholder="Search resources" className="lg:w-72" />
      <Tabs className="min-w-0 flex-1" value={filter} onChange={(id) => setFilter(id as Filter)} items={FILTERS.map((f) => ({ id: f.id, label: f.label, count: counts[f.id] }))} />
    </div>

    {!list.length ? (
      <Card><EmptyState title={all.length ? "Nothing here" : "No resources yet"}
        hint={all.length ? "Try another filter or search." : data.classIds.length ? "Add files, YouTube videos or Google Drive links for your classes." : "You have no classes to share resources with."}
        action={!all.length && data.classIds.length ? <Button variant="outline" onClick={() => setDialog({ editing: null })}><Plus size={16} />Add resource</Button> : undefined} /></Card>
    ) : (
      <ul aria-label="Resources" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => <ResourceCard key={r.id} r={r} onVisibility={() => toggleVisibility(r)} onPin={() => togglePin(r)} onEdit={() => setDialog({ editing: r })} onDelete={() => remove(r)} />)}
      </ul>
    )}

    {dialog && <ResourceDialog editing={dialog.editing} defaultClassId={classId || data.classIds[0] || ""} classIds={data.classIds} subjectsFor={data.subjectsFor}
      staffId={data.staffId} teacherName={data.name} create={res.create} update={res.update} onClose={() => setDialog(null)} />}
  </div>;
}

function ResourceCard({ r, onVisibility, onPin, onEdit, onDelete }: { r: Resource; onVisibility: () => void; onPin: () => void; onEdit: () => void; onDelete: () => void }) {
  const b = badgeOf(r);
  const style = BADGE_STYLE[b.key];
  const Icon = style.icon;
  const thumb = thumbnailOf(r);
  const openable = /^https?:\/\//.test(r.url);
  const meta = [b.label, r.subject, r.kind === "file" ? sizeLabel(r.sizeBytes) : "", dateLabel(r.createdAt)].filter(Boolean).join(" · ");
  const shared = r.visibility === "parents";
  return (
    <li aria-label={`Resource ${r.title}`} className="flex">
      <Card className="flex w-full flex-col overflow-hidden">
        <div className={`relative grid h-32 place-items-center ${thumb ? "bg-surface-container" : style.tint}`}>
          {thumb ? <>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail; next/image needs a remote pattern */}
            <img src={thumb} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
            <span className="relative grid size-10 place-items-center rounded-full bg-error text-on-error shadow-card"><Play size={18} fill="currentColor" /></span>
          </> : <Icon size={40} strokeWidth={1.5} aria-hidden />}
          <span className="absolute left-3 top-3"><Badge tone="neutral" className="bg-surface-container-lowest/90">{classIdLabel(r.classId)}</Badge></span>
          {r.pinned && <span className="absolute right-3 top-3"><Badge tone="brand"><Pin size={12} />Pinned</Badge></span>}
        </div>
        <div className="flex flex-1 flex-col gap-1.5 p-4">
          <p className="line-clamp-2 font-semibold">{r.title}</p>
          <p className="truncate text-xs text-on-surface-variant">{meta}</p>
          {r.description && <p className="line-clamp-2 text-sm text-on-surface-variant">{r.description}</p>}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
            <button type="button" onClick={onVisibility} aria-pressed={shared} aria-label={`Visibility of ${r.title}: ${shared ? "parents can see" : "only you"}`}
              title={shared ? "Make visible only to me" : "Share with parents"}
              className={`inline-flex cursor-pointer items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${shared ? "bg-success-container text-success" : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"}`}>
              {shared ? <Users size={13} /> : <Lock size={13} />}{shared ? "Parents can see" : "Only you"}
            </button>
            <div className="flex items-center gap-0.5">
              <IconBtn label={r.pinned ? `Unpin ${r.title}` : `Pin ${r.title}`} onClick={onPin}>{r.pinned ? <PinOff size={16} /> : <Pin size={16} />}</IconBtn>
              {openable
                ? <a href={r.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${r.title}`} title="Open" className="grid size-8 place-items-center rounded text-on-surface-variant hover:bg-surface-container"><ExternalLink size={16} /></a>
                : <span aria-label="Not uploaded yet" title="Not uploaded yet" className="grid size-8 place-items-center text-outline"><ExternalLink size={16} /></span>}
              <IconBtn label={`Edit ${r.title}`} onClick={onEdit}><Pencil size={16} /></IconBtn>
              <IconBtn label={`Delete ${r.title}`} onClick={onDelete} danger><Trash2 size={16} /></IconBtn>
            </div>
          </div>
        </div>
      </Card>
    </li>
  );
}

function IconBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return <button type="button" aria-label={label} title={label} onClick={onClick}
    className={`grid size-8 cursor-pointer place-items-center rounded transition-colors hover:bg-surface-container ${danger ? "text-error" : "text-on-surface-variant"}`}>{children}</button>;
}
