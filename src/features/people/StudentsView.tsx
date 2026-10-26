"use client";
import { useMemo, useState } from "react";
import { Download, Pencil, Plus, Trash2, UserCheck, Users, TriangleAlert, Percent } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, SearchBox, Select, SlideOver, Stat, useToast, type Column } from "@/components/ui";
import { SECTIONS, classIdOf, nextId } from "@/features/ops/shared";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/communication/csv";
import type { Tone } from "@/components/ui";

export type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number;
  email?: string; dob?: string; address?: string; relation?: string };
const STATUS = ["Active", "Alumni-pending", "Transferred"];
const pctOf = (s: Student) => Number(s.attendance) || 0; // attendance may be missing on rows written elsewhere
const tone = (s: string): Tone => (s === "Active" ? "success" : s === "Transferred" ? "neutral" : "warning");
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const blank = { name: "", grn: "", grade: "6", section: "A", guardian: "", relation: "Parent", phone: "", email: "", dob: "", address: "", status: "Active", attendance: 100 };

export function StudentsView({ initialQ = "" }: { initialQ?: string }) {
  const toast = useToast();
  const { rows, ready, create, update, remove } = useCollection<Student>("students");
  const [q, setQ] = useState(initialQ);
  const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Student | null>(null);
  const [form, setForm] = useState<{ edit?: Student } | null>(null);
  const [del, setDel] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  const view = useMemo(() => rows.filter((s) => (!grade || s.grade === grade) && (!section || s.section === section) && (!status || s.status === status)
    && (!q || `${s.name} ${s.grn} ${s.guardian} ${s.phone}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, grade, section, status]);
  const avg = rows.length ? Math.round(rows.reduce((a, s) => a + pctOf(s), 0) / rows.length) : 0;
  const live = profile ? rows.find((r) => r.id === profile.id) ?? null : null;

  const cols: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (s) => s.name, render: (s) => (<div className="flex items-center gap-3"><Avatar name={s.name} /><div><div className="font-semibold">{s.name}</div><div className="t-caption font-mono text-outline">{s.grn}</div></div></div>) },
    { key: "class", header: "Class", sortValue: (s) => (+s.grade || 0) * 10 + (s.section ?? "").charCodeAt(0), render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {s.grade}-{s.section}</span> },
    { key: "guardian", header: "Guardian", sortValue: (s) => s.guardian, render: (s) => <div><div>{s.guardian}</div><div className="t-caption text-outline">{s.phone}</div></div> },
    { key: "attendance", header: "Attendance", sortValue: pctOf, render: (s) => <div className="flex w-28 items-center gap-2"><ProgressBar value={pctOf(s)} tone={pctOf(s) >= 75 ? "success" : "danger"} /><span className="font-mono text-xs">{pctOf(s)}%</span></div> },
    { key: "status", header: "Status", sortValue: (s) => s.status, render: (s) => <Badge tone={tone(s.status)}>{s.status}</Badge> },
  ];

  async function confirmDelete() {
    if (!del) return;
    setDeleting(true);
    try { await remove(del.id); toast("Student removed"); setDel(null); setProfile(null); } catch { toast("Could not delete", "error"); } finally { setDeleting(false); }
  }

  return (
    <div>
      <PageHeader title="Students & Guardians" subtitle="Manage student records, guardian contacts and enrolment status."
        actions={<><Button variant="outline" onClick={() => downloadCsv("students", ["GRN", "Name", "Grade", "Section", "Guardian", "Phone", "Status", "Attendance %"], view.map((s) => [s.grn, s.name, s.grade, s.section, s.guardian, s.phone, s.status, pctOf(s)]))}><Download size={16} />Export CSV</Button>
          <Button onClick={() => setForm({})}><Plus size={16} />Add Student</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={rows.length} icon={<Users size={16} />} />
        <Stat label="Active" value={rows.filter((s) => s.status === "Active").length} icon={<UserCheck size={16} />} />
        <Stat label="Average attendance" value={`${avg}%`} icon={<Percent size={16} />} />
        <Stat label="Below 75% attendance" value={rows.filter((s) => pctOf(s) < 75).length} sub="Needs follow-up" subTone="danger" icon={<TriangleAlert size={16} />} />
      </div>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name, GRN, guardian or phone…" className="w-full max-w-xs" />
          <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-36"><option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
          <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-36"><option value="">All sections</option>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="">All statuses</option>{STATUS.map((g) => <option key={g}>{g}</option>)}</Select>
          <span className="ml-auto text-on-surface-variant">{view.length} of {rows.length}</span>
        </div>
        {ready ? <DataTable rows={view} columns={cols} pageSize={10} onRowClick={setProfile}
          empty={<EmptyState title={rows.length ? "No students match" : "No students yet"} hint={rows.length ? "Try changing your search or filters." : "Add a student to get started."} />} />
          : <p className="px-5 pb-5 text-on-surface-variant">Loading students…</p>}
      </Card>

      <SlideOver open={!!live} onClose={() => setProfile(null)} title={live?.name ?? ""} subtitle={live ? `${live.grn} · Grade ${live.grade}-${live.section}` : ""}
        footer={live && <><Button variant="danger" onClick={() => setDel(live)}><Trash2 size={14} />Delete</Button><Button onClick={() => { setForm({ edit: live }); setProfile(null); }}><Pencil size={14} />Edit</Button></>}>
        {live && <div className="space-y-5">
          <div className="flex items-center gap-4"><Avatar name={live.name} size={56} /><div><Badge tone={tone(live.status)}>{live.status}</Badge><div className="mt-1 text-on-surface-variant">DOB: {live.dob || "—"}</div></div></div>
          <section><h3 className="t-label-caps mb-2 text-on-surface-variant">Attendance</h3><div className="flex items-center gap-3"><ProgressBar value={pctOf(live)} tone={pctOf(live) >= 75 ? "success" : "danger"} /><span className="font-mono">{pctOf(live)}%</span></div></section>
          <section><h3 className="t-label-caps mb-2 text-on-surface-variant">Guardian</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm"><dt className="text-outline">Name</dt><dd>{live.guardian}</dd><dt className="text-outline">Relation</dt><dd>{live.relation || "—"}</dd><dt className="text-outline">Phone</dt><dd>{live.phone}</dd><dt className="text-outline">Email</dt><dd>{live.email || "—"}</dd><dt className="text-outline">Address</dt><dd>{live.address || "—"}</dd></dl></section>
        </div>}
      </SlideOver>

      {form && <StudentForm key={form.edit?.id ?? "new"} edit={form.edit} existing={rows} onClose={() => setForm(null)}
        onSave={async (v) => { try {
          // contract: classId + int roll (next free roll in the class when a student joins or changes class)
          const classId = classIdOf(v.grade, v.section);
          const inClass = rows.filter((r) => ((r as { classId?: string }).classId ?? classIdOf(r.grade, r.section)) === classId && r.id !== form.edit?.id);
          const keep = form.edit && (form.edit as { classId?: string }).classId === classId ? (form.edit as { roll?: number }).roll : undefined;
          const roll = keep ?? Math.max(0, ...inClass.map((r) => Number((r as { roll?: number }).roll) || 0)) + 1;
          if (form.edit) { await update(form.edit.id, { ...v, classId, roll } as never); toast("Student updated"); } else { await create({ ...v, classId, roll, id: nextId("stu", rows.map((r) => r.id)) } as never); toast("Student added"); } setForm(null); } catch { toast("Save failed", "error"); } }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete student?" subtitle={del?.name}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button></>}>
        <p className="text-on-surface-variant">This permanently removes the student record. This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function StudentForm({ edit, existing, onClose, onSave }: { edit?: Student; existing: Student[]; onClose: () => void; onSave: (v: Omit<Student, "id">) => Promise<void> }) {
  const [f, setF] = useState({ ...blank, ...(edit ?? {}) });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = (k: string, v: string | number) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Name is required";
    if (!f.guardian.trim()) e.guardian = "Guardian name is required";
    if (!/^[+\d][\d\s-]{7,}$/.test(f.phone.trim())) e.phone = "Enter a valid phone number";
    if (f.email.trim() && !/^\S+@\S+\.\S+$/.test(f.email.trim())) e.email = "Enter a valid email";
    const att = Number(f.attendance); if (isNaN(att) || att < 0 || att > 100) e.attendance = "0–100";
    if (f.dob && f.dob > new Date().toISOString().slice(0, 10)) e.dob = "Date of birth cannot be in the future";
    const taken = new Set(existing.filter((s) => s.id !== edit?.id).map((s) => (s.grn ?? "").trim().toLowerCase()));
    // auto GRN: next number that is not taken (count-based ids collide after deletes)
    let grn = f.grn.trim();
    if (!grn) { let k = 8801 + existing.length; while (taken.has(`gis-${k}`)) k++; grn = `GIS-${k}`; }
    else if (taken.has(grn.toLowerCase())) e.grn = "GRN already exists";
    setErr(e);
    if (Object.keys(e).length) return;
    const { id: _id, ...rest } = f as typeof f & { id?: string }; void _id;
    setSaving(true);
    try { await onSave({ ...rest, name: f.name.trim(), guardian: f.guardian.trim(), phone: f.phone.trim(), email: f.email.trim(), grn, attendance: att }); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={edit ? "Edit Student" : "Add Student"} subtitle="Student and guardian details" width="max-w-lg"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save Changes" : "Add Student"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student name" required error={err.name} className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="GRN" error={err.grn} hint="Auto-generated if blank"><Input value={f.grn} onChange={(e) => set("grn", e.target.value)} /></Field>
        <Field label="Date of birth" error={err.dob}><Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Grade"><Select value={f.grade} onChange={(e) => set("grade", e.target.value)}>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select></Field>
        <Field label="Section"><Select value={f.section} onChange={(e) => set("section", e.target.value)}>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{[...new Set([f.status, ...STATUS])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Attendance %" error={err.attendance}><Input type="number" value={f.attendance} onChange={(e) => set("attendance", e.target.value)} /></Field>
        <h3 className="t-label-caps sm:col-span-2 mt-2 text-on-surface-variant">Guardian</h3>
        <Field label="Guardian name" required error={err.guardian}><Input value={f.guardian} onChange={(e) => set("guardian", e.target.value)} /></Field>
        <Field label="Relation"><Select value={f.relation} onChange={(e) => set("relation", e.target.value)}>{[...new Set([...(f.relation ? [f.relation] : []), "Father", "Mother", "Parent", "Guardian"])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Phone" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxxxxxxx" /></Field>
        <Field label="Email" error={err.email}><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
      </div>
    </SlideOver>
  );
}
