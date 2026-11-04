// Pure admissions logic (no React, no Firestore): seat maths, offer/enrolment records, validation, report figures.
// Components and the useAdm() hook in ./lib call these; the unit tests exercise them directly.
import {
  type Application, type AppStatus, type DocKey, type DocState, type Enquiry, type FormField, type FormSection, type Offer,
  type PanelStatus, type Reenrol, type Seat, type Slot, GRADES, GROUPS, SOURCES, studentGrade,
} from "./types";

// ---------- small helpers ----------
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
export const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().slice(0, 10);
/** Next human reference `PREFIX-YYYY-0001`, one above the highest numeric suffix in use (never reuses a number after deletes). */
export const nextRef = (prefix: string, rows: { ref: string }[], start = 1, year = 2026) => {
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.ref ?? "").split("-").pop()) || 0), start - 1);
  return `${prefix}-${year}-${String(max + 1).padStart(4, "0")}`;
};
/** 10–13 digits, optional leading +, spaces/dashes allowed (old regex accepted "----------"). */
export const isPhone = (v: string) => /^\+?[\d\s-]+$/.test(v.trim()) && /^\d{10,13}$/.test(v.replace(/\D/g, ""));
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

export function ageOn(dob: string, ref = new Date()) {
  const d = new Date(dob);
  if (!dob || isNaN(+d)) return null;
  let months = (ref.getFullYear() - d.getFullYear()) * 12 + ref.getMonth() - d.getMonth();
  if (ref.getDate() < d.getDate()) months--;
  return { years: Math.floor(months / 12), months: ((months % 12) + 12) % 12, total: months };
}

/** CSV text: values with a comma, quote, CR or LF are quoted and inner quotes doubled; null/undefined become empty. */
export function csvText(rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map((r) => r.map(esc).join(",")).join("\n");
}

// ---------- seats ----------
export type SeatRow = Seat & { enrolled: number; held: number; free: number; gen: number; rte: number; sib: number; waitlisted: number };
const LIVE: Offer["status"][] = ["pending", "accepted"];

/**
 * One row per configured grade (in GRADES order): enrolled = applications enrolled; held = enrolled + live offers
 * (pending/accepted); free = capacity − held (may be negative if capacity was cut); quota counts cover enrolled + live.
 */
export function computeSeatRows(seats: Seat[], apps: Application[], offers: Offer[]): SeatRow[] {
  return GRADES.map((g) => seats.find((s) => s.grade === g.id)).filter((s): s is Seat => !!s).map((s) => {
    const enrolled = apps.filter((a) => a.grade === s.grade && a.status === "enrolled");
    // an enrolled offer is counted through its application, not twice
    const live = offers.filter((o) => o.grade === s.grade && LIVE.includes(o.status));
    const liveApps = live.map((o) => apps.find((a) => a.id === o.applicationId)).filter((a): a is Application => !!a);
    const all = [...enrolled, ...liveApps];
    const capacity = Number(s.capacity) || 0;
    return {
      ...s, capacity, rteSeats: Number(s.rteSeats) || 0,
      enrolled: enrolled.length, held: enrolled.length + live.length, free: capacity - enrolled.length - live.length,
      gen: all.filter((a) => a.tag === "general" || a.tag === "staff").length, rte: all.filter((a) => a.tag === "rte").length,
      sib: all.filter((a) => a.tag === "sibling").length, waitlisted: apps.filter((a) => a.grade === s.grade && a.status === "waitlisted").length,
    };
  });
}

/** Seat-capacity editor rule: whole numbers, capacity ≥ held (enrolled + live offers), 0 ≤ RTE seats ≤ capacity. "" = valid. */
export function capacityError(held: number, capacity: string, rte: string) {
  const cap = capacity.trim(), r = rte.trim();
  if (cap === "" || !/^\d+$/.test(cap)) return "Capacity must be a whole number";
  if (Number(cap) < held) return `Capacity cannot be below ${held} (enrolled + live offers)`;
  if (r === "" || !/^\d+$/.test(r)) return "RTE seats must be a whole number";
  if (Number(r) > Number(cap)) return "RTE seats cannot exceed capacity";
  return "";
}

