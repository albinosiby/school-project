"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import Image from "next/image";
import { LoadingField, LoadingSkeleton, Button, Checkbox, Field, Input, Select, SlideOver, Switch, Textarea, useToast } from "@/components/ui";
import { COUNTRIES } from "@/features/onboarding/locations";
import { SchoolAddressFields, useAddressCitySuggestions, useAddressLocations } from "@/features/onboarding/SchoolAddressFields";
import { useCollection } from "@/lib/useCollection";
import { subjectCatalogId, subjectForSelection, useSchoolSubjects } from "@/lib/schoolSubjects";
import type { StaffRole } from "@/lib/staffRoles";
import type { Staff } from "./StaffView";
import { StaffAppLogin, StaffLoginFields } from "./StaffAppLogin";
import { readProfilePhoto } from "./staffProfilePhoto";
import { defaultEmployeeNumbering, previewEmployeeId, type EmployeeNumbering } from "./employeeNumbering";
import { departmentChoices } from "./departmentChoices";
import {
  appLoginRole, blankQualification, blankStaffLogin, loadStaffProfile, options, saveStaffProfile, setStaffAppLogin,
  staffAddressDraft, staffAddressFields, staffAddressForSave, staffFormError, staffLoginInput, staffProfileDraft,
  type StaffCredentials, type StaffProfile,
} from "./staffProfiles";

const hodDesignation = "Head of Department";
const countryOptions = COUNTRIES.map(({ code, name }) => ({ value: code, label: name }));
const qualificationFields = [
  ["course", "Degree / course"], ["specialization", "Specialization"], ["institution", "Institution / university"],
  ["year", "Year of completion"], ["grade", "Grade / percentage"],
] as const;

type TeacherSubject = { id: string; label: string };
const subjectValue = ({ id, label }: TeacherSubject) => JSON.stringify(id ? ["id", id] : ["name", label]);
const additionalSubjectsOf = (staff: StaffProfile): TeacherSubject[] =>
  staff.additionalSubjects.map((label, index) => ({ id: staff.additionalSubjectIds[index] ?? "", label }));

