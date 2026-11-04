"use client";
import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Briefcase, CalendarOff, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
import { deleteDoc, doc, writeBatch } from "firebase/firestore";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, PageHeader, SearchBox, Select, SlideOver, Stat, Tabs, Textarea, useToast, type Column } from "@/components/ui";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { auth, db } from "@/lib/firebase";
import { accountError, createAccount, sendInvite } from "@/lib/staffAccount";
import { fmtDate } from "@/lib/format";
import { StaffLeavesPanel } from "./StaffLeavesPanel";
import { CheckinsPanel } from "./CheckinsPanel";
import { localDate, localToday, useLeavePolicy } from "./checkins";
import { useNow } from "@/lib/useNow";
import { leaveDays, recordedLeave, validateRecordLeave, type StaffLeave } from "./leaves";
import { effectiveStatus, nextStaffId, staffBody, validateStaff, type StaffDraft } from "./staffLogic";

export type Staff = { id: string; name: string; empId: string; department: string; role: string; status: string; phone: string; email?: string; authUid?: string; designation?: string; subjects?: string; joined?: string; leaveFrom?: string; leaveTo?: string; leaveReason?: string };
const DEPTS = ["Administration", "English", "Hindi", "Mathematics", "Physical Education", "Science", "Social Science"];
const ROLES = ["Clerk", "Coordinator", "HOD", "Lab Assistant", "PGT", "PRT", "TGT"];

