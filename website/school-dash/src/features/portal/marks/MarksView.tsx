"use client";
// Staff portal › Marks entry: the teacher's own mark sheets (exm_sheets where ownerId == staffId) grouped by exam cycle,
// with the entry grid of one sheet (exm_marks written exactly as the teacher app's MarksAdapter does) and "Submit sheet"
// (the only sheet transition a teacher may write). Mirrors mobile app/teacher/lib/modules/attendance marks screens.
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Input, PageHeader, Select, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useStaffProfile } from "@/lib/portal/useStaffProfile";
import { isSheetOpen, sheetStatusLabel, sheetTone, type Sheet } from "@/features/exams/sheets";
import { markError, markValue } from "@/features/exams/logic";
import type { Candidate, Cycle, Paper } from "@/features/exams/types";
import { classIdLabel } from "@/lib/academicStreams";
import {
  MARK_STATUSES, MARK_TAGS, draftOf, legacyAllocations, markDocId, markDraftError, markEntryState, markTotal, maxTotalOf, numericComponents,
  sheetMarkDoc, sheetMarkPatch, sheetProgress, sheetRoster, sheetSubmitPatch, sheetSubmitProblem, type MarkDraft, type PortalMark, type StudentDoc,
} from "../exams";

type PaperRow = Paper & { sheetsOpened?: boolean };

