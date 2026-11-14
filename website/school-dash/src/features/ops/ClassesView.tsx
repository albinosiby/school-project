"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, MapPin, Plus, School, Search, UserRound, Wand2 } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Select, Stat, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { CLASS_GRADES, SECTIONS, activeStudent, classIdOf, clsLabel, studentClassId, teachingStaff, type StaffRef } from "./shared";
import { validateClass, type Assignment, type AttRec, type ClassRow, type Period, type Substitution } from "./logic";
import { currentLessons, currentPeriodAttendance, currentPeriodClock, type ClassActivityConfig, type CurrentLesson, type PeriodClock } from "./classActivity";
import { classStream, isSeniorGrade, SENIOR_STREAMS, streamFromClassId, streamName } from "@/lib/academicStreams";
import { classDetailsHref } from "./classDetails";
import { saveClassTeacher } from "./classTeacherService";

export type { Assignment, ClassRow } from "./logic";
type Stu = { id: string; classId?: string; grade: string; section: string; streamId?: string; status?: string; deleted?: boolean };

const gradeLabel = (grade: string) => /^\d+$/.test(grade) ? `Grade ${grade}` : grade;
const streamOf = (c: ClassRow) => c.stream || streamName(classStream(c) || streamFromClassId(c.id));
const label = (c: ClassRow) => !c.grade ? clsLabel(c.id) : streamOf(c)
  ? [gradeLabel(c.grade), streamOf(c), c.section].filter(Boolean).join(" · ")
  : [gradeLabel(c.grade), c.section].filter(Boolean).join("-");
const compareGrades = (a: string, b: string) => {
  const order = (grade: string) => grade === "LKG" ? -2 : grade === "UKG" ? -1 : Number(grade);
  return order(a) - order(b) || a.localeCompare(b, undefined, { numeric: true });
};
const PAGE_SIZE = 12;

/**
 * classes + assignments (data contract section 3). The teacher app reads both to decide which classes a teacher sees;
 * a classTeacherId change or a new assignment notifies that teacher (section 10). `classTeacher` (name) is written next
 * to classTeacherId (section 13.1; the backend also keeps it in sync).
 */
