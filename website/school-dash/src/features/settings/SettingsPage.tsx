"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { BookOpen, Briefcase, Building2, CalendarClock, CalendarDays, Download, Globe, Lock, Plug, Plus, Save, ShieldCheck, Users } from "lucide-react";
import { Badge, Button, Card, Checkbox, Field, Input, Modal, PageHeader, ProgressBar, Select, Switch, Tabs, useToast } from "@/components/ui";
import type { Tone } from "@/components/ui";
import { cn } from "@/lib/cn";
import { fmtDate } from "@/lib/format";
import { classStream, isCourseId, streamFromClassId } from "@/lib/academicStreams";
import { useCollection } from "@/lib/useCollection";
import { downloadCsv } from "@/features/fees/csv";
import { EMAIL_RE, validPhone } from "@/features/people/staffLogic";
import { addressErrors, addressRecord, type SchoolAddress } from "@/features/onboarding/address";
import { SchoolAddressFields, useAddressLocations } from "@/features/onboarding/SchoolAddressFields";
import { LeavePolicyEditor } from "./LeavePolicyEditor";
import { AdmissionNumberSettings } from "./AdmissionNumberSettings";
import { EmployeeNumberSettings } from "./EmployeeNumberSettings";
import { AdmissionSeatSettings } from "./AdmissionSeatSettings";
import { SeniorCourses } from "./SeniorCourses";
import { SchoolLogoEditor } from "./SchoolLogoEditor";
import { ExamTypeSettings } from "./ExamTypeSettings";
import { SubjectSchemeSettings } from "./SubjectSchemeSettings";
import { AddGradeDrawer } from "./AddGradeDrawer";
import { compareSectionRows, gradeHref, SENIOR_STAGE, stageGroupsWithSenior } from "./gradeSetup";
import { YearRollover } from "./YearRollover";
import { useSchoolClock } from "@/lib/useSchoolClock";
import { TimetableView } from "@/features/ops/TimetableView";
import { bandsError, schoolPatch, termError, termDays } from "./logic";

type Profile = { id: string; name: string; affiliation: string; schoolCode: string; email: string; phone: string; address: string; seal: string; digitalKey: string } & Partial<SchoolAddress>;
type Regional = { id: string; language: string; dateFormat: string; timezone: string; currency: string; workingWeek: string };
type Bell = { id: string; gates: string; classes: string; periods: string; recess: string };
type Meta = { id: string; academicYear: string; rolledOver: boolean; rolloverStep: number };
type Term = { id: string; name: string; start: string; end: string; days: number; status: string };
type Sec = { id: string; grade: string; stream: string; streamId?: string; sections: string[]; roster: number; cap: number };
type Role = { id: string; name: string; tone: Tone; perms: string[] };
type Integ = { id: string; name: string; desc: string; enabled: boolean };
type Band = { id: string; grade: string; min: number; point: number };
type Exc = { id: string; kind: string; text: string; resolved: boolean };
type Audit = { id: string; at: string; actor: string; action: string; detail: string };
type Me = { id: string; name: string; title?: string };
type Stu = { id: string; grade: string; status: string; streamId?: string; stream?: string; classId?: string; deleted?: boolean };
/** school/school (contract 3): the master doc the teacher, parent and driver apps read */
type School = { id: string; name?: string; short?: string; affiliation?: string; academicYear?: string; term?: string; logoUrl?: string; city?: string };

/** fallbacks when a set_config doc is missing (saved on first Save All) */
const DEF_PROFILE: Profile = { id: "profile", name: "", affiliation: "", schoolCode: "", email: "", phone: "", address: "", seal: "", digitalKey: "" };
const DEF_REGIONAL: Regional = { id: "regional", language: "English (India) - en_IN", dateFormat: "DD MMM YYYY", timezone: "IST · UTC+05:30 (New Delhi)", currency: "Indian Rupee (₹ INR)", workingWeek: "Mon – Sat" };
const DEF_BELL: Bell = { id: "bell", gates: "", classes: "", periods: "", recess: "" };
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "Unknown error");

