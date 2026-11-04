"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, KeyRound, Mail, PauseCircle, PlayCircle, Plus, Trash2, UserMinus } from "lucide-react";
import { Badge, Button, Card, CardHeader, DataTable, EmptyState, Field, Input, Modal, Select, Stat, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { schoolConsoleUrl } from "@edvio/shared/sites";
import { addAdminLogin, deleteSchool, ownerError, reactivateSchool, removeAccess, sendReset, setPassword, suspendSchool, updatePlatform } from "./api";
import { forgetSchool, loadCounts, loadProfile, usePlatformSchools, useSchoolCollection, useSchoolUsers } from "./data";
import { EMAIL, fmtDate, generatePassword, MIN_ADMIN_PASSWORD, PLANS, type PlatformUser, type SchoolCounts, type SchoolProfile } from "./logic";

type Student = { id: string; name?: string; grn?: string; grade?: string; section?: string; guardian?: string; phone?: string; status?: string };
type Staff = { id: string; name?: string; empId?: string; department?: string; designation?: string; role?: string; email?: string; phone?: string; status?: string; authUid?: string };
type ClassRow = { id: string; grade?: string; section?: string; classTeacher?: string; room?: string; studentCount?: number };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", teacher: "Teacher", parent: "Parent", driver: "Driver", attendant: "Bus attendant" };
const statusTone = (s?: string) => (!s || /active|present/i.test(s) ? "success" : /leave|pending/i.test(s) ? "warning" : "neutral");

export function SchoolDetail({ sid }: { sid: string }) {
  const router = useRouter();
  const toast = useToast();
  const platform = usePlatformSchools();
  const p = platform.rows.find((x) => x.id === sid);
  const users = useSchoolUsers(sid);
  const students = useSchoolCollection<Student>(sid, "students");
  const staff = useSchoolCollection<Staff>(sid, "staff");
  const classes = useSchoolCollection<ClassRow>(sid, "classes");
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [counts, setCounts] = useState<SchoolCounts | null>(null);
  useEffect(() => { forgetSchool(sid); loadProfile(sid).then(setProfile); loadCounts(sid).then(setCounts); }, [sid]);
  const [tab, setTab] = useState("overview");
  const admins = users.rows.filter((u) => u.role === "admin");
  const name = profile?.name || p?.name || admins[0]?.name || "School";
  const suspended = p?.status === "suspended";
  const missing = users.ready && platform.ready && !p && !profile?.exists && users.rows.length === 0;

  // dialogs
  const [pwFor, setPwFor] = useState<PlatformUser | null>(null);
  const [addAdmin, setAddAdmin] = useState(false);
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [removeFor, setRemoveFor] = useState<PlatformUser | null>(null);

  const reset = async (u: PlatformUser) => { if (!u.email) return; try { await sendReset(u.email); toast(`Reset link sent to ${u.email}`); } catch (e) { toast(ownerError(e), "error"); } };
  const reactivate = async () => { try { await reactivateSchool(sid, name); toast(`${name} is active again`); } catch (e) { toast(ownerError(e), "error"); } };

  if (missing) return <Card><EmptyState title="School not found" hint="It may have been deleted." action={<Link href="/owner/schools"><Button size="sm">Back to schools</Button></Link>} /></Card>;

  const loginCols: Column<PlatformUser>[] = [
    { key: "email", header: "Login", sortValue: (u) => u.email ?? "", render: (u) => <div><p className="font-medium">{u.email || "—"}</p><p className="text-xs text-on-surface-variant">{u.name || ""}</p></div> },
    { key: "role", header: "Role", sortValue: (u) => u.role, render: (u) => <Badge tone={u.role === "admin" ? "brand" : "neutral"}>{ROLE_LABEL[u.role] ?? u.role}</Badge> },
    { key: "created", header: "Created", sortValue: (u) => u.createdAt ?? "", render: (u) => fmtDate(u.createdAt) },
    { key: "act", header: "", className: "text-right", render: (u) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={() => setPwFor(u)} aria-label={`Set password for ${u.email}`}><KeyRound size={14} />Set password</Button>
        {u.email && <Button size="sm" variant="ghost" onClick={() => reset(u)} aria-label={`Email a reset link to ${u.email}`}><Mail size={14} /></Button>}
        <Button size="sm" variant="ghost" onClick={() => setRemoveFor(u)} aria-label={`Remove access of ${u.email}`}><UserMinus size={14} /></Button>
      </div>) },
  ];
  const studentCols: Column<Student>[] = [
    { key: "name", header: "Student", sortValue: (s) => (s.name ?? "").toLowerCase(), render: (s) => <span className="font-medium">{s.name}</span> },
    { key: "grn", header: "GRN", sortValue: (s) => s.grn ?? "" },
    { key: "class", header: "Class", sortValue: (s) => `${(s.grade ?? "").padStart(2, "0")}${s.section ?? ""}`, render: (s) => s.grade ? `${s.grade}${s.section ? `-${s.section}` : ""}` : "—" },
    { key: "guardian", header: "Guardian", render: (s) => <div><p>{s.guardian || "—"}</p><p className="text-xs text-on-surface-variant">{s.phone}</p></div> },
    { key: "status", header: "Status", render: (s) => <Badge tone={statusTone(s.status)}>{s.status || "Active"}</Badge> },
  ];
  const staffCols: Column<Staff>[] = [
    { key: "name", header: "Name", sortValue: (s) => (s.name ?? "").toLowerCase(), render: (s) => <div><p className="font-medium">{s.name}</p><p className="text-xs text-on-surface-variant">{s.empId}</p></div> },
    { key: "role", header: "Role", sortValue: (s) => s.designation ?? s.role ?? "", render: (s) => <div><p>{s.designation || s.role || "—"}</p><p className="text-xs text-on-surface-variant">{s.department}</p></div> },
    { key: "contact", header: "Contact", render: (s) => <div><p>{s.email || "—"}</p><p className="text-xs text-on-surface-variant">{s.phone}</p></div> },
    { key: "login", header: "App login", render: (s) => s.authUid ? <Badge tone="success">Yes</Badge> : <Badge>No</Badge> },
    { key: "status", header: "Status", render: (s) => <Badge tone={statusTone(s.status)}>{s.status || "Active"}</Badge> },
  ];
  const classCols: Column<ClassRow>[] = [
    { key: "name", header: "Class", sortValue: (c) => `${(c.grade ?? "").padStart(2, "0")}${c.section ?? ""}`, render: (c) => <span className="font-medium">{c.grade ? `${c.grade}-${c.section ?? ""}` : c.id}</span> },
    { key: "teacher", header: "Class teacher", render: (c) => c.classTeacher || "—" },
    { key: "room", header: "Room", render: (c) => c.room || "—" },
    { key: "count", header: "Students", sortValue: (c) => c.studentCount ?? 0, render: (c) => c.studentCount ?? "—" },
  ];

  return (
    <div>
      <Link href="/owner/schools" className="mb-3 inline-flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"><ArrowLeft size={14} />Schools</Link>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="t-headline-lg">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {suspended ? <Badge tone="danger">Suspended</Badge> : <Badge tone="success">Active</Badge>}
            {p?.plan && <Badge tone="brand">{p.plan}</Badge>}
            {profile && (profile.setupComplete ? <Badge tone="success">Setup done</Badge> : <Badge tone="warning">Setup pending</Badge>)}
            <span className="text-xs text-outline">School id {sid}</span>
          </div>
          {suspended && p?.reason && <p className="mt-2 text-sm text-error">Reason: {p.reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={schoolConsoleUrl(sid)} className="inline-flex items-center justify-center gap-2 rounded bg-secondary px-4 py-2 text-sm font-semibold text-on-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-secondary"><ExternalLink size={16} />Open school console</a>
          {suspended ? <Button variant="outline" onClick={reactivate}><PlayCircle size={16} />Reactivate</Button>
            : <Button variant="outline" onClick={() => setSuspendOpen(true)}><PauseCircle size={16} />Suspend</Button>}
          <Button variant="danger" onClick={() => setDeleteOpen(true)}><Trash2 size={16} />Delete</Button>
        </div>
      </div>

      <Tabs variant="underline" className="mb-6" value={tab} onChange={setTab} items={[
        { id: "overview", label: "Overview" },
        { id: "students", label: "Students", count: students.ready ? students.rows.length : undefined },
        { id: "staff", label: "Staff", count: staff.ready ? staff.rows.length : undefined },
        { id: "classes", label: "Classes", count: classes.ready ? classes.rows.length : undefined },
        { id: "logins", label: "Logins", count: users.ready ? users.rows.length : undefined },
        { id: "settings", label: "Plan & notes" },
      ]} />

      {tab === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Students" value={counts ? counts.students.toLocaleString("en-IN") : "…"} />
            <Stat label="Staff" value={counts ? counts.staff.toLocaleString("en-IN") : "…"} />
            <Stat label="Classes" value={counts ? counts.classes.toLocaleString("en-IN") : "…"} />
            <Stat label="Logins" value={users.ready ? users.rows.length : "…"} sub={`${admins.length} admin`} />
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader title="School profile" />
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 px-5 pb-5 text-sm">
                {([["City", profile?.city || p?.city], ["Board", profile?.board || p?.board], ["Academic year", profile?.academicYear], ["Phone", p?.phone], ["Plan", p?.plan], ["Added", fmtDate(p?.createdAt || admins[0]?.createdAt)]] as const).map(([k, val]) => (
                  <div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="font-medium">{val || "—"}</dd></div>))}
              </dl>
              {!p && <p className="border-t border-outline-variant/60 px-5 py-3 text-xs text-on-surface-variant">This school signed up by itself. Saving its plan registers it on the platform.</p>}
            </Card>
            <Card>
              <CardHeader title="Admin logins" subtitle="They sign in to the school console with their email and password." actions={<Button size="sm" variant="outline" onClick={() => setAddAdmin(true)}><Plus size={14} />Add admin</Button>} />
              {admins.length === 0 ? <EmptyState title="No admin login" hint="Add one so somebody can run this school." /> : (
                <ul className="divide-y divide-outline-variant/60">
                  {admins.map((u) => (
                    <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div className="min-w-0"><p className="truncate font-medium">{u.email}</p><p className="text-xs text-on-surface-variant">{u.name}{u.id === sid ? " · first admin" : ""}</p></div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setPwFor(u)}><KeyRound size={14} />Set password</Button>
                        <Button size="sm" variant="ghost" onClick={() => reset(u)} aria-label={`Email a reset link to ${u.email}`}><Mail size={14} /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "students" && <Card className="pt-4"><DataTable rows={students.rows} columns={studentCols} pageSize={15} searchText={(s) => `${s.name} ${s.grn} ${s.guardian} ${s.phone}`} empty={<EmptyState title={students.ready ? "No students yet" : "Loading…"} />} /></Card>}
      {tab === "staff" && <Card className="pt-4"><DataTable rows={staff.rows} columns={staffCols} pageSize={15} searchText={(s) => `${s.name} ${s.empId} ${s.email} ${s.department} ${s.designation}`} empty={<EmptyState title={staff.ready ? "No staff yet" : "Loading…"} />} /></Card>}
      {tab === "classes" && <Card className="pt-4"><DataTable rows={classes.rows} columns={classCols} pageSize={20} empty={<EmptyState title={classes.ready ? "No classes yet" : "Loading…"} />} /></Card>}
      {tab === "logins" && <Card className="pt-4"><DataTable rows={users.rows} columns={loginCols} pageSize={15} searchText={(u) => `${u.email} ${u.name} ${u.role}`} toolbar={<Button size="sm" variant="outline" onClick={() => setAddAdmin(true)}><Plus size={14} />Add admin</Button>} empty={<EmptyState title={users.ready ? "No logins" : "Loading…"} />} /></Card>}
      {tab === "settings" && <PlanForm key={p?.updatedAt ?? "new"} sid={sid} name={name} plan={p?.plan ?? ""} note={p?.note ?? ""} city={p?.city ?? profile?.city ?? ""} phone={p?.phone ?? ""} adminEmail={p?.adminEmail ?? admins[0]?.email ?? ""} />}

      <PasswordModal user={pwFor} onClose={() => setPwFor(null)} />
      <AddAdminModal open={addAdmin} sid={sid} onClose={() => setAddAdmin(false)} />
      <SuspendModal open={suspendOpen} sid={sid} name={name} onClose={() => setSuspendOpen(false)} />
      <DeleteModal open={deleteOpen} sid={sid} name={name} onClose={() => setDeleteOpen(false)} onDeleted={() => router.push("/owner/schools")} />
      <Modal open={!!removeFor} onClose={() => setRemoveFor(null)} title="Remove access?" subtitle={removeFor?.email}
        footer={<><Button variant="outline" onClick={() => setRemoveFor(null)}>Cancel</Button><Button variant="danger" onClick={async () => {
          if (!removeFor) return;
          try { await removeAccess(removeFor.id); toast(`${removeFor.email} can no longer open ${name}`); setRemoveFor(null); } catch (e) { toast(ownerError(e), "error"); }
        }}>Remove access</Button></>}>
        <p className="text-on-surface-variant">This login will no longer open {name}. Staff and parent records stay as they are.{removeFor?.role === "admin" && admins.length <= 1 ? " This is the school's only admin, so nobody will be able to run the school until you add another." : ""}</p>
      </Modal>
    </div>
  );
}

function PlanForm({ sid, name, ...init }: { sid: string; name: string; plan: string; note: string; city: string; phone: string; adminEmail: string }) {
  const toast = useToast();
  const [v, setV] = useState(init);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await updatePlatform(sid, { name, plan: v.plan, note: v.note.trim(), city: v.city.trim(), phone: v.phone.trim(), adminEmail: v.adminEmail }); toast("Saved"); }
    catch (e) { toast(ownerError(e), "error"); } finally { setSaving(false); }
  };
  return (
    <Card className="max-w-2xl">
      <CardHeader title="Plan and notes" subtitle="Only product owners see these. The school sees its status, not your notes." />
      <div className="grid gap-4 px-5 pb-5 sm:grid-cols-2">
        <Field label="Plan"><Select value={v.plan} onChange={(e) => setV({ ...v, plan: e.target.value })}><option value="">No plan</option>{PLANS.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Field label="Phone"><Input value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></Field>
        <Field label="City" className="sm:col-span-2"><Input value={v.city} onChange={(e) => setV({ ...v, city: e.target.value })} /></Field>
        <Field label="Internal notes" hint="Contract, contacts, follow-ups. Up to 2000 characters." className="sm:col-span-2"><Textarea maxLength={2000} value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
        <div className="flex justify-end sm:col-span-2"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
      </div>
    </Card>
  );
}

function PasswordModal({ user, onClose }: { user: PlatformUser | null; onClose: () => void }) {
  const toast = useToast();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setPw(""); setErr(""); onClose(); };
  const save = async () => {
    if (!user) return;
    if (pw.length < MIN_ADMIN_PASSWORD) return setErr(`Use at least ${MIN_ADMIN_PASSWORD} characters.`);
    setBusy(true);
    try { await setPassword(user.id, pw); toast(`New password set for ${user.email}`); close(); } catch (e) { setErr(ownerError(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!user} onClose={close} title="Set a new password" subtitle={user?.email}
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Set password"}</Button></>}>
      <Field label="New password" hint="Share it with the person directly. They can change it from My Profile." error={err}>
        <div className="flex gap-2"><Input value={pw} onChange={(e) => { setPw(e.target.value); setErr(""); }} className="font-mono" autoComplete="new-password" />
          <Button type="button" variant="outline" onClick={() => setPw(generatePassword())}>Generate</Button></div>
      </Field>
    </Modal>
  );
}

function AddAdminModal({ open, sid, onClose }: { open: boolean; sid: string; onClose: () => void }) {
  const toast = useToast();
  const [v, setV] = useState({ name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const close = () => { setV({ name: "", email: "", password: "" }); setErr(""); onClose(); };
  const save = async () => {
    if (v.name.trim().length < 2) return setErr("Enter the admin's name.");
    if (!EMAIL.test(v.email.trim())) return setErr("Enter a valid email.");
    if (v.password.length < MIN_ADMIN_PASSWORD) return setErr(`The password needs at least ${MIN_ADMIN_PASSWORD} characters.`);
    setBusy(true);
    try { await addAdminLogin(sid, v); toast(`${v.email.trim()} can now sign in as an admin`); close(); } catch (e) { setErr(ownerError(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} title="Add an admin login" subtitle="Another person who can run this school"
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={save} disabled={busy}>{busy ? "Creating…" : "Create login"}</Button></>}>
      <div className="space-y-3">
        <Field label="Name"><Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></Field>
        <Field label="Email (sign-in id)"><Input type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoComplete="off" /></Field>
        <Field label="Password"><div className="flex gap-2"><Input value={v.password} onChange={(e) => setV({ ...v, password: e.target.value })} className="font-mono" autoComplete="new-password" />
          <Button type="button" variant="outline" onClick={() => setV({ ...v, password: generatePassword() })}>Generate</Button></div></Field>
        {err && <p role="alert" className="text-sm text-error">{err}</p>}
      </div>
    </Modal>
  );
}

function SuspendModal({ open, sid, name, onClose }: { open: boolean; sid: string; name: string; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await suspendSchool(sid, name, reason); toast(`${name} is suspended`); setReason(""); onClose(); } catch (e) { toast(ownerError(e), "error"); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Suspend ${name}?`} subtitle="Reversible: reactivate it any time"
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={save} disabled={busy}>{busy ? "Suspending…" : "Suspend school"}</Button></>}>
      <p className="mb-3 text-on-surface-variant">Its admins, teachers, parents and bus crew are signed out and cannot open any of its data. Nothing is deleted.</p>
      <Field label="Reason" hint="Kept on the school's platform record."><Textarea maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Unpaid invoice for October" /></Field>
    </Modal>
  );
}

function DeleteModal({ open, sid, name, onClose, onDeleted }: { open: boolean; sid: string; name: string; onClose: () => void; onDeleted: () => void }) {
  const toast = useToast();
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ok = useMemo(() => typed.trim() === name.trim(), [typed, name]);
  const close = () => { setTyped(""); setErr(""); onClose(); };
  const del = async () => {
    setBusy(true); setErr("");
    try { const r = await deleteSchool(sid); forgetSchool(sid); toast(`${name} deleted (${r.data.logins} logins removed)`); close(); onDeleted(); }
    catch (e) { setErr(ownerError(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={close} title={`Delete ${name}?`} subtitle="This cannot be undone"
      footer={<><Button variant="outline" onClick={close}>Cancel</Button><Button variant="danger" onClick={del} disabled={!ok || busy}>{busy ? "Deleting…" : "Delete school for good"}</Button></>}>
      <p className="mb-3 text-on-surface-variant">Every login of this school (admins, teachers, parents, bus crew), all of its students, staff, fees, exams, messages and files are removed. Suspend the school instead if you may need it again.</p>
      <Field label={`Type the school name to confirm: ${name}`} error={err}><Input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" /></Field>
    </Modal>
  );
}