/** Waitlist ranking: RTE > sibling > staff ward > general, then written score. */
export const rankValue = (a: Application) => ({ rte: 3, sibling: 2, staff: 1, general: 0 }[a.tag] ?? 0) * 1000 + (a.writtenScore ?? 0);

// ---------- applications ----------
export const docsComplete = (a: Pick<Application, "docs">) => Object.values(a.docs ?? {}).every((s) => s === "verified" || s === "na");
/** Patch for one document state change, moving the application between submitted / docs_pending / verified. */
export function docPatch(a: Application, key: DocKey, state: DocState): Partial<Application> {
  const docs = { ...a.docs, [key]: state };
  const complete = docsComplete({ docs });
  const patch: Partial<Application> = { docs };
  if (complete && (a.status === "submitted" || a.status === "docs_pending")) patch.status = "verified";
  else if (!complete && a.status === "verified") patch.status = "docs_pending";
  else if (!complete && a.status === "submitted" && Object.values(docs).some((s) => s === "verified")) patch.status = "docs_pending";
  return patch;
}

/** Stages the admissions desk may set by hand (offer / enrolment stages are driven by the offer flow). */
export const MANUAL_STATUSES: AppStatus[] = ["submitted", "docs_pending", "verified", "test_scheduled", "tested", "shortlisted", "waitlisted", "rejected"];
/** Why a manual stage move is refused ("" when allowed). */
export function stageMoveError(a: Application, to: AppStatus) {
  if (LOCKED_APP.includes(a.status)) return "This application is managed in Offer & Enrolment";
  if (!MANUAL_STATUSES.includes(to)) return "This stage is set by the offer flow";
  if (to === "verified" && !docsComplete(a)) return "Verify every required document first";
  if (to === "test_scheduled" && !a.testSlotId) return "Assign a test slot under Tests & Interviews first";
  if ((to === "tested" || to === "shortlisted") && a.writtenScore == null) return "Enter the written score under Tests & Interviews first";
  return "";
}
const LOCKED_APP: AppStatus[] = ["offered", "enrolled", "withdrawn", "lapsed"];
/** Statuses an offer can be generated from (Applications detail + Offers "Generate offer"). */
export const OFFERABLE: AppStatus[] = ["verified", "tested", "shortlisted", "waitlisted"];
/** Why an offer cannot be generated ("" when it can). */
export function offerBlocker(a: Application, seatRows: SeatRow[], offers: Offer[]) {
  const seat = seatRows.find((s) => s.grade === a.grade);
  if (!seat) return "No seat matrix configured for this grade";
  if (offers.some((o) => o.applicationId === a.id && LIVE.includes(o.status))) return "An active offer already exists";
  if (seat.free <= 0) return `No free seat in ${GRADES.find((g) => g.id === a.grade)?.label ?? a.grade} — increase capacity or release an offer`;
  return "";
}
/** Offer doc for an application (`ref` from the existing offers, expiry = issue date + validity days, default 7). */
export function buildOffer(a: Application, offers: { ref: string }[], issuedAt: string, validityDays?: number): Omit<Offer, "id"> {
  const days = Number.isInteger(validityDays) && (validityDays as number) > 0 ? (validityDays as number) : 7;
  return {
    ref: nextRef("OFF", offers, 801), applicationId: a.id, name: a.name, guardian: a.guardian, phone: a.phone, grade: a.grade,
    issuedAt, expiresAt: addDays(issuedAt, days), status: "pending", tokenPaid: 0, tokenPaidAt: "", studentId: "", reason: "",
  };
}
/** Token recorded when the parent accepts (config tokenAmount, default ₹50,000; never negative). */
export const tokenFor = (amount?: number) => (typeof amount === "number" && amount >= 0 ? amount : 50000);
/** Whole days from `today` to the offer expiry (negative once expired). */
export const daysLeft = (expiresAt: string, today: string) => Math.ceil((new Date(expiresAt).getTime() - new Date(today).getTime()) / 86400000);

