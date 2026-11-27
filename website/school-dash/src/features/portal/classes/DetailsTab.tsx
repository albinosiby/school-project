"use client";
// The class teacher's Details tab of a student (the teacher app's screens/widgets/student_details_tab.dart): personal,
// parents & contacts, home address, health, admission and transport from getClassStudentDetails, with editing of
// contacts, address and health through updateClassStudentDetails. Caste, category, religion and bank details are never
// part of the answer (and parseDetails reads only the fields below).
import { useEffect, useState } from "react";
import { Mail, Pencil, Phone } from "lucide-react";
import { Badge, Button, Field, Input, LoadingSkeleton, Modal, Select, Tabs, Textarea, useToast } from "@/components/ui";
import { todayIso } from "../teaching";
import {
  addressError, addressFormOf, addressPatch, ageOn, BLOOD_GROUPS, CONTACT_KINDS, CONTACT_LABELS, contactsError, contactsFormOf, contactsPatch, contactTitle,
  filledContacts, healthError, healthFormOf, healthPatch, homeAddress, type AddressForm, type ContactKind, type ContactsForm, type DetailsPatch,
  type HealthForm, type StudentDetails,
} from "./details";
import { fetchStudentDetails, saveStudentDetails } from "./detailsApi";
import { Section } from "./ui";

type Editing = "contacts" | "address" | "health" | null;

