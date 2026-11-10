"use client";
import Link from "next/link";
import { studentProfileHref } from "./studentLogic";
import { recordedAttendance, type StudentAttendanceMonth } from "./studentAttendance";
import { useId, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, ListFilter, Plus, Search, UserCheck, Users, TriangleAlert, Percent } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, PageHeader, ProgressBar, Select, SlideOver, Stat, Tabs, type Column } from "@/components/ui";
import { SECTIONS } from "@/features/ops/shared";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/communication/csv";
import { defaultMissingDocuments, useAdmissionDocuments } from "@/features/admissions/admissionDocuments";
import { GuardiansDirectory } from "./GuardiansDirectory";
import { AdmissionForm } from "@/features/admissions/AdmissionForm";
import type { Tone } from "@/components/ui";
import { consentMap, consentState, useSchoolUsers, type Consent, type ConsentState } from "@/lib/parentAccount";
import { StudentLeavesPanel } from "./StudentLeavesPanel";
import { MeetingsPanel } from "./MeetingsPanel";
import { useNow } from "@/lib/useNow";
import { CertificatesPanel } from "./CertificatesPanel";
import { isSeniorGrade, streamFromClassId, streamName } from "@/lib/academicStreams";

export type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number;
  email?: string; dob?: string; gender?: string; academicYear?: string; address?: string; relation?: string; admissionDate?: string; admissionNumber?: string;
  /** contract 3: class id `cls_{grade}{SECTION}` and the integer roll in that class (older rows may lack them) */
  classId?: string; streamId?: string; stream?: string; roll?: number; deleted?: boolean; offerId?: string;
  /** contract 13.1: parent login email and the linked parent auth uids (siblings share a uid) */
  guardianEmail?: string; pendingParentLoginEmail?: string; guardianUids?: string[]; emailGuardianUid?: string; guardianEmailLinkStatus?: "unavailable";
  /** contract 14.2: bus + stop assigned in Transport > Buses (display names kept by the admin web) */
  busId?: string; bus?: string; busStopId?: string; busStop?: string };