export function StaffView() {
  const toast = useToast();
  const { rows, ready, update, remove } = useCollection<Staff>("staff");
  const [q, setQ] = useState(""); const [dept, setDept] = useState(""); const [status, setStatus] = useState("");
  const [form, setForm] = useState<{ edit?: Staff } | null>(null);
  const [leave, setLeave] = useState<Staff | null>(null);
  const [del, setDel] = useState<Staff | null>(null);
  // deep-linkable: /staff?tab=leaves | /staff?tab=checkins
  const params = useSearchParams(); const router = useRouter(); const path = usePathname();
  const tab = ["leaves", "checkins"].includes(params.get("tab") ?? "") ? params.get("tab")! : "directory";
  const setTab = (t: string) => router.replace(t === "directory" ? path : `${path}?tab=${t}`, { scroll: false });
  const [busy, setBusy] = useState<string | null>(null);
  const leaveCol = useCollection<StaffLeave>("staff_leaves");
  const leaves = leaveCol.rows;
  const pendingLeaves = leaves.filter((l) => l.status === "Pending").length;
  const now = useNow();
  const today = localDate(new Date(now));
  const statusOf = (s: Staff) => effectiveStatus(s, leaves, today);
  const pendingRegs = useCollection<{ id: string; status: string }>("staff_regularizations").rows.filter((r) => r.status === "Pending").length;

  /** Creates the Auth login + users/{uid} for `email`, then links it to staff `id` (creating the staff doc when `fresh`). All-or-nothing. */
  async function provision(id: string, body: Partial<Staff> & { name: string; email: string }, fresh: boolean) {
    const sid = currentSchoolId(); if (!sid) throw new Error("Not signed in");
    const acct = await createAccount(body.email);
    try {
      const batch = writeBatch(db);
      const stamp = { updatedAt: new Date().toISOString(), updatedBy: auth.currentUser?.uid ?? "" };
      batch.set(doc(db, "users", acct.uid), { schoolId: sid, role: "teacher", staffId: id, email: body.email.trim(), name: body.name, createdAt: new Date().toISOString() });
      const ref = doc(db, "schools", sid, "staff", id);
      if (fresh) batch.set(ref, { ...body, id, authUid: acct.uid, ...stamp, _o: Date.parse(stamp.updatedAt) }); else batch.set(ref, { ...body, authUid: acct.uid, ...stamp }, { merge: true });
      await batch.commit();
    } catch (e) { await acct.rollback(); throw e; }
    let invited = true;
    try { await sendInvite(body.email); } catch { invited = false; }
    await acct.finish();
    return invited;
  }
  const report = (e: unknown) => toast(accountError(e), "error");
  const invited = (ok: boolean, email: string) => ok ? toast(`Login created. Password email sent to ${email}`) : toast("Login created, but the password email could not be sent. Use Resend invite.", "error");
  async function createLogin(s: Staff) {
    if (!s.email) { setForm({ edit: s }); toast("Add an email first", "error"); return; }
    setBusy(s.id);
    try { invited(await provision(s.id, { name: s.name, email: s.email }, false), s.email); } catch (e) { report(e); } finally { setBusy(null); }
  }
  async function resend(s: Staff) {
    if (!s.email) return;
    setBusy(s.id);
    try { await sendInvite(s.email); toast(`Password email sent to ${s.email}`); } catch (e) { report(e); } finally { setBusy(null); }
  }
  async function removeStaff(s: Staff) {
    const sid = currentSchoolId();
    setBusy(s.id);
    try {
      await remove(s.id);
      if (s.authUid && sid) await deleteDoc(doc(db, "users", s.authUid)).catch(() => {}); // revoke access (the Auth user itself needs the Firebase console)
      toast("Staff removed"); setDel(null);
    } catch { toast("Could not delete the staff member", "error"); } finally { setBusy(null); }
  }
  async function markReturned(s: Staff) {
    setBusy(s.id);
    try { await update(s.id, { status: "Active", leaveFrom: "", leaveTo: "", leaveReason: "" }); toast("Marked as returned"); }
    catch { toast("Could not update the leave status", "error"); } finally { setBusy(null); }
  }

  const view = rows.filter((s) => (!dept || s.department === dept) && (!status || statusOf(s).status === status)
    && (!q || `${s.name} ${s.empId} ${s.role} ${s.department}`.toLowerCase().includes(q.toLowerCase())));

  const cols: Column<Staff>[] = [
    { key: "name", header: "Staff member", sortValue: (s) => s.name, render: (s) => <div className="flex items-center gap-3"><Avatar name={s.name.replace(/^(Mr|Mrs|Ms|Dr)\.? /, "")} /><div><div className="font-semibold">{s.name}</div><div className="t-caption font-mono text-outline">{s.empId}</div></div></div> },
    { key: "department", header: "Department", sortValue: (s) => s.department, render: (s) => s.department },
    { key: "role", header: "Role", sortValue: (s) => s.role, render: (s) => <span className="rounded bg-surface-container px-2 py-1 text-xs font-medium">{s.role}</span> },
    { key: "email", header: "Email / login", sortValue: (s) => s.email ?? "", render: (s) => (
      <div><div className="max-w-[220px] truncate text-sm">{s.email || <span className="text-outline">No email</span>}</div>
        {s.authUid ? <Badge tone="success">Login active</Badge> : s.email ? <Badge tone="warning">No login yet</Badge> : <Badge>Email needed</Badge>}</div>) },
    { key: "status", header: "Leave status", sortValue: (s) => statusOf(s).status, render: (s) => { const st = statusOf(s); return st.status === "On leave"
      ? <div><Badge tone="warning">On leave</Badge>{st.until && <div className="t-caption mt-0.5 text-outline">until {fmtDate(st.until)}</div>}</div> : <Badge tone="success">{st.status}</Badge>; } },
    { key: "actions", header: "", className: "text-right", render: (s) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {s.authUid ? <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => resend(s)}>Resend invite</Button>
          : <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => createLogin(s)}>Create login</Button>}
        {s.status === "On leave"
          ? <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => markReturned(s)}>Mark returned</Button>
          : <Button size="sm" variant="outline" onClick={() => setLeave(s)}>Leave</Button>}
        <Button size="sm" variant="ghost" aria-label={`Edit ${s.name}`} onClick={() => setForm({ edit: s })}><Pencil size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label={`Delete ${s.name}`} onClick={() => setDel(s)}><Trash2 size={14} className="text-error" /></Button>
      </div>) },
  ];

  return (
    <div>
      <PageHeader title="Staff & HR" subtitle="Faculty and administrative staff records, departments and leave status." actions={<Button onClick={() => setForm({})}><Plus size={16} />Add Staff</Button>} />
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="Total staff" value={rows.length} icon={<Briefcase size={16} />} />
        <Stat label="Active today" value={rows.filter((s) => statusOf(s).status === "Active").length} icon={<UserCheck size={16} />} />
        <Stat label="On leave" value={rows.filter((s) => statusOf(s).status === "On leave").length} icon={<CalendarOff size={16} />} />
      </div>
      <Tabs className="mb-4" value={tab} onChange={setTab} items={[{ id: "directory", label: "Directory", count: rows.length }, { id: "leaves", label: "Leave requests", count: pendingLeaves }, { id: "checkins", label: "Check-ins", count: pendingRegs }]} />
      {tab === "leaves" ? <StaffLeavesPanel staff={rows} /> : tab === "checkins" ? <CheckinsPanel staff={rows} /> : <>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name, ID or role…" className="w-full max-w-xs" />
          <Select aria-label="Department" value={dept} onChange={(e) => setDept(e.target.value)} className="w-48"><option value="">All departments</option>{[...new Set([...DEPTS, ...rows.map((r) => r.department).filter(Boolean)])].sort().map((d) => <option key={d}>{d}</option>)}</Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="">All statuses</option><option>Active</option><option>On leave</option></Select>
        </div>
        {ready ? <DataTable rows={view} columns={cols} pageSize={10}
          empty={<EmptyState title={rows.length ? "No staff match" : "No staff yet"} hint={rows.length ? "Try changing your search or filters." : "Add a staff member to get started."} />} />
          : <p className="px-5 pb-5 text-on-surface-variant">Loading staff…</p>}
      </Card></>}
      {form && <StaffForm key={form.edit?.id ?? "new"} edit={form.edit} rows={rows} onClose={() => setForm(null)}
        onSave={async (v) => {
          try {
            if (form.edit) { await update(form.edit.id, v); toast("Staff updated"); setForm(null); return; }
            const id = nextStaffId(rows);
            invited(await provision(id, { ...v, name: v.name!, email: v.email!, status: "Active" }, true), v.email!);
            setForm(null);
          } catch (e) { report(e); } // nothing is left half-created: provision() rolls the Auth user back
        }} />}
      {leave && <LeaveModal s={leave} leaves={leaves} onClose={() => setLeave(null)} onSave={async (v) => {
        try {
          // the leave itself goes to staff_leaves (Approved), so the teacher app's balance and Check-ins see it;
          // the staff doc is marked "On leave" only while the leave includes today
          await leaveCol.create(recordedLeave({ staffId: leave.id, ...v }, auth.currentUser?.uid ?? ""));
          const now = v.from <= today && v.to >= today;
          if (now) await update(leave.id, { status: "On leave", leaveFrom: v.from, leaveTo: v.to, leaveReason: v.reason || v.type });
          toast(now ? `${leave.name} marked on leave` : `Leave recorded for ${leave.name}`); setLeave(null);
        } catch { toast("Could not record the leave", "error"); } }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete staff member?" subtitle={del?.name}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" disabled={!!del && busy === del.id} onClick={() => del && removeStaff(del)}>Delete</Button></>}>
        <p className="text-on-surface-variant">This removes the staff record permanently{del?.authUid ? " and revokes their app access." : "."}</p></Modal>
    </div>
  );
}