const SECTIONS = [
  { id: "profile", label: "School Profile" }, { id: "year", label: "Academic Year" }, { id: "capacity", label: "Classes & Sections" }, { id: "timetable", label: "Timetable" }, { id: "admissions", label: "Admissions" }, { id: "staff-numbering", label: "Employee IDs" }, { id: "grading", label: "Grading" }, { id: "assessment", label: "Assessment Scheme" }, { id: "leave", label: "Leave Policy" },
  { id: "roles", label: "Roles & Permissions" }, { id: "integrations", label: "Integrations" }, { id: "regional", label: "Localization" }, { id: "rollover", label: "Year-End Rollover" }, { id: "audit", label: "Audit Log" },
];
const ALL_PERMS = ["Master Timetable", "Marks & Grades Entry", "Daily Attendance", "Homework Broadcast"];
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
  const router = useRouter();
  const params = useSearchParams();
  const requestedSection = params.get("section");
  const active = requestedSection === "subjects" ? "capacity" : SECTIONS.find(({ id }) => id === requestedSection)?.id ?? "profile";
  const [visited, setOpened] = useState<ReadonlySet<string>>(() => new Set());
  const opened = new Set([...visited, active]);
  const activeLabel = SECTIONS.find(({ id }) => id === active)?.label ?? "School Profile";
  const cfg = useCollection<Profile & Regional & Bell & Meta>("set_config");
  const terms = useCollection<Term>("set_terms", active === "year");
  const secs = useCollection<Sec>("set_sections", opened.has("capacity"));
  const roles = useCollection<Role>("set_roles", active === "roles");
  const integ = useCollection<Integ>("set_integrations", active === "integrations");
  const bands = useCollection<Band>("set_grading", active === "grading");
  const excs = useCollection<Exc>("set_exceptions", active === "rollover");
  const audit = useCollection<Audit>("set_audit", active === "audit");
  const me = useCollection<Me>("me").rows[0];
  const students = useCollection<Stu>("students", opened.has("capacity") || active === "rollover");
  const schoolCol = useCollection<School>("school");
  const school = schoolCol.rows.find((x) => x.id === "school");

  const profile = cfg.rows.find((r) => r.id === "profile") as unknown as Profile | undefined;
  const regional = cfg.rows.find((r) => r.id === "regional") as unknown as Regional | undefined;
  const bell = cfg.rows.find((r) => r.id === "bell") as unknown as Bell | undefined;
  const meta = cfg.rows.find((r) => r.id === "meta") as unknown as Meta | undefined;

  // local date (not UTC) so the letterhead shows the right day before 05:30 IST
  const { date: todayStr } = useSchoolClock();
  const [p, setP] = useState<Profile | null>(null);
  const [campusEdited, setCampusEdited] = useState(false);
  const campus: SchoolAddress = {
    addressLine1: p?.addressLine1 ?? "",
    addressLine2: p?.addressLine2 ?? "",
    country: p?.country ?? "",
    state: p?.state ?? "",
    stateName: p?.stateName,
    district: p?.district ?? "",
    districtName: p?.districtName,
    city: p?.city ?? "",
    pin: p?.pin ?? "",
  };
  const campusLocations = useAddressLocations(active === "profile" ? campus.country : "");
  const campusRecord = !campusLocations.loading && !campusLocations.error ? addressRecord(campus, campusLocations.states) : null;
  const [r, setR] = useState<Regional | null>(null);
  const b = bell ?? DEF_BELL;
  const [bd, setBd] = useState<Record<string, number>>({});
  // first load: copy the saved docs (or defaults for missing ones) into local drafts
  if (!p && ((profile && regional && bell) || cfg.ready)) { setP({ ...DEF_PROFILE, ...profile }); setR(regional ?? DEF_REGIONAL); }

  const [termEdit, setTermEdit] = useState<Term | null>(null);
  const [saving, setSaving] = useState(false);
  const [addingGrade, setAddingGrade] = useState(false);
  const [acl, setAcl] = useState(false);
  const [excOpen, setExcOpen] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [gradingError, setGradingError] = useState("");

  const actor = me?.name || "Administrator";
  const log = (action: string, detail: string) => audit.create({ at: new Date().toISOString(), actor, action, detail } as Omit<Audit, "id">).catch(() => undefined); // audit is best-effort
  /** runs a write and toasts the Firestore error instead of failing silently; returns success */
  const guard = async (fn: () => Promise<unknown>, ok?: string) => { try { await fn(); if (ok) toast(ok); return true; } catch (e) { toast(`Could not save: ${errText(e)}`, "error"); return false; } };
  const upsertCfg = (id: string, v: object, exists: boolean) => (exists ? cfg.update(id, v as never) : cfg.create({ ...v, id } as never));
  /** keeps school/school (read by all three apps) in step with what Settings edits */
  const syncSchool = (v: Partial<School>) => { const patch = schoolPatch(school, v); if (!patch) return Promise.resolve(); return school ? schoolCol.update("school", patch) : schoolCol.create({ id: "school", short: v.name ?? "", ...patch } as School); };
  const academicYear = meta?.academicYear || school?.academicYear || "";

  const saveSection = async (label: string, save: () => Promise<unknown>) => {
    setSaving(true);
    const ok = await guard(save, `${label} saved`);
    setSaving(false);
    if (ok) await log(`Saved ${label.toLowerCase()}`, label);
    return ok;
  };

  const saveProfile = async () => {
    if (!p || !schoolCol.ready) return;
    const errors: Record<string, string> = {};
    if (!p.name.trim()) errors.name = "Institution name is required";
    if (!EMAIL_RE.test(p.email.trim())) errors.email = "Enter a valid email";
    if (!validPhone(p.phone)) errors.phone = "Enter a valid phone number";
    if (!p.affiliation.trim()) errors.affiliation = "Required";
    const saveCampus = campusEdited || !p.address?.trim();
    if (saveCampus) {
      if (!campusRecord) errors.campus = "Wait for the location options to load before saving.";
      else Object.assign(errors, addressErrors(campus, campusLocations.states));
    }
    setErrs(errors);
    if (Object.keys(errors).length) { toast("Fix the highlighted fields", "error"); return; }
    const address = saveCampus ? campusRecord : null;
    const ok = await saveSection("School profile", () => Promise.all([
      upsertCfg("profile", { ...p, ...address }, !!profile),
      syncSchool({ name: p.name.trim(), affiliation: p.affiliation.trim(), city: address?.city }),
    ]));
    if (ok && address) {
      setP((current) => current && { ...current, ...address });
      setCampusEdited(false);
    }
  };

  const saveGrades = async () => {
    const error = bandsError(bands.rows.map((g) => ({ ...g, min: bd[g.id] ?? g.min })));
    setGradingError(error || "");
    if (error) return;
    const ok = await saveSection("Grading", () => Promise.all(Object.entries(bd).map(([id, min]) => bands.update(id, { min }))));
    if (ok) setBd({});
  };

  const openSection = (id: string) => {
    const next = new URLSearchParams(params.toString());
    if (id === "profile") next.delete("section"); else next.set("section", id);
    router.replace(`/settings${next.size ? `?${next}` : ""}`, { scroll: false });
    setOpened((current) => new Set([...current, id]));
    requestAnimationFrame(() => document.getElementById("settings-panel")?.scrollIntoView({ block: "nearest" }));
  };

  const openExc = excs.rows.filter((x) => !x.resolved);
  const activeStu = students.rows.filter((x) => x.status === "Active" && !x.deleted);
  const readiness: Record<string, boolean> = { year: terms.ready && schoolCol.ready, capacity: secs.ready && students.ready,
    roles: roles.ready, integrations: integ.ready, grading: bands.ready, rollover: excs.ready && schoolCol.ready, audit: audit.ready };

  if (!p || !r || !b) return <p className="text-on-surface-variant">Loading settings…</p>;
  const sectionRows = secs.rows.map((row) => isCourseId(row.streamId ?? "") ? {
    ...row, roster: activeStu.filter((student) => `Grade ${student.grade}` === row.grade &&
      (classStream(student) || streamFromClassId(student.classId)) === row.streamId).length,
  } : row).sort(compareSectionRows);
  const seatsUsed = sectionRows.reduce((a, x) => a + (Number(x.roster) || 0), 0), seatsCap = sectionRows.reduce((a, x) => a + (Number(x.cap) || 0), 0);
  const sortedBands = [...bands.rows].sort((a, c) => c.min - a.min);

  return (
    <>
      <PageHeader title="Settings" subtitle={activeLabel} />
      <div className="sticky top-0 z-10 -mx-1 mb-5 bg-surface/90 px-1 py-2 backdrop-blur"><Tabs items={SECTIONS} value={active} onChange={openSection} /></div>

      <div id="settings-panel" role="tabpanel" aria-label={activeLabel} className="scroll-mt-24">
        {readiness[active] === false && <p role="status" className="text-on-surface-variant">Loading {activeLabel.toLowerCase()}…</p>}
        {active === "profile" && <div className="grid items-start gap-6 xl:grid-cols-[1fr_440px]">
          <Section id="profile" icon={<Building2 size={20} />} title="School Profile, Affiliation & Official Seal" desc="Statutory credentials printed on report cards, bonafides, and CBSE manifests" badge={<Badge tone={profile?.affiliation ? "success" : "warning"}>{profile?.affiliation ? "Affiliation on file" : "Affiliation missing"}</Badge>}>
            <SchoolLogoEditor logoUrl={school?.logoUrl} disabled={!schoolCol.ready} />
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="OFFICIAL INSTITUTION NAME" required error={errs.name} className="md:col-span-2"><Input value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} /></Field>
              <Field label="CBSE AFFILIATION NO." required error={errs.affiliation}><Input value={p.affiliation} onChange={(e) => setP({ ...p, affiliation: e.target.value })} /></Field>
              <Field label="CBSE SCHOOL CODE & CENTER ID"><Input value={p.schoolCode} onChange={(e) => setP({ ...p, schoolCode: e.target.value })} /></Field>
              <Field label="OFFICIAL ADMINISTRATIVE EMAIL" required error={errs.email}><Input value={p.email} onChange={(e) => setP({ ...p, email: e.target.value })} /></Field>
              <Field label="REGISTRAR PBX HOTLINE" required error={errs.phone}><Input value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} /></Field>
              <section className="space-y-3 md:col-span-2">
                <h3 className="font-semibold">Campus physical location</h3>
                {p.address && !p.addressLine1 && <p className="whitespace-pre-wrap text-sm text-on-surface-variant">Saved address: {p.address}</p>}
                <SchoolAddressFields legend="Campus physical location" value={campus} {...campusLocations} errors={errs} disabled={saving}
                  onChange={(patch) => {
                    setCampusEdited(true);
                    setP((current) => current && { ...current, ...patch });
                  }} />
                {errs.campus && <p role="alert" className="text-sm text-error">{errs.campus}</p>}
              </section>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-3">
              <ShieldCheck className="text-secondary" size={20} />
              <div className="min-w-0 flex-1"><p className="font-semibold">Institutional Crest & Watermark (.PNG)</p><p className="truncate text-xs text-outline">{p.seal ? `${p.seal} · ` : "No seal selected · "}Used on hall tickets & transcript PDFs (file upload simulated)</p></div>
              <label className="inline-flex h-8 cursor-pointer items-center rounded border border-outline-variant px-3 text-xs font-semibold hover:bg-surface-container-low">Update Seal
                <input type="file" accept="image/png" className="sr-only" aria-label="Update seal" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setP({ ...p, seal: f.name }); toast("Seal selected. Save to apply"); } }} /></label>
              {p.digitalKey && <Badge tone="success">Digital Key: {p.digitalKey}</Badge>}
            </div>
            <Button className="mt-4" disabled={saving || !schoolCol.ready} onClick={saveProfile}><Save size={16} />Save school profile</Button>
          </Section>

          <Card className="p-5">
            <div className="flex items-start justify-between gap-2"><h2 className="t-headline-md !text-[17px]">Live Letterhead & Bonafide Preview</h2>
              <Button size="sm" variant="ghost" className="text-secondary" onClick={() => toast("PDF generation is not available yet (simulated)")}>Download Sample PDF</Button></div>
            <div className="mt-3 rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-4 text-center text-xs">
              <p className="font-bold text-secondary">{(p.name || "School name").toUpperCase()}</p>
              <p className="text-outline">Affiliation No: {p.affiliation.split(" ")[0] || "—"} · School Code: {p.schoolCode.split(" ")[0] || "—"}</p>
              <p className="whitespace-pre-wrap break-words text-outline">{campusEdited || !p.address ? campusRecord?.address ?? p.address : p.address}</p>
              <div className="my-3 flex justify-between font-mono text-[10px]"><span>Ref: ADM/{academicYear || "AY"}/0001 (sample)</span><span>Date: {todayStr ? fmtDate(todayStr) : ""}</span></div>
              <p className="font-bold">TO WHOMSOEVER IT MAY CONCERN</p>
              <p className="mt-2 text-left">This is to certify that Master/Miss <b>[Student Name]</b>, Son/Daughter of [Guardian Name], is a bona fide student of Grade [Class] in this institution for the Academic Session {academicYear || "—"}.</p>
              <div className="mt-3 flex items-end justify-between text-left"><span className={p.seal ? "text-success" : "text-outline"}>{p.seal ? "✓ Institutional seal on file" : "No seal on file"}</span><span className="text-right font-semibold">{me?.name || "Principal"}<br /><span className="font-normal text-outline">{me?.title || "Head of Institution"}</span></span></div>
            </div>
          </Card>
        </div>}

        {active === "timetable" && <TimetableView embedded />}

        {opened.has("admissions") && <div hidden={active !== "admissions"}>
          <Section id="admissions" icon={<Users size={20} />} title="Admission numbering" desc="Configure the number assigned to future admissions.">
            <AdmissionNumberSettings />
          </Section>
        </div>}
        {opened.has("staff-numbering") && <div hidden={active !== "staff-numbering"}>
          <Section id="staff-numbering" icon={<Briefcase size={20} />} title="Employee ID numbering" desc="Set the pattern for automatically generated employee IDs.">
            <EmployeeNumberSettings />
          </Section>
        </div>}
        {active === "year" && readiness.year && <Section id="year" icon={<CalendarDays size={20} />} title="Academic Year & Term Configuration" desc="Active academic calendar timeline & operational bell schedule" badge={<Badge tone="info">Current: AY {academicYear || "—"}{school?.term ? ` · ${school.term}` : ""}</Badge>}
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
                <Field label="Gates open"><Input value={b.gates} readOnly /></Field>
                <Field label="Classes"><Input value={b.classes} readOnly /></Field>
                <Field label="Periods"><Input value={b.periods} readOnly /></Field>
                <Field label="Recess"><Input value={b.recess} readOnly /></Field>
              </div>
              <Link href="/settings?section=timetable#school-timings" className="mt-4 inline-block text-sm font-semibold text-secondary hover:underline">Edit school hours &amp; breaks in Timetable</Link>
            </div>
        </Section>}

        {opened.has("capacity") && readiness.capacity && <div hidden={active !== "capacity"}>
          <Section id="capacity" icon={<Users size={20} />} title="Class & Section Capacity Matrix" desc={`Campus occupancy: ${seatsUsed} / ${seatsCap} seats occupied (${((seatsUsed / Math.max(1, seatsCap)) * 100).toFixed(1)}%)`}
            actions={<Button size="sm" onClick={() => setAddingGrade(true)}><Plus size={14} />Add grade</Button>}>
            <AdmissionSeatSettings />
            {secs.rows.length === 0 && <p className="mb-4 rounded-lg border border-dashed border-outline-variant p-4 text-center text-on-surface-variant">No classes configured yet. Add a grade to get started.</p>}
            <div className="space-y-6">
              {stageGroupsWithSenior(sectionRows).map(({ stage, rows }) => (
                <section key={stage} aria-label={stage} className={cn("rounded-lg border", stage === SENIOR_STAGE ? "border-secondary/40" : "border-outline-variant/60")}>
                  <div className={cn("flex flex-wrap items-center justify-between gap-2 rounded-t-lg px-4 py-3", stage === SENIOR_STAGE ? "bg-info-container/60" : "bg-surface-container-low")}>
                    <div>
                      <h3 className={cn("text-sm font-semibold uppercase tracking-wider", stage === SENIOR_STAGE ? "text-secondary" : "text-on-surface-variant")}>{stage}</h3>
                      {stage === SENIOR_STAGE && <p className="text-xs text-on-surface-variant">Grades 11 and 12 · one row per department and grade</p>}
                    </div>
                    {stage === SENIOR_STAGE && <SeniorCourses compact />}
                  </div>
                  {stage === SENIOR_STAGE && !rows.length ? <p className="p-4 text-sm text-on-surface-variant">No departments yet. Use Add department to set up Science, Commerce, Humanities or any other Plus Two department with its head, subjects and seats.</p> :
                  <div className="overflow-x-auto"><table className="w-full text-left">
                    <thead className="t-label-caps !text-[11px] text-on-surface-variant"><tr><th className="p-3">Grade level</th><th className="p-3">Sections</th><th className="p-3">Roster / Cap</th><th className="p-3">Utilization</th></tr></thead>
                    <tbody>{rows.map((s) => { const u = s.cap > 0 ? (s.roster / s.cap) * 100 : 0; return (
                      <tr key={s.id} className="cursor-pointer border-t border-outline-variant/50 transition-colors hover:bg-surface-container-low" onClick={() => router.push(gradeHref(s.id))} aria-label={`${s.grade}${s.streamId ? ` · ${s.stream}` : ""} row`}><td className="p-3"><Link href={gradeHref(s.id)} className="font-semibold text-secondary hover:underline" aria-label={`Open ${s.grade}${s.streamId ? ` · ${s.stream}` : ""}`} onClick={(event) => event.stopPropagation()}>{s.grade}</Link><div className="text-xs text-outline">{s.stream}</div></td>
                        <td className="p-3"><div className="flex flex-wrap gap-1">{(s.sections ?? []).map((x) => <span key={x} className="rounded border border-outline-variant/60 bg-surface-container-low px-2 py-0.5 text-xs">{x}</span>)}</div></td>
                        <td className="p-3 font-mono">{s.roster} / {s.cap}</td>
                        <td className="p-3 w-40"><ProgressBar value={u} tone={u > 96 ? "success" : "brand"} /><span className="text-xs text-on-surface-variant">{u.toFixed(1)}%</span></td></tr>); })}</tbody></table></div>}
                </section>
              ))}
            </div>
          </Section>
        </div>}

        {active === "grading" && readiness.grading && <Section id="grading" icon={<BookOpen size={20} />} title="Grading Scheme" desc="CBSE 9-point scale. Minimum percentage for each grade band (used by Exams & Results)" badge={<Badge tone="info">CBSE 9-POINT</Badge>}>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {sortedBands.map((g) => (
                <label key={g.id} className="rounded-lg border border-outline-variant/60 p-3 text-center"><span className="font-mono font-bold text-secondary">{g.grade}</span><span className="block text-xs text-outline">{g.point} pts · min %</span>
                  <input aria-label={`Minimum percent for ${g.grade}`} type="number" min={0} max={100} disabled={g.grade === "E"} value={bd[g.id] ?? g.min} onChange={(e) => setBd({ ...bd, [g.id]: Math.max(0, Math.min(100, Number(e.target.value))) })} className="mt-1 h-8 w-full rounded border border-outline-variant text-center font-mono disabled:bg-surface-container" /></label>))}
            </div>
            {gradingError && <p role="alert" className="mt-2 text-xs text-error">{gradingError}</p>}
            <Button className="mt-4" disabled={saving || !Object.keys(bd).length} onClick={saveGrades}><Save size={16} />Save grading</Button>
        </Section>}

        {opened.has("assessment") && <div hidden={active !== "assessment"}>
          <Section id="assessment" icon={<BookOpen size={20} />} title="Assessment Scheme" desc="Exam types with their term weightage, and the subject scheme of each class group. Every exam is created from these, so set them once a year.">
            <div className="space-y-8"><ExamTypeSettings /><SubjectSchemeSettings /></div>
          </Section>
        </div>}

        {opened.has("leave") && <div hidden={active !== "leave"}>
          <Section id="leave" icon={<CalendarClock size={20} />} title="Leave Policy & Check-in Time" desc="Yearly leave entitlement per type and the check-in time after which teachers are marked late (teacher app quotas use these)">
            <LeavePolicyEditor onSaved={(d) => { void log("Updated leave policy", d); }} />
          </Section>
        </div>}

        {active === "roles" && readiness.roles && <Section id="roles" icon={<Lock size={20} />} title="Roles & RBAC Quick Governance" desc="Access tiers, sensitive operation gates, and module-level write rights" actions={<Button size="sm" variant="ghost" className="text-secondary" onClick={() => setAcl(true)}>Configure Granular ACL</Button>}>
            <div className="space-y-3">{roles.rows.map((x) => (
              <div key={x.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-4"><span className="w-56 font-semibold">{x.name}</span>
                <div className="flex flex-wrap gap-1.5">{(x.perms ?? []).map((q) => <span key={q} className={cn("rounded px-2 py-0.5 text-xs font-medium", roleTone[x.tone])}>{q}</span>)}</div></div>))}</div>
        </Section>}

        {active === "integrations" && readiness.integrations && <Section id="integrations" icon={<Plug size={20} />} title="Integrations" desc="Enable or disable connected services. Disabled services stop appearing as Live in Fees & Communication">
            <div className="grid gap-3 md:grid-cols-2">{integ.rows.map((i) => (
              <div key={i.id} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-4"><div><p className="font-semibold">{i.name}</p><p className="text-xs text-outline">{i.desc}</p></div>
                <Switch checked={i.enabled} label={i.name} onChange={async (v) => { if (await guard(() => integ.update(i.id, { enabled: v }), `${i.name} ${v ? "enabled" : "disabled"}`)) await log(`${v ? "Enabled" : "Disabled"} integration`, i.name); }} /></div>))}</div>
        </Section>}

        {active === "regional" && <Section id="regional" icon={<Globe size={20} />} title="Language, Timezone & Regional Localization" desc="Formatting defaults applied to invoices, report cards, and Firebase app reminders" badge={<Badge>ISO 8601 Standard</Badge>}>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="SYSTEM LANGUAGE"><Select value={r.language} onChange={(e) => setR({ ...r, language: e.target.value })}>{["English (India) - en_IN", "Hindi - hi_IN", "English (UK) - en_GB"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="DATE DISPLAY PATTERN"><Select value={r.dateFormat} onChange={(e) => setR({ ...r, dateFormat: e.target.value })}>{["DD MMM YYYY", "DD/MM/YYYY", "YYYY-MM-DD"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="CAMPUS STANDARD TIME"><Select value={r.timezone} onChange={(e) => setR({ ...r, timezone: e.target.value })}>{["IST · UTC+05:30 (New Delhi)", "GST · UTC+04:00 (Dubai)"].map((x) => <option key={x}>{x}</option>)}</Select></Field>
              <Field label="CURRENCY" className="md:col-span-1"><Input value={r.currency} onChange={(e) => setR({ ...r, currency: e.target.value })} /></Field>
              <Field label="WORKING WEEK" className="md:col-span-2"><Input value={r.workingWeek} onChange={(e) => setR({ ...r, workingWeek: e.target.value })} /></Field>
            </div>
            <Button className="mt-4" disabled={saving} onClick={() => saveSection("Localization", () => upsertCfg("regional", r, !!regional))}><Save size={16} />Save localization</Button>
        </Section>}
        {active === "rollover" && readiness.rollover && <YearRollover academicYear={school?.academicYear || meta?.academicYear || ""} onReviewExceptions={() => setExcOpen(true)} />}

        {active === "audit" && audit.ready && <Section id="audit" icon={<ShieldCheck size={20} />} title="Recent audit trail" desc="View recent Settings changes or download the full log."
          actions={<Button variant="outline" disabled={!audit.rows.length} onClick={() => { downloadCsv("audit-log.csv", [["Time", "Actor", "Action", "Detail"], ...audit.rows.map((a) => [a.at, a.actor, a.action, a.detail])]); toast("Audit log downloaded"); }}><Download size={16} />Download Audit Log (.csv)</Button>}>
        <ul className="mt-3 divide-y divide-outline-variant/50 text-sm">{audit.rows.length === 0 && <li className="py-2 text-on-surface-variant">No changes recorded yet.</li>}{[...audit.rows].sort((a, c) => (c.at ?? "").localeCompare(a.at ?? "")).slice(0, 6).map((a) => (
          <li key={a.id} className="flex flex-wrap justify-between gap-2 py-2"><span><b>{a.action}</b> · <span className="text-on-surface-variant">{a.detail}</span></span><span className="text-xs text-outline">{a.actor} · {new Date(a.at).toLocaleString("en-IN")}</span></li>))}</ul></Section>}
      </div>

      <Modal open={!!termEdit} onClose={() => setTermEdit(null)} title={termEdit?.id ? "Edit term" : "New term"} footer={<><Button variant="outline" onClick={() => setTermEdit(null)}>Cancel</Button>
        <Button disabled={saving} onClick={async () => {
          if (!termEdit) return;
          const problem = termError(termEdit, terms.rows);
          if (problem) return toast(problem, "error");
          const days = termDays(termEdit.start, termEdit.end);
          const { id, ...rest } = termEdit;
          setSaving(true);
          // the In Progress term is the school's current term (school/school.term, contract 3)
          const ok = await guard(() => Promise.all([id ? terms.update(id, { ...rest, name: rest.name.trim(), days }) : terms.create({ ...rest, name: rest.name.trim(), days }),
            ...(rest.status === "In Progress" ? [syncSchool({ term: rest.name.trim() })] : [])]), id ? "Term updated" : "Term added");
          setSaving(false);
          if (ok) { await log(id ? "Edited term" : "Added term", termEdit.name); setTermEdit(null); }
        }}>Save</Button></>}>
        {termEdit && <div className="grid gap-4"><Field label="Name" required><Input value={termEdit.name} onChange={(e) => setTermEdit({ ...termEdit, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-4"><Field label="Start"><Input type="date" value={termEdit.start} onChange={(e) => setTermEdit({ ...termEdit, start: e.target.value })} /></Field><Field label="End"><Input type="date" value={termEdit.end} onChange={(e) => setTermEdit({ ...termEdit, end: e.target.value })} /></Field></div>
          <Field label="Status"><Select value={termEdit.status} onChange={(e) => setTermEdit({ ...termEdit, status: e.target.value })}>{[...new Set(["In Progress", "Scheduled", "Closed", termEdit.status])].map((x) => <option key={x}>{x}</option>)}</Select></Field></div>}
      </Modal>

      <AddGradeDrawer open={addingGrade} onClose={() => setAddingGrade(false)} onCreated={(id, label) => { setAddingGrade(false); void log("Added grade", label); router.push(gradeHref(id)); }} />

      <Modal open={acl} onClose={() => setAcl(false)} title="Granular ACL" subtitle="Teachers and HODs can write only assigned-class data. Master Timetable controls live teaching sessions. School administrators retain full access." width="max-w-3xl" footer={<Button onClick={() => setAcl(false)}>Done</Button>}>
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Permission</th>{roles.rows.filter((x) => ["role_admin", "role_hod", "role_teacher"].includes(x.id)).map((x) => <th key={x.id} className="p-2 text-xs">{x.name.split(" (")[0]}</th>)}</tr></thead>
          <tbody>{ALL_PERMS.map((perm) => (<tr key={perm} className="border-t border-outline-variant/40"><td className="p-2">{perm === "Master Timetable" ? "Live teaching sessions" : perm}</td>{roles.rows.filter((x) => ["role_admin", "role_hod", "role_teacher"].includes(x.id)).map((x) => (
            <td key={x.id} className="p-2"><Checkbox aria-label={`${perm} for ${x.name}`} disabled={x.id === "role_admin"} checked={x.id === "role_admin" || (x.perms ?? []).includes(perm)} onChange={async (e) => { const on = e.target.checked; if (!(await guard(() => roles.update(x.id, { perms: on ? [...(x.perms ?? []), perm] : (x.perms ?? []).filter((q) => q !== perm) })))) return; await log("Changed permission", `${perm} → ${x.name}: ${on ? "granted" : "revoked"}`); }} /></td>))}</tr>))}</tbody></table></div>
      </Modal>

      <Modal open={excOpen} onClose={() => setExcOpen(false)} title="Rollover exceptions" subtitle={`${openExc.length} open`} footer={<><Button variant="outline" onClick={async () => { if (await guard(() => Promise.all(openExc.map((x) => excs.update(x.id, { resolved: true }))), "All exceptions resolved")) { await log("Resolved exceptions", "All rollover exceptions resolved"); setExcOpen(false); } }} disabled={!openExc.length}>Resolve all</Button><Button onClick={() => setExcOpen(false)}>Close</Button></>}>
        <ul className="divide-y divide-outline-variant/50">{excs.rows.length === 0 && <li className="py-3 text-on-surface-variant">No exceptions recorded.</li>}{excs.rows.map((x) => (
          <li key={x.id} className="flex items-center justify-between gap-3 py-2.5"><span className={cn("text-sm", x.resolved && "text-outline line-through")}><Badge tone={x.kind === "Marks" ? "warning" : "info"}>{x.kind}</Badge> {x.text}</span>
            {!x.resolved && <Button size="sm" variant="outline" onClick={() => guard(() => excs.update(x.id, { resolved: true }), "Exception resolved")}>Resolve</Button>}</li>))}</ul>
      </Modal>



    </>
  );
}
