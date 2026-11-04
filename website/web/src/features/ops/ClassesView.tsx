"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, Users, Wand2 } from "lucide-react";
import { Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, Select, SlideOver, Stat, useToast, type Column } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { GRADES, SECTIONS, SUBJECTS, activeStudent, classIdOf, clsLabel, nextId, studentClassId, teachingStaff, type StaffRef } from "./shared";
import { classTeacherElsewhere, validateAssignment, validateClass, type Assignment, type ClassRow } from "./logic";

export type { Assignment, ClassRow } from "./logic";
type Stu = { id: string; classId?: string; grade: string; section: string; status?: string; deleted?: boolean };

const label = (c: ClassRow) => `Grade ${c.grade}-${c.section}`;

/**
 * classes + assignments (data contract section 3). The teacher app reads both to decide which classes a teacher sees;
 * a classTeacherId change or a new assignment notifies that teacher (section 10). `classTeacher` (name) is written next
 * to classTeacherId (section 13.1; the backend also keeps it in sync).
 */
export function ClassesView() {
  const toast = useToast();
  const classes = useCollection<ClassRow>("classes");
  const asg = useCollection<Assignment>("assignments");
  const staff = useCollection<StaffRef>("staff").rows;
  const students = useCollection<Stu>("students").rows;
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const teachers = useMemo(() => teachingStaff(staff), [staff]);
  const nameOf = (id?: string) => staff.find((s) => s.id === id)?.name ?? "";
  const roster = useMemo(() => students.filter(activeStudent), [students]);
  const size = (c: ClassRow) => roster.filter((s) => studentClassId(s) === c.id).length;
  const sorted = useMemo(() => [...classes.rows].sort((a, b) => (+a.grade || 0) - (+b.grade || 0) || (a.section ?? "").localeCompare(b.section ?? "")), [classes.rows]);
  const current = classes.rows.find((c) => c.id === open) ?? null;

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

  /** sets the class teacher; a teacher is class teacher of one class only. Returns the error ("" when saved). */
  async function setClassTeacher(c: ClassRow, teacherId: string) {
    const other = classTeacherElsewhere(classes.rows, teacherId, c.id);
    if (other) { const msg = `${nameOf(teacherId) || teacherId} is already class teacher of ${clsLabel(other.id)}`; toast(msg, "error"); return msg; }
    try { await classes.update(c.id, { classTeacherId: teacherId, classTeacher: teacherId ? nameOf(teacherId) : "" }); toast(`Class teacher set for ${label(c)}`); return ""; }
    catch { toast("Save failed", "error"); return "Save failed"; }
  }

  const cols: Column<ClassRow>[] = [
    { key: "class", header: "Class", sortValue: (c) => (+c.grade || 0) * 10 + (c.section ?? "").charCodeAt(0), render: (c) => <div><div className="font-semibold">{label(c)}</div><div className="t-caption font-mono text-outline">{c.id}</div></div> },
    { key: "teacher", header: "Class teacher", sortValue: (c) => nameOf(c.classTeacherId) || c.classTeacher || "", render: (c) => (
      <div onClick={(e) => e.stopPropagation()}>
        <Select aria-label={`Class teacher for ${label(c)}`} value={c.classTeacherId ?? ""} className="w-56" onChange={(e) => void setClassTeacher(c, e.target.value)}>
          <option value="">Not assigned</option><KeepOption id={c.classTeacherId} teachers={teachers} name={nameOf(c.classTeacherId) || c.classTeacher || ""} />{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select></div>) },
    { key: "room", header: "Room", render: (c) => c.room ? <span>{c.room}<span className="t-caption block text-outline">{c.wing}</span></span> : <span className="text-outline">—</span> },
    { key: "students", header: "Students", sortValue: size, render: (c) => <span className="inline-flex items-center gap-1 font-mono text-sm"><Users size={14} className="text-outline" />{size(c)}</span> },
    { key: "subjects", header: "Subjects assigned", sortValue: (c) => asg.rows.filter((a) => a.classId === c.id).length, render: (c) => { const k = asg.rows.filter((a) => a.classId === c.id).length; return <Badge tone={k ? "info" : "warning"}>{k ? `${k} subject${k > 1 ? "s" : ""}` : "None yet"}</Badge>; } },
    { key: "act", header: "", className: "text-right", render: (c) => <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setOpen(c.id); }}>Assign teachers</Button> },
  ];

  return (
    <div>
      <PageHeader title="Classes & Assignments" subtitle="Class teachers and who teaches which subject in each class. The teacher app reads these to decide what a teacher sees."
        actions={<><Button variant="outline" onClick={() => setAdding(true)}><Plus size={16} />Add class</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Classes" value={classes.rows.length} />
        <Stat label="Without class teacher" value={classes.rows.filter((c) => !c.classTeacherId).length} subTone="warning" sub={classes.rows.some((c) => !c.classTeacherId) ? "Assign" : undefined} />
        <Stat label="Subject assignments" value={asg.rows.length} />
      </div>
      {missing.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-info-container p-3 text-sm text-secondary">
          <Wand2 size={16} />{missing.length} class-section{missing.length > 1 ? "s" : ""} in the student roster {missing.length > 1 ? "have" : "has"} no class record.
          <Button size="sm" className="ml-auto" disabled={generating} onClick={generate}>{generating ? "Creating…" : "Create them"}</Button>
        </div>)}
      <Card className="pt-2">
        {!classes.ready ? <p className="p-5 text-on-surface-variant">Loading classes…</p> : <DataTable rows={sorted} columns={cols} pageSize={12} onRowClick={(c) => setOpen(c.id)} empty={<EmptyState title="No classes yet" hint="Add a class or create them from the student roster." />} />}
      </Card>
      {adding && <AddClass classes={classes.rows} nameOf={nameOf} onClose={() => setAdding(false)} teachers={teachers}
        onSave={async (v) => { try { await classes.create({ ...v, id: classIdOf(v.grade, v.section), classTeacher: v.classTeacherId ? nameOf(v.classTeacherId) : "" } as never); toast("Class added"); setAdding(false); } catch { toast("Save failed", "error"); } }} />}
      {current && <AssignPanel key={current.id} cls={current} classes={classes.rows} all={asg.rows} teachers={teachers} nameOf={nameOf}
        setClassTeacher={(id) => setClassTeacher(current, id)}
        update={(patch) => classes.update(current.id, patch).then(() => { toast("Class updated"); }).catch(() => { toast("Save failed", "error"); })}
        onAdd={async (v) => { try { await asg.create({ ...v, id: nextId("asg", asg.rows.map((a) => a.id)), classId: current.id } as never); toast("Assignment added"); return true; } catch { toast("Save failed", "error"); return false; } }}
        onChange={(id, patch) => asg.update(id, patch).then(() => toast("Assignment updated")).catch(() => toast("Save failed", "error"))}
        onRemove={(id) => asg.remove(id).then(() => toast("Assignment removed")).catch(() => toast("Could not remove the assignment", "error"))} onClose={() => setOpen(null)} />}
    </div>
  );
}

