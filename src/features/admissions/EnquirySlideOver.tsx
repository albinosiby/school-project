"use client";
import { useMemo, useState } from "react";
import { CheckCircle2, Send, TriangleAlert } from "lucide-react";
import { Badge, Button, Checkbox, Field, Input, Select, SlideOver, Textarea, useToast } from "@/components/ui";
import { ageOn, isEmail, isPhone, nextRef, useAdm } from "./lib";
import { GRADES, SOURCES, STAFF } from "./types";

const blank = { name: "", grade: "1", dob: "", prevSchool: "", guardian: "", relation: "Father", phone: "", email: "", area: "", source: "Walk-In", assignee: "", followUp: "", note: "", sibling: false, wa: true };

export function EnquirySlideOver(p: { open: boolean; onClose: () => void }) {
  return p.open ? <EnquiryForm {...p} /> : null;
}

function EnquiryForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { enq, createEnquiry, logMessage } = useAdm();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [err, setErr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof blank>(k: K, v: (typeof blank)[K]) => setF((x) => ({ ...x, [k]: v }));
  const refId = useMemo(() => nextRef("ENQ", enq.rows), [enq.rows]);

  const age = f.dob ? ageOn(f.dob) : null;
  const g = GRADES.find((x) => x.id === f.grade)!;
  const ageAtCutoff = f.dob ? ageOn(f.dob, new Date("2026-03-31")) : null;
  const eligible = ageAtCutoff ? ageAtCutoff.years >= g.minAge : null;

  async function submit() {
    const e: Record<string, string> = {};
    if (!f.name.trim()) e.name = "Student name is required";
    if (!f.dob) e.dob = "Date of birth is required"; else if (new Date(f.dob) > new Date()) e.dob = "DOB cannot be in the future";
    if (!f.guardian.trim()) e.guardian = "Guardian name is required";
    if (!isPhone(f.phone)) e.phone = "Enter a valid mobile number";
    if (!isEmail(f.email)) e.email = "Enter a valid email";
    setErr(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const row = await createEnquiry({
        name: f.name.trim(), grade: f.grade, dob: f.dob, prevSchool: f.prevSchool, guardian: f.guardian.trim(), relation: f.relation, phone: f.phone.trim(),
        email: f.email.trim(), area: f.area, source: f.source, assignee: f.assignee, followUp: f.followUp, note: f.note, sibling: f.sibling,
      });
      if (f.wa) await logMessage("WhatsApp prospectus", f.phone, `Digital prospectus for ${f.name} (${row.ref}) sent via WhatsApp.`);
      toast(`Enquiry ${row.ref} created${f.wa ? " · prospectus dispatched on WhatsApp" : ""}`);
      onClose();
    } catch { toast("Could not create enquiry", "error"); } finally { setBusy(false); }
  }

  return (
    <SlideOver open={open} onClose={onClose} width="max-w-2xl" title="Log Prospective Enquiry"
      subtitle="Record walk-in parent, telephone enquiry, or referral. Generates instant enquiry ID and sends digital prospectus via WhatsApp."
      footer={<><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={busy}><Send size={16} />Create Enquiry &amp; Dispatch WhatsApp</Button></>}>
      <div className="mb-4 flex gap-2"><Badge tone="info">QUICK TRIAGE DESK</Badge><Badge tone="brand">{refId}</Badge></div>
      <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); submit(); }} noValidate>
        <section className="space-y-4">
          <h3 className="t-label-caps border-b border-outline-variant/60 pb-2">1. Candidate Information</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Student Full Name" required error={err.name}><Input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Samaira Kapoor" /></Field>
            <Field label="Target Grade / Cohort" required><Select value={f.grade} onChange={(e) => set("grade", e.target.value)}>{GRADES.map((x) => <option key={x.id} value={x.id}>{x.label} (CBSE) - AY 2026-27</option>)}</Select></Field>
          </div>
          <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
            <Field label="Date of Birth" required error={err.dob}><Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
            <div className="flex h-10 items-center gap-2">
              {age && <span className="rounded bg-surface-container px-3 py-2 text-sm">{age.years} yrs {age.months} mos</span>}
              {eligible !== null && (eligible
                ? <Badge tone="success"><CheckCircle2 size={12} />Eligible for {g.label}</Badge>
                : <Badge tone="warning"><TriangleAlert size={12} />Below minimum age ({g.minAge}y on 31-Mar-2026)</Badge>)}
            </div>
          </div>
          <Field label="Previous School / Pre-School"><Input value={f.prevSchool} onChange={(e) => set("prevSchool", e.target.value)} /></Field>
        </section>
        <section className="space-y-4">
          <h3 className="t-label-caps border-b border-outline-variant/60 pb-2">2. Guardian &amp; Contact Details</h3>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <Field label="Primary Guardian" required error={err.guardian}><Input value={f.guardian} onChange={(e) => set("guardian", e.target.value)} placeholder="Dr. Vikram Kapoor" /></Field>
            <Field label="Relation"><Select value={f.relation} onChange={(e) => set("relation", e.target.value)}><option>Father</option><option>Mother</option><option>Guardian</option></Select></Field>
            <Field label="Mobile Number" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98452 31209" inputMode="tel" /></Field>
          </div>
          <Field label="Email Address" required error={err.email}><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
          <Field label="Residential Area & Pincode"><Input value={f.area} onChange={(e) => set("area", e.target.value)} placeholder="Indiranagar, Bangalore - 560038" /></Field>
        </section>
        <section className="space-y-4">
          <h3 className="t-label-caps border-b border-outline-variant/60 pb-2">3. Lead Attribution &amp; Staff</h3>
          <fieldset>
            <legend className="mb-1.5 text-xs font-semibold text-on-surface-variant">Enquiry Source Channel <span className="text-error">*</span></legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SOURCES.map((s) => (
                <label key={s} className={`flex cursor-pointer items-center gap-2 rounded border px-3 py-2.5 text-sm ${f.source === s ? "border-secondary bg-info-container font-semibold" : "border-outline-variant"}`}>
                  <input type="radio" name="source" className="accent-secondary" checked={f.source === s} onChange={() => set("source", s)} />{s}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Assign to Counsellor"><Select value={f.assignee} onChange={(e) => set("assignee", e.target.value)}><option value="">Unassigned</option>{STAFF.map((s) => <option key={s}>{s}</option>)}</Select></Field>
            <Field label="Follow-up Date"><Input type="date" value={f.followUp} onChange={(e) => set("followUp", e.target.value)} /></Field>
          </div>
          <Field label="Notes"><Textarea value={f.note} onChange={(e) => set("note", e.target.value)} placeholder="Parent requests, transport route, sibling details…" /></Field>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.sibling} onChange={(e) => set("sibling", e.target.checked)} />Sibling currently enrolled (priority intake)</label>
          <label className="flex items-center gap-2 text-sm"><Checkbox checked={f.wa} onChange={(e) => set("wa", e.target.checked)} />Dispatch digital prospectus on WhatsApp</label>
        </section>
      </form>
    </SlideOver>
  );
}
