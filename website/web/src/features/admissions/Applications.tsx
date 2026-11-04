"use client";
import { useMemo, useState } from "react";
import { Download, MessageSquare, ShieldCheck, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, Field, Modal, ProgressBar, Select, Stat, Textarea, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inrFull } from "@/lib/format";
import { docsComplete, downloadCsv, pct, statusTone, useAdm } from "./lib";
import { MANUAL_STATUSES, OFFERABLE, stageMoveError } from "./logic";
import { APP_STATUS_LABEL, DOC_LABEL, GRADES, PANEL_LABEL, TAG_LABEL, gradeLabel, type AppStatus, type Application, type DocKey } from "./types";
import { useEnquirySlide } from "./AdmissionsShell";

const ORDER: AppStatus[] = ["submitted", "docs_pending", "verified", "test_scheduled", "tested", "shortlisted", "offered", "enrolled"];

function academic(a: Application): { t: string; tone: "success" | "brand" | "warning" | "neutral" | "info" | "danger" } {
  if (a.status === "tested" || a.status === "shortlisted") return { t: a.writtenScore != null ? `Written Test: ${a.writtenScore}/100` : APP_STATUS_LABEL[a.status], tone: "info" };
  return { t: APP_STATUS_LABEL[a.status], tone: statusTone(a.status) };
}

