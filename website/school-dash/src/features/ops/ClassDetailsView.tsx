"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BookOpen, Clock, MapPin, School, Users } from "lucide-react";
import { Avatar, Badge, Card, DataTable, EmptyState, Stat, Tabs, type Column } from "@/components/ui";
import type { Cycle, Mark as ExamMark, Paper } from "@/features/exams/types";
import { useAuth } from "@/lib/authContext";
import { useCollection } from "@/lib/useCollection";
import { useNow } from "@/lib/useNow";
import { currentLessons, currentPeriodAttendance, currentPeriodClock, type ClassActivityConfig } from "./classActivity";
import { classExams, classResults, classRoster, classTeachers, classTitle, defaultClassExam, genderCounts, studentHref, teacherHref,
  type ClassAttendanceRecord, type ClassStudent, type ClassTeacher } from "./classDetails";
import { ClassAttendance } from "./ClassAttendance";
import { ClassResults } from "./ClassResults";
import { ClassTeacherCard } from "./ClassTeacherCard";
import { ClassRoomAssignment } from "./ClassRoomAssignment";
import { TeacherPhone } from "./TeacherPhone";
import { UnassignTeacherAction } from "./UnassignTeacherAction";
import { saveClassTeacher } from "./classTeacherService";
import { ClassTimetable, DailyPeriods, TeacherName, type ClassScheduleData } from "./ClassTimetable";
import type { Assignment, ClassRow, Period, Substitution } from "./logic";

const tabItems = [{ id: "overview", label: "Overview" }, { id: "timetable", label: "Timetable" }, { id: "attendance", label: "Attendance" },
  { id: "students", label: "Students" }, { id: "teachers", label: "Teachers" }, { id: "results", label: "Results" }];

