"use client";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, FileText, Trash2, UploadCloud } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, SlideOver, Switch, useToast } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { cn } from "@/lib/cn";
import { CATS, errMsg, MONTHS, monthGrid, parse, TODAY, useEvents, type CalEvent, type CatId, type Staff, nowLocal } from "./data";

const GRADES = ["6", "7", "8", "9", "10", "11", "12"];
const TERMS = ["Term 1 (Apr – Oct)", "Term 2 (Nov – Mar)"];
/** Apr–Oct is Term 1, Nov–Mar Term 2 */
const termFor = (date: string) => { const m = parse(date).getMonth(); return m >= 3 && m <= 9 ? TERMS[0]! : TERMS[1]!; };
const VENUES = ["Main Campus", "Main Auditorium & Science Labs Block B", "Main Field & Amphitheatre", "Examination Wing", "Thyagaraj Stadium", "Library & Seminar Hall"];

type Form = { title: string; category: CatId; term: string; start: string; end: string; startTime: string; endTime: string; instructional: boolean; grades: string[];
  venue: string; lead: string; notifyApp: boolean; notifyWhatsapp: boolean; circular: string; desc: string };
const blank = (date: string): Form => ({ title: "", category: "ptm", term: termFor(date), start: date, end: date, startTime: "08:30", endTime: "14:30",
  instructional: true, grades: [], venue: VENUES[0]!, lead: "", notifyApp: true, notifyWhatsapp: false, circular: "", desc: "" });