// ---------- tests & interviews ----------
/** Written-score rule: required, a number from 0 to 100 (decimals allowed). "" = valid. */
export function scoreError(score: string) {
  const s = score.trim();
  if (s === "") return "Enter the written score";
  if (!/^\d+(\.\d+)?$/.test(s) || Number(s) > 100) return "Enter a number between 0 and 100";
  return "";
}
const LOCKED: AppStatus[] = ["offered", "enrolled", "withdrawn", "lapsed"];
/** Patch when a result is saved: panel outcome drives the stage unless an offer already decided it; waitlisted gets the next WL number. */
export function resultPatch(a: Application, score: number, panel: PanelStatus, apps: Application[]): Partial<Application> {
  const patch: Partial<Application> = { writtenScore: score, panelStatus: panel };
  if (LOCKED.includes(a.status)) return patch;
  patch.status = panel === "cleared" ? "shortlisted" : panel === "waitlisted" ? "waitlisted" : panel === "rejected" ? "rejected" : "tested";
  if (panel === "waitlisted" && !a.waitlistNo) patch.waitlistNo = apps.filter((x) => x.status === "waitlisted" && x.grade === a.grade).reduce((m, x) => Math.max(m, x.waitlistNo || 0), 0) + 1;
  return patch;
}
export type SlotDraft = { title: string; type: string; date: string; time: string; venue: string; capacity: string; invigilator: string };
/** Slot form rule ("" = valid). */
export function slotError(f: SlotDraft, today: string) {
  if (!f.title.trim() || !f.date || !f.venue.trim()) return "Title, date and venue are required";
  if (f.date < today) return "Date cannot be in the past";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(f.time)) return "Enter a start time (HH:mm)";
  if (!/^\d+$/.test(f.capacity.trim()) || Number(f.capacity) < 1) return "Capacity must be a whole number of at least 1";
  return "";
}
/** Batch label for a new slot: tests BATCH #01…, interviews PANEL A… (counted per type). */
export function slotBatch(type: Slot["type"], slots: Pick<Slot, "type">[]) {
  const n = slots.filter((s) => s.type === type).length + 1;
  return type === "test" ? `BATCH #${String(n).padStart(2, "0")}` : `PANEL ${n <= 26 ? String.fromCharCode(64 + n) : n}`;
}
/** Applications that may be put on a slot: tests take fee-paid verified/doc-pending applicants without a test; interviews take tested/shortlisted. */
export const slotEligible = (slot: Pick<Slot, "type">, apps: Application[]) => apps.filter((a) => slot.type === "test"
  ? ["verified", "docs_pending"].includes(a.status) && !a.testSlotId && a.feePaid
  : ["tested", "shortlisted"].includes(a.status) && !a.interviewSlotId);

// ---------- enrolment → shared `students` (contract section 3) ----------
export type StudentRow = { id: string; name: string; grn?: string; grade: string; section: string; classId?: string; roll?: number; status?: string; offerId?: string };
export type ClassRef = { id: string; grade: string; section: string };
/** contract section 2: `cls_{grade}{SECTION}` */
export const classIdOf = (grade: string, section: string) => `cls_${grade}${section.toUpperCase()}`;
/** Next zero-padded id `stu_001`… above the highest numeric id in use. */
export const nextStudentId = (ids: string[]) => `stu_${String(Math.max(0, ...ids.map((i) => Number(/^stu_(\d+)$/.exec(i)?.[1] ?? 0))) + 1).padStart(3, "0")}`;
/** Next integer roll in a class (students without classId are matched by grade + section). */
export const nextRoll = (students: StudentRow[], classId: string) =>
  Math.max(0, ...students.filter((s) => (s.classId ?? classIdOf(String(s.grade), String(s.section ?? ""))) === classId).map((s) => Number(s.roll) || 0)) + 1;
