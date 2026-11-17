"use client";
import { runTransaction } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { schoolDoc, stamp } from "@/features/fees/logic";
import { markFingerprint } from "../../../../functions/examAssessment";
import { ExamSummary } from "./ExamSummary";
import { OperationalOverview } from "./OperationalOverview";
import { examAction } from "./examService";
import { consolidated, participates } from "../../../../functions/examOperations";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileSpreadsheet, FileUp, Lock, LockOpen, Pencil, Plus, Send, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, ListToolbar, Modal, PageHeader, Select, Stat, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { downloadCsv, parseCsv } from "@/features/fees/csv";
import { ExamDuties } from "./ExamDuties";
import { SheetActions } from "./SheetBoard";
import { isSheetOpen, sheetLockedMessage, sheetStatusLabel, sheetTone, type Sheet } from "./sheets";
import { labelToClassId, markError, markValue, paperCoversClass, publishBlocker, rosterOf, studentIdOf, subjectTeacherId, withoutLabel, type StudentRow } from "./logic";
import { endTime, evaluate, startLabel, type Candidate, type Cycle, type Eval, type Mark, type Paper } from "./types";

/** draft cycles may hold papers without a date/time yet */
const when = (p: Paper) => (p.date ? `${fmtDate(p.date)} · ${p.start ? `${startLabel(p.start)} - ${endTime(p.start, p.duration || 0)}` : "time TBD"}` : "Date TBD");
const pubOf = (p?: Paper) => p?.published ?? [];

const stateBadge = (e: Eval) => {
  switch (e.state) {
    case "verified": return <Badge tone="success"><CheckCircle2 size={12} />Verified</Badge>;
    case "passed": return <Badge tone="neutral">✓ Passed</Badge>;
    case "failed": return <Badge tone="warning">Below pass mark</Badge>;
    case "medical": return <Badge tone="warning">Medical / Re-exam</Badge>;
    case "absent": return <Badge tone="warning">{e.grade === "DQ" ? "Disqualified" : "Absent"}</Badge>;
    case "exempt": return <Badge tone="neutral">Exempt</Badge>;
    case "invalid": return <Badge tone="danger"><AlertTriangle size={12} />Error: out of range</Badge>;
    default: return <Badge tone="neutral">Pending</Badge>;
  }
};

/** One mark cell: a blank or a whole number 0..max is saved on blur / Enter; anything else shows an error and is not saved. */
function MarkInput({ value, max, disabled, onCommit, label, what }: { value: number | null; max: number; disabled?: boolean; onCommit: (v: number | null) => void; label: string; what: string }) {
  const [v, setV] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const shown = v ?? (value === null ? "" : String(value));
  const bad = !!err || (value !== null && (value > max || value < 0));
  const commit = () => {
    if (v === null) return;
    const e = markError(v, max, what);
    if (e) return setErr(e);
    setErr(""); setV(null);
    const next = markValue(v);
    if (next !== value) onCommit(next); // unchanged: nothing to write
  };
  return (
    <div>
      <div className="flex items-center gap-2">
        <input aria-label={label} inputMode="numeric" disabled={disabled} value={shown} placeholder="--" aria-invalid={bad || undefined}
          onChange={(e) => { setV(e.target.value); setErr(""); }}
          onBlur={commit}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          className={`h-9 w-16 rounded border px-2 text-center font-mono text-sm focus:outline-2 focus:outline-secondary/30 ${bad ? "border-error bg-error-container/40 text-error" : "border-outline-variant bg-surface-container-lowest"} disabled:bg-surface-container`} />
        <span className={`font-mono text-xs ${bad ? "text-error" : "text-outline"}`}>/ {max}</span>
      </div>
      {err && <p role="alert" className="mt-1 max-w-40 text-xs text-error">{err}</p>}
    </div>
  );
}

/** a sheet-board row the detail page asked the grid to show */
export type GridFocus = { cls: string; paperId: string };

