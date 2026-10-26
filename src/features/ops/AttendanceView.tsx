"use client";
import { useMemo, useState } from "react";
import { Check, Clock, Save, ShieldCheck, Users, X } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, Input, PageHeader, ProgressBar, Select, Stat, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { GRADES, SECTIONS, classIdOf, todayIso, type StaffRef } from "./shared";

type Stu = { id: string; name: string; grn: string; grade: string; section: string; classId?: string };
type Mark = "P" | "A" | "L" | "E";
/**
 * ops_attendance (data contract section 4). id `{date}_{classId}_{period}`; `marks` lists only students who are NOT present
 * (a missing key means present). Teachers write one record per period; the admin's day-level record uses period 0.
 */
type Rec = { id: string; date: string; classId: string; grade: string; section: string; period: number; total: number; marks: Record<string, "A" | "L" | "E">; submitted?: boolean; teacherId?: string; markedBy?: string; updatedAt?: unknown };
const OPTS: { v: Mark; label: string; icon: React.ReactNode; on: string }[] = [
  { v: "P", label: "Present", icon: <Check size={14} />, on: "bg-success text-white border-success" },
  { v: "A", label: "Absent", icon: <X size={14} />, on: "bg-error text-on-error border-error" },
  { v: "L", label: "Late", icon: <Clock size={14} />, on: "bg-warning text-white border-warning" },
  { v: "E", label: "Excused", icon: <ShieldCheck size={14} />, on: "bg-secondary text-on-secondary border-secondary" },
];