/** Next GRN `GIS-####` not in use (same scheme as Students & Guardians). */
export function nextGrn(students: Pick<StudentRow, "grn">[], prefix = "GIS") {
  const taken = new Set(students.map((s) => String(s.grn ?? "").trim().toLowerCase()));
  let k = Math.max(8800, ...students.map((s) => Number(String(s.grn ?? "").split("-").pop()) || 0)) + 1;
  while (taken.has(`${prefix.toLowerCase()}-${k}`)) k++;
  return `${prefix}-${k}`;
}
/** Section for a new admission in `grade`: the existing class of that grade with the fewest students (ties: lower letter), else "A". */
export function sectionFor(grade: string, classes: ClassRef[], students: StudentRow[]) {
  const mine = classes.filter((c) => String(c.grade) === grade).sort((a, b) => a.section.localeCompare(b.section));
  if (!mine.length) return "A";
  const size = (c: ClassRef) => students.filter((s) => (s.classId ?? classIdOf(String(s.grade), String(s.section ?? ""))) === c.id).length;
  return mine.reduce((best, c) => (size(c) < size(best) ? c : best)).section.toUpperCase();
}
/** The `students` doc created when an accepted offer is enrolled (contract-exact id, classId, int roll, string grade/section). */
export function enrolmentStudent(o: Offer, a: Application | undefined, e: Enquiry | undefined, students: StudentRow[], classes: ClassRef[], today: string) {
  const grade = studentGrade(o.grade);
  const section = sectionFor(grade, classes, students);
  const classId = classIdOf(grade, section);
  const doc: Record<string, unknown> = {
    id: nextStudentId(students.map((s) => s.id)), name: o.name.trim(), grn: nextGrn(students), grade, section, classId, roll: nextRoll(students, classId),
    guardian: o.guardian, phone: o.phone, status: "Active", attendance: 100, admissionDate: today, offerId: o.id,
  };
  if (a?.dob || e?.dob) doc.dob = a?.dob || e?.dob;
  if (a?.gender) doc.gender = a.gender;
  if (e?.relation) doc.relation = e.relation;
  if (a?.email || e?.email) doc.guardianEmail = (a?.email || e?.email || "").trim();
  return doc as StudentRow & Record<string, unknown> & { id: string; classId: string; roll: number; grn: string };
}

// ---------- form builder & dynamic form ----------
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "field";
const KEY_RE = /^[a-zA-Z][a-zA-Z0-9_]*$/;
/**
 * Field editor rule. Label required; select/radio need ≥ 2 distinct options; the key (given or slugged from the label) must be
 * a valid identifier and unique across the form (other fields' keys in `keys`).
 */
