"use client";
import { useMemo, useState } from "react";
import { BookOpenCheck, CheckCircle2, FileText, MessageSquareWarning, Paperclip } from "lucide-react";
import { Badge, Button, Card, EmptyState, LoadingSkeleton, PageHeader, ProgressBar, SearchBox, SlideOver, Tabs, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { useMyName } from "@/lib/useMe";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { reviewPatch, reviewTone, type Plan, type ReviewState } from "./logic";

const label: Record<ReviewState, string> = { none: "Not sent", submitted: "To review", approved: "Approved", changes: "Changes asked" };
const fmt = (iso?: string) => (iso && !isNaN(+new Date(iso)) ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

const SENT = ["submitted", "approved", "changes"] as const;

/** Lesson plans teachers sent for review (ls_plans.review): approve, or ask for changes with a note.
 * Admin dashboard: every plan. Staff portal (`portal`): the principal and vice principal see the school's plans, an HOD
 * the plans of teachers in their department; nobody reviews their own plan (firestore.rules planReviewer). */
export function LessonPlansView({ portal = false }: { portal?: boolean }) {
  const { rows: all, ready, update } = useCollection<Plan>("ls_plans", true, portal ? [["review.state", "in", SENT]] : []);
  const staff = useCollection<{ id: string; name?: string; department?: string }>("staff").rows;
  const me = useStaffProfile();
  const myDept = staff.find((s) => s.id === me.staffId)?.department ?? "";
  const deptOf = useMemo(() => new Map(staff.map((s) => [s.id, s.department ?? ""])), [staff]);
  const rows = portal
    ? all.filter((p) => p.teacherId !== me.staffId && (me.staffRole !== "hod" || !myDept || deptOf.get(p.teacherId ?? "") === myDept))
    : all;
  const [tab, setTab] = useState<ReviewState | "all">("submitted");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(() => (typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("id")));
  const teacher = useMemo(() => new Map(staff.map((s) => [s.id, s.name ?? ""])), [staff]);
  const sent = rows.filter((p) => (p.review?.state ?? "none") !== "none");
  const count = (s: ReviewState | "all") => (s === "all" ? sent.length : sent.filter((p) => p.review?.state === s).length);
  const view = sent
    .filter((p) => tab === "all" || p.review?.state === tab)
    .filter((p) => !q || `${p.title} ${p.cls} ${p.subject} ${teacher.get(p.teacherId ?? "") ?? ""}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => String(b.review?.submittedAt ?? "").localeCompare(String(a.review?.submittedAt ?? "")));
  const current = rows.find((p) => p.id === sel) ?? null;

  return (
    <div>
      <PageHeader title={portal ? "Lesson plan reviews" : "Lesson Plans"}
        subtitle={portal && me.staffRole === "hod" && myDept ? `Plans from ${myDept} teachers. Approve them or ask for changes — the teacher is notified.`
          : "Plans teachers sent for review. Approve them or ask for changes — the teacher is notified."} />
      <Card className="mb-4 flex flex-col gap-3 p-3 lg:flex-row lg:items-center">
        <div className="min-w-0 lg:w-80"><SearchBox value={q} onChange={setQ} placeholder="Search title, class, subject or teacher…" /></div>
        <Tabs value={tab} onChange={(t) => setTab(t as ReviewState | "all")} items={[
          { id: "submitted", label: "To review", count: count("submitted") }, { id: "changes", label: "Changes asked", count: count("changes") },
          { id: "approved", label: "Approved", count: count("approved") }, { id: "all", label: "All", count: count("all") },
        ]} />
      </Card>
      <Card className="overflow-hidden p-0">
        {!ready && <LoadingSkeleton variant="table" label="Loading lesson plans…" className="p-8 text-center text-on-surface-variant" />}
        {ready && view.length === 0 && <EmptyState title={tab === "submitted" ? "Nothing to review" : "No lesson plans here"} hint="Teachers send plans from the teacher app (Lesson Plans → Send for review)." />}
        {view.length > 0 && (
          <table className="w-full text-sm">
            <thead className="hidden border-b border-outline-variant/60 bg-surface-container-low text-left text-xs text-on-surface-variant md:table-header-group">
              <tr><th className="px-4 py-2.5 font-semibold">Plan</th><th className="px-4 py-2.5 font-semibold">Teacher</th><th className="w-48 px-4 py-2.5 font-semibold">Taught</th><th className="px-4 py-2.5 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/50">
              {view.map((p) => {
                const total = Number(p.sessionCount ?? p.sessions?.length ?? 0), taught = Number(p.taughtCount ?? 0);
                return (
                  <tr key={p.id} onClick={() => setSel(p.id)} className="cursor-pointer hover:bg-surface-container-low">
                    <td className="px-4 py-3.5">
                      <button type="button" className="cursor-pointer text-left" onClick={(e) => { e.stopPropagation(); setSel(p.id); }}>
                        <span className="block font-semibold text-on-surface">{p.title}</span>
                        <span className="text-xs text-on-surface-variant">{[p.cls, p.subject, p.chapter].filter(Boolean).join(" · ")}</span>
                      </button>
                    </td>
                    <td className="hidden px-4 py-3.5 text-on-surface-variant md:table-cell">{teacher.get(p.teacherId ?? "") || "—"}</td>
                    <td className="hidden px-4 py-3.5 md:table-cell">
                      <div className="flex items-center gap-2"><ProgressBar value={total ? (taught * 100) / total : 0} className="h-1.5 flex-1" /><span className="w-12 text-right text-xs">{taught}/{total}</span></div>
                    </td>
                    <td className="px-4 py-3.5"><Badge tone={reviewTone(p.review?.state)}>{label[p.review?.state ?? "none"]}</Badge>
                      <div className="mt-1 text-xs text-outline">{fmt(p.review?.submittedAt)}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
      <SlideOver open={!!current} onClose={() => setSel(null)} title="Lesson plan" subtitle={current ? `${current.cls ?? ""} · ${current.subject ?? ""} · ${teacher.get(current.teacherId ?? "") ?? ""}` : undefined} width="max-w-2xl">
        {current && <PlanDetail key={current.id} p={current} onReview={(state, note, by) => update(current.id, reviewPatch(current, state, note, by)).then(() => setSel(null))} />}
      </SlideOver>
    </div>
  );
}

function PlanDetail({ p, onReview }: { p: Plan; onReview: (state: "approved" | "changes", note: string, by: string) => Promise<unknown> }) {
  const toast = useToast();
  const me = useMyName();
  const [note, setNote] = useState(p.review?.state === "changes" ? p.review?.note ?? "" : "");
  const [busy, setBusy] = useState(false);
  const sessions = p.sessions ?? [];
  async function act(state: "approved" | "changes") {
    if (state === "changes" && !note.trim()) { toast("Write what should change", "error"); return; }
    setBusy(true);
    try { await onReview(state, note.trim(), `${me.name}${me.title ? ` (${me.title})` : ""}`); toast(state === "approved" ? "Plan approved — the teacher is notified" : "Changes asked — the teacher is notified"); }
    catch { toast("Could not save the review", "error"); } finally { setBusy(false); }
  }
  return (
    <div className="space-y-5">
      <div>
        <div className="flex flex-wrap items-center gap-2"><Badge tone={reviewTone(p.review?.state)}>{label[p.review?.state ?? "none"]}</Badge>{p.chapter && <span className="text-sm text-on-surface-variant">{p.chapter}</span>}</div>
        <h2 className="t-headline-md mt-2 !text-[22px]">{p.title}</h2>
        {p.summary && <p className="mt-1 text-on-surface-variant">{p.summary}</p>}
      </div>
      {!!p.outcomes?.length && (
        <section><h3 className="mb-2 font-semibold">Learning outcomes</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">{p.outcomes.map((o, i) => <li key={i}>{o}</li>)}</ul></section>
      )}
      <section>
        <h3 className="mb-2 font-semibold">Sessions ({sessions.length})</h3>
        <ol className="space-y-2">
          {sessions.map((s, i) => (
            <li key={s.id ?? i} className="rounded-lg border border-outline-variant/60 p-3">
              <div className="flex items-center gap-2 text-xs text-on-surface-variant">
                <span className={cn("grid size-6 place-items-center rounded-full text-[11px] font-bold", s.status === "taught" ? "bg-success text-white" : "bg-info-container text-secondary")}>{s.status === "taught" ? "✓" : i + 1}</span>
                <span>{[fmt(s.date) || "No date", s.slot].filter(Boolean).join(" · ")}</span>
                {s.status === "skipped" && <Badge>Skipped</Badge>}
              </div>
              <div className="mt-1 font-medium">{s.focus || `Session ${i + 1}`}</div>
              {!!s.activities?.length && <div className="mt-1 flex flex-wrap gap-1.5">{s.activities.map((a, j) => <span key={j} className="rounded bg-surface-container px-2 py-0.5 text-xs">{a.mins}′ {a.title}</span>)}</div>}
              {s.homework && <div className="mt-1 text-xs"><span className="font-semibold text-warning">Homework</span> {s.homework}</div>}
              {s.note && <div className="mt-1 text-xs italic text-on-surface-variant">“{s.note}”</div>}
            </li>
          ))}
        </ol>
      </section>
      {!!p.attachments?.length && (
        <section><h3 className="mb-2 font-semibold">Attachments</h3>
          <div className="flex flex-wrap gap-2">{p.attachments.map((a, i) => (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-outline-variant px-3 py-2 text-sm hover:bg-surface-container-low">
              {/image/.test(a.contentType ?? "") ? <Paperclip size={15} /> : <FileText size={15} className="text-error" />}{a.name}<span className="text-xs text-outline">{a.size}</span></a>))}</div></section>
      )}
      <section className="rounded-xl border border-outline-variant/60 bg-surface-container-low p-4">
        <h3 className="mb-2 flex items-center gap-2 font-semibold"><BookOpenCheck size={16} />Your review</h3>
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the teacher (needed when asking for changes)" aria-label="Review note" className="min-h-24" />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button variant="outline" disabled={busy} onClick={() => act("changes")}><MessageSquareWarning size={14} />Ask for changes</Button>
          <Button disabled={busy} onClick={() => act("approved")}><CheckCircle2 size={14} />Approve</Button>
        </div>
      </section>
    </div>
  );
}