export function AddEventPanel({ open, onClose, initialDate }: { open: boolean; onClose: () => void; initialDate?: string }) {
  const { rows: events, create } = useEvents();
  const { rows: staff } = useCollection<Staff>("staff");
  const { create: notify } = useCollection<{ id: string }>("notifications");
  const toast = useToast();
  const [f, setF] = useState<Form>(blank(initialDate ?? TODAY));
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setF(blank(initialDate ?? TODAY)); setErrs({}); } }, [open, initialDate]);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  const days = Math.max(1, Math.round((parse(f.end).getTime() - parse(f.start).getTime()) / 864e5) + 1);
  const clashes = useMemo(() => events.filter((e) => e.status === "published" && e.start <= f.end && e.end >= f.start &&
    ((e.venue === f.venue && e.venue !== "Main Campus") || (f.lead && e.lead === f.lead))), [events, f.start, f.end, f.venue, f.lead]);
  const [mm, setMm] = useState(() => { const d = parse(f.start); return { y: d.getFullYear(), m: d.getMonth() }; });
  useEffect(() => { const d = parse(f.start); setMm({ y: d.getFullYear(), m: d.getMonth() }); }, [f.start]);
  const grid = monthGrid(mm.y, mm.m);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!f.title.trim()) e.title = "Event title is required";
    if (!f.start) e.start = "Start date required";
    if (!f.end || f.end < f.start) e.end = "End date must be on or after start date";
    if (f.startTime >= f.endTime && f.start === f.end) e.endTime = "End time must be after start time";
    setErrs(e); return Object.keys(e).length === 0;
  };
  const save = async (status: "published" | "draft") => {
    if (!validate()) { toast("Please fix the highlighted fields", "error"); return; }
    const { circular, ...rest } = f;
    setBusy(true);
    try {
      await create({ ...rest, title: f.title.trim(), term: f.term.startsWith("Term 1") ? "Term 1" : "Term 2", circular, status } as Omit<CalEvent, "id">);
      if (status === "published" && f.notifyApp) {
        await notify({ category: "statutory", title: "Calendar", body: `“${f.title.trim()}” published to the master calendar (${f.start}${f.end !== f.start ? ` → ${f.end}` : ""})`, createdAt: nowLocal(), read: false, href: "/calendar" } as never);
      }
      toast(status === "published" ? "Event published to master calendar" : "Saved as unapproved draft");
      onClose();
    } catch (e) { toast(errMsg(e, "Could not save the event"), "error"); } finally { setBusy(false); }
  };
  const chip = (on: boolean) => cn("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors", on ? "border-secondary bg-secondary text-on-secondary" : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low");
  const section = (n: string, title: string, sub: string, tag: string, body: React.ReactNode) => (
    <section className="rounded-lg border border-outline-variant/60 p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex gap-3"><span className="grid size-8 place-items-center rounded bg-info-container text-xs font-bold text-secondary">{n}</span>
          <div><h3 className="font-semibold">{title}</h3><p className="text-xs text-outline">{sub}</p></div></div>
        <Badge>{tag}</Badge>
      </div>{body}
    </section>);

  return (
    <SlideOver open={open} onClose={onClose} width="max-w-5xl" title="Add Academic Milestone / Statutory Event"
      subtitle="Create and publish term milestones, statutory examinations, holidays, PTMs or sports events to the 2026-27 master institutional calendar."
      footer={<div className="flex w-full flex-wrap items-center gap-2">
        <Button variant="ghost" className="!text-error" onClick={() => { setF(blank(initialDate ?? TODAY)); setErrs({}); onClose(); }}><Trash2 size={14} />Discard Changes</Button>
        <span className="text-xs text-outline">• Nothing is saved until you publish or save a draft</span>
        <div className="ml-auto flex gap-2"><Button variant="outline" disabled={busy} onClick={() => save("draft")}>Save as Unapproved Draft</Button><Button disabled={busy} onClick={() => save("published")}>{busy ? "Saving…" : "Publish to Master Calendar"}</Button></div></div>}>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <div className="space-y-5">
          {section("01", "Event Classification & Identity", "Institutional nomenclature and statutory registry category", "MASTER REGISTRY", <>
            <Field label="Official Event Title" required error={errs.title} hint="Appears on parent portal timelines and printed term certificates.">
              <Input value={f.title} maxLength={120} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Annual Science & Innovation Exhibition 2026" />
            </Field>
            <p className="mt-1 text-right text-xs text-outline">{f.title.length} / 120 chars</p>
            <p className="mb-2 mt-3 text-xs font-semibold text-on-surface-variant">Statutory Classification</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Classification">
              {CATS.map((c) => <button key={c.id} role="radio" aria-checked={f.category === c.id} onClick={() => set("category", c.id)} className={chip(f.category === c.id)}>
                <span className={cn("size-2 rounded-full", f.category === c.id ? "bg-white" : c.dot)} />{c.label}{f.category === c.id && " ✓"}</button>)}
            </div></>)}
          {section("02", "Date, Time & Term Alignment", "Institutional timetable mapping & instructional day calculation", "Quarter Q3", <>
            <Field label="Academic Term Alignment"><Select value={f.term.startsWith("Term 1") ? TERMS[0] : TERMS[1]} onChange={(e) => set("term", e.target.value)}>{TERMS.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Start date" required error={errs.start}><Input type="date" value={f.start} onChange={(e) => { const v = e.target.value; set("start", v); if (v && f.end < v) set("end", v); if (v) set("term", termFor(v)); }} /></Field>
              <Field label="End date" required error={errs.end} hint={`${days} consecutive day${days > 1 ? "s" : ""}`}><Input type="date" value={f.end} min={f.start} onChange={(e) => set("end", e.target.value)} /></Field>
              <Field label="Daily start time"><Input type="time" value={f.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
              <Field label="Daily end time" error={errs.endTime}><Input type="time" value={f.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 rounded-lg border border-success/30 bg-success-container/50 p-4">
              <div><p className="font-semibold">CBSE Rule 14.1 Instructional Day Quota</p>
                <p className="mt-1 text-xs text-on-surface-variant">Count this milestone as an instructional working day toward the mandatory 220-day school schedule.</p></div>
              <div className="flex items-center gap-2 text-xs font-semibold">CREDIT<Switch checked={f.instructional} onChange={(v) => set("instructional", v)} label="Instructional credit" /></div>
            </div></>)}
          {section("03", "Target Cohort & Campus Venue", "Class selection and lead faculty coordinator", "Senior & Middle Wings", <>
            <div className="mb-2 flex items-center justify-between"><p className="text-xs font-semibold text-on-surface-variant">Eligible Student Grades (Multi-select)</p>
              <button className="cursor-pointer text-xs font-semibold text-secondary" onClick={() => set("grades", f.grades.length === GRADES.length ? [] : GRADES)}>Select All Grades (6-12)</button></div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {GRADES.map((g) => <button key={g} aria-pressed={f.grades.includes(g)} onClick={() => set("grades", f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g])}
                className={cn("cursor-pointer rounded-lg border py-2.5 text-sm font-bold", f.grades.includes(g) ? "border-secondary bg-info-container text-secondary" : "border-outline-variant text-on-surface-variant")}>G-{g.padStart(2, "0")}</button>)}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Designated Campus Venue"><Select value={f.venue} onChange={(e) => set("venue", e.target.value)}>{VENUES.map((v) => <option key={v}>{v}</option>)}</Select></Field>
              <Field label="Event Faculty Lead"><Select value={f.lead} onChange={(e) => set("lead", e.target.value)}><option value="">— Unassigned —</option>{staff.filter((s) => s.status === "Active").map((s) => <option key={s.id}>{s.name}</option>)}</Select></Field>
            </div></>)}
          {section("04", "Parent Sync, Dispatch & Documentation", "Omni-channel guardian broadcast & verified circular upload", "Multi-Channel", <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer gap-3 rounded-lg border border-outline-variant p-4"><Checkbox checked={f.notifyApp} onChange={(e) => set("notifyApp", e.target.checked)} />
                <span><span className="block font-semibold">ParentApp & Portal Sync</span><span className="text-xs text-on-surface-variant">Instant push alert and badge notice to guardian profiles.</span></span></label>
              <label className="flex cursor-pointer gap-3 rounded-lg border border-outline-variant p-4"><Checkbox checked={f.notifyWhatsapp} onChange={(e) => set("notifyWhatsapp", e.target.checked)} />
                <span><span className="block font-semibold">48-Hr WhatsApp Notice</span><span className="text-xs text-on-surface-variant">Schedule WhatsApp circular dispatch 48 hours before the event.</span></span></label>
            </div>
            <Field label="Notes / Description" className="mt-4"><Input value={f.desc} onChange={(e) => set("desc", e.target.value)} placeholder="Short description shown on the calendar" /></Field>
            <p className="mb-2 mt-4 text-xs font-semibold text-on-surface-variant">Official Circular / CBSE Notification Upload</p>
            <label className="flex cursor-pointer flex-col items-center gap-1 rounded-lg border-2 border-dashed border-outline-variant p-6 text-center hover:bg-surface-container-low">
              <UploadCloud className="text-secondary" />
              <span className="font-semibold">{f.circular ? "Replace circular" : "Upload Official Approval & Schedule Dossier"}</span>
              <span className="text-xs text-outline">Click to select PDF or DOCX up to 15MB (file name is recorded; upload is simulated)</span>
              <input type="file" accept=".pdf,.docx" className="sr-only" onChange={(e) => { const file = e.target.files?.[0]; if (file) set("circular", file.name); }} />
            </label>
            {f.circular && <p className="mt-2 flex items-center gap-2 text-sm"><FileText size={14} className="text-error" />{f.circular}<CheckCircle2 size={14} className="text-success" /></p>}
          </>)}
        </div>
        <aside className="space-y-4">
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Instructional credit</p><Badge tone={f.instructional ? "success" : "neutral"}>{f.instructional ? "Counts" : "Not counted"}</Badge></div>
            <p className="mt-2 font-mono text-2xl font-semibold">{f.instructional ? `+${days}` : "+0"} <span className="text-sm text-outline">day{days > 1 ? "s" : ""}</span></p>
            <p className="mt-1 text-xs text-outline">Track the yearly total in the Instructional Days Tracker on the calendar.</p>
          </div>
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="mb-2 flex items-center justify-between text-sm font-semibold"><span>{MONTHS[mm.m]} {mm.y}</span>
              <span className="flex"><button aria-label="Previous month" className="cursor-pointer p-1" onClick={() => setMm((x) => x.m === 0 ? { y: x.y - 1, m: 11 } : { ...x, m: x.m - 1 })}><ChevronLeft size={14} /></button>
                <button aria-label="Next month" className="cursor-pointer p-1" onClick={() => setMm((x) => x.m === 11 ? { y: x.y + 1, m: 0 } : { ...x, m: x.m + 1 })}><ChevronRight size={14} /></button></span></div>
            <div className="grid grid-cols-7 gap-0.5 text-center text-xs">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="py-1 text-outline">{d}</span>)}
              {grid.map((c) => { const inRange = c.iso >= f.start && c.iso <= f.end; const has = events.some((e) => e.status === "published" && e.start <= c.iso && c.iso <= e.end);
                return <span key={c.iso} className={cn("rounded py-1", !c.inMonth && "text-outline/40", inRange ? "bg-secondary font-bold text-on-secondary" : has && "bg-warning-container text-warning")}>{c.day}</span>; })}
            </div>
          </div>
          <div className="rounded-lg border border-outline-variant/60 p-4">
            <div className="flex items-center justify-between"><p className="text-sm font-semibold">Clashes Inspector</p>
              <Badge tone={clashes.length ? "danger" : "success"}>{clashes.length ? `${clashes.length} Conflict${clashes.length > 1 ? "s" : ""}` : "Zero Conflicts"}</Badge></div>
            <p className="mt-2 text-xs text-on-surface-variant">{clashes.length ? clashes.map((c) => `“${c.title}” already uses ${c.venue === f.venue ? c.venue : c.lead} on these dates.`).join(" ")
              : `No venue or faculty conflicts detected for ${f.venue}${f.lead ? ` and ${f.lead}` : ""} on the selected dates.`}</p>
          </div>
        </aside>
      </div>
    </SlideOver>
  );
}
