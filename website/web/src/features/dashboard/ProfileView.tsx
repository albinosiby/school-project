"use client";
import { useState } from "react";
import { Building2, Camera, Check, FileText, GraduationCap, Pencil, ShieldCheck, Users } from "lucide-react";
import { Avatar, Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Switch, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { errMsg, useHydrated } from "./data";
import { ChangePasswordCard } from "./ChangePasswordCard";

type Me = { id: string; name: string; title: string; role: string; email: string; phone: string; altEmail?: string; extension?: string; office?: string; degree?: string; specialization?: string; bio?: string };
type Prefs = { id: string; emergencySub: boolean; auditTrail: boolean; weeklyDigest: boolean; term: string; timezone: string; signature: string; mfaDevice: string };
type Staff = { id: string };
type Student = { id: string; status?: string };

/** me_prefs/me defaults (used until the doc exists) */
const PREF_DEFAULTS: Omit<Prefs, "id"> = { emergencySub: true, auditTrail: true, weeklyDigest: false, term: "Current academic year", timezone: "Asia/Kolkata (IST, UTC+5:30) · DD MMM YYYY", signature: "", mfaDevice: "" };
type Fields = { first: string; last: string; email: string; altEmail: string; phone: string; extension: string; office: string; degree: string; specialization: string; bio: string };
const PREFIX = /^(Dr\.|Mr\.|Mrs\.|Ms\.|Prof\.)\s+/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ProfileView() {
  const { rows: me, update, ready: r0 } = useCollection<Me>("me");
  const { rows: prefs, update: updPrefsRaw, create: createPrefs, ready: r1 } = useCollection<Prefs>("me_prefs");
  const ready = useHydrated() && r0 && r1;
  const { rows: students } = useCollection<Student>("students");
  const { rows: staff } = useCollection<Staff>("staff");
  const toast = useToast();
  const m = me[0]; const p: Prefs = prefs[0] ?? { id: "me", ...PREF_DEFAULTS };
  /** update me_prefs, creating the doc if this school never had one */
  const updPrefs = (patch: Partial<Prefs>) => (prefs[0] ? updPrefsRaw(prefs[0].id, patch) : createPrefs({ ...PREF_DEFAULTS, ...patch, id: "me" }));
  const [edits, setEdits] = useState<Partial<Fields>>({});
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [mfa, setMfa] = useState(false);
  const [saving, setSaving] = useState(false);
  const base: Fields = (() => {
    if (!m) return { first: "", last: "", email: "", altEmail: "", phone: "", extension: "", office: "", degree: "", specialization: "", bio: "" };
    const name = m.name ?? ""; const prefix = name.match(PREFIX)?.[0] ?? ""; const rest = name.slice(prefix.length).split(" ");
    return { first: rest[0] ?? "", last: rest.slice(1).join(" "), email: m.email ?? "", altEmail: m.altEmail ?? "", phone: m.phone ?? "", extension: m.extension ?? "", office: m.office ?? "",
      degree: m.degree ?? "", specialization: m.specialization ?? "", bio: m.bio ?? "" };
  })();
  const f = { ...base, ...edits };
  const set = (k: keyof Fields, v: string) => setEdits((x) => ({ ...x, [k]: v }));

  const save = async () => {
    const e: Record<string, string> = {};
    if (!f.first.trim()) e.first = "First name is required";
    if (!EMAIL.test(f.email.trim())) e.email = "Enter a valid email address";
    if (f.altEmail.trim() && !EMAIL.test(f.altEmail.trim())) e.altEmail = "Enter a valid email address";
    else if (f.altEmail.trim() && f.altEmail.trim().toLowerCase() === f.email.trim().toLowerCase()) e.altEmail = "Use a different address from the official email";
    const digits = f.phone.replace(/\D/g, "");
    if (digits.length < 10 || digits.length > 13 || /[^\d\s()+-]/.test(f.phone)) e.phone = "Enter a valid phone number";
    setErrs(e);
    if (Object.keys(e).length) { toast("Please fix the highlighted fields", "error"); return; }
    if (!m) return;
    setSaving(true);
    const prefix = (m.name ?? "").match(PREFIX)?.[0] ?? "";
    try {
      await update(m.id, { name: `${prefix}${f.first.trim()} ${f.last.trim()}`.trim(), email: f.email.trim(), altEmail: f.altEmail.trim(), phone: f.phone.trim(), extension: f.extension, office: f.office, degree: f.degree, specialization: f.specialization, bio: f.bio });
      setEdits({}); toast("Profile saved");
    } catch (err) { toast(errMsg(err, "Could not save profile"), "error"); } finally { setSaving(false); }
  };
  const pref = async (patch: Partial<Prefs>, ok = "Preference saved") => { try { await updPrefs(patch); toast(ok); } catch (e) { toast(errMsg(e), "error"); } };

  if (!ready) return <div className="h-96" />;
  if (!m) return <Card><EmptyState title="Profile not found" hint="Your administrator profile has not been created for this school yet." /></Card>;
  const activeStudents = students.filter((s) => !s.status || s.status === "Active").length;
  const tag = (icon: React.ReactNode, t: string) => <span className="inline-flex items-center gap-1.5 rounded bg-surface-container px-2 py-1 text-xs text-on-surface-variant">{icon}{t}</span>;
  const head = (icon: React.ReactNode, t: string, s: string, right?: React.ReactNode) => (
    <div className="mb-5 flex items-start justify-between gap-3"><div className="flex gap-3"><span className="grid size-10 place-items-center rounded-lg bg-info-container text-secondary">{icon}</span><div><h2 className="font-semibold">{t}</h2><p className="text-xs text-outline">{s}</p></div></div>{right}</div>);

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap gap-6">
          <div className="relative"><Avatar name={m.name} size={112} /><button aria-label="Change photo" onClick={() => toast("Photo upload is not available yet (simulated)")} className="absolute bottom-1 right-1 grid size-8 cursor-pointer place-items-center rounded-full bg-secondary text-on-secondary"><Camera size={14} /></button></div>
          <div className="min-w-0 flex-1">
            <h1 className="t-headline-lg">{m.name}</h1>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-2"><p className="max-w-xs font-medium text-secondary">{m.title || "Administrator"}</p>
                <div className="flex flex-wrap gap-2">{m.role && tag(<Building2 size={12} />, m.role)}{m.email && tag(<FileText size={12} />, m.email)}</div></div>
              <div className="flex flex-wrap gap-3">
                {[[<Users key="a" size={18} />, activeStudents.toLocaleString("en-IN"), "Active Students"], [<GraduationCap key="b" size={18} />, staff.length.toLocaleString("en-IN"), "Staff Members"]].map(([i, v, l]) => (
                  <div key={String(l)} className="flex items-center gap-3 rounded-lg border border-outline-variant/60 px-4 py-3"><span className="text-secondary">{i}</span><div><p className="text-xl font-bold leading-5">{v}</p><p className="text-xs text-on-surface-variant">{l}</p></div></div>))}</div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card className="p-6">
            {head(<Users size={18} />, "Personal & Contact Details", "Primary institutional directory details and communications routing", <span className="flex items-center gap-1 text-xs font-semibold text-secondary"><Pencil size={12} />Inline Editing Active</span>)}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First Name" required error={errs.first}><Input value={f.first} onChange={(e) => set("first", e.target.value)} /></Field>
              <Field label="Last Name" error={errs.last}><Input value={f.last} onChange={(e) => set("last", e.target.value)} /></Field>
              <Field label="Official Institutional Email" required error={errs.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
              <Field label="Alternate / Recovery Email" error={errs.altEmail}><Input type="email" value={f.altEmail} onChange={(e) => set("altEmail", e.target.value)} /></Field>
              <Field label="Official Contact Line" required error={errs.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Direct Extension / Cabin"><Input value={f.extension} onChange={(e) => set("extension", e.target.value)} /></Field>
              <Field label="Executive Office Location" className="sm:col-span-2"><Input value={f.office} onChange={(e) => set("office", e.target.value)} /></Field>
            </div>
          </Card>
          <Card className="p-6">
            {head(<GraduationCap size={18} />, "Academic Credentials & Public Bio", "Accredited certifications, research specializations, and authorized digital stamp")}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Highest Conferred Degree"><Input value={f.degree} onChange={(e) => set("degree", e.target.value)} /></Field>
              <Field label="Specialization & Board Focus"><Input value={f.specialization} onChange={(e) => set("specialization", e.target.value)} /></Field>
              <Field label="Institutional Biography & Prospectus Statement" className="sm:col-span-2"><Textarea rows={4} value={f.bio} onChange={(e) => set("bio", e.target.value)} /></Field>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 rounded-lg border border-outline-variant/60 bg-surface-container-low p-4">
              <div className="min-w-48 flex-1"><p className="flex items-center gap-2 font-semibold"><Pencil size={14} className="text-secondary" />Authorized Signatory Token</p><p className="text-xs text-on-surface-variant">{p.signature ? "On file" : "Not set"}</p><p className="mt-1 text-xs text-outline">Applied automatically to issued Report Cards, Transfer Certificates, and Bonafide Letters.</p></div>
              <span className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest px-6 py-3 font-serif text-xl italic text-secondary">{p.signature || <span className="font-sans text-sm not-italic text-outline">No signature uploaded</span>}</span>
              <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded border border-outline-variant bg-surface-container-lowest px-4 text-sm font-semibold hover:bg-surface-container-low"><FileText size={14} />Replace (.svg)
                <input type="file" accept=".svg" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) void pref({ signature: file.name.replace(/\.svg$/i, "") }, "Signature replaced (file upload simulated — preview shows file name)"); e.target.value = ""; }} /></label>
            </div>
          </Card>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setErrs({}); setEdits({}); }}>Reset</Button>
            <Button onClick={save} disabled={saving || !Object.keys(edits).length}>{saving ? "Saving…" : "Save changes"}</Button></div>
        </div>

        <aside className="space-y-6">
          <ChangePasswordCard />
          <Card className="p-5">
            {head(<ShieldCheck size={18} />, "Governance & MFA", "Access clearance & tokens")}
            <div className="rounded-lg border border-outline-variant/60 bg-surface-container-low p-4"><div className="flex items-center justify-between"><span className="text-[11px] font-bold tracking-wide text-outline">ASSIGNED CLEARANCE</span><Badge tone="brand">Tier 0 Root</Badge></div>
              <p className="mt-2 font-semibold">Super Administrator / Head of Institution</p><p className="mt-1 text-xs text-on-surface-variant">Unrestricted privilege over academic records, fee matrices, roster schedules, and staff rosters.</p></div>
            <p className="mb-2 mt-4 text-sm font-semibold">Active Cryptographic Scopes</p>
            <ul className="space-y-2">{[["Admissions & Enrollment", "Full Root"], ["Academic Term Gradebook", "Root Lock"], ["Fee Matrix & Ledger Audit", "Full Admin"], ["Audit Ledger Export", "Full Access"]].map(([a, b]) => <li key={a} className="flex items-center justify-between gap-2 rounded-lg border border-outline-variant/60 px-3 py-2 text-sm"><span className="flex items-center gap-2"><Check size={13} className="text-secondary" />{a}</span><Badge tone="brand">{b}</Badge></li>)}</ul>
            <div className="mt-4 rounded-lg border border-outline-variant/60 p-4"><p className="font-semibold">Hardware MFA (FIDO2)</p><p className="mt-1 text-xs text-on-surface-variant">{p.mfaDevice ? `${p.mfaDevice} paired (simulated).` : "No security key paired."}</p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => setMfa(true)}>{p.mfaDevice ? "Reconfigure MFA Device" : "Pair MFA Device"}</Button></div>
          </Card>
          <Card className="p-5">
            {head(<Pencil size={18} />, "System Preferences", "Session filters and critical alert triggers")}
            <div className="space-y-4">
              <Field label="Default Academic Term Filter"><Select value={p.term} onChange={(e) => pref({ term: e.target.value })}>{[...new Set([p.term, "Current academic year", "Previous academic year"])].filter(Boolean).map((t) => <option key={t}>{t}</option>)}</Select></Field>
              <Field label="Timezone & Regional Formatting"><Select value={p.timezone} onChange={(e) => pref({ timezone: e.target.value })}>{["Asia/Kolkata (IST, UTC+5:30) · DD MMM YYYY", "Asia/Dubai (GST, UTC+4) · DD MMM YYYY", "UTC · YYYY-MM-DD"].map((t) => <option key={t}>{t}</option>)}</Select></Field>
            </div>
            <p className="mb-2 mt-5 text-[11px] font-bold tracking-wide text-outline">PRIORITY BROADCAST ALERTS</p>
            <div className="space-y-2">{([["emergencySub", "Emergency Substitution Push", "Instant SMS broadcast on teacher absenteeism"], ["auditTrail", "Audit Trail Modifications", "Alert upon grade alteration after approval"], ["weeklyDigest", "Weekly Executive Digest", "Consolidated collection & attendance statistics"]] as const).map(([k, t, s]) => (
              <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-3"><div><p className="text-sm font-semibold">{t}</p><p className="text-xs text-on-surface-variant">{s}</p></div><Switch checked={p[k]} label={t} onChange={(v) => pref({ [k]: v })} /></div>))}</div>
          </Card>
        </aside>
      </div>
      <Modal open={mfa} onClose={() => setMfa(false)} title="Reconfigure MFA device" subtitle="FIDO2 hardware token" footer={<><Button variant="outline" onClick={() => setMfa(false)}>Cancel</Button><Button onClick={async () => { await pref({ mfaDevice: "Security key" }, "MFA device paired (simulated)"); setMfa(false); }}>Start pairing</Button></>}>
        <p className="text-on-surface-variant">Insert your security key and touch it when prompted. Hardware MFA is simulated in this build — no key is actually registered.</p></Modal>
    </div>
  );
}