export function validateFieldDef(f: Pick<FormField, "label" | "type" | "key">, optionsText: string, keys: string[], isNew: boolean) {
  const label = f.label.trim();
  if (!label) return { error: "Label is required" } as const;
  const needsOpts = f.type === "select" || f.type === "radio";
  const options: string[] = [];
  for (const o of optionsText.split("\n").map((x) => x.trim()).filter(Boolean)) if (!options.some((x) => x.toLowerCase() === o.toLowerCase())) options.push(o);
  if (needsOpts && options.length < 2) return { error: "Add at least two options (one per line)" } as const;
  const key = (f.key || slug(label)).trim();
  if (!KEY_RE.test(key)) return { error: "Key must start with a letter and use only letters, digits and _" } as const;
  if (keys.includes(key)) {
    if (!isNew || f.key) return { error: `Another field already uses the key "${key}"` } as const;
    let k = 2; while (keys.includes(`${key}_${k}`)) k++;
    return { label, key: `${key}_${k}`, options: needsOpts ? options : undefined } as const;
  }
  return { label, key, options: needsOpts ? options : undefined } as const;
}
/** Answers check for the public / preview form: required, phone, email, Aadhaar (12 digits), no future dates, numbers, options. */
export function validateAnswers(sections: FormSection[], v: Record<string, string>, now = new Date()) {
  const er: Record<string, string> = {};
  const today = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  for (const s of sections) for (const f of s.fields) {
    const val = (v[f.key] ?? "").trim();
    if (f.required && !val) er[f.key] = `${f.label} is required`;
    else if (!val) continue;
    else if (f.type === "tel" && !isPhone(val)) er[f.key] = "Enter a valid mobile number";
    else if (f.type === "email" && !isEmail(val)) er[f.key] = "Enter a valid email address";
    else if (f.key === "aadhaar" && !/^\d{12}$/.test(val.replace(/\s/g, ""))) er[f.key] = "Aadhaar must be 12 digits";
    else if (f.type === "date" && (!/^\d{4}-\d{2}-\d{2}$/.test(val) || isNaN(+new Date(val)))) er[f.key] = "Enter a valid date";
    else if (f.type === "date" && val > today) er[f.key] = "Date cannot be in the future";
    else if (f.type === "number" && isNaN(Number(val))) er[f.key] = "Enter a number";
    else if ((f.type === "select" || f.type === "radio") && f.options?.length && !f.options.includes(val)) er[f.key] = "Choose one of the options";
  }
  return er;
}

// ---------- public form submissions ----------
const digits = (x: string) => (x ?? "").replace(/\D/g, "");
/** phone identity: the last 10 digits, so "+91 98100 00001" and "9810000001" match */
const phoneKey = (x: string) => digits(x).slice(-10);
/** Why a public-form submission is refused ("" when accepted): submission cap, then Aadhaar/DOB or name+phone+DOB duplicate. */
export function submissionBlocker(v: Record<string, string>, enquiries: Enquiry[], cap: number, dedupe: boolean) {
  const web = enquiries.filter((e) => e.source === "Website Form").length;
  if (web >= cap) return "Online submissions are closed for now (cap reached). Please contact the admissions office.";
  if (dedupe) {
    const dup = enquiries.find((e) => e.dob && e.dob === v.dob && ((v.aadhaar && digits(e.answers?.aadhaar ?? "") === digits(v.aadhaar))
      || (e.name.trim().toLowerCase() === (v.name ?? "").trim().toLowerCase() && phoneKey(e.phone) === phoneKey(v.phone ?? ""))));
    if (dup) return `An enquiry for this child already exists (${dup.ref}).`;
  }
  return "";
}
/** Intake telemetry computed from the enquiries themselves (the stored counters are never written by a real visitor). */
export function intakeStats(enquiries: Enquiry[], today: string) {
  const web = enquiries.filter((e) => e.source === "Website Form");
  const hourly = Array<number>(24).fill(0);
  web.forEach((e) => { const h = /T(\d{2}):/.exec(e.submittedTs ?? "")?.[1]; if (h) hourly[Number(h)]!++; });
  return { web: web.length, today: web.filter((e) => e.createdAt === today).length, hourly };
}

// ---------- re-enrolment (derived from the shared students roster) ----------
export type WingId = Reenrol["wing"];
export const wingOf = (grade: string): WingId => {
  const n = Number(String(grade).split("-")[0]);
  if (isNaN(n) || n <= 5) return "pre-primary";
  return n <= 8 ? "middle" : n <= 10 ? "secondary" : "senior";
};
type RosterStudent = { id: string; name: string; grn?: string; grade: string; section: string; guardian?: string; phone?: string; status?: string; bus?: string };
/**
 * One re-enrolment row per active student (overlay doc `adm_reenrolment/{studentId}` holds the campaign answers; defaults pending /
 * fee due). Overlay rows that match no student (older imported campaigns) are kept as they are.
 */