/** updatedAt may be an ISO string, epoch ms or a Firestore Timestamp */
const ts = (v: unknown): number => typeof v === "string" ? Date.parse(v) || 0 : typeof v === "number" ? v : (v as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
/** P/A/L/E counts derived from `total` and `marks` */
export const derive = (r: Pick<Rec, "total" | "marks">) => {
  const v = Object.values(r.marks ?? {});
  const A = v.filter((x) => x === "A").length, L = v.filter((x) => x === "L").length, E = v.filter((x) => x === "E").length;
  const total = Number(r.total) || 0;
  return { A, L, E, P: Math.max(0, total - A - L - E), total };
};
/** present share: present + late count as attended (same rule everywhere on this screen) */
const attPct = (d: { P: number; L: number; total: number }) => (d.total ? Math.round(((d.P + d.L) / d.total) * 100) : 0);
const newer = (a: Rec, b: Rec) => ts(a.updatedAt) - ts(b.updatedAt) || a.period - b.period;

export function AttendanceView() {
  const toast = useToast();
  const students = useCollection<Stu>("students").rows;
  const staff = useCollection<StaffRef>("staff").rows;
  const att = useCollection<Rec>("ops_attendance");
  const [date, setDate] = useState(todayIso()); const [grade, setGrade] = useState("10"); const [section, setSection] = useState("B");
  const [pick, setPick] = useState<string | null>(null);
  const classId = classIdOf(grade, section);
  const adminId = `${date}_${classId}_0`;
  const roster = useMemo(() => students.filter((s) => (s.classId ?? classIdOf(s.grade, s.section)) === classId).sort((a, b) => (Number((a as { roll?: number }).roll) || 0) - (Number((b as { roll?: number }).roll) || 0) || a.name.localeCompare(b.name)), [students, classId]);

  const recs = useMemo(() => att.rows.filter((r) => r.classId === classId && r.date === date && r.submitted !== false), [att.rows, classId, date]);
  const latest = useMemo(() => [...recs].sort((a, b) => newer(b, a))[0], [recs]);
  const shown = recs.find((r) => r.id === pick) ?? latest;
  const saved = recs.find((r) => r.id === adminId);
  const teacherName = (r: Rec) => r.markedBy === "admin" ? "Admin" : staff.find((s) => s.id === r.teacherId)?.name ?? r.teacherId ?? "Teacher";

  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [dirty, setDirty] = useState(false);
  const sig = `${classId}|${date}|${shown?.id ?? ""}|${JSON.stringify(shown?.marks ?? null)}|${roster.length}`;
  const [prevSig, setPrevSig] = useState(sig);
  if (sig !== prevSig) {
    setPrevSig(sig); setDirty(false);
    setMarks(shown ? Object.fromEntries(roster.map((s) => [s.id, (shown.marks?.[s.id] ?? "P") as Mark])) : {});
  }

  const marked = roster.filter((s) => marks[s.id]).length;
  const local = { P: 0, A: 0, L: 0, E: 0 };
  roster.forEach((s) => { const m = marks[s.id]; if (m) local[m]++; });
  // clean view of a submitted record: counts come straight from total + marks; once the admin edits, from the edited roster
  const stat = shown && !dirty ? derive(shown) : { ...local, total: roster.length };
  const pct = attPct(stat);
  const setM = (sid: string, m: Mark) => { setMarks((x) => ({ ...x, [sid]: m })); setDirty(true); };
  const leave = () => !dirty || window.confirm("Discard the unsaved attendance changes?");
  const markAll = (m: Mark) => { setMarks(Object.fromEntries(roster.map((s) => [s.id, m]))); setDirty(true); };

  const [saving, setSaving] = useState(false);
  async function save() {
    if (!roster.length) { toast("No students in this class", "error"); return; }
    if (marked < roster.length) { toast(`Mark all ${roster.length} students before saving (${roster.length - marked} left)`, "error"); return; }
    setSaving(true);
    try {
      const nonPresent = Object.fromEntries(roster.filter((s) => marks[s.id] && marks[s.id] !== "P").map((s) => [s.id, marks[s.id]]));
      const body = { date, classId, grade, section, period: 0, total: roster.length, marks: nonPresent, submitted: true, teacherId: "", markedBy: "admin" };
      if (saved) await att.update(adminId, body as never); else await att.create({ id: adminId, ...body } as never);
      setPick(null); setDirty(false); toast(`Attendance saved for Grade ${grade}-${section}, ${date}`);
    } catch { toast("Could not save attendance", "error"); } finally { setSaving(false); }
  }

  // one line per date for the class: its latest submitted record
  const history = useMemo(() => {
    const byDate = new Map<string, Rec>();
    att.rows.filter((r) => r.classId === classId && r.submitted !== false).forEach((r) => { const c = byDate.get(r.date); if (!c || newer(r, c) > 0) byDate.set(r.date, r); });
    return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [att.rows, classId]);
  const periodRecs = recs.filter((r) => r.period > 0).sort((a, b) => a.period - b.period);

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Period records submitted by teachers, with the latest shown per class and day. Admin can still mark the whole day."
        actions={<Button onClick={save} disabled={!dirty || !roster.length || saving}><Save size={16} />{saved ? "Update Attendance" : "Save Attendance"}</Button>} />
      <Card className="mb-5 grid gap-4 p-4 sm:grid-cols-3">
        <Field label="Date"><Input type="date" value={date} max={todayIso()} onChange={(e) => { if (e.target.value && leave()) { setDate(e.target.value); setPick(null); } }} /></Field>
        <Field label="Grade"><Select value={grade} onChange={(e) => { if (leave()) { setGrade(e.target.value); setPick(null); } }}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section"><Select value={section} onChange={(e) => { if (leave()) { setSection(e.target.value); setPick(null); } }}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
      </Card>
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Students" value={stat.total} icon={<Users size={16} />} />
        <Stat label="Present" value={stat.P} sub={`${pct}%`} subTone="success" />
        <Stat label="Absent" value={stat.A} subTone="danger" sub={stat.A ? "Follow up" : undefined} />
        <Stat label="Late" value={stat.L} sub={stat.E ? `${stat.E} excused` : undefined} />
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_300px]">
        <Card>
          <CardHeader title={`Grade ${grade}-${section} roll`}
            subtitle={shown ? `${shown.period > 0 ? `Period ${shown.period}` : "Day record"} · ${teacherName(shown)}${dirty ? " · edited, not saved" : ""}${shown === latest ? " · latest submitted" : ""}` : `${marked} of ${roster.length} marked · no submitted record yet`}
            actions={<><Button size="sm" variant="outline" disabled={!roster.length} onClick={() => markAll("P")}>Mark all present</Button><Button size="sm" variant="ghost" disabled={!roster.length} onClick={() => markAll("A")}>All absent</Button></>} />
          {roster.length === 0 ? <EmptyState title="No students in this class" hint="Pick another grade or section, or add students in Students & Guardians." /> : (
            <ul className="divide-y divide-outline-variant/40">
              {roster.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="flex items-center gap-3"><Avatar name={s.name} /><div><div className="font-semibold">{s.name}</div><div className="t-caption font-mono text-outline">{s.grn}</div></div></div>
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Attendance for ${s.name}`}>
                    {OPTS.map((o) => (
                      <button key={o.v} aria-pressed={marks[s.id] === o.v} onClick={() => setM(s.id, o.v)}
                        className={cn("flex cursor-pointer items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold", marks[s.id] === o.v ? o.on : "border-outline-variant text-on-surface-variant hover:bg-surface-container")}>{o.icon}{o.label}</button>))}
                  </div>
                </li>))}
            </ul>)}
        </Card>
        <Card>
          <CardHeader title="Class summary" />
          <div className="space-y-4 p-5 pt-2">
            <div><div className="mb-1 flex justify-between text-sm"><span>Attendance on {date}</span><span className="font-mono">{pct}%</span></div><ProgressBar value={pct} tone={pct >= 75 ? "success" : "danger"} /></div>
            <div><h4 className="t-label-caps mb-2 text-on-surface-variant">Records for this day</h4>
              {recs.length === 0 ? <p className="text-on-surface-variant">Nothing submitted yet.</p> : (
                <ul className="space-y-1.5 text-sm">{[...periodRecs, ...(saved ? [saved] : [])].map((r) => { const d = derive(r);
                  return <li key={r.id}><button onClick={() => leave() && setPick(r.id)} className={cn("flex w-full cursor-pointer items-center justify-between gap-2 rounded px-2 py-1 text-left hover:bg-surface-container-low", shown?.id === r.id && "bg-info-container")}>
                    <span className="min-w-0"><span className="font-semibold">{r.period > 0 ? `P${r.period}` : "Day"}</span> <span className="t-caption text-outline">{teacherName(r)}</span></span>
                    <span className="shrink-0 font-mono text-xs">{d.P}P · {d.A}A · {d.L}L</span></button></li>; })}</ul>)}
              {recs.length > 1 && latest && <p className="t-caption mt-2 text-outline">Latest: <Badge tone="brand">{latest.period > 0 ? `Period ${latest.period}` : "Admin day record"}</Badge></p>}</div>
            <div><h4 className="t-label-caps mb-2 text-on-surface-variant">Recent days</h4>
              {history.length === 0 ? <p className="text-on-surface-variant">No saved records yet.</p> : (
                <ul className="space-y-1.5 text-sm">{history.map((h) => { const d = derive(h); const p = attPct(d);
                  return <li key={h.id}><button className="flex w-full cursor-pointer justify-between rounded px-2 py-1 hover:bg-surface-container-low" onClick={() => { if (leave()) { setDate(h.date); setPick(null); } }}><span>{h.date}</span><span className="font-mono">{p}%</span></button></li>; })}</ul>)}</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
