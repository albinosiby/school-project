"use client";
import { useMemo, useState } from "react";
import { Scale, Settings2, Zap } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, DataTable, Field, Input, Modal, ProgressBar, Stat, useToast, type Column } from "@/components/ui";
import { cn } from "@/lib/cn";
import { pct, rankValue, useAdm, type SeatRow } from "./lib";
import { capacityError } from "./logic";
import { GROUPS, TAG_LABEL, gradeLabel, type Application } from "./types";

type Ranked = Application & { rank: number };

export function Seats() {
  const { apps, seats, seatRows, generateOffer, ready } = useAdm();
  const toast = useToast();
  const [tab, setTab] = useState("all");
  const [sel, setSel] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [roster, setRoster] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);

  const cap = seatRows.reduce((x, r) => x + r.capacity, 0), enrolled = seatRows.reduce((x, r) => x + r.enrolled, 0);
  const rteQuota = seatRows.reduce((x, r) => x + r.rteSeats, 0), rteFilled = seatRows.reduce((x, r) => x + r.rte, 0);

  const ranked: Ranked[] = useMemo(() => apps.rows.filter((a) => a.status === "waitlisted").sort((a, b) => rankValue(b) - rankValue(a)).map((a, i) => ({ ...a, rank: i + 1 })), [apps.rows]);
  const rows = ranked.filter((a) => tab === "all" || (tab === "rte" ? a.tag === "rte" : tab === "sibling" ? a.tag === "sibling" : a.tag === "general" || a.tag === "staff"));
  const free = (g: string) => seatRows.find((s) => s.grade === g)?.free ?? 0;

  const allocate = async (a: Application) => { try { const o = await generateOffer(a); toast(`Seat allocated — offer ${o.ref} issued to ${a.name}`); } catch (e) { toast((e as Error).message, "error"); } };
  const auto = async () => {
    const pool = sel.length ? ranked.filter((a) => sel.includes(a.id)) : ranked;
    const left: Record<string, number> = Object.fromEntries(seatRows.map((s) => [s.grade, s.free]));
    let n = 0;
    for (const a of pool) { if ((left[a.grade] ?? 0) > 0 && n < (sel.length ? 99 : 5)) { try { await generateOffer(a); left[a.grade]!--; n++; } catch { /* skip */ } } }
    toast(n ? `${n} candidates auto-allotted and offers issued` : "No eligible candidates — no free seats for the selection", n ? "success" : "error"); setSel([]);
  };

  const cols: Column<Ranked>[] = [
    { key: "rank", header: "Rank", sortValue: (a) => a.rank, render: (a) => <Badge tone="info">#{a.rank}</Badge> },
    { key: "name", header: "Candidate Name", sortValue: (a) => a.name, render: (a) => <div className="flex items-center gap-3"><Avatar name={a.name} size={32} /><div><div className="font-semibold">{a.name}</div><div className="text-xs text-on-surface-variant">{a.ref}</div></div></div> },
    { key: "grade", header: "Target Grade", render: (a) => gradeLabel(a.grade) },
    { key: "tag", header: "Priority Tag", render: (a) => <Badge tone={a.tag === "general" ? "neutral" : "info"}>{TAG_LABEL[a.tag]}</Badge> },
    { key: "merit", header: "Test Merit", sortValue: (a) => a.writtenScore ?? 0, render: (a) => <b className="text-secondary">{a.writtenScore ?? "—"}/100</b> },
    { key: "st", header: "Allotment Status", render: (a) => free(a.grade) > 0 ? <Badge tone="success">Eligible for Seat</Badge> : <Badge>On Waitlist (WL-{String(a.waitlistNo).padStart(2, "0")})</Badge> },
    { key: "act", header: "Actions", render: (a) => free(a.grade) > 0 ? <Button size="sm" onClick={(e) => { e.stopPropagation(); allocate(a); }}>Allocate Seat</Button> : <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setProfile(a.id); }}>View Profile</Button> },
  ];
  const prof = profile ? apps.rows.find((a) => a.id === profile) : null;
  const rosterApps = roster ? apps.rows.filter((a) => a.status === "enrolled" && seatRows.find((s) => s.grade === a.grade)?.group === roster) : [];
  const count = (f: (a: Ranked) => boolean) => ranked.filter(f).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="TOTAL INTAKE CAPACITY" value={cap} sub="Total Seats" /><Stat label="CONFIRMED & ENROLLED" value={enrolled} sub="Students Enrolled" subTone="brand" />
        <Stat label="ACTIVE WAITLISTED" value={ranked.length} sub="Applicants in Queue" /><Stat label="RTE 25% STATUTORY QUOTA" value={`${rteFilled}`} sub={`/ ${rteQuota} Quota Seats`} icon={<Scale size={16} />} />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="t-headline-md">Cohort Capacity Breakdown <Badge className="ml-2">{GROUPS.length} Active Cohorts</Badge></h2>
        <Button variant="outline" onClick={() => setEditing(true)}><Settings2 size={16} />Edit capacity</Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {GROUPS.map((g) => {
          const rs = seatRows.filter((r) => r.group === g.id), h = rs.reduce((x, r) => x + r.held, 0), c = rs.reduce((x, r) => x + r.capacity, 0), p = Math.round(pct(h, c)); // pct guards c = 0 (was NaN%)
          return (
            <Card key={g.id} className="p-5">
              <div className="flex justify-between"><Badge tone={p >= 90 ? "info" : "neutral"}>{p}% FILLED</Badge><Badge>{c - h} Left</Badge></div>
              <h3 className="mt-3 t-headline-md !text-[18px]">{g.label}</h3><p className="text-on-surface-variant">{g.sub}</p>
              <div className="mt-3 rounded-lg bg-surface-container-low p-3"><div className="flex items-end justify-between"><div><span className="text-3xl font-semibold">{h}</span> <span className="text-on-surface-variant">/ {c}</span></div><Badge tone="info">{rs.reduce((x, r) => x + r.waitlisted, 0)} Waitlisted</Badge></div><ProgressBar className="mt-2" value={p} tone={p >= 90 ? "danger" : "brand"} /></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">{([["GEN", "gen"], ["RTE", "rte"], ["SIB", "sib"]] as const).map(([l, k]) => <div key={l} className="rounded bg-surface-container-low py-2"><div className="font-semibold">{rs.reduce((x, r) => x + r[k], 0)}</div><div className="t-caption text-on-surface-variant">{l}</div></div>)}</div>
              <button onClick={() => setRoster(g.id)} className="mt-3 cursor-pointer text-sm font-semibold text-secondary">View Cohort Roster →</button>
            </Card>);
        })}
      </div>

      <Card>
        <CardHeader title="Seat matrix per grade" subtitle="Held = enrolled + live offers" />
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-y border-outline-variant/60 bg-surface-container-low">{["Grade", "Capacity", "Enrolled", "Offers out", "Free", "Waitlist", "RTE seats", "Block"].map((h) => <th key={h} className="px-4 py-2 t-label-caps !text-[11px]">{h}</th>)}</tr></thead>
          <tbody>{seatRows.map((r) => <tr key={r.id} className="border-b border-outline-variant/40"><td className="px-4 py-2 font-semibold">{gradeLabel(r.grade)}</td><td className="px-4">{r.capacity}</td><td className="px-4">{r.enrolled}</td><td className="px-4">{r.held - r.enrolled}</td><td className={cn("px-4 font-semibold", r.free <= 0 ? "text-error" : "text-success")}>{r.free}</td><td className="px-4">{r.waitlisted}</td><td className="px-4">{r.rteSeats}</td><td className="px-4">{r.block}</td></tr>)}</tbody></table></div>
      </Card>

      <Card>
        <CardHeader title="Prioritized Waitlist & Seat Allotment" subtitle="Ranked by statutory RTE quota, sibling priority, then assessment score."
          actions={<Button onClick={auto}><Zap size={14} />Auto-Allot Top Candidates</Button>} />
        <div className="flex flex-wrap gap-1 px-5 pb-3" role="tablist">
          {[["all", `All (${ranked.length})`], ["rte", `RTE Mandate (${count((a) => a.tag === "rte")})`], ["sibling", `Sibling (${count((a) => a.tag === "sibling")})`], ["general", `General (${count((a) => a.tag === "general" || a.tag === "staff")})`]].map(([id, l]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id!)} className={cn("cursor-pointer rounded px-3 py-1.5 text-sm font-medium", tab === id ? "bg-secondary text-on-secondary" : "text-on-surface-variant hover:bg-surface-container")}>{l}</button>))}
        </div>
        {!ready ? <p className="p-5">Loading…</p> : <DataTable rows={rows} columns={cols} pageSize={6} selectable selected={sel} onSelectedChange={setSel} searchText={(a) => `${a.name} ${a.ref}`} />}
      </Card>

      {/* mounted only while open so cancelled edits don't reappear next time */}
      {editing && <CapacityModal open onClose={() => setEditing(false)} rows={seatRows} onSave={async (m) => { try { await Promise.all(Object.entries(m).map(([id, v]) => seats.update(id, v))); toast("Seat capacities updated"); setEditing(false); } catch { toast("Could not save capacities", "error"); } }} />}
      <Modal open={!!roster} onClose={() => setRoster(null)} title={`${GROUPS.find((g) => g.id === roster)?.label ?? ""} — enrolled roster`} subtitle={`${rosterApps.length} students`}>
        <ul className="divide-y divide-outline-variant/40">{rosterApps.map((a) => <li key={a.id} className="flex justify-between py-2"><span>{a.name}</span><Badge>{gradeLabel(a.grade)}</Badge></li>)}{rosterApps.length === 0 && <li className="py-4 text-on-surface-variant">No enrolled students yet.</li>}</ul>
      </Modal>
      <Modal open={!!prof} onClose={() => setProfile(null)} title={prof?.name ?? ""} subtitle={prof ? `${prof.ref} · ${gradeLabel(prof.grade)}` : ""}>
        {prof && <dl className="grid grid-cols-2 gap-3 text-sm">{([["Guardian", prof.guardian], ["Mobile", prof.phone], ["Priority", TAG_LABEL[prof.tag]], ["Merit", `${prof.writtenScore ?? "—"}/100`], ["Waitlist no.", `WL-${prof.waitlistNo}`], ["Seat in grade", free(prof.grade) > 0 ? "Available" : "Full"]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-on-surface-variant">{k}</dt><dd className="font-medium">{v}</dd></div>)}</dl>}
      </Modal>
    </div>
  );
}

function CapacityModal({ open, onClose, rows, onSave }: { open: boolean; onClose: () => void; rows: SeatRow[]; onSave: (m: Record<string, { capacity: number; rteSeats: number }>) => void }) {
  const [v, setV] = useState<Record<string, { capacity: string; rte: string }>>({});
  if (!open) return null;
  const get = (r: SeatRow) => v[r.id] ?? { capacity: String(r.capacity), rte: String(r.rteSeats) };
  const errOf = (r: SeatRow) => { const g = get(r); return capacityError(r.held, g.capacity, g.rte); };
  const errs = rows.filter((r) => errOf(r));
  return (
    <Modal open onClose={onClose} width="max-w-2xl" title="Edit seat capacity" subtitle="Capacity cannot drop below enrolled + live offers."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button disabled={errs.length > 0} onClick={() => onSave(Object.fromEntries(rows.map((r) => [r.id, { capacity: Number(get(r).capacity), rteSeats: Number(get(r).rte) }])))}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">{rows.map((r) => { const g = get(r); const e = errOf(r); return (
        <div key={r.id} className="rounded-lg border border-outline-variant/60 p-3"><div className="mb-2 flex justify-between font-semibold">{gradeLabel(r.grade)}<span className="text-xs font-normal text-on-surface-variant">held {r.held}</span></div>
          <div className="grid grid-cols-2 gap-2"><Field label="Capacity" error={e.startsWith("Capacity") ? e : undefined}><Input type="number" min={r.held} aria-label={`${gradeLabel(r.grade)} capacity`} value={g.capacity} onChange={(e) => setV({ ...v, [r.id]: { ...g, capacity: e.target.value } })} /></Field><Field label="RTE seats" error={e.startsWith("RTE") ? e : undefined}><Input type="number" min={0} aria-label={`${gradeLabel(r.grade)} RTE seats`} value={g.rte} onChange={(e) => setV({ ...v, [r.id]: { ...g, rte: e.target.value } })} /></Field></div></div>); })}</div>
    </Modal>
  );
}
