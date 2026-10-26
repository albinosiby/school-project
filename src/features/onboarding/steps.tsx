"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, Upload } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, Switch, Textarea, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { nowLocal } from "@/features/dashboard/data";
import { Grid, StepFooter, type StepProps } from "./FormBits";

const num = (v: unknown) => Number(v) || 0;
const toMin = (t: string) => { const [h, m] = t.split(":").map(Number); return (h ?? 0) * 60 + (m ?? 0); };
const fmt = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hasErrors = (e: Record<string, string>) => Object.keys(e).length > 0;
const errText = (e: unknown) => (e instanceof Error && e.message ? e.message.replace(/^Firebase:\s*/, "") : "please try again");
/** current academic year (Apr–Mar), e.g. "2026-27" */
const AY_START = (() => { const d = new Date(); return d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; })();
const ayLabel = (y: number) => `${y}-${String(y + 1).slice(2)}`;

/* ---------------- 1 · School profile ---------------- */
function Step1({ initial, busy, onSubmit }: StepProps) {
  const { rows: school, update: updSchool } = useCollection<any>("school");
  const { update: updCfg } = useCollection<any>("set_config");
  const s = school[0];
  const [v, setV] = useState({
    name: initial?.name ?? school[0]?.name ?? "", short: initial?.short ?? school[0]?.short ?? "", board: initial?.board ?? "CBSE", affiliation: initial?.affiliation ?? "",
    address: initial?.address ?? "", city: initial?.city ?? "", phone: initial?.phone ?? "", email: initial?.email ?? "", principal: initial?.principal ?? "",
  });
  const [err, setErr] = useState<Record<string, string>>({});
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setV({ ...v, [k]: e.target.value });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: Record<string, string> = {};
    if (!v.name.trim()) x.name = "School name is required.";
    if (!/^\d{5,7}$/.test(v.affiliation.replace(/^#/, ""))) x.affiliation = "Enter the 5–7 digit affiliation number.";
    if (!v.city.trim()) x.city = "City is required.";
    if (v.phone.replace(/\D/g, "").length < 10) x.phone = "Enter a phone number with at least 10 digits.";
    if (!/^\S+@\S+\.\S+$/.test(v.email)) x.email = "Enter a valid email address.";
    setErr(x);
    if (hasErrors(x)) return;
    const aff = v.affiliation.replace(/^#/, "");
    await onSubmit(v, async () => {
      if (s) await updSchool(s.id, { name: v.name.trim(), short: v.short.trim() || v.name.trim(), board: v.board, affiliation: `#${aff}`, city: v.city.trim() });
      await updCfg("profile", { name: v.name.trim(), affiliation: aff, email: v.email.trim(), phone: v.phone.trim(), address: v.address.trim() });
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
          <Field label="Principal"><Input value={v.principal} onChange={set("principal")} /></Field>
        </Grid>
        <Field label="Address"><Textarea value={v.address} onChange={set("address")} /></Field>
        <Grid>
          <Field label="City" required error={err.city}><Input value={v.city} onChange={set("city")} /></Field>
          <Field label="Phone" required error={err.phone}><Input value={v.phone} onChange={set("phone")} inputMode="tel" /></Field>
          <Field label="Official email" required error={err.email} className="sm:col-span-2"><Input type="email" value={v.email} onChange={set("email")} /></Field>
        </Grid>
      </div>
      <StepFooter busy={busy} />
    </form>
  );
}

/* ---------------- 2 · Academic year & terms ---------------- */
type Term = { name: string; start: string; end: string };
function Step2({ initial, busy, onSubmit, back }: StepProps) {
  const terms = useCollection<any>("set_terms");
  const { update: updCfg } = useCollection<any>("set_config");
  const school = useCollection<any>("school");
  const [year, setYear] = useState<string>(initial?.year ?? ayLabel(AY_START));
  const [list, setList] = useState<Term[]>(initial?.terms ?? [{ name: "Term 1", start: `${AY_START}-04-01`, end: `${AY_START}-09-30` }, { name: "Term 2", start: `${AY_START}-10-01`, end: `${AY_START + 1}-03-31` }]);
  const [err, setErr] = useState<string[]>([]);
  const [days, setDays] = useState<number>(initial?.workingDays ?? 220);
  const edit = (i: number, k: keyof Term, val: string) => setList(list.map((t, n) => (n === i ? { ...t, [k]: val } : t)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const x: string[] = [];
    list.forEach((t, i) => {
      if (!t.name.trim() || !t.start || !t.end) x.push(`Term ${i + 1}: fill in the name and both dates.`);
      else if (t.end <= t.start) x.push(`${t.name}: end date must be after the start date.`);
    });
    const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
    sorted.forEach((t, i) => { if (i && t.start <= sorted[i - 1]!.end) x.push(`${t.name} overlaps ${sorted[i - 1]!.name}.`); });
    if (days < 100 || days > 300) x.push("Working days should be between 100 and 300.");
    if (list.length === 0) x.push("Add at least one term.");
    setErr(x);
    if (x.length) return;
    await onSubmit({ year, terms: list, workingDays: days }, async () => {
      await Promise.all(terms.rows.map((r) => terms.remove(r.id)));
      for (const t of list) {
        const d = Math.round((new Date(t.end).getTime() - new Date(t.start).getTime()) / 864e5);
        await terms.create({ name: t.name.trim(), start: t.start, end: t.end, days: Math.round((d * days) / 365), status: "Scheduled" });
      }
      await updCfg("meta", { academicYear: year });
      if (school.rows[0]) await school.update(school.rows[0].id, { academicYear: year });
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
const GRADES = ["LKG", "UKG", ...Array.from({ length: 12 }, (_, i) => String(i + 1))];
type GradeCfg = { grade: string; sections: number; cap: number };
function Step3({ initial, busy, onSubmit, back }: StepProps) {
  const secs = useCollection<any>("set_sections");
  const [cfg, setCfg] = useState<GradeCfg[]>(initial?.cfg ?? GRADES.map((g) => ({ grade: g, sections: 0, cap: 30 })).map((c) => (["1", "2", "3", "4", "5"].includes(c.grade) ? { ...c, sections: 3 } : c)));
  const [err, setErr] = useState("");
  const active = cfg.filter((c) => c.sections > 0);
  const total = active.reduce((a, c) => a + c.sections * c.cap, 0);
  const upd = (g: string, p: Partial<GradeCfg>) => setCfg(cfg.map((c) => (c.grade === g ? { ...c, ...p } : c)));
  const label = (g: string) => (isNaN(Number(g)) ? g : `Grade ${g}`);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!active.length) return setErr("Enable at least one grade by giving it one or more sections.");
    if (active.some((c) => c.cap < 10 || c.cap > 60)) return setErr("Seat capacity per section should be between 10 and 60.");
    setErr("");
    await onSubmit({ cfg }, async () => {
    await Promise.all(secs.rows.map((r) => secs.remove(r.id)));
    for (const c of active) {
      await secs.create({ grade: label(c.grade), stream: c.grade === "LKG" || c.grade === "UKG" ? "Pre-Primary" : Number(c.grade) <= 5 ? "Primary" : Number(c.grade) <= 8 ? "Middle" : "Secondary", sections: Array.from({ length: c.sections }, (_, i) => `${c.grade}-${String.fromCharCode(65 + i)}`), roster: 0, cap: c.sections * c.cap });
    }
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <div className="overflow-x-auto rounded-lg border border-outline-variant/60">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-container-low"><tr><th className="px-4 py-2.5">Grade</th><th className="px-4 py-2.5">Sections</th><th className="px-4 py-2.5">Seats / section</th><th className="px-4 py-2.5">Total seats</th></tr></thead>
          <tbody>{cfg.map((c) => (
            <tr key={c.grade} className="border-t border-outline-variant/40">
              <td className="px-4 py-2 font-medium">{label(c.grade)}</td>
              <td className="px-4 py-2"><Select aria-label={`${label(c.grade)} sections`} value={c.sections} onChange={(e) => upd(c.grade, { sections: num(e.target.value) })} className="w-24">{[0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n || "—"}</option>)}</Select></td>
              <td className="px-4 py-2"><Input aria-label={`${label(c.grade)} seats per section`} type="number" disabled={!c.sections} value={c.cap} onChange={(e) => upd(c.grade, { cap: num(e.target.value) })} className="w-24" /></td>
              <td className="px-4 py-2 font-mono">{c.sections * c.cap || "—"}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-on-surface-variant">{active.length} grades · {active.reduce((a, c) => a + c.sections, 0)} sections · <b className="text-on-surface">{total.toLocaleString("en-IN")}</b> total seats</p>
      {err && <p className="mt-2 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 4 · Bell schedule ---------------- */
function Step4({ initial, busy, onSubmit, back }: StepProps) {
  const { update: updCfg } = useCollection<any>("set_config");
  const [v, setV] = useState({ gates: initial?.gates ?? "07:45", start: initial?.start ?? "08:30", end: initial?.end ?? "14:45", periods: initial?.periods ?? 8, len: initial?.len ?? 40, snackAfter: initial?.snackAfter ?? 3, snackMin: initial?.snackMin ?? 15, lunchAfter: initial?.lunchAfter ?? 5, lunchMin: initial?.lunchMin ?? 30 });
  const [err, setErr] = useState("");
  const sched = useMemo(() => {
    let t = toMin(v.start); const rows: { label: string; from: string; to: string; break?: boolean }[] = [];
    for (let p = 1; p <= v.periods; p++) {
      rows.push({ label: `Period ${p}`, from: fmt(t), to: fmt(t + v.len) }); t += v.len;
      if (p === v.snackAfter && v.snackMin) { rows.push({ label: "Snack break", from: fmt(t), to: fmt(t + v.snackMin), break: true }); t += v.snackMin; }
      if (p === v.lunchAfter && v.lunchMin) { rows.push({ label: "Lunch break", from: fmt(t), to: fmt(t + v.lunchMin), break: true }); t += v.lunchMin; }
    }
    return { rows, endsAt: t };
  }, [v]);
  const n = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.type === "time" ? e.target.value : num(e.target.value) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (toMin(v.start) <= toMin(v.gates)) return setErr("Classes must start after the gates open.");
    if (v.periods < 1 || v.periods > 12) return setErr("Use between 1 and 12 periods.");
    if (v.len < 20 || v.len > 90) return setErr("Period length should be between 20 and 90 minutes.");
    if (sched.endsAt > toMin(v.end)) return setErr(`The schedule runs until ${fmt(sched.endsAt)}, past the closing time of ${v.end}. Shorten the periods or move closing time.`);
    setErr("");
    await onSubmit(v, () => updCfg("bell", { gates: v.gates, classes: `${v.start} – ${v.end}`, periods: `${v.periods} Periods × ${v.len} min`, recess: `${v.snackMin}m (snack) + ${v.lunchMin}m (lunch)` }));
  };
  return (
    <form onSubmit={submit} noValidate>
      <Grid>
        <Field label="Gates open"><Input type="time" value={v.gates} onChange={n("gates")} /></Field>
        <Field label="First period starts"><Input type="time" value={v.start} onChange={n("start")} /></Field>
        <Field label="School closes"><Input type="time" value={v.end} onChange={n("end")} /></Field>
        <Field label="Periods per day"><Input type="number" value={v.periods} onChange={n("periods")} /></Field>
        <Field label="Period length (min)"><Input type="number" value={v.len} onChange={n("len")} /></Field>
        <span />
        <Field label="Snack break after period"><Input type="number" value={v.snackAfter} onChange={n("snackAfter")} /></Field>
        <Field label="Snack break (min)"><Input type="number" value={v.snackMin} onChange={n("snackMin")} /></Field>
        <Field label="Lunch break after period"><Input type="number" value={v.lunchAfter} onChange={n("lunchAfter")} /></Field>
        <Field label="Lunch break (min)"><Input type="number" value={v.lunchMin} onChange={n("lunchMin")} /></Field>
      </Grid>
      <div className="mt-6 rounded-lg border border-outline-variant/60">
        <p className="border-b border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-sm font-semibold">Preview · day ends {fmt(sched.endsAt)}</p>
        <ul className="divide-y divide-outline-variant/40 text-sm">{sched.rows.map((r, i) => (
          <li key={i} className={cn("flex justify-between px-4 py-2", r.break && "bg-warning-container/40")}><span>{r.label}</span><span className="font-mono">{r.from} – {r.to}</span></li>))}</ul>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 5 · Fee structure ---------------- */
const BANDS = [{ id: "pre", label: "Pre-Primary (LKG–UKG)", grades: ["LKG", "UKG"] }, { id: "pri", label: "Primary (1–5)", grades: ["1", "2", "3", "4", "5"] }, { id: "mid", label: "Middle (6–8)", grades: ["6", "7", "8"] }, { id: "sec", label: "Secondary (9–12)", grades: ["9", "10", "11", "12"] }];
function Step5({ initial, busy, onSubmit, back }: StepProps) {
  const fs = useCollection<any>("fee_structure");
  const [fees, setFees] = useState<Record<string, { tuition: number; lab: number; activity: number; library: number }>>(initial?.fees ?? {
    pre: { tuition: 18000, lab: 0, activity: 2000, library: 1000 }, pri: { tuition: 24000, lab: 3500, activity: 2500, library: 1500 },
    mid: { tuition: 30000, lab: 6500, activity: 2500, library: 1500 }, sec: { tuition: 38000, lab: 6500, activity: 3000, library: 2000 } });
  const [freq, setFreq] = useState<string>(initial?.freq ?? "Quarterly");
  const [dueDay, setDueDay] = useState<number>(initial?.dueDay ?? 10);
  const [late, setLate] = useState<number>(initial?.late ?? 2);
  const [upi, setUpi] = useState<boolean>(initial?.upi ?? true);
  const [card, setCard] = useState<boolean>(initial?.card ?? true);
  const [err, setErr] = useState("");
  const edit = (b: string, k: string, val: string) => setFees({ ...fees, [b]: { ...fees[b]!, [k]: num(val) } });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.values(fees).some((f) => f.tuition <= 0)) return setErr("Tuition must be greater than zero for every band.");
    if (dueDay < 1 || dueDay > 28) return setErr("Due day should be between 1 and 28.");
    if (late < 0 || late > 10) return setErr("Late fee should be between 0% and 10%.");
    if (!upi && !card) return setErr("Enable at least one online payment method.");
    setErr("");
    // fee_structure is per grade (Fees module); create the rows a fresh school does not have yet
    await onSubmit({ fees, freq, dueDay, late, upi, card }, async () => {
      for (const b of BANDS) for (const g of b.grades) {
        const row = fs.rows.find((r) => r.grade === g);
        if (row) await fs.update(row.id, { ...fees[b.id]! });
        else await fs.create({ id: `fs_${g}`, grade: g, transport: 0, ...fees[b.id]! });
      }
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <div className="space-y-3">{BANDS.map((b) => (
        <div key={b.id} className="rounded-lg border border-outline-variant/60 p-4">
          <p className="mb-3 font-semibold">{b.label}<span className="ml-2 font-mono text-sm font-normal text-on-surface-variant">₹{Object.values(fees[b.id]!).reduce((a, x) => a + x, 0).toLocaleString("en-IN")} / year</span></p>
          <div className="grid gap-3 sm:grid-cols-4">{(["tuition", "lab", "activity", "library"] as const).map((k) => (
            <Field key={k} label={k[0]!.toUpperCase() + k.slice(1) + " (₹)"}><Input type="number" min={0} value={fees[b.id]![k]} onChange={(e) => edit(b.id, k, e.target.value)} /></Field>))}</div>
        </div>))}
      </div>
      <Grid>
        <Field label="Billing frequency" ><Select value={freq} onChange={(e) => setFreq(e.target.value)}>{["Annual", "Half-yearly", "Quarterly", "Monthly"].map((f) => <option key={f}>{f}</option>)}</Select></Field>
        <Field label="Due on day of month"><Input type="number" value={dueDay} onChange={(e) => setDueDay(num(e.target.value))} /></Field>
        <Field label="Late fee per month (%)"><Input type="number" value={late} onChange={(e) => setLate(num(e.target.value))} /></Field>
      </Grid>
      <div className="mt-5 space-y-3">
        <label className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-4"><span>UPI payments</span><Switch checked={upi} onChange={setUpi} label="UPI payments" /></label>
        <label className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-4"><span>Card payments</span><Switch checked={card} onChange={setCard} label="Card payments" /></label>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 6 · Staff allocations ---------------- */
function Step6({ initial, busy, onSubmit, back }: StepProps) {
  const staff = useCollection<any>("staff");
  const secs = useCollection<any>("set_sections");
  const options = useMemo<string[]>(() => (secs.rows.length ? secs.rows.flatMap((r: any) => r.sections as string[]) : ((initial?.sectionsFromStep3 as string[]) ?? [])), [secs.rows, initial]);
  const ROLES = ["PGT", "TGT", "PRT", "HOD", "Coordinator", "Lab Assistant", "Clerk"];
  const [assign, setAssign] = useState<Record<string, string>>(initial?.assign ?? {});
  const [role, setRole] = useState<Record<string, string>>({});
  const [add, setAdd] = useState({ name: "", department: "Mathematics", role: "TGT" });
  const [err, setErr] = useState("");
  const toast = useToast();
  const taken = (sec: string, except: string) => Object.entries(assign).some(([id, s]) => s === sec && id !== except);

  const addStaff = async () => {
    if (!add.name.trim()) return setErr("Enter the new staff member's name.");
    const used = new Set(staff.rows.map((r: any) => r.empId));
    let n = 1001 + staff.rows.length; while (used.has(`EMP-${n}`)) n++;
    try {
      await staff.create({ name: add.name.trim(), empId: `EMP-${n}`, department: add.department, role: add.role, status: "Active", phone: "" } as never);
      setAdd({ ...add, name: "" }); setErr(""); toast("Staff member added");
    } catch (e) { setErr(`Could not add staff: ${errText(e)}`); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (staff.rows.length === 0) return setErr("Add at least one staff member before continuing.");
    const unassigned = options.filter((s) => !Object.values(assign).includes(s));
    if (unassigned.length > options.length * 0.5) return setErr(`${unassigned.length} of ${options.length} sections have no class teacher yet. Assign at least half to continue.`);
    setErr("");
    await onSubmit({ assign, assigned: Object.keys(assign).length, sectionsFromStep3: options }, async () => {
      for (const r of staff.rows) await staff.update(r.id, { role: role[r.id] ?? r.role, classTeacherOf: assign[r.id] ?? "" } as never);
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <div className="max-h-[420px] overflow-auto rounded-lg border border-outline-variant/60">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-container-low"><tr><th className="px-4 py-2.5">Name</th><th className="px-4 py-2.5">Department</th><th className="px-4 py-2.5">Role</th><th className="px-4 py-2.5">Class teacher of</th></tr></thead>
          <tbody>{staff.rows.map((r: any) => (
            <tr key={r.id} className="border-t border-outline-variant/40">
              <td className="px-4 py-2">{r.name}</td><td className="px-4 py-2 text-on-surface-variant">{r.department}</td>
              <td className="px-4 py-2"><Select aria-label={`Role for ${r.name}`} value={role[r.id] ?? r.role} onChange={(e) => setRole({ ...role, [r.id]: e.target.value })} className="w-36">{ROLES.map((x) => <option key={x}>{x}</option>)}</Select></td>
              <td className="px-4 py-2"><Select aria-label={`Class for ${r.name}`} value={assign[r.id] ?? ""} onChange={(e) => { const v = e.target.value; if (v && taken(v, r.id)) return setErr(`${v} already has a class teacher.`); setErr(""); setAssign((a) => { const n = { ...a }; if (v) n[r.id] = v; else delete n[r.id]; return n; }); }} className="w-36">
                <option value="">— none —</option>{options.map((o) => <option key={o} value={o} disabled={taken(o, r.id)}>{o}</option>)}</Select></td>
            </tr>))}</tbody>
        </table>
      </div>
      <p className="mt-3 text-on-surface-variant">{Object.keys(assign).length} of {options.length} sections have a class teacher.</p>
      <div className="mt-5 grid items-end gap-3 rounded-lg border border-dashed border-outline-variant p-4 sm:grid-cols-[1fr_170px_120px_auto]">
        <Field label="New staff member"><Input value={add.name} onChange={(e) => setAdd({ ...add, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addStaff(); } }} /></Field>
        <Field label="Department"><Select value={add.department} onChange={(e) => setAdd({ ...add, department: e.target.value })}>{["Mathematics", "Science", "English", "Social Science", "Hindi", "Computer Science", "Physical Education", "Administration"].map((d) => <option key={d}>{d}</option>)}</Select></Field>
        <Field label="Role"><Select value={add.role} onChange={(e) => setAdd({ ...add, role: e.target.value })}>{ROLES.map((x) => <option key={x}>{x}</option>)}</Select></Field>
        <Button type="button" variant="outline" onClick={addStaff}><Plus size={16} />Add</Button>
      </div>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 7 · Data import ---------------- */
const HEADER = "name,grade,section,guardian,phone";
const SAMPLE = `${HEADER}\nAarav Nair,5,A,Mr. Nair,+91 9810011223\nDiya Menon,5,B,Mrs. Menon,+91 9810011224\nKabir Shah,9,A,Mr. Shah,+91 9810011225\nTara Iyer,3,C,Mrs. Iyer,+91 98100`;
type ParsedRow = { line: number; name: string; grade: string; section: string; guardian: string; phone: string; error?: string };
function parseCsv(text: string): ParsedRow[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const start = /^name\s*,/i.test(lines[0]!) ? 1 : 0;
  return lines.slice(start).map((l, i) => {
    const [name = "", grade = "", section = "", guardian = "", phone = ""] = l.split(",").map((c) => c.trim());
    let error: string | undefined;
    if (!name) error = "Missing name"; else if (!GRADES.includes(grade)) error = `Unknown grade "${grade}"`;
    else if (!/^[A-H]$/i.test(section)) error = "Section must be A–H"; else if (!guardian) error = "Missing guardian";
    else if (phone.replace(/\D/g, "").length < 10) error = "Phone needs 10+ digits";
    return { line: i + start + 1, name, grade, section: section.toUpperCase(), guardian, phone, error };
  });
}
function Step7({ initial, busy, onSubmit, back }: StepProps) {
  const students = useCollection<any>("students");
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [imported, setImported] = useState<number>(initial?.imported ?? 0);
  const [working, setWorking] = useState(false);
  const rows = useMemo(() => parseCsv(text), [text]);
  const good = rows.filter((r) => !r.error), bad = rows.filter((r) => r.error);

  const doImport = async () => {
    setWorking(true);
    const used = new Set(students.rows.map((s: any) => s.grn));
    let next = 9000 + students.rows.length, done = 0;
    try {
      for (const r of good) {
        while (used.has(`GRN-${next}`)) next++;
        await students.create({ name: r.name, grn: `GRN-${next++}`, grade: r.grade, section: r.section, guardian: r.guardian, phone: r.phone, status: "Active", attendance: 100 } as never);
        done++;
      }
      setText(""); toast(`${done} student${done === 1 ? "" : "s"} imported`);
    } catch (e) {
      // keep the rows that did not make it so the admin can retry
      setText([HEADER, ...good.slice(done).map((r) => [r.name, r.grade, r.section, r.guardian, r.phone].join(","))].join("\n"));
      toast(`Imported ${done} of ${good.length}: ${errText(e)}`, "error");
    } finally { setImported((n) => n + done); setWorking(false); }
  };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([SAMPLE], { type: "text/csv" })); a.download = "students-template.csv"; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 0); };
  const submit = (e: React.FormEvent) => { e.preventDefault(); if (working) return; void onSubmit({ imported, totalStudents: students.rows.length }); };

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => file.current?.click()}><Upload size={16} />Upload CSV</Button>
        <input ref={file} type="file" accept=".csv,text/csv" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setText(await f.text()); e.target.value = ""; }} />
        <Button type="button" variant="ghost" onClick={() => setText(SAMPLE)}>Load sample rows</Button>
        <Button type="button" variant="ghost" onClick={download}>Download template</Button>
        <span className="ml-auto text-sm text-on-surface-variant">Columns: {HEADER}</span>
      </div>
      <Textarea className="mt-3 min-h-40 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Paste CSV rows here\n${HEADER}`} aria-label="CSV data" />
      {rows.length > 0 && (
        <div className="mt-4 rounded-lg border border-outline-variant/60">
          <div className="flex items-center justify-between border-b border-outline-variant/60 bg-surface-container-low px-4 py-2.5 text-sm">
            <span><Badge tone="success">{good.length} valid</Badge> <Badge tone={bad.length ? "danger" : "neutral"}>{bad.length} with errors</Badge></span>
            <Button type="button" size="sm" disabled={!good.length || working} onClick={doImport}>{working ? "Importing…" : `Import ${good.length} valid row${good.length === 1 ? "" : "s"}`}</Button>
          </div>
          <ul className="max-h-48 divide-y divide-outline-variant/40 overflow-auto text-sm">{rows.map((r) => (
            <li key={r.line} className="flex justify-between gap-3 px-4 py-1.5"><span>Line {r.line}: {r.name || "—"} · Gr {r.grade}-{r.section}</span>{r.error ? <span className="text-error">{r.error}</span> : <span className="text-success">OK</span>}</li>))}</ul>
        </div>
      )}
      <p className="mt-4 rounded-lg bg-surface-container-low p-4 text-sm text-on-surface-variant">
        <b className="text-on-surface">{students.rows.length}</b> students are in the system{imported ? <> ({imported} imported in this step)</> : null}. You can also import more later from Students &amp; Guardians.
      </p>
      <StepFooter busy={busy} back={back} />
    </form>
  );
}

/* ---------------- 8 · Parent invite ---------------- */
function Step8({ initial, busy, onSubmit, back }: StepProps) {
  const students = useCollection<any>("students");
  const { create: notify } = useCollection<any>("notifications");
  const school = useCollection<any>("school");
  const [ch, setCh] = useState<Record<string, boolean>>(initial?.ch ?? { app: true, whatsapp: true, sms: false, email: true });
  const [msg, setMsg] = useState<string>(initial?.msg ?? "Dear {parent}, {school} has opened its parent app. Use this link to view {child}'s attendance, fees and notices: {link}");
  const [when, setWhen] = useState<string>(initial?.when ?? "now");
  const [date, setDate] = useState<string>(initial?.date ?? "");
  const [verified, setVerified] = useState(false);
  const [err, setErr] = useState("");
  const sample = students.rows[0];
  const preview = msg.replaceAll("{parent}", sample?.guardian ?? "Parent").replaceAll("{child}", sample?.name ?? "your child").replaceAll("{school}", school.rows[0]?.short ?? "School").replaceAll("{link}", "[parent app link]");
  const names = { app: "Parent app push", whatsapp: "WhatsApp", sms: "SMS", email: "Email" } as const;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Object.values(ch).some(Boolean)) return setErr("Choose at least one channel.");
    if (!msg.includes("{link}")) return setErr("The message must include the {link} variable so parents can sign in.");
    if (when === "later" && !date) return setErr("Pick the date to send the invitations.");
    if (!verified) return setErr("Confirm the parent contact data has been verified.");
    setErr("");
    await onSubmit({ ch, msg, when, date, families: students.rows.length }, () =>
      notify({ category: "statutory", title: "Setup complete", body: `Parent invitations ${when === "now" ? "queued" : `scheduled for ${date}`} for ${students.rows.length} families via ${Object.entries(ch).filter(([, v]) => v).map(([k]) => names[k as keyof typeof names]).join(", ")} (simulated — parent app not live yet).`, createdAt: nowLocal(), read: false, href: "/dashboard" }));
  };
  return (
    <form onSubmit={submit} noValidate>
      <p className="mb-2 text-sm font-semibold">Channels</p>
      <div className="grid gap-3 sm:grid-cols-2">{(Object.keys(names) as (keyof typeof names)[]).map((k) => (
        <label key={k} className="flex items-center justify-between rounded-lg border border-outline-variant/60 p-4"><span>{names[k]}</span><Switch checked={!!ch[k]} onChange={(v) => setCh({ ...ch, [k]: v })} label={names[k]} /></label>))}</div>
      <Field label="Invitation message" hint="Variables: {parent} {child} {school} {link}" className="mt-5"><Textarea value={msg} onChange={(e) => setMsg(e.target.value)} /></Field>
      <div className="mt-3 rounded-lg bg-surface-container-low p-4 text-sm"><span className="t-label-caps text-on-surface-variant">Preview</span><p className="mt-1">{preview}</p></div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2"><input type="radio" name="when" checked={when === "now"} onChange={() => setWhen("now")} className="accent-secondary" />Send on finish</label>
        <label className="flex items-center gap-2"><input type="radio" name="when" checked={when === "later"} onChange={() => setWhen("later")} className="accent-secondary" />Schedule</label>
        {when === "later" && <Input type="date" value={date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setDate(e.target.value)} className="w-44" aria-label="Send date" />}
      </div>
      <label className="mt-5 flex items-start gap-3 text-sm"><Checkbox checked={verified} onChange={(e) => setVerified(e.target.checked)} className="mt-0.5" />
        <span>I confirm parent phone numbers and emails have been verified. Invitations will go to <b>{students.rows.length}</b> families.</span></label>
      {err && <p className="mt-3 text-sm text-error" role="alert">{err}</p>}
      <StepFooter busy={busy} back={back} last />
    </form>
  );
}

export const STEP_FORMS: React.ComponentType<StepProps>[] = [Step1, Step2, Step3, Step4, Step5, Step6, Step7, Step8];
