"use client";

import { useState } from "react";
import { Button, Field, Input, Select, SlideOver, useToast } from "@/components/ui";
import { todayISO, useAdm, useToday } from "./lib";
import { admissionGenders } from "./admissionDetails";
import { enquiryErrors } from "./logic";

export function EnquirySlideOver({ open, onClose, mode = "enquiry", onApplication }: {
  open: boolean; onClose: () => void; mode?: "enquiry" | "application"; onApplication?: (id: string) => void;
}) {
  return open ? <IntakeForm onClose={onClose} mode={mode} onApplication={onApplication} /> : null;
}

function IntakeForm({ onClose, mode, onApplication }: {
  onClose: () => void; mode: "enquiry" | "application"; onApplication?: (id: string) => void;
}) {
  const { cohorts, createEnquiry, createApplication } = useAdm();
  const toast = useToast();
  const today = useToday();
  const [values, setValues] = useState({ name: "", grade: "", dob: "", guardian: "", phone: "", email: "", gender: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const direct = mode === "application";
  const set = (key: keyof typeof values, value: string) => setValues((previous) => ({ ...previous, [key]: value }));

  async function save() {
    if (busy) return;
    const draft = { ...values, name: values.name.trim(), guardian: values.guardian.trim(), phone: values.phone.trim(), email: values.email.trim().toLowerCase() };
    const invalid = enquiryErrors(draft, todayISO(), cohorts, { contactOnly: direct });
    if (!direct && !draft.gender) invalid.gender = "Select a gender";
    setErrors(invalid);
    if (Object.keys(invalid).length) return;
    setBusy(true);
    try {
      if (direct) {
        const app = await createApplication(draft);
        toast(`Application ${app.ref} created`);
        onApplication?.(app.id);
      } else {
        const enquiry = await createEnquiry(draft);
        toast(`Enquiry ${enquiry.ref} created`);
      }
      onClose();
    } catch {
      toast(direct ? "Could not create the application" : "Could not create the enquiry", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SlideOver open onClose={() => { if (!busy) onClose(); }} width="max-w-xl" title={direct ? "New application" : "New enquiry"}
      footer={<><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy} onClick={save}>{busy ? "Saving…" : direct ? "Create application" : "Create enquiry"}</Button></>}>
      <form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); void save(); }} noValidate>
        <Field label="Student name" required error={errors.name}><Input value={values.name} onChange={(e) => set("name", e.target.value)} /></Field>
        {!direct && <Field label="Gender" required error={errors.gender}><Select value={values.gender} onChange={(e) => set("gender", e.target.value)}>
          <option value="">Select a gender</option>{admissionGenders.map((gender) => <option key={gender}>{gender}</option>)}
        </Select></Field>}
        <Field label="Grade or course" required error={errors.grade}><Select value={values.grade} onChange={(e) => set("grade", e.target.value)}>
          <option value="">Choose a grade or course</option>{cohorts.map((cohort) => <option key={cohort.id} value={cohort.id}>{cohort.label}</option>)}
        </Select></Field>
        <Field label="Guardian name" required error={errors.guardian}><Input value={values.guardian} onChange={(e) => set("guardian", e.target.value)} /></Field>
        <Field label="Guardian phone" required error={errors.phone}><Input type="tel" value={values.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        <Field label="Parent email" required={!direct} error={errors.email}><Input type="email" value={values.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Date of birth" required={!direct} error={errors.dob}><Input type="date" max={today} value={values.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
      </form>
    </SlideOver>
  );
}
