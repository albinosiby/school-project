"use client";
import { useMemo, useState } from "react";
import { ClipboardList, Download, FileText, History, Mail, Package, Plus, Search, ShieldCheck, Clock } from "lucide-react";
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Modal, SearchBox, Select, Switch, Tabs, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { CommHeader } from "./CommHeader";
import { downloadCsv } from "./csv";
import { generate, type Params, type Stf, type Stu, type Table } from "./reportData";
import type { Exported, LogRec, Notice, Report, Schedule } from "./types";

const CATS = ["CBSE Statutory", "Academics & Exams", "Fees & Accounts", "Operations & Fleet"];
const PRESETS = [
  { id: "rep_01", name: "CBSE OASIS Sync", sub: "XML API Payload" }, { id: "rep_08", name: "U-DISE+ Return", sub: "Ministry Form 2026" },
  { id: "rep_12", name: "RTE 25% Seat Audit", sub: "District Edu Office" }, { id: "rep_07", name: "DigiLocker Batch", sub: "Cert ZIP Package" },
];

// Real generation time from the doc's updatedAt stamp (the stored `ago` text never changes).
const exportedAt = (e: Exported) => {
  const at = (e as { updatedAt?: string }).updatedAt;
  return at && !isNaN(+new Date(at)) ? new Date(at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : e.ago;
};

export function ReportsView({ runId }: { runId?: string }) {
  const toast = useToast();
  const reports = useCollection<Report>("com_reports").rows;
  const students = useCollection<Stu>("students").rows;
  const staff = useCollection<Stf>("staff").rows;
  const notices = useCollection<Notice>("com_notices").rows;
  const schedules = useCollection<Schedule>("com_schedules");
  const exports = useCollection<Exported & { reportId?: string }>("com_exports");
  const reportsCol = useCollection<Report>("com_reports");
  const fail = () => toast("Could not save — check your connection", "error");
  const log = useCollection<LogRec>("com_log");

  const [q, setQ] = useState(""); const [fmt, setFmt] = useState("all"); const [cat, setCat] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [running, setRunning] = useState<Report | null>(null);
  const [addSched, setAddSched] = useState(false);
  const [prevRun, setPrevRun] = useState<string | null>(null);
  if (runId && reports.length && prevRun !== runId) { setPrevRun(runId); setRunning(reports.find((r) => r.id === runId) ?? null); }

  const ctx = { students, staff, notices };
  const list = reports.filter((r) => (cat === "all" || r.category === cat) && (fmt === "all" || r.formats.includes(fmt))
    && (!q || `${r.title} ${r.category} ${r.tag} ${r.desc}`.toLowerCase().includes(q.toLowerCase())));
  const empty: Params = { grade: "", section: "", from: "", to: "" };

  function download(r: Report, p: Params = empty) {
    const t = generate(r, ctx, p);
    downloadCsv(`${r.title.replace(/[^a-z0-9]+/gi, "_").slice(0, 50)}`, t.columns, t.rows);
    toast(r.format === "csv" ? "CSV downloaded" : `Downloaded as CSV (.${r.format} export is simulated)`);
  }
  const toggleSel = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div>
      <CommHeader active="reports" />
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <SearchBox value={q} onChange={setQ} placeholder={`Search ${reports.length} templates by statutory code, department, keyword...`} className="min-w-64 flex-1" />
              <div className="flex items-center gap-2"><span className="t-label-caps !text-[11px] text-on-surface-variant">Format:</span>
                <Tabs value={fmt} onChange={setFmt} items={[{ id: "all", label: "All" }, { id: "xlsx", label: "XLSX" }, { id: "pdf", label: "PDF" }, { id: "csv", label: "CSV" }]} /></div>
            </div>
            <Tabs value={cat} onChange={setCat} items={[{ id: "all", label: "All", count: reports.length }, ...CATS.map((c) => ({ id: c, label: c.replace(" Statutory", " Statutory"), count: reports.filter((r) => r.category === c).length }))]} />
          </Card>
          {!reportsCol.ready && <Card><p className="p-8 text-center text-on-surface-variant">Loading reports…</p></Card>}
          {reportsCol.ready && list.length === 0 && <Card><EmptyState title="No reports match" hint="Clear the search or format filter." /></Card>}
          {list.map((r) => (
            <Card key={r.id} className={cn("p-5", sel.includes(r.id) && "border-secondary")}>
              <div className="flex items-start gap-4">
                <button aria-label={sel.includes(r.id) ? "Deselect report" : "Select report"} aria-pressed={sel.includes(r.id)} onClick={() => toggleSel(r.id)}
                  className={cn("grid size-10 shrink-0 cursor-pointer place-items-center rounded-lg", sel.includes(r.id) ? "bg-secondary text-on-secondary" : "bg-info-container text-secondary")}><FileText size={18} /></button>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h3 className="t-headline-md !text-[17px] max-w-md">{r.title}</h3>
                    <div className="flex gap-2">
                      <Button size="sm" variant={r.id === "rep_01" ? "primary" : "outline"} onClick={() => download(r)}><Download size={14} />Download .{r.format}</Button>
                      <Button size="sm" variant="outline" onClick={() => setRunning(r)}>Run Now</Button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2"><span className="rounded bg-surface-container px-2 py-1 text-xs font-semibold">{r.category}</span>
                    <span className={cn("rounded px-2 py-1 text-xs font-semibold", r.tag.startsWith("Mandatory") || r.tag.includes("DLT") || r.tag.includes("CBSE") ? "bg-info-container text-secondary" : "bg-surface-container text-on-surface-variant")}>{r.tag}</span></div>
                  <p className="mt-3 max-w-xl text-on-surface-variant">{r.desc}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-outline-variant/40 pt-3 text-xs text-on-surface-variant">
                    <span className="flex items-center gap-1.5 font-medium"><History size={13} />Last Generated: {r.lastGenerated}</span><span>•</span><span>{r.meta}</span><span>•</span><span>Formats: {r.formats.map((f) => `.${f}`).join(", ")}</span>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Clock size={16} className="text-secondary" />Automated Schedules</span>} actions={<Badge tone="success">{schedules.rows.filter((s) => s.active).length} Active</Badge>} />
            <div className="space-y-2 p-5 pt-2">
              {schedules.rows.map((s) => (
                <div key={s.id} className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold">{s.title}</span>
                    <Switch label={`Toggle ${s.title}`} checked={s.active} onChange={(v) => schedules.update(s.id, { active: v }).then(() => toast(v ? "Schedule enabled" : "Schedule paused")).catch(fail)} /></div>
                  <p className="mt-1 text-xs text-on-surface-variant">To: {s.to}</p><p className="mt-1 text-xs text-outline">{s.when}</p>
                </div>))}
              <button onClick={() => setAddSched(true)} className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-outline-variant py-2 text-sm font-semibold text-secondary hover:bg-info-container/40"><Plus size={14} />Add Automated Schedule</button>
            </div>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Package size={16} className="text-secondary" />Recent Export Queue</span>} actions={<span className="text-xs text-on-surface-variant">{exports.rows.length} files</span>} />
            <div className="space-y-2 p-5 pt-2">
              {exports.ready && exports.rows.length === 0 && <p className="text-sm text-on-surface-variant">No exports yet. Run a report to add it here.</p>}
              {exports.rows.map((e) => { const src = reports.find((r) => r.id === e.reportId); return (
                <div key={e.id} className="flex items-center gap-3 rounded-lg border border-outline-variant/60 p-3">
                  <span className="grid size-8 place-items-center rounded bg-surface-container text-on-surface-variant"><ClipboardList size={14} /></span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{e.code} · {e.title}</div><div className="text-xs text-success">Ready · {e.size} .{e.format} · {exportedAt(e)}</div></div>
                  <button aria-label={`Download ${e.code}`} disabled={!src} title={src ? undefined : "Source report no longer exists"} className="cursor-pointer rounded p-1.5 text-secondary hover:bg-info-container disabled:cursor-not-allowed disabled:opacity-40" onClick={() => src && download(src)}><Download size={14} /></button>
                </div>); })}
            </div>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><ShieldCheck size={16} className="text-secondary" />Statutory Presets</span>} actions={<Badge tone="info">CBSE / State</Badge>} />
            <div className="p-5 pt-2"><p className="mb-3 text-on-surface-variant">Quick 1-click generators mapped with authentic school identifiers and checksums. Click to add to a batch.</p>
              <div className="grid grid-cols-2 gap-2">{PRESETS.map((p) => (
                <button key={p.id} aria-pressed={sel.includes(p.id)} onClick={() => toggleSel(p.id)}
                  className={cn("cursor-pointer rounded-lg border p-3 text-left", sel.includes(p.id) ? "border-secondary bg-info-container" : "border-outline-variant hover:bg-surface-container-low")}>
                  <div className="text-sm font-semibold">{p.name}</div><div className="t-caption text-outline">{p.sub}</div></button>))}</div></div>
          </Card>
        </div>
      </div>

      {sel.length > 0 && (
        <div role="toolbar" aria-label="Batch actions" className="fixed bottom-5 left-1/2 z-40 flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 shadow-pop">
          <span className="text-sm font-semibold">{sel.length} Reports Selected for Batch Generation</span><Badge tone="info">Ready</Badge>
          <Button size="sm" onClick={() => { sel.forEach((id, i) => { const r = reports.find((x) => x.id === id); if (r) setTimeout(() => download(r), i * 300); }); }}><Download size={14} />Download Combined ({sel.length} Files)</Button>
          <Button size="sm" variant="outline" onClick={() => log.create({ action: `Emailed ${sel.length} reports to Trust Audit Desk`, audience: "Trust Audit Desk", channels: ["Email"], recipients: 1, at: new Date().toISOString() }).then(() => toast("Reports emailed to Trust Audit Desk (simulated)")).catch(fail)}><Mail size={14} />Email to Trust Audit Desk</Button>
          <button aria-label="Clear selection" onClick={() => setSel([])} className="cursor-pointer text-outline hover:text-on-surface">✕</button>
        </div>
      )}

      {running && <RunModal r={running} ctx={ctx} onClose={() => setRunning(null)} onDone={async (t, p) => { try {
        const code = `#REP-${9843 + exports.rows.length}`;
        await exports.create({ code, title: running.title.slice(0, 28), size: `${Math.max(1, Math.round(t.rows.length * 0.2))} KB`, format: running.format, ago: "just now", reportId: running.id } as never);
        await reportsCol.update(running.id, { lastGenerated: "Today, " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }) + " IST", meta: `${t.rows.length} Records${p.grade ? ` · Grade ${p.grade}` : ""}` });
        toast(`Report generated with ${t.rows.length} records`);
      } catch { toast("Report previewed, but saving it to the export queue failed", "error"); } }} onDownload={(p) => download(running, p)} />}
      {addSched && <SchedModal onClose={() => setAddSched(false)} onSave={async (s) => { try { await schedules.create({ ...s, active: true }); toast("Schedule added"); setAddSched(false); } catch { fail(); } }} />}
    </div>
  );
}