export function Applications() {
  const { apps, slots, config, ready, generateOffer, logMessage, setDoc } = useAdm();
  const open = useEnquirySlide();
  const toast = useToast();
  const [tab, setTab] = useState<"all" | "paid" | "docs" | "verified">("all");
  const [status, setStatus] = useState("");
  const [cohort, setCohort] = useState("");
  const [sort, setSort] = useState("newest");
  const [sel, setSel] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const r = apps.rows, paid = r.filter((a) => a.feePaid).length, ver = r.filter(docsComplete).length;
    return { total: r.length, paid, fees: paid * (config?.appFee ?? 2500), verRate: pct(ver, r.length), ver,
      tests: r.filter((a) => a.testSlotId).length, short: r.filter((a) => ["shortlisted", "offered", "enrolled"].includes(a.status)).length,
      docsPending: r.filter((a) => !docsComplete(a)).length };
  }, [apps.rows, config]);

  const rows = useMemo(() => {
    let r = apps.rows.filter((a) =>
      (tab === "all" || (tab === "paid" ? a.feePaid : tab === "docs" ? !docsComplete(a) : docsComplete(a))) &&
      (!cohort || a.grade === cohort) && (!status || a.status === status));
    r = [...r].sort((a, b) => sort === "newest" ? b.submittedAt.localeCompare(a.submittedAt) || b.ref.localeCompare(a.ref) : sort === "oldest" ? a.submittedAt.localeCompare(b.submittedAt) || a.ref.localeCompare(b.ref) : sort === "score" ? (b.writtenScore ?? -1) - (a.writtenScore ?? -1) : a.name.localeCompare(b.name));
    return r;
  }, [apps.rows, tab, cohort, status, sort]);

  const docHealth = (k: DocKey) => { const rel = apps.rows.filter((a) => a.docs[k] !== "na"); const ok = rel.filter((a) => a.docs[k] === "verified").length; return { ok, n: rel.length, p: Math.round(pct(ok, rel.length)) }; };
  const nextSlot = slots.rows.filter((x) => x.status === "scheduled" && x.type === "test").sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextCand = nextSlot ? apps.rows.filter((a) => a.testSlotId === nextSlot.id) : [];

  const selected = apps.rows.filter((a) => sel.includes(a.id));
  const bulkApprove = async () => {
    try {
      await Promise.all(selected.map((a) => { const docs = Object.fromEntries(Object.entries(a.docs).map(([k, v]) => [k, v === "na" ? "na" : "verified"])) as Application["docs"];
        return apps.update(a.id, { docs, status: ["submitted", "docs_pending"].includes(a.status) ? "verified" : a.status }); }));
      toast(`Documents approved for ${selected.length} applications`); setSel([]);
    } catch { toast("Some updates failed — check the list and retry", "error"); }
  };
  const bulkRemind = async () => {
    try {
      await Promise.all(selected.map((a) => logMessage("WhatsApp reminder", a.phone, `Reminder to ${a.guardian}: pending items for ${a.ref} (${a.name}).`)));
      toast(`WhatsApp reminders queued for ${selected.length} guardians (simulated)`); setSel([]);
    } catch { toast("Could not queue reminders", "error"); }
  };
  const exportRows = (list: Application[], name: string) => downloadCsv(name, [["App ID", "Student", "Guardian", "Phone", "Grade", "Fee paid", "Fee mode", "Docs complete", "Status", "Score", "Submitted"],
    ...list.map((a) => [a.ref, a.name, a.guardian, a.phone, gradeLabel(a.grade), a.feePaid ? "Yes" : "No", a.feeMode, docsComplete(a) ? "Yes" : "No", APP_STATUS_LABEL[a.status], a.writtenScore ?? "", a.submittedAt])]);

  const cols: Column<Application>[] = [
    { key: "ref", header: "App ID", sortValue: (a) => a.ref, render: (a) => <span className="font-semibold">{a.ref}</span> },
    { key: "name", header: "Student & Guardian Name", sortValue: (a) => a.name, render: (a) => (
      <div className="flex items-center gap-3"><Avatar name={a.name} size={34} /><div><div className="font-semibold">{a.name}</div><div className="text-xs text-on-surface-variant">{a.guardian} • {a.phone}</div></div></div>) },
    { key: "grade", header: "Target Cohort", sortValue: (a) => GRADES.findIndex((g) => g.id === a.grade), render: (a) => <Badge>{gradeLabel(a.grade)}</Badge> },
    { key: "fee", header: "Fee Status", render: (a) => a.feePaid ? <Badge tone="success">{inrFull(config?.appFee ?? 2500)} ({a.feeMode || "UPI"})</Badge> : <Badge tone="warning">Unpaid</Badge> },
    { key: "docs", header: "Doc Checklist", render: (a) => { const v = Object.values(a.docs).filter((s) => s !== "na"); const ok = v.filter((s) => s === "verified").length; return <span className={cn("inline-flex items-center gap-1.5 text-sm", ok === v.length ? "text-on-surface" : "text-warning")}><span className={cn("size-2 rounded-full", ok === v.length ? "bg-success" : "bg-warning")} />{ok}/{v.length} {ok === v.length ? "Verified" : "Docs Pending"}</span>; } },
    { key: "status", header: "Academic Status", sortValue: (a) => ORDER.indexOf(a.status), render: (a) => { const s = academic(a); return <Badge tone={s.tone}>{s.t}</Badge>; } },
  ];

  const detail = detailId ? apps.rows.find((a) => a.id === detailId) ?? null : null;
  const tabs: [typeof tab, string, number][] = [["all", "All", stats.total], ["paid", "Fee Paid", stats.paid], ["docs", "Documents Pending", stats.docsPending], ["verified", "Verified", stats.ver]];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" className="flex gap-1">
          {tabs.map(([id, l, n]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("cursor-pointer rounded px-3 py-2 text-sm font-medium", tab === id ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container")}>
              {l} <span className={cn("ml-1 rounded-full px-1.5 text-xs", tab === id ? "bg-white/20" : "bg-surface-container")}>{n}</span></button>))}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-48"><option value="">Status: All stages</option>{Object.entries(APP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
          <Select aria-label="Cohort" value={cohort} onChange={(e) => setCohort(e.target.value)} className="w-48"><option value="">Cohort: All Grades</option>{GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="w-52"><option value="newest">Sort: Submission (Newest)</option><option value="oldest">Sort: Submission (Oldest)</option><option value="score">Sort: Written score</option><option value="name">Sort: Name</option></Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="TOTAL APPLICATIONS" value={stats.total} />
        <Stat label="APP FEE COLLECTED" value={inrFull(stats.fees)} />
        <Stat label="VERIFICATION RATE" value={`${stats.verRate}%`} sub={`${stats.ver} verified`} subTone="success" />
        <Stat label="ENTRANCE TEST" value={stats.tests} sub="assigned" subTone="info" />
        <Stat label="SHORTLISTED (INTERVIEW)" value={stats.short} sub="candidates" subTone="brand" />
      </div>

      <Card>
        <CardHeader title="Registered Candidates Roster" subtitle={`${rows.length} of ${apps.rows.length} applications match`}
          actions={<><Button variant="outline" size="sm" onClick={() => { exportRows(rows, "applications.csv"); toast("Applications exported"); }}><Download size={14} />Export</Button><Button size="sm" onClick={open}>Log New Enquiry</Button></>} />
        {!ready ? <p className="p-5 text-on-surface-variant">Loading…</p> :
          <DataTable rows={rows} columns={cols} pageSize={10} selectable selected={sel} onSelectedChange={setSel} onRowClick={(a) => setDetailId(a.id)}
            searchText={(a) => `${a.ref} ${a.name} ${a.guardian} ${a.phone}`} />}
      </Card>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader title="Document Verification Health" actions={<span className="text-sm text-on-surface-variant">{apps.rows.length} Files Scanned</span>} />
          <div className="grid gap-4 p-5 pt-2 sm:grid-cols-2">
            {(Object.keys(DOC_LABEL) as DocKey[]).map((k) => { const h = docHealth(k); return (
              <div key={k} className="rounded-lg bg-surface-container-low p-4"><div className="flex justify-between font-semibold"><span>{DOC_LABEL[k]}</span><span className="text-success">{h.p}%</span></div>
                <ProgressBar className="my-2" value={h.p} tone={h.p >= 95 ? "success" : h.p >= 85 ? "brand" : "warning"} /><p className="text-xs text-on-surface-variant">{h.ok} of {h.n} approved</p></div>); })}
          </div>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={nextSlot ? `Entrance Test ${nextSlot.batch.replace("BATCH ", "Batch ")}` : "Entrance Test"} actions={nextSlot && <Badge tone="success">Ready</Badge>} />
          <div className="space-y-3 p-5 pt-2">
            {nextSlot ? (<>
              <div className="rounded-lg bg-surface-container-low p-4"><div className="flex items-start justify-between"><div><div className="font-semibold">{nextSlot.venue}</div><div className="text-xs text-on-surface-variant">{fmtDate(nextSlot.date)} • {nextSlot.time} IST</div></div><div className="text-right"><div className="text-2xl font-semibold">{nextCand.length}</div><div className="t-caption text-on-surface-variant">ROSTERED</div></div></div></div>
              <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-3 text-sm"><span><b>Chief Invigilator:</b> {nextSlot.invigilator}</span><Badge tone="success">Verified</Badge></div>
              <Button variant="outline" className="w-full" onClick={() => { downloadCsv("hall-tickets.csv", [["Hall Ticket", "App ID", "Candidate", "Grade", "Venue", "Date", "Time"], ...nextCand.map((a, i) => [`HT-${String(i + 1).padStart(3, "0")}`, a.ref, a.name, gradeLabel(a.grade), nextSlot.venue, nextSlot.date, nextSlot.time])]); toast("Hall tickets downloaded"); }}><Download size={14} />Download Hall Tickets (.csv)</Button>
            </>) : <p className="text-on-surface-variant">No scheduled entrance test. Create one under Tests &amp; Interviews.</p>}
          </div>
        </Card>
      </div>

      {sel.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-6 left-1/2 z-40 flex w-max max-w-[92vw] -translate-x-1/2 flex-wrap items-center gap-3 rounded-xl bg-inverse-surface px-4 py-3 text-inverse-on-surface shadow-pop">
          <div className="pr-2 text-sm"><b>{sel.length} applications selected</b><div className="text-xs opacity-70">Batch actions applied across current session</div></div>
          <Button variant="outline" size="sm" onClick={bulkApprove}><ShieldCheck size={14} />Bulk Approve Docs</Button>
          <Button size="sm" onClick={bulkRemind} className="!bg-success"><MessageSquare size={14} />WhatsApp Reminders</Button>
          <Button variant="outline" size="sm" onClick={() => { exportRows(selected, "selected-applications.csv"); toast("Selection exported"); }}><Download size={14} />Export Selected</Button>
          <button aria-label="Clear selection" onClick={() => setSel([])} className="cursor-pointer rounded p-1 hover:bg-white/10"><X size={16} /></button>
        </div>
      )}

      <Modal open={!!detail} onClose={() => setDetailId(null)} width="max-w-2xl" title={detail ? `${detail.name} · ${detail.ref}` : ""} subtitle={detail ? `${gradeLabel(detail.grade)} • submitted ${fmtDate(detail.submittedAt)}` : undefined}>
        {detail && <Detail a={detail} onGenerate={async () => { try { const o = await generateOffer(detail); toast(`Offer ${o.ref} generated`); setDetailId(null); } catch (e) { toast((e as Error).message, "error"); } }} setDoc={setDoc} />}
      </Modal>
    </div>
  );
}

