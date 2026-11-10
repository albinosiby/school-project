"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AdmissionDetailsFields } from "@/features/admissions/AdmissionDetailsFields";
import { admissionErrors, blankAdmission } from "@/features/admissions/admissionDetails";
import { defaultNumbering, formatAdmissionNumber, validAdmissionNumber, type AdmissionNumbering } from "@/features/admissions/numbering";
import { addressRecord } from "@/features/onboarding/address";
import { useAddressLocations } from "@/features/onboarding/SchoolAddressFields";
import { Button, Field, Input, Select, SlideOver, Switch } from "@/components/ui";
import { computeSeatRows, type StudentRow } from "@/features/admissions/logic";
import { GRADES as ADMISSION_GRADES, type Application, type Offer, type Seat } from "@/features/admissions/types";
import { SECTIONS, todayIso } from "@/features/ops/shared";
import { classStream, isCourseId, isSeniorGrade, streamsForGrade, streamFromClassId, type AcademicClass } from "@/lib/academicStreams";
import { normEmail, type SchoolUser } from "@/lib/parentAccount";
import { useCollection } from "@/lib/useCollection";
import { studentClassId, validateStudent, type StudentDoc, type StudentFormValues } from "./studentLogic";
import type { Student } from "./StudentsView";

const STATUS = ["Active", "Alumni-pending", "Transferred"];
const GRADES = [
  ...ADMISSION_GRADES.filter(({ id }) => !id.includes("-")),
  { id: "11", label: "Grade 11" }, { id: "12", label: "Grade 12" },
];
const blank: StudentFormValues = { name: "", grn: "", grade: "6", section: "A", roll: "", guardian: "", relation: "Parent", phone: "", email: "", guardianEmail: "", dob: "", address: "", status: "Active", attendance: 100 };
/** The form's copy of a student (only the fields the form edits). */
const formOf = (s: Student): StudentFormValues => ({ name: s.name ?? "", grn: s.grn ?? "", grade: String(s.grade ?? "6"), section: String(s.section ?? "A"), roll: s.roll ? String(s.roll) : "",
  streamId: classStream(s) || streamFromClassId(s.classId), guardian: s.guardian ?? "", relation: s.relation ?? "Parent", phone: s.phone ?? "", email: s.email ?? "", guardianEmail: s.guardianEmail ?? "", dob: s.dob ?? "", address: s.address ?? "",
  status: s.status ?? "Active", attendance: s.attendance ?? 100 });


