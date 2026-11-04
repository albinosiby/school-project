"use client";
// Transport > Drivers / Bus staff: tr_crew CRUD with driver-app logins (contract 14.1; provisioning mirrors Staff & HR).
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { deleteDoc, deleteField, doc, writeBatch } from "firebase/firestore";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, Field, Input, Modal, SearchBox, Select, SlideOver, useToast, type Column, type Tone } from "@/components/ui";
import { currentSchoolId, useCollection } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import { accountError, createAccount, sendInvite } from "@/lib/staffAccount";
import { fmtDate } from "@/lib/format";
import { nextId, todayIso } from "@/features/ops/shared";
import { ROLE_LABEL, applyAllot, busLabel, isLicenseWarning, planAllot, schoolDoc, stamp } from "./shared";
import { validateCrew } from "./logic";
import type { Bus, Crew, CrewRole, CrewStatus } from "./types";

const statusTone: Record<CrewStatus, Tone> = { Active: "success", "On leave": "warning", Inactive: "neutral" };

export function CrewPanel({ role }: { role: CrewRole }) {
  const toast = useToast();
  const { rows: all, ready, update } = useCollection<Crew>("tr_crew");
  const buses = useCollection<Bus>("tr_buses").rows;
  const rows = useMemo(() => all.filter((c) => c.role === role), [all, role]);
  const [q, setQ] = useState(""); const [status, setStatus] = useState(""); const [busF, setBusF] = useState("");
  const [form, setForm] = useState<{ edit?: Crew } | null>(null);
  const [del, setDel] = useState<Crew | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const today = todayIso();
  const label = ROLE_LABEL[role];
  const emailTaken = (email: string, exceptId?: string) => all.some((r) => r.id !== exceptId && (r.email ?? "").trim().toLowerCase() === email.trim().toLowerCase());
  const empIdTaken = (empId: string, exceptId?: string) => all.some((r) => r.id !== exceptId && (r.empId ?? "").trim().toLowerCase() === empId.trim().toLowerCase());
  const nextEmpId = () => { let k = 1000 + all.length; while (empIdTaken(`TR-${k}`)) k++; return `TR-${k}`; };

  /** Creates the Auth login + users/{uid} (role driver|attendant, crewId), then links it to crew `id` (creating the tr_crew doc when `fresh`). All-or-nothing. */
  async function provision(id: string, body: Partial<Crew> & { name: string; email: string }, fresh: boolean, busId = "") {
    const sid = currentSchoolId(); if (!sid) throw new Error("Not signed in");
    const acct = await createAccount(body.email);
    try {
      const batch = writeBatch(db); const st = stamp();
      batch.set(doc(db, "users", acct.uid), { schoolId: sid, role, crewId: id, email: body.email.trim(), name: body.name, createdAt: new Date().toISOString() });
      const ref = doc(db, "schools", sid, "tr_crew", id);
      if (fresh) {
        const plan = planAllot({ id, name: body.name, role, busId: "" }, busId, all, buses);
        const bus = busId ? buses.find((b) => b.id === busId) : undefined;
        batch.set(ref, { ...body, id, role, authUid: acct.uid, ...(bus ? { busId: bus.id, bus: busLabel(bus) } : {}), ...st, _o: Date.now() });
        applyAllot(batch, plan, id);
      } else batch.set(ref, { ...body, authUid: acct.uid, ...st }, { merge: true });
      await batch.commit();
    } catch (e) { await acct.rollback(); throw e; }
    let invited = true;
    try { await sendInvite(body.email); } catch { invited = false; }
    await acct.finish();
    return invited;
  }
  const report = (e: unknown) => toast(accountError(e), "error");
  const invited = (ok: boolean, email: string) => ok ? toast(`Login created. Password email sent to ${email}`) : toast("Login created, but the password email could not be sent. Use Resend invite.", "error");
  async function createLogin(c: Crew) {
    if (!c.email) { setForm({ edit: c }); toast("Add an email first", "error"); return; }
    setBusy(c.id);
    try { invited(await provision(c.id, { name: c.name, email: c.email }, false), c.email); } catch (e) { report(e); } finally { setBusy(null); }
  }
  async function resend(c: Crew) {
    if (!c.email) return;
    setBusy(c.id);
    try { await sendInvite(c.email); toast(`Password email sent to ${c.email}`); } catch (e) { report(e); } finally { setBusy(null); }
  }
  /** edit: saves the crew doc and, when the bus changed, syncs both buses + the displaced crew member in the same batch */
  async function saveEdit(c: Crew, v: Partial<Crew>, busId: string) {
    const batch = writeBatch(db);
    const plan = planAllot({ id: c.id, name: v.name ?? c.name, role, busId: c.busId }, busId, all, buses);
    const own = plan.crew.get(c.id) ?? {};
    batch.update(schoolDoc("tr_crew", c.id), { ...v, ...own, ...stamp() });
    applyAllot(batch, plan, c.id);
    await batch.commit();
  }
  async function removeCrew(c: Crew) {
    setBusy(c.id);
    try {
      const batch = writeBatch(db);
      batch.delete(schoolDoc("tr_crew", c.id));
      const idKey = role === "driver" ? "driverId" : "attendantId", nameKey = role === "driver" ? "driver" : "attendant";
      for (const b of buses.filter((x) => x[idKey] === c.id)) batch.update(schoolDoc("tr_buses", b.id), { [idKey]: deleteField(), [nameKey]: deleteField(), ...stamp() });
      await batch.commit();
      if (c.authUid) await deleteDoc(doc(db, "users", c.authUid)).catch(() => {}); // revoke app access (the Auth user itself needs the Firebase console)
      toast(`${label} removed`); setDel(null);
    } catch { toast(`Could not delete the ${label.toLowerCase()}`, "error"); } finally { setBusy(null); }
  }
  async function markReturned(c: Crew) {
    setBusy(c.id);
    try { await update(c.id, { status: "Active", leaveFrom: "", leaveTo: "", leaveReason: "" }); toast("Marked as returned"); }
    catch { toast("Could not update the leave status", "error"); } finally { setBusy(null); }
  }

  const view = useMemo(() => rows.filter((c) => (!status || c.status === status) && (!busF || (busF === "none" ? !c.busId : c.busId === busF))
    && (!q || `${c.name} ${c.empId} ${c.phone} ${c.email}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, status, busF]);

  const cols: Column<Crew>[] = [
    { key: "name", header: label, sortValue: (c) => c.name, render: (c) => <div className="flex items-center gap-3"><Avatar name={c.name} /><div><div className="font-semibold">{c.name}</div><div className="t-caption font-mono text-outline">{c.empId}</div></div></div> },
    { key: "phone", header: "Phone", sortValue: (c) => c.phone, render: (c) => <span className="font-mono text-sm">{c.phone}</span> },
    { key: "email", header: "Email / login", sortValue: (c) => c.email ?? "", render: (c) => (
      <div><div className="max-w-[220px] truncate text-sm">{c.email || <span className="text-outline">No email</span>}</div>
        {c.authUid ? <Badge tone="success">Login active</Badge> : c.email ? <Badge tone="warning">No login yet</Badge> : <Badge>Email needed</Badge>}</div>) },
    { key: "bus", header: "Bus", sortValue: (c) => c.bus ?? "", render: (c) => c.busId ? <Badge tone="brand">{c.bus || c.busId}</Badge> : <span className="text-outline">Unassigned</span> },
    ...(role === "driver" ? [{ key: "license", header: "License", sortValue: (c: Crew) => c.licenseExpiry ?? "", render: (c: Crew) => { const w = isLicenseWarning(c.licenseExpiry, today);
      return <div><div className="font-mono text-sm">{c.licenseNo || <span className="text-outline">—</span>}</div>
        {c.licenseExpiry && (w === "expired" ? <Badge tone="danger">Expired {fmtDate(c.licenseExpiry)}</Badge> : w === "soon" ? <Badge tone="warning">Expires {fmtDate(c.licenseExpiry)}</Badge> : <div className="t-caption text-outline">valid till {fmtDate(c.licenseExpiry)}</div>)}</div>; } } satisfies Column<Crew>] : []),
    { key: "status", header: "Status", sortValue: (c) => c.status, render: (c) => <div><Badge tone={statusTone[c.status] ?? "neutral"}>{c.status}</Badge>{c.status === "On leave" && c.leaveTo && <div className="t-caption mt-0.5 text-outline">until {fmtDate(c.leaveTo)}</div>}</div> },
    { key: "actions", header: "", className: "text-right", render: (c) => (
      <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
        {c.authUid ? <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => resend(c)}>Resend invite</Button>
          : <Button size="sm" variant="ghost" disabled={busy === c.id} onClick={() => createLogin(c)}>Create login</Button>}
        {c.status === "On leave" && <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => markReturned(c)}>Mark returned</Button>}
        <Button size="sm" variant="ghost" aria-label={`Edit ${c.name}`} onClick={() => setForm({ edit: c })}><Pencil size={14} /></Button>
        <Button size="sm" variant="ghost" aria-label={`Delete ${c.name}`} onClick={() => setDel(c)}><Trash2 size={14} className="text-error" /></Button>
      </div>) },
  ];

  return (
    <>
      <Card className="pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-3 px-5">
          <SearchBox value={q} onChange={setQ} placeholder="Search by name, ID, phone…" className="w-full max-w-xs" />
          <Select aria-label="Bus" value={busF} onChange={(e) => setBusF(e.target.value)} className="w-44"><option value="">All buses</option><option value="none">Unassigned</option>{buses.map((b) => <option key={b.id} value={b.id}>{busLabel(b)}</option>)}</Select>
          <Select aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)} className="w-40"><option value="">All statuses</option><option>Active</option><option>On leave</option><option>Inactive</option></Select>
          <Button className="ml-auto" onClick={() => setForm({})}><Plus size={16} />Add {label}</Button>
        </div>
        {ready ? <DataTable rows={view} columns={cols} pageSize={10}
          empty={<EmptyState title={rows.length ? `No ${label.toLowerCase()} match` : `No ${label.toLowerCase()} yet`} hint={rows.length ? "Try changing your search or filters." : `Add a ${label.toLowerCase()} to create their driver-app login.`} />} />
          : <p className="px-5 pb-5 text-on-surface-variant">Loading…</p>}
      </Card>
      {form && <CrewForm key={form.edit?.id ?? "new"} role={role} edit={form.edit} buses={buses} today={today} nextEmpId={nextEmpId} emailTaken={emailTaken} empIdTaken={empIdTaken} onClose={() => setForm(null)}
        onSave={async (v, busId) => {
          try {
            if (form.edit) { await saveEdit(form.edit, v, busId); toast(`${label} updated`); setForm(null); return; }
            const id = nextId("crw", all.map((r) => r.id));
            invited(await provision(id, { ...v, name: v.name!, email: v.email!, status: "Active" }, true, busId), v.email!);
            setForm(null);
          } catch (e) { report(e); } // nothing is left half-created: provision() rolls the Auth user back
        }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title={`Delete ${label.toLowerCase()}?`} subtitle={del?.name}
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Cancel</Button><Button variant="danger" disabled={!!del && busy === del.id} onClick={() => del && removeCrew(del)}>Delete</Button></>}>
        <p className="text-on-surface-variant">This removes the record permanently{del?.busId ? `, frees their seat on ${del.bus}` : ""}{del?.authUid ? " and revokes their driver-app access." : "."}</p></Modal>
    </>
  );
}

function CrewForm({ role, edit, buses, today, nextEmpId, emailTaken, empIdTaken, onClose, onSave }: { role: CrewRole; edit?: Crew; buses: Bus[]; today: string; nextEmpId: () => string; emailTaken: (email: string, exceptId?: string) => boolean; empIdTaken: (empId: string, exceptId?: string) => boolean; onClose: () => void; onSave: (v: Partial<Crew>, busId: string) => void | Promise<void> }) {
  const [f, setF] = useState({ name: edit?.name ?? "", empId: edit?.empId ?? "", phone: edit?.phone ?? "", email: edit?.email ?? "", licenseNo: edit?.licenseNo ?? "", licenseExpiry: edit?.licenseExpiry ?? "", joined: edit?.joined ?? "", address: edit?.address ?? "", emergencyName: edit?.emergencyName ?? "", emergencyPhone: edit?.emergencyPhone ?? "", busId: edit?.busId ?? "", status: edit?.status ?? "Active" });
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const locked = !!edit?.authUid; // the login email cannot change once the account exists
  const label = ROLE_LABEL[role];
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const seatOf = (b: Bus) => (role === "driver" ? b.driverId : b.attendantId);
  async function submit() {
    const e = validateCrew(f, role, { today, emailTaken: (m) => emailTaken(m, edit?.id), empIdTaken: (x) => empIdTaken(x, edit?.id) });
    setErr(e); if (Object.keys(e).length) return;
    const { busId, status, ...rest } = f;
    const body: Partial<Crew> = { ...rest, name: f.name.trim(), email: f.email.trim().toLowerCase(), phone: f.phone.trim(), empId: f.empId.trim() || nextEmpId(), status: status as CrewStatus };
    if (role !== "driver") { delete body.licenseNo; delete body.licenseExpiry; } else body.licenseNo = f.licenseNo.trim().toUpperCase();
    for (const k of ["licenseNo", "licenseExpiry", "joined", "address", "emergencyName", "emergencyPhone"] as const) if (body[k] !== undefined) body[k] = body[k]!.trim();
    setSaving(true);
    try { await onSave(body, busId); } finally { setSaving(false); }
  }
  return (
    <SlideOver open onClose={onClose} title={edit ? `Edit ${label}` : `Add ${label}`} width="max-w-lg" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving}>{saving ? "Saving…" : edit ? "Save Changes" : `Add ${label} & Create Login`}</Button></>}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" required error={err.name} className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Employee ID" hint="Auto-generated if blank" error={err.empId}><Input value={f.empId} onChange={(e) => set("empId", e.target.value)} placeholder="TR-1001" /></Field>
        <Field label="Phone" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxxxxxxx" /></Field>
        <Field label="Email (driver-app login)" required error={err.email} className="sm:col-span-2" hint={locked ? "Login already created; the email cannot be changed here." : edit ? "Use the Create login action in the list after saving." : "A login is created and a password email is sent to this address."}>
          <Input type="email" value={f.email} disabled={locked} onChange={(e) => set("email", e.target.value)} /></Field>
        <div className="rounded-lg bg-surface-container-low p-3 text-sm sm:col-span-2"><span className="text-on-surface-variant">Account status: </span>
          {edit?.authUid ? <Badge tone="success">Login active</Badge> : edit ? <Badge tone="warning">No login yet</Badge> : <Badge>Created on save</Badge>}</div>
        {role === "driver" && <>
          <Field label="License no" required error={err.licenseNo}><Input value={f.licenseNo} onChange={(e) => set("licenseNo", e.target.value)} placeholder="DL-0420110012345" /></Field>
          <Field label="License expiry" required error={err.licenseExpiry}><Input type="date" value={f.licenseExpiry} min={today} onChange={(e) => set("licenseExpiry", e.target.value)} /></Field></>}
        <Field label="Bus" hint="Allotting here frees the seat's previous holder"><Select value={f.busId} onChange={(e) => set("busId", e.target.value)}>
          <option value="">Unassigned</option>{buses.map((b) => { const seat = seatOf(b); const taken = seat && seat !== edit?.id; return <option key={b.id} value={b.id}>{busLabel(b)} · {b.routeName}{taken ? ` (${role === "driver" ? b.driver : b.attendant})` : ""}</option>; })}</Select></Field>
        {edit && <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{(["Active", "On leave", "Inactive"] as const).map((s) => <option key={s}>{s}</option>)}</Select></Field>}
        <Field label="Joined"><Input type="date" value={f.joined} onChange={(e) => set("joined", e.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Emergency contact"><Input value={f.emergencyName} onChange={(e) => set("emergencyName", e.target.value)} placeholder="Name" /></Field>
        <Field label="Emergency phone" error={err.emergencyPhone}><Input value={f.emergencyPhone} onChange={(e) => set("emergencyPhone", e.target.value)} /></Field>
      </div>
    </SlideOver>
  );
}
