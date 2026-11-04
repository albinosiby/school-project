import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** A demo request from the landing page. Written to `leads/{autoId}`; the Firestore rules fix these keys and lengths. */
export interface LeadInput { name: string; school: string; email: string; phone: string; message: string }
export type LeadErrors = Partial<Record<keyof LeadInput, string>>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LIMITS: Record<keyof LeadInput, number> = { name: 120, school: 160, email: 254, phone: 32, message: 2000 };

/** Field errors with the exact messages shown under the inputs; empty when the request can be sent. */
export function validateLead(v: LeadInput): LeadErrors {
  const e: LeadErrors = {};
  const name = v.name.trim(), school = v.school.trim(), email = v.email.trim(), phone = v.phone.trim();
  if (name.length < 2) e.name = "Enter your name.";
  if (school.length < 2) e.school = "Enter your school's name.";
  if (!EMAIL.test(email)) e.email = "Enter a valid email address.";
  if (phone && !/^[+\d][\d\s().-]{5,}$/.test(phone)) e.phone = "Enter a valid phone number.";
  (Object.keys(LIMITS) as (keyof LeadInput)[]).forEach((k) => { if (v[k].trim().length > LIMITS[k] && !e[k]) e[k] = `Keep this under ${LIMITS[k]} characters.`; });
  return e;
}

/** Writes the lead and returns the new document id. Throws on a rules or network failure (the form offers mailto). */
export async function submitLead(v: LeadInput): Promise<string> {
  const ref = await addDoc(collection(db, "leads"), {
    name: v.name.trim(), school: v.school.trim(), email: v.email.trim(), phone: v.phone.trim(), message: v.message.trim(),
    source: "landing", status: "new", createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** The mailto fallback carrying the same details, for when the write fails or the visitor prefers email. */
export function leadMailto(to: string, v: Partial<LeadInput>): string {
  const subject = `Demo request${v.school?.trim() ? ` · ${v.school.trim()}` : ""}`;
  const body = ["Name: " + (v.name ?? ""), "School: " + (v.school ?? ""), "Email: " + (v.email ?? ""), "Phone: " + (v.phone ?? ""), "", v.message ?? ""].join("\n");
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
