"use client";
// /me/assignments/{id} (homework_screen.dart): what was set, who handed in (parent app uploads or on paper) and the
// grading of each student (marks or done, feedback), plus close / reopen, publish now, edit and delete.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, CalendarDays, Check, CheckCheck, CloudUpload, FileText, Hourglass, Image as ImageIcon, Minus, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { Avatar, Badge, BarChart, Button, Card, DonutChart, EmptyState, LoadingSkeleton, SlideOver, Tabs, Textarea, useToast, type Tone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { classIdLabel, todayIso } from "../teaching";
import { useAssignments } from "./useAssignments";
import {
  BAND_LABELS, QUICK_FEEDBACK, STUDENT_FILTERS, allowsLate, attachmentsOf, daysLeft, dueLabel, filterCounts, filterRows, gradeSubmission, gradingPatch,
  homeworkStats, isGraded, isImageRef, isLate, localStatus, maxMarksOf, markAllIn, markOnPaper, marksText, nextToGrade, onPaper, sizeLabel, toggledStatus, whenLabel,
  type Homework, type LiveSubmission, type StudentFilter, type StudentRow,
} from "./logic";

export function AssignmentDetail({ id }: { id: string }) {
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const { data, hw, rows, rosterOf, ready } = useAssignments();
  const initial = STUDENT_FILTERS.some(([f]) => f === params.get("filter")) ? (params.get("filter") as StudentFilter) : "all";
  const [filter, setFilter] = useState<StudentFilter>(initial);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!data.teaching) return <EmptyState title="Only teachers have assignments" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!ready) return <LoadingSkeleton variant="details" label="Loading the assignment…" />;
  const h = rows.find((x) => x.id === id);
  if (!h) return <Card><EmptyState title="Assignment not found" hint="It may have been deleted." action={<Link href="/me/assignments" className="text-sm font-semibold text-secondary">Back to assignments</Link>} /></Card>;

  const roster = rosterOf(h.classId);
  const st = homeworkStats(h, roster, data.students.map((s) => ({ id: s.id, name: s.name, roll: s.roll })));
  const status = localStatus(h.status);
  const graded = isGraded(h);
  const counts = filterCounts(st);
  const list = filterRows(st.rows, filter);
  const current = open ? st.rows.find((r) => r.id === open) : undefined;

  async function write(subs: Record<string, LiveSubmission>, ok: string) {
    setBusy(true);
    try { await hw.update(h!.id, gradingPatch(subs)); toast(ok); return true; } catch { toast("Could not save. Check your connection.", "error"); return false; } finally { setBusy(false); }
  }
  async function toggle() {
    const next = toggledStatus(h!.status);
    try {
      await hw.update(h!.id, { status: next });
      toast(status === "scheduled" || status === "draft" ? "Published — parents are notified" : status === "closed" ? "Reopened for hand-ins" : "Closed — parents can no longer hand in");
    } catch { toast("Could not update the assignment", "error"); }
  }
  async function remove() {
    if (!window.confirm("Delete this assignment? It disappears for the class and the parents. Grades and hand-ins are removed with it.")) return;
    try { await hw.update(h!.id, { deleted: true }); toast(`"${h!.title}" deleted`); router.push("/me/assignments"); } catch { toast("Could not delete the assignment", "error"); }
  }
  async function allIn() {
    if (!window.confirm(`Mark ${st.notSubmitted} as handed in? For papers collected in class. Students who uploaded in the parent app are not affected.`)) return;
    await write(markAllIn(st.subs, roster.map((s) => s.id)), `${st.notSubmitted} marked handed in`);
  }

  const toggleLabel = status === "scheduled" || status === "draft" ? "Publish now" : status === "open" ? "Close hand-ins" : "Reopen hand-ins";
  return <div className="space-y-4">
    <div className="flex flex-wrap items-start gap-3">
      <Link href="/me/assignments" aria-label="Back to assignments" className="mt-1 rounded p-1.5 text-on-surface-variant hover:bg-surface-container"><ArrowLeft size={20} /></Link>
      <div className="min-w-0 flex-1"><h1 className="t-headline-lg break-words">{h.title}</h1><p className="text-on-surface-variant">Class {classIdLabel(h.classId)}{h.subject ? ` • ${h.subject}` : ""}</p></div>
      <div className="flex w-full flex-wrap gap-2 sm:w-auto">
        <Link href={`/me/assignments/${h.id}/edit`} className="inline-flex h-10 items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold hover:bg-surface-container-low"><Pencil size={15} />Edit</Link>
        <Button variant="outline" onClick={toggle}>{toggleLabel}</Button>
        <Button variant="ghost" className="text-error" onClick={remove}><Trash2 size={15} />Delete</Button>
      </div>
    </div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Brief h={h} status={status} />
      <Card className="p-4 sm:p-5" role="group" aria-label="Hand-ins">
        <h2 className="text-base font-semibold">Hand-ins</h2>
        <p className="mb-3 text-xs text-on-surface-variant">{[`${st.turnedIn} of ${st.total} handed in`, st.uploaded ? `${st.uploaded} in the parent app` : "", st.late ? `${st.late} late` : ""].filter(Boolean).join(" • ")}</p>
        <DonutChart centre={<div><p className="text-xl font-bold">{st.total ? Math.round((st.turnedIn * 100) / st.total) : 0}%</p><p className="text-[11px] text-on-surface-variant">handed in</p></div>}
          items={[{ label: graded ? "To grade" : "To check", value: st.toGrade }, { label: graded ? "Graded" : "Checked", value: st.graded }, { label: "Not handed in", value: st.notSubmitted }]} />
        {graded && st.graded > 0 && st.avg !== null && <div className="mt-4">
          <div className="flex items-center justify-between gap-2"><h3 className="text-sm font-semibold">Marks</h3><p className="text-sm font-semibold text-secondary">Average {st.avg.toFixed(1)} / {st.max}</p></div>
          <BarChart height={100} items={st.bands.map((v, i) => ({ label: BAND_LABELS[i]!, value: v, tone: (["danger", "warning", "brand", "brand", "success"] as const)[i] }))} />
        </div>}
      </Card>
    </div>

    <Card className="p-4 sm:p-5" role="group" aria-label="Students">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold">Students</h2>
        {status === "open" && st.notSubmitted > 0 && <Button size="sm" variant="outline" onClick={allIn} disabled={busy}><CheckCheck size={15} />All handed in</Button>}
      </div>
      <Tabs items={STUDENT_FILTERS.map(([f, label]) => ({ id: f, label, count: counts[f] }))} value={filter} onChange={(f) => setFilter(f as StudentFilter)} />
      {!list.length ? <EmptyState title="No students here" /> : <ul className="mt-2 divide-y divide-outline-variant/40">
        {list.map((r) => <StudentTile key={r.id} r={r} graded={graded} max={st.max} onOpen={() => setOpen(r.id)} />)}
      </ul>}
    </Card>

    <SlideOver open={!!current} onClose={() => setOpen(null)} title={current ? `Review: ${current.name}` : "Review"} subtitle={current ? [current.roll > 0 ? `Roll ${current.roll}` : "", h.title].filter(Boolean).join(" • ") : undefined} width="max-w-lg">
      {current && <ReviewPanel key={current.id} h={h} r={current} rows={st.rows} busy={busy}
        onPaper={(handedIn) => write({ ...st.subs, [current.id]: markOnPaper(current.sub, handedIn) }, handedIn ? "Marked handed in on paper" : "Marked not handed in")}
        onSave={async (input, next) => {
          const sub = gradeSubmission(current.sub, { ...input, by: data.name, now: new Date().toISOString() });
          const ok = await write({ ...st.subs, [current.id]: sub }, graded ? "Grade saved" : "Marked as done");
          if (!ok) return;
          setOpen(next ? nextToGrade(st.rows.filter((x) => x.id !== current.id), current.id)?.id ?? null : null);
        }} />}
    </SlideOver>
  </div>;
}