export function reenrolRows(students: RosterStudent[], overlays: (Partial<Reenrol> & { id: string; studentId?: string })[]): Reenrol[] {
  const byStudent = new Map(overlays.map((o) => [o.studentId ?? o.id, o]));
  const active = students.filter((s) => !s.status || s.status === "Active" || s.status === "On leave");
  const ids = new Set(active.map((s) => s.id));
  const rows: Reenrol[] = active.map((s) => {
    const o = byStudent.get(s.id);
    return {
      id: s.id, admNo: s.grn ?? "", name: s.name, grade: String(s.grade), section: String(s.section ?? ""), wing: wingOf(String(s.grade)),
      stream: o?.stream ?? "", transport: o?.transport ?? (s.bus || "Self / Walker"), status: o?.status ?? "pending", fee: o?.fee ?? "due",
      guardian: s.guardian ?? "", phone: s.phone ?? "", reason: o?.reason ?? "", confirmedAt: o?.confirmedAt ?? "",
    };
  });
  const legacy = overlays.filter((o) => !ids.has(o.studentId ?? o.id) && o.name && !students.some((s) => s.id === (o.studentId ?? o.id))) as Reenrol[];
  return [...rows, ...legacy];
}
export type CampaignDraft = { name: string; opensAt: string; closesAt: string; fee: string };
export function campaignErrors(f: CampaignDraft) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Required";
  if (!f.opensAt) e.opensAt = "Required";
  if (!f.closesAt) e.closesAt = "Required"; else if (f.opensAt && f.closesAt < f.opensAt) e.closesAt = "Must be after opening";
  if (!/^\d+$/.test(f.fee.trim())) e.fee = "Enter a whole amount of 0 or more";
  return e;
}

