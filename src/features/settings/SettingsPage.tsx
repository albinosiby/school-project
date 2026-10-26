"use client";
import { useState, useSyncExternalStore } from "react";
import { AlertTriangle, BookOpen, Building2, CalendarClock, CalendarDays, Download, Globe, Lock, Plug, Plus, RefreshCw, Save, ShieldCheck, Users } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Modal, PageHeader, ProgressBar, Select, Switch, Tabs, useToast } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate, inr } from "@/lib/format";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/fees/csv";
import { LeavePolicyEditor } from "./LeavePolicyEditor";

type Profile = { id: string; name: string; affiliation: string; schoolCode: string; email: string; phone: string; address: string; seal: string; digitalKey: string };
type Regional = { id: string; language: string; dateFormat: string; timezone: string; currency: string; workingWeek: string };
type Bell = { id: string; gates: string; classes: string; periods: string; recess: string };
type Meta = { id: string; academicYear: string; rolledOver: boolean; rolloverStep: number };
type Term = { id: string; name: string; start: string; end: string; days: number; status: string };
type Sec = { id: string; grade: string; stream: string; sections: string[]; roster: number; cap: number };
type Role = { id: string; name: string; tone: Tone; perms: string[] };
type Integ = { id: string; name: string; desc: string; enabled: boolean };
type Band = { id: string; grade: string; min: number; point: number };
type Exc = { id: string; kind: string; text: string; resolved: boolean };
type Audit = { id: string; at: string; actor: string; action: string; detail: string };
type Me = { id: string; name: string; title?: string };
type Stu = { id: string; grade: string; status: string };
type Inv = { id: string; balance: number };

/** fallbacks when a set_config doc is missing (saved on first Save All) */
const DEF_PROFILE: Profile = { id: "profile", name: "", affiliation: "", schoolCode: "", email: "", phone: "", address: "", seal: "", digitalKey: "" };
const DEF_REGIONAL: Regional = { id: "regional", language: "English (India) - en_IN", dateFormat: "DD MMM YYYY", timezone: "IST · UTC+05:30 (New Delhi)", currency: "Indian Rupee (₹ INR)", workingWeek: "Mon – Sat" };
const DEF_BELL: Bell = { id: "bell", gates: "", classes: "", periods: "", recess: "" };
/** "2026-27" → "2027-28" */
const nextAy = (ay?: string) => { const y = Number(ay?.slice(0, 4)); return y ? `${y + 1}-${String(y + 2).slice(2)}` : "next year"; };
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");

const SECTIONS = [
  { id: "profile", label: "School Profile" }, { id: "year", label: "Academic Year" }, { id: "capacity", label: "Classes & Sections" }, { id: "grading", label: "Grading" }, { id: "leave", label: "Leave Policy" },
  { id: "roles", label: "Roles & Permissions" }, { id: "integrations", label: "Integrations" }, { id: "regional", label: "Localization" }, { id: "rollover", label: "Year-End Rollover" },
];
const ALL_PERMS = ["Full System Root", "Year-End Rollover", "Fee Write-Off", "Compliance Lock", "Curriculum & Syllabus", "Master Timetable", "Exam Moderation", "Marks & Grades Entry", "Daily Attendance", "Homework Broadcast", "Fee Collection POS", "Invoicing & Dues", "Cheque Clearance"];
const STEPS = ["Term Lock", "Attendance", "Cohort Map", "Commit AY"];
const roleTone: Record<string, string> = { brand: "bg-info-container text-secondary", success: "bg-success-container text-success", neutral: "bg-surface-container text-on-surface-variant", warning: "bg-warning-container text-warning" };

function Section({ id, icon, title, desc, badge, actions, children, className }: { id: string; icon: React.ReactNode; title: string; desc: string; badge?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <Card className={cn("scroll-mt-24 p-6", className)} id={id}>
      <div className="mb-5 flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-info-container text-secondary">{icon}</span>
        <div className="min-w-0 flex-1"><h2 className="t-headline-md !text-[17px]">{title}</h2><p className="text-on-surface-variant">{desc}</p></div>
        {badge}{actions}
      </div>
      {children}
    </Card>
  );
}