export function StaffProfileForm({ member, staff, permittedRoles, onClose, initialProfile, createTitle = "Add Staff", enableAppAccessInitially = false }: {
  member?: Staff;
  initialProfile?: Pick<StaffProfile, "category" | "designation">;
  createTitle?: string;
  enableAppAccessInitially?: boolean;
  staff: readonly Staff[];
  permittedRoles: StaffRole[];
  onClose: () => void;
}) {
  const formId = useId();
  const subjectHintId = `${formId}-additional-subjects`;
  const toast = useToast();
  const requestId = useRef("");
  const pending = useRef(false);
  const visit = useRef<AbortController | null>(null);
  const [profile, setProfile] = useState(() => ({ ...staffProfileDraft(member), ...(!member ? initialProfile : {}) }));
  const currentLocations = useAddressLocations(profile.currentAddress.country);
  const permanentLocations = useAddressLocations(profile.sameAddress ? "" : profile.permanentAddress.country);
  const citySuggestions = useAddressCitySuggestions();
  const currentAddress = staffAddressFields(profile.currentAddress, currentLocations.states);
  const permanentAddress = staffAddressFields(profile.permanentAddress, permanentLocations.states);
  const [manualEmployeeId, setManualEmployeeId] = useState(false);
  const [savedProfile, setSavedProfile] = useState<StaffProfile | null>(null);
  const [staffId, setStaffId] = useState(member?.id);
  const [step, setStep] = useState<"profile" | "login">("profile");
  const [linkedEmail, setLinkedEmail] = useState(member?.authUid ? member.email ?? "" : "");
  const [enableAppAccess, setEnableAppAccess] = useState(!member && enableAppAccessInitially);
  const [loginDraft, setLoginDraft] = useState(blankStaffLogin);
  const [issuedCredentials, setIssuedCredentials] = useState<StaffCredentials | null>(null);
  const [loginError, setLoginError] = useState("");
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
  const { subjects: catalog, departments, ready: subjectsReady } = useSchoolSubjects();
  const numbering = useCollection<EmployeeNumbering>("set_config");
  const teaching = profile.category === "Teaching";
  const showDepartment = teaching && departments.length > 0;
  const departmentRequired = showDepartment && [hodDesignation, "HOD"].includes(profile.designation);
  const driver = profile.category === "Non-Teaching" && profile.designation === "Driver";
  const loginRole = appLoginRole(profile, permittedRoles);
  const canChooseEmployeeId = !member?.empId && !savedProfile?.empId;
  const automaticEmployeeId = canChooseEmployeeId && !manualEmployeeId;
  const employeeIdPreview = automaticEmployeeId && numbering.ready ? previewEmployeeId(
    numbering.rows.find((row) => row.id === defaultEmployeeNumbering.id) ?? defaultEmployeeNumbering, staff,
  ) : "";
  const catalogChoices = catalog.filter(({ active }) => active).map((subject) => ({
    id: subjectCatalogId(subject), label: subject.name,
  }));
  const canonicalSubject = (selection: TeacherSubject): TeacherSubject => {
    const subject = subjectForSelection(catalog, selection.label, selection.id);
    return subject ? { id: subjectCatalogId(subject), label: subject.name } : selection;
  };
  const choiceValue = (selection: TeacherSubject) => subjectValue(canonicalSubject(selection));
  const subjects = new Map<string, TeacherSubject>(catalogChoices.map((subject) => [subjectValue(subject), subject]));
  if (savedProfile) {
    const saved = [{ id: savedProfile.primarySubjectId, label: savedProfile.primarySubject }, ...additionalSubjectsOf(savedProfile)];
    for (const subject of saved) {
      const value = choiceValue(subject);
      if (subject.label && !subjects.has(value)) subjects.set(value, canonicalSubject(subject));
    }
  }
  const primarySubjectValue = profile.primarySubject ? choiceValue({ id: profile.primarySubjectId, label: profile.primarySubject }) : "";
  const selectedAdditionalSubjects = new Set(additionalSubjectsOf(profile).map(choiceValue));
  const subjectOptions = [...subjects.entries()].sort(([, a], [, b]) => a.label.localeCompare(b.label));
  const additionalSubjectOptions = subjectOptions.filter(([value]) => value !== primarySubjectValue);

  function changeSubjects(value: string, primary: boolean, checked = false) {
    const subject = subjects.get(value);
    setProfile((current) => {
      const currentPrimary = primary ? value : choiceValue({ id: current.primarySubjectId, label: current.primarySubject });
      const additional = new Map(additionalSubjectsOf(current).map((item) => [choiceValue(item), canonicalSubject(item)]));
      additional.delete(currentPrimary);
      additional.delete(value);
      if (!primary && checked && subject) additional.set(value, subject);
      return {
        ...current,
        ...(primary ? { primarySubject: subject?.label ?? "", primarySubjectId: subject?.id ?? "" } : {}),
        additionalSubjects: [...additional.values()].map(({ label }) => label),
        additionalSubjectIds: [...additional.values()].map(({ id }) => id),
      };
    });
  }

  useLayoutEffect(() => {
    const current = new AbortController();
    visit.current = current;
    return () => {
      current.abort();
      setLoginDraft((draft) => ({ ...draft, password: "" }));
      setIssuedCredentials(null);
    };
  }, []);

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

  function select(key: keyof StaffProfile, label: string, choices: (string | { label: string; value: string })[], required = false,
    placeholder = `Select ${label.toLowerCase()}`) {
    return <Field label={label} required={required} error={errors[key]}>
      <Select value={String(profile[key])} aria-required={required || undefined} onChange={(event) => change(key, event.target.value)}>
        <option value="">{placeholder}</option>
        {choices.map((item) => typeof item === "string" ? <option key={item}>{item}</option>
          : <option key={item.value} value={item.value}>{item.label}</option>)}
      </Select>
    </Field>;
  }

  function address(key: "currentAddress" | "permanentAddress", title: string) {
    const location = key === "currentAddress" ? currentLocations : permanentLocations;
    const value = key === "currentAddress" ? currentAddress : permanentAddress;
    const fieldErrors = Object.fromEntries(Object.entries(errors)
      .filter(([field]) => field.startsWith(`${key}.`))
      .map(([field, error]) => {
        const part = field.slice(key.length + 1);
        return [part === "line1" ? "addressLine1" : part === "line2" ? "addressLine2" : part, error];
      }));
    return <section className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <SchoolAddressFields value={value} {...location} errors={fieldErrors} disabled={saving} required={false}
        legend={title} cityOptions={citySuggestions(value)} postalMaxLength={16}
        onChange={(patch) => change(key, staffAddressDraft({ ...value, ...patch }))} />
    </section>;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current || photoBusy) return;
    if (teaching && !subjectsReady) {
      setSubmitError("Wait for the subject list to load before saving a teaching profile.");
      return;
    }
    if (canChooseEmployeeId && manualEmployeeId && !profile.empId.trim()) {
      setErrors((current) => ({ ...current, empId: "Enter an employee ID." }));
      return;
    }
    if (departmentRequired && !departments.some(({ id }) => id === profile.departmentId)) {
      setErrors((current) => ({ ...current, departmentId: "Choose a department for the Head of Department." }));
      return;
    }
    let login;
    setLoginError("");
    if (enableAppAccess && !linkedEmail) {
      try {
        login = staffLoginInput(loginDraft, loginRole);
      } catch (error) {
        setLoginError(staffFormError(error));
        return;
      }
    }
    const signal = visit.current?.signal;
    pending.current = true;
    setSaving(true);
    setErrors({});
    setSubmitError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    try {
      const current = staffAddressForSave(currentAddress, currentLocations.states);
      const permanent = profile.sameAddress ? current : staffAddressForSave(permanentAddress, permanentLocations.states);
      const savedDriver = savedProfile?.designation === "Driver" ? savedProfile : null;
      const mainSubject = canonicalSubject({ id: profile.primarySubjectId, label: profile.primarySubject });
      const extraSubjects = new Map(additionalSubjectsOf(profile).map((item) => [choiceValue(item), canonicalSubject(item)]));
      extraSubjects.delete(subjectValue(mainSubject));
      const subjectFields = {
        primarySubject: mainSubject.label, primarySubjectId: mainSubject.id,
        additionalSubjects: [...extraSubjects.values()].map(({ label }) => label),
        additionalSubjectIds: [...extraSubjects.values()].map(({ id }) => id),
      };
      const details = driver ? {
        ...profile,
        department: "Transport",
        workExperience: savedDriver?.workExperience ?? "",
        previousOrganization: savedDriver?.previousOrganization ?? "",
        skills: savedDriver?.skills ?? "",
        professionalCertification: savedDriver?.professionalCertification ?? "",
      } : teaching ? { ...profile, ...subjectFields, department: profile.department || "Academics", workShift: "" } : profile;
      const result = await saveStaffProfile({ ...(staffId ? { staffId } : {}), requestId: requestId.current,
        profile: { ...details, currentAddress: current, permanentAddress: permanent },
        ...(photoChanged ? { photo } : {}),
      });
      const saved = { ...details, empId: result.empId };
      setProfile(saved);
      setSavedProfile(saved);
      setStaffId(result.staffId);
      setPhotoChanged(false);
      if (login && !signal?.aborted) {
        setLoginDraft((draft) => ({ ...draft, password: "" }));
        try {
          const credentials = await setStaffAppLogin(result.staffId, login);
          setLinkedEmail(credentials.email);
          if (!signal?.aborted) setIssuedCredentials(credentials);
        } catch (error) {
          setLoginError(`Staff profile saved. ${staffFormError(error)}`);
        }
      }
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

  const designations = teaching
    ? options.teachingDesignations.filter((designation) => designation !== hodDesignation || showDepartment)
    : options.nonTeachingDesignations;
  const currentDesignations = [...new Set([...designations, profile.designation].filter(Boolean))];
  const departmentOptions = departmentChoices(departments, profile.departmentId);
  const close = () => { if (!saving && !loginBusy) onClose(); };

  return <SlideOver open onClose={close} title={member ? "Staff profile" : createTitle} width="max-w-2xl"
    footer={step === "login" ? <>
      <Button variant="ghost" disabled={loginBusy} onClick={() => { setIssuedCredentials(null); setStep("profile"); }}>Back to profile</Button>
      <Button disabled={loginBusy} onClick={close}>Done</Button>
    </> : <>
      <Button variant="ghost" disabled={saving} onClick={close}>Cancel</Button>
      {savedProfile && <Button variant="outline" disabled={saving} onClick={() => setStep("login")}>App login</Button>}
      <Button type="submit" form={formId} disabled={saving || loading || photoBusy || !!loadError || (teaching && !subjectsReady)}>
        {saving ? "Saving…" : enableAppAccess && !linkedEmail ? "Save profile and enable app access" : "Save staff profile"}
      </Button>
    </>}>
    {step === "login" && staffId && savedProfile ? <div className="space-y-5">
      <p className="text-sm text-on-surface-variant">Employee ID {savedProfile.empId}</p>
      <StaffAppLogin staffId={staffId} existingEmail={linkedEmail} onLinked={(email) => { setLinkedEmail(email); setLoginError(""); }}
        role={appLoginRole(savedProfile, permittedRoles)} onBusyChange={setLoginBusy} initialDraft={loginDraft}
        issuedCredentials={issuedCredentials} initialError={loginError} onHidePassword={() => setIssuedCredentials(null)} />
    </div> : loading ? <LoadingSkeleton variant="form" label="Loading staff profile…" />
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
                {photoBusy && <LoadingSkeleton variant="inline" label="Preparing photo…" />}
                {photo && <Button type="button" variant="ghost" size="sm" disabled={photoBusy} onClick={() => {
                  setPhoto(null);
                  setPhotoChanged(true);
                }}>Remove photo</Button>}
              </div>
            </div>
            <div className="space-y-2">
              {automaticEmployeeId ? <Field label="Employee ID" error={errors.empId}
                hint={employeeIdPreview ? "The final ID is assigned when you save." : numbering.ready
                  ? "Check the employee ID pattern in Settings." : undefined}>
                <LoadingField loading={!numbering.ready} label="Loading employee ID…"><Input readOnly value={employeeIdPreview} /></LoadingField>
              </Field> : text("empId", "Employee ID", { required: canChooseEmployeeId })}
              {canChooseEmployeeId && <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={manualEmployeeId} onChange={(event) => {
                  setManualEmployeeId(event.target.checked);
                  change("empId", "");
                  setErrors((current) => ({ ...current, empId: "" }));
                }} />
                Enter employee ID manually
              </label>}
            </div>
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
                setProfile((current) => ({ ...current, category: event.target.value, designation: "", departmentId: "" }))}>
                <option value="">Select staff category</option><option>Teaching</option><option>Non-Teaching</option>
              </Select>
            </Field>
            {select("designation", "Designation", currentDesignations, true)}
            {showDepartment && select("departmentId", "Department", departmentOptions, departmentRequired,
              departmentRequired ? "Select department" : "No department")}
            {teaching && <Field label="Subject" required error={errors.primarySubject} hint="Subjects added during grade and Senior Secondary setup.">
              <LoadingField loading={!subjectsReady} label="Loading subjects…"><Select value={primarySubjectValue} disabled={!subjectsReady} aria-required onChange={(event) => changeSubjects(event.target.value, true)}>
                <option value="">Select subject</option>
                {subjectOptions.map(([value, subject]) => <option key={value} value={value}>{subject.label}</option>)}
              </Select></LoadingField>
            </Field>}
            {teaching && subjectsReady && subjects.size === 0 && <p className="text-sm text-on-surface-variant sm:col-span-2">
              Add a subject during grade or department setup in Settings → Classes &amp; Sections before saving a teaching profile.
            </p>}
            {text("joined", "Joining date", { type: "date", required: true })}
            {select("employmentType", "Employment type", options.employmentTypes, true)}
            {select("employmentStatus", "Employment status", options.employmentStatuses, true)}
            {text("probationMonths", "Probation period (months)", { type: "number" })}
            {profile.category === "Non-Teaching" && select("workShift", "Work shift", options.workShifts)}
            {profile.employmentType === "Contract" && <>
              {text("contractStart", "Contract start date", { type: "date", required: true })}
              {text("contractEnd", "Contract end date", { type: "date", required: true })}
            </>}
          </ProfileSection>

          {teaching ? <ProfileSection title="Teaching details">
            <fieldset disabled={!subjectsReady} className="min-w-0 space-y-2 sm:col-span-2" aria-describedby={subjectHintId}>
              <legend className="text-sm font-semibold">Additional subjects</legend>
              <p id={subjectHintId} className="text-sm text-on-surface-variant">
                {!subjectsReady ? <LoadingSkeleton variant="inline" label="Loading subjects…" /> : additionalSubjectOptions.length ? "Choose any other subjects this teacher can teach." : "No additional subjects are available."}
              </p>
              <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
                {additionalSubjectOptions.map(([value, subject]) => <label key={value} className="flex cursor-pointer items-start gap-2 text-sm">
                  <Checkbox checked={selectedAdditionalSubjects.has(value)} onChange={(event) =>
                    changeSubjects(value, false, event.currentTarget.checked)} />
                  <span className="min-w-0 break-words">{subject.label}</span>
                </label>)}
              </div>
              {errors.additionalSubjects && <p role="alert" className="text-sm text-error">{errors.additionalSubjects}</p>}
            </fieldset>
            {text("teachingExperience", "Teaching experience (years)", { type: "number", required: true })}
            {text("previousSchool", "Previous school")}
            {text("previousDesignation", "Previous designation")}
            {select("tet", "TET / CTET qualified", ["Yes", "No"])}
            {profile.tet === "Yes" && text("tetCertificate", "TET / CTET certificate number")}
            {select("teachingQualification", "B.Ed / D.El.Ed qualification", options.teachingQualifications)}
            {text("specialization", "Specialization")}
          </ProfileSection> : driver ? <ProfileSection title="Driver details">
            {text("licenseNumber", "Driving licence number")}
            {text("licenseExpiry", "Licence expiry date", { type: "date" })}
          </ProfileSection> : profile.category && <ProfileSection title="Non-teaching details">
            {text("workExperience", "Previous work experience (years)", { type: "number" })}
            {text("previousOrganization", "Previous organization")}
            {text("skills", "Relevant skills")}
            {text("professionalCertification", "Professional certification")}
            {text("licenseNumber", "Licence number")}
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

          {!linkedEmail && <section className="space-y-3 rounded-lg border border-outline-variant p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-base font-semibold">Enable app access</h3>
              <Switch label="Enable app access" checked={enableAppAccess} onChange={(checked) => {
                setEnableAppAccess(checked);
                setLoginError("");
                if (!checked) setLoginDraft(blankStaffLogin);
              }} />
            </div>
            {enableAppAccess && <>
              {!loginRole && <p className="text-sm text-on-surface-variant">Choose a staff category and designation in Employment to set the app role.</p>}
              <StaffLoginFields draft={loginDraft} role={loginRole} onChange={setLoginDraft} />
              {loginError && <p role="alert" className="text-sm text-error">{loginError}</p>}
            </>}
          </section>}
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