function StaffForm({ edit, rows, onClose, onSave }: { edit?: Staff; rows: Staff[]; onClose: () => void; onSave: (v: Partial<Staff>) => void | Promise<void> }) {
  const [f, setF] = useState<StaffDraft>({ name: edit?.name ?? "", empId: edit?.empId ?? "", department: edit?.department ?? DEPTS[0]!, role: edit?.role ?? "TGT", phone: edit?.phone ?? "", email: edit?.email ?? "", designation: edit?.designation ?? "", subjects: edit?.subjects ?? "", joined: edit?.joined ?? "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const locked = !!edit?.authUid; // the login email cannot change once the account exists
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  async function submit() {
    const e = validateStaff(f, rows, edit?.id, localToday());
    setErr(e); if (Object.keys(e).length) return;
    const body: Partial<Staff> = staffBody(f, rows);
    if (locked) body.email = edit!.email; // the login email is fixed once the account exists
    setSaving(true);
    try { await onSave(body); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={edit ? "Edit Staff" : "Add Staff"} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save Changes" : "Add Staff & Create Login"}</Button></>}>
      <div className="space-y-4">
        <Field label="Full name" required error={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Employee ID" hint="Auto-generated if blank" error={err.empId}><Input value={f.empId} onChange={(e) => set("empId", e.target.value)} /></Field>
        <Field label="Department"><Select value={f.department} onChange={(e) => set("department", e.target.value)}>{[...new Set([f.department, ...DEPTS])].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Role"><Select value={f.role} onChange={(e) => set("role", e.target.value)}>{[...new Set([f.role, ...ROLES])].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Phone" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Email (teacher login)" required error={err.email} hint={locked ? "Login already created; the email cannot be changed here." : edit ? "Use the Create login action in the list after saving." : "A login is created and a password email is sent to this address."}>
          <Input type="email" value={f.email} disabled={locked} onChange={(e) => set("email", e.target.value)} /></Field>
        <div className="rounded-lg bg-surface-container-low p-3 text-sm"><span className="text-on-surface-variant">Account status: </span>
          {edit?.authUid ? <Badge tone="success">Login active</Badge> : edit ? <Badge tone="warning">No login yet</Badge> : <Badge>Created on save</Badge>}</div>
        <Field label="Designation"><Input value={f.designation} onChange={(e) => set("designation", e.target.value)} placeholder="e.g. Senior Faculty" /></Field>
        <Field label="Subjects"><Input value={f.subjects} onChange={(e) => set("subjects", e.target.value)} placeholder="e.g. Math & Science" /></Field>
        <Field label="Joined" error={err.joined}><Input type="date" value={f.joined} onChange={(e) => set("joined", e.target.value)} /></Field>
      </div>
    </SlideOver>
  );
}

function LeaveModal({ s, leaves, onClose, onSave }: { s: Staff; leaves: StaffLeave[]; onClose: () => void; onSave: (v: { type: string; from: string; to: string; reason: string }) => Promise<void> }) {
  const today = localToday(); // local date (toISOString is UTC and gives yesterday early in the morning in India)
  const { types } = useLeavePolicy();
  const [from, setFrom] = useState(today); const [to, setTo] = useState(today);
  const [type, setType] = useState(types[0]?.type ?? "Casual Leave"); const [reason, setReason] = useState("");
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const days = leaveDays(from, to);
  return (
    <Modal open onClose={onClose} title="Record leave" subtitle={s.name} footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button disabled={saving} onClick={async () => {
      const e = validateRecordLeave({ from, to, type }, leaves, s.id);
      setErr(e); if (Object.keys(e).length) return;
      setSaving(true); try { await onSave({ type, from, to, reason: reason.trim() }); } finally { setSaving(false); } }}>{saving ? "Saving…" : "Mark on leave"}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="From" error={err.from}><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setErr({}); }} /></Field>
        <Field label="To" error={err.to ?? (from && to && to < from ? "End date is before start" : undefined)} hint={days ? `${days} day${days === 1 ? "" : "s"} (Sundays not counted)` : undefined}><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setErr({}); }} /></Field>
        <Field label="Leave type" className="sm:col-span-2" error={err.type}><Select value={type} onChange={(e) => setType(e.target.value)}>{[...new Set([...types.map((t) => t.type), type])].map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Reason" className="sm:col-span-2"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Medical leave, certificate submitted" /></Field>
      </div>
      <p className="mt-3 text-xs text-outline">Saved as an approved leave request: it counts against the teacher&apos;s leave balance in the app.</p>
    </Modal>
  );
}