export function MarksView() {
  const { staffId, teaching } = useStaffProfile();
  const sheetStore = useCollection<Sheet>("exm_sheets", teaching, [["ownerId", "==", staffId]]);
  // the query already carries the rules' ownerId filter; keep the same guard client-side
  const sheets = { ...sheetStore, rows: sheetStore.rows.filter((s) => s.ownerId === staffId) };
  const cycles = useCollection<Cycle>("exm_cycles", teaching);
  const papers = useCollection<PaperRow>("exm_papers", teaching);
  const assignments = useCollection<{ id: string; teacherId?: string; classId?: string; subject?: string }>("assignments", teaching, [["teacherId", "==", staffId]]);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!teaching) return <EmptyState title="Only teachers enter marks" hint="Mark sheets are assigned to teaching staff by the exam office." />;

  const open = openId ? sheets.rows.find((s) => s.id === openId) : undefined;
  if (open) return <SheetEntry sheet={open} paper={papers.rows.find((p) => p.id === open.paperId)} cycle={cycles.rows.find((c) => c.id === open.cycleId)} onBack={() => setOpenId(null)} />;

  const groups = cycles.rows.map((cycle) => ({ cycle, sheets: sheets.rows.filter((s) => s.cycleId === cycle.id).sort((a, b) => `${a.subject} ${a.classLabel}`.localeCompare(`${b.subject} ${b.classLabel}`)) }))
    .filter((g) => g.sheets.length);
  const orphans = sheets.rows.filter((s) => !cycles.rows.some((c) => c.id === s.cycleId));
  const legacy = legacyAllocations(papers.rows, assignments.rows, sheets.rows, staffId);
  const label = (s: Sheet) => `${s.subject} · ${s.classLabel || classIdLabel(s.classId)}`;

  return <div className="space-y-5">
    <PageHeader title="Marks entry" subtitle="Your mark sheets by exam. Enter every component or an attendance status, then submit the sheet to the exam office." />
    {!sheets.ready ? <p className="text-on-surface-variant">Loading…</p>
      : !sheets.rows.length && !legacy.length ? <EmptyState title="No mark sheets yet" hint="Sheets appear here when the exam office opens marks entry for an exam you evaluate." />
      : null}
    {[...groups, ...(orphans.length ? [{ cycle: undefined, sheets: orphans }] : [])].map(({ cycle, sheets: rows }) => (
      <Card key={cycle?.id ?? "other"}>
        <CardHeader title={cycle?.title ?? "Other exams"} subtitle={cycle ? `${cycle.start} – ${cycle.end}` : undefined} />
        <ul className="divide-y divide-outline-variant/60">
          {rows.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-semibold">{label(s)}</p>
                <p className="text-xs text-on-surface-variant">{s.summary ? `${s.summary.entered} / ${s.summary.total} entered` : `${s.rosterIds.length} students`}{s.submittedAt ? ` · submitted ${s.submittedAt.slice(0, 16).replace("T", " ")}` : ""}</p>
                {s.status === "Returned" && s.returnNote && <p className="mt-1 text-xs text-warning">Returned: {s.returnNote}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={sheetTone(s.status)}>{sheetStatusLabel[s.status]}</Badge>
                <Button size="sm" variant={isSheetOpen(s.status) ? "primary" : "outline"} aria-label={`Open ${label(s)}`} onClick={() => setOpenId(s.id)}>{isSheetOpen(s.status) ? "Enter marks" : "View"}</Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    ))}
    {legacy.length > 0 && (
      <Card>
        <CardHeader title="Awaiting sheet" subtitle="Papers you evaluate whose marks entry has not been opened yet." />
        <ul className="divide-y divide-outline-variant/60">
          {legacy.map((a) => (
            <li key={`${a.paperId}__${a.classId}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <p className="font-semibold">{a.subject} · {classIdLabel(a.classId)}</p>
              <p className="text-xs text-on-surface-variant">Marks entry opens when the office opens the sheet</p>
            </li>
          ))}
        </ul>
      </Card>
    )}
  </div>;
}

/** One numeric component cell: a blank or a whole number 0..max is saved on blur / Enter; anything else shows an error and is not saved. */
function MarkCell({ value, max, disabled, label, what, onCommit }: { value: number | null; max: number; disabled?: boolean; label: string; what: string; onCommit: (v: number | null) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = draft ?? (value === null ? "" : String(value));
  const commit = () => {
    if (draft === null) return;
    const e = markError(draft, max, what);
    if (e) return setErr(e);
    setErr(""); setDraft(null);
    const next = markValue(draft);
    if (next !== value) onCommit(next);
  };
  return <div>
    <Input aria-label={label} inputMode="numeric" disabled={disabled} value={shown} placeholder="--" aria-invalid={!!err || undefined} className="h-9 w-20"
      onChange={(e) => { setDraft(e.target.value); setErr(""); }} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />
    {err && <span className="mt-1 block text-xs text-error">{err}</span>}
  </div>;
}

function TextCell({ value, label, disabled, onCommit }: { value: string; label: string; disabled?: boolean; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft !== null && draft !== value) onCommit(draft); setDraft(null); };
  return <Input aria-label={label} disabled={disabled} value={draft ?? value} placeholder="Note" maxLength={2000} className="h-9 min-w-40"
    onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()} />;
}

function SheetEntry({ sheet, paper, cycle, onBack }: { sheet: Sheet; paper?: PaperRow; cycle?: Cycle; onBack: () => void }) {
  const toast = useToast();
  const { staffId } = useStaffProfile();
  const sheets = useCollection<Sheet>("exm_sheets", true, [["ownerId", "==", staffId]]);
  const marks = useCollection<PortalMark>("exm_marks", true, [["teacherId", "==", staffId]]);
  const candidates = useCollection<Candidate>("exm_candidates");
  const students = useCollection<StudentDoc>("students");
  const [busy, setBusy] = useState(false);

  const roster = sheetRoster(sheet, candidates.rows, students.rows);
  const byStudent = new Map(marks.rows.filter((m) => m.paperId === sheet.paperId && m.classId === sheet.classId).map((m) => [m.studentId, m]));
  const components = sheet.components;
  const numeric = numericComponents(components);
  const gradeOnly = components.mode === "grade";
  const sheetClosed = !isSheetOpen(sheet.status);
  // the rules dispatch a teacher's marks write to the sheet branch only when the paper is flagged (openEntry sets it)
  const paperFlagged = !paper || paper.sheetsOpened === true;
  const readOnly = sheetClosed || !paperFlagged;
  const progress = sheetProgress(sheet, byStudent);
  const label = `${sheet.subject} · ${sheet.classLabel || classIdLabel(sheet.classId)}`;

  const save = async (studentId: string, patch: Partial<MarkDraft>) => {
    const existing = byStudent.get(studentId);
    const draft: MarkDraft = { ...draftOf(existing), ...patch };
    const problem = markDraftError(components, draft);
    if (problem) return toast(problem, "error");
    const now = new Date().toISOString();
    try {
      if (existing) await marks.update(existing.id, sheetMarkPatch(sheet, studentId, staffId, draft, now));
      else await marks.create({ id: markDocId(sheet.paperId, studentId), ...sheetMarkDoc(sheet, studentId, staffId, draft, now) });
    } catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not save marks", "error"); }
  };
  const submit = async () => {
    const problem = sheetSubmitProblem(sheet, byStudent);
    if (problem) return toast(problem, "error");
    setBusy(true);
    try {
      await sheets.update(sheet.id, sheetSubmitPatch(staffId, new Date().toISOString()));
      toast(`${label} submitted`);
    } catch (error) { toast(error instanceof Error && error.message ? error.message : "Could not submit the sheet", "error"); }
    finally { setBusy(false); }
  };
  const stateBadge = (studentId: string) => {
    const state = markEntryState(components, byStudent.get(studentId));
    return state === "entered" ? <Badge tone="success">Entered</Badge> : state === "absent" ? <Badge tone="warning">{byStudent.get(studentId)?.status}</Badge>
      : state === "invalid" ? <Badge tone="danger">Out of range</Badge> : <Badge tone="neutral">Pending</Badge>;
  };

  return <div className="space-y-5">
    <PageHeader title={label} subtitle={`${cycle?.title ?? "Exam"}${paper?.date ? ` · ${paper.date}` : ""} · ${gradeOnly ? "Grade only" : numeric.map((c) => `${c.label} ${c.max}`).join(" / ")}`}
      actions={<>
        <Button variant="ghost" onClick={onBack}><ArrowLeft size={16} />All sheets</Button>
        <Badge tone={sheetTone(sheet.status)}>{sheetStatusLabel[sheet.status]}</Badge>
        {!sheetClosed && <Button onClick={submit} disabled={busy || !paperFlagged}>Submit sheet</Button>}
      </>} />
    {sheet.status === "Returned" && <Card className="border-warning/60 p-4 text-sm"><b>Returned for correction.</b> {sheet.returnNote?.trim() || "No note was added."}</Card>}
    {sheetClosed && <p className="text-sm text-on-surface-variant">{sheet.status === "Submitted" ? "The sheet is read-only until the reviewer returns it to you." : "The exam office has closed this sheet."}</p>}
    {!paperFlagged && <p className="text-sm text-on-surface-variant">Marks entry opens when the office opens the sheet.</p>}
    <p className="text-sm text-on-surface-variant">{progress.entered} entered · {progress.absent} absent · {progress.pending} pending{progress.invalid ? ` · ${progress.invalid} out of range` : ""} of {progress.total}</p>
    <Card className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead><tr className="border-b border-outline-variant/60 bg-surface-container-low text-xs uppercase text-on-surface-variant">
          <th className="px-4 py-2.5">Student</th>
          {gradeOnly ? <th className="px-4 py-2.5">Grade</th> : numeric.map((c) => <th key={c.key} className="px-4 py-2.5">{c.label} (max {c.max})</th>)}
          {!gradeOnly && <th className="px-4 py-2.5">Total</th>}
          <th className="px-4 py-2.5">Attendance</th><th className="px-4 py-2.5">Tag</th><th className="px-4 py-2.5">Note</th><th className="px-4 py-2.5">State</th>
        </tr></thead>
        <tbody>
          {roster.map((r) => {
            const m = byStudent.get(r.studentId);
            const present = (m?.status ?? "Present") === "Present";
            const total = markTotal(m);
            return <tr key={r.studentId} className="border-b border-outline-variant/40 align-top">
              <td className="px-4 py-2"><div className="font-semibold">{r.name}</div><div className="text-xs text-outline">{[r.roll, r.grn && `GRN ${r.grn}`].filter(Boolean).join(" · ")}</div></td>
              {gradeOnly ? <td className="px-4 py-2">
                <Select aria-label={`Grade for ${r.name}`} disabled={readOnly || !present} value={m?.gradeValue ?? ""} onChange={(e) => save(r.studentId, { gradeValue: e.target.value })}>
                  <option value="">Not entered</option>{components.gradeOptions.map((g) => <option key={g}>{g}</option>)}
                </Select></td>
                : numeric.map((c) => <td key={c.key} className="px-4 py-2">
                  <MarkCell label={`${c.label} marks for ${r.name}`} what={c.label} value={m?.[c.key] ?? null} max={c.max} disabled={readOnly || !present} onCommit={(v) => save(r.studentId, { [c.key]: v })} />
                </td>)}
              {!gradeOnly && <td className="px-4 py-2 whitespace-nowrap">{total === null ? <span className="text-outline">-- / {maxTotalOf(components)}</span> : <b>{total} / {maxTotalOf(components)}</b>}</td>}
              <td className="px-4 py-2"><Select aria-label={`Exam attendance for ${r.name}`} disabled={readOnly} value={m?.status ?? "Present"} onChange={(e) => save(r.studentId, { status: e.target.value })}>
                {MARK_STATUSES.map((s) => <option key={s}>{s}</option>)}</Select></td>
              <td className="px-4 py-2"><Select aria-label={`Tag for ${r.name}`} disabled={readOnly} value={m?.tag ?? ""} onChange={(e) => save(r.studentId, { tag: e.target.value })}>
                <option value="">No tag</option>{MARK_TAGS.map((t) => <option key={t}>{t}</option>)}</Select></td>
              <td className="px-4 py-2"><TextCell label={`Note for ${r.name}`} value={m?.note ?? ""} disabled={readOnly} onCommit={(v) => save(r.studentId, { note: v })} /></td>
              <td className="px-4 py-2">{stateBadge(r.studentId)}</td>
            </tr>;
          })}
          {!roster.length && <tr><td colSpan={8}><EmptyState title="No students on this sheet" /></td></tr>}
        </tbody>
      </table>
    </Card>
  </div>;
}
