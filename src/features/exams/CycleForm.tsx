"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Check, FileText, Plus, Trash2, Upload, X } from "lucide-react";
import { Badge, Button, Card, Field, Input, PageHeader, Select, Switch, Textarea, useToast } from "@/components/ui";
import { cn } from "@/lib/cn";
import { useCollection } from "@/lib/useCollection";
import { parseCsv } from "@/features/fees/csv";
import type { Cycle, Paper } from "./types";

type Slot = { key: string; id?: string; subject: string; code: string; grade: string; date: string; start: string; duration: number; venue: string; invigilator: string; invigilatorId?: string };
const PARTS = ["Periodic", "Portfolio", "Enrichment", "Multiple"];
const ALL_GRADES = ["8", "9", "10", "11", "12"];
const blank = {
  title: "", term: "Term 2 (Spring) · AY 2026-27", category: "CBSE Board", start: "", end: "", declaration: "", instructions: "", circular: "",
  grades: ["8", "9", "10"], sections: "all" as "all" | "custom", enforceAttendance: true, theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5],
  scale: "CBSE 9-Point Scale (A1 to E2)", passRule: "Min 33% independently in Theory & Practical (Bylaws §14.2)", grace: "Up to 5 Marks (Council Approval Req.)",
  qr: true, sealed: true, biometric: true,
};
let n = 0;
const nk = () => `s${Date.now()}_${n++}`;

function Step({ n, title, badge, desc, right, children }: { n: number; title: string; badge?: React.ReactNode; desc: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card className="mb-5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-outline-variant/50 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary font-bold text-on-secondary">{n}</span>
          <div><h2 className="flex flex-wrap items-center gap-2 t-headline-md !text-[17px]">Step {n} · {title} {badge}</h2><p className="mt-0.5 text-on-surface-variant">{desc}</p></div>
        </div>{right}
      </div>
      <div className="p-5">{children}</div>
    </Card>
  );
}

