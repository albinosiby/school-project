// The class teacher's view of a student's admission record (functions/classTeacherStudents.js getClassStudentDetails /
// updateClassStudentDetails, mirrored by the teacher app's models/student_details.dart). Only the fields below are
// read from the callable's answer, so nothing else (caste, category, religion, bank details) can ever be shown.
// Editable: contacts (father / mother / guardian, primary / second contact, emergency number), home address, health.

export const CONTACT_KINDS = ["father", "mother", "guardian"] as const;
export type ContactKind = (typeof CONTACT_KINDS)[number];
export const CONTACT_LABELS: Record<ContactKind, string> = { father: "Father", mother: "Mother", guardian: "Guardian" };
export const BLOOD_GROUPS = ["", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export type Contact = { name: string; phone: string; email: string; occupation: string; relationship: string; address: string };
export type Residence = { addressLine1: string; addressLine2: string; city: string; district: string; state: string; pin: string; country: string };
export type StudentDetails = {
  exists: boolean; gender: string; dob: string; email: string; nationality: string; motherTongue: string; language: string;
  residence: Residence; address: string; contacts: Record<ContactKind, Contact>; primary: ContactKind; secondary: ContactKind | "";
  emergencyPhone: string; admissionDate: string; admissionNumber: string; academicYear: string; studentType: string; admissionType: string;
  previousSchool: string; previousClass: string; previousBoard: string; bloodGroup: string; conditions: string; assistance: string;
  bus: string; busStop: string; stream: string; status: string; updatedAt: string;
};

const s = (v: unknown) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");
const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const CONTACT_FIELDS = ["name", "phone", "email", "occupation", "relationship", "address"] as const;
const RESIDENCE_FIELDS = ["addressLine1", "addressLine2", "city", "district", "state", "pin", "country"] as const;
const isKind = (v: unknown): v is ContactKind => CONTACT_KINDS.includes(v as ContactKind);

const contactOf = (v: unknown): Contact => { const o = obj(v); return Object.fromEntries(CONTACT_FIELDS.map((k) => [k, s(o[k])])) as Contact; };

/** the callable's answer as a typed record (whitelisted fields only) */
export function parseDetails(data: unknown): StudentDetails {
  const d = obj(data), contacts = obj(d.contacts), residence = obj(d.residence);
  const primary = isKind(d.primary) ? d.primary : "guardian";
  const secondary = isKind(d.secondary) && d.secondary !== primary ? d.secondary : "";
  return {
    exists: d.exists === true, gender: s(d.gender), dob: s(d.dob), email: s(d.email), nationality: s(d.nationality), motherTongue: s(d.motherTongue), language: s(d.language),
    residence: Object.fromEntries(RESIDENCE_FIELDS.map((k) => [k, s(residence[k])])) as Residence, address: s(d.address),
    contacts: Object.fromEntries(CONTACT_KINDS.map((k) => [k, contactOf(contacts[k])])) as Record<ContactKind, Contact>, primary, secondary,
    emergencyPhone: s(d.emergencyPhone), admissionDate: s(d.admissionDate), admissionNumber: s(d.admissionNumber), academicYear: s(d.academicYear),
    studentType: s(d.studentType), admissionType: s(d.admissionType), previousSchool: s(d.previousSchool), previousClass: s(d.previousClass), previousBoard: s(d.previousBoard),
    bloodGroup: s(d.bloodGroup), conditions: s(d.conditions), assistance: s(d.assistance), bus: s(d.bus), busStop: s(d.busStop), stream: s(d.stream),
    status: s(d.status) || "Active", updatedAt: s(d.updatedAt),
  };
}

export const contactEmpty = (c: Contact) => !c.name && !c.phone && !c.email;
/** recorded contacts, the primary one first */
export const filledContacts = (d: Pick<StudentDetails, "contacts" | "primary">) =>
  [d.primary, ...CONTACT_KINDS.filter((k) => k !== d.primary)].filter((k) => !contactEmpty(d.contacts[k])).map((k) => ({ kind: k, contact: d.contacts[k] }));
/** who a contact is ("Father", or the guardian's relationship) */
export const contactTitle = (kind: ContactKind, c: Contact) => (kind === "guardian" && c.relationship ? c.relationship : CONTACT_LABELS[kind]);

/** the address on one line: the admission record's residence, else the student's address */
export function homeAddress(d: Pick<StudentDetails, "residence" | "address">) {
  const r = d.residence;
  const line = [r.addressLine1, r.addressLine2, r.city, r.district, r.state, r.pin].filter(Boolean).join(", ");
  return line || d.address;
}

/** age in whole years on `today` from a YYYY-MM-DD birth date (null when unknown) */
export function ageOn(dob: string, today: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) return null;
  const [y, m, d] = dob.split("-").map(Number), [ty, tm, td] = today.split("-").map(Number);
  const age = ty! - y! - (tm! < m! || (tm === m && td! < d!) ? 1 : 0);
  return age >= 0 && age < 120 ? age : null;
}