function RunModal({ r, ctx, onClose, onDone, onDownload }: { r: Report; ctx: Parameters<typeof generate>[1]; onClose: () => void; onDone: (t: Table, p: Params) => Promise<void>; onDownload: (p: Params) => void }) {
  const [p, setP] = useState<Params>({ grade: "", section: "", from: "", to: "" });
  const [t, setT] = useState<Table | null>(null);
  const grades = useMemo(() => [...new Set(ctx.students.map((s) => s.grade))].sort((a, b) => +a - +b), [ctx.students]);
  const set = (k: keyof Params, v: string) => { setP((x) => ({ ...x, [k]: v })); setT(null); };
  const badRange = !!p.from && !!p.to && p.from > p.to;
  return (
    <Modal open onClose={onClose} title={r.title} subtitle="Set parameters, generate a preview, then download" width="max-w-4xl"
      footer={<><Button variant="ghost" onClick={onClose}>Close</Button><Button variant="outline" disabled={!t} onClick={() => onDownload(p)}><Download size={14} />Download CSV</Button>
        <Button disabled={badRange} onClick={() => { const tb = generate(r, ctx, p); setT(tb); void onDone(tb, p); }}>Generate Report</Button></>}>
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Grade"><Select value={p.grade} onChange={(e) => set("grade", e.target.value)}><option value="">All grades</option>{grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section"><Select value={p.section} onChange={(e) => set("section", e.target.value)}><option value="">All</option>{["A", "B", "C"].map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="From"><Input type="date" value={p.from} onChange={(e) => set("from", e.target.value)} /></Field>
        <Field label="To" error={badRange ? "Must be on or after From" : undefined}><Input type="date" value={p.to} onChange={(e) => set("to", e.target.value)} /></Field>
      </div>
      <div className="mt-5">
        {!t ? <p className="rounded-lg border border-dashed border-outline-variant p-8 text-center text-on-surface-variant"><Search className="mx-auto mb-2" size={20} />Choose parameters and press Generate Report to preview.</p> : (
          <div><p className="mb-2 text-sm font-semibold">{t.rows.length} records · showing first {Math.min(10, t.rows.length)}</p>
            <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left text-sm">
              <thead><tr className="bg-surface-container-low">{t.columns.map((c) => <th key={c} className="t-label-caps whitespace-nowrap px-3 py-2 !text-[11px] text-on-surface-variant">{c}</th>)}</tr></thead>
              <tbody>{t.rows.slice(0, 10).map((row, i) => <tr key={i} className="border-t border-outline-variant/40">{row.map((c, j) => <td key={j} className="whitespace-nowrap px-3 py-2">{c}</td>)}</tr>)}</tbody></table>
              {t.rows.length === 0 && <EmptyState title="No records for these parameters" />}</div></div>)}
      </div>
    </Modal>
  );
}

function SchedModal({ onClose, onSave }: { onClose: () => void; onSave: (s: Omit<Schedule, "id" | "active">) => Promise<void> }) {
  const [title, setTitle] = useState(""); const [to, setTo] = useState(""); const [when, setWhen] = useState("Every Monday · 08:00 IST");
  const [err, setErr] = useState("");
  return (
    <Modal open onClose={onClose} title="Add Automated Schedule" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button>
      <Button onClick={() => { if (!title.trim() || !to.trim()) return setErr("Name and recipients are required"); onSave({ title: title.trim(), to: to.trim(), when }); }}>Add Schedule</Button></>}>
      <div className="space-y-4"><Field label="Report name" required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Recipients" required error={err}><Input value={to} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Frequency"><Select value={when} onChange={(e) => setWhen(e.target.value)}>{["09:15 IST Daily · Email", "Every Monday · 08:00 IST", "1st of Month · 00:00 IST"].map((w) => <option key={w}>{w}</option>)}</Select></Field></div>
    </Modal>
  );
}

