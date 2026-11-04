"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Download, Pencil, Plus, Trash2, UserCheck, Users, TriangleAlert, Percent } from "lucide-react";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, ProgressBar, SearchBox, Select, SlideOver, Stat, Tabs, useToast, type Column } from "@/components/ui";
import { SECTIONS, todayIso } from "@/features/ops/shared";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/communication/csv";
import type { Tone } from "@/components/ui";
import { consentMap, consentState, useSchoolUsers, type Consent, type ConsentState, type SchoolUser } from "@/lib/parentAccount";
import { ParentLoginSection } from "./ParentLoginSection";
import { StudentLeavesPanel } from "./StudentLeavesPanel";
import { MeetingsPanel } from "./MeetingsPanel";
import { useNow } from "@/lib/useNow";
import { CertificatesPanel } from "./CertificatesPanel";
import { nextStudentId, studentClassId, validateStudent, type StudentDoc, type StudentFormValues } from "./studentLogic";

export type Student = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number;
  email?: string; dob?: string; address?: string; relation?: string;
  /** contract 3: class id `cls_{grade}{SECTION}` and the integer roll in that class (older rows may lack them) */
  classId?: string; roll?: number; deleted?: boolean;
  /** contract 13.1: parent login email and the linked parent auth uids (siblings share a uid) */
  guardianEmail?: string; guardianUids?: string[];
  /** contract 14.2: bus + stop assigned in Transport > Buses (display names kept by the admin web) */
  busId?: string; bus?: string; busStopId?: string; busStop?: string };
const STATUS = ["Active", "Alumni-pending", "Transferred"];
const pctOf = (s: Student) => Number(s.attendance) || 0; // attendance may be missing on rows written elsewhere
const tone = (s: string): Tone => (s === "Active" ? "success" : s === "Transferred" ? "neutral" : "warning");
const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));
const CONSENT: { v: ConsentState; label: string; tone: Tone }[] = [{ v: "Given", label: "Consent given", tone: "success" }, { v: "Pending", label: "Consent pending", tone: "warning" }, { v: "None", label: "No parent login", tone: "neutral" }];
const blank: StudentFormValues = { name: "", grn: "", grade: "6", section: "A", roll: "", guardian: "", relation: "Parent", phone: "", email: "", guardianEmail: "", dob: "", address: "", status: "Active", attendance: 100 };
/** The form's copy of a student (only the fields the form edits). */
const formOf = (s: Student): StudentFormValues => ({ name: s.name ?? "", grn: s.grn ?? "", grade: String(s.grade ?? "6"), section: String(s.section ?? "A"), roll: s.roll ? String(s.roll) : "",
  guardian: s.guardian ?? "", relation: s.relation ?? "Parent", phone: s.phone ?? "", email: s.email ?? "", guardianEmail: s.guardianEmail ?? "", dob: s.dob ?? "", address: s.address ?? "",
  status: s.status ?? "Active", attendance: s.attendance ?? 100 });