export function DetailsTab({ studentId }: { studentId: string }) {
  const [details, setDetails] = useState<StudentDetails | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Editing>(null);

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    fetchStudentDetails(studentId).then(
      (d) => { if (live) { setDetails(d); setError(""); setLoading(false); } },
      (e: unknown) => { if (live) { setError(e instanceof Error ? e.message : "Could not load the student details."); setLoading(false); } },
    );
    return () => { live = false; };
  }, [studentId, attempt]);
  const retry = () => { setLoading(true); setError(""); setAttempt((n) => n + 1); };

  if (loading && !details) return <LoadingSkeleton variant="details" label="Loading the student's details…" />;
  if (error && !details) return <div role="alert" className="rounded-lg border border-error/30 bg-error-container/40 p-5 text-sm">
    <p className="font-semibold text-on-error-container">Could not load the details</p><p className="mt-1 text-on-surface-variant">{error}</p>
    <Button size="sm" variant="outline" className="mt-3" onClick={retry}>Try again</Button>
  </div>;
  if (!details) return null;
  const d = details;
  const age = ageOn(d.dob, todayIso());
  const edit = (what: Editing) => <Button size="sm" variant="ghost" onClick={() => setEditing(what)}><Pencil size={14} />Edit</Button>;

  return <div className="grid gap-5 lg:grid-cols-2">
    <Section title="Personal"><Rows rows={[
      ["Gender", d.gender], ["Date of birth", d.dob ? `${d.dob}${age == null ? "" : ` · ${age} years`}` : ""], ["Nationality", d.nationality],
      ["Mother tongue", d.motherTongue], ["Home language", d.language], ["Student type", d.studentType], ...(d.stream ? [["Stream", d.stream] as [string, string]] : []),
    ]} /></Section>

    <Section title="Parents & contacts" actions={edit("contacts")}>
      {!filledContacts(d).length && !d.emergencyPhone ? <p className="text-sm text-on-surface-variant">No contacts recorded</p>
        : <ul className="space-y-3" aria-label="Contacts">
          {filledContacts(d).map(({ kind, contact }) => <li key={kind} className="rounded-md bg-surface-container-low p-3">
            <div className="flex flex-wrap items-center gap-2"><p className="text-xs text-on-surface-variant">{contactTitle(kind, contact)}</p>
              {kind === d.primary && <Badge tone="success">Primary</Badge>}{kind === d.secondary && <Badge>Second</Badge>}</div>
            <p className="font-medium">{contact.name || "—"}{contact.occupation && <span className="text-xs font-normal text-on-surface-variant"> · {contact.occupation}</span>}</p>
            <div className="mt-1 flex flex-wrap gap-3 text-sm">
              {contact.phone && <a className="inline-flex items-center gap-1 text-secondary hover:underline" href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`}><Phone size={13} />{contact.phone}</a>}
              {contact.email && <a className="inline-flex items-center gap-1 text-secondary hover:underline" href={`mailto:${contact.email}`}><Mail size={13} />{contact.email}</a>}
            </div>
          </li>)}
          {d.emergencyPhone && <li className="rounded-md bg-surface-container-low p-3"><p className="text-xs text-on-surface-variant">Emergency</p>
            <a className="inline-flex items-center gap-1 text-sm text-secondary hover:underline" href={`tel:${d.emergencyPhone.replace(/[^\d+]/g, "")}`}><Phone size={13} />{d.emergencyPhone}</a></li>}
        </ul>}
    </Section>

    <Section title="Home address" actions={edit("address")}>
      <p className="text-sm">{homeAddress(d) || <span className="text-on-surface-variant">No address recorded</span>}</p>
    </Section>

    <Section title="Health" actions={edit("health")}><Rows rows={[
      ["Blood group", d.bloodGroup], ["Medical conditions", d.conditions || "None recorded"], ["Support needs", d.assistance || "None recorded"],
    ]} /></Section>

    <Section title="Admission"><Rows rows={[
      ["Admission no.", d.admissionNumber], ["Admitted on", d.admissionDate], ["Academic year", d.academicYear], ["Admission type", d.admissionType],
      ["Previous school", [d.previousSchool, d.previousClass, d.previousBoard].filter(Boolean).join(" · ")], ["Student email", d.email],
    ]} /></Section>

    {(d.bus || d.busStop) && <Section title="Transport"><Rows rows={[["Bus", d.bus], ["Stop", d.busStop]]} /></Section>}

    {editing === "contacts" && <ContactsEditor d={d} studentId={studentId} onClose={() => setEditing(null)} onSaved={setDetails} />}
    {editing === "address" && <AddressEditor d={d} studentId={studentId} onClose={() => setEditing(null)} onSaved={setDetails} />}
    {editing === "health" && <HealthEditor d={d} studentId={studentId} onClose={() => setEditing(null)} onSaved={setDetails} />}
  </div>;
}

function Rows({ rows }: { rows: [string, string][] }) {
  const shown = rows.filter(([, v]) => v);
  if (!shown.length) return <p className="text-sm text-on-surface-variant">Nothing recorded</p>;
  return <dl className="divide-y divide-outline-variant/40 text-sm">
    {shown.map(([k, v]) => <div key={k} className="flex flex-wrap justify-between gap-x-4 gap-y-0.5 py-2"><dt className="text-on-surface-variant">{k}</dt><dd className="min-w-0 text-right font-medium break-words">{v}</dd></div>)}
  </dl>;
}

type EditorProps = { d: StudentDetails; studentId: string; onClose: () => void; onSaved: (d: StudentDetails) => void };

/** the edit dialogs' shell: shows the check / server error and saves through the callable */
function EditorShell({ title, studentId, check, patch, onClose, onSaved, children }: { title: string; check: () => string; patch: () => DetailsPatch; children: React.ReactNode } & Omit<EditorProps, "d">) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save() {
    if (busy) return;
    const why = check();
    if (why) { setError(why); return; }
    setBusy(true); setError("");
    try { onSaved(await saveStudentDetails(studentId, patch())); toast("Saved"); onClose(); } catch (e) { setError(e instanceof Error ? e.message : "Could not save the changes."); } finally { setBusy(false); }
  }
  return <Modal open onClose={onClose} title={title} footer={<>
    <Button variant="outline" onClick={onClose}>Cancel</Button>
    <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save changes"}</Button>
  </>}>
    <div className="space-y-3">
      {children}
      {error && <p role="alert" className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">{error}</p>}
    </div>
  </Modal>;
}

function ContactsEditor({ d, ...p }: EditorProps) {
  const [f, setF] = useState<ContactsForm>(() => contactsFormOf(d));
  const [kind, setKind] = useState<ContactKind>(d.primary);
  const c = f.contacts[kind];
  const set = (k: keyof typeof c, v: string) => setF({ ...f, contacts: { ...f.contacts, [kind]: { ...c, [k]: v } } });
  return <EditorShell title="Parents & contacts" check={() => contactsError(f)} patch={() => contactsPatch(d, f)} {...p}>
    <Tabs items={CONTACT_KINDS.map((k) => ({ id: k, label: CONTACT_LABELS[k] }))} value={kind} onChange={(v) => setKind(v as ContactKind)} />
    <Field label="Name"><Input value={c.name} onChange={(e) => set("name", e.target.value)} /></Field>
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Mobile number"><Input type="tel" value={c.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
      <Field label="Email"><Input type="email" value={c.email} onChange={(e) => set("email", e.target.value)} /></Field>
      <Field label="Occupation"><Input value={c.occupation} onChange={(e) => set("occupation", e.target.value)} /></Field>
      {kind === "guardian" && <Field label="Relationship" hint="e.g. Uncle"><Input value={c.relationship} onChange={(e) => set("relationship", e.target.value)} /></Field>}
    </div>
    <div className="grid gap-3 border-t border-outline-variant/50 pt-3 sm:grid-cols-2">
      <Field label="Primary contact"><Select value={f.primary} onChange={(e) => setF({ ...f, primary: e.target.value as ContactKind })}>{CONTACT_KINDS.map((k) => <option key={k} value={k}>{CONTACT_LABELS[k]}</option>)}</Select></Field>
      <Field label="Second contact"><Select value={f.secondary} onChange={(e) => setF({ ...f, secondary: e.target.value as ContactKind | "" })}>
        <option value="">None</option>{CONTACT_KINDS.map((k) => <option key={k} value={k}>{CONTACT_LABELS[k]}</option>)}</Select></Field>
      <Field label="Emergency number"><Input type="tel" value={f.emergencyPhone} onChange={(e) => setF({ ...f, emergencyPhone: e.target.value })} /></Field>
    </div>
    <p className="text-xs text-on-surface-variant">The primary contact is who the school calls and messages first; the parent app login is not changed.</p>
  </EditorShell>;
}

function AddressEditor({ d, ...p }: EditorProps) {
  const [f, setF] = useState<AddressForm>(() => addressFormOf(d));
  const input = (k: keyof AddressForm, label: string) => <Field label={label}><Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>;
  return <EditorShell title="Home address" check={() => addressError(f)} patch={() => addressPatch(d, f)} {...p}>
    {input("addressLine1", "House / street")}{input("addressLine2", "Area / landmark")}
    <div className="grid gap-3 sm:grid-cols-2">{input("city", "City / town")}{input("district", "District")}{input("state", "State")}{input("pin", "PIN code")}</div>
  </EditorShell>;
}

function HealthEditor({ d, ...p }: EditorProps) {
  const [f, setF] = useState<HealthForm>(() => healthFormOf(d));
  return <EditorShell title="Health" check={() => healthError(f)} patch={() => healthPatch(f)} {...p}>
    <Field label="Blood group"><Select value={f.bloodGroup} onChange={(e) => setF({ ...f, bloodGroup: e.target.value })}>{BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b || "Unknown"}</option>)}</Select></Field>
    <Field label="Medical conditions"><Textarea value={f.conditions} onChange={(e) => setF({ ...f, conditions: e.target.value })} /></Field>
    <Field label="Support needs" hint="e.g. Sits in the front row (hearing)"><Textarea value={f.assistance} onChange={(e) => setF({ ...f, assistance: e.target.value })} /></Field>
  </EditorShell>;
}