function Brief({ h, status }: { h: Homework; status: string }) {
  const today = todayIso();
  const left = daysLeft(h.due, today);
  const files = attachmentsOf(h);
  const dueTone: Tone = left !== null && left < 0 && status === "open" ? "danger" : left !== null && left <= 1 ? "warning" : "brand";
  return <Card className="p-4 sm:p-5" role="group" aria-label="Brief">
    <div className="flex flex-wrap gap-1.5">
      <Badge tone={dueTone}><CalendarDays size={12} />{dueLabel(h.due, today)}</Badge>
      {status === "scheduled" ? <Badge tone="info">Publishes {whenLabel(h.publishAt)}</Badge>
        : status === "draft" ? <Badge tone="warning">Draft — not published</Badge>
        : <Badge tone={status === "open" ? "success" : "neutral"}>{status === "open" ? "Open for hand-ins" : "Closed"}</Badge>}
      <Badge>{isGraded(h) ? `Out of ${maxMarksOf(h)}` : "Not graded"}</Badge>
      {status === "open" && !allowsLate(h) && <Badge>No late hand-ins</Badge>}
    </div>
    {h.description ? <p className="mt-3 text-sm whitespace-pre-wrap text-on-surface">{h.description}</p> : <p className="mt-3 text-sm text-on-surface-variant">No description.</p>}
    {files.length > 0 && <ul aria-label="Attachments" className="mt-3 space-y-1.5">
      {files.map((f, i) => <li key={i}><FileLink name={f.name} url={f.url} size={f.size || sizeLabel(f.bytes)} image={isImageRef(f)} /></li>)}
    </ul>}
  </Card>;
}

