"use client";

import { Field, Input, Select, Switch, Textarea } from "@/components/ui";
import { SchoolAddressFields, useAddressCitySuggestions, useAddressLocations } from "@/features/onboarding/SchoolAddressFields";
import { COUNTRIES } from "@/features/onboarding/locations";
import { admissionGenders, contactTypes, type AdmissionDetails, type ContactType } from "./admissionDetails";
import { GRADES } from "./types";

const contactLabel: Record<ContactType, string> = { father: "Father", mother: "Mother", guardian: "Guardian" };
const heading = "t-label-caps mt-3 text-on-surface-variant sm:col-span-2";
const languages = ["English", "Malayalam", "Hindi", "Tamil", "Kannada", "Telugu", "Urdu", "Bengali", "Marathi", "Gujarati", "Punjabi", "Other"];

export function AdmissionDetailsFields({ value, onChange, errors, saving, location }: {
  value: AdmissionDetails; onChange: (patch: Partial<AdmissionDetails>) => void; errors: Record<string, string>; saving: boolean;
  location: ReturnType<typeof useAddressLocations>;
}) {
  const cities = useAddressCitySuggestions()(value.residence);
  const set = (key: keyof AdmissionDetails, text: string) => onChange({ [key]: text });
  const selectPrimary = (primary: ContactType) => {
    onChange({
      primary,
      secondary: value.secondary === primary || value.secondary === "guardian" ? "" : value.secondary,
    });
  };
  const visibleContacts = contactTypes.filter((key) => key !== "guardian" || value.primary === key);
  const input = (key: keyof AdmissionDetails, label: string, required = false, type = "text") => (
    <Field label={label} required={required} error={errors[key]}><Input type={type} maxLength={120} value={String(value[key])} onChange={(e) => set(key, e.target.value)} /></Field>
  );
  const dropdown = (key: keyof AdmissionDetails, label: string, options: readonly string[], required = false) => (
    <Field label={label} required={required} error={errors[key]}><Select value={String(value[key])} onChange={(e) => set(key, e.target.value)}>
      <option value="">Select…</option>{[...new Set([...options, String(value[key])])].filter(Boolean).map((option) => <option key={option}>{option}</option>)}
    </Select></Field>
  );
  const area = (key: keyof AdmissionDetails, label: string) => (
    <Field label={label} className="sm:col-span-2" error={errors[key]}><Textarea maxLength={1000} value={String(value[key])} onChange={(e) => set(key, e.target.value)} /></Field>
  );
  return <>
    <h3 className={heading}>Student information</h3>
    {input("firstName", "Student first name", true)}{input("middleName", "Middle name")}{input("lastName", "Last name")}
    {dropdown("gender", "Gender", admissionGenders, true)}
    <Field label="Nationality" required error={errors.nationality}><Select value={value.nationality} onChange={(e) => set("nationality", e.target.value)}>
      <option value="">Select nationality…</option>{COUNTRIES.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
    </Select></Field>
    {dropdown("religion", "Religion", ["Hindu", "Muslim", "Christian", "Sikh", "Buddhist", "Jain", "Other", "Prefer not to say"])}
    {dropdown("motherTongue", "Mother tongue", languages)}
    {dropdown("category", "Category (if applicable)", ["General", "SC", "ST", "OBC", "EWS", "Other"])}
    {value.category && input("caste", "Caste (if applicable)")}
    <h3 className={heading}>Student address</h3>
    <div className="sm:col-span-2"><SchoolAddressFields cityOptions={cities} value={value.residence} onChange={(patch) => onChange({ residence: { ...value.residence, ...patch } })}
      errors={errors} {...location} disabled={saving} /></div>
    <h3 className={heading}>Admission information</h3>
    {input("admissionDate", "Admission date", true, "date")}
    {input("academicYear", "Academic year", true)}
    {dropdown("studentType", "Student type", ["Day Scholar", "Hostel"], true)}
    {dropdown("admissionType", "Admission type", ["New", "Transfer"], true)}
    {value.admissionType === "Transfer" && <>
      <h3 className={heading}>Previous school</h3>
      {input("previousSchool", "Previous school name", true)}
      {dropdown("previousBoard", "Previous board", ["CBSE", "ICSE", "State", "Other"])}
      {dropdown("previousClass", "Previous class", [...new Set(GRADES.map(({ label }) => label.split(" (")[0]))])}
      {input("previousAdmissionNo", "Previous admission number")}
      {input("previousTcNo", "Previous TC number")}
      {area("previousAddress", "Previous school address")}{area("performance", "Previous academic performance")}
    </>}
    {visibleContacts.map((key) => <fieldset key={key} className="min-w-0 sm:col-span-2">
      <legend className={heading}>{contactLabel[key]} details</legend>
      {key !== "guardian" && (
        <div className="mt-2 flex items-center gap-3 text-sm">
          <Switch label={`Set ${contactLabel[key].toLowerCase()} as guardian`} checked={value.primary === key}
            onChange={(enabled) => selectPrimary(enabled ? key : "guardian")} />
          <span>Set as guardian</span>
        </div>
      )}
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {(key === "guardian"
          ? [["name", "Guardian name"], ["relationship", "Relationship with student"], ["phone", "Mobile number"], ["email", "Email address"], ["address", "Guardian address"]] as const
          : [["name", "Full name"], ["phone", "Mobile number"], ["email", "Email address"], ["occupation", "Occupation"]] as const
        ).map(([field, label]) => (
          <Field key={field} label={label} error={errors[key + field[0].toUpperCase() + field.slice(1)]}>
            <Input type={field === "phone" ? "tel" : field === "email" ? "email" : "text"} maxLength={field === "email" ? 254 : 200}
              value={value.contacts[key][field]} onChange={(e) => onChange({ contacts: { ...value.contacts, [key]: { ...value.contacts[key], [field]: e.target.value } } })} />
          </Field>
        ))}
      </div>
    </fieldset>)}
    <Field label="Guardian" required><Select value={value.primary} onChange={(e) => selectPrimary(e.target.value as ContactType)}>
      <option value="father">Father</option><option value="mother">Mother</option><option value="guardian">Other guardian</option></Select></Field>
    <Field label="Secondary contact person" error={errors.secondary}><Select value={value.secondary} onChange={(e) => set("secondary", e.target.value)}><option value="">None</option>{visibleContacts.filter((key) => key !== value.primary).map((key) => <option key={key} value={key}>{contactLabel[key]}</option>)}</Select></Field>
    {dropdown("language", "Preferred communication language", languages)}
    {input("emergencyPhone", "Emergency contact number", false, "tel")}
    <h3 className={heading}>Medical and health</h3>
    {dropdown("bloodGroup", "Blood group", ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"])}
    {area("conditions", "Existing medical conditions")}{area("assistance", "Disabilities or special assistance")}
  </>;
}
