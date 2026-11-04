"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Clock, MessageSquare, Plus, X } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, Field, Modal, Select, Stat, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inrFull } from "@/lib/format";
import { pct, useAdm, useToday } from "./lib";
import { GRADES, gradeLabel, type Offer, type OfferStatus } from "./types";

const TONE: Record<OfferStatus, "warning" | "success" | "brand" | "danger" | "neutral"> = { pending: "warning", accepted: "brand", enrolled: "success", declined: "danger", lapsed: "neutral" };
const LABEL: Record<OfferStatus, string> = { pending: "Offer Pending", accepted: "Accepted · Token Paid", enrolled: "Enrolled", declined: "Declined", lapsed: "Lapsed" };

export function Offers() {
  const { offers, apps, seatRows, ready, generateOffer, acceptOffer, declineOffer, lapseOffer, enrolOffer, logMessage, config } = useAdm();
  const toast = useToast();
  const today = useToday();
  const [tab, setTab] = useState("all");
  const [grade, setGrade] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [gen, setGen] = useState(false);
  const [decline, setDecline] = useState<Offer | null>(null);
  const [reason, setReason] = useState("Chose another school");
  const [busy, setBusy] = useState(false);

  const st = useMemo(() => {
    const r = offers.rows, ok = r.filter((o) => o.status === "accepted" || o.status === "enrolled").length;
    return { total: r.length, ok, yield: pct(ok, r.length), pending: r.filter((o) => o.status === "pending").length, lost: r.filter((o) => o.status === "declined" || o.status === "lapsed").length,
      token: r.reduce((x, o) => x + o.tokenPaid, 0), cap: seatRows.reduce((x, s) => x + s.capacity, 0) };
  }, [offers.rows, seatRows]);
  const rows = offers.rows.filter((o) => (!grade || o.grade === grade) && (tab === "all" || (tab === "ok" ? o.status === "accepted" || o.status === "enrolled" : tab === "pending" ? o.status === "pending" : o.status === "declined" || o.status === "lapsed")))
    .sort((a, b) => b.ref.localeCompare(a.ref));

  const run = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); } catch (e) { toast((e as Error).message || "Action failed", "error"); } };
  const cols: Column<Offer>[] = [
    { key: "ref", header: "Offer Ref & Date", sortValue: (o) => o.ref, render: (o) => <div><Link href="/admissions/applications" className={cn("font-semibold text-secondary", (o.status === "lapsed" || o.status === "declined") && "line-through opacity-60")}>{o.ref}</Link><span className="ml-2 text-xs text-on-surface-variant">{fmtDate(o.issuedAt)}</span></div> },
    { key: "name", header: "Candidate Name", sortValue: (o) => o.name, render: (o) => <div className="flex items-center gap-3"><Avatar name={o.name} size={32} /><div><div className="font-semibold">{o.name}</div><div className="text-xs text-on-surface-variant">{o.phone} ({o.guardian})</div></div></div> },
    { key: "grade", header: "Target Cohort", render: (o) => <Badge>{gradeLabel(o.grade)}</Badge> },
    { key: "exp", header: "Offer Expiry", sortValue: (o) => o.expiresAt, render: (o) => { const late = o.status === "pending" && o.expiresAt < today; const d = Math.ceil((new Date(o.expiresAt).getTime() - new Date(today).getTime()) / 86400000); return <span className={cn("inline-flex items-center gap-1", late && "text-error")}>{o.status === "pending" && d >= 0 && d <= 1 && <Clock size={12} className="text-error" />}{fmtDate(o.expiresAt)}{late && " (Expired)"}{o.status === "pending" && !late && d <= 3 && <Badge tone="danger">{d}d left</Badge>}</span>; } },
    { key: "status", header: "Status", render: (o) => <div><Badge tone={TONE[o.status]}>{LABEL[o.status]}</Badge>{o.tokenPaid > 0 && <div className="mt-0.5 text-xs text-on-surface-variant">Token {inrFull(o.tokenPaid)}</div>}</div> },
    { key: "act", header: "Actions", render: (o) => (
      <div className="flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
        {o.status === "pending" && <><Button size="sm" onClick={() => run(() => acceptOffer(o), `Offer ${o.ref} accepted — token received`)}>Accept</Button><Button size="sm" variant="outline" onClick={() => { setDecline(o); }}>Decline</Button>{o.expiresAt < today && <Button size="sm" variant="ghost" onClick={() => run(() => lapseOffer(o), "Offer lapsed — seat released")}>Lapse</Button>}</>}
        {o.status === "accepted" && <Button size="sm" onClick={async () => { try { const s = await enrolOffer(o); toast(`${o.name} enrolled — GRN ${s.grn} added to Students`); } catch (e) { toast((e as Error).message || "Enrolment failed", "error"); } }}>Enrol student</Button>}
        {o.status === "enrolled" && (o.studentId ? <Link href="/students" className="text-sm font-semibold text-secondary">View student →</Link> : <span className="text-xs text-on-surface-variant">Enrolled</span>)}
      </div>) },
  ];
  const selected = offers.rows.filter((o) => sel.includes(o.id));
  const tabs = [["all", `All (${st.total})`], ["ok", `Accepted & Enrolled (${st.ok})`], ["pending", `Offer Pending (${st.pending})`], ["lost", `Lapsed / Declined (${st.lost})`]];
  const candidates = apps.rows.filter((a) => ["verified", "tested", "shortlisted", "waitlisted"].includes(a.status));
  const [pickApp, setPickApp] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total Offers Issued" value={st.total} sub={`${pct(st.total, st.cap)}% of seats`} subTone="info" />
        <Stat label="Accepted & Token Paid" value={st.ok} sub={`${st.yield}% yield`} subTone="success" />
        <Stat label="Pending Parent Response" value={st.pending} sub="Action Due" subTone="warning" />
        <Stat label="Lapsed / Declined" value={st.lost} sub="Seats re-allocated" />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-44"><option value="">All Grades</option>{GRADES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}</Select>
          <div role="tablist" className="flex flex-wrap gap-1">{tabs.map(([id, l]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id!)} className={cn("cursor-pointer rounded px-3 py-1.5 text-sm font-medium", tab === id ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container")}>{l}</button>)}</div>
          <Button className="ml-auto" onClick={() => setGen(true)}><Plus size={16} />Generate offer</Button>
        </div>
        {!ready ? <p className="p-5">Loading…</p> : <DataTable rows={rows} columns={cols} pageSize={10} selectable selected={sel} onSelectedChange={setSel} searchText={(o) => `${o.ref} ${o.name} ${o.guardian} ${o.phone}`} />}
      </Card>

      {sel.length > 0 && (
        <div role="toolbar" aria-label="Bulk actions" className="fixed bottom-6 left-1/2 z-40 w-[min(560px,92vw)] -translate-x-1/2 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 shadow-pop">
          <div className="flex items-start justify-between"><div><b>{sel.length} Offers Selected</b><div className="text-xs text-on-surface-variant">{selected.slice(0, 3).map((o) => o.name).join(", ")}{selected.length > 3 && "…"}</div></div><button aria-label="Clear selection" onClick={() => setSel([])} className="cursor-pointer"><X size={16} /></button></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={async () => { const p = selected.filter((o) => o.status === "pending"); if (!p.length) return toast("Reminders apply to pending offers only", "error"); try { await Promise.all(p.map((o) => logMessage("WhatsApp reminder", o.phone, `Reminder: offer ${o.ref} for ${o.name} expires ${o.expiresAt}.`))); toast(`WhatsApp reminders sent to ${p.length} guardians (simulated)`); setSel([]); } catch { toast("Could not log reminders", "error"); } }}><MessageSquare size={14} />Batch Send WhatsApp Reminder</Button>
            <Button variant="danger" size="sm" onClick={async () => { const p = selected.filter((o) => o.status === "pending"); if (!p.length) return toast("Only pending offers can be released", "error"); try { await Promise.all(p.map((o) => lapseOffer(o))); toast(`${p.length} seats released to the waitlist pool`); setSel([]); } catch { toast("Some offers could not be released", "error"); } }}>Release to Waitlist</Button>
          </div>
        </div>)}

      <Modal open={gen} onClose={() => setGen(false)} title="Generate offer" subtitle={`Offer valid for ${config?.offerValidityDays ?? 7} days. A free seat in the grade is required.`}
        footer={<><Button variant="outline" onClick={() => setGen(false)}>Cancel</Button><Button disabled={!pickApp || busy} onClick={async () => { const a = apps.rows.find((x) => x.id === pickApp); if (!a) return; setBusy(true); try { const o = await generateOffer(a); toast(`Offer ${o.ref} generated for ${a.name}`); setGen(false); setPickApp(""); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); } }}>Generate</Button></>}>
        <Field label="Candidate"><Select value={pickApp} onChange={(e) => setPickApp(e.target.value)}><option value="">Choose a candidate…</option>{candidates.map((a) => <option key={a.id} value={a.id}>{a.name} · {a.ref} · {gradeLabel(a.grade)} · {a.writtenScore ?? "—"}/100</option>)}</Select></Field>
      </Modal>
      <Modal open={!!decline} onClose={() => setDecline(null)} title="Decline offer" subtitle={decline ? `${decline.ref} · ${decline.name}` : ""} footer={<><Button variant="outline" onClick={() => setDecline(null)}>Cancel</Button><Button variant="danger" onClick={async () => { if (decline) await run(() => declineOffer(decline, reason), "Offer declined — seat released"); setDecline(null); }}>Confirm decline</Button></>}>
        <Field label="Reason"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{["Chose another school", "Fee too high", "Relocating", "Seat timing / transport", "Other"].map((r) => <option key={r}>{r}</option>)}</Select></Field>
      </Modal>
    </div>
  );
}