function FileLink({ name, url, size, image }: { name?: string; url?: string; size?: string; image: boolean }) {
  const body = <>
    {image ? <ImageIcon size={18} className="shrink-0 text-secondary" /> : <FileText size={18} className="shrink-0 text-secondary" />}
    <span className="min-w-0 flex-1 truncate text-sm font-medium">{name || "File"}</span>
    {size && <span className="text-xs text-on-surface-variant">{size}</span>}
  </>;
  const cls = "flex items-center gap-2 rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-3 py-2";
  return url && /^https?:/.test(url) ? <a href={url} target="_blank" rel="noopener noreferrer" className={cn(cls, "hover:border-secondary/60")}>{body}</a> : <div className={cls}>{body}</div>;
}

function statusOf(r: StudentRow, graded: boolean, max: number): [string, Tone] {
  if (r.sub.status === "graded") return [graded && typeof r.sub.marks === "number" ? `${marksText(r.sub.marks)}/${max}` : "Done", "success"];
  if (r.sub.status === "submitted") return [graded ? "To grade" : "To check", "brand"];
  return ["Not handed in", "danger"];
}

function StudentTile({ r, graded, max, onOpen }: { r: StudentRow; graded: boolean; max: number; onOpen: () => void }) {
  const hi = r.sub.handin;
  const n = hi?.files?.length ?? 0;
  const detail = [r.roll > 0 ? `Roll ${String(r.roll).padStart(2, "0")}` : "", hi ? `${n} ${n === 1 ? "file" : "files"} • ${whenLabel(hi.submittedAt)}` : onPaper(r.sub) ? "On paper" : ""].filter(Boolean).join(" • ");
  const [label, tone] = statusOf(r, graded, max);
  return <li>
    <button type="button" onClick={onOpen} aria-label={`Review ${r.name}`} className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-1 py-2.5 text-left hover:bg-surface-container-low">
      <Avatar name={r.name} size={36} />
      <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.name}</span>{detail && <span className="block truncate text-xs text-on-surface-variant">{detail}</span>}</span>
      {r.sub.status !== "pending" && isLate(r.sub) && <Badge tone="warning">Late</Badge>}
      <Badge tone={tone}>{label}</Badge>
    </button>
  </li>;
}

