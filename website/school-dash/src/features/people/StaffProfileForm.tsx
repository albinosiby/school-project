"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { Button, Field, Input, Select, SlideOver, Textarea, useToast } from "@/components/ui";
import { COUNTRIES } from "@/features/onboarding/locations";
import { useCollection } from "@/lib/useCollection";
import type { StaffRole } from "@/lib/staffRoles";
import type { Staff } from "./StaffView";
import { StaffAppLogin } from "./StaffAppLogin";
import {
  appLoginRoles, blankQualification, loadStaffProfile, options, saveStaffProfile,
  staffFormError, staffProfileDraft, type StaffAddress, type StaffProfile,
} from "./staffProfiles";

const countryOptions = COUNTRIES.map(({ code, name }) => ({ value: code, label: name }));
const addressFields = [
  ["line1", "Address line 1"], ["line2", "Address line 2"], ["state", "State"],
  ["district", "District"], ["city", "City / locality"], ["pin", "PIN / postal code"],
] as const;
const qualificationFields = [
  ["course", "Degree / course"], ["specialization", "Specialization"], ["institution", "Institution / university"],
  ["year", "Year of completion"], ["grade", "Grade / percentage"],
] as const;

export function StaffProfileForm({ member, permittedRoles, initialStep = "profile", onClose }: {
  member?: Staff;
  permittedRoles: StaffRole[];
  initialStep?: "profile" | "login";
  onClose: () => void;
}) {
  const formId = useId();
  const toast = useToast();
  const requestId = useRef("");
  const pending = useRef(false);
  const [profile, setProfile] = useState(() => staffProfileDraft(member));
  const [savedProfile, setSavedProfile] = useState<StaffProfile | null>(null);
  const [staffId, setStaffId] = useState(member?.id);
  const [step, setStep] = useState(initialStep);
  const [linkedEmail, setLinkedEmail] = useState(member?.authUid ? member.email ?? "" : "");
  const [loading, setLoading] = useState(Boolean(member?.profileVersion));
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loginBusy, setLoginBusy] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const classes = useCollection<{ id: string; subjects?: string[] }>("classes");
  const assignments = useCollection<{ id: string; subject?: string }>("assignments");
  const subjects = [...new Set([
    ...classes.rows.flatMap((row) => row.subjects ?? []), ...assignments.rows.map((row) => row.subject ?? ""),
    savedProfile?.primarySubject ?? "", ...(savedProfile?.additionalSubjects ?? []),
  ].map((name) => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  useEffect(() => {
    if (!member?.profileVersion) return;
    let disposed = false;
    loadStaffProfile(member.id).then(({ profile: details, photo }) => {
      if (disposed) return;
      if (!details) throw new Error("The saved profile could not be found.");
      const draft = staffProfileDraft(member, details);
      setProfile(draft);
      setSavedProfile(draft);
      setPhoto(photo);
    }).catch((error: unknown) => {
      if (!disposed) setLoadError(staffFormError(error));
    }).finally(() => {
      if (!disposed) setLoading(false);
    });
    return () => { disposed = true; };
  }, [member, reload]);

  const change = <K extends keyof StaffProfile>(key: K, value: StaffProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));

  function text(key: keyof StaffProfile, label: string, { type = "text", required = false, hint }: {
    type?: string; required?: boolean; hint?: string;
  } = {}) {
    return <Field label={label} required={required} hint={hint} error={errors[key]}>
      <Input type={type} value={String(profile[key])} onChange={(event) => change(key, event.target.value)} />
    </Field>;
  }

  function select(key: keyof StaffProfile, label: string, choices: (string | { label: string; value: string })[], required = false) {
    return <Field label={label} required={required} error={errors[key]}>
      <Select value={String(profile[key])} onChange={(event) => change(key, event.target.value)}>
        <option value="">Select {label.toLowerCase()}</option>
        {choices.map((item) => typeof item === "string" ? <option key={item}>{item}</option>
          : <option key={item.value} value={item.value}>{item.label}</option>)}
      </Select>
    </Field>;
  }

  function address(key: "currentAddress" | "permanentAddress", title: string) {
    function update(part: keyof StaffAddress, value: string) {
      setProfile((current) => ({ ...current, [key]: { ...current[key], [part]: value } }));
    }
    return <ProfileSection title={title}>
      <Field label="Country" error={errors[`${key}.country`]}>
        <Select value={profile[key].country} onChange={(event) => update("country", event.target.value)}>
          <option value="">Select country</option>
          {countryOptions.map(({ label, value }) => <option key={value} value={value}>{label}</option>)}
        </Select>
      </Field>
      {addressFields.map(([part, label]) => <Field key={part} label={label} error={errors[`${key}.${part}`]}>
        <Input value={profile[key][part]} onChange={(event) => update(part, event.target.value)} />
      </Field>)}
    </ProfileSection>;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || photoBusy) return;
    pending.current = true;
    setSaving(true);
    setErrors({});
    setSubmitError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const result = await saveStaffProfile({ ...(staffId ? { staffId } : {}), requestId: requestId.current, profile,
        ...(photoChanged ? { photo } : {}),
      });
      const saved = { ...profile, empId: result.empId };
      setProfile(saved);
      setSavedProfile(saved);
      setStaffId(result.staffId);
      setPhotoChanged(false);
      setStep("login");
      toast("Staff profile saved.");
    } catch (error) {
      const fields = (error as { details?: { fields?: Record<string, string> } } | null)?.details?.fields;
      if (fields) setErrors(fields);
      setSubmitError(staffFormError(error));
    } finally {
      pending.current = false;
      setSaving(false);
    }
  }

  async function choosePhoto(file: File) {
    setPhotoBusy(true);
    setErrors((current) => ({ ...current, photo: "" }));
    try {
      setPhoto(await readProfilePhoto(file));
      setPhotoChanged(true);
    } catch (error) {
      setErrors((current) => ({ ...current, photo: staffFormError(error) }));
    } finally {
      setPhotoBusy(false);
    }
  }

  const teaching = profile.category === "Teaching";
  const designations = teaching ? options.teachingDesignations : options.nonTeachingDesignations;
  const currentDesignations = [...new Set([...designations, profile.designation].filter(Boolean))];
  const departments = [...new Set([...options.departments, profile.department].filter(Boolean))].sort();
  const close = () => { if (!saving && !loginBusy) onClose(); };

  return <SlideOver open onClose={close} title={member ? "Staff profile" : "Add Staff"} width="max-w-2xl"
    footer={step === "login" ? <>
      <Button variant="ghost" disabled={loginBusy} onClick={() => setStep("profile")}>Back to profile</Button>
      <Button disabled={loginBusy} onClick={close}>Done</Button>
    </> : <>
      <Button variant="ghost" disabled={saving} onClick={close}>Cancel</Button>
      {savedProfile && <Button variant="outline" disabled={saving} onClick={() => setStep("login")}>App login</Button>}
      <Button type="submit" form={formId} disabled={saving || loading || photoBusy || !!loadError}>{saving ? "Saving…" : "Save staff profile"}</Button>
    </>}>
    {step === "login" && staffId && savedProfile ? <div className="space-y-5">
      <p className="text-sm text-on-surface-variant">Employee ID {savedProfile.empId}</p>
      <StaffAppLogin staffId={staffId} existingEmail={linkedEmail} onLinked={setLinkedEmail}
        roles={appLoginRoles(savedProfile, permittedRoles)} onBusyChange={setLoginBusy} />
    </div> : loading ? <p role="status">Loading staff profile…</p>
      : loadError ? <div className="space-y-2"><p role="alert">{loadError}</p>
        <Button onClick={() => { setLoading(true); setLoadError(""); setReload((count) => count + 1); }}>Try again</Button></div>
      : <form id={formId} noValidate onSubmit={save}>
        <fieldset disabled={saving} className="min-w-0 space-y-6">
          <ProfileSection title="Basic information">
            <div className="flex flex-wrap items-start gap-3 sm:col-span-2">
              {photo && <Image src={photo} alt="Staff profile photo" width={80} height={80} unoptimized className="size-20 rounded-lg object-cover" />}
              <div className="space-y-2">
                <Field label="Profile photo" hint="JPEG, PNG or WebP, up to 8 MB." error={errors.photo}>
                  <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={photoBusy} onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) void choosePhoto(file);
                  }} />
                </Field>
                {photoBusy && <p role="status" className="text-sm">Preparing photo…</p>}
                {photo && <Button type="button" variant="ghost" size="sm" disabled={photoBusy} onClick={() => {
                  setPhoto(null);
                  setPhotoChanged(true);
                }}>Remove photo</Button>}
              </div>
            </div>
            {text("empId", "Employee ID", { hint: "Leave blank to use the employee ID pattern in Settings." })}
            {text("firstName", "First name", { required: true })}
            {text("middleName", "Middle name")}
            {text("lastName", "Last name", { required: true })}
            {text("birthDate", "Date of birth", { type: "date", required: true })}
            {select("gender", "Gender", options.genders, true)}
            {select("nationality", "Nationality", countryOptions, true)}
            {select("bloodGroup", "Blood group", options.bloodGroups)}
            {select("maritalStatus", "Marital status", options.maritalStatuses)}
            {text("phone", "Mobile number", { type: "tel", required: true })}
            {text("alternatePhone", "Alternate mobile", { type: "tel" })}
            {text("contactEmail", "Contact email", { type: "email" })}
          </ProfileSection>

          {address("currentAddress", "Current address")}
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={profile.sameAddress} onChange={(event) => change("sameAddress", event.target.checked)} />
            Permanent address is the same as current address
          </label>
          {!profile.sameAddress && address("permanentAddress", "Permanent address")}

          <ProfileSection title="Employment">
            <Field label="Staff category" required error={errors.category}>
              <Select value={profile.category} onChange={(event) =>
                setProfile((current) => ({ ...current, category: event.target.value, designation: "" }))}>
                <option value="">Select staff category</option><option>Teaching</option><option>Non-Teaching</option>
              </Select>
            </Field>
            {select("designation", "Designation", currentDesignations, true)}
            {select("department", "Department", departments, true)}
            {text("joined", "Joining date", { type: "date", required: true })}
            {select("employmentType", "Employment type", options.employmentTypes, true)}
            {select("employmentStatus", "Employment status", options.employmentStatuses, true)}
            {text("probationMonths", "Probation period (months)", { type: "number" })}
            {select("workShift", "Work shift", options.workShifts)}
            {profile.employmentType === "Contract" && <>
              {text("contractStart", "Contract start date", { type: "date", required: true })}
              {text("contractEnd", "Contract end date", { type: "date", required: true })}
            </>}
          </ProfileSection>

          {teaching ? <ProfileSection title="Teaching details">
            {select("teachingLevel", "Teaching level", options.teachingLevels, true)}
            {select("primarySubject", "Primary subject", subjects, true)}
            {subjects.length === 0 && <p className="text-sm text-on-surface-variant sm:col-span-2">
              Add subjects in Classes &amp; Assignments before saving a teaching profile.
            </p>}
            <Field label="Additional subjects" error={errors.additionalSubjects} hint="Select any other subjects this staff member can teach.">
              <Select multiple className="h-auto py-2" size={Math.min(5, Math.max(2, subjects.length))} value={profile.additionalSubjects}
                onChange={(event) => change("additionalSubjects", Array.from(event.target.selectedOptions, (option) => option.value))}>
                {subjects.filter((subject) => subject !== profile.primarySubject).map((subject) => <option key={subject}>{subject}</option>)}
              </Select>
            </Field>
            {text("teachingExperience", "Teaching experience (years)", { type: "number", required: true })}
            {text("previousSchool", "Previous school")}
            {text("previousDesignation", "Previous designation")}
            {select("tet", "TET / CTET qualified", ["Yes", "No"])}
            {profile.tet === "Yes" && text("tetCertificate", "TET / CTET certificate number")}
            {select("teachingQualification", "B.Ed / D.El.Ed qualification", options.teachingQualifications)}
            {text("specialization", "Specialization")}
          </ProfileSection> : profile.category && <ProfileSection title="Non-teaching details">
            {text("workExperience", "Previous work experience (years)", { type: "number" })}
            {text("previousOrganization", "Previous organization")}
            {text("skills", "Relevant skills")}
            {text("professionalCertification", "Professional certification")}
            {text("licenseNumber", profile.designation === "Driver" ? "Driving licence number" : "Licence number")}
            {profile.designation === "Driver" && <>
              {text("licenseType", "Licence type")}
              {text("licenseExpiry", "Licence expiry date", { type: "date" })}
              {text("vehicleCategory", "Vehicle category")}
            </>}
          </ProfileSection>}

          <section className="space-y-3">
            <h3 className="text-base font-semibold">Qualifications</h3>
            {profile.qualifications.map((row, index) => {
              const update = (key: keyof typeof row, value: string) => change("qualifications",
                profile.qualifications.map((item, i) => i === index ? { ...item, [key]: value } : item));
              return <div key={index} className="rounded-lg border border-outline-variant p-4">
                <ProfileSection title={`Qualification ${index + 1}`}>
                  <Field label="Qualification level" error={errors[`qualifications.${index}.level`]}>
                    <Select value={row.level} onChange={(event) => update("level", event.target.value)}>
                      <option value="">Select level</option>
                      {options.qualificationLevels.map((level) => <option key={level}>{level}</option>)}
                    </Select>
                  </Field>
                  {qualificationFields.map(([key, label]) => <Field key={key} label={label} required={key === "course"}
                    error={errors[`qualifications.${index}.${key}`]}>
                    <Input value={row[key]} onChange={(event) => update(key, event.target.value)} />
                  </Field>)}
                </ProfileSection>
                <Button type="button" variant="ghost" size="sm" className="mt-3"
                  onClick={() => change("qualifications", profile.qualifications.filter((_, i) => i !== index))}>Remove qualification {index + 1}</Button>
              </div>;
            })}
            <Button type="button" variant="outline" size="sm" disabled={profile.qualifications.length >= 20}
              onClick={() => change("qualifications", [...profile.qualifications, { ...blankQualification }])}>Add qualification</Button>
          </section>

          <ProfileSection title="Emergency contact">
            {([["name", "Contact person name", true], ["relationship", "Relationship", true],
              ["mobile", "Emergency mobile number", true], ["alternate", "Alternate number", false]] as const).map(([key, label, required]) =>
              <Field key={key} label={label} required={required} error={errors[`emergency.${key}`]}>
                <Input type={key === "mobile" || key === "alternate" ? "tel" : "text"} value={profile.emergency[key]}
                  onChange={(event) => change("emergency", { ...profile.emergency, [key]: event.target.value })} />
              </Field>)}
            <Field label="Emergency contact address" className="sm:col-span-2" error={errors["emergency.address"]}>
              <Textarea rows={2} value={profile.emergency.address}
                onChange={(event) => change("emergency", { ...profile.emergency, address: event.target.value })} />
            </Field>
          </ProfileSection>
        </fieldset>
        {submitError && <p role="alert" className="mt-4 text-sm text-error">{submitError}</p>}
      </form>}
  </SlideOver>;
}

function ProfileSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-3">
    <h3 className="text-base font-semibold">{title}</h3>
    <div className="grid gap-4 sm:grid-cols-2">{children}</div>
  </section>;
}

async function readProfilePhoto(file: File) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 8 * 1024 * 1024) {
    throw new Error("Choose a JPEG, PNG or WebP image under 8 MB.");
  }
  const bitmap = await createImageBitmap(file).catch(() => { throw new Error("This image could not be opened."); });
  try {
    const scale = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the photo.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL("image/jpeg", 0.8);
    if (!photo.startsWith("data:image/jpeg;") || photo.length > 160_000) throw new Error("Choose a smaller photo.");
    return photo;
  } finally {
    bitmap.close();
  }
}
