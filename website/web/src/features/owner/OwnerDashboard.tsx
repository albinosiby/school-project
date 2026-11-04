"use client";
import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Briefcase, Building2, GraduationCap, Inbox, Plus } from "lucide-react";
import { Badge, BarChart, Button, Card, CardHeader, DonutChart, EmptyState, PageHeader, Stat } from "@/components/ui";
import { useLeads, useSchools } from "./data";
import { fmtDate, leadStatus, LEAD_STATUSES, ownerStats, schoolsByMonth } from "./logic";

const num = (n: number) => n.toLocaleString("en-IN");

export function OwnerDashboard() {
  const { rows, ready, error } = useSchools();
  const leads = useLeads();
  const s = useMemo(() => ownerStats(rows, leads.rows), [rows, leads.rows]);
  const months = useMemo(() => schoolsByMonth(rows), [rows]);
  const attention = rows.filter((r) => r.status === "suspended" || r.setupComplete === false).slice(0, 6);
  const funnel = LEAD_STATUSES.map((st) => ({ label: st.label, value: leads.rows.filter((l) => l.status === st.value).length }));

  return (
    <div>
      <PageHeader title="Platform dashboard" subtitle="Every school on Edvio, its people and the demo requests from the website."
        actions={<Link href="/owner/schools/new"><Button><Plus size={16} />Add school</Button></Link>} />
      {error && <Card className="mb-6 border-error/40 p-4 text-sm text-error">Could not load the schools: {error}</Card>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Schools" value={ready ? num(s.schools) : "…"} sub={s.suspended ? `${s.suspended} suspended` : `${s.active} active`} subTone={s.suspended ? "warning" : "success"} icon={<Building2 size={18} />} />
        <Stat label="Students" value={ready ? num(s.students) : "…"} sub="all schools" icon={<GraduationCap size={18} />} />
        <Stat label="Staff" value={ready ? num(s.staff) : "…"} sub="all schools" icon={<Briefcase size={18} />} />
        <Stat label="Demo requests" value={leads.ready ? num(s.openLeads) : "…"} sub={`${s.newLeads} new`} subTone={s.newLeads ? "info" : "neutral"} icon={<Inbox size={18} />} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader title="New schools" subtitle="Schools added per month, last 6 months" />
          <div className="px-5 pb-5"><BarChart items={months} /></div>
        </Card>
        <Card>
          <CardHeader title="Demo request pipeline" subtitle={`${s.converted} converted to schools`} />
          <div className="px-5 pb-5">{leads.rows.length ? <DonutChart items={funnel} centre={<span className="t-headline-md">{leads.rows.length}</span>} /> : <EmptyState title="No requests yet" hint="Requests from the website's Book a demo form appear here." />}</div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title="Latest demo requests" actions={<Link href="/owner/leads" className="text-sm font-semibold text-secondary hover:underline">View all</Link>} />
          {leads.rows.length === 0 ? <EmptyState title="No demo requests yet" /> : (
            <ul className="divide-y divide-outline-variant/60">
              {leads.rows.slice(0, 5).map((l) => {
                const st = leadStatus(l.status);
                return (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0"><p className="truncate font-semibold">{l.school}</p><p className="truncate text-xs text-on-surface-variant">{l.name} · {l.email}</p></div>
                    <div className="flex shrink-0 items-center gap-2"><span className="text-xs text-outline">{fmtDate(l.createdAt)}</span><Badge tone={st.tone}>{st.label}</Badge></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Needs attention" subtitle="Suspended schools and schools that have not finished setup" />
          {attention.length === 0 ? <EmptyState title="All schools are active and set up" /> : (
            <ul className="divide-y divide-outline-variant/60">
              {attention.map((r) => (
                <li key={r.id}>
                  <Link href={`/owner/schools/${r.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-container-low">
                    <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="truncate text-xs text-on-surface-variant">{r.adminEmail || "No admin login"}</p></div>
                    {r.status === "suspended" ? <Badge tone="danger"><AlertTriangle size={12} />Suspended</Badge> : <Badge tone="warning">Setup pending</Badge>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
