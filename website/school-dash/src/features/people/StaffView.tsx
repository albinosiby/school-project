"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CalendarOff, ListFilter, Plus, Search, UserCheck } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Select, SlideOver, Stat, Tabs, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { StaffLeavesPanel } from "./StaffLeavesPanel";
import { CheckinsPanel } from "./CheckinsPanel";
import { localDate } from "./checkins";
import { useNow } from "@/lib/useNow";
import { type StaffLeave } from "./leaves";
import { effectiveStatus } from "./staffLogic";

import { useAuth } from "@/lib/authContext";
import { assignableStaffRoles } from "@/lib/staffRoles";
import { legacyStaffDepartments } from "./LegacyStaffForm";
import { StaffProfileForm } from "./StaffProfileForm";
import { StaffDirectoryPortrait, StaffPortrait } from "./StaffPortrait";
import { isTeachingStaff, options, staffSubjects } from "./staffProfiles";

export type Staff = { id: string; name: string; empId: string; department: string; departmentId?: string; role: string; status: string; phone: string; email?: string; authUid?: string; staffRole?: string; crewId?: string; designation?: string; subjects?: string; subjectNames?: string[]; joined?: string; leaveFrom?: string; leaveTo?: string; leaveReason?: string; category?: string; profileVersion?: number };
const staffDetailsHref = (staffId: string) => `/staff/${encodeURIComponent(staffId)}`;
const staffAssignments = (staff: Staff) => isTeachingStaff(staff) ? staffSubjects(staff) : [staff.department].filter(Boolean);