function AddClass({ classes, teachers, nameOf, onClose, onSave }: { classes: ClassRow[]; teachers: StaffRef[]; nameOf: (id: string) => string; onClose: () => void; onSave: (v: { grade: string; section: string; classTeacherId: string; room: string; wing: string }) => Promise<void> }) {
  const [f, setF] = useState({ grade: "8", section: "A", classTeacherId: "", room: "", wing: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string) => { setF((p) => ({ ...p, [k]: v })); setErr((e) => ({ ...e, [k]: "" })); };
  async function submit() {
    const e = validateClass(f, classes, nameOf);
    setErr(e); if (Object.keys(e).length) return;
    setSaving(true);
    try { await onSave({ ...f, room: f.room.trim(), wing: f.wing.trim() }); } finally { setSaving(false); }
  }
  return (
    <Modal open onClose={onClose} title="Add class" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={submit}>{saving ? "Saving…" : "Add class"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Grade" required error={err.grade}><Select value={f.grade} onChange={(e) => set("grade", e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section" required error={err.section}><Select value={f.section} onChange={(e) => set("section", e.target.value)}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Class teacher" className="sm:col-span-2" error={err.classTeacherId}><Select value={f.classTeacherId} onChange={(e) => set("classTeacherId", e.target.value)}><option value="">Not assigned</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <Field label="Room" error={err.room}><Input value={f.room} onChange={(e) => set("room", e.target.value)} /></Field>
        <Field label="Wing"><Input value={f.wing} onChange={(e) => set("wing", e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

function AssignPanel({ cls, classes, all, teachers, nameOf, setClassTeacher, update, onAdd, onChange, onRemove, onClose }: {
  cls: ClassRow; classes: ClassRow[]; all: Assignment[]; teachers: StaffRef[]; nameOf: (id?: string) => string; setClassTeacher: (id: string) => Promise<string>; update: (p: Partial<ClassRow>) => Promise<void>;
  onAdd: (v: { subject: string; teacherId: string; topic?: string; periodsPerWeek?: number }) => Promise<boolean>; onChange: (id: string, p: Partial<Assignment>) => void; onRemove: (id: string) => void; onClose: () => void;
}) {
  const mine = all.filter((a) => a.classId === cls.id).sort((a, b) => a.subject.localeCompare(b.subject));
  const free = SUBJECTS.filter((s) => !mine.some((a) => a.subject.toLowerCase() === s.toLowerCase()));
  const [subject, setSubject] = useState(free[0] ?? ""); const [teacherId, setTeacherId] = useState(""); const [ppw, setPpw] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [ctErr, setCtErr] = useState("");
  const [room, setRoom] = useState({ room: cls.room ?? "", wing: cls.wing ?? "" });
  const [roomErr, setRoomErr] = useState("");
  const pick = free.includes(subject) ? subject : (free[0] ?? "");
  const roomDirty = room.room.trim() !== (cls.room ?? "") || room.wing.trim() !== (cls.wing ?? "");

  async function add() {
    const e = validateAssignment(all, { classId: cls.id, subject: pick, teacherId, periodsPerWeek: ppw });
    setErr(e); if (Object.keys(e).length) return;
    if (await onAdd({ subject: pick, teacherId, ...(ppw.trim() ? { periodsPerWeek: Number(ppw) } : {}) })) { setTeacherId(""); setPpw(""); }
  }
  async function saveRoom() {
    const e = validateClass({ grade: cls.grade, section: cls.section, classTeacherId: "", room: room.room }, classes, () => "", cls.id);
    setRoomErr(e.room ?? ""); if (e.room) return;
    await update({ room: room.room.trim(), wing: room.wing.trim() });
  }
  return (
    <SlideOver open onClose={onClose} title={`${label(cls)} · teachers`} subtitle={cls.id} width="max-w-xl">
      <div className="space-y-5">
        <Field label="Class teacher" error={ctErr}><Select value={cls.classTeacherId ?? ""} onChange={async (e) => setCtErr(await setClassTeacher(e.target.value))}><option value="">Not assigned</option><KeepOption id={cls.classTeacherId} teachers={teachers} name={nameOf(cls.classTeacherId) || cls.classTeacher || ""} />{teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <Field label="Room" error={roomErr}><Input value={room.room} onChange={(e) => { setRoom((r) => ({ ...r, room: e.target.value })); setRoomErr(""); }} /></Field>
          <Field label="Wing"><Input value={room.wing} onChange={(e) => setRoom((r) => ({ ...r, wing: e.target.value }))} /></Field>
          <div className="flex items-end"><Button variant="outline" disabled={!roomDirty} onClick={saveRoom}>Save room</Button></div>
        </div>
        <div>
          <h4 className="t-label-caps mb-2 text-on-surface-variant">Subject → teacher</h4>
          {mine.length === 0 ? <p className="text-sm text-on-surface-variant">No subjects assigned yet.</p> : (
            <ul className="divide-y divide-outline-variant/40 rounded-lg border border-outline-variant/60">
              {mine.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="w-36 shrink-0"><div className="font-semibold">{a.subject}</div>{a.topic && <div className="t-caption text-outline">{a.topic}</div>}</div>
                  <Select aria-label={`Teacher for ${a.subject}`} value={a.teacherId} className="min-w-0 flex-1" onChange={(e) => { if (e.target.value) onChange(a.id, { teacherId: e.target.value }); }}>
                    {!teachers.some((t) => t.id === a.teacherId) && <option value={a.teacherId}>{nameOf(a.teacherId) || a.teacherId || "Not assigned"}</option>}
                    {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
                  {a.periodsPerWeek ? <span className="t-caption font-mono text-outline">{a.periodsPerWeek}/wk</span> : null}
                  <Button size="sm" variant="ghost" aria-label={`Remove ${a.subject}`} onClick={() => onRemove(a.id)}><Trash2 size={14} className="text-error" /></Button>
                </li>))}
            </ul>)}
        </div>
        <div className="rounded-lg bg-surface-container-low p-4">
          <h4 className="t-label-caps mb-3 text-on-surface-variant">Add subject</h4>
          {free.length === 0 ? <p className="text-sm text-on-surface-variant">All subjects are assigned.</p> : (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Subject" required error={err.subject}><Select value={pick} onChange={(e) => { setSubject(e.target.value); setErr((x) => ({ ...x, subject: "" })); }}>{free.map((s) => <option key={s}>{s}</option>)}</Select></Field>
              <Field label="Teacher" required error={err.teacherId}><Select value={teacherId} onChange={(e) => { setTeacherId(e.target.value); setErr((x) => ({ ...x, teacherId: "" })); }}><option value="">Select teacher…</option>{teachers.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.department})</option>)}</Select></Field>
              <Field label="Periods per week" error={err.periodsPerWeek}><Input type="number" min={0} max={48} value={ppw} onChange={(e) => { setPpw(e.target.value); setErr((x) => ({ ...x, periodsPerWeek: "" })); }} /></Field>
              <div className="flex items-end"><Button onClick={add}><Plus size={16} />Assign</Button></div>
            </div>)}
        </div>
      </div>
    </SlideOver>
  );
}

/** keeps a stored teacher id selectable when that person is not in the teaching list */
function KeepOption({ id, teachers, name }: { id?: string; teachers: StaffRef[]; name: string }) {
  return id && !teachers.some((t) => t.id === id) ? <option value={id}>{name || id}</option> : null;
}