export function ClassDetailsView({ classId }: { classId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const canView = Boolean(user?.schoolId && (user.role === "admin" || user.role === "owner"));
  const classes = useCollection<ClassRow>("classes", canView);
  const students = useCollection<ClassStudent>("students", canView);
  const staff = useCollection<ClassTeacher>("staff", canView);
  const assignments = useCollection<Assignment>("assignments", canView);
  const periods = useCollection<Period>("ops_periods", canView);
  const substitutions = useCollection<Substitution>("ops_substitutions", canView);
  const attendance = useCollection<ClassAttendanceRecord>("ops_attendance", canView, [["classId", "==", classId]]);
  const config = useCollection<ClassActivityConfig>("set_config", canView);
  const cycles = useCollection<Cycle>("exm_cycles", canView);
  const papers = useCollection<Paper>("exm_papers", canView);
  const marks = useCollection<ExamMark>("exm_marks", canView, [["classId", "==", classId]]);
  const [tab, setTab] = useState(() => tabItems.find((item) => item.id === params.get("tab"))?.id || "overview");
  const [examId, setExam] = useState("");
  const now = useNow();
  const bell = config.rows.find((row) => row.id === "bell"), regional = config.rows.find((row) => row.id === "regional");
  const clock = useMemo(() => currentPeriodClock(now, bell, regional), [now, bell, regional]);
  const roster = useMemo(() => classRoster(students.rows, classId), [students.rows, classId]);
  const cls = classes.rows.find((row) => row.id === classId);
  const teachers = useMemo(() => cls ? classTeachers(cls, assignments.rows, periods.rows, staff.rows) : [], [cls, assignments.rows, periods.rows, staff.rows]);
  const lesson = useMemo(() => currentLessons(clock, periods.rows, substitutions.rows, staff.rows).get(classId), [clock, periods.rows, substitutions.rows, staff.rows, classId]);
  const present = useMemo(() => currentPeriodAttendance(clock, attendance.rows).get(classId), [clock, attendance.rows, classId]);
  const back = <Link href="/classes" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:underline"><ArrowLeft size={16} aria-hidden="true" />Back to classes</Link>;
  if (!canView || (classes.ready && !cls)) return <div>{back}<Card><EmptyState title="Class record unavailable" hint="The class may have been removed or may not be available to your account." /></Card></div>;
  if (!cls || ![classes, students, staff, assignments, periods, substitutions, attendance, config].every((source) => source.ready)) return <div>{back}<p role="status">Loading class details…</p></div>;
  const genders = genderCounts(roster);
  const examOptions = classExams(cls, cycles.rows, papers.rows);
  const cycle = examOptions.find((row) => row.id === examId) || defaultClassExam(cls, cycles.rows, papers.rows);
  const performance = classResults(cls, roster, cycle, papers.rows, marks.rows);
  const resultsReady = cycles.ready && papers.ready && marks.ready;
  const schedule: ClassScheduleData = { classId, clock, bell, regional, periods: periods.rows, substitutions: substitutions.rows, staff: staff.rows, attendance: attendance.rows };
  const studentColumns: Column<ClassStudent>[] = [
    { key: "name", header: "Student", sortValue: (student) => student.name, render: (student) => <div className="flex items-center gap-3"><Avatar name={student.name} /><div><Link href={studentHref(student.id)} className="font-semibold text-secondary hover:underline" onClick={(event) => event.stopPropagation()}>{student.name}</Link><p className="mt-0.5 text-xs text-on-surface-variant">{student.admissionNumber || student.grn || "Admission number not recorded"}</p></div></div> },
    { key: "roll", header: "Roll number", sortValue: (student) => Number(student.roll) || Infinity, render: (student) => student.roll || "Not assigned" },
    { key: "gender", header: "Gender", render: (student) => student.gender || "Not recorded" },
    { key: "guardian", header: "Guardian", render: (student) => student.guardian || "Not recorded" },
    { key: "phone", header: "Contact", render: (student) => student.phone || "Not recorded" },
  ];
  const teacherColumns: Column<(typeof teachers)[number]>[] = [
    { key: "name", header: "Teacher", sortValue: (teacher) => teacher.name, render: (teacher) => <div className="flex items-center gap-3"><Avatar name={teacher.name} /><div><TeacherName id={teacher.staff?.id} name={teacher.name} />{teacher.id === cls.classTeacherId && <div className="mt-1"><Badge tone="info">Class teacher</Badge></div>}</div></div> },
    { key: "subjects", header: "Subjects in this class", render: (teacher) => teacher.subjects.length ? <div className="flex flex-wrap gap-1.5">{teacher.subjects.map((subject) => <Badge key={subject}>{subject}</Badge>)}</div> : <span className="text-on-surface-variant">No subject assigned in this class</span> },
    { key: "phone", header: "Phone", render: (teacher) => <TeacherPhone teacher={teacher.staff} /> },
    { key: "actions", header: "Actions", render: (teacher) => <UnassignTeacherAction teacher={teacher} cls={cls} staff={staff.rows} assignments={assignments.rows} periods={periods.rows} /> },
  ];

  return <div className="min-w-0">
    {back}
    <Card className="mb-5 flex flex-wrap items-center gap-5 p-5 sm:p-6">
      <div className="grid size-16 shrink-0 place-items-center rounded-lg bg-info-container text-secondary"><School size={30} aria-hidden="true" /></div>
      <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-medium uppercase tracking-wider text-on-surface-variant">Class details</p><h1 className="t-headline-lg break-words">{classTitle(cls)}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-on-surface-variant"><MapPin size={15} aria-hidden="true" />{[cls.room ? `Room ${cls.room}` : "Room not assigned", cls.wing].filter(Boolean).join(" · ")}</p></div>
      <ClassRoomAssignment key={cls.id} cls={cls} classes={classes.rows} onSave={(room) => classes.update(cls.id, { room })} />
    </Card>

    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <Stat label="Total students" value={genders.total} icon={<Users size={16} />} />
      <Stat label="Boys" value={genders.boys} /><Stat label="Girls" value={genders.girls} />
      <Stat label="Present this period" value={clock.state !== "period" ? "—" : present?.state === "marked" ? `${present.present} / ${present.total}` : present ? "Unavailable" : "Not marked"} />
      <Stat label="Pass percentage" value={!resultsReady ? "—" : performance.percentage == null ? "Not available" : `${performance.percentage}%`} sub={cycle ? `${performance.assessed} assessed` : undefined} />
    </div>
    {genders.other > 0 && <p className="mb-4 text-xs text-on-surface-variant">{genders.other} student{genders.other === 1 ? "" : "s"} with another or unrecorded gender included in the total.</p>}

    <div className="mb-5 grid min-w-0 gap-4 lg:grid-cols-2">
      <ClassTeacherCard key={cls.id} cls={cls} classes={classes.rows} staff={staff.rows} onSave={(patch) => saveClassTeacher(cls.id, patch.classTeacherId || "")} />
      <Card role="region" aria-label="Current lesson" className="min-w-0 border-secondary/15 bg-info-container/30 p-5"><h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-on-surface-variant"><Clock size={14} aria-hidden="true" />Current lesson</h2>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-base font-semibold">{clock.state === "period" ? lesson?.conflict ? "Timetable conflict" : lesson?.subject || "No class scheduled" : clock.label}</p>
          {clock.state === "period" && <Badge tone="info">{clock.label}</Badge>}</div>
        {clock.state === "period" && lesson && !lesson.conflict && <p className="mt-1 text-sm text-on-surface-variant">{lesson.substitute ? "Substitute teacher" : "Scheduled teacher"}: <TeacherName id={lesson.teacherId} name={lesson.teacher} /></p>}
        {clock.from && clock.to && <p className="mt-2 text-xs tabular-nums text-on-surface-variant">{clock.from}–{clock.to}</p>}
      </Card>
    </div>

    <Tabs className="mb-5" value={tab} onChange={setTab} items={tabItems.map((item) => ({ ...item, count: item.id === "students" ? roster.length : item.id === "teachers" ? teachers.length : undefined }))} />
    <div role="tabpanel" aria-label={tabItems.find((item) => item.id === tab)?.label}>
      {tab === "overview" && <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
        <Card className="min-w-0 overflow-hidden"><div className="p-5"><h2 className="text-lg font-semibold">Today’s periods</h2><p className="mt-1 text-sm text-on-surface-variant">{clock.date} · {clock.day}</p></div><div className="pb-4"><DailyPeriods data={schedule} date={clock.date} /></div></Card>
        <Card className="min-w-0 self-start p-5"><h2 className="mb-4 text-lg font-semibold">Class information</h2><dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-3 text-sm">
          <dt className="text-on-surface-variant">Class ID</dt><dd className="break-all font-mono text-xs">{cls.id}</dd>
          <dt className="text-on-surface-variant">Room</dt><dd>{cls.room || "Not assigned"}</dd>
          <dt className="text-on-surface-variant">Wing</dt><dd>{cls.wing || "Not recorded"}</dd>
          <dt className="text-on-surface-variant">Capacity</dt><dd>{cls.capacity ?? "Not configured"}</dd>
          <dt className="text-on-surface-variant">Subjects</dt><dd>{new Set([...(cls.subjects ?? []), ...teachers.flatMap((teacher) => teacher.subjects)]).size}</dd>
          <dt className="text-on-surface-variant">Teachers</dt><dd>{teachers.length}</dd>
        </dl><p className="mt-5 flex items-start gap-2 text-xs text-on-surface-variant"><BookOpen size={15} aria-hidden="true" className="shrink-0" />{cycle ? `Pass percentage: ${cycle.title || cycle.short}.` : "No published exam results for this class."}</p></Card>
      </div>}
      {tab === "timetable" && <ClassTimetable data={schedule} cls={cls} initialDate={/^\d{4}-\d{2}-\d{2}$/.test(params.get("date") || "") ? params.get("date")! : undefined} />}
      {tab === "attendance" && <ClassAttendance data={schedule} roster={roster} />}
      {tab === "students" && <Card className="min-w-0 overflow-hidden"><div className="p-5"><h2 className="text-lg font-semibold">Students</h2><p className="mt-1 text-sm text-on-surface-variant">{genders.total} total · {genders.boys} boys · {genders.girls} girls. Select a student to open their profile.</p></div>
        <DataTable rows={roster} columns={studentColumns} pageSize={10} searchText={(student) => `${student.name} ${student.grn || ""} ${student.admissionNumber || ""}`} onRowClick={(student) => router.push(studentHref(student.id))} />
      </Card>}
      {tab === "teachers" && <Card className="min-w-0 overflow-hidden"><div className="p-5"><h2 className="text-lg font-semibold">Teachers</h2><p className="mt-1 text-sm text-on-surface-variant">The class teacher and teachers assigned through class subjects or the weekly timetable.</p></div>
        <DataTable rows={teachers} columns={teacherColumns} pageSize={10} searchText={(teacher) => `${teacher.name} ${teacher.subjects.join(" ")}`} onRowClick={(teacher) => { if (teacher.staff) router.push(teacherHref(teacher.staff.id)); }} />
      </Card>}
      {tab === "results" && <ClassResults cycles={examOptions} cycle={cycle} result={performance} ready={resultsReady} onSelect={setExam} />}
    </div>
  </div>;
}