const STATUS = ["Active", "Alumni-pending", "Transferred"];
const tone = (s: string): Tone => (s === "Active" ? "success" : s === "Transferred" ? "neutral" : "warning");
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const CONSENT: { v: ConsentState; label: string; tone: Tone }[] = [{ v: "Given", label: "Consent given", tone: "success" }, { v: "Pending", label: "Consent pending", tone: "warning" }, { v: "None", label: "No parent login", tone: "neutral" }];
export function StudentsView({ initialQ = "" }: { initialQ?: string }) {
  const all = useCollection<Student>("students");
  const { ready } = all;
  const documents = useAdmissionDocuments();
  const attendance = useCollection<StudentAttendanceMonth>("par_attendance");
  // soft-deleted rows (contract 2: `deleted: true`) are not shown anywhere
  const rows = useMemo(() => all.rows.filter((s) => s.deleted !== true), [all.rows]);
  const [q, setQ] = useState(initialQ);
  const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [status, setStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const [consent, setConsent] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(Boolean(initialQ));
  const searchId = useId();
  const filterCount = [grade, section, status, consent].filter(Boolean).length;

  function toggleSearch() {
    if (searchOpen) setQ("");
    setSearchOpen(!searchOpen);
  }

  function clearFilters() {
    setGrade("");
    setSection("");
    setStatus("");
    setConsent("");
  }
  // deep-linkable: /students?tab=leaves|meetings|certificates (parent requests)
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab = ["guardians", "leaves", "meetings", "certificates"].find((t) => t === params.get("tab")) ?? "directory";
  const setTab = (t: string) => router.replace(t === "directory" ? path : `${path}?tab=${t}`, { scroll: false });
  const pendingLeaves = useCollection<{ id: string; status?: string; deleted?: boolean }>("student_leaves").rows.filter((l) => !l.deleted && (l.status ?? "Pending").toLowerCase() === "pending").length;
  const now = useNow();
  const bookedMeetings = useCollection<{ id: string; status: string; startMs: number }>("ptm_bookings").rows.filter((b) => b.status === "Scheduled" && b.startMs > now).length;
  const certRequests = useCollection<{ id: string; status: string }>("certificates").rows.filter((c) => c.status === "Requested").length;
  const { users } = useSchoolUsers();
  const consentRows = useCollection<Consent>("consents").rows;
  const consents = useMemo(() => consentMap(consentRows), [consentRows]);
  const cstate = (s: Student) => consentState(s.guardianUids, consents);

  const view = useMemo(() => rows.filter((s) => (!grade || s.grade === grade) && (!section || s.section === section) && (!status || s.status === status) && (!consent || cstate(s) === consent)
    && (!q || `${s.name} ${s.grn} ${s.guardian} ${s.phone}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, grade, section, status, consent, consents]); // eslint-disable-line react-hooks/exhaustive-deps
  const recorded = useMemo(() => recordedAttendance(attendance.rows, rows), [attendance.rows, rows]);
  const pctOf = (student: Student) => recorded.get(student.id)?.pct;
  const percentages = [...recorded.values()].map(({ pct }) => pct);
  const averageAttendance = percentages.length
    ? Math.round(percentages.reduce((sum, pct) => sum + pct, 0) / percentages.length)
    : null;
  const belowThreshold = percentages.filter((pct) => pct < 75).length;

  const cols: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (s) => s.name, render: (s) => (<div className="flex items-center gap-3"><Avatar name={s.name} /><div><Link className="font-semibold text-secondary hover:underline" href={studentProfileHref(s.id)} onClick={(event) => event.stopPropagation()}>{s.name}</Link><div className="t-caption font-mono text-outline">{s.grn}</div></div></div>) },
    { key: "class", header: "Class", sortValue: (s) => (+s.grade || 0) * 10 + (s.section ?? "").charCodeAt(0), render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {s.grade}{isSeniorGrade(s.grade) && (s.stream || streamName(s.streamId || streamFromClassId(s.classId))) ? ` · ${s.stream || streamName(s.streamId || streamFromClassId(s.classId))}` : ""}-{s.section}</span> },
    { key: "guardian", header: "Guardian", sortValue: (s) => s.guardian, render: (s) => <div><div>{s.guardian}</div><div className="t-caption text-outline">{s.phone}</div></div> },
    { key: "parent", header: "Parent app", sortValue: (s) => CONSENT.findIndex((c) => c.v === cstate(s)), render: (s) => { const c = CONSENT.find((x) => x.v === cstate(s))!;
      return <div><Badge tone={c.tone}>{c.label}</Badge>{(s.guardianUids?.length ?? 0) > 1 && <div className="t-caption mt-0.5 text-outline">{s.guardianUids!.length} logins</div>}</div>; } },
    { key: "documents", header: "Documents", render: (student) => {
      const count = documents.missing.get(student.id) ?? defaultMissingDocuments;
      return !documents.ready ? "—" : <Badge tone={count ? "warning" : "success"}>{count} missing</Badge>;
    } },
    { key: "attendance", header: "Attendance", sortValue: (student) => pctOf(student) ?? -1, render: (student) => {
      const pct = pctOf(student);
      if (pct === undefined) return attendance.ready ? "Not recorded" : "—";
      return <div className="flex w-28 items-center gap-2">
        <ProgressBar value={pct} tone={pct >= 75 ? "success" : "danger"} />
        <span className="font-mono text-xs">{pct}%</span>
      </div>;
    } },
    { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => <Badge tone={tone(s.status)}>{s.status}</Badge> },
  ];

  return (
    <div>
      <PageHeader title="Students & Guardians" subtitle="Manage student records, guardian contacts and enrolment status."
        actions={<><Button variant="outline" onClick={() => downloadCsv("students", ["GRN", "Name", "Grade", "Section", "Roll", "Guardian", "Phone", "Status", "Attendance %", "Parent app"], view.map((s) => [s.grn, s.name, s.grade, s.section, s.roll ?? "", s.guardian, s.phone, s.status, pctOf(s) ?? "", CONSENT.find((c) => c.v === cstate(s))!.label]))}><Download size={16} />Export CSV</Button>
          <Button onClick={() => setAdding(true)}><Plus size={16} />Add Student</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={rows.length} icon={<Users size={16} />} />
        <Stat label="Active" value={rows.filter((s) => s.status === "Active").length} icon={<UserCheck size={16} />} />
        <Stat label="Average attendance" value={averageAttendance === null ? "—" : `${averageAttendance}%`} icon={<Percent size={16} />} />
        <Stat label="Below 75% attendance" value={percentages.length ? belowThreshold : "—"} sub={belowThreshold ? "Needs follow-up" : undefined} subTone="danger" icon={<TriangleAlert size={16} />} />
      </div>
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <Tabs className="min-w-0 flex-1" value={tab} onChange={setTab} items={[{ id: "directory", label: "Students", count: rows.length }, { id: "guardians", label: "Guardians" }, { id: "leaves", label: "Leave requests", count: pendingLeaves },
          { id: "meetings", label: "Meetings", count: bookedMeetings }, { id: "certificates", label: "Certificates", count: certRequests }]} />
        {tab === "directory" && <div className="flex shrink-0 gap-2">
          <Button type="button" variant="outline" size="sm" aria-expanded={searchOpen} aria-controls={searchId} onClick={toggleSearch}>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Search</span>
          </Button>
          <Button type="button" variant="outline" size="sm" aria-haspopup="dialog" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(true)}>
            <ListFilter size={16} aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">Filter</span>
            {filterCount > 0 && <Badge tone="info">{filterCount}</Badge>}
          </Button>
        </div>}
      </div>
      {tab === "guardians" ? (ready && documents.ready
        ? <GuardiansDirectory students={rows} users={users} missing={documents.missing} />
        : <p role="status">Loading guardians…</p>) : tab === "leaves" ? <StudentLeavesPanel students={rows} /> : tab === "meetings" ? <MeetingsPanel students={rows} /> : tab === "certificates" ? <CertificatesPanel students={rows} /> :
      <>
        <div id={searchId} hidden={!searchOpen} className="mb-4 max-w-md">
          {searchOpen && <Input type="search" autoFocus aria-label="Search students" value={q}
            placeholder="Search by name, GRN, guardian or phone…" onChange={(event) => setQ(event.target.value)} />}
        </div>
        <Card className="min-w-0">
          {ready ? <>
            <p role="status" className="px-5 py-3 text-sm text-on-surface-variant">{view.length} of {rows.length} students</p>
            <DataTable rows={view} columns={cols} pageSize={10} onRowClick={(student) => router.push(studentProfileHref(student.id))}
              empty={<EmptyState title={rows.length ? "No students match" : "No students yet"} hint={rows.length ? "Try changing your search or filters." : "Add a student to get started."} />} />
          </> : <p role="status" className="p-5 text-on-surface-variant">Loading students…</p>}
        </Card>
        <SlideOver open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter students"
          footer={<>
            <Button variant="ghost" onClick={clearFilters} disabled={filterCount === 0}>Clear filters</Button>
            <Button onClick={() => setFiltersOpen(false)}>Done</Button>
          </>}>
          <div className="grid gap-4">
            <Field label="Grade">
              <Select value={grade} onChange={(e) => setGrade(e.target.value)}>
                <option value="">All grades</option>
                {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </Select>
            </Field>
            <Field label="Section">
              <Select value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">All sections</option>
                {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All statuses</option>
                {STATUS.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Parent consent">
              <Select value={consent} onChange={(e) => setConsent(e.target.value)}>
                <option value="">Any parent status</option>
                {CONSENT.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
              </Select>
            </Field>
          </div>
        </SlideOver>
      </>}

      {adding && <AdmissionForm mode="add" onClose={() => setAdding(false)} />}
    </div>
  );
}
