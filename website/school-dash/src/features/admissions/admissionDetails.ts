import { addressErrors, type SchoolAddress } from "@/features/onboarding/address";
import { COUNTRIES, type AddressState } from "@/features/onboarding/locations";
import { validPhone } from "@/features/people/studentLogic";
import { validEmail } from "@/lib/parentAccount";

export const admissionGenders = ["Female", "Male", "Other", "Prefer not to say"];
export const contactTypes = ["father", "mother", "guardian"] as const;
export type ContactType = typeof contactTypes[number];
export type Contact = { name: string; phone: string; email: string; occupation: string; relationship: string; address: string };
export type AdmissionDetails = {
  firstName: string; middleName: string; lastName: string; gender: string; nationality: string; religion: string; motherTongue: string; category: string; caste: string;
  residence: SchoolAddress; contacts: Record<ContactType, Contact>; primary: ContactType; secondary: ContactType | "";
  language: string; emergencyPhone: string; admissionDate: string; academicYear: string; studentType: "Day Scholar" | "Hostel"; admissionType: "New" | "Transfer";
  previousSchool: string; previousAddress: string; previousClass: string; previousBoard: string; previousAdmissionNo: string; previousTcNo: string; performance: string;
  bloodGroup: string; conditions: string; assistance: string;
};
const blankContact = (): Contact => ({ name: "", phone: "", email: "", occupation: "", relationship: "", address: "" });
export function blankAdmission(date: string, initial?: { firstName?: string; lastName?: string; gender?: string; guardian?: string; phone?: string; guardianEmail?: string; relation?: string }): AdmissionDetails {
  return {
    firstName: initial?.firstName ?? "", middleName: "", lastName: initial?.lastName ?? "", gender: initial?.gender ?? "",
    nationality: "", religion: "", motherTongue: "", category: "", caste: "",
    residence: { addressLine1: "", addressLine2: "", country: "IN", state: "", district: "", city: "", pin: "" },
    contacts: { father: blankContact(), mother: blankContact(), guardian: { ...blankContact(), name: initial?.guardian ?? "", phone: initial?.phone ?? "", email: initial?.guardianEmail ?? "", relationship: initial?.relation ?? "" } },
    primary: "guardian", secondary: "", language: "", emergencyPhone: "",
    admissionDate: date, academicYear: "", studentType: "Day Scholar", admissionType: "New",
    previousSchool: "", previousAddress: "", previousClass: "", previousBoard: "", previousAdmissionNo: "", previousTcNo: "", performance: "",
    bloodGroup: "", conditions: "", assistance: "",
  };
}
export function admissionErrors(details: AdmissionDetails, states: AddressState[], dob: string) {
  const errors = addressErrors(details.residence, states);
  if (!details.firstName.trim()) errors.firstName = "Enter the student's first name.";
  if (!details.gender.trim()) errors.gender = "Select a gender.";
  if (!COUNTRIES.some(({ code }) => code === details.nationality)) errors.nationality = "Select a nationality.";
  if (!dob) errors.dob = "Enter a date of birth.";
  if (!details.admissionDate || details.admissionDate < dob) errors.admissionDate = "Enter an admission date on or after the date of birth.";
  if (!["Day Scholar", "Hostel"].includes(details.studentType)) errors.studentType = "Select the student type.";
  if (!["New", "Transfer"].includes(details.admissionType)) errors.admissionType = "Select the admission type.";
  if (!details.academicYear.trim()) errors.academicYear = "Enter the academic year.";
  for (const key of contactTypes) {
    const person = details.contacts[key];
    const required = details.primary === key || details.secondary === key;
    if (key === "guardian" && !required) continue;
    if ((required || Object.values(person).some((value) => value.trim())) && !person.name.trim()) errors[key + "Name"] = "Enter the contact's name.";
    if ((details.primary === key || person.phone.trim()) && !validPhone(person.phone)) errors[key + "Phone"] = "Enter a valid mobile number.";
    if (person.email.trim() && !validEmail(person.email.trim())) errors[key + "Email"] = "Enter a valid email address.";
  }
  if (details.primary === details.secondary) errors.secondary = "Choose a different contact.";
  if (details.emergencyPhone.trim() && !validPhone(details.emergencyPhone)) errors.emergencyPhone = "Enter a valid emergency number.";
  if (details.admissionType === "Transfer" && !details.previousSchool.trim()) errors.previousSchool = "Enter the previous school name.";
  return errors;
}