export function ClassesView() {
  const toast = useToast();
  const classes = useCollection<ClassRow>("classes");
  const asg = useCollection<Assignment>("assignments");
  const staffRecords = useCollection<StaffRef>("staff");
  const staff = staffRecords.rows;
  const studentRecords = useCollection<Stu>("students");
  const students = studentRecords.rows;
  const config = useCollection<ClassActivityConfig>("set_config");
  const periods = useCollection<Period>("ops_periods");
  const substitutions = useCollection<Substitution>("ops_substitutions");
  const attendance = useCollection<AttRec>("ops_attendance");
  const now = useNow();
  const clock = useMemo(() => currentPeriodClock(now, config.rows.find((row) => row.id === "bell"),
    config.rows.find((row) => row.id === "regional")), [now, config.rows]);
  const lessons = useMemo(() => currentLessons(clock, periods.rows, substitutions.rows, staff), [clock, periods.rows, substitutions.rows, staff]);
  const present = useMemo(() => currentPeriodAttendance(clock, attendance.rows), [clock, attendance.rows]);
  const activityReady = config.ready && periods.ready && substitutions.ready && attendance.ready && staffRecords.ready;
  function presentLabel(classId: string) {
    if (!activityReady || clock.state !== "period") return "—";
    const count = present.get(classId);
    return !count ? "Not marked" : count.state === "marked" ? `${count.present} / ${count.total}` : "Unavailable";
  }
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [page, setPage] = useState(0);
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const nameOf = (id?: string) => staff.find((s) => s.id === id)?.name ?? "";
  const roster = useMemo(() => students.filter(activeStudent), [students]);
  const studentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const student of roster) {
      const id = studentClassId(student);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return counts;
  }, [roster]);
  const subjectCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const assignment of asg.rows) counts.set(assignment.classId, (counts.get(assignment.classId) ?? 0) + 1);
    return counts;
  }, [asg.rows]);
  const sorted = useMemo(() => [...classes.rows].sort((a, b) => compareGrades(a.grade, b.grade)
    || streamOf(a).localeCompare(streamOf(b)) || (a.section ?? "").localeCompare(b.section ?? "")), [classes.rows]);
  const grades = [...new Set(classes.rows.map((row) => row.grade))].sort(compareGrades);
  const search = query.trim().toLowerCase();
  const view = sorted.filter((row) => (!grade || row.grade === grade) && (!search || [
    label(row), row.id, nameOf(row.classTeacherId) || row.classTeacher, row.room, row.wing,
  ].filter(Boolean).join(" ").toLowerCase().includes(search)));
  const pages = Math.max(1, Math.ceil(view.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = view.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const filtered = Boolean(query || grade);
  function clearFilters() { setQuery(""); setGrade(""); setPage(0); }

  /** classes that exist in the roster but not yet in the classes collection */
  const missing = useMemo(() => {
    const have = new Set(classes.rows.map((c) => c.id));
    const found = new Map<string, { grade: string; section: string }>();
    roster.forEach((s) => { const id = studentClassId(s); if (!have.has(id) && /^cls_\d+[A-D]$/.test(id)) found.set(id, { grade: s.grade, section: String(s.section).toUpperCase() }); });
    return [...found].map(([id, v]) => ({ id, ...v }));
  }, [classes.rows, roster]);

  const [generating, setGenerating] = useState(false);
  async function generate() {
    setGenerating(true);
    try { await Promise.all(missing.map((m) => classes.create({ id: m.id, grade: m.grade, section: m.section, classTeacherId: "", classTeacher: "", room: "", wing: "" } as never))); toast(`${missing.length} classes created`); }
    catch { toast("Could not create classes", "error"); } finally { setGenerating(false); }
  }

  return (
    <div>
      <PageHeader title="Classes & Assignments" subtitle="View class teachers, students and current classroom activity."
        actions={<><Button variant="outline" disabled={!classes.ready} onClick={() => setAdding(true)}><Plus size={16} />Add class</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Classes" value={classes.ready ? classes.rows.length : "—"} />
        <Stat label="Without class teacher" value={classes.ready ? classes.rows.filter((c) => !c.classTeacherId).length : "—"} subTone="warning" sub={classes.ready && classes.rows.some((c) => !c.classTeacherId) ? "Needs assignment" : undefined} />
        <Stat label="Subject assignments" value={asg.ready ? asg.rows.length : "—"} />
      </div>
      {missing.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-info-container p-3 text-sm text-secondary">
          <Wand2 size={16} />{missing.length} class-section{missing.length > 1 ? "s" : ""} in the student roster {missing.length > 1 ? "have" : "has"} no class record.
          <Button size="sm" className="ml-auto" disabled={generating} onClick={generate}>{generating ? "Creating…" : "Create them"}</Button>
        </div>)}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-4">
        <div className="relative min-w-0 flex-1 basis-64">
          <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <Input type="search" aria-label="Search classes" placeholder="Search class, teacher or room…" className="pl-9" value={query}
            onChange={(event) => { setQuery(event.target.value); setPage(0); }} />
        </div>
        <Select aria-label="Filter by grade" className="w-full sm:w-44" value={grade}
          onChange={(event) => { setGrade(event.target.value); setPage(0); }}>
          <option value="">All grades</option>
          {grades.map((value) => <option key={value} value={value}>{gradeLabel(value)}</option>)}
        </Select>
        <Button variant="ghost" disabled={!filtered} onClick={clearFilters}>Clear filters</Button>
      </Card>
      {!classes.ready ? <Card className="p-5"><p role="status" className="text-on-surface-variant">Loading classes…</p></Card> : <>
        <p role="status" className="mb-3 text-sm text-on-surface-variant">{view.length} of {classes.rows.length} classes</p>
        {visible.length === 0 ? <Card><EmptyState title={classes.rows.length ? "No classes match" : "No classes yet"}
          hint={classes.rows.length ? "Try changing your search or grade filter." : "Add a class or create them from the student roster."} /></Card> :
          <ul aria-label="Classes" className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((c) => {
              const teacher = staffRecords.ready ? nameOf(c.classTeacherId) || c.classTeacher : "";
              const count = activityReady && clock.state === "period" ? present.get(c.id) : undefined;
              const marked = count?.state === "marked";
              return <li key={c.id} className="min-w-0">
              <Card role="article" aria-label={label(c)} className="group relative flex h-full min-w-0 flex-col overflow-hidden transition-[border-color,box-shadow] duration-200 hover:border-secondary/30 hover:shadow-md motion-reduce:transition-none">
                <Link href={classDetailsHref(c.id)} aria-label={`View ${label(c)} details`} className="absolute inset-0 z-10 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-secondary" />
                <div className="border-b border-outline-variant/40 bg-surface-container-low/50 px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-md border border-secondary/10 bg-surface-container-lowest text-secondary"><School size={21} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <h2 className="break-words text-xl font-semibold tracking-tight">{gradeLabel(c.grade)}</h2>
                        {streamOf(c) && <p className="mt-0.5 break-words text-xs text-on-surface-variant">{streamOf(c)}</p>}
                      </div>
                    </div>
                    <Badge tone="info" className="mt-1 shrink-0 px-2.5 py-1">Section {c.section || "—"}</Badge>
                  </div>
                  <p className="mt-3 flex items-start gap-1.5 text-xs text-on-surface-variant"><MapPin size={13} aria-hidden="true" className="mt-0.5 shrink-0" />
                    <span className="break-words">{c.room ? `Room ${c.room}` : "Room not assigned"}{c.wing && ` · ${c.wing}`}</span></p>
                </div>
                <div className="flex flex-1 flex-col gap-4 p-5">
                  <div className="flex items-center gap-3">
                    {teacher ? <Avatar name={teacher} size={36} className="bg-surface-container-low" /> :
                      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-container-low text-outline"><UserRound size={17} /></span>}
                    <dl className="min-w-0 text-sm"><dt className="text-xs text-on-surface-variant">Class teacher</dt>
                      <dd className={`mt-0.5 break-words font-medium ${teacher ? "text-on-surface" : "text-on-surface-variant"}`}>{staffRecords.ready ? teacher || "Not assigned" : "Loading…"}</dd></dl>
                  </div>
                  <CurrentPeriodDetails clock={clock} lesson={lessons.get(c.id)} ready={activityReady} />
                  <dl className="mt-auto grid grid-cols-3 divide-x divide-outline-variant/40 border-t border-outline-variant/40 pt-4">
                    <div className="min-w-0 pr-3"><dt className="min-h-8 text-xs leading-4 text-on-surface-variant">Students</dt>
                      <dd className="mt-1 text-2xl font-semibold leading-7 tabular-nums">{studentRecords.ready ? studentCounts.get(c.id) ?? 0 : "—"}</dd></div>
                    <div className="min-w-0 px-3"><dt className="min-h-8 text-xs leading-4 text-on-surface-variant">Present</dt>
                      <dd className={`mt-1 font-semibold tabular-nums ${marked ? "text-success" : "text-on-surface-variant"}`}>
                        {marked ? <><span className="text-2xl leading-7">{count.present}</span><span className="text-xs font-medium"> / {count.total}</span></> :
                          <span className={clock.state === "period" && activityReady ? "block text-xs leading-7" : "text-2xl leading-7"}>{presentLabel(c.id)}</span>}
                      </dd></div>
                    <div className="min-w-0 pl-3"><dt className="min-h-8 text-xs leading-4 text-on-surface-variant">Subjects assigned</dt>
                      <dd className="mt-1 text-2xl font-semibold leading-7 tabular-nums">{asg.ready ? subjectCounts.get(c.id) ?? 0 : "—"}</dd></div>
                  </dl>
                </div>
              </Card>
            </li>; })}
          </ul>}
        {pages > 1 && <nav aria-label="Class pages" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
          <span>Showing {currentPage * PAGE_SIZE + 1}–{Math.min(view.length, (currentPage + 1) * PAGE_SIZE)} of {view.length} classes</span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
            <Button size="sm" variant="outline" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
          </div>
        </nav>}
      </>}
      {adding && <AddClass classes={classes.rows} nameOf={nameOf} onClose={() => setAdding(false)} teachers={teachers}
        onSave={async (v) => { try { await saveClassTeacher(classIdOf(v.grade, v.section, v.streamId), v.classTeacherId,
          { grade: v.grade, section: v.section, room: v.room, wing: v.wing, ...(isSeniorGrade(v.grade) ? { streamId: v.streamId, stream: streamName(v.streamId) } : {}) }); toast("Class added"); setAdding(false); } catch (error) { toast(error instanceof Error ? error.message : "Save failed", "error"); } }} />}
    </div>
  );
}

function CurrentPeriodDetails({ clock, lesson, ready }: { clock: PeriodClock; lesson?: CurrentLesson; ready: boolean }) {
  const active = ready && clock.state === "period" && lesson && !lesson.conflict;
  return <section aria-label="Current period" className={`rounded-md border p-3.5 text-sm ${active ? "border-secondary/15 bg-info-container/50" : "border-outline-variant/40 bg-surface-container-low/50"}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className={`flex items-center gap-1.5 text-xs font-medium ${active ? "text-secondary" : "text-on-surface-variant"}`}><Clock size={14} aria-hidden="true" />Current period</p>
      {ready && clock.state === "period" && <Badge tone={active ? "info" : "neutral"}>{clock.label}</Badge>}
    </div>
    {!ready ? <p role="status" className="mt-3 text-on-surface-variant">Loading…</p> : <>
      {clock.state !== "period" && <p className="mt-3 font-medium text-on-surface-variant">{clock.label}</p>}
      {clock.state === "period" && (lesson?.conflict ? <p className="mt-2 text-warning">Timetable conflict</p> :
        <dl className="mt-3 space-y-2.5">
          <div><dt className="sr-only">Subject</dt><dd className="break-words text-base font-semibold leading-6">{lesson?.subject || "No class scheduled"}</dd></div>
          {lesson && <div><dt className="text-xs text-on-surface-variant">{lesson.substitute ? "Substitute teacher" : "Scheduled teacher"}</dt>
            <dd className="mt-0.5 break-words font-medium">{lesson.teacher || "Not assigned"}</dd></div>}
        </dl>)}
      {clock.from && clock.to && <p className="mt-2 text-xs tabular-nums text-on-surface-variant">{clock.from}–{clock.to}</p>}
    </>}
  </section>;
}

function AddClass({ classes, teachers, nameOf, onClose, onSave }: { classes: ClassRow[]; teachers: StaffRef[]; nameOf: (id: string) => string; onClose: () => void; onSave: (v: { grade: string; section: string; streamId: string; classTeacherId: string; room: string; wing: string }) => Promise<void> }) {
  const [f, setF] = useState({ grade: "8", section: "A", streamId: "", classTeacherId: "", room: "", wing: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v, ...(k === "grade" ? { streamId: "" } : {}) })); setErr((e) => ({ ...e, [k]: "" })); };
  async function submit() {
    const e = validateClass(f, classes, nameOf);
    setErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try { await onSave({ ...f, room: f.room.trim(), wing: f.wing.trim() }); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="Add class" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Add class"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grade" required error={err.grade}><Select value={f.grade} onChange={(e) => set("grade", e.target.value)}>{CLASS_GRADES.map((g) => <option key={g} value={g}>{gradeLabel(g)}</option>)}</Select></Field>
        {isSeniorGrade(f.grade) && <Field label="Stream" required error={err.streamId}><Select value={f.streamId} onChange={(e) => set("streamId", e.target.value)}><option value="">Select a stream…</option>{SENIOR_STREAMS.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</Select></Field>}
        <Field label="Section" required error={err.section}><Select value={f.section} onChange={(e) => set("section", e.target.value)}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Class teacher" className="sm:col-span-2" error={err.classTeacherId}><Select value={f.classTeacherId} onChange={(e) => set("classTeacherId", e.target.value)}><ClassTeacherOptions classes={classes} teachers={teachers} /></Select></Field>
        <Field label="Room" error={err.room}><Input value={f.room} onChange={(e) => set("room", e.target.value)} /></Field>
        <Field label="Wing"><Input value={f.wing} onChange={(e) => set("wing", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

/** Only unassigned class teachers can be selected; preserve the current class's stored teacher. */
function ClassTeacherOptions({ classes, teachers, current, name }: {
  classes: ClassRow[]; teachers: StaffRef[]; current?: ClassRow; name?: string;
}) {
  const assigned = new Set(classes.map((row) => row.classTeacherId).filter(Boolean));
  const available = teachers.filter((teacher) => teacher.id === current?.classTeacherId || !assigned.has(teacher.id));
  const currentId = current?.classTeacherId;
  return <>
    <option value="">Not assigned</option>
    {currentId && !teachers.some((teacher) => teacher.id === currentId) &&
      <option value={currentId}>{name || current.classTeacher || currentId}</option>}
    {available.map((teacher) => <option key={teacher.id} value={teacher.id}>{teacher.name}</option>)}
  </>;
}
