"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { writeBatch } from "firebase/firestore";
import { Button, Field, Input, Select } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { db } from "@/lib/firebase";
import { AddStaffFields } from "@/features/people/AddStaffFields";
import { Grid, StepFooter, type StepProps } from "./FormBits";
import { addressRecord } from "./address";
import { SchoolAddressFields, useAddressLocations } from "./SchoolAddressFields";
import { ClassSetupEditor } from "./ClassSetupEditor";
import { classIdOf, classStream, feeScopesForClasses, isCourseId, isSeniorGrade, parseFeeScope, streamFromClassId, streamIdOf, streamName } from "@/lib/academicStreams";
import { BellScheduleEditor } from "./BellScheduleEditor";
import { FeePlanEditor } from "./FeePlanEditor";
import { feePlanError, gradeFeeRecord, initialFeePlan, normalizedFeePlan, type FeePlan } from "@/features/fees/feePlan";
import { createStamp, schoolDoc } from "@/features/fees/logic";
import {
  SETUP_GRADES, allocationError, ayLabel, ayStart, bellError, bellRecord, initialBell, normalizedBell, classIdOfLabel, classesFor, currentTermName,
  profileErrors, sectionRowsFor, sectionsError,
  termDays, termErrors, termStatus, type Bell, type GradeCfg, type Profile, type Term,
} from "./logic";

const num = (v: unknown) => Number(v) || 0;
const hasErrors = (e: Record<string, string>) => Object.keys(e).length > 0;
const localToday = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const AY_START = ayStart();
type Coll = ReturnType<typeof useCollection<any>>;
/** update the doc when it exists, else create it (a fresh or partly bootstrapped school may miss config docs) */
const upsert = (c: Coll, id: string, data: Record<string, unknown>) => (c.rows.some((r: any) => r.id === id) ? c.update(id, data) : c.create({ id, ...data }));

/* ---------------- 1 · School profile ---------------- */
function Step1(props: StepProps) {
  const schoolC = useCollection<any>("school");
  const cfgC = useCollection<any>("set_config");
  if (!schoolC.ready || !cfgC.ready) return <p role="status" className="text-on-surface-variant">Loading school profile…</p>;
  return <SchoolProfileForm {...props} schoolC={schoolC} cfgC={cfgC} />;
}