// ---------- reports ----------
const days = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;
export const avg = (xs: number[]) => (xs.length ? Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 10) / 10 : 0);
/** Funnel, stage velocity, source attribution, wing yield and compliance figures for Reports. */
export function admissionsReport(E: Enquiry[], A: Application[], O: Offer[], seatRows: SeatRow[], spend: Record<string, number> = {}) {
  const tested = A.filter((a) => a.testSlotId), enrolled = A.filter((a) => a.status === "enrolled");
  const valid = (x: number) => !isNaN(x) && isFinite(x);
  const e2a = avg(A.map((a) => { const e = E.find((x) => x.id === a.enquiryId); return e ? days(e.createdAt, a.submittedAt) : NaN; }).filter(valid));
  const a2o = avg(O.map((o) => { const a = A.find((x) => x.id === o.applicationId); return a ? days(a.submittedAt, o.issuedAt) : NaN; }).filter(valid));
  const o2e = avg(O.filter((o) => o.tokenPaidAt).map((o) => days(o.issuedAt, o.tokenPaidAt)).filter(valid));
  const known = new Set<string>(SOURCES);
  const sources = [...SOURCES, ...new Set(E.map((e) => e.source).filter((s) => s && !known.has(s)))].map((s) => {
    const leads = E.filter((e) => e.source === s), enr = leads.filter((e) => e.stage === "enrolled").length, sp = Number(spend[s]) || 0;
    return { s, leads: leads.length, enr, conv: pct(enr, leads.length), cac: enr && sp ? Math.round(sp / enr) : 0, sp };
  }).sort((a, b) => b.leads - a.leads);
  const wings = GROUPS.map((g) => { const rs = seatRows.filter((r) => r.group === g.id), cap = rs.reduce((x, r) => x + r.capacity, 0), conf = rs.reduce((x, r) => x + r.enrolled, 0), held = rs.reduce((x, r) => x + r.held, 0), wl = rs.reduce((x, r) => x + r.waitlisted, 0); return { ...g, cap, conf, held, wl, yield: pct(conf, cap) }; });
  const cap = wings.reduce((x, w) => x + w.cap, 0), conf = wings.reduce((x, w) => x + w.conf, 0);
  const spendTotal = Object.values(spend).reduce((x, y) => x + (Number(y) || 0), 0);
  const rteQuota = seatRows.reduce((x, r) => x + r.rteSeats, 0), rteIn = seatRows.reduce((x, r) => x + r.rte, 0);
  const boys = enrolled.filter((a) => a.gender === "Male").length, girls = enrolled.filter((a) => a.gender === "Female").length;
  const sib = enrolled.filter((a) => a.tag === "sibling").length, sibApps = A.filter((a) => a.tag === "sibling").length;
  const month = new Map<string, number>(); A.forEach((a) => { const m = (a.submittedAt ?? "").slice(0, 7); if (m) month.set(m, (month.get(m) ?? 0) + 1); });
  const months = [...month.entries()].sort();
  const funnel = [
    { k: "Inquiries Logged", v: E.length, sub: `Avg ${e2a}d to apply` }, { k: "Applications Submitted", v: A.length, sub: `${pct(A.length, E.length)}% of enquiries` },
    { k: "Tests & Interviews", v: tested.length, sub: `${tested.filter((a) => (a.writtenScore ?? 0) >= 60).length} pass (≥60)` }, { k: "Offers Issued", v: O.length, sub: `Avg ${a2o}d from application` }, { k: "Fee Paid & Enrolled", v: enrolled.length, sub: `Avg ${o2e}d to token` },
  ];
  return { funnel, sources, wings, cap, conf, spendTotal, rteQuota, rteIn, boys, girls, sib, sibApps, months, enrolledN: enrolled.length, tcN: enrolled.filter((a) => a.docs?.tc === "verified").length, e2a, a2o, o2e };
}
/** Headline figures for the pipeline overview. */
export function overviewStats(E: Enquiry[], A: Application[], O: Offer[], seatRows: SeatRow[], appFee: number, today: string) {
  const d30 = addDays(today, -30), d60 = addDays(today, -60);
  const recent = E.filter((e) => e.createdAt >= d30).length, prev = E.filter((e) => e.createdAt >= d60 && e.createdAt < d30).length;
  const scores = A.filter((a) => a.writtenScore != null);
  const accepted = O.filter((o) => o.status === "accepted" || o.status === "enrolled").length;
  return {
    total: E.length, growth: prev ? Math.round(((recent - prev) / prev) * 100) : recent ? 100 : 0,
    unassigned: E.filter((e) => !e.assignee && ["new", "contacted", "campus"].includes(e.stage)).length,
    apps: A.length, conv: pct(A.length, E.length), fees: A.filter((a) => a.feePaid).length * appFee,
    tested: A.filter((a) => a.testSlotId).length, avgScore: avg(scores.map((a) => a.writtenScore ?? 0)),
    offers: O.length, accept: pct(accepted, O.length), waitlist: A.filter((a) => a.status === "waitlisted").length,
    enrolled: A.filter((a) => a.status === "enrolled").length, cap: seatRows.reduce((x, r) => x + r.capacity, 0), token: O.reduce((x, o) => x + (Number(o.tokenPaid) || 0), 0),
  };
}

// ---------- enquiries ----------
export type EnquiryDraft = { name: string; grade: string; dob: string; guardian: string; phone: string; email: string; followUp: string };
/** Log-enquiry form rule (all errors at once; "" keys absent when valid). */
export function enquiryErrors(f: EnquiryDraft, today: string) {
  const e: Record<string, string> = {};
  if (!f.name.trim()) e.name = "Student name is required";
  if (!GRADES.some((g) => g.id === f.grade)) e.grade = "Choose a grade";
  if (!f.dob) e.dob = "Date of birth is required"; else if (f.dob > today) e.dob = "DOB cannot be in the future";
  if (!f.guardian.trim()) e.guardian = "Guardian name is required";
  if (!isPhone(f.phone)) e.phone = "Enter a valid mobile number";
  if (!isEmail(f.email)) e.email = "Enter a valid email";
  if (f.followUp && f.followUp < today) e.followUp = "Follow-up date cannot be in the past";
  return e;
}
