"use client";
// /me/attendance/trends: attendance trends of one of the teacher's classes (teacher app trends_screen.dart): This week /
// month / term / year compared with the period before, the present / late / absent / excused split, every school day as
// a bar in a sideways-scrolling chart, the weekday pattern, and the students sorted by attendance with parent actions.
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Bell, CalendarCheck, History, Lightbulb, Minus, Phone, TrendingDown, TrendingUp, TriangleAlert } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, LoadingSkeleton, Modal, PageHeader, ProgressBar, Select, Tabs } from "@/components/ui";
import type { AttRec } from "@/features/ops/logic";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { classIdLabel, classRoster, useTeachingData, type MobilePolicy } from "../teaching";
import {
  DAY_SHORT, TREND_RANGES, dailyRecords, dialDigits, fmtDay, fmtShort, isoWeekday, minimumOf, previousLabel, recordsOutsideYear, schoolClock,
  studentTrends, trendDays, trendSummary, weekdayExtremes, weekdayRates, workingDaysOf, type Counts, type SchoolPolicy, type StudentTrend, type TrendDay, type TrendRange,
} from "./logic";
import { NotifyParentDialog, useParentNotices, type NotifyStudent } from "./NotifyParentDialog";

type Student = NotifyStudent & { admissionDate?: string; academicAttendance?: { admissionDate?: string } };
const PLURAL = ["Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"];
const pct = (v: number) => `${v.toFixed(1)}%`;

export function AttendanceTrends() {
  const data = useTeachingData();
  const att = useCollection<AttRec>("ops_attendance", data.teaching);
  const params = useSearchParams();
  const policy = data.policy as (MobilePolicy & SchoolPolicy) | undefined;
  const homeClass = data.classes.find((c) => c.classTeacherId === data.staffId && data.classIds.includes(c.id))?.id;
  const [picked, setPicked] = useState(params.get("class") ?? params.get("classId") ?? "");
  const classId = data.classIds.includes(picked) ? picked : homeClass ?? data.classIds[0] ?? "";
  const [range, setRange] = useState<TrendRange>("This month");
  const { today } = schoolClock(policy);
  const minimum = minimumOf(policy);
  const workingDays = workingDaysOf(policy);

  const roster = useMemo(() => classRoster(data.students, classId).map((s) => {
    const st = s as Student;
    return { ...st, admissionDate: st.admissionDate || st.academicAttendance?.admissionDate || undefined };
  }), [data.students, classId]);
  const classRecords = useMemo(() => dailyRecords(att.rows, classId, policy), [att.rows, classId, policy]);
  const summary = useMemo(() => trendSummary(classRecords, range, today, policy), [classRecords, range, today, policy]);
  const students = useMemo(() => studentTrends(summary.records, roster), [summary.records, roster]);
  const outside = recordsOutsideYear(att.rows, classId, policy);

  if (!data.teaching) return <EmptyState title="Only teachers have class attendance" hint="Your account is not a teaching account. Ask the school office if this is wrong." />;
  if (!data.ready || !att.ready) return <LoadingSkeleton variant="page" label="Loading attendance trends…" />;

  const label = classId ? classIdLabel(classId) : "";
  return <div className="space-y-5">
    <PageHeader title="Attendance trends" subtitle={label ? `Class ${label} · ${roster.length} students` : "Pick one of your classes"}
      actions={<Link href="/me/attendance" className="inline-flex h-10 items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold text-secondary hover:bg-surface-container-low">
        <ArrowLeft size={16} />Mark attendance
      </Link>} />
    {!data.classIds.length ? <Card><EmptyState title="No classes yet" hint="Your classes appear here once the school assigns you to one." /></Card> : <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="flex min-w-0 items-center gap-2 text-sm sm:w-64">
          <span className="shrink-0 font-medium text-on-surface-variant">Class</span>
          <Select aria-label="Class" value={classId} onChange={(e) => setPicked(e.target.value)}>
            {data.classIds.map((id) => <option key={id} value={id}>{classIdLabel(id)}{data.isClassTeacher(id) ? " · Class teacher" : ""}</option>)}
          </Select>
        </label>
        <Tabs className="min-w-0" items={TREND_RANGES.map((r) => ({ id: r, label: r }))} value={range} onChange={(id) => setRange(id as TrendRange)} />
      </div>
      {outside > 0 && <p role="note" className="rounded-lg bg-warning-container/30 p-3 text-sm text-on-surface-variant">
        {outside} submitted {outside === 1 ? "register is" : "registers are"} dated outside the academic year the office published, so {outside === 1 ? "it is" : "they are"} not counted here.
      </p>}
      {!summary.records.length
        ? <Card><EmptyState title="No attendance yet" hint={`Nothing was submitted for Class ${label} ${range.toLowerCase()}. Try a longer range.`} /></Card>
        : <>
          <Hero range={range} avg={summary.avg} delta={summary.delta} totals={summary.totals} records={summary.records} minimum={minimum} />
          <DailyChart key={`${classId}|${range}`} days={trendDays(summary.records, summary.window, workingDays)} minimum={minimum} />
          <WeekdayCard records={summary.records} avg={summary.avg} />
          <Students students={students} range={range} minimum={minimum} classLabel={label} records={summary.records}
            ctx={{ staffId: data.staffId, staffName: data.name, classLabel: label, minimum, classes: data.classes, assignments: data.assignments, roleFallback: data.record?.subjects || data.record?.department }} />
        </>}
    </>}
  </div>;
}

