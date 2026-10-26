"use client";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardCheck, Download, FileSpreadsheet, FileUp, Lock, LockOpen, Pencil, Plus, Send, ShieldCheck } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, PageHeader, Select, Stat, Tabs, useToast, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { downloadCsv, parseCsv } from "@/features/fees/csv";
import { ExamDuties } from "./ExamDuties";
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
    case "invalid": return <Badge tone="danger"><AlertTriangle size={12} />Error: out of range</Badge>;
    default: return <Badge tone="neutral">Pending</Badge>;
  }
};

function MarkInput({ value, max, disabled, onCommit, label }: { value: number | null; max: number; disabled?: boolean; onCommit: (v: number | null) => void; label: string }) {
  const [v, setV] = useState<string | null>(null);
  const shown = v ?? (value === null ? "" : String(value));
  const bad = value !== null && (value > max || value < 0);
  return (
    <div className="flex items-center gap-2">
      <input aria-label={label} inputMode="numeric" disabled={disabled} value={shown} placeholder="--"
        onChange={(e) => setV(e.target.value.replace(/[^0-9]/g, ""))}
        onBlur={() => { if (v !== null) { onCommit(v === "" ? null : Number(v)); setV(null); } }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={`h-9 w-16 rounded border px-2 text-center font-mono text-sm focus:outline-2 focus:outline-secondary/30 ${bad ? "border-error bg-error-container/40 text-error" : "border-outline-variant bg-surface-container-lowest"} disabled:bg-surface-container`} />
      <span className={`font-mono text-xs ${bad ? "text-error" : "text-outline"}`}>/ {max}</span>
    </div>
  );
}

export function ExamsPage() {
  const toast = useToast();
  const router = useRouter();
  const cycles = useCollection<Cycle>("exm_cycles");
  const papers = useCollection<Paper>("exm_papers");
  const cands = useCollection<Candidate>("exm_candidates");
  const marks = useCollection<Mark>("exm_marks");

  const [cycleId, setCycleId] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [clsPick, setCls] = useState("8-A");
  const [paperId, setPaperId] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const active = cycles.rows.find((c) => c.status === "Live") ?? cycles.rows[0];
  const curId = cycleId || active?.id || "";
  const cur = cycles.rows.find((c) => c.id === curId);

  const activePapers = papers.rows.filter((p) => p.cycleId === active?.id);
  const done = activePapers.filter((p) => p.status === "Completed").length;
  const entered = activePapers.filter((p) => p.marksEntered).length;
  const activeMarks = marks.rows.filter((m) => activePapers.some((p) => p.id === m.paperId));
  const evs = activeMarks.map((m) => { const p = papers.rows.find((x) => x.id === m.paperId)!; return evaluate(m, p.theory, p.internal); }).filter((e) => e.pct !== null);
  const avg = evs.length ? evs.reduce((a, e) => a + e.pct!, 0) / evs.length : 0;
  const passRate = evs.length ? (evs.filter((e) => e.pct! >= 33).length / evs.length) * 100 : 0;

  const cyclePapers = papers.rows.filter((p) => p.cycleId === curId && (gradeFilter === "all" || p.grade === gradeFilter))
    .sort((a, b) => +a.grade - +b.grade || (a.date ?? "").localeCompare(b.date ?? ""));
  const gradesInCycle = [...new Set(papers.rows.filter((p) => p.cycleId === curId).map((p) => p.grade))].sort((a, b) => +a - +b);

  const scheduleCols: Column<Paper>[] = [
    { key: "subject", header: "Grade / Subject", sortValue: (p) => p.grade + p.subject, render: (p) => <span className="flex items-center gap-2 font-semibold"><span className="size-2 rounded-full bg-secondary" />Grade {p.grade} · {p.subject}</span> },
    { key: "code", header: "Exam code", render: (p) => <span className="font-mono text-on-surface-variant">{p.code}</span> },
    { key: "date", header: "Date & time", sortValue: (p) => p.date, render: (p) => <span className="whitespace-nowrap">{when(p)}</span> },
    { key: "marks", header: "Marks breakup", render: (p) => <span className="whitespace-nowrap rounded border border-outline-variant/60 bg-surface-container-low px-2 py-1 font-mono text-xs">{p.theory} Theory / {p.internal} {p.internalType}</span> },
    { key: "venue", header: "Venue / hall", render: (p) => p.venue },
    { key: "inv", header: "Evaluator / chief", render: (p) => p.invigilator },
    { key: "status", header: "Status", render: (p) => <Badge tone={p.status === "Completed" ? "success" : "info"}>{p.status}</Badge> },
  ];

  // ---------- marks entry ----------
  const classes = [...new Set(cands.rows.map((c) => c.cls))].sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  // fall back to a class that has candidates (the default "8-A" may not exist in this school)
  const cls = classes.includes(clsPick) ? clsPick : classes[0] ?? clsPick;
  const grade = cls.split("-")[0];
  const classPapers = papers.rows.filter((p) => p.cycleId === curId && p.grade === grade);
  const paper = classPapers.find((p) => p.id === paperId) ?? classPapers[0];
  const roster = cands.rows.filter((c) => c.cls === cls);
  const markOf = (cid: string) => marks.rows.find((m) => m.paperId === paper?.id && m.candId === cid);
  const [sel, setSel] = useState<string[]>([]);

  /** writes one candidate's marks; returns false (and toasts unless quiet) on failure */
  const save = async (c: Candidate, patch: Partial<Mark>, quiet = false) => {
    if (!paper) return false;
    const ex = markOf(c.id);
    try {
      if (ex) await marks.update(ex.id, patch);
      else await marks.create({ id: `${paper.id}__${c.id}`, paperId: paper.id, candId: c.id, theory: null, internal: null, medical: false, verified: false, ...patch });
      if (pubOf(paper).includes(cls)) await papers.update(paper.id, { published: pubOf(paper).filter((x) => x !== cls) });
      return true;
    } catch { if (!quiet) toast("Could not save marks", "error"); return false; }
  };
  const evOf = (c: Candidate) => evaluate(markOf(c.id), paper?.theory ?? 80, paper?.internal ?? 20);
  const enteredCount = roster.filter((c) => markOf(c.id)?.theory != null).length;
  const errCount = roster.filter((c) => evOf(c).state === "invalid").length;
  const isPublished = pubOf(paper).includes(cls);
  const maxTotal = (paper?.theory ?? 80) + (paper?.internal ?? 20);

  type Row = Candidate;
  const markCols: Column<Row>[] = [
    { key: "name", header: "Candidate & roll no", sortValue: (c) => c.roll, render: (c) => (
      <div><div className="font-semibold">{c.name}</div><div className="text-xs text-outline">{c.roll} · GRN {c.grn}</div></div>) },
    { key: "theory", header: `Theory (max ${paper?.theory ?? 80})`, render: (c) => <MarkInput label={`Theory marks for ${c.name}`} value={markOf(c.id)?.theory ?? null} max={paper?.theory ?? 80} disabled={!paper} onCommit={(v) => save(c, { theory: v })} /> },
    { key: "internal", header: `Internal (max ${paper?.internal ?? 20})`, render: (c) => <MarkInput label={`Internal marks for ${c.name}`} value={markOf(c.id)?.internal ?? null} max={paper?.internal ?? 20} disabled={!paper} onCommit={(v) => save(c, { internal: v })} /> },
    { key: "total", header: "Total & %", render: (c) => { const e = evOf(c); return e.state === "invalid" ? <span className="font-semibold text-error">{e.total}/{maxTotal} <span className="font-normal">(Invalid)</span></span> : e.total === null ? <span className="text-outline">-- / {maxTotal} (Pending)</span> : <span><b>{e.total}/{maxTotal}</b> <span className="text-outline">({e.pct!.toFixed(1)}%)</span></span>; } },
    { key: "grade", header: "CBSE grade", render: (c) => { const e = evOf(c); return <Badge tone={e.state === "invalid" ? "danger" : e.grade === "--" ? "neutral" : "brand"} className="font-mono">{e.grade}</Badge>; } },
    { key: "status", header: "Validation status", render: (c) => (
      <div className="flex items-center gap-2">{stateBadge(evOf(c))}
        {evOf(c).state === "pending" || evOf(c).state === "medical" ? (
          <button type="button" className="cursor-pointer text-xs text-secondary hover:underline" onClick={(e) => { e.stopPropagation(); save(c, { medical: !markOf(c.id)?.medical }); }}>{markOf(c.id)?.medical ? "Clear flag" : "Flag medical"}</button>) : null}
      </div>) },
  ];

  const verifySelected = async () => {
    const targets = roster.filter((c) => sel.includes(c.id) && ["passed", "failed"].includes(evOf(c).state));
    if (!targets.length) return toast("Select valid, entered rows to verify", "error");
    const ok = (await Promise.all(targets.map((c) => save(c, { verified: true }, true)))).filter(Boolean).length;
    setSel([]);
    if (ok < targets.length) toast(`Verified ${ok} of ${targets.length}; ${targets.length - ok} could not be saved`, "error");
    else toast(`${ok} mark entr${ok > 1 ? "ies" : "y"} verified`);
  };
  // closing the marks window stops teachers editing this paper (the teacher app shows it as submitted) and notifies them
  const toggleLock = async () => {
    if (!paper) return;
    try {
      await papers.update(paper.id, { locked: !paper.locked });
      toast(paper.locked ? `Marks entry reopened for ${paper.subject}` : `Marks entry locked for ${paper.subject}; teachers notified`);
    } catch { toast("Could not update the marks window", "error"); }
  };
  const publish = async () => {
    if (!paper) return;
    if (!roster.length) return toast("No candidates in this class", "error");
    if (errCount) return toast(`Resolve ${errCount} invalid mark entr${errCount > 1 ? "ies" : "y"} first`, "error");
    const pending = roster.filter((c) => !["verified", "passed", "failed", "medical"].includes(evOf(c).state)).length;
    if (pending) return toast(`${pending} candidates still have no marks`, "error");
    const res = await Promise.all(roster.filter((c) => ["passed", "failed"].includes(evOf(c).state)).map((c) => save(c, { verified: true }, true)));
    if (res.includes(false)) return toast(`${res.filter((x) => !x).length} entries could not be verified; nothing was published`, "error");
    try {
      await papers.update(paper.id, { published: [...pubOf(paper).filter((x) => x !== cls), cls], marksEntered: true, status: "Completed" });
      toast(`Report cards published for Grade ${cls} · ${paper.subject}`);
    } catch { toast("Could not publish the results", "error"); }
  };

  const exportSheet = () => {
    if (!activeMarks.length) return toast("No marks entered for the active cycle yet", "error");
    const rows: (string | number)[][] = [["Cycle", "Grade", "Subject", "Class", "Roll", "Candidate", "Theory", "Internal", "Total", "Percent", "Grade", "Status"]];
    for (const m of activeMarks) {
      const p = papers.rows.find((x) => x.id === m.paperId)!; const c = cands.rows.find((x) => x.id === m.candId); if (!c) continue;
      const e = evaluate(m, p.theory, p.internal);
      rows.push([active?.title ?? "", p.grade, p.subject, c.cls, c.roll, c.name, m.theory ?? "", m.internal ?? "", e.total ?? "", e.pct?.toFixed(1) ?? "", e.grade, e.state]);
    }
    downloadCsv("master-sheet.csv", rows); toast("Master sheet exported");
  };
  const importMarks = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ""; // so picking the same file again fires onChange
    if (!file) return;
    if (!paper) return toast("Pick a class with a subject paper first", "error");
    // a cell is blank (no mark) or a whole number; anything else skips the row instead of storing NaN
    const num = (v?: string) => (v == null || v.trim() === "" ? null : /^\d+$/.test(v.trim()) ? Number(v) : NaN);
    let rows: string[][];
    try { rows = parseCsv(await file.text()).filter((r) => r[0] && /^#?\w/.test(r[0]) && r[0].toLowerCase() !== "roll"); } catch { return toast("Could not read the file", "error"); }
    let n = 0, bad = 0, failed = 0;
    for (const r of rows) {
      const c = roster.find((x) => x.roll.toLowerCase() === (r[0].startsWith("#") ? r[0] : `#${r[0]}`).toLowerCase());
      if (!c) continue;
      const theory = num(r[1]), internal = num(r[2]);
      if (Number.isNaN(theory) || Number.isNaN(internal)) { bad++; continue; }
      if (await save(c, { theory, internal }, true)) n++; else failed++;
    }
    const skipped = [bad && `${bad} with non-numeric marks`, failed && `${failed} not saved`].filter(Boolean).join(", ");
    if (n) toast(`Imported marks for ${n} candidate${n > 1 ? "s" : ""}${skipped ? ` (${skipped})` : ""}`, skipped ? "error" : "success");
    else toast(skipped ? `Nothing imported: ${skipped}` : "No matching roll numbers found (expected: roll,theory,internal)", "error");
  };
  const downloadTab = () => {
    if (!roster.length) return toast("No candidates in this class", "error");
    downloadCsv(`tabulation-${cls}-${paper?.code ?? ""}.csv`, [["Roll", "Candidate", "Theory", "Internal", "Total", "%", "Grade"], ...roster.map((c) => { const m = markOf(c.id); const e = evOf(c); return [c.roll, c.name, m?.theory ?? "", m?.internal ?? "", e.total ?? "", e.pct?.toFixed(1) ?? "", e.grade]; })]);
  };

  const stats = useMemo(() => ({ pct: activePapers.length ? (entered / activePapers.length) * 100 : 0 }), [activePapers.length, entered]);

  return (
    <>
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
        <Stat label="COHORT HEALTH" value={<>{avg.toFixed(1)} <span className="text-sm font-normal text-on-surface-variant">/ 100 Class Avg</span></>} sub={`${passRate.toFixed(1)}% Pass`} subTone="success" />
      </div>

      <Card className="mt-6">
        <CardHeader title="EXAMINATION CYCLES & SCHEDULE OVERVIEW" subtitle="Real-time timetable execution status, paper duration & invigilator allocations" />
        <div className="flex flex-wrap items-center gap-3 px-5 pb-3">
            <Tabs items={cycles.rows.map((c) => ({ id: c.id, label: c.short }))} value={curId} onChange={(v) => { setCycleId(v); setGradeFilter("all"); setPaperId(""); }} />
            <Select aria-label="Filter grade" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="!w-40">
              <option value="all">All Grades</option>{gradesInCycle.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </Select>
            {cur && <Button variant="outline" size="sm" onClick={() => router.push(`/exams/${cur.id}/edit`)}><Pencil size={14} />Edit cycle</Button>}
        </div>
        <DataTable rows={cyclePapers} columns={scheduleCols} pageSize={6}
          empty={cycles.ready && !cycles.rows.length ? <EmptyState title="No exam cycles yet" hint="Create an exam cycle to schedule papers." action={<Button size="sm" onClick={() => router.push("/exams/new")}>Create exam cycle</Button>} />
            : <EmptyState title="No papers scheduled" hint="Edit this cycle to add subject paper slots." action={cur && <Button size="sm" onClick={() => router.push(`/exams/${cur.id}/edit`)}>Add paper slots</Button>} />} />
      </Card>

      <ExamDuties cycles={cycles.rows} papers={papers.rows} defaultCycleId={curId} />

      <Card className="mt-6">
        <CardHeader title="SUBJECT MARKS TABULATION & RESULTS VERIFICATION" subtitle="Enter component marks, validate CBSE bounds, and verify student grade profiles"
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
        <DataTable rows={roster} columns={markCols} pageSize={6} selectable selected={sel} onSelectedChange={setSel}
          searchText={(c) => `${c.name} ${c.roll} ${c.grn}`}
          toolbar={<Button size="sm" variant="outline" onClick={verifySelected} disabled={!sel.length}><ShieldCheck size={14} />Verify selected ({sel.length})</Button>}
          empty={<EmptyState title="No candidates" hint="No roster found for this class." />} />
        {errCount > 0 && <p className="px-5 pb-3 text-xs font-medium text-error">● {errCount} mark entr{errCount > 1 ? "ies require" : "y requires"} correction</p>}
      </Card>

      <Card className="mt-6 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-lg bg-info-container text-secondary"><ClipboardCheck size={18} /></span>
            <div>
              <div className="flex items-center gap-2 font-semibold">Grade {cls} {paper?.subject ?? ""} Marks Entry
                {isPublished ? <Badge tone="success">Published to parents</Badge> : errCount ? <Badge tone="danger">Needs correction</Badge> : roster.length && enteredCount === roster.length ? <Badge tone="success">Ready for Final Sign-off</Badge> : <Badge tone="warning">In progress</Badge>}
              </div>
              <p className="mt-1 text-on-surface-variant">Resolving mark flags enables instantaneous DigiLocker and Parent App report access.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={downloadTab}><Download size={16} />Download Tabulation (.csv)</Button>
            <Button variant="outline" onClick={toggleLock} disabled={!paper}>{paper?.locked ? <LockOpen size={16} /> : <Lock size={16} />}{paper?.locked ? "Reopen Marks Entry" : "Lock Marks Entry"}</Button>
            <Button onClick={publish} disabled={!paper || isPublished}><Send size={16} />{isPublished ? "Published" : "Save & Publish Report Cards"}</Button>
          </div>
        </div>
      </Card>
    </>
  );
}