function SchoolProfileForm({ initial, busy, onSubmit, schoolC, cfgC }: StepProps & { schoolC: Coll; cfgC: Coll }) {
  const school = schoolC.rows.find((r) => r.id === "school");
  const profile = cfgC.rows.find((r) => r.id === "profile");
  const [v, setV] = useState<Profile>(() => {
    const saved = { ...profile, ...initial };
    return {
      name: saved.name ?? school?.name ?? "", short: saved.short ?? school?.short ?? "", board: saved.board ?? school?.board ?? "CBSE", affiliation: saved.affiliation ?? school?.affiliation ?? "",
      addressLine1: saved.addressLine1 ?? saved.address ?? "", addressLine2: saved.addressLine2 ?? "", country: saved.country ?? "IN", state: saved.state ?? "", stateName: saved.stateName ?? "", district: saved.district ?? "", districtName: saved.districtName ?? "", city: saved.city ?? school?.city ?? "", pin: saved.pin ?? "",
      phone: saved.phone ?? "", email: saved.email ?? "",
    };
  });
  const locations = useAddressLocations(v.country);
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV((prev) => ({ ...prev, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || locations.loading || locations.error) return;
    const x = profileErrors(v, locations.states);
    setErr(x);
    if (hasErrors(x)) return;
    const aff = v.affiliation.trim().replace(/^#/, "");
    const address = addressRecord(v, locations.states);
    await onSubmit({ ...v, ...address }, async () => {
      // contract section 3: school/school = {name, short, board, affiliation, city, academicYear, term}
      await upsert(schoolC, "school", { name: v.name.trim(), short: v.short.trim() || v.name.trim(), board: v.board, affiliation: `#${aff}`, city: v.city.trim() });
      await upsert(cfgC, "profile", { name: v.name.trim(), affiliation: aff, email: v.email.trim(), phone: v.phone.trim(), ...address });
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-4">
        <Field label="School name" required error={err.name}><Input value={v.name} onChange={set("name")} placeholder="e.g. Greenfield International School" /></Field>
        <Grid>
          <Field label="Short name" hint="Shown in the sidebar"><Input value={v.short} onChange={set("short")} /></Field>
          <Field label="Board"><Select value={v.board} onChange={set("board")}>{["CBSE", "ICSE", "IB", "State Board", "Cambridge"].map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Affiliation number" required error={err.affiliation}><Input value={v.affiliation} onChange={set("affiliation")} inputMode="numeric" placeholder="1930281" /></Field>
        </Grid>
        <SchoolAddressFields value={v} onChange={(patch) => { setV((prev) => ({ ...prev, ...patch })); setErr((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !(key in patch)))); }} errors={err} {...locations} disabled={busy} />
        <Grid>
          <Field label="Phone" required error={err.phone}><Input value={v.phone} onChange={set("phone")} inputMode="tel" /></Field>
          <Field label="Official email" required error={err.email} className="sm:col-span-2"><Input type="email" value={v.email} onChange={set("email")} /></Field>
        </Grid>
      </div>
      <StepFooter busy={busy} disabled={locations.loading || !!locations.error} />
    </form>
  );
}

/* ---------------- 2 · Academic year & terms ---------------- */
function Step2({ initial, busy, onSubmit, back }: StepProps) {
  const terms = useCollection<any>("set_terms");
  const cfgC = useCollection<any>("set_config");
  const school = useCollection<any>("school");
  const [year, setYear] = useState<string>(initial?.year ?? ayLabel(AY_START));
  const [list, setList] = useState<Term[]>(initial?.terms ?? [{ name: "Term 1", start: `${AY_START}-04-01`, end: `${AY_START}-09-30` }, { name: "Term 2", start: `${AY_START}-10-01`, end: `${AY_START + 1}-03-31` }]);
  const [err, setErr] = useState<string[]>([]);
  const [days, setDays] = useState<number>(initial?.workingDays ?? 220);
  const edit = (i: number, k: keyof Term, val: string) => setList(list.map((t, n) => (n === i ? { ...t, [k]: val } : t)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x = termErrors(list, days);
    setErr(x);
    if (x.length) return;
    const today = localToday();
    await onSubmit({ year, terms: list, workingDays: days }, async () => {
      await Promise.all(terms.rows.map((r) => terms.remove(r.id)));
      for (const [i, t] of [...list].sort((a, b) => a.start.localeCompare(b.start)).entries()) {
        await terms.create({ id: `term_${i + 1}`, name: t.name.trim(), start: t.start, end: t.end, days: termDays(t, days), status: termStatus(t, today) });
      }
      await upsert(cfgC, "meta", { academicYear: year });
      // contract section 3: school.academicYear + school.term ("Term 2") are read by the teacher and parent apps
      await upsert(school, "school", { academicYear: year, term: currentTermName(list, today) });
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <Field label="Academic year"><Select value={year} onChange={(e) => setYear(e.target.value)}>{[...new Set([ayLabel(AY_START - 1), ayLabel(AY_START), ayLabel(AY_START + 1), year])].map((y) => <option key={y}>{y}</option>)}</Select></Field>
        <Field label="Statutory working days" hint="CBSE minimum is 220"><Input type="number" value={days} onChange={(e) => setDays(num(e.target.value))} /></Field>
      </Grid>
      <div className="mt-6 space-y-3">
        {list.map((t, i) => (
          <div key={i} className="grid items-end gap-3 rounded-lg border border-outline-variant/60 p-4 sm:grid-cols-[1fr_150px_150px_auto]">
            <Field label="Term name"><Input value={t.name} onChange={(e) => edit(i, "name", e.target.value)} /></Field>
            <Field label="Starts"><Input type="date" value={t.start} onChange={(e) => edit(i, "start", e.target.value)} /></Field>
            <Field label="Ends"><Input type="date" value={t.end} onChange={(e) => edit(i, "end", e.target.value)} /></Field>
            <Button type="button" variant="ghost" aria-label={`Remove ${t.name}`} onClick={() => setList(list.filter((_, n) => n !== i))}><Trash2 size={16} /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" onClick={() => setList([...list, { name: `Term ${list.length + 1}`, start: "", end: "" }])}><Plus size={16} />Add term</Button>
      </div>
      {err.length > 0 && <ul className="mt-4 space-y-1 text-sm text-error" role="alert">{err.map((m) => <li key={m}>{m}</li>)}</ul>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 3 · Classes & sections ---------------- */
const GRADES = SETUP_GRADES;
function Step3({ initial, busy, onSubmit, back }: StepProps) {
  const secs = useCollection<any>("set_sections");
  const classes = useCollection<any>("classes");
  const students = useCollection<any>("students");
  const [cfg, setCfg] = useState<GradeCfg[]>(initial?.cfg ?? GRADES.map((g) => ({ grade: g, sections: 0, cap: 30 })).map((c) => (["1", "2", "3", "4", "5"].includes(c.grade) ? { ...c, sections: 3 } : c)));
  const [err, setErr] = useState("");
  const loading = ![secs, classes, students].every((collection) => collection.ready);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || loading) return;
    const why = sectionsError(cfg);
    if (why) return setErr(why);
    setErr("");
    await onSubmit({ cfg }, async () => {
      const batch = writeBatch(db);
      const sectionRows = sectionRowsFor(cfg).map((row) => ({ id: `sec_${row.grade.replace(/\W+/g, "").toLowerCase()}${"streamId" in row && row.streamId ? `_${row.streamId}` : ""}`, ...row }));
      const sectionIds = new Set(sectionRows.map((row) => row.id));
      for (const row of secs.rows) if (!sectionIds.has(row.id) && !isCourseId(row.streamId ?? "")) batch.delete(schoolDoc("set_sections", row.id));
      for (const row of sectionRows) batch.set(schoolDoc("set_sections", row.id), { ...row, ...createStamp() }, { merge: true });
      const want = classesFor(cfg);
      for (const row of want) {
        batch.set(schoolDoc("classes", row.id), { ...(!classes.rows.some((item) => item.id === row.id) ? { classTeacherId: "", room: "", wing: "" } : {}), ...row, ...createStamp() }, { merge: true });
      }
      const keep = new Set(want.map((row) => row.id));
      for (const row of classes.rows) if (!keep.has(row.id) && !isCourseId(streamFromClassId(row.id)) &&
        !students.rows.some((student) => (student.classId ?? classIdOf(student.grade, student.section, student.streamId)) === row.id)) batch.delete(schoolDoc("classes", row.id));
      await batch.commit();
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <ClassSetupEditor value={cfg} onChange={(next) => { setCfg(next); setErr(""); }} disabled={busy || loading} />
      {err && <p className="mt-2 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} disabled={loading} back={back} />
    </form>
  );
}

/* ---------------- 4 · Bell schedule ---------------- */
function Step4({ initial, busy, onSubmit, back }: StepProps) {
  const cfgC = useCollection<any>("set_config");
  const [v, setV] = useState<Bell>(() => initialBell(initial));
  const [err, setErr] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const why = bellError(v);
    if (why) return setErr(why);
    setErr("");
    await onSubmit(normalizedBell(v), () => upsert(cfgC, "bell", bellRecord(v)));
  };
  return (
    <form onSubmit={submit} noValidate>
      <BellScheduleEditor value={v} onChange={(value) => { setV(value); setErr(""); }} disabled={busy} />
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 5 · Fee structure ---------------- */
function Step5(props: StepProps) {
  const fs = useCollection<any>("fee_structure");
  const cfg = useCollection<any>("set_config");
  const school = useCollection<any>("school");
  const terms = useCollection<any>("set_terms");
  const classes = useCollection<any>("classes");
  if (![fs, cfg, school, terms, classes].every((collection) => collection.ready)) return <p role="status">Loading fee configuration…</p>;
  const grades = classes.rows.length ? feeScopesForClasses(classes.rows) : SETUP_GRADES.filter((grade) => !isSeniorGrade(grade));
  return <FeeSetupForm {...props} fs={fs} defaults={{ grades, academicYear: school.rows.find((row) => row.id === "school")?.academicYear ?? ayLabel(AY_START), termsPerYear: Math.max(1, terms.rows.length || 2) }} policy={cfg.rows.find((row) => row.id === "fee_policy")} />;
}

function FeeSetupForm({ initial, busy, onSubmit, back, fs, defaults, policy }: StepProps & { fs: Coll; defaults: { grades: string[]; academicYear: string; termsPerYear: number }; policy?: Partial<FeePlan> }) {
  const [value, setValue] = useState<FeePlan>(() => initialFeePlan(initial ?? policy, fs.rows, defaults));
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const why = feePlanError(value);
    if (why) return setError(why);
    setError("");
    const plan = normalizedFeePlan(value);
    await onSubmit(plan, async () => {
      // The grade plans and payment preferences succeed or fail together.
      const batch = writeBatch(db);
      for (const key of plan.grades) {
        const { grade, streamId } = parseFeeScope(key);
        const row = fs.rows.find((item) => item.grade === grade && classStream(item) === streamId);
        batch.set(schoolDoc("fee_structure", row?.id ?? `fs_${key.replace(":", "_")}`), {
          ...(!row ? { tuition: 0, lab: 0, activity: 0, library: 0, transport: 0 } : {}),
          ...gradeFeeRecord(plan, key), ...createStamp(),
        }, { merge: true });
      }
      for (const row of fs.rows) if (isSeniorGrade(row.grade) && !classStream(row) && plan.grades.some((key) => parseFeeScope(key).grade === row.grade && parseFeeScope(key).streamId)) batch.delete(schoolDoc("fee_structure", row.id));
      batch.set(schoolDoc("set_config", "fee_policy"), { schemaVersion: 2, academicYear: plan.academicYear, termsPerYear: plan.termsPerYear, late: plan.late, upi: plan.upi, card: plan.card, ...createStamp() }, { merge: true });
      await batch.commit();
    });
  };
  return <form onSubmit={submit} noValidate>
    <FeePlanEditor value={value} onChange={(next) => { setValue(next); setError(""); }} disabled={busy} />
    {error && <p role="alert" className="mt-4 rounded-lg border border-error/20 bg-error-container/30 p-3 text-sm text-error">{error}</p>}
    <StepFooter busy={busy} back={back} />
  </form>;
}

/* ---------------- 6 · Staff allocations ---------------- */
const ROLES = ["PGT", "TGT", "PRT", "HOD", "Coordinator", "Lab Assistant", "Clerk"];
function Step6({ initial, busy, onSubmit, back }: StepProps) {
  const staff = useCollection<any>("staff");
  const secs = useCollection<any>("set_sections");
  const classes = useCollection<any>("classes");
  const options = useMemo<string[]>(() => (secs.rows.length ? secs.rows.flatMap((r: any) => r.sections as string[]) : ((initial?.sectionsFromStep3 as string[]) ?? [])), [secs.rows, initial]);
  const [draftAssignments, setDraftAssignments] = useState<Record<string, string> | null>(null);
  const assign: Record<string, string> = draftAssignments ?? Object.fromEntries(options.flatMap((label) => {
    const teacherId = classes.rows.find((row) => row.id === classIdOfLabel(label))?.classTeacherId;
    return typeof teacherId === "string" && teacherId ? [[teacherId, label]] : [];
  }));
  const [role, setRole] = useState<Record<string, string>>({});
  const [err, setErr] = useState("");
  const eligible = (row: { staffRole?: string }) => !row.staffRole || ["hod", "teacher"].includes(row.staffRole);
  const taken = (sec: string, except: string) => Object.entries(assign).some(([id, s]) => id !== except && s === sec);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const why = draftAssignments ? allocationError(draftAssignments) : "";
    if (why) return setErr(why);
    setErr("");
    await onSubmit({ assign, assigned: Object.keys(assign).length, sectionsFromStep3: options }, async () => {
      for (const r of staff.rows) if (role[r.id] && role[r.id] !== r.role) await staff.update(r.id, { role: role[r.id] } as never);
      if (!draftAssignments) return;
      // contract section 3 / 13.1: the class teacher lives on the class doc (classTeacherId + display name)
      const want = new Map(Object.entries(assign).map(([sid, label]) => [classIdOfLabel(label), sid]));
      for (const [cid, sid] of want) {
        const name = staff.rows.find((r: any) => r.id === sid)?.name ?? "";
        const parts = (options.find((label) => classIdOfLabel(label) === cid) ?? "").split("-");
        const [g, sec] = [parts[0] ?? "", parts.at(-1) ?? ""];
        const streamId = parts.length > 2 ? streamIdOf(parts[1]) : "";
        if (classes.rows.some((c: any) => c.id === cid)) await classes.update(cid, { classTeacherId: sid, classTeacher: name } as never);
        else await classes.create({ id: cid, grade: g, section: sec, ...(streamId ? { streamId, stream: streamName(streamId) } : {}), classTeacherId: sid, classTeacher: name, room: "", wing: "" } as never);
      }
      for (const c of classes.rows) if (c.classTeacherId && !want.has(c.id) && options.some((o) => classIdOfLabel(o) === c.id)) await classes.update(c.id, { classTeacherId: "", classTeacher: "" } as never);
    });
  };
  if (!staff.ready || !secs.ready || !classes.ready) return <p role="status" className="text-on-surface-variant">Loading staff allocations…</p>;

  return (
    <form onSubmit={submit} noValidate>
      <div className="max-h-[420px] overflow-auto rounded-lg border border-outline-variant/60">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-container-low"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Department</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Class teacher of</th></tr></thead>
          <tbody>{staff.rows.map((r: any) => (
            <tr key={r.id} className="border-t border-outline-variant/40">
              <td className="px-4 py-2">{r.name}</td><td className="px-4 py-2 text-on-surface-variant">{r.department}</td>
              <td className="px-4 py-2"><Select disabled={!!r.staffRole} aria-label={`Role for ${r.name}`} value={role[r.id] ?? r.role} onChange={(e) => setRole({ ...role, [r.id]: e.target.value })} className="w-36">{[...new Set([r.role, ...ROLES].filter(Boolean))].map((x) => <option key={x}>{x}</option>)}</Select></td>
              <td className="px-4 py-2"><Select disabled={!eligible(r)} aria-label={`Class for ${r.name}`} value={assign[r.id] ?? ""} onChange={(e) => {
                const section = e.target.value;
                if (section && taken(section, r.id)) return setErr(`${section} already has a class teacher.`);
                setErr("");
                const next = { ...assign };
                if (section) next[r.id] = section;
                else delete next[r.id];
                setDraftAssignments(next);
              }} className="w-36">
                <option value="">— none —</option>{options.map((o) => <option key={o} value={o} disabled={taken(o, r.id)}>{o}</option>)}</Select></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-on-surface-variant">{Object.keys(assign).length} of {options.length} sections have a class teacher.</p>
      <div className="mt-5 rounded-lg border border-dashed border-outline-variant p-4">
        <AddStaffFields rows={staff.rows} disabled={busy} buttonLabel="Add" />
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} last />
    </form>
  );
}

export const STEP_FORMS = { 1: Step1, 2: Step2, 3: Step3, 4: Step4, 5: Step5, 6: Step6 };
