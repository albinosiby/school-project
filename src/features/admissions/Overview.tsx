"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, CalendarClock, MessageSquare, Phone, UserPlus } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, Input, Modal, ProgressBar, SearchBox, Select, Stat, Textarea, useToast, Avatar } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inrFull } from "@/lib/format";
import { addDays, downloadCsv, pct, useToday, useAdm } from "./lib";
import { useCollection } from "@/lib/useCollection";
import { type FormDoc, type Enquiry, type EnqStage, GROUPS, SOURCES, STAFF, gradeLabel } from "./types";
import { useEnquirySlide } from "./AdmissionsShell";

const COLS: { id: string; label: string; stages: EnqStage[]; dot: string }[] = [
  { id: "new", label: "New", stages: ["new"], dot: "bg-secondary" },
  { id: "contacted", label: "Contacted", stages: ["contacted"], dot: "bg-info-container border border-secondary" },
  { id: "campus", label: "Campus Visit", stages: ["campus"], dot: "bg-success" },
  { id: "app_issued", label: "Application Issued", stages: ["app_issued"], dot: "bg-secondary-container" },
  { id: "offered", label: "Offered / Accepted", stages: ["offered", "enrolled"], dot: "bg-success" },
  { id: "lost", label: "Lost / Closed", stages: ["lost"], dot: "bg-outline" },
];
const MOVABLE: { v: EnqStage; l: string }[] = [{ v: "new", l: "New" }, { v: "contacted", l: "Contacted" }, { v: "campus", l: "Campus Visit" }, { v: "app_issued", l: "Application Issued" }, { v: "lost", l: "Lost / Closed" }];

