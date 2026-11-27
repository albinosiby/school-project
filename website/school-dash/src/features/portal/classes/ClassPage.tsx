"use client";
// /me/classes/[classId]: the subject teacher's class page (the teacher app's students_screen.dart, subject view):
// class size, today's register and attendance, shortcuts, the roster (search, sort, each student's profile) and the
// teacher's own homework of the class. The class-teacher tools live on /me/classes/[classId]/manage.
import Link from "next/link";
import { useState } from "react";
import { CalendarCheck, ChevronRight, ClipboardList, GraduationCap, LayoutDashboard, Plus, Users } from "lucide-react";
import { Avatar, Badge, Button, LoadingSkeleton, PageHeader, SearchBox, Select } from "@/components/ui";
import { classIdLabel, todayIso } from "../teaching";
import { useClassData } from "./data";
import { classDays, classHomework, codeOf, countsOf, handIns, homeworkState, overallRate, pct0, pct1, registerOn, standings, type Standing } from "./logic";
import { BackLink, ButtonLink, Kpi, MarkBadge, Notice, Section } from "./ui";

const SORTS = ["Roll number", "Name", "Attendance (low first)"] as const;

export function ClassPage({ classId }: { classId: string }) {
  const c = useClassData(classId, { homework: true });
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<(typeof SORTS)[number]>("Roll number");
  const [all, setAll] = useState(false);
  const label = classIdLabel(classId);
  const back = { href: "/me/classes", label: "My classes" };

  if (!c.data.teaching) return <Notice title="Only teachers have classes" hint="Your account is not a teaching account." />;
  if (!c.ready) return <LoadingSkeleton variant="page" label="Loading the class…" />;
  if (!c.mine || !c.cls) return <Notice back={back} title="This class is not one of yours" hint="You can open classes you teach or are class teacher of." />;

  const today = todayIso();
  const reg = registerOn(c.records, today);
  const counts = reg ? countsOf(reg) : null;
  const rate = overallRate(classDays(c.records));
  const rows = standings(c.roster, c.records, []);
  const low = rows.filter((r) => r.attendance != null && r.attendance < c.minimum);
  const needle = q.trim().toLowerCase();
  const shown = rows.filter(({ student: s }) => !needle || [s.name, String(s.roll ?? ""), s.grn, s.admissionNumber].some((v) => String(v ?? "").toLowerCase().includes(needle)))
    .sort((a, b) => sort === "Name" ? a.student.name.localeCompare(b.student.name)
      : sort === "Attendance (low first)" ? (a.attendance ?? 101) - (b.attendance ?? 101) : 0);
  const homework = classHomework(c.homework, classId, today, c.data.staffId);
  const open = homework.filter((h) => homeworkState(h, today) !== "closed");
  const toGrade = homework.reduce((s, h) => s + handIns(h).toGrade, 0);

  return <div className="space-y-5">
    <BackLink href={back.href}>{back.label}</BackLink>
    <PageHeader title={`Class ${label}`} subtitle={c.subjects.length ? `You teach ${c.subjects.join(", ")}${c.classTeacher ? " · you are the class teacher" : ""}` : c.classTeacher ? "You are the class teacher" : "Your class"}
      actions={c.classTeacher ? <ButtonLink href={`/me/classes/${classId}/manage`}><LayoutDashboard size={16} />Manage class</ButtonLink> : undefined} />

    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Kpi label="Students" value={String(c.roster.length)} sub={c.cls.room ? `Room ${c.cls.room}` : "Active roster"} icon={<Users size={16} />} />
      <Kpi label="Today" value={counts ? `${counts.present + counts.late}/${counts.total}` : "—"} sub={counts ? `${counts.absent} absent · P${reg!.period}` : "Not marked yet"} tone={counts ? "neutral" : "bad"} icon={<CalendarCheck size={16} />} />
      <Kpi label="Attendance" value={pct1(rate)} sub={rate == null ? "No registers yet" : low.length ? `${low.length} below ${c.minimum}%` : `All above ${c.minimum}%`} tone={rate != null && rate < c.minimum ? "bad" : "neutral"} icon={<GraduationCap size={16} />} />
      <Kpi label="Homework" value={String(open.length)} sub={toGrade ? `${toGrade} to grade` : "open"} icon={<ClipboardList size={16} />} />
    </div>

    <div className="flex flex-wrap gap-2">
      <ButtonLink href="/me/attendance"><CalendarCheck size={16} />{counts ? "Attendance" : "Mark attendance"}</ButtonLink>
      <ButtonLink href="/me/homework"><ClipboardList size={16} />Homework</ButtonLink>
      <ButtonLink href="/me/marks"><GraduationCap size={16} />Marks</ButtonLink>
    </div>

    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <Section title="Students" subtitle={`${c.roster.length} in class ${label}`}>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <SearchBox value={q} onChange={setQ} placeholder="Search name, roll or admission no." className="flex-1" />
          <Select aria-label="Sort students" value={sort} onChange={(e) => setSort(e.target.value as (typeof SORTS)[number])} className="sm:w-52">
            {SORTS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </div>
        {!shown.length ? <p className="py-6 text-center text-sm text-on-surface-variant">{c.roster.length ? "No one matches" : "No students yet"}</p>
          : <ul className="divide-y divide-outline-variant/40" aria-label={`Students of ${label}`}>
            {shown.map((r) => <StudentRow key={r.student.id} r={r} classId={classId} code={reg ? codeOf(reg, r.student.id) : null} minimum={c.minimum} />)}
          </ul>}
      </Section>

      <Section title="Assignments" subtitle={homework.length ? `${open.length} open${toGrade ? ` · ${toGrade} to grade` : ""}` : "Nothing set yet"}
        actions={<ButtonLink href="/me/homework" variant="primary" size="sm"><Plus size={14} />New</ButtonLink>}>
        {!homework.length ? <p className="text-sm text-on-surface-variant">Post an assignment and parents get it in the parent app, where they can hand in photos or PDFs.</p>
          : <ul className="space-y-2" aria-label="Assignments">
            {(all ? homework : homework.slice(0, 5)).map((h) => {
              const hi = handIns(h), state = homeworkState(h, today);
              return <li key={h.id} className="rounded-md border border-outline-variant/50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0"><p className="truncate font-medium">{h.title}</p><p className="text-xs text-on-surface-variant">{h.subject}{h.due ? ` · due ${h.due.slice(0, 10)}` : ""}</p></div>
                  {state === "scheduled" ? <Badge tone="info">Scheduled</Badge> : state === "closed" ? <Badge>Closed</Badge> : <Badge tone="success">Open</Badge>}
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-on-surface-variant">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-secondary" style={{ width: `${hi.total ? (hi.turnedIn * 100) / hi.total : 0}%` }} /></div>
                  <span className="tabular-nums">{hi.turnedIn}/{hi.total} turned in</span>
                </div>
              </li>;
            })}
          </ul>}
        {!all && homework.length > 5 && <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setAll(true)}>Show all {homework.length}</Button>}
      </Section>
    </div>
  </div>;
}

function StudentRow({ r, classId, code, minimum }: { r: Standing; classId: string; code: ReturnType<typeof codeOf> | null; minimum: number }) {
  const s = r.student;
  const low = r.attendance != null && r.attendance < minimum;
  return <li>
    <Link href={`/me/classes/${classId}/students/${s.id}`} className="flex items-center gap-3 rounded-md px-1 py-2.5 transition hover:bg-surface-container-low" aria-label={s.name}>
      <Avatar name={s.name} size={36} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{s.name}</p>
        <p className="truncate text-xs text-on-surface-variant">{[s.roll ? `Roll ${String(s.roll).padStart(2, "0")}` : "No roll no.", s.grn || s.admissionNumber ? `Adm ${s.grn || s.admissionNumber}` : ""].filter(Boolean).join(" · ")}</p>
      </div>
      {code && code !== "P" && <MarkBadge code={code} />}
      <span className={low ? "text-sm font-semibold text-error tabular-nums" : "text-sm font-semibold text-success tabular-nums"}>{pct0(r.attendance)}</span>
      <ChevronRight size={18} className="text-outline" />
    </Link>
  </li>;
}
