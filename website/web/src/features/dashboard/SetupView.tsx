"use client";
import { useState } from "react";
import { AlarmClock, CalendarDays, Check, CheckCircle2, Eye, Filter, Gauge, Lock, RefreshCw, Rocket, ScanFace, ShieldCheck, Undo2, UsersRound } from "lucide-react";
import Link from "next/link";
import { Avatar, Badge, Button, Card, Checkbox, EmptyState, Modal, ProgressBar, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { DashHeader, useSetupProgress } from "./DashHeader";
import { useDashPrefs } from "./DashboardView";
import { errMsg, fmtDay, parse, type Notif, type SetupExc, type Staff, nowLocal, TODAY } from "./data";
import { dataExceptions, EXC_KIND_LABEL, isIngestionPhase, type DataException } from "./logic";

type Me = { id: string; name: string; title: string };
type Stu = { id: string; name: string; grn?: string; grade: string; section: string; classId?: string; status: string; phone?: string; guardian?: string };
type Exc = SetupExc | DataException;
const isDerived = (e: Exc): e is DataException => "derived" in e && e.derived === true;
type Sec = { id: string; grade: string; sections: string[]; cap: number };
type Term = { id: string; name: string; start: string; end: string };
const TEACHING = /PGT|TGT|PRT|HOD|teacher/i;

export function SetupView() {
  const { steps, done, total, pct } = useSetupProgress();
  const { rows: steps0, update: updStep } = useCollection<{ id: string; done: boolean; doneAt: string }>("setup_steps");
  // setup_exceptions only holds demo / imported rows (nothing in the live system writes it): the real checks are derived
  // from the student roster and clear themselves once the record is fixed
  const { rows: legacyExcs, update: updExc } = useCollection<SetupExc>("setup_exceptions");
  const { prefs, save: savePref } = useDashPrefs();
  const { rows: me } = useCollection<Me>("me");
  const { create: notify } = useCollection<Notif>("notifications");
  const { rows: students } = useCollection<Stu>("students");
  const { rows: staff } = useCollection<Staff>("staff");
  const { rows: secs } = useCollection<Sec>("set_sections");
  const { rows: terms } = useCollection<Term>("set_terms");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  /** runs a write, toasts success or the Firestore error */
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try { await fn(); toast(ok); } catch (e) { toast(errMsg(e), "error"); } finally { setBusy(false); }
  };
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [graph, setGraph] = useState(false);
  const [snap, setSnap] = useState(false);
  const [sign, setSign] = useState(false);
  void steps0;

  const excs: Exc[] = [...dataExceptions(students), ...legacyExcs];
  const current = steps.find((s) => !s.done);
  const unresolved = excs.filter((e) => !e.resolved);
  const resolvedN = excs.length - unresolved.length;
  const active = students.filter((s) => s.status === "Active");
  const seatsTotal = secs.reduce((a, x) => a + (Number(x.cap) || 0), 0);
  // next term start from Settings > Academic Year (set_terms)
  const sortedTerms = [...terms].filter((t) => t.start).sort((a, b) => a.start.localeCompare(b.start));
  const nextTerm = sortedTerms.find((t) => t.start >= TODAY);
  const daysToTerm = nextTerm ? Math.round((parse(nextTerm.start).getTime() - parse(TODAY).getTime()) / 864e5) : null;
  // per-section roster vs the configured seats per section
  const perSec = new Map<string, number>();
  secs.forEach((x) => x.sections?.forEach((code) => perSec.set(code, x.sections.length ? Math.round(x.cap / x.sections.length) : 0)));
  const roster = new Map<string, number>();
  active.forEach((s) => { const k = `${s.grade}-${s.section}`; roster.set(k, (roster.get(k) ?? 0) + 1); });
  const maxRoster = Math.max(0, ...roster.values());
  const over = [...roster.entries()].filter(([k, n]) => n > (perSec.get(k) ?? 40));
  const teachers = staff.filter((s) => s.status !== "Left" && TEACHING.test(s.role ?? "")).length;
  const ptr = teachers ? active.length / teachers : null;
  const withPhone = active.filter((s) => (s.phone ?? "").replace(/\D/g, "").length >= 10).length;
  const checks: [string, string, string, string, boolean][] = [
    ["Pupil-Teacher Ratio", "UDISE+ norm ≤ 30 : 1", ptr === null ? "—" : `${Math.round(ptr)} : 1`, `${active.length} students · ${teachers} teachers`, ptr !== null && ptr <= 30],
    ["Section Capacity", "RTE: ≤ 40 per section", over.length ? `${over.length} over cap` : "Within cap", `${roster.size} sections with students`, over.length === 0],
    ["Guardian Contacts", "Valid 10-digit phone", `${active.length ? Math.round((withPhone / active.length) * 100) : 0}%`, `${withPhone} of ${active.length} students`, active.length > 0 && withPhone === active.length],
    ["Ingestion Exceptions", "Flagged discrepancies", `${unresolved.length} open`, `${resolvedN} resolved`, unresolved.length === 0],
  ];
  const allPass = checks.every((c) => c[4]);
  const FILTERS = [
    { id: "all", label: `All Exceptions (${unresolved.length})` },
    ...[...new Set(unresolved.map((e) => e.kind))].map((k) => ({ id: k, label: `${EXC_KIND_LABEL[k] ?? k} (${unresolved.filter((e) => e.kind === k).length})` })),
  ];
  const view = unresolved.filter((e) => filter === "all" || e.kind === filter);
  const pages = Math.max(1, Math.ceil(view.length / 6));
  const cur = Math.min(page, pages);
  const rows = view.slice((cur - 1) * 6, cur * 6);
  const velocity = total ? Math.round(((done + (current ? resolvedN / Math.max(1, excs.length) : 0)) / total) * 100) : 0;

  const complete = (id: string, no: number) => {
    const step = steps.find((s) => s.id === id);
    // only the data ingestion phase (07) is gated by the flagged records
    if (step && isIngestionPhase(step) && unresolved.length) { toast(`Resolve all ${unresolved.length} flagged exceptions before completing this phase`, "error"); return; }
    return run(async () => {
      await updStep(id, { done: true, doneAt: TODAY });
      await notify({ category: "statutory", title: "Setup Wizard", body: `Phase ${String(no).padStart(2, "0")} completed — setup is now ${Math.round(((done + 1) / total) * 100)}% done`, createdAt: nowLocal(), read: false, href: "/setup" } as never);
    }, `Phase ${no} marked complete`);
  };
  const resolve = (e: SetupExc) => run(() => updExc(e.id, { resolved: true }), `${e.name}: ${(e.status ?? "exception").toLowerCase()} resolved`);
  /** only stored rows can be marked resolved; derived ones are fixed in the student record */
  const selStored = sel.filter((id) => legacyExcs.some((x) => x.id === id && !x.resolved));
  const batchResolve = (ids: string[]) => run(async () => { await Promise.all(ids.map((id) => updExc(id, { resolved: true }))); setSel([]); }, `${ids.length} exception${ids.length > 1 ? "s" : ""} resolved`);

  const stat = (label: string, value: React.ReactNode, sub: React.ReactNode, icon: React.ReactNode) => (
    <Card className="flex items-start justify-between p-5"><div><p className="t-label-caps !text-[11px] text-on-surface-variant">{label}</p><p className="mt-2 flex items-baseline gap-2 text-3xl font-bold">{value}{sub}</p></div>
      <span className="grid size-11 place-items-center rounded-lg bg-info-container text-secondary">{icon}</span></Card>);

  return (
    <>
      <DashHeader active="setup" />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stat("Pipeline velocity", `${velocity}%`, null, <Gauge size={20} />)}
        {stat("Active students", active.length.toLocaleString("en-IN"), seatsTotal ? <span className="text-base font-normal text-outline">/ {seatsTotal.toLocaleString("en-IN")} seats</span> : null, <UsersRound size={20} />)}
        <Card className="flex items-start justify-between p-5"><div><p className="t-label-caps !text-[11px] text-on-surface-variant">Next term starts in</p><p className={cn("mt-2 flex items-baseline gap-2 text-3xl font-bold", daysToTerm !== null && daysToTerm <= 14 ? "text-error" : "text-on-surface")}>{daysToTerm ?? "—"}<span className="text-base font-normal text-on-surface-variant">{daysToTerm === null ? "No upcoming term" : daysToTerm === 1 ? "Day" : "Days"}</span></p></div>
          <span className="grid size-11 place-items-center rounded-lg bg-error-container text-error"><AlarmClock size={20} /></span></Card>
        {stat(nextTerm ? `${nextTerm.name} start` : "Target term-start", <span className="text-2xl">{nextTerm ? fmtDay(nextTerm.start) : "—"}</span>, null, <CalendarDays size={20} />)}
      </div>

      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><div className="flex flex-wrap items-center gap-3"><h2 className="t-headline-md !text-[18px]">Academic Roll-Forward Pipeline</h2><Badge tone="brand" className="font-semibold tracking-wide">STAGE {current?.no ?? total} OF {total} {current ? "RUNNING" : "COMPLETE"}</Badge></div>
            <p className="mt-1 text-on-surface-variant">Sequential prerequisite steps validated by Academic Board, CBSE Compliance, and Registrar.</p></div>
          <div className="flex gap-2">
            {prefs?.bannerDismissed && <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => savePref({ bannerDismissed: false }), "Setup banner restored on the dashboard")}>Show on dashboard</Button>}
            <Button variant="outline" size="sm" onClick={() => setGraph(true)}><Eye size={14} />View Dependency Graph</Button></div>
        </div>
        <ProgressBar value={pct} className="mt-4" />
        <p className="mt-1 text-xs text-outline">{done} of {total} phases complete · {pct}%</p>
        {steps.length === 0 && <p className="mt-4 rounded-lg bg-surface-container-low p-3 text-sm text-outline">No setup phases configured for this school.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((s) => { const isCur = s.id === current?.id; const locked = !s.done && !isCur; return (
            <div key={s.id} className={cn("relative rounded-lg border p-4", isCur ? "border-2 border-secondary bg-info-container/30" : "border-outline-variant/60", locked && "bg-surface-container-low text-outline")}>
              {isCur && <span className="absolute -top-2 right-3 rounded bg-secondary px-2 text-[10px] font-bold text-on-secondary">CURRENT</span>}
              <div className="flex items-center justify-between text-[11px] font-bold tracking-wide">PHASE {String(s.no).padStart(2, "0")}
                {s.done ? <CheckCircle2 size={16} className="text-success" /> : locked ? <Lock size={14} /> : <RefreshCw size={14} className="text-secondary" />}</div>
              <h3 className={cn("mt-1 font-semibold", locked ? "text-outline" : "text-on-surface")}>{s.title}</h3>
              <p className="mt-1 min-h-10 text-xs text-on-surface-variant">{s.desc}</p>
              <div className="mt-3 flex items-center justify-between border-t border-outline-variant/50 pt-3">
                {s.done ? <Badge tone="success">COMPLETED</Badge> : isCur ? <Badge className="!bg-secondary !text-on-secondary">● IN PROGRESS</Badge> : <Badge>LOCKED</Badge>}
                {s.done ? <button disabled={busy} className="flex cursor-pointer items-center gap-1 text-xs text-outline hover:text-error disabled:opacity-50" onClick={() => run(() => updStep(s.id, { done: false, doneAt: "" }), `Phase ${s.no} reopened`)}><Undo2 size={12} />Reopen</button>
                  : isCur ? <Button size="sm" disabled={busy} onClick={() => complete(s.id, s.no)}>Mark complete</Button> : null}
              </div>
            </div>); })}
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-3 p-5 pb-3">
              <div><div className="flex flex-wrap items-center gap-3"><h2 className="t-headline-md !text-[18px]">Stage 7: Ingestion Flagged Discrepancies</h2>
                <Badge tone={unresolved.length ? "warning" : "success"}>{unresolved.length} Unresolved Exception{unresolved.length === 1 ? "" : "s"}</Badge></div>
                <p className="mt-1 text-on-surface-variant">Records quarantined from AY 2025–26 promotion batch awaiting administrative remediation.</p></div>
              <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => { setFilter("all"); setPage(1); toast("Filters reset"); }}><Filter size={14} />Filters</Button>
                <Button size="sm" className="!bg-success" disabled={!unresolved.length || busy} onClick={() => { const n = sel.length || unresolved.length;
                  return run(() => notify({ category: "ops", title: "Parent notice", body: `Data-correction request sent to ${n} guardian${n > 1 ? "s" : ""} (simulated)`, createdAt: nowLocal(), read: false } as never), `Notified ${n} guardian${n > 1 ? "s" : ""} (simulated)`); }}>Batch Notify Parents</Button></div>
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-outline-variant/60 bg-surface-container-low px-5 py-3">
              <span className="mr-1 text-[11px] font-bold tracking-wide text-on-surface-variant">FILTER VIEW:</span>
              {FILTERS.map((f) => <button key={f.id} onClick={() => { setFilter(f.id); setPage(1); setSel([]); }} aria-pressed={filter === f.id}
                className={cn("cursor-pointer rounded-full border px-3 py-1 text-xs font-medium", filter === f.id ? "border-secondary bg-secondary text-on-secondary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant")}>{f.label}</button>)}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-left">
                <thead><tr className="border-b border-outline-variant/60 bg-surface-container-low">
                  <th className="w-10 py-2.5 pl-5"><Checkbox aria-label="Select all" checked={rows.some((r) => !isDerived(r)) && rows.filter((r) => !isDerived(r)).every((r) => sel.includes(r.id))} onChange={(e) => setSel(e.target.checked ? rows.filter((r) => !isDerived(r)).map((r) => r.id) : [])} /></th>
                  {["Student Name & Guardian", "Grade / Sec", "GRN No.", "DigiLocker Status", "Flagged Discrepancy", "Quick Action"].map((h) => <th key={h} className="px-3 py-2.5 t-label-caps !text-[11px] text-on-surface-variant">{h}</th>)}</tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-b border-outline-variant/40">
                      <td className="py-3 pl-5">{!isDerived(e) && <Checkbox aria-label={`Select ${e.name}`} checked={sel.includes(e.id)} onChange={(ev) => setSel(ev.target.checked ? [...sel, e.id] : sel.filter((x) => x !== e.id))} />}</td>
                      <td className="px-3 py-3"><div className="flex items-center gap-2"><Avatar name={e.name} size={32} /><div><p className="font-semibold">{e.name}</p><p className="text-xs text-outline">(G: {e.guardian})</p></div></div></td>
                      <td className="px-3 py-3 font-semibold">{e.grade}</td><td className="px-3 py-3 font-mono text-xs text-on-surface-variant">{e.grn}</td>
                      <td className="px-3 py-3"><Badge tone={e.tone}>● {e.status}</Badge></td>
                      <td className="max-w-[240px] px-3 py-3 text-xs text-on-surface-variant">{e.issue}</td>
                      <td className="px-3 py-3">{isDerived(e) ? <Link href={e.href}><Button size="sm" variant="outline">{e.action}</Button></Link>
                        : <Button size="sm" variant="outline" disabled={busy} onClick={() => resolve(e)}>{e.action || "Resolve"}</Button>}</td>
                    </tr>))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="grid place-items-center gap-1 px-6 py-10 text-center"><ScanFace className="text-success" /><span className="font-semibold">{unresolved.length ? "No exceptions in this view" : "All exceptions resolved"}</span><span className="text-on-surface-variant">{unresolved.length ? "Try another filter." : "You can now complete Phase 07."}</span></p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-on-surface-variant">
              <span>Showing {view.length ? (cur - 1) * 6 + 1 : 0}–{Math.min(view.length, cur * 6)} of {view.length} discrepancies</span>
              <div className="flex items-center gap-2">
                {selStored.length > 0 && <Button size="sm" disabled={busy} onClick={() => batchResolve(selStored)}>Resolve {selStored.length} selected</Button>}
                <Button size="sm" variant="outline" disabled={cur <= 1} onClick={() => setPage(cur - 1)}>Prev</Button><span className="text-sm">Page {cur} of {pages}</span>
                <Button size="sm" variant="outline" disabled={cur >= pages} onClick={() => setPage(cur + 1)}>Next</Button></div>
            </div>
          </Card>
          <Card className="flex flex-wrap items-center gap-4 p-5">
            <span className={cn("grid size-11 place-items-center rounded-lg", over.length ? "bg-warning-container text-warning" : "bg-success-container text-success")}><CheckCircle2 /></span>
            <div className="min-w-0 flex-1"><h3 className="font-semibold">{!roster.size ? "No class rosters yet" : over.length ? `${over.length} section${over.length > 1 ? "s" : ""} over capacity` : "Class Roster Capacity Integrity Passed"}</h3>
              <p className="text-on-surface-variant">{!roster.size ? "Import students to check section sizes against the configured seats." : over.length ? `Over cap: ${over.slice(0, 5).map(([k, n]) => `${k} (${n})`).join(", ")}${over.length > 5 ? "…" : ""}` : `${roster.size} sections with students, max ${maxRoster} students per section (within configured seats).`}</p></div>
            <Link href="/classes"><Button variant="outline">Inspect Roster Map</Button></Link>
          </Card>
        </div>
        <div className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center gap-2"><ShieldCheck size={18} className="text-secondary" /><h2 className="font-semibold">Statutory Compliance</h2><Badge tone={allPass ? "success" : "warning"}>{allPass ? "ALL PASS" : `${checks.filter((c) => !c[4]).length} TO REVIEW`}</Badge></div>
            <dl className="mt-4 space-y-4">
              {checks.map(([a, b, c, d, ok]) => (
                <div key={a} className="flex justify-between gap-2"><div><dt className="font-semibold">{a}</dt><dd className="text-xs text-outline">{b}</dd></div><div className="text-right"><dd className={cn("font-semibold", ok ? "text-success" : "text-warning")}>{c}</dd><dd className="text-xs text-outline">{d}</dd></div></div>))}
            </dl>
          </Card>
          <Card className="p-5">
            <h2 className="font-semibold">Rollover Authorization</h2>
            <div className="mt-3 flex items-center gap-3 rounded-lg bg-surface-container-low p-3"><Avatar name={me[0]?.name ?? "—"} size={44} /><div><p className="font-semibold">{me[0]?.name ?? "—"}</p><p className="text-xs text-on-surface-variant">{me[0]?.title || "Head of Institution"}</p><p className="text-xs text-outline">DSC token signing is simulated</p></div></div>
            <dl className="mt-3 space-y-1 rounded-lg bg-surface-container-low p-3 text-xs">{[["Student records:", active.length.toLocaleString("en-IN")], ["Sections:", secs.reduce((a, x) => a + (x.sections?.length ?? 0), 0).toLocaleString("en-IN")]].map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-outline">{k}</dt><dd className="font-mono font-semibold">{v}</dd></div>)}</dl>
            <Button className="mt-4 w-full" size="lg" disabled={!!current} onClick={() => setSign(true)}>Sign Session Rollover Authorization</Button>
            {current && <p className="mt-2 text-xs text-outline">Unlocks once all {total} phases are complete.</p>}
          </Card>
        </div>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-4 p-5">
        <span className="grid size-11 place-items-center rounded-lg bg-info-container text-secondary"><RefreshCw /></span>
        <div className="min-w-0 flex-1"><h3 className="font-semibold">Snapshots & Validation</h3><p className="text-on-surface-variant">Re-run validation any time; it re-checks the flagged exceptions without changing live records.</p></div>
        <Button variant="outline" onClick={() => setSnap(true)}>Browse Snapshots</Button>
        <Button onClick={() => toast(unresolved.length ? `Validation finished: ${unresolved.length} exception${unresolved.length > 1 ? "s" : ""} still open` : "Validation passed with zero errors", unresolved.length ? "error" : "success")}>Run Validation</Button>
      </Card>

      <Modal open={graph} onClose={() => setGraph(false)} title="Dependency graph" subtitle="Each phase unlocks the next" width="max-w-2xl">
        <ol className="space-y-2">{steps.map((s) => <li key={s.id} className="flex items-center gap-3 rounded border border-outline-variant/60 p-2.5"><span className={cn("grid size-6 place-items-center rounded-full text-xs font-bold", s.done ? "bg-success text-on-secondary" : "bg-surface-container")}>{s.done ? <Check size={12} /> : s.no}</span><span className="font-medium">{s.title}</span><span className="ml-auto text-xs text-outline">{s.no > 1 ? `needs Phase ${String(s.no - 1).padStart(2, "0")}` : "root"}</span></li>)}</ol>
      </Modal>
      <Modal open={snap} onClose={() => setSnap(false)} title="Snapshots" subtitle="Backups of live records" footer={<Button onClick={() => setSnap(false)}>Close</Button>}>
        <EmptyState title="No snapshots yet" hint="Automated backups and restore are not enabled for this school yet." />
      </Modal>
      <Modal open={sign} onClose={() => setSign(false)} title="Sign rollover authorization" subtitle="Applies your DSC token to the AY 2026–27 roll-forward" footer={<><Button variant="outline" onClick={() => setSign(false)}>Cancel</Button><Button onClick={() => { setSign(false); toast("Rollover authorization signed (simulated)"); }}><Rocket size={14} />Sign now</Button></>}>
        <p className="text-on-surface-variant">You are authorizing roll-forward of {active.length.toLocaleString("en-IN")} student records across {secs.reduce((a, x) => a + (x.sections?.length ?? 0), 0)} sections. Signing is simulated — no records are changed.</p>
      </Modal>
    </>
  );
}
