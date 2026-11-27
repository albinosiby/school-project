"use client";
// /me/classes (the teacher app's Classes tab, classes_screen.dart): the class the teacher is class teacher of on top
// (gradient card with today's register, attendance and leave requests, and "Manage class"), then an independent
// "Classes you teach" grid — her own class is listed there too when she teaches a subject in it.
import Link from "next/link";
import { ArrowRight, Award, BookOpen, ChevronRight, ClipboardList, DoorOpen, LayoutDashboard, Users, UserCheck } from "lucide-react";
import { Card, EmptyState, LoadingSkeleton, PageHeader } from "@/components/ui";
import type { AttRec } from "@/features/ops/logic";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, classRoster, todayIso, useTeachingData } from "../teaching";
import {
  classDays, classHomework, classRecords, countsOf, handIns, myClasses, overallRate, pct0, pct1, pendingLeaves, registerOn, subjectCode, teachingClasses,
  type HomeworkDoc, type MyClass, type StudentLeave,
} from "./logic";
import { Hero, HeroStat } from "./ui";

export function MyClasses() {
  const data = useTeachingData();
  const ids = data.classIds.slice(0, 30);
  const ctIds = ids.filter((id) => data.isClassTeacher(id));
  const attendance = useCollection<AttRec>("ops_attendance", data.teaching && ids.length > 0, [["classId", "in", ids]]);
  const leaves = useCollection<StudentLeave>("student_leaves", data.teaching && ctIds.length > 0, [["classId", "in", ctIds]]);
  const homework = useCollection<HomeworkDoc>("ops_homework", data.teaching, [["teacherId", "==", data.staffId]]);

  if (!data.teaching) return <EmptyState title="Only teachers have classes" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  const loading = !data.ready || (ids.length > 0 && !attendance.ready) || (ctIds.length > 0 && !leaves.ready) || !homework.ready;
  if (loading) return <LoadingSkeleton variant="card" label="Loading your classes…" />;

  const classes = myClasses(data.staffId, { assignments: data.assignments, classes: data.classes, periods: data.periods });
  const mine = classes.filter((c) => c.classTeacher);
  const teaching = teachingClasses(classes);
  const today = todayIso();

  return <div className="space-y-6">
    <PageHeader title="My classes" subtitle={`${classes.length} ${classes.length === 1 ? "class" : "classes"}${mine.length ? ` · class teacher of ${mine.map((c) => classIdLabel(c.id)).join(", ")}` : ""}`} />
    {!classes.length && <Card><EmptyState title="No classes yet" hint="Classes appear here once the school assigns you a class, a subject or periods." /></Card>}

    {mine.map((c) => {
      const records = classRecords(attendance.rows, c.id);
      const reg = registerOn(records, today);
      const counts = reg ? countsOf(reg) : null;
      const pending = pendingLeaves(leaves.rows, [c.id]).length;
      const size = classRoster(data.students, c.id).length;
      return <Hero key={c.id} role="region" aria-label={`My class ${classIdLabel(c.id)}`}>
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase"><Award size={13} />Class teacher</span>
        </div>
        <h2 className="mt-3 text-2xl font-semibold">Class {classIdLabel(c.id)}</h2>
        <p className="text-sm text-white/80">{[`${size} students`, c.room ? `Room ${c.room}` : ""].filter(Boolean).join(" · ")}</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <HeroStat label="Today" value={counts ? `${counts.present + counts.late}/${counts.total}` : "Not marked"} warn={!counts} />
          <HeroStat label="Attendance" value={pct1(overallRate(classDays(records)))} />
          <HeroStat label="Leave requests" value={String(pending)} warn={pending > 0} />
        </div>
        <Link href={`/me/classes/${c.id}/manage`} className="mt-4 flex items-center gap-2 rounded-md bg-white px-4 py-3 text-sm font-semibold text-secondary shadow-card transition hover:bg-info-container">
          <LayoutDashboard size={18} /><span className="flex-1">Manage class</span><ArrowRight size={18} />
        </Link>
      </Hero>;
    })}

    {teaching.length > 0 && <section aria-label="Classes you teach">
      <h2 className="mb-3 flex items-center gap-2 t-label-caps text-on-surface-variant">Classes you teach <span className="text-secondary">{teaching.length}</span></h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {teaching.map((c) => <TeachCard key={c.id} c={c} size={classRoster(data.students, c.id).length}
          rate={overallRate(classDays(classRecords(attendance.rows, c.id)))} homework={classHomework(homework.rows, c.id, today, data.staffId).filter((h) => !/^(closed|completed)$/i.test(String(h.status ?? "")))} />)}
      </div>
    </section>}
  </div>;
}

function TeachCard({ c, size, rate, homework }: { c: MyClass; size: number; rate: number | null; homework: HomeworkDoc[] }) {
  const first = homework[0];
  const hi = first ? handIns(first) : null;
  return <Link href={`/me/classes/${c.id}`} aria-label={`Class ${classIdLabel(c.id)}`}
    className="group flex flex-col rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-card transition hover:-translate-y-0.5 hover:border-secondary/40 hover:shadow-pop">
    <div className="flex items-center gap-3">
      <span className="grid size-12 shrink-0 place-items-center rounded-md bg-info-container text-sm font-bold text-secondary">{subjectCode(c.subjects[0])}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Class {classIdLabel(c.id)}</p>
        <p className="truncate text-sm font-medium text-secondary">{c.subjects.length ? c.subjects.join(" · ") : "No subject assigned"}</p>
      </div>
      <ChevronRight size={20} className="text-outline transition group-hover:translate-x-0.5 group-hover:text-secondary" />
    </div>
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-on-surface-variant">
      <span className="inline-flex items-center gap-1"><Users size={14} />{size} students</span>
      {rate != null && <span className="inline-flex items-center gap-1"><UserCheck size={14} />{pct0(rate)} attendance</span>}
      {c.room && <span className="inline-flex items-center gap-1"><DoorOpen size={14} />Room {c.room}</span>}
      {c.classTeacher && <span className="inline-flex items-center gap-1 text-secondary"><Award size={14} />Your class</span>}
    </div>
    {first && hi && <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-2 text-xs">
      <ClipboardList size={14} className="shrink-0 text-on-surface-variant" />
      <span className="min-w-0 flex-1 truncate">{first.title} · {hi.turnedIn}/{hi.total} turned in</span>
      {homework.length > 1 && <span className="font-semibold text-secondary">+{homework.length - 1}</span>}
    </div>}
    {!first && <div className="mt-3 flex items-center gap-2 rounded-md bg-surface-container-low px-3 py-2 text-xs text-on-surface-variant"><BookOpen size={14} />No open homework</div>}
  </Link>;
}