export function Overview() {
  const { enq, apps, offers, slots, seatRows, config, ready, moveEnquiry, logMessage } = useAdm();
  const open = useEnquirySlide();
  const form = useCollection<FormDoc>("adm_form").rows[0];
  const toast = useToast();
  const [q, setQ] = useState("");
  const [src, setSrc] = useState("");
  const [who, setWho] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [detail, setDetail] = useState<string | null>(null);
  const today = useToday();

  const s = useMemo(() => {
    const d30 = addDays(today, -30), d60 = addDays(today, -60);
    const recent = enq.rows.filter((e) => e.createdAt >= d30).length, prev = enq.rows.filter((e) => e.createdAt >= d60 && e.createdAt < d30).length;
    const unassigned = enq.rows.filter((e) => !e.assignee && ["new", "contacted", "campus"].includes(e.stage)).length;
    const paid = apps.rows.filter((a) => a.feePaid).length;
    const tested = apps.rows.filter((a) => a.testSlotId);
    const scores = apps.rows.filter((a) => a.writtenScore != null);
    const accepted = offers.rows.filter((o) => o.status === "accepted" || o.status === "enrolled").length;
    const enrolled = apps.rows.filter((a) => a.status === "enrolled").length;
    const cap = seatRows.reduce((x, r) => x + r.capacity, 0);
    return {
      total: enq.rows.length, growth: prev ? Math.round(((recent - prev) / prev) * 100) : recent ? 100 : 0, unassigned,
      apps: apps.rows.length, conv: pct(apps.rows.length, enq.rows.length), fees: paid * (config?.appFee ?? 2500),
      tested: tested.length, avgScore: scores.length ? Math.round((scores.reduce((x, a) => x + (a.writtenScore ?? 0), 0) / scores.length) * 10) / 10 : 0,
      offers: offers.rows.length, accept: pct(accepted, offers.rows.length), waitlist: apps.rows.filter((a) => a.status === "waitlisted").length,
      enrolled, cap, token: offers.rows.reduce((x, o) => x + o.tokenPaid, 0),
    };
  }, [enq.rows, apps.rows, offers.rows, seatRows, config, today]);

  const filtered = useMemo(() => enq.rows.filter((e) => {
    if (src && e.source !== src) return false;
    if (who && (who === "__none" ? e.assignee : e.assignee !== who)) return false;
    if (q) { const t = q.toLowerCase(); return [e.name, e.ref, e.phone, e.guardian].some((x) => x.toLowerCase().includes(t)); }
    return true;
  }), [enq.rows, q, src, who]);

  const nextTest = slots.rows.filter((x) => x.status === "scheduled" && x.type === "test").sort((a, b) => a.date.localeCompare(b.date))[0];
  const nextTestCount = nextTest ? apps.rows.filter((a) => a.testSlotId === nextTest.id).length : 0;
  const lastWeb = enq.rows.filter((e) => e.source === "Website Form").sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  const hallTickets = () => {
    if (!nextTest) return;
    const cand = apps.rows.filter((a) => a.testSlotId === nextTest.id);
    downloadCsv(`hall-tickets-${nextTest.batch.replace(/\W+/g, "")}.csv`, [["Hall Ticket", "App ID", "Candidate", "Grade", "Venue", "Date", "Time"],
      ...cand.map((a, i) => [`HT-${nextTest.batch.slice(-2)}-${String(i + 1).padStart(3, "0")}`, a.ref, a.name, gradeLabel(a.grade), nextTest.venue, nextTest.date, nextTest.time])]);
    toast(`Hall tickets exported for ${cand.length} candidates`);
  };

  const sel = detail ? enq.rows.find((e) => e.id === detail) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label="TOTAL INQUIRIES" value={s.total} sub={`${s.growth >= 0 ? "+" : ""}${s.growth}%`} subTone={s.growth >= 0 ? "success" : "danger"} />
        <Stat label="APPLICATIONS FILED" value={s.apps} sub={`${s.conv}% conv.`} subTone="brand" />
        <Stat label="INTERVIEWS & TESTS" value={s.tested} sub="Assigned" subTone="info" />
        <Stat label="OFFERS ROLLED OUT" value={s.offers} sub={`${s.accept}% accept`} subTone="success" />
        <Stat label="CONFIRMED ENROLMENTS" value={s.enrolled} sub={`of ${s.cap} seats`} subTone="neutral" />
      </div>
      <div className="-mt-3 grid gap-4 text-on-surface-variant sm:grid-cols-2 xl:grid-cols-5 [&>p]:px-1 [&>p]:text-xs">
        <p><span className="mr-1 inline-block size-1.5 rounded-full bg-error" />{s.unassigned} unassigned leads</p>
        <p>{inrFull(s.fees)} fees collected</p>
        <p>Avg written score: <b className="text-on-surface">{s.avgScore}%</b></p>
        <p>{s.waitlist} candidates on waitlist</p>
        <p>{inrFull(s.token)} token received</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <SearchBox value={q} onChange={setQ} placeholder="Search applicant name, parent mobile, enquiry ID (e.g. ENQ-2026-0084)…" className="min-w-64 flex-1" />
        <Select aria-label="Source filter" value={src} onChange={(e) => setSrc(e.target.value)} className="w-44"><option value="">All sources</option>{SOURCES.map((x) => <option key={x}>{x}</option>)}</Select>
        <Select aria-label="Assignee filter" value={who} onChange={(e) => setWho(e.target.value)} className="w-44"><option value="">All counsellors</option><option value="__none">Unassigned</option>{STAFF.map((x) => <option key={x}>{x}</option>)}</Select>
      </div>

      {!ready ? <p className="text-on-surface-variant">Loading pipeline…</p> : (
        <div className="grid gap-4 overflow-x-auto pb-2 [grid-template-columns:repeat(6,minmax(280px,1fr))]">
          {COLS.map((c) => {
            const items = filtered.filter((e) => c.stages.includes(e.stage)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
            const shown = expanded[c.id] ? items : items.slice(0, 5);
            return (
              <section key={c.id} aria-label={c.label} className="rounded-lg bg-surface-container-low p-3">
                <header className="mb-3 flex items-center justify-between px-1">
                  <h3 className="t-label-caps flex items-center gap-2"><span className={cn("size-2.5 rounded-full", c.dot)} />{c.label}</h3>
                  <Badge>{items.length}</Badge>
                </header>
                <div className="space-y-3">
                  {shown.map((e) => <EnqCard key={e.id} e={e} today={today} onOpen={() => setDetail(e.id)}
                    onWa={async () => { try { await logMessage("WhatsApp", e.phone, `Follow-up message to ${e.guardian} for ${e.name} (${e.ref}).`); toast(`WhatsApp sent to ${e.guardian} (simulated, logged)`); } catch { toast("Could not log message", "error"); } }}
                    onMove={async (st) => { try { await moveEnquiry(e, st); toast(st === "app_issued" ? "Application issued" : `Moved to ${MOVABLE.find((m) => m.v === st)?.l}`); } catch { toast("Move failed", "error"); } }} />)}
                  {items.length === 0 && <p className="px-2 py-6 text-center text-xs text-outline">No enquiries</p>}
                  {items.length > 5 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded((x) => ({ ...x, [c.id]: !x[c.id] }))}>{expanded[c.id] ? "Show fewer" : `Show all ${items.length}`}</Button>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div><h2 className="t-headline-md">Sub-Module Operational Telemetry</h2><p className="text-on-surface-variant">Quick status indicators for active forms, capacity thresholds, and test scheduling.</p></div>
          <Link href="/admissions/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-secondary">View Full Admissions Audit <ArrowRight size={14} /></Link>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="flex flex-col p-5">
            <div className="flex items-center justify-between"><span className="t-label-caps text-on-surface-variant">Online Form Builder</span><Badge tone="success">{form ? `Live v${form.version}` : "—"}</Badge></div>
            <h3 className="mt-3 t-headline-md !text-[18px]">CBSE AY 2026–27 Admission Form</h3>
            <p className="mt-1 text-on-surface-variant">{form ? `${form.published.reduce((n, x) => n + x.fields.length, 0)} fields across ${form.published.length} sections in the live version.` : "Loading form…"}</p>
            <div className="mt-auto flex items-center justify-between border-t border-outline-variant/60 pt-3 text-xs text-on-surface-variant">
              <span>Last submission: {lastWeb ? fmtDate(lastWeb.createdAt) : "—"}</span>
              <Link href="/admissions/form-builder" className="font-semibold text-secondary">Edit Schema →</Link>
            </div>
          </Card>
          <Card className="flex flex-col p-5">
            <div className="flex items-center justify-between"><span className="t-label-caps text-on-surface-variant">Seat Allotment Health</span><b className="text-sm">{seatRows.reduce((x, r) => x + r.held, 0)} / {s.cap} Allocated</b></div>
            <div className="mt-3 space-y-3">
              {GROUPS.map((g) => {
                const rs = seatRows.filter((r) => r.group === g.id); const h = rs.reduce((x, r) => x + r.held, 0), c = rs.reduce((x, r) => x + r.capacity, 0), p = Math.round(pct(h, c));
                return <div key={g.id}><div className="mb-1 flex justify-between text-sm"><span>{g.label}</span><b className={p >= 90 ? "text-error" : p >= 60 ? "text-warning" : "text-secondary"}>{p}% Full ({h}/{c})</b></div><ProgressBar value={p} tone={p >= 90 ? "danger" : p >= 60 ? "warning" : "brand"} /></div>;
              })}
            </div>
            <div className="mt-auto flex items-center justify-between pt-4 text-xs text-on-surface-variant"><span>Waitlist pool: {s.waitlist} students</span><Link href="/admissions/seats" className="font-semibold text-secondary">Manage Capacity →</Link></div>
          </Card>
          <Card className="flex flex-col p-5">
            <div className="flex items-center justify-between"><span className="t-label-caps text-on-surface-variant">Entrance Tests</span>{nextTest && <Badge tone="info"><CalendarClock size={12} />{fmtDate(nextTest.date)}</Badge>}</div>
            {nextTest ? (<>
              <h3 className="mt-3 t-headline-md !text-[18px]">{nextTest.batch.replace("BATCH #", "Batch ")} Entrance Assessment</h3>
              <p className="mt-1 text-on-surface-variant">{nextTestCount} candidates rostered in {nextTest.venue}.</p>
              <div className="mt-auto flex items-center justify-between border-t border-outline-variant/60 pt-3 text-xs text-on-surface-variant"><span>Invigilator: {nextTest.invigilator}</span><button onClick={hallTickets} className="cursor-pointer font-semibold text-secondary">Download Hall Tickets →</button></div>
            </>) : <EmptyState title="No upcoming test" hint="Schedule a slot under Tests & Interviews." />}
          </Card>
        </div>
      </section>
      <p className="sr-only">{enq.rows.length} enquiries loaded</p>
      <EnquiryDetail e={sel} onClose={() => setDetail(null)} onNew={open} />
    </div>
  );
}

function EnqCard({ e, today, onOpen, onWa, onMove }: { e: Enquiry; today: string; onOpen: () => void; onWa: () => void; onMove: (s: EnqStage) => void }) {
  const fu = e.followUp ? (e.followUp === today ? { t: "Today", tone: "warning" as const } : e.followUp < today ? { t: "Overdue", tone: "danger" as const } : { t: fmtDate(e.followUp).slice(0, 6), tone: "neutral" as const }) : null;
  const closed = e.stage === "offered" || e.stage === "enrolled";
  return (
    <article className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 shadow-card">
      <div className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-secondary">{e.ref}</span>{fu && e.stage !== "lost" && !closed && <Badge tone={fu.tone}>{fu.t}</Badge>}{closed && <Badge tone={e.stage === "enrolled" ? "success" : "brand"}>{e.stage === "enrolled" ? "Enrolled" : "Offered"}</Badge>}</div>
      <button onClick={onOpen} className="mt-1 cursor-pointer text-left text-base font-semibold hover:text-secondary">{e.name}</button>
      <p className="text-xs text-on-surface-variant">{gradeLabel(e.grade)} • {e.source}</p>
      {e.sibling && <Badge tone="info" className="mt-2">Sibling Priority</Badge>}
      {e.note && <p className="mt-2 rounded bg-surface-container px-2 py-1.5 text-xs italic text-on-surface-variant">“{e.note}”</p>}
      {e.stage === "lost" && e.lostReason && <p className="mt-2 rounded bg-surface-container px-2 py-1.5 text-xs text-on-surface-variant">Reason: {e.lostReason}</p>}
      <div className="mt-3 flex items-center justify-between border-t border-outline-variant/40 pt-2">
        {e.assignee ? <span className="flex items-center gap-1.5 text-xs text-on-surface-variant"><Avatar name={e.assignee} size={22} />{e.assignee}</span> : <span className="text-xs italic text-outline">Unassigned</span>}
        <span className="flex items-center gap-1">
          <button aria-label={`WhatsApp ${e.guardian}`} onClick={onWa} className="cursor-pointer rounded p-1.5 text-success hover:bg-success-container"><MessageSquare size={14} /></button>
          <a aria-label={`Call ${e.guardian}`} href={`tel:${e.phone.replace(/\s/g, "")}`} className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container"><Phone size={14} /></a>
        </span>
      </div>
      {!e.applicationId && !closed && e.stage !== "lost" ? (
        <Select aria-label={`Move ${e.name}`} value={e.stage} onChange={(ev) => onMove(ev.target.value as EnqStage)} className="mt-2 !h-8 text-xs">
          {MOVABLE.map((m) => <option key={m.v} value={m.v}>{m.l === "Application Issued" ? "Issue application →" : `Stage: ${m.l}`}</option>)}
        </Select>
      ) : e.stage === "lost" && !e.applicationId ? (
        <Button size="sm" variant="ghost" className="mt-2 w-full" onClick={() => onMove("new")}>Reopen</Button>
      ) : null}
    </article>
  );
}

function EnquiryDetail({ e, onClose, onNew }: { e: Enquiry | null; onClose: () => void; onNew: () => void }) {
  const { enq, moveEnquiry, issueApplication } = useAdm();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState<string | null>(null);
  if (!e) return null;
  const patch = (p: Partial<Enquiry>) => enq.update(e.id, p).then(() => toast("Enquiry updated")).catch(() => toast("Update failed", "error"));
  return (
    <Modal open onClose={() => { setNote(null); onClose(); }} width="max-w-xl" title={`${e.name} · ${e.ref}`} subtitle={`${gradeLabel(e.grade)} • ${e.source} • logged ${fmtDate(e.createdAt)}`}
      footer={<>
        <Button variant="ghost" onClick={onNew}><UserPlus size={14} />Log another</Button>
        {!e.applicationId && e.stage !== "lost" && <Button onClick={async () => { try { await issueApplication(e); toast("Application issued"); onClose(); } catch { toast("Could not issue application", "error"); } }}>Issue application</Button>}
        {e.applicationId && <Link href="/admissions/applications" className="inline-flex h-10 items-center rounded bg-secondary px-4 text-sm font-semibold text-on-secondary">Open applications</Link>}
      </>}>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        {([["Guardian", `${e.guardian} (${e.relation})`], ["Mobile", e.phone], ["Email", e.email], ["Area", e.area], ["Previous school", e.prevSchool], ["DOB", e.dob ? fmtDate(e.dob) : "—"]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-xs text-on-surface-variant">{k}</dt><dd className="font-medium">{v || "—"}</dd></div>))}
      </dl>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Counsellor"><Select value={e.assignee} onChange={(ev) => patch({ assignee: ev.target.value })}><option value="">Unassigned</option>{STAFF.map((s) => <option key={s}>{s}</option>)}</Select></Field>
        <Field label="Follow-up date"><Input type="date" value={e.followUp} onChange={(ev) => patch({ followUp: ev.target.value })} /></Field>
      </div>
      <Field label="Notes" className="mt-4"><Textarea value={note ?? e.note} onChange={(ev) => setNote(ev.target.value)} onBlur={() => note !== null && note !== e.note && patch({ note })} /></Field>
      {!e.applicationId && e.stage !== "lost" && (
        <div className="mt-4 flex items-end gap-2">
          <Field label="Close as lost — reason" className="flex-1"><Input value={reason} onChange={(ev) => setReason(ev.target.value)} placeholder="e.g. Chose another school" /></Field>
          <Button variant="danger" onClick={async () => { try { await moveEnquiry(e, "lost", reason); toast("Enquiry closed"); onClose(); } catch { toast("Could not close enquiry", "error"); } }}>Mark lost</Button>
        </div>
      )}
    </Modal>
  );
}
