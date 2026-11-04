"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Tabs, type Column } from "@/components/ui";
import { useSchools } from "./data";
import { fmtDate, type SchoolRow } from "./logic";

const setupBadge = (r: SchoolRow) => r.setupComplete === null ? <span className="text-outline">…</span>
  : r.setupComplete ? <Badge tone="success">Done</Badge> : <Badge tone="warning">Pending</Badge>;

export function SchoolsList() {
  const router = useRouter();
  const { rows, ready, error, refresh } = useSchools();
  const [tab, setTab] = useState("all");
  const view = rows.filter((r) => tab === "all" || r.status === tab);

  const columns: Column<SchoolRow>[] = [
    { key: "name", header: "School", sortValue: (r) => r.name.toLowerCase(), render: (r) => (
      <div className="min-w-0"><Link href={`/owner/schools/${r.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold hover:underline">{r.name}</Link><p className="text-xs text-on-surface-variant">{[r.city, r.board].filter(Boolean).join(" · ") || "—"}</p></div>) },
    { key: "admin", header: "Admin login", render: (r) => <div className="min-w-0"><p className="truncate">{r.adminEmail || "—"}</p>{r.admins.length > 1 && <p className="text-xs text-outline">+{r.admins.length - 1} more</p>}</div> },
    { key: "students", header: "Students", sortValue: (r) => r.counts?.students ?? -1, render: (r) => r.counts ? r.counts.students.toLocaleString("en-IN") : "…" },
    { key: "staff", header: "Staff", sortValue: (r) => r.counts?.staff ?? -1, render: (r) => r.counts ? r.counts.staff.toLocaleString("en-IN") : "…" },
    { key: "plan", header: "Plan", sortValue: (r) => r.plan, render: (r) => r.plan || <span className="text-outline">—</span> },
    { key: "setup", header: "Setup", render: setupBadge },
    { key: "status", header: "Status", sortValue: (r) => r.status, render: (r) => r.status === "active" ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Suspended</Badge> },
    { key: "created", header: "Added", sortValue: (r) => r.createdAt, render: (r) => fmtDate(r.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="Schools" subtitle="Add schools, give them an admin login, and open any school to support or configure it."
        actions={<><Button variant="outline" onClick={refresh} aria-label="Refresh counts"><RefreshCw size={16} /></Button><Link href="/owner/schools/new"><Button><Plus size={16} />Add school</Button></Link></>} />
      {error && <Card className="mb-6 border-error/40 p-4 text-sm text-error">Could not load the schools: {error}</Card>}
      <Card className="pt-4">
        <Tabs className="px-5 pb-3" value={tab} onChange={setTab} items={[
          { id: "all", label: "All", count: rows.length },
          { id: "active", label: "Active", count: rows.filter((r) => r.status === "active").length },
          { id: "suspended", label: "Suspended", count: rows.filter((r) => r.status === "suspended").length },
        ]} />
        {!ready ? <p className="p-6 text-on-surface-variant">Loading schools…</p> : (
          <DataTable rows={view} columns={columns} pageSize={12} onRowClick={(r) => router.push(`/owner/schools/${r.id}`)}
            searchText={(r) => `${r.name} ${r.city} ${r.adminEmail} ${r.plan}`}
            empty={<EmptyState title="No schools here" hint="Add a school to give it an admin login." action={<Link href="/owner/schools/new"><Button size="sm"><Plus size={14} />Add school</Button></Link>} />} />
        )}
      </Card>
    </div>
  );
}
