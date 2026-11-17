"use client";
import Link from "next/link";
import { studentProfileHref } from "./studentLogic";
import { attendanceAcademicRange, recordedAttendance, type StudentAttendanceMonth } from "./studentAttendance";
import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, UserCheck, Users, TriangleAlert, Percent } from "lucide-react";
import { LoadingSkeleton, Avatar, Badge, Button, Card, DataTable, EmptyState, Field, PageHeader, ProgressBar, Select, SlideOver, Stat, Tabs, type Column } from "@/components/ui";
import { todayIso } from "@/features/ops/shared";
import { useCollection } from "@/lib/useCollection";
import { useAttendancePolicy } from "@/lib/useAttendancePolicy";
import { downloadCsv } from "@/features/communication/csv";
import { defaultMissingDocuments, useAdmissionDocuments } from "@/features/admissions/admissionDocuments";
import { DirectoryToolbar, type DirectoryFilter } from "./DirectoryToolbar";
import type { Tone } from "@/components/ui";
import { consentMap, consentState, type Consent, type ConsentState } from "@/lib/parentAccount";
import { useNow } from "@/lib/useNow";
import { classStream, compareGrades, gradeOrder, isSeniorGrade, streamFromClassId, streamName, type AcademicClass } from "@/lib/academicStreams";

const StudentLeavesPanel = dynamic(() => import("./StudentLeavesPanel").then((module) => module.StudentLeavesPanel), { loading: () => <LoadingSkeleton variant="table" label="Loading leave requests…" /> });
const MeetingsPanel = dynamic(() => import("./MeetingsPanel").then((module) => module.MeetingsPanel), { loading: () => <LoadingSkeleton variant="table" label="Loading meetings…" /> });
const GuardiansPanel = dynamic(() => import("./GuardiansDirectory").then((module) => module.GuardiansPanel), { loading: () => <LoadingSkeleton variant="table" label="Loading guardians…" /> });

export type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number;
  email?: string; dob?: string; gender?: string; academicYear?: string; address?: string; relation?: string; admissionDate?: string; admissionNumber?: string;
  /** contract 3: class id `cls_{grade}{SECTION}` and the integer roll in that class (older rows may lack them) */
  classId?: string; streamId?: string; stream?: string; roll?: number; deleted?: boolean; offerId?: string;
  /** contract 13.1: parent login email and the linked parent auth uids (siblings share a uid) */
  guardianEmail?: string; pendingParentLoginEmail?: string; guardianUids?: string[]; emailGuardianUid?: string; guardianEmailLinkStatus?: "unavailable";
  /** contract 14.2: bus + stop assigned in Transport > Buses (display names kept by the admin web) */
  busId?: string; bus?: string; busStopId?: string; busStop?: string; busAssignmentRevision?: number };