function ReviewPanel({ h, r, rows, busy, onPaper: setPaper, onSave }: {
  h: Homework; r: StudentRow; rows: StudentRow[]; busy: boolean;
  onPaper: (handedIn: boolean) => void; onSave: (input: { marks?: number; feedback: string }, next: boolean) => void;
}) {
  const graded = isGraded(h);
  const max = maxMarksOf(h);
  const [marks, setMarks] = useState(typeof r.sub.marks === "number" ? marksText(r.sub.marks) : "");
  const [feedback, setFeedback] = useState(r.sub.feedback ?? "");
  const [error, setError] = useState("");
  const hi = r.sub.handin;
  const pending = r.sub.status === "pending";
  const more = nextToGrade(rows, r.id) !== null;
  const step = (by: number) => { const v = Math.min(max, Math.max(0, (Number(marks) || 0) + by)); setMarks(marksText(v)); setError(""); };

  function save(next: boolean) {
    let m: number | undefined;
    if (graded) {
      m = marks.trim() === "" ? NaN : Number(marks);
      if (!Number.isFinite(m) || m < 0 || m > max) { setError(`Enter marks from 0 to ${max}`); return; }
    }
    onSave({ marks: m, feedback }, next);
  }

  return <div className="space-y-5">
    <section aria-label="Hand-in" className="rounded-lg bg-surface-container-low p-3">
      <div className="flex items-center gap-2">
        {hi ? <CloudUpload size={18} className="text-success" /> : pending ? <Hourglass size={18} className="text-error" /> : <FileText size={18} className="text-success" />}
        <p className="flex-1 text-sm font-semibold">{hi ? `Handed in through the parent app • ${whenLabel(hi.submittedAt)}` : pending ? "Not handed in yet" : "Handed in on paper"}</p>
        {isLate(r.sub) && <Badge tone="warning">Late</Badge>}
      </div>
      {hi && <>
        {(hi.files ?? []).length > 0 && <ul aria-label="Handed-in files" className="mt-2 space-y-1.5">
          {(hi.files ?? []).map((f, i) => <li key={i}><FileLink name={f.name} url={f.url} size={sizeLabel(f.size)} image={isImageRef(f)} /></li>)}
        </ul>}
        {hi.note && <p className="mt-2 text-sm text-on-surface-variant italic">“{hi.note}”</p>}
      </>}
      {!hi && <button type="button" disabled={busy} onClick={() => setPaper(pending)} className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-secondary disabled:opacity-50">
        {pending ? <><Check size={15} />Mark handed in on paper</> : <><Undo2 size={15} />Undo: not handed in</>}
      </button>}
    </section>

    {graded && <div>
      <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Marks</p>
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" aria-label="One mark less" onClick={() => step(-1)} className="grid size-9 cursor-pointer place-items-center rounded-full bg-surface-container text-secondary"><Minus size={18} /></button>
        <div className="flex items-center gap-1 rounded border border-outline-variant px-2 focus-within:border-secondary">
          <input aria-label="Marks" inputMode="decimal" value={marks} onChange={(e) => { setMarks(e.target.value.replace(/[^0-9.]/g, "")); setError(""); }} className="h-10 w-14 bg-transparent text-center text-lg font-semibold outline-none" />
          <span className="text-sm text-on-surface-variant">/{max}</span>
        </div>
        <button type="button" aria-label="One mark more" onClick={() => step(1)} className="grid size-9 cursor-pointer place-items-center rounded-full bg-surface-container text-secondary"><Plus size={18} /></button>
        <div className="ml-auto flex gap-1">
          {([1, 0.75, 0.5] as const).map((p) => <button key={p} type="button" onClick={() => { setMarks(marksText(Math.round(max * p))); setError(""); }}
            className="h-8 cursor-pointer rounded-full border border-outline-variant px-2.5 text-xs font-semibold hover:bg-surface-container-low">{p === 1 ? "Full" : `${p * 100}%`}</button>)}
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
    </div>}

    <div>
      <p className="mb-1.5 text-xs font-semibold text-on-surface-variant">Feedback for the parent</p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {QUICK_FEEDBACK.map((q) => <button key={q} type="button" onClick={() => setFeedback((t) => (t.trim() ? `${t.trim()}. ${q}` : q))}
          className="cursor-pointer rounded-full border border-outline-variant bg-surface-container-lowest px-2.5 py-1 text-xs hover:bg-surface-container-low">{q}</button>)}
      </div>
      <Textarea aria-label="Feedback" rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Optional note shown to the parent" />
    </div>

    <div className="flex gap-2">
      <Button className="flex-1" variant={more ? "outline" : "primary"} disabled={busy} onClick={() => save(false)}><Check size={16} />{graded ? "Save grade" : "Mark as done"}</Button>
      {more && <Button className="flex-1" disabled={busy} onClick={() => save(true)}>Save &amp; next</Button>}
    </div>
  </div>;
}