// ---- validation (the callable's own checks, so the teacher sees them before sending) --------------------------------

export const validPhone = (p: string) => /^\+?[\d\s-]+$/.test(p.trim()) && /^\d{10,15}$/.test(p.replace(/[\s+-]/g, ""));
export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export type ContactsForm = { contacts: Record<ContactKind, Contact>; primary: ContactKind; secondary: ContactKind | ""; emergencyPhone: string };
export const contactsFormOf = (d: StudentDetails): ContactsForm => ({ contacts: structuredClone(d.contacts), primary: d.primary, secondary: d.secondary, emergencyPhone: d.emergencyPhone });

/** why the contacts cannot be saved ("" when they can) */
export function contactsError(f: ContactsForm) {
  for (const k of CONTACT_KINDS) {
    const c = f.contacts[k];
    if (c.phone.trim() && !validPhone(c.phone)) return `Enter a valid mobile number for the ${k}.`;
    if (c.email.trim() && !validEmail(c.email)) return `Enter a valid email for the ${k}.`;
    if ((c.phone.trim() || c.email.trim()) && !c.name.trim()) return `Enter the ${k}'s name.`;
  }
  if (f.secondary && f.secondary === f.primary) return "Choose a different second contact.";
  const main = f.contacts[f.primary];
  if (!main.name.trim() || !validPhone(main.phone)) return "The primary contact needs a name and a valid mobile number.";
  if (f.emergencyPhone.trim() && !validPhone(f.emergencyPhone)) return "Enter a valid emergency number.";
  return "";
}

const trimContact = (c: Contact): Contact => Object.fromEntries(CONTACT_FIELDS.map((k) => [k, c[k].trim()])) as Contact;
const sameContact = (a: Contact, b: Contact) => CONTACT_FIELDS.every((k) => a[k] === b[k]);

/** the update input for contacts: only changed contacts are sent, plus primary / second contact and the emergency number */
export function contactsPatch(before: StudentDetails, f: ContactsForm) {
  const contacts: Partial<Record<ContactKind, Contact>> = {};
  CONTACT_KINDS.forEach((k) => { const next = trimContact(f.contacts[k]); if (!sameContact(next, before.contacts[k])) contacts[k] = next; });
  return { ...(Object.keys(contacts).length ? { contacts } : {}), primary: f.primary, secondary: f.secondary, emergencyPhone: f.emergencyPhone.trim() };
}

export type AddressForm = Omit<Residence, "country">;
export const addressFormOf = (d: StudentDetails): AddressForm => ({ addressLine1: d.residence.addressLine1, addressLine2: d.residence.addressLine2, city: d.residence.city, district: d.residence.district, state: d.residence.state, pin: d.residence.pin });
export const addressError = (f: AddressForm) => (f.pin.trim() && !/^[0-9A-Za-z -]{3,10}$/.test(f.pin.trim()) ? "Enter a valid PIN code." : "");
export const addressPatch = (before: StudentDetails, f: AddressForm) => ({
  residence: { ...Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.trim()])), country: before.residence.country || "IN" } as Residence,
});

export type HealthForm = { bloodGroup: string; conditions: string; assistance: string };
export const healthFormOf = (d: StudentDetails): HealthForm => ({ bloodGroup: d.bloodGroup, conditions: d.conditions, assistance: d.assistance });
export function healthError(f: HealthForm) {
  if (!BLOOD_GROUPS.includes(f.bloodGroup)) return "Choose a blood group.";
  if (f.conditions.length > 1000 || f.assistance.length > 1000) return "Notes are at most 1000 characters.";
  return "";
}
export const healthPatch = (f: HealthForm) => ({ bloodGroup: f.bloodGroup, conditions: f.conditions.trim(), assistance: f.assistance.trim() });

export type DetailsPatch = ReturnType<typeof contactsPatch> | ReturnType<typeof addressPatch> | ReturnType<typeof healthPatch>;