export function SettingsPage() {
  const toast = useToast();
  const cfg = useCollection<Profile & Regional & Bell & Meta>("set_config");
  const terms = useCollection<Term>("set_terms");
  const secs = useCollection<Sec>("set_sections");
  const roles = useCollection<Role>("set_roles");
  const integ = useCollection<Integ>("set_integrations");
  const bands = useCollection<Band>("set_grading");
  const excs = useCollection<Exc>("set_exceptions");
  const audit = useCollection<Audit>("set_audit");
  const me = useCollection<Me>("me").rows[0];
  const students = useCollection<Stu>("students").rows;
  const invoices = useCollection<Inv>("fee_invoices").rows;

  const profile = cfg.rows.find((r) => r.id === "profile") as unknown as Profile | undefined;
  const regional = cfg.rows.find((r) => r.id === "regional") as unknown as Regional | undefined;
  const bell = cfg.rows.find((r) => r.id === "bell") as unknown as Bell | undefined;
  const meta = cfg.rows.find((r) => r.id === "meta") as unknown as Meta | undefined;

  // local date (not UTC) so the letterhead shows the right day before 05:30 IST
  const todayStr = useSyncExternalStore(() => () => {}, () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); }, () => "");
  const [p, setP] = useState<Profile | null>(null);
  const [r, setR] = useState<Regional | null>(null);
  const [b, setB] = useState<Bell | null>(null);
  const [bd, setBd] = useState<Record<string, number>>({});
  const [active, setActive] = useState("profile");
  // first load: copy the saved docs (or defaults for missing ones) into local drafts
  if (!p && ((profile && regional && bell) || cfg.ready)) { setP(profile ?? DEF_PROFILE); setR(regional ?? DEF_REGIONAL); setB(bell ?? DEF_BELL); }

  const [termEdit, setTermEdit] = useState<Term | null>(null);
  const [saving, setSaving] = useState(false);
  const [secEdit, setSecEdit] = useState<Sec | "new" | null>(null);
  const [acl, setAcl] = useState(false);
  const [excOpen, setExcOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [signed, setSigned] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const actor = me?.name || "Administrator";
  const log = (action: string, detail: string) => audit.create({ at: new Date().toISOString(), actor, action, detail } as Omit<Audit, "id">).catch(() => undefined); // audit is best-effort
  /** runs a write and toasts the Firestore error instead of failing silently; returns success */
  const guard = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(`Could not save: ${errText(e)}`, "error"); return false; } };
  const upsertCfg = (id: string, v: object, exists: boolean) => (exists ? cfg.update(id, v as never) : cfg.create({ ...v, id } as never));

  const dirty = !!(p && profile && JSON.stringify(p) !== JSON.stringify(profile)) || !!(r && regional && JSON.stringify(r) !== JSON.stringify(regional)) || !!(b && bell && JSON.stringify(b) !== JSON.stringify(bell)) || Object.keys(bd).length > 0;

  const saveAll = async () => {
    if (!p || !r || !b) return;
    const e: Record<string, string> = {};
    if (!p.name.trim()) e.name = "Institution name is required";
    if (!/^\S+@\S+\.\S+$/.test(p.email)) e.email = "Enter a valid email";
    if (!/^[+\d][\d\s-]{6,}$/.test(p.phone)) e.phone = "Enter a valid phone number";
    if (!p.affiliation.trim()) e.affiliation = "Required";
    if (!p.address.trim()) e.address = "Required";
    setErrs(e);
    if (Object.keys(e).length) { toast("Fix the highlighted fields", "error"); setActive("profile"); return; }
    setSaving(true);
    const ok = await guard(() => Promise.all([upsertCfg("profile", p, !!profile), upsertCfg("regional", r, !!regional), upsertCfg("bell", b, !!bell),
      ...Object.entries(bd).map(([id, min]) => bands.update(id, { min }))]), "All settings saved");
    setSaving(false);
    if (ok) { setBd({}); await log("Saved settings", "School profile, localization and grading updated"); }
  };

  const jump = (id: string) => { setActive(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); };

  const openExc = excs.rows.filter((x) => !x.resolved);
  const activeStu = students.filter((x) => x.status === "Active");
  const graduating = activeStu.filter((x) => x.grade === "12").length;
  const dues = invoices.filter((i) => (Number(i.balance) || 0) > 0);
  const duesAmt = dues.reduce((a, i) => a + (Number(i.balance) || 0), 0);
  const toAy = nextAy(meta?.academicYear);
  const rolled = !!meta?.rolledOver;
  const step = rolled ? 4 : Math.max(1, Math.min(4, 3 + (openExc.length === 0 ? 1 : 0)));
  const canRoll = signed && openExc.length === 0 && !rolled;

  if (!p || !r || !b) return <p className="text-on-surface-variant">Loading settings…</p>;
  const seatsUsed = secs.rows.reduce((a, x) => a + (Number(x.roster) || 0), 0), seatsCap = secs.rows.reduce((a, x) => a + (Number(x.cap) || 0), 0);
  const sortedBands = [...bands.rows].sort((a, c) => c.min - a.min);

  return (
    <>
      <PageHeader title="Settings" subtitle="Institutional parameters, academic term schedules, class capacity matrix, RBAC roles, regional localization, and year-end rollover controls in one place."
        actions={<>
          <Button variant="outline" disabled={!audit.rows.length} onClick={() => { downloadCsv("audit-log.csv", [["Time", "Actor", "Action", "Detail"], ...audit.rows.map((a) => [a.at, a.actor, a.action, a.detail])]); toast("Audit log downloaded"); }}><Download size={16} />Download Audit Log (.csv)</Button>
          <Button onClick={saveAll} disabled={saving}><Save size={16} />{saving ? "Saving…" : "Save All Settings"}{dirty && <span className="size-2 rounded-full bg-warning-container" aria-label="unsaved changes" />}</Button>
        </>} />
      <div className="sticky top-0 z-10 -mx-1 mb-5 bg-surface/90 px-1 py-2 backdrop-blur"><Tabs items={SECTIONS} value={active} onChange={jump} /></div>

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
        <div className="space-y-6">
          <Section id="profile" icon={<Building2 size={20} />} title="School Profile, Affiliation & Official Seal" desc="Statutory credentials printed on report cards, bonafides, and CBSE manifests" badge={<Badge tone={profile?.affiliation ? "success" : "warning"}>{profile?.affiliation ? "Affiliation on file" : "Affiliation missing"}</Badge>}>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="OFFICIAL INSTITUTION NAME" required error={errs.name} className="md:col-span-2"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
              <Field label="CBSE AFFILIATION NO." required error={errs.affiliation}><Input value={p.affiliation} onChange={(e) => setP({ ...p, affiliation: e.target.value })} /></Field>
              <Field label="CBSE SCHOOL CODE & CENTER ID"><Input value={p.schoolCode} onChange={(e) => setP({ ...p, schoolCode: e.target.value })} /></Field>
              <Field label="OFFICIAL ADMINISTRATIVE EMAIL" required error={errs.email}><Input value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
              <Field label="REGISTRAR PBX HOTLINE" required error={errs.phone}><Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
              <Field label="CAMPUS PHYSICAL LOCATION" required error={errs.address} className="md:col-span-2"><Input value={p.address} onChange={(e) => setP({ ...p, address: e.target.value })} /></Field>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-3">
              <ShieldCheck className="text-secondary" size={20} />
              <div className="min-w-0 flex-1"><p className="font-semibold">Institutional Crest & Watermark (.PNG)</p><p className="truncate text-xs text-outline">{p.seal ? `${p.seal} · ` : "No seal selected · "}Used on hall tickets & transcript PDFs (file upload simulated)</p></div>
              <label className="inline-flex h-8 cursor-pointer items-center rounded border border-outline-variant px-3 text-xs font-semibold hover:bg-surface-container-low">Update Seal
                <input type="file" accept="image/png" className="sr-only" aria-label="Update seal" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setP({ ...p, seal: f.name }); toast("Seal selected. Save to apply"); } }} /></label>
              {p.digitalKey && <Badge tone="success">Digital Key: {p.digitalKey}</Badge>}
            </div>
          </Section>

          <Section id="year" icon={<CalendarDays size={20} />} title="Academic Year & Term Configuration" desc="Active academic calendar timeline & operational bell schedule" badge={<Badge tone="info">Current: AY {meta?.academicYear || "—"}</Badge>}
            actions={<Button size="sm" variant="outline" onClick={() => setTermEdit({ id: "", name: `Term ${terms.rows.length + 1}`, start: "", end: "", days: 0, status: "In Progress" })}><Plus size={14} />New Term</Button>}>
            <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left">
              <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Term</th><th className="p-3">Date span</th><th className="p-3">Days</th><th className="p-3">Lifecycle</th><th className="p-3" /></tr></thead>
              <tbody>{terms.rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-on-surface-variant">No terms configured yet. Add one with New Term.</td></tr>}
                {[...terms.rows].sort((x, y) => (x.start ?? "").localeCompare(y.start ?? "")).map((t) => (
                <tr key={t.id} className="border-t border-outline-variant/50"><td className="p-3 font-semibold">{t.name}</td><td className="p-3">{t.start ? fmtDate(t.start) : "—"} – {t.end ? fmtDate(t.end) : "—"}</td><td className="p-3">{t.days ?? "—"} Days</td>
                  <td className="p-3"><Badge tone={t.status === "Closed" ? "neutral" : "success"}>{t.status === "Closed" ? "Term Closed · Audited" : "Active / In Progress"}</Badge></td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setTermEdit(t)}>Edit</Button></td></tr>))}</tbody></table></div>
            <div className="mt-4 rounded-lg bg-surface-container-low p-4">
              <p className="mb-3 flex items-center gap-2 font-semibold"><BookOpen size={16} className="text-secondary" />Daily Bell Structure</p>
              <div className="grid gap-3 md:grid-cols-4">
                <Field label="Gates open"><Input value={b.gates} onChange={(e) => setB({ ...b, gates: e.target.value })} /></Field>
                <Field label="Classes"><Input value={b.classes} onChange={(e) => setB({ ...b, classes: e.target.value })} /></Field>
                <Field label="Periods"><Input value={b.periods} onChange={(e) => setB({ ...b, periods: e.target.value })} /></Field>
                <Field label="Recess"><Input value={b.recess} onChange={(e) => setB({ ...b, recess: e.target.value })} /></Field>
              </div>
            </div>
          </Section>

          <Section id="capacity" icon={<Users size={20} />} title="Class & Section Capacity Matrix" desc={`Campus occupancy: ${seatsUsed} / ${seatsCap} seats occupied (${((seatsUsed / Math.max(1, seatsCap)) * 100).toFixed(1)}%)`}
            actions={<Button size="sm" variant="outline" onClick={() => setSecEdit("new")}><Plus size={14} />New Section</Button>}>
            <div className="overflow-x-auto rounded-lg border border-outline-variant/60"><table className="w-full text-left">
              <thead className="bg-surface-container-low t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Grade level</th><th className="p-3">Sections</th><th className="p-3">Roster / Cap</th><th className="p-3">Utilization</th><th className="p-3" /></tr></thead>
              <tbody>{secs.rows.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-on-surface-variant">No classes configured yet. Add one with New Section.</td></tr>}
                {secs.rows.map((s) => { const u = s.cap > 0 ? (s.roster / s.cap) * 100 : 0; return (
                <tr key={s.id} className="border-t border-outline-variant/50"><td className="p-3"><b>{s.grade}</b><div className="text-xs text-outline">{s.stream}</div></td>
                  <td className="p-3"><div className="flex flex-wrap gap-1">{(s.sections ?? []).map((x) => <span key={x} className="rounded border border-outline-variant/60 bg-surface-container-low px-2 py-0.5 text-xs">{x}</span>)}</div></td>
                  <td className="p-3 font-mono">{s.roster} / {s.cap}</td>
                  <td className="p-3 w-40"><ProgressBar value={u} tone={u > 96 ? "success" : "brand"} /><span className="text-xs text-on-surface-variant">{u.toFixed(1)}%</span></td>
                  <td className="p-3 text-right"><Button size="sm" variant="ghost" onClick={() => setSecEdit(s)}>Edit Matrix</Button></td></tr>); })}</tbody></table></div>
          </Section>

          <Section id="grading" icon={<BookOpen size={20} />} title="Grading Scheme" desc="CBSE 9-point scale. Minimum percentage for each grade band (used by Exams & Results)" badge={<Badge tone="info">CBSE 9-POINT</Badge>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sortedBands.map((g) => (
                <label key={g.id} className="rounded-lg border border-outline-variant/60 p-3 text-center"><span className="font-mono font-bold text-secondary">{g.grade}</span><span className="block text-xs text-outline">{g.point} pts · min %</span>
                  <input aria-label={`Minimum percent for ${g.grade}`} type="number" min={0} max={100} disabled={g.grade === "E"} value={bd[g.id] ?? g.min} onChange={(e) => setBd({ ...bd, [g.id]: Math.max(0, Math.min(100, Number(e.target.value))) })} className="mt-1 h-8 w-full rounded border border-outline-variant text-center font-mono disabled:bg-surface-container" /></label>))}
            </div>
            <p className="mt-2 text-xs text-outline">Edit values and press Save All Settings.</p>
          </Section>

          <Section id="leave" icon={<CalendarClock size={20} />} title="Leave Policy & Check-in Time" desc="Yearly leave entitlement per type and the check-in time after which teachers are marked late (teacher app quotas use these)">
            <LeavePolicyEditor onSaved={(d) => { void log("Updated leave policy", d); }} />
          </Section>

          <Section id="roles" icon={<Lock size={20} />} title="Roles & RBAC Quick Governance" desc="Access tiers, sensitive operation gates, and module-level write rights" actions={<Button size="sm" variant="ghost" className="text-secondary" onClick={() => setAcl(true)}>Configure Granular ACL</Button>}>
            <div className="space-y-3">{roles.rows.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-4"><span className="w-56 font-semibold">{x.name}</span>
                <div className="flex flex-wrap gap-1.5">{(x.perms ?? []).map((q) => <span key={q} className={cn("rounded px-2 py-0.5 text-xs font-medium", roleTone[x.tone])}>{q}</span>)}</div></div>))}</div>
          </Section>

          <Section id="integrations" icon={<Plug size={20} />} title="Integrations" desc="Enable or disable connected services. Disabled services stop appearing as Live in Fees & Communication">
            <div className="grid gap-3 md:grid-cols-2">{integ.rows.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-4"><div><p className="font-semibold">{i.name}</p><p className="text-xs text-outline">{i.desc}</p></div>
                <Switch checked={i.enabled} label={i.name} onChange={async (v) => { if (await guard(() => integ.update(i.id, { enabled: v }), `${i.name} ${v ? "enabled" : "disabled"}`)) await log(`${v ? "Enabled" : "Disabled"} integration`, i.name); }} /></div>))}</div>
          </Section>

          <Section id="regional" icon={<Globe size={20} />} title="Language, Timezone & Regional Localization" desc="Formatting defaults applied to invoices, report cards, and automated SMS broadcasts" badge={<Badge>ISO 8601 Standard</Badge>}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="SYSTEM LANGUAGE"><Select value={r.language} onChange={(e) => setR({ ...r, language: e.target.value })}>{["English (India) - en_IN", "Hindi - hi_IN", "English (UK) - en_GB"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="DATE DISPLAY PATTERN"><Select value={r.dateFormat} onChange={(e) => setR({ ...r, dateFormat: e.target.value })}>{["DD MMM YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="CAMPUS STANDARD TIME"><Select value={r.timezone} onChange={(e) => setR({ ...r, timezone: e.target.value })}>{["IST · UTC+05:30 (New Delhi)", "GST · UTC+04:00 (Dubai)"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="CURRENCY" className="md:col-span-1"><Input value={r.currency} onChange={(e) => setR({ ...r, currency: e.target.value })} /></Field>
              <Field label="WORKING WEEK" className="md:col-span-2"><Input value={r.workingWeek} onChange={(e) => setR({ ...r, workingWeek: e.target.value })} /></Field>
            </div>
          </Section>
        </div>

        <div className="space-y-6 xl:sticky xl:top-20">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-2"><h2 className="t-headline-md !text-[17px]">Live Letterhead & Bonafide Preview</h2>
              <Button size="sm" variant="ghost" className="text-secondary" onClick={() => toast("PDF generation is not available yet (simulated)")}>Download Sample PDF</Button></div>
            <div className="mt-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-4 text-center text-xs">
              <p className="font-bold text-secondary">{(p.name || "School name").toUpperCase()}</p>
              <p className="text-outline">Affiliation No: {p.affiliation.split(" ")[0] || "—"} · School Code: {p.schoolCode.split(" ")[0] || "—"}</p>
              <p className="text-outline">{p.address}</p>
              <div className="my-3 flex justify-between font-mono text-[10px]"><span>Ref: ADM/{meta?.academicYear || "AY"}/0001 (sample)</span><span>Date: {todayStr ? fmtDate(todayStr) : ""}</span></div>
              <p className="font-bold">TO WHOMSOEVER IT MAY CONCERN</p>
              <p className="mt-2 text-left">This is to certify that Master/Miss <b>[Student Name]</b>, Son/Daughter of [Guardian Name], is a bona fide student of Grade [Class] in this institution for the Academic Session {meta?.academicYear || "—"}.</p>
              <div className="mt-3 flex items-end justify-between text-left"><span className={p.seal ? "text-success" : "text-outline"}>{p.seal ? "✓ Institutional seal on file" : "No seal on file"}</span><span className="text-right font-semibold">{me?.name || "Principal"}<br /><span className="font-normal text-outline">{me?.title || "Head of Institution"}</span></span></div>
            </div>
          </Card>

          <Card className="border-t-4 border-t-warning p-5" id="rollover">
            <div className="flex items-start justify-between gap-2"><div className="flex items-start gap-3"><RefreshCw className="text-warning" size={20} /><div><h2 className="t-headline-md !text-[17px]">Year-End Rollover Safeguard</h2><p className="text-on-surface-variant">Migration pipeline to upcoming AY {toAy}</p></div></div>
              <Badge tone="warning">Step {step} of {STEPS.length}</Badge></div>
            <div className="mt-4 flex gap-1.5 text-xs font-semibold">{STEPS.map((s, i) => <span key={s} className={cn("flex-1 rounded px-2 py-1.5 text-center", i + 1 < step || rolled ? "bg-success-container text-success" : i + 1 === step ? "bg-secondary text-on-secondary" : "bg-surface-container text-on-surface-variant")}>{i + 1}. {s}</span>)}</div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[["COHORT TO PROMOTE", (activeStu.length - graduating).toLocaleString("en-IN"), "Active students below Grade 12"], ["OPEN EXCEPTIONS", `${openExc.length}`, "Must be resolved before rollover"], ["GRADUATING ALUMNI", `${graduating} (Grade 12)`, "Marked for TC & Migration"], ["FEE BALANCE CARRY", inr(duesAmt), `${dues.length} ledger account${dues.length === 1 ? "" : "s"} with dues`]].map(([l, v, s]) => (
                <div key={l} className="rounded-lg border border-outline-variant/60 p-3"><p className="text-[10px] font-semibold tracking-wide text-outline">{l}</p><p className="mt-1 text-xl font-bold">{v}</p><p className="text-xs text-on-surface-variant">{s}</p></div>))}
            </div>
            {rolled ? (
              <div className="mt-4 rounded-lg border border-success/30 bg-success-container/60 p-4 text-sm text-success"><b>Rollover to AY {toAy} marked complete.</b></div>
            ) : (<>
              {openExc.length > 0 ? (
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning-container/60 p-4 text-sm"><p className="flex items-center gap-2 font-semibold text-warning"><AlertTriangle size={16} />{openExc.length} Unresolved Exceptions Found</p>
                  <p className="mt-1 text-on-surface-variant">{openExc.filter((x) => x.kind === "Marks").length} marks issue(s) and {openExc.filter((x) => x.kind === "Concession").length} fee concession issue(s) need attention.</p>
                  <button className="mt-2 cursor-pointer font-semibold text-warning underline" onClick={() => setExcOpen(true)}>Review & Resolve {openExc.length} Exceptions Before Roll-Forward →</button></div>
              ) : <div className="mt-4 rounded-lg border border-success/30 bg-success-container/60 p-3 text-sm text-success">All exceptions resolved. Ready to roll forward.</div>}
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-outline-variant/60 p-3 text-sm"><Checkbox className="mt-0.5" checked={signed} onChange={(e) => setSigned(e.target.checked)} />
                I confirm that Term 2 final marks are audited and all statutory CBSE attendance logs are signed off by the Academic Committee.</label>
              <Button className="mt-4 w-full" size="lg" disabled={!canRoll} onClick={() => { setConfirmText(""); setConfirm(true); }}><Lock size={16} />Execute AY {toAy} Rollover</Button>
              <p className="mt-2 text-center text-xs text-outline">Recorded in the audit trail under {actor}.</p>
            </>)}
          </Card>
        </div>
      </div>

      <Modal open={!!termEdit} onClose={() => setTermEdit(null)} title={termEdit?.id ? "Edit term" : "New term"} footer={<><Button variant="outline" onClick={() => setTermEdit(null)}>Cancel</Button>
        <Button disabled={saving} onClick={async () => {
          if (!termEdit) return;
          if (!termEdit.name.trim()) return toast("Term name is required", "error");
          if (!termEdit.start || !termEdit.end || termEdit.end <= termEdit.start) return toast("Pick a start and an end date after it", "error");
          const days = Math.round((+new Date(termEdit.end) - +new Date(termEdit.start)) / 864e5) + 1;
          const { id, ...rest } = termEdit;
          setSaving(true);
          const ok = await guard(() => (id ? terms.update(id, { ...rest, name: rest.name.trim(), days }) : terms.create({ ...rest, name: rest.name.trim(), days })), id ? "Term updated" : "Term added");
          setSaving(false);
          if (ok) { await log(id ? "Edited term" : "Added term", termEdit.name); setTermEdit(null); }
        }}>Save</Button></>}>
        {termEdit && <div className="grid gap-4"><Field label="Name" required><Input value={termEdit.name} onChange={(e) => setTermEdit({ ...termEdit, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4"><Field label="Start"><Input type="date" value={termEdit.start} onChange={(e) => setTermEdit({ ...termEdit, start: e.target.value })} /></Field><Field label="End"><Input type="date" value={termEdit.end} onChange={(e) => setTermEdit({ ...termEdit, end: e.target.value })} /></Field></div>
          <Field label="Status"><Select value={termEdit.status} onChange={(e) => setTermEdit({ ...termEdit, status: e.target.value })}>{[...new Set(["In Progress", "Scheduled", "Closed", termEdit.status])].map((x) => <option key={x}>{x}</option>)}</Select></Field></div>}
      </Modal>

      <SectionModal target={secEdit} onClose={() => setSecEdit(null)} onSave={async (s) => { const ok = await guard(async () => { if (s.id) await secs.update(s.id, s); else { const { id: _id, ...rest } = s; void _id; await secs.create(rest); } }, "Capacity matrix saved"); if (ok) { await log("Updated capacity matrix", s.grade); setSecEdit(null); } }} />

      <Modal open={acl} onClose={() => setAcl(false)} title="Granular ACL" subtitle="Toggle permissions per role. Changes apply immediately." width="max-w-3xl" footer={<Button onClick={() => setAcl(false)}>Done</Button>}>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Permission</th>{roles.rows.map((x) => <th key={x.id} className="p-2 text-xs">{x.name.split(" (")[0]}</th>)}</tr></thead>
          <tbody>{ALL_PERMS.map((perm) => (<tr key={perm} className="border-t border-outline-variant/40"><td className="p-2">{perm}</td>{roles.rows.map((x) => (
            <td key={x.id} className="p-2"><Checkbox aria-label={`${perm} for ${x.name}`} checked={(x.perms ?? []).includes(perm)} onChange={async (e) => { const on = e.target.checked; if (!(await guard(() => roles.update(x.id, { perms: on ? [...(x.perms ?? []), perm] : (x.perms ?? []).filter((q) => q !== perm) })))) return; await log("Changed permission", `${perm} → ${x.name}: ${on ? "granted" : "revoked"}`); }} /></td>))}</tr>))}</tbody></table></div>
      </Modal>

      <Modal open={excOpen} onClose={() => setExcOpen(false)} title="Rollover exceptions" subtitle={`${openExc.length} open`} footer={<><Button variant="outline" onClick={async () => { if (await guard(() => Promise.all(openExc.map((x) => excs.update(x.id, { resolved: true }))), "All exceptions resolved")) { await log("Resolved exceptions", "All rollover exceptions resolved"); setExcOpen(false); } }} disabled={!openExc.length}>Resolve all</Button><Button onClick={() => setExcOpen(false)}>Close</Button></>}>
        <ul className="divide-y divide-outline-variant/50">{excs.rows.length === 0 && <li className="py-3 text-on-surface-variant">No exceptions recorded.</li>}{excs.rows.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-2.5"><span className={cn("text-sm", x.resolved && "text-outline line-through")}><Badge tone={x.kind === "Marks" ? "warning" : "info"}>{x.kind}</Badge> {x.text}</span>
            {!x.resolved && <Button size="sm" variant="outline" onClick={() => guard(() => excs.update(x.id, { resolved: true }), "Exception resolved")}>Resolve</Button>}</li>))}</ul>
      </Modal>

      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Execute AY ${toAy} rollover?`} subtitle="Marks the academic year as rolled over. Student promotion and ledger carry-forward are not automated yet (simulated)."
        footer={<><Button variant="outline" onClick={() => setConfirm(false)}>Cancel</Button><Button variant="danger" disabled={confirmText !== "ROLLOVER" || saving} onClick={async () => { setSaving(true); const ok = await guard(() => upsertCfg("meta", { rolledOver: true, rolloverStep: 4 }, !!meta), `Rollover to AY ${toAy} marked complete (promotion simulated)`); setSaving(false); if (ok) { await log(`Executed AY ${toAy} rollover`, "Year marked as rolled over"); setConfirm(false); } }}>Execute rollover</Button></>}>
        <Field label='Type "ROLLOVER" to confirm'><Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoFocus /></Field>
      </Modal>

      <Card className="mt-6 p-6"><h2 className="t-headline-md !text-[17px]">Recent audit trail</h2>
        <ul className="mt-3 divide-y divide-outline-variant/50 text-sm">{audit.rows.length === 0 && <li className="py-2 text-on-surface-variant">No changes recorded yet.</li>}{[...audit.rows].sort((a, c) => (c.at ?? "").localeCompare(a.at ?? "")).slice(0, 6).map((a) => (
          <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{a.action}</b> · <span className="text-on-surface-variant">{a.detail}</span></span><span className="text-xs text-outline">{a.actor} · {new Date(a.at).toLocaleString("en-IN")}</span></li>))}</ul></Card>
    </>
  );
}

function SectionModal({ target, onClose, onSave }: { target: Sec | "new" | null; onClose: () => void; onSave: (s: Sec) => void | Promise<void> }) {
  const [v, setV] = useState<{ grade: string; stream: string; sections: string; roster: number; cap: number } | null>(null);
  const [err, setErr] = useState("");
  const [key, setKey] = useState<string | null>(null);
  const k = target === "new" ? "new" : target?.id ?? null;
  if (k !== key) { setKey(k); setErr(""); setV(target && target !== "new" ? { grade: target.grade, stream: target.stream, sections: (target.sections ?? []).join(", "), roster: target.roster, cap: target.cap } : target ? { grade: "", stream: "", sections: "", roster: 0, cap: 40 } : null); }
  if (!target || !v) return null;
  return (
    <Modal open onClose={onClose} title={target === "new" ? "New section" : `Edit ${target.grade}`} footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => {
      const sections = v.sections.split(",").map((x) => x.trim()).filter(Boolean);
      if (!v.grade.trim() || !sections.length) return setErr("Grade and at least one section are required");
      if (!(v.cap >= 1)) return setErr("Capacity must be at least 1");
      if (!(v.roster >= 0) || v.roster > v.cap) return setErr("Roster must be between 0 and the capacity");
      return onSave({ id: target === "new" ? "" : target.id, grade: v.grade.trim(), stream: v.stream, sections, roster: v.roster, cap: v.cap });
    }}>Save</Button></>}>
      <div className="grid gap-4"><Field label="Grade level" required><Input value={v.grade} onChange={(e) => setV({ ...v, grade: e.target.value })} placeholder="Grade 9" /></Field>
        <Field label="Stream / board"><Input value={v.stream} onChange={(e) => setV({ ...v, stream: e.target.value })} /></Field>
        <Field label="Sections (comma separated)" required><Input value={v.sections} onChange={(e) => setV({ ...v, sections: e.target.value })} placeholder="9-A, 9-B" /></Field>
        <div className="grid grid-cols-2 gap-4"><Field label="Roster"><Input type="number" value={v.roster} onChange={(e) => setV({ ...v, roster: Number(e.target.value) })} /></Field><Field label="Capacity"><Input type="number" value={v.cap} onChange={(e) => setV({ ...v, cap: Number(e.target.value) })} /></Field></div>
        {err && <p className="text-xs text-error">{err}</p>}</div>
    </Modal>
  );
}