const STATUS = ["Active", "Alumni-pending", "Transferred"];
const tone = (s: string): Tone => (s === "Active" ? "success" : s === "Transferred" ? "neutral" : "warning");
const CONSENT: { v: ConsentState; label: string; tone: Tone }[] = [{ v: "Given", label: "Consent given", tone: "success" }, { v: "Pending", label: "Consent pending", tone: "warning" }, { v: "None", label: "No parent login", tone: "neutral" }];
export function StudentsView({ initialQ = "" }: { initialQ?: string }) {
  const all = useCollection<Student>("students");
  const { ready } = all;
  const documents = useAdmissionDocuments();
  const attendance = useCollection<StudentAttendanceMonth>("par_attendance");
  const terms = useCollection<{ id: string; start?: string; end?: string }>("set_terms");
  const attendancePolicy = useAttendancePolicy();
  // soft-deleted rows (contract 2: `deleted: true`) are not shown anywhere
  const rows = useMemo(() => all.rows.filter((s) => s.deleted !== true), [all.rows]);
  const [q, setQ] = useState(initialQ);
  const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [status, setStatus] = useState("");
  const [consent, setConsent] = useState("");
  const [stream, setStream] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const classes = useCollection<AcademicClass>("classes", filtersOpen);
  const filterCount = [grade, section, stream, status, consent].filter(Boolean).length;

  function clearFilters() {
    setGrade("");
    setStream("");
    setSection("");
    setStatus("");
    setConsent("");
  }
  // Deep-linkable student tabs; the page redirects the former certificates tab to /certificates.
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab = ["guardians", "leaves", "meetings"].find((t) => t === params.get("tab")) ?? "directory";
  const setTab = (t: string) => router.replace(t === "directory" ? path : `${path}?tab=${t}`, { scroll: false });
  const pendingLeaves = useCollection<{ id: string; status?: string; deleted?: boolean }>("student_leaves").rows.filter((l) => !l.deleted && (l.status ?? "Pending").toLowerCase() === "pending").length;
  const now = useNow();
  const bookedMeetings = useCollection<{ id: string; status: string; startMs: number }>("ptm_bookings").rows.filter((b) => b.status === "Scheduled" && b.startMs > now).length;
  const consentRows = useCollection<Consent>("consents").rows;
  const consents = useMemo(() => consentMap(consentRows), [consentRows]);
  const indexed = useMemo(() => new Map(rows.map((student) => [student.id, {
    consent: consentState(student.guardianUids, consents),
    stream: classStream(student) || streamFromClassId(student.classId),
    search: [student.name, student.grn, student.guardian, student.phone, student.email, student.guardianEmail,
      student.phone?.replace(/\D/g, "")].filter(Boolean).join(" ").toLowerCase(),
  }])), [rows, consents]);
  const cstate = (student: Student) => indexed.get(student.id)!.consent;
  const search = q.trim().toLowerCase();
  const view = useMemo(() => rows.filter((student) => (!grade || student.grade === grade)
    && (!section || student.section === section) && (!stream || indexed.get(student.id)!.stream === stream)
    && (!status || student.status === status) && (!consent || indexed.get(student.id)!.consent === consent)
    && (!search || indexed.get(student.id)!.search.includes(search))), [rows, search, grade, section, stream, status, consent, indexed]);
  const classChoices = useMemo(() => [...classes.rows.map((row) => ({ ...row, streamId: classStream(row) })),
    ...rows.map((student) => ({ grade: student.grade, section: student.section, streamId: indexed.get(student.id)!.stream }))], [classes.rows, rows, indexed]);
  const gradeChoices = [...new Set(classChoices.map((row) => row.grade).filter(Boolean))].sort(compareGrades);
  const streamChoices = [...new Set(classChoices.filter((row) => !grade || row.grade === grade).map((row) => row.streamId).filter(Boolean))];
  const sectionChoices = [...new Set(classChoices.filter((row) => (!grade || row.grade === grade) && (!stream || row.streamId === stream))
    .map((row) => row.section).filter(Boolean))].sort();
  const filters: DirectoryFilter[] = [
    ...(grade ? [{ key: "grade", label: `Grade ${grade}`, remove: () => { setGrade(""); setStream(""); setSection(""); } }] : []),
    ...(stream ? [{ key: "stream", label: streamName(stream), remove: () => { setStream(""); setSection(""); } }] : []),
    ...(section ? [{ key: "section", label: `Division ${section}`, remove: () => setSection("") }] : []),
    ...(status ? [{ key: "status", label: status, remove: () => setStatus("") }] : []),
    ...(consent ? [{ key: "consent", label: CONSENT.find((choice) => choice.v === consent)!.label, remove: () => setConsent("") }] : []),
  ];
  const academicRange = attendanceAcademicRange(terms.rows);
  const attendanceStart = academicRange?.start;
  const attendanceEnd = academicRange ? (academicRange.end < todayIso() ? academicRange.end : todayIso()) : undefined;
  const recorded = useMemo(() => attendance.ready && terms.ready && attendanceStart && attendanceEnd
    ? recordedAttendance(attendance.rows, rows, { start: attendanceStart, end: attendanceEnd })
    : recordedAttendance([], rows), [attendance.rows, attendance.ready, terms.ready, rows, attendanceStart, attendanceEnd]);
  const attendanceReady = ready && attendance.ready && terms.ready && Boolean(academicRange);
  const pctOf = (student: Student) => attendanceReady ? recorded.get(student.id)?.pct ?? 0 : undefined;
  const summary = useMemo(() => rows.reduce((total, student) => {
    const pct = recorded.get(student.id)?.pct ?? 0;
    return { active: total.active + Number(student.status === "Active"), sum: total.sum + pct,
      below: total.below + Number(pct < attendancePolicy.minimumPercent) };
  }, { active: 0, sum: 0, below: 0 }), [rows, recorded, attendancePolicy.minimumPercent]);
  const averageAttendance = attendanceReady ? (rows.length ? Math.round(summary.sum / rows.length) : 0) : null;
  const belowThreshold = summary.below;

  const cols: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (s) => s.name, render: (s) => (<div className="flex items-center gap-3"><Avatar name={s.name} /><div><Link className="font-semibold text-secondary hover:underline" href={studentProfileHref(s.id)} onClick={(event) => event.stopPropagation()}>{s.name}</Link><div className="t-caption font-mono text-outline">{s.grn}</div></div></div>) },
    { key: "class", header: "Class", sortValue: (s) => gradeOrder(s.grade) * 10 + ((s.section ?? "").charCodeAt(0) || 0), render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {s.grade}{isSeniorGrade(s.grade) && (s.stream || streamName(s.streamId || streamFromClassId(s.classId))) ? ` · ${s.stream || streamName(s.streamId || streamFromClassId(s.classId))}` : ""}-{s.section}</span> },
    { key: "guardian", header: "Guardian", sortValue: (s) => s.guardian, render: (s) => <div><div>{s.guardian}</div><div className="t-caption text-outline">{s.phone}</div></div> },
    { key: "parent", header: "Parent app", sortValue: (s) => CONSENT.findIndex((c) => c.v === cstate(s)), render: (s) => { const c = CONSENT.find((x) => x.v === cstate(s))!;
      return <div><Badge tone={c.tone}>{c.label}</Badge>{(s.guardianUids?.length ?? 0) > 1 && <div className="t-caption mt-0.5 text-outline">{s.guardianUids!.length} logins</div>}</div>; } },
    { key: "documents", header: "Documents", render: (student) => {
      const count = documents.missing.get(student.id) ?? defaultMissingDocuments;
      return !documents.ready ? "—" : <Badge tone={count ? "warning" : "success"}>{count} missing</Badge>;
    } },
    { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => <Badge tone={tone(s.status)}>{s.status}</Badge> },
    { key: "attendance", header: "Attendance %", sortValue: (student) => pctOf(student) ?? -1, render: (student) => {
      const pct = pctOf(student);
      if (attendance.error || terms.error) return "Unavailable";
      if (!attendance.ready || !terms.ready) return "—";
      if (!academicRange) return "Not configured";
      if (pct === undefined) return "—";
      return <div className="flex w-28 items-center gap-2">
        <ProgressBar value={pct} tone={!attendancePolicy.ready ? "muted" : pct >= attendancePolicy.minimumPercent ? "success" : "danger"} />
        <span className="font-mono text-xs">{pct}%</span>
      </div>;
    } },
  ];

  return (
    <div>
      <PageHeader title="Students & Guardians" subtitle="Manage student records, guardian contacts and enrolment status."
        actions={<Button variant="outline" onClick={() => downloadCsv("students", ["GRN", "Name", "Grade", "Section", "Roll", "Guardian", "Phone", "Status", "Attendance %", "Parent app"], view.map((s) => [s.grn, s.name, s.grade, s.section, s.roll ?? "", s.guardian, s.phone, s.status, pctOf(s) ?? "", CONSENT.find((c) => c.v === cstate(s))!.label]))}><Download size={16} />Export CSV</Button>} />
      <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>div>div:first-child]:min-h-8 sm:[&>div>div:first-child]:min-h-0">
        <Stat label="Total students" value={rows.length} icon={<Users size={16} />} />
        <Stat label="Active" value={summary.active} icon={<UserCheck size={16} />} />
        <Stat label="Average attendance" value={averageAttendance === null ? "—" : `${averageAttendance}%`} icon={<Percent size={16} />} />
        <Stat label={attendancePolicy.ready ? `Below ${attendancePolicy.minimumPercent}% attendance` : "Below minimum attendance"}
          value={attendanceReady && attendancePolicy.ready ? belowThreshold : "—"}
          sub={attendancePolicy.ready && belowThreshold ? "Needs follow-up" : undefined} subTone="danger" icon={<TriangleAlert size={16} />} />
      </div>
      <div className="mb-4 flex min-w-0 items-center gap-2">
        <Tabs className="min-w-0 flex-1" value={tab} onChange={setTab} items={[{ id: "directory", label: "Students", count: rows.length }, { id: "guardians", label: "Guardians" }, { id: "leaves", label: "Leave requests", count: pendingLeaves },
          { id: "meetings", label: "Meetings", count: bookedMeetings }]} />
      </div>
      {tab === "guardians" ? (ready && documents.ready
        ? <GuardiansPanel students={rows} missing={documents.missing} />
        : <LoadingSkeleton variant="table" label="Loading guardians…" />) : tab === "leaves" ? <StudentLeavesPanel students={rows} /> : tab === "meetings" ? <MeetingsPanel students={rows} /> :
      <>
        <Card className="min-w-0">
          <DirectoryToolbar query={q} onQuery={setQ} label="Search students" placeholder="Search name, GRN, guardian, phone or email…"
            filters={filters} onFilter={() => setFiltersOpen(true)} onClear={() => { setQ(""); clearFilters(); }}
            result={ready ? `${view.length} of ${rows.length} students` : ""} />
          {all.error ? <div role="alert" className="p-5"><p>Could not load students.</p><Button variant="outline" className="mt-2" onClick={all.reload}>Retry</Button></div> : ready ? <>
            <DataTable rows={view} columns={cols} pageSize={10} resetKey={JSON.stringify([search, grade, stream, section, status, consent])} onRowClick={(student) => router.push(studentProfileHref(student.id))}
              empty={<EmptyState title={rows.length ? "No students match" : "No students yet"} hint={rows.length ? "Try changing your search or filters." : "Add a student through Admissions to get started."} />} />
          </> : <LoadingSkeleton variant="table" label="Loading students…" className="p-5 text-on-surface-variant" />}
        </Card>
        <SlideOver open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filter students"
          footer={<>
            <Button variant="ghost" onClick={clearFilters} disabled={filterCount === 0}>Clear filters</Button>
            <Button onClick={() => setFiltersOpen(false)}>Done</Button>
          </>}>
          <div className="grid gap-4">
            <Field label="Grade">
              <Select value={grade} onChange={(e) => { setGrade(e.target.value); setStream(""); setSection(""); }}>
                <option value="">All grades</option>
                {gradeChoices.map((g) => <option key={g} value={g}>Grade {g}</option>)}
              </Select>
            </Field>
            {streamChoices.length > 0 && <Field label="Stream">
              <Select value={stream} onChange={(event) => { setStream(event.target.value); setSection(""); }}>
                <option value="">All streams</option>{streamChoices.map((value) => <option key={value} value={value}>{streamName(value)}</option>)}
              </Select>
            </Field>}
            <Field label="Section">
              <Select value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">All sections</option>
                {sectionChoices.map((s) => <option key={s} value={s}>{s}</option>)}
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
    </div>
  );
}