function CycleFormInner({ cycleId, initF, initSlots, initStatus }: { cycleId?: string; initF: typeof blank; initSlots: Slot[]; initStatus?: Cycle["status"] }) {
  const router = useRouter();
  const toast = useToast();
  const cycles = useCollection<Cycle>("exm_cycles");
  const papers = useCollection<Paper>("exm_papers");
  const staff = useCollection<{ id: string; name: string; department: string; status: string }>("staff").rows.filter((s) => s.department !== "Administration");
  const [f, setF] = useState(initF);
  const [slots, setSlots] = useState<Slot[]>(initSlots);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const createdId = useRef<string | undefined>(undefined); // a retry after a failed paper write must not create a second cycle
  const students = useCollection<{ id: string; grade: string; section: string; status?: string }>("students").rows;
  const school = useCollection<{ id: string; affiliation?: string; board?: string }>("school").rows[0];
  const dirty = JSON.stringify(f) !== JSON.stringify(initF) || JSON.stringify(slots) !== JSON.stringify(initSlots);
  // real roster figures (were hard-coded demo numbers)
  const enrolled = (g: string) => students.filter((s) => s.grade === g && (s.status ?? "Active") === "Active");
  const sectionsOf = (g: string) => [...new Set(enrolled(g).map((s) => s.section))].sort();
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((x) => ({ ...x, [k]: v }));

  const candidates = f.grades.reduce((a, g) => a + enrolled(g).length, 0);
  const sectionCount = f.grades.reduce((a, g) => a + sectionsOf(g).length, 0);
  const weightOk = f.theoryMax + f.internalMax === 100;
  const partsSum = f.internalParts.reduce((a, b) => a + b, 0);
  const who = (s: Slot) => s.invigilatorId || s.invigilator.trim();
  const clashes = slots.filter((s, i) => slots.some((o, j) => j !== i && o.date && o.date === s.date && o.start === s.start
    && (o.grade === s.grade || (o.venue && o.venue === s.venue) || (who(o) && who(o) === who(s))))).length;
  const days = f.start && f.end ? Math.max(0, Math.round((+new Date(f.end) - +new Date(f.start)) / 864e5) + 1) : 0;
  const postDays = f.end && f.declaration ? Math.round((+new Date(f.declaration) - +new Date(f.end)) / 864e5) : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = "Title is required";
    if (!f.term) e.term = "Required";
    if (!f.start) e.start = "Required";
    if (!f.end) e.end = "Required";
    else if (f.start && f.end < f.start) e.end = "End must be after start";
    if (!f.declaration) e.declaration = "Required";
    else if (f.end && f.declaration < f.end) e.declaration = "Must be on/after end date";
    if (!f.grades.length) e.grades = "Select at least one grade";
    if (f.theoryMax < 0 || f.internalMax < 0) e.weight = "Marks cannot be negative";
    else if (!weightOk) e.weight = "Theory + Internal must total 100";
    if (partsSum !== f.internalMax) e.parts = `Internal components total ${partsSum}, expected ${f.internalMax}`;
    if (!slots.length) e.slots = "Add at least one subject paper slot";
    slots.forEach((s) => {
      if (!s.subject.trim() || !s.code.trim() || !s.date || !s.start || !s.venue.trim() || !s.invigilator.trim()) e.slots = "Complete all paper slot fields";
      else if (!(s.duration > 0) || s.duration > 6) e.slots = "Paper duration must be between 0.5 and 6 hours";
      else if (f.start && f.end && (s.date < f.start || s.date > f.end)) e.slots = "Paper dates must fall within the cycle window";
      if (!f.grades.includes(s.grade)) e.slots = "A paper slot targets a grade that is not selected";
    });
    if (clashes) e.slots = "Resolve schedule clashes before saving";
    setErrors(e);
    if (Object.keys(e).length) { toast(Object.values(e)[0], "error"); return false; }
    return true;
  };

  const save = async (status: Cycle["status"]) => {
    if (status !== "Draft" && !validate()) return;
    if (status === "Draft" && !f.title.trim()) { setErrors({ title: "Title is required" }); return toast("Give the cycle a title first", "error"); }
    setSaving(true);
    try {
      const body = { ...f, short: f.title.replace(/ Examinations?| 20\d\d-\d\d$/g, "").trim() || f.title, status } as Omit<Cycle, "id">;
      let id = cycleId ?? createdId.current;
      // editing keeps a Live/Completed cycle's status; only a Draft moves to Scheduled
      const was = cycleId ? cycles.rows.find((c) => c.id === cycleId)?.status ?? initStatus : undefined;
      const next = status === "Draft" ? "Draft" : was === "Live" || was === "Completed" ? was : status;
      if (id) await cycles.update(id, { ...body, status: next });
      else { id = (await cycles.create(body)).id; createdId.current = id; }
      const existing = papers.rows.filter((p) => p.cycleId === id);
      for (const p of existing) if (!slots.some((s) => s.id === p.id)) await papers.remove(p.id);
      for (const s of slots) {
        const data = { cycleId: id!, grade: s.grade, subject: s.subject, code: s.code, date: s.date, start: s.start, duration: s.duration, theory: f.theoryMax, internal: f.internalMax, internalType: "Internal", venue: s.venue, invigilator: s.invigilator, invigilatorId: s.invigilatorId ?? staff.find((t) => t.name === s.invigilator)?.id ?? "" };
        if (s.id) await papers.update(s.id, data);
        else { const row = await papers.create({ ...data, status: "Scheduled", marksEntered: false, published: [] } as Omit<Paper, "id">); upd(s.key, { id: row.id }); }
      }
      toast(status === "Draft" ? "Draft saved" : cycleId ? "Exam cycle updated" : "Exam cycle scheduled & published");
      router.push("/exams");
    } catch { toast("Could not save exam cycle", "error"); setSaving(false); }
  };

  const upd = (key: string, patch: Partial<Slot>) => setSlots((x) => x.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const addSlot = () => setSlots((x) => [...x, { key: nk(), subject: "", code: "", grade: f.grades[0] ?? "8", date: "", start: "09:00", duration: 2.5, venue: "", invigilator: "" }]);
  const importCsv = async (file?: File) => {
    if (!file) return;
    const rows = parseCsv(await file.text()).filter((r) => r.length >= 4 && r[0].toLowerCase() !== "subject");
    if (!rows.length) return toast("CSV needs: subject,code,grade,date,start,duration,venue,invigilator", "error");
    setSlots((x) => [...x, ...rows.map((r) => ({ key: nk(), subject: r[0], code: r[1], grade: r[2] || "8", date: r[3], start: r[4] || "09:00", duration: Number(r[5]) || 2.5, venue: r[6] ?? "", invigilator: r[7] ?? "" }))]);
    toast(`Imported ${rows.length} paper slots`);
    if (csvRef.current) csvRef.current.value = "";
  };

  return (
    <div className="pb-28">
      <PageHeader title={cycleId ? "Edit Examination Cycle" : "Create New Examination Cycle"} subtitle="Unified configuration workspace: define term parameters, candidate cohorts, assessment scheme, and schedule paper slots."
        actions={school?.affiliation ? <Badge tone="success">{school.board ? `${school.board} ` : ""}Affiliation {school.affiliation}</Badge> : undefined} />

      <Step n={1} title="Basic Details & Academic Term" badge={<Badge tone="info">REQUIRED</Badge>} desc="Define examination cycle parameters, term session, statutory category, and official schedule dates."
        right={f.title && f.start && f.end && f.declaration ? <Badge tone="success"><Check size={12} />Configured</Badge> : <Badge>Incomplete</Badge>}>
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Exam Cycle Title" required error={errors.title}><Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Term 2 Pre-Board Examinations 2026-27" /></Field>
          <Field label="Academic Term & Year" required error={errors.term}>
            <Select value={f.term} onChange={(e) => set("term", e.target.value)}>
              {["Term 1 (Autumn) · AY 2026-27", "Term 2 (Spring) · AY 2026-27"].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div><span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Examination Category</span>
            <div className="flex gap-2" role="radiogroup" aria-label="Examination category">
              {["CBSE Board", "Internal", "Diagnostic"].map((c) => (
                <button key={c} type="button" role="radio" aria-checked={f.category === c} onClick={() => set("category", c)}
                  className={cn("h-10 cursor-pointer rounded border px-3 text-xs font-semibold", f.category === c ? "border-secondary bg-info-container text-secondary" : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low")}>{c}</button>))}
            </div></div>
          <Field label="Start Date" required error={errors.start} hint={days ? `${days} day window` : undefined}><Input type="date" value={f.start} onChange={(e) => set("start", e.target.value)} /></Field>
          <Field label="End Date" required error={errors.end}><Input type="date" value={f.end} onChange={(e) => set("end", e.target.value)} /></Field>
          <Field label="Target Declaration" required error={errors.declaration} hint={postDays > 0 ? `${postDays} days post final exam` : undefined}><Input type="date" value={f.declaration} onChange={(e) => set("declaration", e.target.value)} /></Field>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Instructions & Conduct Guidelines"><Textarea value={f.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="Reporting time, admit card, conduct rules…" /></Field>
          <div><span className="mb-1.5 block text-xs font-semibold text-on-surface-variant">Official Circular Document</span>
            {f.circular ? (
              <div className="flex items-center gap-3 rounded border border-dashed border-outline-variant p-3"><FileText size={18} className="text-secondary" />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{f.circular}</p><p className="text-xs text-outline">Attached</p></div>
                <button aria-label="Remove circular" className="cursor-pointer text-outline hover:text-error" onClick={() => set("circular", "")}><X size={16} /></button></div>
            ) : <Button variant="outline" className="w-full border-dashed" onClick={() => fileRef.current?.click()}><Upload size={16} />Attach PDF circular</Button>}
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" aria-label="Circular PDF" onChange={(e) => e.target.files?.[0] && set("circular", e.target.files[0].name)} />
          </div>
        </div>
      </Step>

      <Step n={2} title="Grade, Section & Candidate Scope" badge={<Badge tone="success">{f.grades.length} GRADES ACTIVE</Badge>} desc="Select eligible academic cohorts, configure section rules, and enforce statutory attendance filters."
        right={<span className="text-on-surface-variant">Candidate Verification: <b className="text-on-surface">{candidates} Enrolled</b></span>}>
        <span className="mb-2 block text-xs font-semibold text-on-surface-variant">Eligible Grades Cohort</span>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5" role="group" aria-label="Eligible grades">
          {ALL_GRADES.map((g) => { const on = f.grades.includes(g); return (
            <button key={g} type="button" aria-pressed={on} onClick={() => set("grades", on ? f.grades.filter((x) => x !== g) : [...f.grades, g])}
              className={cn("cursor-pointer rounded-lg border p-3 text-left", on ? "border-secondary bg-info-container/50" : "border-outline-variant text-on-surface-variant")}>
              <div className="flex items-center justify-between font-semibold"><span>Grade {g}</span>{on ? <Check size={16} className="text-secondary" /> : <span className="size-4 rounded-full border border-outline-variant" />}</div>
              <div className="mt-1 text-xs">{enrolled(g).length} Students</div><div className="text-xs text-outline">{sectionsOf(g).length ? `Sec ${sectionsOf(g).join(", ")}` : "No sections"}</div>
            </button>); })}
        </div>
        {errors.grades && <p className="mt-1 text-xs text-error">{errors.grades}</p>}
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="mb-2 flex items-center justify-between font-semibold">Sections Inclusion<Badge tone="success">{f.sections === "all" ? "All Sections Active" : "Custom"}</Badge></div>
            <div className="flex gap-2">
              <Button size="sm" variant={f.sections === "all" ? "primary" : "outline"} onClick={() => set("sections", "all")}>All Sections</Button>
              <Button size="sm" variant={f.sections === "custom" ? "primary" : "outline"} onClick={() => set("sections", "custom")}>Customize Sections</Button>
            </div>
            <p className="mt-2 text-on-surface-variant">{f.sections === "all" ? `All ${sectionCount} section${sectionCount === 1 ? "" : "s"} mapped automatically based on current AY registration roster.` : "Section-level selection will be confirmed on the candidate roster."}</p>
          </div>
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="flex items-center justify-between font-semibold">Enforce CBSE ≥75% Attendance<Switch checked={f.enforceAttendance} onChange={(v) => set("enforceAttendance", v)} label="Enforce attendance" /></div>
            <p className="mt-2 text-on-surface-variant">Automatically flags candidates below 75% for Principal dispensation review & medical exemption override.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-info-container/60 p-4">
          <div><p className="font-semibold">{candidates} Candidates Eligible · {Math.ceil(candidates / 35)} Examination Halls Required</p><p className="text-secondary text-xs">Active students in the selected grades, at 35 per hall</p></div>
          <Button variant="outline" size="sm" onClick={() => window.open("/students", "_blank", "noopener")}>View Candidate Roster</Button>
        </div>
      </Step>

      <Step n={3} title="Assessment Structure, Weightage & Grading Scheme" badge={<Badge tone="info">CBSE 9-POINT SCALE</Badge>} desc="Configure component distribution, pass qualification benchmark, and moderation policies."
        right={weightOk && !errors.parts ? <Badge tone="success"><Check size={12} />{f.theoryMax} / {f.internalMax} Weightage Valid</Badge> : <Badge tone="danger">Weightage must total 100</Badge>}>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="flex items-center justify-between gap-2 font-semibold">Component 1: Theory Paper
              <span className="flex items-center gap-1"><Input aria-label="Theory max marks" type="number" min={0} max={100} className="!h-8 !w-16 text-center" value={f.theoryMax} onChange={(e) => set("theoryMax", Number(e.target.value))} /><span className="text-xs text-on-surface-variant">Marks ({f.theoryMax}%)</span></span></div>
            <div className="mt-3 h-2 rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, f.theoryMax)}%` }} /></div>
            <p className="mt-3 text-on-surface-variant">Formal pen-and-paper centralized evaluation administered under strictly invigilated board protocols.</p>
          </div>
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="flex items-center justify-between gap-2 font-semibold">Component 2: Internal / Practical
              <span className="flex items-center gap-1"><Input aria-label="Internal max marks" type="number" min={0} max={100} className="!h-8 !w-16 text-center" value={f.internalMax} onChange={(e) => set("internalMax", Number(e.target.value))} /><span className="text-xs text-on-surface-variant">Marks ({f.internalMax}%)</span></span></div>
            <div className="mt-3 h-2 rounded-full bg-surface-container-high"><div className="h-full rounded-full bg-outline" style={{ width: `${Math.min(100, f.internalMax)}%` }} /></div>
            <div className="mt-3 grid grid-cols-4 gap-2">{PARTS.map((p, i) => (
              <label key={p} className="rounded border border-outline-variant/60 p-2 text-center text-xs text-outline">{p}
                <input aria-label={`${p} marks`} type="number" min={0} className="mt-1 block w-full rounded border-0 bg-transparent text-center text-sm font-semibold text-on-surface focus:outline-2 focus:outline-secondary/30" value={f.internalParts[i]} onChange={(e) => set("internalParts", f.internalParts.map((v, j) => (j === i ? Number(e.target.value) : v)))} /></label>))}
            </div>
            {errors.parts && <p className="mt-1 text-xs text-error">{errors.parts}</p>}
          </div>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Field label="Grading Scale & Benchmark" hint="Standardized CBSE Secondary Norms"><Select value={f.scale} onChange={(e) => set("scale", e.target.value)}><option>CBSE 9-Point Scale (A1 to E2)</option><option>Percentage only</option><option>5-Point Letter Scale</option></Select></Field>
          <Field label="Pass Benchmark Rule"><Select value={f.passRule} onChange={(e) => set("passRule", e.target.value)}><option>Min 33% independently in Theory & Practical (Bylaws §14.2)</option><option>Min 33% aggregate</option></Select></Field>
          <Field label="Grace Marks & Moderation" hint="Subject to Principal Committee sign-off"><Select value={f.grace} onChange={(e) => set("grace", e.target.value)}><option>Up to 5 Marks (Council Approval Req.)</option><option>No grace marks</option><option>Up to 2 Marks per subject</option></Select></Field>
        </div>
        {errors.weight && <p className="mt-2 text-xs text-error">{errors.weight}</p>}
      </Step>

      <Step n={4} title="Timetable, Paper Schedule & Hall Allocations" badge={<Badge tone="success">{slots.length} PAPERS SCHEDULED</Badge>} desc="Manage dates, session timings, venue allocations, chief invigilators, and clash verifications.">
        <div className="mb-4 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => csvRef.current?.click()}><Upload size={14} />Import Schedule CSV</Button>
          <input ref={csvRef} type="file" accept=".csv" className="hidden" aria-label="Import schedule CSV" onChange={(e) => importCsv(e.target.files?.[0])} />
          <Button variant="outline" size="sm" className="text-secondary" onClick={addSlot}><Plus size={14} />Add Subject Paper Slot</Button>
        </div>
        {slots.length === 0 && <p className="rounded-lg border border-dashed border-outline-variant p-6 text-center text-on-surface-variant">No paper slots yet. Add one to build the timetable.</p>}
        <div className="space-y-3">
          {slots.map((s, i) => (
            <div key={s.key} className="grid items-end gap-2 rounded-lg border border-outline-variant/60 p-3 md:grid-cols-12">
              <Field label="Subject" className="md:col-span-3"><Input value={s.subject} onChange={(e) => upd(s.key, { subject: e.target.value })} placeholder="Mathematics" /></Field>
              <Field label="Code" className="md:col-span-2"><Input value={s.code} onChange={(e) => upd(s.key, { code: e.target.value.toUpperCase() })} placeholder="MATH-041" /></Field>
              <Field label="Grade" className="md:col-span-1"><Select value={s.grade} onChange={(e) => upd(s.key, { grade: e.target.value })}>{ALL_GRADES.map((g) => <option key={g}>{g}</option>)}</Select></Field>
              <Field label="Date" className="md:col-span-2"><Input type="date" value={s.date} onChange={(e) => upd(s.key, { date: e.target.value })} /></Field>
              <Field label="Start" className="md:col-span-1"><Input type="time" value={s.start} onChange={(e) => upd(s.key, { start: e.target.value })} /></Field>
              <Field label="Hours" className="md:col-span-1"><Input type="number" step="0.5" min="0.5" value={s.duration} onChange={(e) => upd(s.key, { duration: Number(e.target.value) })} /></Field>
              <div className="flex justify-end md:col-span-2"><Button variant="ghost" size="sm" aria-label={`Remove paper ${i + 1}`} onClick={() => setSlots((x) => x.filter((y) => y.key !== s.key))}><Trash2 size={16} className="text-error" /></Button></div>
              <Field label="Venue / Room" className="md:col-span-6"><Input value={s.venue} onChange={(e) => upd(s.key, { venue: e.target.value })} placeholder="Exam Hall 1 & 2" /></Field>
              <Field label="Chief Invigilator" className="md:col-span-6">
                <Select value={s.invigilatorId || staff.find((t) => t.name === s.invigilator)?.id || ""} onChange={(e) => upd(s.key, { invigilatorId: e.target.value, invigilator: staff.find((t) => t.id === e.target.value)?.name ?? "" })}>
                  <option value="">{s.invigilator && !staff.some((t) => t.name === s.invigilator) ? `${s.invigilator} (not on staff list)` : "Select a teacher"}</option>
                  {staff.map((t) => <option key={t.id} value={t.id}>{t.name} · {t.department}</option>)}
                </Select>
              </Field>
            </div>))}
        </div>
        {errors.slots && <p className="mt-2 text-xs text-error">{errors.slots}</p>}
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {([["qr", "Auto-Generate QR Admit Cards", "Issued via Student & Parent Portal"], ["sealed", "Sealed Paper Delivery Protocol", "Dual key sign-off at 08:15 AM"], ["biometric", "Biometric Gate Verification", "Facial/RFID check at main foyer"]] as const).map(([k, t, d]) => (
            <div key={k} className="flex items-center justify-between gap-3 rounded-lg border border-outline-variant/60 p-4"><div><p className="font-semibold">{t}</p><p className="text-xs text-outline">{d}</p></div><Switch checked={f[k]} onChange={(v) => set(k, v)} label={t} /></div>))}
        </div>
        <div className={cn("mt-4 flex items-center justify-between rounded-lg border px-4 py-3 text-sm", clashes ? "border-error/40 bg-error-container/40 text-error" : "border-success/30 bg-success-container/60 text-success")}>
          <span>{clashes ? `${clashes} slot(s) have a cohort, room or invigilator clash. Adjust date, time, venue or invigilator.` : `Conflict Check Complete: no cohort, room or invigilator clashes across ${slots.length} subject slot${slots.length === 1 ? "" : "s"}.`}</span>
          <b>{slots.length - clashes} of {slots.length} Ready</b>
        </div>
      </Step>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-outline-variant bg-surface-container-lowest/95 px-6 py-3 backdrop-blur lg:left-72">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-on-surface-variant"><b className="text-on-surface">{f.title || "Untitled cycle"}</b> · {f.grades.length} Grades ({[...f.grades].sort((a, b) => +a - +b).join(", ")}) · <b className="text-on-surface">{candidates}</b> Candidates · <b className="text-on-surface">{slots.length}</b> Subject Papers · {clashes} Clashes</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { if (!dirty || window.confirm("Discard your unsaved changes?")) router.push("/exams"); }}>Discard Changes</Button>
            {(!cycleId || initStatus === "Draft") && <Button variant="outline" disabled={saving} onClick={() => save("Draft")}>Save as Draft</Button>}
            <Button disabled={saving} onClick={() => save("Scheduled")}>{cycleId && initStatus !== "Draft" ? "Save Changes" : "Schedule & Publish Exam Cycle"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CycleForm({ cycleId }: { cycleId?: string }) {
  const cycles = useCollection<Cycle>("exm_cycles");
  const papers = useCollection<Paper>("exm_papers");
  if (!cycleId) return <CycleFormInner initF={blank} initSlots={[]} />;
  if (!cycles.ready || !papers.ready) return <p className="text-on-surface-variant">Loading…</p>;
  const c = cycles.rows.find((x) => x.id === cycleId);
  if (!c) return <p className="text-on-surface-variant">Exam cycle not found. <Link className="text-secondary underline" href="/exams">Back to exams</Link></p>;
  const slots = papers.rows.filter((p) => p.cycleId === cycleId).map((p) => ({ key: p.id, id: p.id, subject: p.subject, code: p.code, grade: p.grade, date: p.date, start: p.start, duration: p.duration, venue: p.venue, invigilator: p.invigilator, invigilatorId: p.invigilatorId }));
  return <CycleFormInner key={cycleId} cycleId={cycleId} initF={{ ...blank, ...c }} initSlots={slots} initStatus={c.status} />;
}