export function StudentForm({ edit, existing, users, onClose, onSave, mode = "edit", initial, readyToSave = true }: {
  edit?: Student; existing: StudentRow[]; users: SchoolUser[]; onClose: () => void;
  onSave: (values: StudentDoc, photo?: File, parentLoginEmail?: string) => Promise<void>;
  mode?: "edit" | "add" | "direct" | "enrol";
  initial?: Partial<StudentFormValues>;
  readyToSave?: boolean;
}) {
  const admission = mode === "direct" || mode === "enrol";
  const title = { edit: "Edit Student", add: "Add Student", direct: "New Admission", enrol: "Enrol Student" }[mode];
  const classes = useCollection<AcademicClass>("classes");
  const seats = useCollection<Seat>("adm_seats");
  const applications = useCollection<Application>("adm_applications");
  const offers = useCollection<Offer>("adm_offers");
  const [f, setF] = useState<StudentFormValues>(() => edit ? formOf(edit) : {
    ...blank, ...(admission ? { grade: "", section: "" } : {}), ...initial,
  });
  const [details, setDetails] = useState(() => blankAdmission(todayIso(), initial));
  const location = useAddressLocations(admission ? details.residence.country : "");
  const school = useCollection<{ id: string; academicYear?: string }>("school");
  const numbering = useCollection<AdmissionNumbering>("adm_config");
  const numberConfig = numbering.rows.find((row) => row.id === "numbering") ?? defaultNumbering;
  const manual = numberConfig.mode === "manual";
  const preview = numbering.ready && details.admissionDate
    ? formatAdmissionNumber(numberConfig.template, details.admissionDate, Math.max(numberConfig.start, numberConfig.next ?? numberConfig.start))
    : "";
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [photo, setPhoto] = useState<{ file: File; url?: string }>();
  const [failedPhotoUrl, setFailedPhotoUrl] = useState<string>();
  const photoUrl = photo?.url;
  useEffect(() => {
    if (photoUrl) return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);
  const [parentAccess, setParentAccess] = useState(false);
  const [parentLoginEmail, setParentLoginEmail] = useState("");
  const loginEmail = (admission ? parentAccess : mode === "add") ? normEmail(parentLoginEmail) : "";
  const admissionDetails = { ...details, academicYear: details.academicYear || school.rows.find((row) => row.id === "school")?.academicYear || "" };
  const [err, setErr] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const set = (k: keyof StudentFormValues, v: string | number) => setF((previous) => ({ ...previous, [k]: v,
    ...(k === "grade" && v !== previous.grade ? { streamId: "", section: "" } : {}),
    ...(k === "streamId" && v !== previous.streamId ? { section: "" } : {}),
    ...(["grade", "section", "streamId"].includes(k) && v !== previous[k] ? { roll: "" } : {}),
  }));
  const streams = streamsForGrade(classes.rows, f.grade);
  const sections = classes.rows.filter((row) => row.grade === f.grade && (!isSeniorGrade(f.grade) || classStream(row) === f.streamId)).map((row) => row.section);
  const sectionOptions = [...new Set(sections.length ? sections : isSeniorGrade(f.grade) ? [] : SECTIONS)].sort();
  const displayRoll = edit && studentClassId(edit) === studentClassId(f) ? edit.roll : 0;
  const ready = readyToSave && classes.ready && (!admission || (school.ready && numbering.ready && !location.loading && !location.error)) && (!edit || !isCourseId(f.streamId ?? "") || (seats.ready && applications.ready && offers.ready));
  async function submit() {
    if (saving || !ready) return;
    setSaveError("");
    const primary = admissionDetails.contacts[admissionDetails.primary];
    const fields = admission ? {
      ...f,
      name: [details.firstName, details.middleName, details.lastName].map((part) => part.trim()).filter(Boolean).join(" "),
      guardian: primary.name, phone: primary.phone, email: primary.email, guardianEmail: "",
      relation: admissionDetails.primary === "guardian" ? primary.relationship || "Guardian" : admissionDetails.primary === "father" ? "Father" : "Mother",
      address: addressRecord(details.residence, location.states).address,
    } : f;
    const r = validateStudent({ ...fields, guardianEmail: loginEmail }, { existing, edit, users, today: todayIso(), classes: classes.rows, deferRoll: true, optionalSection: true });
    const errors = { ...r.errors, ...(admission ? admissionErrors(admissionDetails, location.states, f.dob) : {}) };
    if (admission && manual && !validAdmissionNumber(admissionNumber.trim())) errors.admissionNumber = "Enter a valid admission number.";
    if (admission && parentAccess && !loginEmail) errors.guardianEmail = "Enter a login email.";
    setErr(errors);
    if (!r.doc || Object.keys(errors).length) return;
    // Set up the login through the callable after saving the student.
    r.doc.guardianEmail = "";
    if (loginEmail) r.doc.pendingParentLoginEmail = loginEmail;
    if (admission) {
      r.doc.admissionDetails = admissionDetails.admissionType === "Transfer" ? admissionDetails : {
        ...admissionDetails, previousSchool: "", previousAddress: "", previousClass: "", previousBoard: "", previousAdmissionNo: "", previousTcNo: "", performance: "",
      };
      r.doc.requestedAdmissionNumber = admissionNumber.trim();
    }
    const previousStream = edit ? classStream(edit) || streamFromClassId(edit.classId) : "";
    if (edit && r.doc.status === "Active" && isCourseId(r.doc.streamId ?? "") &&
        (edit.status !== "Active" || edit.grade !== r.doc.grade || previousStream !== r.doc.streamId)) {
      const cohort = `${r.doc.grade}-${r.doc.streamId}`;
      const capacity = computeSeatRows(seats.rows.filter((row) => row.grade === cohort), applications.rows, offers.rows, existing)[0];
      if (capacity && capacity.free <= 0) return setErr({ section: "All seats for this course and grade are occupied or reserved." });
    }
    setSaving(true);
    try { await onSave(r.doc, photo?.file, loginEmail || undefined); }
    catch (error) { setSaveError(error instanceof Error ? error.message : "Could not save the student"); }
    finally { setSaving(false); }
  }
  const submitLabel = edit ? "Save Changes" : mode === "direct" ? "Admit Student" : title;
  return (
    <SlideOver open onClose={() => { if (!saving) onClose(); }} title={title} subtitle="Student and guardian details" width={admission ? "max-w-3xl" : "max-w-lg"}
      footer={<><Button variant="ghost" disabled={saving} onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={saving || !ready}>{saving ? "Saving…" : (parentAccess || loginEmail) ? `${submitLabel} and enable parent access` : submitLabel}</Button></>}>
      {saveError && <p role="alert" className="mb-4 text-sm text-error">{saveError}</p>}
      <fieldset disabled={saving} className="grid min-w-0 gap-4 sm:grid-cols-2">
        {!admission && <Field label="Student name" required error={err.name} className="sm:col-span-2"><Input value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>}
        {admission && (manual
          ? <Field label="Admission number" required error={err.admissionNumber}>
              <Input value={admissionNumber} onChange={(e) => setAdmissionNumber(e.target.value)} maxLength={64} />
            </Field>
          : <Field label="Admission number" hint="Preview. The final number is assigned when you save.">
              <Input value={preview} readOnly placeholder={numbering.ready ? "Choose an admission date" : "Loading…"} />
            </Field>)}
        <Field label="General Register Number (GRN)" error={err.grn} hint="Leave blank to generate a General Register Number automatically."><Input value={f.grn} onChange={(e) => set("grn", e.target.value)} /></Field>
        <Field label="Date of birth" required={admission} error={err.dob}><Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></Field>
        <Field label="Grade" required={admission} error={err.grade}><Select value={f.grade} disabled={mode === "enrol"} onChange={(e) => set("grade", e.target.value)}>{admission && <option value="">Select a grade…</option>}{GRADES.map(({ id, label }) => <option key={id} value={id}>{label}</option>)}</Select></Field>
        {isSeniorGrade(f.grade) && <Field label="Stream" required error={err.streamId} hint={!streams.length ? "Configure this class's streams in Classes & Sections first." : undefined}><Select value={f.streamId ?? ""} disabled={mode === "enrol"} onChange={(e) => set("streamId", e.target.value)}><option value="">Select a stream…</option>{streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.name}</option>)}</Select></Field>}
        <Field label="Section" hint="You can assign a section later." error={err.section}><Select value={f.section} onChange={(e) => set("section", e.target.value)}><option value="">Unassigned</option>{sectionOptions.map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <p className="self-end pb-2 text-sm text-on-surface-variant">Roll number: {displayRoll || "Unassigned"}. Assigned by the class teacher.</p>
        {admission && <div className="grid min-w-0 items-start gap-4 sm:col-span-2 sm:grid-cols-2">
          <Field label="Student photograph" hint="Recommended. You can upload this and other documents after admission." className="min-w-0">
            <Input type="file" accept="image/png,image/jpeg" onChange={(event) => {
              const file = event.target.files?.[0];
              const url = file && (file.type === "image/png" || file.type === "image/jpeg") ? URL.createObjectURL(file) : undefined;
              setPhoto(file ? { file, url } : undefined);
            }} />
          </Field>
          {photoUrl && (failedPhotoUrl === photoUrl
            ? <p role="status" className="text-xs text-error">This photo could not be previewed. Choose another image.</p>
            : <Image unoptimized src={photoUrl} width={96} height={96} alt="Selected student photograph"
                className="size-24 rounded-lg border border-outline-variant bg-surface-container-low object-contain"
                onError={() => setFailedPhotoUrl(photoUrl)} />)}
        </div>}
        {admission && <AdmissionDetailsFields value={admissionDetails} onChange={(patch) => setDetails((current) => ({ ...current, ...patch }))} errors={err} saving={saving} location={location} />}
        {!admission && <Field label="Status"><Select value={f.status} onChange={(e) => set("status", e.target.value)}>{[...new Set([f.status, ...STATUS])].map((g) => <option key={g}>{g}</option>)}</Select></Field>}
        {!admission && <Field label="Attendance %" error={err.attendance}><Input type="number" value={f.attendance} onChange={(e) => set("attendance", e.target.value)} /></Field>}
        {!admission && <>
        <h3 className="t-label-caps sm:col-span-2 mt-2 text-on-surface-variant">Guardian</h3>
        <Field label="Guardian name" required error={err.guardian}><Input value={f.guardian} onChange={(e) => set("guardian", e.target.value)} /></Field>
        <Field label="Relation"><Select value={f.relation} onChange={(e) => set("relation", e.target.value)}>{[...new Set([...(f.relation ? [f.relation] : []), "Father", "Mother", "Parent", "Guardian"])].map((g) => <option key={g}>{g}</option>)}</Select></Field>
        <Field label="Phone" required error={err.phone}><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 98xxxxxxxx" /></Field>
        <Field label="Email" error={err.email}><Input value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Address" className="sm:col-span-2"><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        </>}
        {mode !== "edit" && <section className="space-y-3 border-t border-outline-variant pt-4 sm:col-span-2">
          {admission && <div className="flex items-center gap-3">
            <Switch label="Enable parent app access" checked={parentAccess} onChange={(enabled) => {
              setParentAccess(enabled);
              if (!enabled) setParentLoginEmail("");
            }} />
            <span className="text-sm font-semibold">Enable parent app access</span>
          </div>}
          {(!admission || parentAccess) && <>
            <Field label={admission ? "Login email" : "Parent app login email"} required={admission}
              error={err.guardianEmail} className="max-w-md">
              <Input type="email" autoComplete="off" maxLength={254} value={parentLoginEmail}
                onChange={(event) => setParentLoginEmail(event.target.value)} />
            </Field>
            <p className="text-sm text-on-surface-variant">When you save, this email becomes the parent&apos;s username. A new parent account gets a six-digit password. An existing account keeps its password.</p>
          </>}
        </section>}
      </fieldset>
    </SlideOver>
  );
}
