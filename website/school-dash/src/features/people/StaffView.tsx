"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CalendarOff, Plus, UserCheck } from "lucide-react";
import { LoadingSkeleton, Badge, Button, Card, DataTable, EmptyState, Field, PageHeader, Select, SlideOver, Stat, Tabs, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { fmtDate } from "@/lib/format";
import { localDate } from "./checkins";
import { useNow } from "@/lib/useNow";
import { type StaffLeave } from "./leaves";
import { effectiveStatus } from "./staffLogic";

import { useAuth } from "@/lib/authContext";
import { assignableStaffRoles } from "@/lib/staffRoles";
import { DirectoryToolbar, type DirectoryFilter } from "./DirectoryToolbar";
import { StaffDirectoryPortrait, StaffPortrait } from "./StaffPortrait";
import { isTeachingStaff, staffSubjects } from "./staffProfiles";

const StaffLeavesPanel = dynamic(() => import("./StaffLeavesPanel").then((module) => module.StaffLeavesPanel), { loading: () => <LoadingSkeleton variant="table" label="Loading leave requests…" /> });
const CheckinsPanel = dynamic(() => import("./CheckinsPanel").then((module) => module.CheckinsPanel), { loading: () => <LoadingSkeleton variant="table" label="Loading check-ins…" /> });
const StaffProfileForm = dynamic(() => import("./StaffProfileForm").then((module) => module.StaffProfileForm), { loading: () => <LoadingSkeleton variant="form" label="Loading staff form…" /> });

export type Staff = { id: string; name: string; empId: string; department: string; departmentId?: string; role: string; status: string; phone: string; email?: string; authUid?: string; staffRole?: string; crewId?: string; designation?: string; subjects?: string; subjectNames?: string[]; joined?: string; leaveFrom?: string; leaveTo?: string; leaveReason?: string; category?: string; profileVersion?: number };
const staffDetailsHref = (staffId: string) => `/staff/${encodeURIComponent(staffId)}`;
const staffAssignments = (staff: Staff) => isTeachingStaff(staff) ? staffSubjects(staff) : [staff.department].filter(Boolean);

export function StaffView() {
  const { user } = useAuth();
  const assignableRoles = assignableStaffRoles(user);
  const canManageProfiles = user?.role === "admin";
  const staff = useCollection<Staff>("staff");
  const { rows, ready } = staff;
  const [q, setQ] = useState(""); const [assignment, setAssignment] = useState(""); const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterCount = [category, assignment, status].filter(Boolean).length;

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
  const leaveIndex = useMemo(() => {
    const byStaff = new Map<string, StaffLeave[]>();
    let pending = 0;
    for (const leave of leaves) {
      const personal = byStaff.get(leave.staffId) ?? [];
      personal.push(leave); byStaff.set(leave.staffId, personal);
      if (leave.status === "Pending") pending++;
    }
    return { byStaff, pending };
  }, [leaves]);
  const pendingLeaves = leaveIndex.pending;
  const now = useNow();
  const today = localDate(new Date(now));

  const pendingRegs = useCollection<{ id: string; status: string }>("staff_regularizations").rows.filter((r) => r.status === "Pending").length;

  const indexed = useMemo(() => rows.map((member) => {
    const teaching = isTeachingStaff(member);
    const uniqueAssignments = new Map<string, string>();
    for (const raw of staffAssignments(member)) {
      const value = raw.trim().replace(/\s+/g, " ");
      if (value && !uniqueAssignments.has(value.toLowerCase())) uniqueAssignments.set(value.toLowerCase(), value);
    }
    const assignments = [...uniqueAssignments.values()];
    return { member, teaching, assignments, assignmentKeys: assignments.map((value) => value.toLowerCase()),
      status: effectiveStatus(member, leaveIndex.byStaff.get(member.id) ?? [], today),
      search: [member.name, member.empId, member.role, member.designation, member.phone, member.phone?.replace(/\D/g, ""), member.email, ...assignments].filter(Boolean).join(" ").toLowerCase() };
  }), [rows, leaveIndex, today]);
  const byId = useMemo(() => new Map(indexed.map((row) => [row.member.id, row])), [indexed]);
  const statusOf = (member: Staff) => byId.get(member.id)!.status;
  const counts = useMemo(() => indexed.reduce((total, row) => ({
    teaching: total.teaching + Number(row.teaching), active: total.active + Number(row.status.status === "Active"),
    onLeave: total.onLeave + Number(row.status.status === "On leave"),
  }), { teaching: 0, active: 0, onLeave: 0 }), [indexed]);
  const search = q.trim().toLowerCase();
  const view = useMemo(() => indexed.filter((row) => (!category || (row.teaching ? "Teaching" : "Non-Teaching") === category)
    && (!assignment || row.assignmentKeys.includes(assignment)) && (!status || row.status.status === status)
    && (!search || row.search.includes(search))).map((row) => row.member), [indexed, category, assignment, status, search]);
  const assignmentChoices = useMemo(() => {
    const choices = new Map<string, string>();
    for (const row of indexed) {
      if (category && (row.teaching ? "Teaching" : "Non-Teaching") !== category) continue;
      for (const value of row.assignments) if (!choices.has(value.toLowerCase())) choices.set(value.toLowerCase(), value);
    }
    return [...choices].sort((a, b) => a[1].localeCompare(b[1]));
  }, [indexed, category]);
  const statuses = [...new Set(indexed.map((row) => row.status.status))].sort();
  const filters: DirectoryFilter[] = [
    ...(category ? [{ key: "category", label: category, remove: () => { setCategory(""); setAssignment(""); } }] : []),
    ...(assignment ? [{ key: "assignment", label: assignmentChoices.find(([key]) => key === assignment)?.[1] ?? assignment, remove: () => setAssignment("") }] : []),
    ...(status ? [{ key: "status", label: status, remove: () => setStatus("") }] : []),
  ];

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
    { key: "assignment", header: "Subject / Department", sortValue: (s) => byId.get(s.id)!.assignments.join(", "),
      render: (s) => byId.get(s.id)!.assignments.join(", ") || "—" },
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
      <div className="mb-5 grid grid-cols-3 gap-2 sm:gap-4 [&>div>div:first-child]:min-h-8 sm:[&>div>div:first-child]:min-h-0">
        <Stat label="Total staff" value={rows.length} icon={<Briefcase size={16} />} />
        <Stat label="Active today" value={counts.active} icon={<UserCheck size={16} />} />
        <Stat label="On leave" value={counts.onLeave} icon={<CalendarOff size={16} />} />
      </div>
      {tab === "directory" && <div role="group" aria-label="Filter staff by category" className="mb-4 flex flex-wrap gap-2">
        {[
          { value: "", label: "All staff", count: rows.length },
          { value: "Teaching", label: "Teaching", count: counts.teaching },
          { value: "Non-Teaching", label: "Non-Teaching", count: rows.length - counts.teaching },
        ].map((item) => <button key={item.value} type="button" aria-pressed={category === item.value}
          onClick={() => { setCategory(item.value); setAssignment(""); }}
          className={"inline-flex min-h-10 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary "
            + (category === item.value ? "border-secondary bg-info-container text-secondary" : "border-outline-variant bg-surface text-on-surface-variant hover:bg-surface-container-low")}>
          {item.label}<span className="text-xs opacity-80">{item.count}</span>
        </button>)}
      </div>}
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <Tabs className="min-w-0 flex-1" value={tab} onChange={setTab} items={[{ id: "directory", label: "Directory", count: rows.length }, { id: "leaves", label: "Leave requests", count: pendingLeaves }, { id: "checkins", label: "Check-ins", count: pendingRegs }]} />
      </div>
      {tab === "leaves" ? <StaffLeavesPanel staff={rows} /> : tab === "checkins" ? <CheckinsPanel staff={rows} /> : <>
        <Card className="min-w-0">
          <DirectoryToolbar query={q} onQuery={setQ} label="Search staff" placeholder="Search name, ID, phone, email or subject…"
            filters={filters} onFilter={() => setFiltersOpen(true)} onClear={() => { setQ(""); clearFilters(); }}
            result={ready ? `${view.length} of ${rows.length} staff` : ""} />
          {staff.error ? <div role="alert" className="p-5"><p>Could not load staff.</p><Button variant="outline" className="mt-2" onClick={staff.reload}>Retry</Button></div> : ready ? <>
            <DataTable rows={view} columns={cols} pageSize={10} resetKey={JSON.stringify([search, category, assignment, status])}
              onRowClick={canManageProfiles ? (member) => router.push(staffDetailsHref(member.id)) : undefined}
              empty={<EmptyState title={rows.length ? "No staff match" : "No staff yet"} hint={rows.length ? "Try changing your search or filters." : "Add a staff member to get started."} />} />
          </> : <LoadingSkeleton variant="table" label="Loading staff…" className="p-5 text-on-surface-variant" />}
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
                {assignmentChoices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">All statuses</option>
                {statuses.map((item) => <option key={item}>{item}</option>)}
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