export function StudentsView({ initialQ = "" }: { initialQ?: string }) {
  const toast = useToast();
  const all = useCollection<Student>("students");
  const { ready, create, update, remove } = all;
  // soft-deleted rows (contract 2: `deleted: true`) are not shown anywhere
  const rows = useMemo(() => all.rows.filter((s) => s.deleted !== true), [all.rows]);
  const [q, setQ] = useState(initialQ);
  const [grade, setGrade] = useState(""); const [section, setSection] = useState(""); const [status, setStatus] = useState("");
  const [profile, setProfile] = useState<Student | null>(null);
  const [form, setForm] = useState<{ edit?: Student } | null>(null);
  const [del, setDel] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [consent, setConsent] = useState("");
  // deep-linkable: /students?tab=leaves|meetings|certificates (parent requests)
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab = ["leaves", "meetings", "certificates"].find((t) => t === params.get("tab")) ?? "directory";
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
  const avg = rows.length ? Math.round(rows.reduce((a, s) => a + pctOf(s), 0) / rows.length) : 0;
  const live = profile ? rows.find((r) => r.id === profile.id) ?? null : null;

  const cols: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (s) => s.name, render: (s) => (<div className="flex items-center gap-3"><Avatar name={s.name} /><div><div className="font-semibold">{s.name}</div><div className="t-caption font-mono text-outline">{s.grn}</div></div></div>) },
    { key: "class", header: "Class", sortValue: (s) => (+s.grade || 0) * 10 + (s.section ?? "").charCodeAt(0), render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">Grade {s.grade}-{s.section}</span> },
    { key: "guardian", header: "Guardian", sortValue: (s) => s.guardian, render: (s) => <div><div>{s.guardian}</div><div className="t-caption text-outline">{s.phone}</div></div> },
    { key: "parent", header: "Parent app", sortValue: (s) => CONSENT.findIndex((c) => c.v === cstate(s)), render: (s) => { const c = CONSENT.find((x) => x.v === cstate(s))!;
      return <div><Badge tone={c.tone}>{c.label}</Badge>{(s.guardianUids?.length ?? 0) > 1 && <div className="t-caption mt-0.5 text-outline">{s.guardianUids!.length} logins</div>}</div>; } },
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
        actions={<><Button variant="outline" onClick={() => downloadCsv("students", ["GRN", "Name", "Grade", "Section", "Roll", "Guardian", "Phone", "Status", "Attendance %", "Parent app"], view.map((s) => [s.grn, s.name, s.grade, s.section, s.roll ?? "", s.guardian, s.phone, s.status, pctOf(s), CONSENT.find((c) => c.v === cstate(s))!.label]))}><Download size={16} />Export CSV</Button>
          <Button onClick={() => setForm({})}><Plus size={16} />Add Student</Button></>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total students" value={rows.length} icon={<Users size={16} />} />
        <Stat label="Active" value={rows.filter((s) => s.status === "Active").length} icon={<UserCheck size={16} />} />
        <Stat label="Average attendance" value={`${avg}%`} icon={<Percent size={16} />} />
        <Stat label="Below 75% attendance" value={rows.filter((s) => pctOf(s) < 75).length} sub="Needs follow-up" subTone="danger" icon={<TriangleAlert size={16} />} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ id: "directory", label: "Directory", count: rows.length }, { id: "leaves", label: "Leave requests", count: pendingLeaves },
        { id: "meetings", label: "Meetings", count: bookedMeetings }, { id: "certificates", label: "Certificates", count: certRequests }]} />
      {tab === "leaves" ? <StudentLeavesPanel students={rows} /> : tab === "meetings" ? <MeetingsPanel students={rows} /> : tab === "certificates" ? <CertificatesPanel students={rows} /> :
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name, GRN, guardian or phone…" className="w-full max-w-xs" />
          <Select aria-label="Grade" value={grade} onChange={(e) => setGrade(e.target.value)} className="w-36"><option value="">All grades</option>{GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}</Select>
          <Select aria-label="Section" value={section} onChange={(e) => setSection(e.target.value)} className="w-36"><option value="">All sections</option>{SECTIONS.map((g) => <option key={g}>{g}</option>)}</Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="">All statuses</option>{STATUS.map((g) => <option key={g}>{g}</option>)}</Select>
          <Select aria-label="Parent consent" value={consent} onChange={(e) => setConsent(e.target.value)} className="w-44"><option value="">Any parent status</option>{CONSENT.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}</Select>
          <span className="ml-auto text-on-surface-variant">{view.length} of {rows.length}</span>
        </div>
        {ready ? <DataTable rows={view} columns={cols} pageSize={10} onRowClick={setProfile}
          empty={<EmptyState title={rows.length ? "No students match" : "No students yet"} hint={rows.length ? "Try changing your search or filters." : "Add a student to get started."} />} />
          : <p className="px-5 pb-5 text-on-surface-variant">Loading students…</p>}
      </Card>}

      <SlideOver open={!!live} onClose={() => setProfile(null)} title={live?.name ?? ""} subtitle={live ? `${live.grn} · Grade ${live.grade}-${live.section}${live.roll ? ` · Roll ${live.roll}` : ""}` : ""}
        footer={live && <><Button variant="danger" onClick={() => setDel(live)}><Trash2 size={14} />Delete</Button><Button onClick={() => { setForm({ edit: live }); setProfile(null); }}><Pencil size={14} />Edit</Button></>}>
        {live && <div className="space-y-5">
          <div className="flex items-center gap-4"><Avatar name={live.name} size={56} /><div><Badge tone={tone(live.status)}>{live.status}</Badge><div className="mt-1 text-on-surface-variant">DOB: {live.dob || "—"}</div></div></div>
          <section><h3 className="t-label-caps mb-2 text-on-surface-variant">Attendance</h3><div className="flex items-center gap-3"><ProgressBar value={pctOf(live)} tone={pctOf(live) >= 75 ? "success" : "danger"} /><span className="font-mono">{pctOf(live)}%</span></div></section>
          <section><h3 className="t-label-caps mb-2 text-on-surface-variant">Guardian</h3>
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm"><dt className="text-outline">Name</dt><dd>{live.guardian}</dd><dt className="text-outline">Relation</dt><dd>{live.relation || "—"}</dd><dt className="text-outline">Phone</dt><dd>{live.phone}</dd><dt className="text-outline">Email</dt><dd>{live.email || "—"}</dd><dt className="text-outline">Login email</dt><dd>{live.guardianEmail || "—"}</dd><dt className="text-outline">Address</dt><dd>{live.address || "—"}</dd></dl></section>
          <section><h3 className="t-label-caps mb-2 text-on-surface-variant">Transport</h3><p className="text-sm">{live.bus ? `${live.bus} · ${live.busStop || "No stop set"}` : <span className="text-on-surface-variant">No bus</span>}</p></section>
          <ParentLoginSection key={live.id} s={live} students={rows} users={users} consents={consents} />
        </div>}
      </SlideOver>

      {form && <StudentForm key={form.edit?.id ?? "new"} edit={form.edit} existing={all.rows} users={users} onClose={() => setForm(null)}
        onSave={async (v) => { try {
          // only the form's own fields are written: guardianUids (Parent login) and bus* (Transport, 14.2) are never sent back
          if (form.edit) { await update(form.edit.id, v as Partial<Student>); toast("Student updated"); }
          // ids continue after every id ever used in the collection, soft-deleted rows included
          else { await create({ ...v, guardianUids: [], id: nextStudentId(all.rows.map((r) => r.id)) } as Student); toast("Student added"); }
          setForm(null);
        } catch { toast("Save failed", "error"); } }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete student?" subtitle={del?.name}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" onClick={confirmDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button></>}>
        <p className="text-on-surface-variant">This permanently removes the student record. This cannot be undone.</p>
      </Modal>
    </div>
  );
}