export function ExamsPage({ cycleOverride, embedded = false, focus = null }: { cycleOverride?: string; embedded?: boolean; focus?: GridFocus | null } = {}) {
  const toast = useToast();
  const router = useRouter();
  const cycles = useCollection<Cycle>("exm_cycles");
  const papers = useCollection<Paper>("exm_papers");
  const candCol = useCollection<Candidate>("exm_candidates");
  const students = useCollection<StudentRow>("students").rows;
  const assignments = useCollection<{ id: string; classId: string; subject: string; teacherId: string }>("assignments").rows;
  const marks = useCollection<Mark>("exm_marks");
  // persisted candidates + generated ones for students without a row yet (a new school has no exm_candidates)
  const cands = useMemo(() => ({ rows: rosterOf(candCol.rows, students) }), [candCol.rows, students]);

  const [showSummary, setShowSummary] = useState(false);
  const [cycleId, setCycleId] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [clsPick, setCls] = useState("8-A");
  const [paperId, setPaperId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = cycles.rows.find((c) => c.id === (cycleOverride || cycleId)) ?? cycles.rows.find((c) => c.status === "Live") ?? cycles.rows[0];
  const curId = cycleOverride || cycleId || active?.id || "";
  const cur = cycles.rows.find((c) => c.id === curId);
  // mark sheets of the shown cycle (contract: a paper × division with a sheet follows the sheet workflow)
  const sheets = useCollection<Sheet>("exm_sheets", !!curId, [["cycleId", "==", curId]]).rows.filter((s) => s.cycleId === curId);

  const activePapers = papers.rows.filter((p) => p.cycleId === active?.id && p.scheduleStatus !== "Cancelled");
  const done = activePapers.filter((p) => p.status === "Completed").length;
  const entered = activePapers.filter((p) => { const roster = cands.rows.filter((c) => participates(p, c)); return roster.length > 0 && roster.every((c) => !["pending", "invalid", "medical"].includes(evaluate(marks.rows.find((m) => m.paperId === p.id && (m.candId === c.id || m.studentId === studentIdOf(c))), p.theory, p.internal, p).state)); }).length;
  const activeMarks = marks.rows.filter((m) => activePapers.some((p) => p.id === m.paperId));
  const evs = active ? consolidated(active, activePapers, cands.rows, activeMarks).filter((e) => e.complete && e.pct !== null) : [];
  const avg = evs.length ? evs.reduce((a, e) => a + e.pct!, 0) / evs.length : 0;
  const passRate = evs.length ? (evs.filter((e) => e.passed === true).length / evs.length) * 100 : 0;

  const cyclePapers = papers.rows.filter((p) => p.cycleId === curId && (gradeFilter === "all" || p.grade === gradeFilter))
    .sort((a, b) => +a.grade - +b.grade || (a.date ?? "").localeCompare(b.date ?? ""));
  const gradesInCycle = [...new Set(papers.rows.filter((p) => p.cycleId === curId).map((p) => p.grade))].sort((a, b) => +a - +b);

  const scheduleCols: Column<Paper>[] = [
    { key: "subject", header: "Grade / Subject", sortValue: (p) => p.grade + p.subject, render: (p) => <span className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-secondary" />Grade {p.grade} · {p.subject}</span> },
    { key: "code", header: "Exam code", render: (p) => <span className="font-mono text-on-surface-variant">{p.code}</span> },
    { key: "date", header: "Date & time", sortValue: (p) => p.date, render: (p) => <span className="whitespace-nowrap">{when(p)}</span> },
    { key: "marks", header: "Marks breakup", render: (p) => <span className="whitespace-nowrap rounded border border-outline-variant/60 bg-surface-container-low px-2 py-1 font-mono text-xs">{p.assessmentMode === "grade" ? "Grade only" : `${p.theory} Theory / ${p.practical || 0} Practical / ${p.internal} Internal`}</span> },
    { key: "venue", header: "Venue / hall", render: (p) => p.venue },
    { key: "inv", header: "Evaluator / chief", render: (p) => p.invigilator },
    { key: "status", header: "Status", render: (p) => <Badge tone={p.scheduleStatus === "Postponed" ? "warning" : p.scheduleStatus === "Cancelled" ? "danger" : p.status === "Completed" ? "success" : "info"}>{p.scheduleStatus && p.scheduleStatus !== "Scheduled" ? p.scheduleStatus : p.status}</Badge> },
  ];

  // ---------- marks entry ----------
  const classes = [...new Set(cands.rows.filter((c) => activePapers.some((p) => paperCoversClass(p, c.cls, c.classId))).map((c) => c.cls))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  // fall back to a class that has candidates (the default "8-A" may not exist in this school)
  const cls = classes.includes(clsPick) ? clsPick : classes[0] ?? clsPick;
  const grade = cls.split("-")[0];
  const classPapers = papers.rows.filter((p) => p.cycleId === curId && p.grade === grade && p.scheduleStatus !== "Cancelled" && paperCoversClass(p, cls, cands.rows.find((candidate) => candidate.cls === cls)?.classId));
  const paper = classPapers.find((p) => p.id === paperId) ?? classPapers[0];
  const roster = paper ? cands.rows.filter((c) => c.cls === cls && (!paper.studentIds || paper.studentIds.includes(studentIdOf(c)))) : [];
  const markOf = (cid: string) => marks.rows.find((m) => m.paperId === paper?.id && m.candId === cid);
  const [sel, setSel] = useState<string[]>([]);
  const [busy, setBusy] = useState(false), [reopening, setReopening] = useState(false), [reopenReason, setReopenReason] = useState("");
  const classId = roster[0]?.classId || labelToClassId(cls);
  const sheet = paper ? sheets.find((s) => s.paperId === paper.id && s.classId === classId) : undefined;
  const sheetClosed = !!sheet && !isSheetOpen(sheet.status);
  // the detail page's sheet board picks a row: adopt it once per focus change (state adjusted during render, no effect)
  const [seenFocus, setSeenFocus] = useState<GridFocus | null>(null);
  if (focus !== seenFocus) { setSeenFocus(focus); if (focus) { setCls(focus.cls); setPaperId(focus.paperId); setSel([]); } }

  /** writes one candidate's marks; returns false (and toasts unless quiet) on failure */
  const save = async (c: Candidate, patch: Partial<Mark>, quiet = false) => {
    if (!paper) return false;
        // contract 4: studentId + classId for par_results and the teacher app; teacherId = the subject teacher, so the teacher
    // app lists the mark and the rules let that teacher edit it (ownsExisting)
    const studentId = studentIdOf(c), classId = c.classId || labelToClassId(c.cls);
    // with a sheet the mark belongs to the sheet owner and the admin is "entering on behalf" (enteredBy)
    const teacherId = sheet ? sheet.ownerId : (paper.evaluatorIds?.[classId] ?? subjectTeacherId(assignments, paper.subject, classId));
    try {
      const markRef = schoolDoc("exm_marks", markOf(c.id)?.id ?? paper.id + "__" + c.id);
      const paperRef = schoolDoc("exm_papers", paper.id);
      const sheetRef = sheet ? schoolDoc("exm_sheets", sheet.id) : null;
      await runTransaction(db, async (tx) => {
        const [currentPaper, currentMark, currentSheet] = await Promise.all([tx.get(paperRef), tx.get(markRef), sheetRef ? tx.get(sheetRef) : null]);
        if (!currentPaper.exists()) throw new Error("Paper unavailable");
        const verifying = Object.keys(patch).every((key) => key === "verified");
        if (currentSheet?.exists()) {
          // sheet branch (contract 1, marks write rules): the sheet status replaces the paper-level lock
          if (!verifying && !isSheetOpen(currentSheet.get("status"))) throw new Error(sheetLockedMessage(currentSheet.get("status")));
          if (!verifying && (currentPaper.get("setupPublished") === false || currentPaper.get("scheduleStatus") === "Cancelled")) throw new Error("Marks entry is locked");
        } else if ((currentPaper.get("locked") || (currentPaper.get("lockedClassIds") || []).includes(classId) || currentPaper.get("setupPublished") === false || ["Cancelled", "Postponed"].includes(currentPaper.get("scheduleStatus"))) && !verifying) throw new Error("Marks entry is locked");
        if ((currentPaper.get("setupVersion") ?? 0) !== (paper.setupVersion ?? 0)) throw new Error("Exam configuration changed");
        const audit = stamp();
        const numericChanged = !verifying;
        const previous = currentMark.data();
        const verification = verifying && patch.verified ? { verificationFingerprint: markFingerprint(previous, { ...currentPaper.data(), theory: currentPaper.get("theory"), internal: currentPaper.get("internal") }) } : {};
        if (verifying && ["theory", "internal", "practical", "gradeValue", "status", "medical"].some((field) => JSON.stringify(previous?.[field]) !== JSON.stringify(markOf(c.id)?.[field as keyof Mark]))) throw new Error("Marks changed. Review them again before verification.");
        const onBehalf = currentSheet?.exists() && numericChanged ? { teacherId: currentSheet.get("ownerId") || teacherId, enteredBy: auth.currentUser?.uid ?? "" } : {};
        if (currentMark.exists()) tx.update(markRef, { ...patch, ...verification, studentId, classId,
          ...(!previous?.teacherId && teacherId ? { teacherId } : {}), ...(numericChanged ? { verified: false } : {}), ...onBehalf, ...audit });
        else tx.set(markRef, { id: markRef.id, theory: null, internal: null, medical: false, verified: false,
          paperId: paper.id, candId: c.id, studentId, classId, teacherId, ...patch, ...onBehalf, ...audit });
        if (numericChanged && (currentPaper.get("published") ?? []).includes(cls)) tx.update(paperRef, { published: withoutLabel(currentPaper.get("published"), cls), ...audit });
      });
      return true;
    } catch (error) { if (!quiet) toast(error instanceof Error ? error.message : "Could not save marks", "error"); return false; }
  };
  const evOf = (c: Candidate) => evaluate(markOf(c.id), paper?.theory ?? 80, paper?.internal ?? 20, paper);
  const enteredCount = roster.filter((c) => !["pending", "invalid"].includes(evOf(c).state)).length;
  const errCount = roster.filter((c) => evOf(c).state === "invalid").length;
  const isPublished = pubOf(paper).includes(cls);
  const legacyLocked = !!paper?.locked || !!paper?.lockedClassIds?.includes(classId) || isPublished;
  const isMarkLocked = sheet ? sheetClosed : legacyLocked;
  const readOnly = sheet ? sheetClosed || paper?.setupPublished === false || paper?.scheduleStatus === "Cancelled" : legacyLocked || paper?.setupPublished === false || paper?.scheduleStatus === "Postponed";
  const maxTotal = (paper?.theory ?? 80) + (paper?.internal ?? 20) + (paper?.practical ?? 0);

  type Row = Candidate;
  const markCols: Column<Row>[] = [
    { key: "name", header: "Candidate & roll no", sortValue: (c) => c.roll, render: (c) => (
      <div><div className="font-semibold">{c.name}</div><div className="text-xs text-outline">{c.roll} · GRN {c.grn}</div></div>) },
    ...(paper?.assessmentMode === "grade" ? [{ key: "assessmentGrade", header: "Assessment grade", render: (c: Row) => <Select aria-label={"Grade for " + c.name} disabled={readOnly} value={markOf(c.id)?.gradeValue ?? ""} onChange={(e) => save(c, { gradeValue: e.target.value })}>
      <option value="">Not entered</option>{paper.gradeOptions?.map((grade) => <option key={grade}>{grade}</option>)}</Select> }] : [
    { key: "theory", header: `Theory (max ${paper?.theory ?? 80})`, render: (c: Row) => <MarkInput label={`Theory marks for ${c.name}`} what="Theory" value={markOf(c.id)?.theory ?? null} max={paper?.theory ?? 80} disabled={!paper || readOnly || paper.theory === 0} onCommit={(v) => save(c, { theory: v })} /> },
    { key: "internal", header: `Internal (max ${paper?.internal ?? 20})`, render: (c: Row) => <MarkInput label={`Internal marks for ${c.name}`} what="Internal" value={markOf(c.id)?.internal ?? null} max={paper?.internal ?? 20} disabled={!paper || readOnly || paper.internal === 0} onCommit={(v) => save(c, { internal: v })} /> },
    ...((paper?.practical ?? 0) > 0 ? [{ key: "practical", header: "Practical (max " + paper!.practical + ")", render: (c: Row) => <MarkInput label={"Practical marks for " + c.name} what="Practical" value={markOf(c.id)?.practical ?? null} max={paper!.practical!} disabled={readOnly} onCommit={(value) => save(c, { practical: value })} /> }] : []),
    ]),
    { key: "attendance", header: "Exam attendance", render: (c) => <Select aria-label={"Exam attendance for " + c.name} disabled={!paper || readOnly} value={markOf(c.id)?.status ?? "Present"} onChange={(e) => save(c, { status: e.target.value, ...(e.target.value !== "Present" ? { theory: null, internal: null, practical: null, gradeValue: "", medical: e.target.value === "Medical Slip" } : { medical: false }) })}>
      {["Present", "Absent", "Medical Slip", "Exempt", "Disqualified"].map((status) => <option key={status}>{status === "Absent" ? "Absent from exam" : status}</option>)}</Select> },
    { key: "total", header: "Total & %", render: (c) => { const e = evOf(c); if (paper?.assessmentMode === "grade") return <span>Grade-only assessment</span>; return e.state === "invalid" ? <span className="font-semibold text-error">{e.total}/{maxTotal} <span className="font-normal">(Invalid)</span></span> : e.total === null ? <span className="text-outline">-- / {maxTotal} (Pending)</span> : <span><b>{e.total}/{maxTotal}</b> <span className="text-outline">({e.pct!.toFixed(1)}%)</span></span>; } },
    { key: "grade", header: "Grade", render: (c) => { const e = evOf(c); return <Badge tone={e.state === "invalid" ? "danger" : e.grade === "--" ? "neutral" : "brand"} className="font-mono">{e.grade}</Badge>; } },
    { key: "status", header: "Validation status", render: (c) => (
      <div className="flex items-center gap-2">{paper?.assessmentMode === "grade" && evOf(c).state === "passed" ? <Badge tone="neutral">Grade recorded</Badge> : stateBadge(evOf(c))}
        {evOf(c).state === "pending" || evOf(c).state === "medical" ? (
          <button type="button" className="cursor-pointer text-xs text-secondary hover:underline" onClick={(e) => { e.stopPropagation(); save(c, { medical: !markOf(c.id)?.medical }); }}>{markOf(c.id)?.medical ? "Clear flag" : "Flag medical"}</button>) : null}
      </div>) },
  ];

  const verifySelected = async () => {
    const targets = roster.filter((c) => sel.includes(c.id) && ["passed", "failed", "verified"].includes(evOf(c).state));
    if (!targets.length) return toast("Select valid, entered rows to verify", "error");
    const ok = (await Promise.all(targets.map((c) => save(c, { verified: true }, true)))).filter(Boolean).length;
    setSel([]);
    if (ok < targets.length) toast(`Verified ${ok} of ${targets.length}; ${targets.length - ok} could not be saved`, "error");
    else toast(`${ok} mark entr${ok > 1 ? "ies" : "y"} verified`);
  };
  // closing the marks window stops teachers editing this paper (the teacher app shows it as submitted) and notifies them
  const toggleLock = async (reason?: string) => {
    if (!paper) return;
    if (isMarkLocked && !reason) { setReopening(true); return; }
    const isReopening = isMarkLocked;
    setBusy(true);
    try {
      await examAction(paper.cycleId, "lock", { paperId: paper.id, locked: !isMarkLocked, reason: reason || "" });
      setReopening(false); setReopenReason("");
      toast(isReopening ? `Marks entry reopened for ${paper.subject}` : `Marks entry locked for ${paper.subject}; teachers notified`);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not update the marks window", "error"); } finally { setBusy(false); }
  };
  const publish = async () => {
    if (!paper) return;
    if (paper.resultRules?.requireApproval && roster.some((c) => ["passed", "failed"].includes(evOf(c).state))) {
      return toast("Verify all entered marks before approving publication", "error");
    }
    const blocker = publishBlocker(roster.map(evOf));
    if (blocker) return toast(blocker, "error");
    const res = await Promise.all(roster.filter((c) => ["passed", "failed"].includes(evOf(c).state)).map((c) => save(c, { verified: true }, true)));
    if (res.includes(false)) return toast(`${res.filter((x) => !x).length} entries could not be verified; nothing was published`, "error");
    setBusy(true);
    try {
      await examAction(paper.cycleId, "subjectPublish", { paperId: paper.id, classId: roster[0]?.classId || labelToClassId(cls) });
      toast(`Subject results published for Grade ${cls} · ${paper.subject}`);
    } catch (e) { toast(e instanceof Error ? e.message : "Could not publish the results", "error"); } finally { setBusy(false); }
  };

  const exportSheet = () => {
    if (!activeMarks.length) return toast("No marks entered for the active cycle yet", "error");
    const rows: (string | number)[][] = [["Cycle", "Grade", "Subject", "Class", "Roll", "Candidate", "Theory", "Internal", "Total", "Percent", "Grade", "Status"]];
    for (const m of activeMarks) {
      const p = papers.rows.find((x) => x.id === m.paperId)!; const c = cands.rows.find((x) => x.id === m.candId); if (!c) continue;
      const e = evaluate(m, p.theory, p.internal, p);
      rows.push([active?.title ?? "", p.grade, p.subject, c.cls, c.roll, c.name, m.theory ?? "", m.internal ?? "", e.total ?? "", e.pct?.toFixed(1) ?? "", e.grade, e.state]);
    }
    downloadCsv("master-sheet.csv", rows); toast("Master sheet exported");
  };
  const importMarks = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ""; // so picking the same file again fires onChange
    if (!file) return;
    if (!paper) return toast("Pick a class with a subject paper first", "error");
    if (paper.assessmentMode === "grade" || (paper.practical ?? 0) > 0) return toast("Enter this assessment using its grade or practical fields", "error");
    if (sheet && sheetClosed) return toast(sheetLockedMessage(sheet.status), "error");
    if (!sheet && paper.locked) return toast("Marks entry is locked for this paper. Reopen it to import marks.", "error");
    // a cell is blank (no mark) or a whole number; anything else skips the row instead of storing NaN
    const num = (v?: string) => (v == null || v.trim() === "" ? null : /^\d+$/.test(v.trim()) ? Number(v) : NaN);
    let range = 0;
    let rows: string[][];
    try { rows = parseCsv(await file.text()).filter((r) => r[0] && /^#?\w/.test(r[0]) && r[0].toLowerCase() !== "roll"); } catch { return toast("Could not read the file", "error"); }
    let n = 0, bad = 0, failed = 0;
    for (const r of rows) {
      const c = roster.find((x) => x.roll.toLowerCase() === (r[0].startsWith("#") ? r[0] : `#${r[0]}`).toLowerCase());
      if (!c) continue;
      const theory = num(r[1]), internal = num(r[2]);
      if (Number.isNaN(theory) || Number.isNaN(internal)) { bad++; continue; }
      if ((theory ?? 0) > paper.theory || (internal ?? 0) > paper.internal) { range++; continue; }
      if (await save(c, { theory, internal }, true)) n++; else failed++;
    }
    const skipped = [bad && `${bad} with non-numeric marks`, range && `${range} above the max marks`, failed && `${failed} not saved`].filter(Boolean).join(", ");
    if (n) toast(`Imported marks for ${n} candidate${n > 1 ? "s" : ""}${skipped ? ` (${skipped})` : ""}`, skipped ? "error" : "success");
    else toast(skipped ? `Nothing imported: ${skipped}` : "No matching roll numbers found (expected: roll,theory,internal)", "error");
  };
  const downloadTab = () => {
    if (!roster.length) return toast("No candidates in this class", "error");
    downloadCsv(`tabulation-${cls}-${paper?.code ?? ""}.csv`, [["Roll", "Candidate", "Theory", "Internal", "Total", "%", "Grade"], ...roster.map((c) => { const m = markOf(c.id); const e = evOf(c); return [c.roll, c.name, m?.theory ?? "", m?.internal ?? "", e.total ?? "", e.pct?.toFixed(1) ?? "", e.grade]; })]);
  };

  const stats = { pct: activePapers.length ? (entered / activePapers.length) * 100 : 0 };

  return (
    <>
      {!embedded && <>
      <PageHeader title="Exams & Results" subtitle="Configure examination cycles, manage subject schedules, enter & verify marks, and publish holistic student report cards."
        actions={<>
          <Button variant="outline" onClick={exportSheet}><FileSpreadsheet size={16} />Export Master Sheet (.csv)</Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp size={16} />Import Marks (CSV)</Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" aria-label="Import marks CSV" onChange={(e) => importMarks(e.target.files?.[0])} />
          <Button onClick={() => router.push("/exams/new")}><Plus size={16} />Create Exam Cycle</Button>
        </>} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="ACTIVE EXAM CYCLE" value={<span className="text-lg">{active?.title ?? "—"}</span>} sub={active?.status === "Live" ? "Live Cycle" : active?.status} subTone="success" />
        <Stat label="EXAM PAPERS & SCHEDULE" value={<>{done} / {activePapers.length} <span className="text-sm font-normal text-on-surface-variant">Papers Completed</span></>} sub={activePapers.length ? `${activePapers.length - done} remaining` : undefined} subTone="info" />
        <Stat label="MARKS TABULATION" value={<>{entered} / {activePapers.length} <span className="text-sm font-normal text-on-surface-variant">Batches Entered</span></>} sub={`${stats.pct.toFixed(1)}%`} subTone="info" />
        <Stat label="COHORT HEALTH" value={<>{evs.length ? avg.toFixed(1) : "—"} <span className="text-sm font-normal text-on-surface-variant">/ 100 Cohort Avg</span></>} sub={evs.length ? `${passRate.toFixed(1)}% Pass` : "No complete numeric results"} subTone="success" />
      </div>

      <OperationalOverview cycles={cycles.rows} papers={papers.rows} active={active} candidates={cands.rows} marks={marks.rows} />

      <Card className="mt-6">
        <CardHeader title="EXAMINATION CYCLES & SCHEDULE OVERVIEW" subtitle="Real-time timetable execution status, paper duration & invigilator allocations" />
        <div className="px-5 pb-3"><Tabs items={cycles.rows.map((c) => ({ id: c.id, label: c.short }))} value={curId} onChange={(v) => { setCycleId(v); setGradeFilter("all"); setPaperId(""); }} /></div>
        <ListToolbar className="px-5 pb-3" filters={<Select aria-label="Filter grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
              <option value="all">All Grades</option>{gradesInCycle.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </Select>} actions={cur && <><Button variant="outline" size="sm" onClick={() => router.push(`/exams/${cur.id}`)}>Open examination</Button><Button variant="outline" size="sm" onClick={() => router.push(`/exams/${cur.id}/edit`)}><Pencil size={14} />{cur.status === "Draft" ? "Edit cycle" : "View setup"}</Button></>} />
        <DataTable rows={cyclePapers} columns={scheduleCols} pageSize={6}
          empty={cycles.ready && !cycles.rows.length ? <EmptyState title="No exam cycles yet" hint="Create an exam cycle to schedule papers." action={<Button size="sm" onClick={() => router.push("/exams/new")}>Create exam cycle</Button>} />
            : <EmptyState title="No papers scheduled" hint="Edit this cycle to add subject paper slots." action={cur && <Button size="sm" onClick={() => router.push(`/exams/${cur.id}/edit`)}>Add paper slots</Button>} />} />
      </Card>

      <ExamDuties cycles={cycles.rows.filter((cycle) => cycle.publicationState !== "draft" && cycle.publicationState !== "scheduled")} papers={papers.rows.filter((paper) => !cycles.rows.some((cycle) => cycle.id === paper.cycleId && ["draft", "scheduled"].includes(cycle.publicationState ?? "")))} defaultCycleId={curId} />
      </>}

      <Card className="mt-6">
        <CardHeader title="SUBJECT MARKS TABULATION & RESULTS VERIFICATION" subtitle="Enter assessment marks or grades and review each student result"
          actions={<span className="flex items-center gap-3 text-on-surface-variant"><span><b className="text-on-surface">{roster.length}</b> Students Enrolled</span><span className="font-semibold text-success">{enteredCount}/{roster.length} Entered</span></span>} />
        <div className="grid gap-3 px-5 pb-4 md:grid-cols-2">
          <Select aria-label="Class" value={cls} onChange={(e) => { setCls(e.target.value); setPaperId(""); setSel([]); }}>
            {classes.length === 0 && <option value={cls}>No candidates yet</option>}
            {classes.map((c) => <option key={c} value={c}>Grade {c.replace("-", " · Section ")} ({cands.rows.filter((x) => x.cls === c).length} Students)</option>)}
          </Select>
          <Select aria-label="Subject paper" value={paper?.id ?? ""} onChange={(e) => setPaperId(e.target.value)}>
            {classPapers.length === 0 && <option value="">No papers for this grade in this cycle</option>}
            {classPapers.map((p) => <option key={p.id} value={p.id}>{p.subject}{p.code ? ` (${p.code})` : ""} · Theory {p.theory} / {p.internalType} {p.internal}</option>)}
          </Select>
        </div>
        <DataTable rows={roster} columns={markCols} pageSize={6} selectable={!sheet} selected={sel} onSelectedChange={setSel}
          searchText={(c) => `${c.name} ${c.roll} ${c.grn}`}
          toolbarActions={sheet ? undefined : <Button size="sm" variant="outline" onClick={verifySelected} disabled={!sel.length}><ShieldCheck size={14} />Verify selected ({sel.length})</Button>}
          empty={<EmptyState title="No candidates" hint="No roster found for this class." />} />
        {sheet && sheetClosed && <p className="px-5 pb-3 text-xs font-medium text-on-surface-variant"><Lock size={12} className="mr-1 inline" />{sheetLockedMessage(sheet.status)}</p>}
        {!sheet && isMarkLocked && <p className="px-5 pb-3 text-xs font-medium text-on-surface-variant"><Lock size={12} className="mr-1 inline" />Marks entry is locked for this paper. Reopen it to edit marks.</p>}
        {errCount > 0 && <p className="px-5 pb-3 text-xs font-medium text-error">● {errCount} mark entr{errCount > 1 ? "ies require" : "y requires"} correction</p>}
      </Card>

      {cur && !embedded && <div className="mt-6"><Button variant="outline" onClick={() => setShowSummary(!showSummary)}>{showSummary ? "Hide overall results" : "Show overall results"}</Button></div>}
      {cur && showSummary && <ExamSummary cycle={cur} papers={papers.rows.filter((p) => p.cycleId === curId)} candidates={cands.rows} marks={marks.rows} />}

      <Card className="mt-6 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-info-container text-secondary"><ClipboardCheck size={18} /></span>
            <div>
              <div className="flex items-center gap-2 font-semibold">Grade {cls} {paper?.subject ?? ""} Marks Entry
                {sheet ? <Badge tone={sheetTone(sheet.status)}>{sheetStatusLabel[sheet.status]}</Badge> : isPublished ? <Badge tone="success">Published to parents</Badge> : errCount ? <Badge tone="danger">Needs correction</Badge> : roster.length && enteredCount === roster.length ? <Badge tone="success">Ready for Final Sign-off</Badge> : <Badge tone="warning">In progress</Badge>}
              </div>
              {sheet
                ? <p className="mt-1 text-on-surface-variant">Sheet: {sheetStatusLabel[sheet.status]} · owner {sheet.ownerName || "Unassigned"}{sheet.version > 1 ? ` · version ${sheet.version}` : ""}{sheet.status === "Returned" && sheet.returnNote ? ` · note: ${sheet.returnNote}` : ""}</p>
                : <p className="mt-1 text-on-surface-variant">Review completed marks before publishing results to parents.</p>}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadTab}><Download size={16} />Download Tabulation (.csv)</Button>
            {sheet ? <SheetActions sheet={sheet} size="md" /> : <>
              <Button variant="outline" onClick={() => toggleLock()} disabled={!paper || busy}>{isMarkLocked ? <LockOpen size={16} /> : <Lock size={16} />}{isMarkLocked ? "Reopen Marks Entry" : "Lock Marks Entry"}</Button>
              <Button onClick={publish} disabled={!paper || isPublished || busy}><Send size={16} />{isPublished ? "Published" : "Publish Subject Results"}</Button>
            </>}
          </div>
        </div>
      </Card>
      <Modal open={reopening} onClose={() => setReopening(false)} title="Reopen marks entry" subtitle="Administrator authorization and a reason are required. Subject results will be withdrawn until they are published again."
        footer={<><Button variant="ghost" onClick={() => setReopening(false)}>Cancel</Button><Button disabled={busy || reopenReason.trim().length < 5} onClick={() => toggleLock(reopenReason)}>Reopen marks entry</Button></>}><Field label="Reason" required><Textarea value={reopenReason} maxLength={2000} onChange={(e) => setReopenReason(e.target.value)} /></Field></Modal>
    </>
  );
}