export function StaffView() {
  const { user } = useAuth();
  const assignableRoles = assignableStaffRoles(user);
  const canManageProfiles = user?.role === "admin";
  const { rows, ready } = useCollection<Staff>("staff");
  const [q, setQ] = useState(""); const [assignment, setAssignment] = useState(""); const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchId = useId();
  const filterCount = [category, assignment, status].filter(Boolean).length;

  function toggleSearch() {
    if (searchOpen) setQ("");
    setSearchOpen(!searchOpen);
  }

  function clearFilters() {
    setCategory("");
    setAssignment("");
    setStatus("");
  }

  const [adding, setAdding] = useState(false);
  // deep-linkable: /staff?tab=leaves | /staff?tab=checkins
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab = ["leaves", "checkins"].includes(params.get("tab") ?? "") ? params.get("tab")! : "directory";
  const setTab = (t: string) => router.replace(t === "directory" ? path : `${path}?tab=${t}`, { scroll: false });
  const leaves = useCollection<StaffLeave>("staff_leaves").rows;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const now = useNow();
  const today = localDate(new Date(now));
  const statusOf = (s: Staff) => effectiveStatus(s, leaves, today);
  const pendingRegs = useCollection<{ id: string; status: string }>("staff_regularizations").rows.filter((r) => r.status === "Pending").length;

  const view = rows.filter((s) => (!category || (isTeachingStaff(s) ? "Teaching" : "Non-Teaching") === category)
    && (!assignment || staffAssignments(s).includes(assignment)) && (!status || statusOf(s).status === status)
    && (!q || `${s.name} ${s.empId} ${s.role} ${staffAssignments(s).join(" ")}`.toLowerCase().includes(q.toLowerCase())));

  const cols: Column<Staff>[] = [
    { key: "name", header: "Staff member", sortValue: (s) => s.name, render: (s) => <div className="flex items-center gap-3">
      {canManageProfiles && user.schoolId
        ? <StaffDirectoryPortrait key={JSON.stringify([user.id, user.schoolId, s.id])} staffId={s.id} schoolId={user.schoolId} name={s.name} />
        : <StaffPortrait name={s.name} compact />}
      <div>
        {canManageProfiles ? <Link className="font-semibold text-secondary hover:underline" href={staffDetailsHref(s.id)}
          onClick={(event) => event.stopPropagation()}>{s.name}</Link> : <div className="font-semibold">{s.name}</div>}
        <div className="t-caption font-mono text-outline">{s.empId}</div>
      </div>
    </div> },
    { key: "assignment", header: "Subject / Department", sortValue: (s) => staffAssignments(s).join(", "),
      render: (s) => staffAssignments(s).join(", ") || "—" },
    { key: "role", header: "Role", sortValue: (s) => s.role, render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{s.role}</span> },
    { key: "email", header: "Email / login", sortValue: (s) => s.email ?? "", render: (s) => (
      <div><div className="max-w-[220px] truncate text-sm">{s.email || <span className="text-outline">No email</span>}</div>
        {s.authUid ? <Badge tone="success">Login active</Badge> : s.profileVersion || s.email ? <Badge tone="warning">No login yet</Badge> : <Badge>Email needed</Badge>}</div>) },
    { key: "status", header: "Leave status", sortValue: (s) => statusOf(s).status, render: (s) => { const st = statusOf(s); return st.status === "On leave"
      ? <div><Badge tone="warning">On leave</Badge>{st.until && <div className="t-caption mt-0.5 text-outline">until {fmtDate(st.until)}</div>}</div> : <Badge tone={st.status === "Active" ? "success" : "neutral"}>{st.status}</Badge>; } },
  ];

  return (
    <div>
      <PageHeader title="Staff & HR" subtitle="Faculty and administrative staff records, departments and leave status." actions={canManageProfiles && <Button onClick={() => setAdding(true)}><Plus size={16} />Add Staff</Button>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Total staff" value={rows.length} icon={<Briefcase size={16} />} />
        <Stat label="Active today" value={rows.filter((s) => statusOf(s).status === "Active").length} icon={<UserCheck size={16} />} />
        <Stat label="On leave" value={rows.filter((s) => statusOf(s).status === "On leave").length} icon={<CalendarOff size={16} />} />
      </div>
      {tab === "directory" && <div role="group" aria-label="Filter staff by category" className="mb-4 flex flex-wrap gap-2">
        {[
          { value: "", label: "All staff", count: rows.length },
          { value: "Teaching", label: "Teaching", count: rows.filter(isTeachingStaff).length },
          { value: "Non-Teaching", label: "Non-Teaching", count: rows.filter((member) => !isTeachingStaff(member)).length },
        ].map((item) => <button key={item.value} type="button" aria-pressed={category === item.value}
          onClick={() => setCategory(item.value)}
          className={"inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary "
            + (category === item.value ? "border-secondary bg-info-container text-secondary" : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low")}>
          {item.label}<span className="text-xs opacity-80">{item.count}</span>
        </button>)}
      </div>}
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <Tabs className="min-w-0 flex-1" value={tab} onChange={setTab} items={[{ id: "directory", label: "Directory", count: rows.length }, { id: "leaves", label: "Leave requests", count: pendingLeaves }, { id: "checkins", label: "Check-ins", count: pendingRegs }]} />
        {tab === "directory" && <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" aria-expanded={searchOpen} aria-controls={searchId} onClick={toggleSearch}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-label={filterCount ? `Filter (${filterCount} active)` : "Filter"}
            aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <ListFilter size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Filter</span>
            {filterCount > 0 && <Badge tone="info">{filterCount}</Badge>}
          </Button>
        </div>}
      </div>
      {tab === "leaves" ? <StaffLeavesPanel staff={rows} /> : tab === "checkins" ? <CheckinsPanel staff={rows} /> : <>
        <div id={searchId} hidden={!searchOpen} className="mb-4 max-w-md">
          {searchOpen && <Input type="search" autoFocus aria-label="Search staff" value={q}
            placeholder="Search by name, ID, role, subject or department…" onChange={(event) => setQ(event.target.value)} />}
        </div>
        <Card className="min-w-0">
          {ready ? <>
            <p role="status" className="px-5 py-3 text-sm text-on-surface-variant">{view.length} of {rows.length} staff</p>
            <DataTable rows={view} columns={cols} pageSize={10}
              onRowClick={canManageProfiles ? (member) => router.push(staffDetailsHref(member.id)) : undefined}
              empty={<EmptyState title={rows.length ? "No staff match" : "No staff yet"} hint={rows.length ? "Try changing your search or filters." : "Add a staff member to get started."} />} />
          </> : <p role="status" className="p-5 text-on-surface-variant">Loading staff…</p>}
        </Card>
        <SlideOver open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter staff"
          footer={<>
            <Button variant="ghost" onClick={clearFilters} disabled={filterCount === 0}>Clear filters</Button>
            <Button onClick={() => setFiltersOpen(false)}>Done</Button>
          </>}>
          <div className="grid gap-4">
            <Field label="Subject or department">
              <Select value={assignment} onChange={(event) => setAssignment(event.target.value)}>
                <option value="">All subjects and departments</option>
                {[...new Set([...legacyStaffDepartments, ...rows.flatMap(staffAssignments)])].sort().map((value) => <option key={value}>{value}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {options.employmentStatuses.map((item) => <option key={item}>{item}</option>)}
              </Select>
            </Field>
          </div>
        </SlideOver>
      </>}
      {adding && canManageProfiles && <StaffProfileForm staff={rows} permittedRoles={assignableRoles}
        onClose={() => setAdding(false)} />}
    </div>
  );
}