function Hero({ range, avg, delta, totals, records, minimum }: { range: TrendRange; avg: number; delta: number | null; totals: Counts; records: AttRec[]; minimum: number }) {
  const low = avg < minimum;
  const flat = delta !== null && Math.abs(delta) < 0.05;
  const r = 30, c = 2 * Math.PI * r;
  return <section aria-label="Class average" className="overflow-hidden rounded-xl bg-gradient-to-br from-secondary to-primary-container p-5 text-on-secondary shadow-card sm:p-6">
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider opacity-75">Class average · {range}</p>
        <p className="mt-1 text-4xl font-bold tabular-nums leading-tight" data-testid="trend-average">{pct(avg)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          {delta === null ? <span className="opacity-75">Nothing recorded {previousLabel(range)} to compare</span> : <>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 font-semibold" data-testid="trend-delta">
              {flat ? <Minus size={13} /> : delta > 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
              {flat ? "Same" : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(1)} pts`}
            </span>
            <span className="opacity-75">vs {previousLabel(range)}</span>
          </>}
        </div>
      </div>
      <div className="relative size-20 shrink-0">
        <svg viewBox="0 0 72 72" className="size-full -rotate-90" aria-hidden>
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" className="stroke-white/20" />
          <circle cx="36" cy="36" r={r} fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(Math.min(100, avg) / 100) * c} ${c}`} className={low ? "stroke-error-container" : "stroke-white"} />
        </svg>
        <span className="absolute inset-0 grid place-items-center">{low ? <TriangleAlert size={22} /> : <BadgeCheck size={22} />}</span>
      </div>
    </div>
    <p className="mt-4 text-xs opacity-85">
      {records.length} {records.length === 1 ? "day" : "days"} recorded · {fmtShort(records[0]!.date)} – {fmtShort(records.at(-1)!.date)} · minimum {minimum}%
    </p>
    <SplitBar t={totals} />
  </section>;
}

const PARTS: { key: keyof Omit<Counts, "total">; label: string; cls: string }[] = [
  { key: "present", label: "Present", cls: "bg-white" },
  { key: "late", label: "Late", cls: "bg-warning" },
  { key: "absent", label: "Absent", cls: "bg-error-container" },
  { key: "excused", label: "Excused", cls: "bg-secondary-fixed-dim" },
];
function SplitBar({ t }: { t: Counts }) {
  const total = t.total || 1;
  return <div className="mt-3">
    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/20" role="img" aria-label={PARTS.map((p) => `${p.label} ${t[p.key]}`).join(", ")}>
      {PARTS.map((p) => t[p.key] > 0 && <span key={p.key} className={p.cls} style={{ width: `${(t[p.key] / total) * 100}%` }} />)}
    </div>
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold" aria-label="Student-days">
      {PARTS.map((p) => <li key={p.key} className="flex items-center gap-1.5"><span aria-hidden className={cn("size-2 rounded-full", p.cls)} />{p.label} {t[p.key]}</li>)}
    </ul>
  </div>;
}

/** Every school day of the range as a bar; scrolls sideways and opens on the latest day. */
function DailyChart({ days, minimum }: { days: TrendDay[]; minimum: number }) {
  const scroller = useRef<HTMLDivElement>(null);
  const recorded = days.filter((d) => d.record);
  const [sel, setSel] = useState(() => recorded.at(-1)?.date ?? "");
  useEffect(() => { const el = scroller.current; if (el) el.scrollLeft = el.scrollWidth; }, []);
  const lowest = Math.min(minimum, ...recorded.map((d) => d.rate!));
  const minY = Math.max(0, Math.min(90, Math.floor((lowest - 5) / 10) * 10));
  const H = 160;
  const y = (v: number) => (H * (Math.max(minY, Math.min(100, v)) - minY)) / (100 - minY);
  const picked = days.find((d) => d.date === sel && d.record);
  const below = picked && picked.rate! < minimum;

  return <Card>
    <CardHeader title="Daily trend" subtitle={`${recorded.length} of ${days.length} school ${days.length === 1 ? "day" : "days"} recorded`} />
    {picked && <div className="mx-5 mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-surface-container-low px-3 py-2 text-sm" aria-live="polite" data-testid="trend-day">
      <span className="font-semibold">{fmtDay(picked.date)}</span>
      <span className={cn("font-bold tabular-nums", below ? "text-error" : "text-secondary")}>{pct(picked.rate!)}</span>
      <span className="text-xs text-success">Present {picked.counts!.present}</span>
      {picked.counts!.late > 0 && <span className="text-xs text-warning">Late {picked.counts!.late}</span>}
      <span className="text-xs text-error">Absent {picked.counts!.absent}</span>
      {picked.counts!.excused > 0 && <span className="text-xs text-on-surface-variant">Excused {picked.counts!.excused}</span>}
    </div>}
    <div className="flex px-5 pb-5">
      <div className="relative mr-2 w-8 shrink-0 text-right text-[10px] tabular-nums text-outline" style={{ height: H }} aria-hidden>
        <span className="absolute right-0 top-0 -translate-y-1/2">100</span>
        <span className="absolute right-0 -translate-y-1/2 font-semibold text-error" style={{ bottom: y(minimum) - 6 }}>{minimum}</span>
        <span className="absolute bottom-0 right-0 translate-y-1/2">{minY}</span>
      </div>
      <div ref={scroller} className="min-w-0 flex-1 overflow-x-auto pb-1 [scrollbar-width:thin]" role="region" aria-label="Daily attendance chart" tabIndex={0}>
        <div className="relative" style={{ minWidth: days.length * 34 }}>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-error/60" style={{ top: H - y(minimum) }} />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-outline-variant/40" />
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-outline-variant/60" style={{ top: H }} />
          <ol className="flex items-end" style={{ height: H + 34 }}>
            {days.map((d, i) => {
              const first = i === 0 || d.date.slice(5, 7) !== days[i - 1]!.date.slice(5, 7);
              const on = d.date === sel;
              return <li key={d.date} className="flex w-[34px] shrink-0 flex-col items-center">
                {d.record
                  ? <button type="button" onClick={() => setSel(d.date)} aria-pressed={on} aria-label={`${fmtDay(d.date)}, ${Math.round(d.rate!)}% present`}
                    className="group flex w-full cursor-pointer items-end justify-center" style={{ height: H }}>
                    <span className={cn("w-5 rounded-t-md transition-all group-hover:opacity-90", d.rate! < minimum ? "bg-error" : "bg-secondary", on ? "ring-2 ring-offset-2 ring-secondary/50" : "opacity-80")}
                      style={{ height: Math.max(3, y(d.rate!)) }} />
                  </button>
                  : <span className="flex w-full items-end justify-center" style={{ height: H }} title={`${fmtDay(d.date)}: no register`} aria-label={`${fmtDay(d.date)}, no register`} role="img">
                    <span className="h-2 w-5 rounded-t-md border border-dashed border-outline-variant" />
                  </span>}
                <span className={cn("mt-1.5 text-[10px] leading-3", on ? "font-bold text-secondary" : "text-outline")}>{DAY_SHORT[isoWeekday(d.date) - 1]![0]}</span>
                <span className={cn("text-[11px] tabular-nums leading-4", on ? "font-bold text-on-surface" : "text-on-surface-variant")}>{first ? fmtShort(d.date) : Number(d.date.slice(8))}</span>
              </li>;
            })}
          </ol>
        </div>
      </div>
    </div>
    <div className="flex flex-wrap gap-4 border-t border-outline-variant/40 px-5 py-3 text-xs text-on-surface-variant">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-secondary" />Present rate</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-sm bg-error" />Below {minimum}%</span>
      <span className="flex items-center gap-1.5"><span className="h-0 w-4 border-t border-dashed border-error" />School minimum</span>
      <span className="flex items-center gap-1.5"><span className="h-2 w-2.5 rounded-sm border border-dashed border-outline-variant" />No register</span>
    </div>
  </Card>;
}

function WeekdayCard({ records, avg }: { records: AttRec[]; avg: number }) {
  const rates = weekdayRates(records);
  const { lo, hi } = weekdayExtremes(rates);
  const gap = lo === undefined ? 0 : avg - rates[lo]!;
  return <Card>
    <CardHeader title="By weekday" subtitle="Average attendance on each school day" />
    <ul className="grid grid-cols-3 gap-2 px-5 pb-5 sm:grid-cols-6">
      {rates.map((r, i) => r === null ? null : <li key={i} className={cn("rounded-lg px-2 py-3 text-center",
        i === lo ? "bg-error-container/50 text-error" : i === hi ? "bg-success-container/60 text-success" : "bg-surface-container-low")}>
        <p className="text-[11px] font-bold uppercase tracking-wide">{DAY_SHORT[i]}</p>
        <p className="mt-0.5 text-lg font-bold tabular-nums">{Math.round(r)}%</p>
      </li>)}
    </ul>
    {lo !== undefined && gap >= 1 && <p className="mx-5 mb-5 flex items-start gap-2 rounded-lg bg-warning-container/40 p-3 text-sm">
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-warning" />
      Attendance is lowest on {PLURAL[lo]} ({pct(rates[lo]!)}), {gap.toFixed(1)} pts under the class average.
    </p>}
  </Card>;
}

type Filter = "below" | "near" | "all";
function Students({ students, range, minimum, classLabel, records, ctx }: {
  students: StudentTrend<Student>[]; range: TrendRange; minimum: number; classLabel: string; records: AttRec[];
  ctx: React.ComponentProps<typeof NotifyParentDialog>["ctx"];
}) {
  const risk = students.filter((t) => t.days > 0 && t.rate < minimum);
  const near = students.filter((t) => t.days > 0 && t.rate >= minimum && t.rate < minimum + 5);
  const perfect = students.filter((t) => t.days > 0 && t.rate >= 100).length;
  const [chosen, setChosen] = useState<Filter | null>(null);
  const filter: Filter = chosen ?? (risk.length ? "below" : near.length ? "near" : "all");
  const [all, setAll] = useState(false);
  const list = filter === "below" ? risk : filter === "near" ? near : students;
  const shown = all ? list : list.slice(0, 8);
  const [notify, setNotify] = useState<StudentTrend<Student> | null>(null);
  const [log, setLog] = useState<StudentTrend<Student> | null>(null);
  const notices = useParentNotices(ctx.staffId);

  return <Card>
    <CardHeader title="Students" subtitle={`Sorted by attendance, ${range.toLowerCase()}`} actions={perfect > 0 ? <Badge tone="success">{perfect} with 100%</Badge> : undefined} />
    <Tabs className="px-5" items={[
      { id: "below", label: `Below ${minimum}%`, count: risk.length }, { id: "near", label: "Near limit", count: near.length }, { id: "all", label: "All", count: students.length },
    ]} value={filter} onChange={(id) => { setChosen(id as Filter); setAll(false); }} />
    {!list.length ? <EmptyState title={filter === "below" ? `Everyone is above ${minimum}%` : "No one close to the limit"} hint={`Nobody needs a follow-up for ${range.toLowerCase()}.`} />
      : <ul className="mt-2 divide-y divide-outline-variant/40" aria-label="Students by attendance">
        {shown.map((t) => {
          const tone = t.days > 0 && t.rate < minimum ? "danger" : t.days > 0 && t.rate < minimum + 5 ? "warning" : "success";
          const digits = dialDigits(t.student.phone);
          return <li key={t.student.id} className="flex flex-wrap items-center gap-3 px-5 py-3" data-testid={`trend-student-${t.student.id}`}>
            <Avatar name={t.student.name} size={40} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{t.student.name}</p>
              <p className="truncate text-xs text-on-surface-variant">Roll {t.student.roll ?? "—"} · {t.absent} absent{t.late ? ` · ${t.late} late` : ""} · {t.days} {t.days === 1 ? "day" : "days"}</p>
            </div>
            <div className="w-20 shrink-0 text-right">
              <p className={cn("font-bold tabular-nums", tone === "danger" ? "text-error" : tone === "warning" ? "text-warning" : "text-success")}>{Math.round(t.rate)}%</p>
              <ProgressBar className="mt-1 h-1.5" value={t.rate} tone={tone} />
            </div>
            <div className="flex w-full gap-1.5 sm:w-auto">
              <Button size="sm" variant="ghost" aria-label={`View log of ${t.student.name}`} onClick={() => setLog(t)}><History size={15} /><span className="sm:hidden lg:inline">Log</span></Button>
              <Button size="sm" variant="outline" aria-label={`Notify parent of ${t.student.name}`} onClick={() => setNotify(t)}><Bell size={15} />Notify</Button>
              {digits && <a href={`tel:${digits}`} aria-label={`Call parent of ${t.student.name}`} onClick={() => { void notices.logCall(t.student).catch(() => {}); }}
                className="inline-flex h-8 items-center gap-1.5 rounded px-3 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"><Phone size={15} />Call</a>}
            </div>
          </li>;
        })}
      </ul>}
    {list.length > shown.length && <div className="flex justify-center border-t border-outline-variant/40 p-3"><Button variant="ghost" size="sm" className="text-secondary" onClick={() => setAll(true)}>Show all {list.length}</Button></div>}
    <NotifyParentDialog student={notify?.student ?? null} absent={notify?.absent ?? 0} mondays={notify ? notify.absentDates.filter((d) => isoWeekday(d) === 1).length : 0}
      ctx={{ ...ctx, classLabel }} onClose={() => setNotify(null)} />
    <Modal open={!!log} onClose={() => setLog(null)} title={log?.student.name ?? "Log"} subtitle={log ? `${range} · ${log.rate.toFixed(1)}% present · ${log.absent} absent of ${log.days} days` : undefined}>
      {log && <ul className="divide-y divide-outline-variant/40 text-sm" aria-label="Attendance log">
        {[...records].reverse().filter((r) => !log.student.admissionDate || r.date >= log.student.admissionDate).map((r) => {
          const m = r.marks?.[log.student.id];
          const [text, tone] = m === "A" ? ["Absent", "danger"] as const : m === "L" ? ["Late", "warning"] as const : m === "E" ? ["Excused", "info"] as const : ["Present", "success"] as const;
          return <li key={r.id} className={cn("flex items-center justify-between py-2", m === "A" && "font-semibold")}>
            <span className="flex items-center gap-2"><CalendarCheck size={14} className="text-outline" />{fmtDay(r.date)}</span><Badge tone={tone}>{text}</Badge>
          </li>;
        })}
      </ul>}
    </Modal>
  </Card>;
}