function Detail({ a, onGenerate, setDoc }: { a: Application; onGenerate: () => void; setDoc: (a: Application, k: DocKey, s: Application["docs"][DocKey]) => Promise<void> }) {
  const { apps, enq, config } = useAdm();
  const toast = useToast();
  const [note, setNote] = useState<string | null>(null);
  const idx = ORDER.indexOf(a.status);
  const fail = () => toast("Could not save — check your connection", "error");
  const move = (s: AppStatus) => {
    const why = stageMoveError(a, s);
    if (why) return toast(why, "error");
    return apps.update(a.id, { status: s }).then(() => toast(`Moved to ${APP_STATUS_LABEL[s]}`)).catch(fail);
  };
  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-xs" aria-label="Status pipeline">
        {ORDER.map((s, i) => <li key={s} className={cn("rounded-full px-2.5 py-1", i < idx ? "bg-success-container text-success" : i === idx ? "bg-secondary text-on-secondary" : "bg-surface-container text-on-surface-variant")}>{APP_STATUS_LABEL[s]}</li>)}
        {idx < 0 && <li className="rounded-full bg-error-container px-2.5 py-1 text-on-error-container">{APP_STATUS_LABEL[a.status]}</li>}
      </ol>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {([["Guardian", a.guardian], ["Mobile", a.phone], ["Email", a.email], ["Priority tag", TAG_LABEL[a.tag]], ["Written score", a.writtenScore != null ? `${a.writtenScore}/100` : "—"], ["Panel", a.panelStatus ? PANEL_LABEL[a.panelStatus] : "—"]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-on-surface-variant">{k}</dt><dd className="font-medium">{v}</dd></div>)}
      </dl>
      <div>
        <h4 className="t-label-caps mb-2">Document checklist</h4>
        <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
          {(Object.keys(DOC_LABEL) as DocKey[]).map((k) => (
            <li key={k} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-sm">{DOC_LABEL[k]}</span>
              {a.docs[k] === "na" ? <Badge>Not required</Badge> : (
                <Select aria-label={DOC_LABEL[k]} value={a.docs[k]} onChange={(e) => setDoc(a, k, e.target.value as never).then(() => toast("Document updated")).catch(fail)} className="!h-8 w-36 text-xs"><option value="pending">Pending</option><option value="verified">Verified</option><option value="rejected">Rejected</option></Select>)}
            </li>))}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Move stage">
          <Select value={MANUAL_STATUSES.includes(a.status) ? a.status : ""} disabled={["offered", "enrolled", "withdrawn", "lapsed"].includes(a.status)} onChange={(e) => move(e.target.value as AppStatus)}>
            {!MANUAL_STATUSES.includes(a.status) && <option value="">{APP_STATUS_LABEL[a.status]} (managed in Offers)</option>}
            {MANUAL_STATUSES.map((s) => <option key={s} value={s}>{APP_STATUS_LABEL[s]}</option>)}</Select>
        </Field>
        <Field label="Application fee"><Button variant={a.feePaid ? "outline" : "primary"} className="w-full" disabled={a.feePaid} onClick={() => apps.update(a.id, { feePaid: true, feeMode: "UPI" }).then(() => toast("Fee marked as paid")).catch(fail)}>{a.feePaid ? `Paid via ${a.feeMode || "UPI"}` : `Mark ${inrFull(config?.appFee ?? 2500)} paid`}</Button></Field>
      </div>
      <Field label="Internal notes"><Textarea value={note ?? a.notes} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== null && note !== a.notes && apps.update(a.id, { notes: note }).then(() => toast("Note saved")).catch(fail)} /></Field>
      <div className="flex justify-end gap-2">
        {a.enquiryId && <span className="mr-auto self-center text-xs text-on-surface-variant">Linked enquiry: {enq.rows.find((e) => e.id === a.enquiryId)?.ref ?? "—"}</span>}
        {OFFERABLE.includes(a.status) && <Button onClick={onGenerate}>Generate offer</Button>}
      </div>
    </div>
  );
}