function StudentForm({ edit, existing, users, onClose, onSave }: { edit?: Student; existing: Student[]; users: SchoolUser[]; onClose: () => void; onSave: (v: StudentDoc) => Promise<void> }) {
  const [f, setF] = useState<StudentFormValues>(() => (edit ? formOf(edit) : blank));
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  // a class change clears the roll, so the student gets the next free roll of the new class unless one is typed
  const set = (k: keyof StudentFormValues, v: string | number) => setF((p) => ({ ...p, [k]: v, ...((k === "grade" || k === "section") && v !== p[k] ? { roll: "" } : {}) }));
  async function submit() {
    const r = validateStudent(f, { existing, edit, users, today: todayIso() });
    setErr(r.errors);
    if (!r.doc) return;
    setSaving(true);
    try { await onSave(r.doc); } finally { setSaving(false); }
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
        <Field label="Roll no." error={err.roll} hint={edit && studentClassId(edit) === studentClassId(f) ? "Blank keeps the current roll" : "Next free roll in the class if blank"}><Input inputMode="numeric" value={f.roll} onChange={(e) => set("roll", e.target.value)} /></Field>
        <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{[...new Set([f.status, ...STATUS])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Attendance %" error={err.attendance}><Input type="number" value={f.attendance} onChange={(e) => set("attendance", e.target.value)} /></Field>
        <h3 className="t-label-caps sm:col-span-2 mt-2 text-on-surface-variant">Guardian</h3>
        <Field label="Guardian name" required error={err.guardian}><Input value={f.guardian} onChange={(e) => set("guardian", e.target.value)} /></Field>
        <Field label="Relation"><Select value={f.relation} onChange={(e) => set("relation", e.target.value)}>{[...new Set([...(f.relation ? [f.relation] : []), "Father", "Mother", "Parent", "Guardian"])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Phone" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxxxxxxx" /></Field>
        <Field label="Email" error={err.email}><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Parent app login email" error={err.guardianEmail} className="sm:col-span-2" hint="Used by Create & invite in the student profile (Parent login). Stored lowercase.">
          <Input type="email" value={f.guardianEmail} onChange={(e) => set("guardianEmail", e.target.value)} placeholder="guardian@example.com" /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
      </div>
    </SlideOver>
  );
}
