"use client";
import { useMemo } from "react";
import { Download, FileText } from "lucide-react";
import { Badge, BarChart, Button, Card, CardHeader, DonutChart, LineChart, useToast } from "@/components/ui";
import { inrFull } from "@/lib/format";
import { downloadCsv, pct, useAdm } from "./lib";
import { GROUPS, SOURCES, gradeLabel } from "./types";

const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);

export function Reports() {
  const { enq, apps, offers, seatRows, config, logMessage } = useAdm();
  const toast = useToast();

  const d = useMemo(() => {
    const A = apps.rows, E = enq.rows;
    const tested = A.filter((a) => a.testSlotId), enrolled = A.filter((a) => a.status === "enrolled");
    const e2a = avg(A.map((a) => { const e = E.find((x) => x.id === a.enquiryId); return e ? days(e.createdAt, a.submittedAt) : NaN; }).filter((x) => !isNaN(x)));
    const a2o = avg(offers.rows.map((o) => { const a = A.find((x) => x.id === o.applicationId); return a ? days(a.submittedAt, o.issuedAt) : NaN; }).filter((x) => !isNaN(x)));
    const o2e = avg(offers.rows.filter((o) => o.tokenPaidAt).map((o) => days(o.issuedAt, o.tokenPaidAt)));
    const spend = config?.marketingSpend ?? {};
    const sources = SOURCES.map((s) => {
      const leads = E.filter((e) => e.source === s), enr = leads.filter((e) => e.stage === "enrolled").length, sp = spend[s] ?? 0;
      return { s, leads: leads.length, enr, conv: pct(enr, leads.length), cac: enr && sp ? Math.round(sp / enr) : 0, sp };
    }).sort((a, b) => b.leads - a.leads);
    const wings = GROUPS.map((g) => { const rs = seatRows.filter((r) => r.group === g.id), cap = rs.reduce((x, r) => x + r.capacity, 0), conf = rs.reduce((x, r) => x + r.enrolled, 0), held = rs.reduce((x, r) => x + r.held, 0), wl = rs.reduce((x, r) => x + r.waitlisted, 0); return { ...g, cap, conf, held, wl, yield: pct(conf, cap) }; });
    const cap = wings.reduce((x, w) => x + w.cap, 0), conf = wings.reduce((x, w) => x + w.conf, 0);
    const spendTotal = Object.values(spend).reduce((x, y) => x + y, 0);
    const rteQuota = seatRows.reduce((x, r) => x + r.rteSeats, 0), rteIn = seatRows.reduce((x, r) => x + r.rte, 0);
    const boys = enrolled.filter((a) => a.gender === "Male").length, girls = enrolled.filter((a) => a.gender === "Female").length;
    const sib = enrolled.filter((a) => a.tag === "sibling").length, sibApps = A.filter((a) => a.tag === "sibling").length;
    const month = new Map<string, number>(); A.forEach((a) => month.set(a.submittedAt.slice(0, 7), (month.get(a.submittedAt.slice(0, 7)) ?? 0) + 1));
    const months = [...month.entries()].sort();
    const funnel = [
      { k: "Inquiries Logged", v: E.length, sub: `Avg ${e2a}d to apply` }, { k: "Applications Submitted", v: A.length, sub: `${pct(A.length, E.length)}% of enquiries` },
      { k: "Tests & Interviews", v: tested.length, sub: `${tested.filter((a) => (a.writtenScore ?? 0) >= 60).length} pass (≥60)` }, { k: "Offers Issued", v: offers.rows.length, sub: `Avg ${a2o}d from application` }, { k: "Fee Paid & Enrolled", v: enrolled.length, sub: `Avg ${o2e}d to token` },
    ];
    return { funnel, sources, wings, cap, conf, spendTotal, rteQuota, rteIn, boys, girls, sib, sibApps, months, enrolledN: enrolled.length, tcN: enrolled.filter((a) => a.docs.tc === "verified").length };
  }, [enq.rows, apps.rows, offers.rows, seatRows, config]);

  const comp = [
    { cat: "RTE 25% EWS Quota (Sec. 12(1)(c))", target: `${d.rteQuota} seats reserved`, actual: `${d.rteIn} allocated`, p: pct(d.rteIn, d.rteQuota), cap: true },
    { cat: "Sibling Concession Admissions", target: `${d.sibApps} verified applicants`, actual: `${d.sib} enrolled & credited`, p: pct(d.sib, d.sibApps), cap: false },
    { cat: "Gender Ratio Balance", target: "Target 50:50 (±5%)", actual: `${pct(d.boys, d.boys + d.girls)}% Boys / ${pct(d.girls, d.boys + d.girls)}% Girls`, p: 100 - Math.abs(50 - pct(d.boys, d.boys + d.girls)), cap: false, balanced: Math.abs(50 - pct(d.boys, d.boys + d.girls)) <= 5 },
    { cat: "Transfer / TC Verification", target: `${d.enrolledN} admissions`, actual: `${d.tcN} TC / migration cleared`, p: pct(d.tcN, d.enrolledN), cap: false },
  ];

  const ledger = () => downloadCsv("admissions-ledger.csv", [["App ID", "Student", "Grade", "Guardian", "Phone", "Source", "Priority", "Status", "Score", "Fee paid"],
    ...apps.rows.map((a) => [a.ref, a.name, gradeLabel(a.grade), a.guardian, a.phone, enq.rows.find((e) => e.id === a.enquiryId)?.source ?? "", a.tag, a.status, a.writtenScore ?? "", a.feePaid ? "Yes" : "No"])]);
  const sourcesCsv = () => downloadCsv("source-attribution.csv", [["Channel", "Leads", "Enrolled", "Conversion %", "Spend", "CAC"], ...d.sources.map((s) => [s.s, s.leads, s.enr, s.conv, s.sp, s.cac])]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="End-to-End Admissions Funnel & Stage Velocity" subtitle="Real-time pipeline progression, stage drop-offs, and verification pace" actions={<Button variant="outline" size="sm" onClick={ledger}><Download size={14} />Export CSV</Button>} />
        <div className="grid gap-3 p-5 pt-2 sm:grid-cols-2 xl:grid-cols-5">
          {d.funnel.map((f, i) => <div key={f.k} className={`rounded-lg border p-4 ${i === 4 ? "border-secondary/40 bg-info-container" : "border-outline-variant/60 bg-surface-container-low"}`}><div className="flex items-center justify-between"><span className="grid size-6 place-items-center rounded-full bg-secondary text-xs font-semibold text-on-secondary">{i + 1}</span><span className="text-xs text-on-surface-variant">{f.sub}</span></div><div className="mt-2 text-sm">{f.k}</div><div className="text-2xl font-semibold">{f.v}</div></div>)}
        </div>
        <div className="px-5 pb-5"><BarChart items={d.funnel.map((f, i) => ({ label: f.k.split(" ")[0]!, value: f.v, tone: i === 4 ? "success" : "brand" }))} /></div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Source Attribution & Campaign ROI" subtitle="Channel acquisition performance and cost effectiveness" actions={<Button variant="ghost" size="sm" onClick={sourcesCsv}><Download size={14} />CSV</Button>} />
          <div className="overflow-x-auto px-5"><table className="w-full text-left text-sm"><thead><tr className="border-b border-outline-variant/60 text-on-surface-variant">{["Channel / Source", "Leads", "Enrolled", "Conv. Rate", "CAC (₹)"].map((h) => <th key={h} className="py-2 pr-3 text-xs font-semibold">{h}</th>)}</tr></thead>
            <tbody>{d.sources.map((s) => <tr key={s.s} className="border-b border-outline-variant/40"><td className="py-2.5 pr-3">{s.s}</td><td>{s.leads}</td><td className="font-semibold">{s.enr}</td><td className={s.conv >= 25 ? "font-semibold text-success" : ""}>{s.conv}%</td><td>{s.cac ? inrFull(s.cac) : <span className="text-success">₹0 (Organic)</span>}</td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap justify-between gap-2 px-5 py-4 text-sm"><span>Total Marketing Spend: <b>{inrFull(d.spendTotal)}</b></span><b className="text-secondary">Blended CAC: {inrFull(d.enrolledN ? Math.round(d.spendTotal / d.enrolledN) : 0)} / Student</b></div>
          <div className="px-5 pb-5"><DonutChart items={d.sources.filter((s) => s.leads).map((s) => ({ label: s.s, value: s.leads }))} centre={<div><div className="text-xl font-semibold">{enq.rows.length}</div><div className="t-caption text-on-surface-variant">LEADS</div></div>} /></div>
        </Card>
        <Card>
          <CardHeader title="Wing-wise Intake Capacity & Seat Yield" subtitle="Real-time seat allocation against sanctioned capacities" />
          <div className="overflow-x-auto px-5"><table className="w-full text-left text-sm"><thead><tr className="border-b border-outline-variant/60 text-on-surface-variant">{["Level / Wing", "Sanctioned", "Confirmed", "Yield %", "Status"].map((h) => <th key={h} className="py-2 pr-3 text-xs font-semibold">{h}</th>)}</tr></thead>
            <tbody>{d.wings.map((w) => <tr key={w.id} className="border-b border-outline-variant/40"><td className="py-2.5 pr-3"><b>{w.label}</b><div className="text-xs text-on-surface-variant">{w.sub}</div></td><td>{w.cap}</td><td>{w.conf}</td><td className={w.yield >= 90 ? "font-semibold text-success" : ""}>{w.yield}%</td><td><Badge tone={w.cap - w.held <= 0 ? "warning" : "info"}>{w.wl && w.cap - w.held <= 0 ? `Waitlist ${w.wl}` : `${w.cap - w.held} Seats Left`}</Badge></td></tr>)}</tbody></table></div>
          <div className="flex justify-between px-5 py-4 text-sm"><span>Total Sanctioned: <b>{d.cap} Seats</b></span><b className="text-success">Overall Intake: {pct(d.conf, d.cap)}% Enrolled</b></div>
          <div className="px-5 pb-5"><p className="mb-1 text-sm font-semibold">Applications per month</p><LineChart values={d.months.map((m) => m[1])} labels={d.months.map((m) => m[0].slice(5) + "/" + m[0].slice(2, 4))} /></div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Statutory & Demographic Compliance Audit" subtitle="Mandatory state RTE Section 12(1)(c), CBSE affiliation bylaws, and equity norms verification" actions={<Badge tone="success">Computed live</Badge>} />
        <div className="overflow-x-auto px-5 pb-5"><table className="w-full text-left text-sm"><thead><tr className="bg-surface-container-low text-on-surface-variant">{["Category / Dimension", "Sanctioned / Target", "Actual Enrolled", "Compliance %", "Audit Status"].map((h) => <th key={h} className="px-3 py-2.5 text-xs font-semibold">{h}</th>)}</tr></thead>
          <tbody>{comp.map((c) => { const ok = c.balanced ?? (c.cap ? c.p >= 100 : c.p >= 95); return <tr key={c.cat} className="border-b border-outline-variant/40"><td className="px-3 py-3 font-medium">{c.cat}</td><td className="px-3 text-on-surface-variant">{c.target}</td><td className="px-3 font-semibold">{c.actual}</td><td className="px-3"><Badge tone={ok ? "success" : "warning"}>{Math.round(c.p * 10) / 10}%</Badge></td><td className={`px-3 font-semibold ${ok ? "text-success" : "text-warning"}`}>{ok ? "Compliant" : "Needs attention"}</td></tr>; })}</tbody></table></div>
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3"><FileText className="text-secondary" /><div><b>AY 2026–27 Statutory Admissions Report</b><p className="text-sm text-on-surface-variant">Verified by Principal Dr. Rajiv Sharma · figures computed from live admissions data</p></div></div>
        <div className="flex gap-2"><Button variant="outline" onClick={() => logMessage("Report", "Records", "CBSE Return PDF generated (simulated).").then(() => toast("CBSE Return PDF queued (simulated — no PDF service connected)")).catch(() => toast("Could not queue the PDF", "error"))}>Download CBSE Return PDF</Button><Button variant="outline" onClick={() => { ledger(); toast("Full ledger exported"); }}>Export Full Ledger (.csv)</Button></div>
      </Card>
    </div>
  );
}
