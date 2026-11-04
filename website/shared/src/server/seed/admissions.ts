// Admissions module seed. All rows are generated deterministically so volumes match the design:
// 420 enquiries -> 185 applications -> 78 offers -> 62 enrolled; seat capacities 28/30, 18/30, 12/35, 4/25.
import type { Seed } from "./index";

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const R = rng(2026);
const pick = <T,>(a: readonly T[]): T => a[Math.floor(R() * a.length)]!;
const int = (lo: number, hi: number) => lo + Math.floor(R() * (hi - lo + 1));
function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [r[i], r[j]] = [r[j]!, r[i]!]; }
  return r;
}
const pad = (n: number, w = 4) => String(n).padStart(w, "0");
const addDays = (iso: string, d: number) => new Date(new Date(iso).getTime() + d * 86400000).toISOString().slice(0, 10);

const BOYS = ["Aarav", "Vihaan", "Reyansh", "Aryan", "Arjun", "Ishaan", "Kabir", "Rohan", "Siddharth", "Devansh", "Advait", "Dhruv", "Krish", "Neil", "Yash", "Rudra", "Atharv", "Veer", "Shaurya", "Ayaan"];
const GIRLS = ["Ananya", "Aadhya", "Diya", "Meera", "Kavya", "Tanvi", "Saanvi", "Ira", "Myra", "Navya", "Anika", "Riya", "Pari", "Samaira", "Aditi", "Kiara", "Zara", "Ishita", "Mahika", "Tara"];
const LAST = ["Sharma", "Verma", "Gupta", "Mehta", "Nair", "Iyer", "Singh", "Kapoor", "Joshi", "Patel", "Kulkarni", "Deshmukh", "Seth", "Rao", "Krishnan", "Menon", "Banerjee", "Das", "Reddy", "Malhotra"];
const FATHERS = ["Rajesh", "Vikram", "Amit", "Sanjay", "Praveen", "Rakesh", "Suresh", "Manoj", "Anil", "Deepak", "Ramesh", "Nitin"];
const MOTHERS = ["Meenakshi", "Priya", "Sunita", "Ritu", "Sharmila", "Kavita", "Neha", "Pooja", "Anjali", "Divya"];
const AREAS = ["Indiranagar", "Koramangala", "Whitefield", "Jayanagar", "HSR Layout", "Hebbal", "Yelahanka", "Malleshwaram", "Banashankari", "Marathahalli"];
const PRESCHOOLS = ["Little Millennium Pre-School", "Kidzee", "Euro Kids", "Podar Jumbo Kids", "Bachpan Play School", "Orchids International", "Delhi Public School", "Vidya Niketan", "St. Mary's Junior", "Home schooled"];
const SOURCES = ["Walk-In", "Phone Call", "Referral", "Website Form", "Edu Fair 2026", "Google Search", "Social Ad"] as const;
const STAFF = ["Ananya Sen", "Vikram Das", "Priya Das", "Rahul Menon"];
const PANELISTS = ["Dr. Anita Mehra", "Mrs. S. Rao", "Prof. M. K. Sen"];
const LOST_REASONS = ["Chose another school", "Fee too high", "Relocated out of city", "Seat not available", "No response", "Distance / transport"];

const GRADES = [
  { id: "Nursery", cap: 10, enr: 10, wl: 8, group: "pre" },
  { id: "LKG", cap: 10, enr: 9, wl: 5, group: "pre" },
  { id: "UKG", cap: 10, enr: 9, wl: 4, group: "pre" },
  { id: "1", cap: 8, enr: 5, wl: 3, group: "primary" },
  { id: "2", cap: 6, enr: 4, wl: 2, group: "primary" },
  { id: "3", cap: 6, enr: 3, wl: 0, group: "primary" },
  { id: "4", cap: 5, enr: 3, wl: 0, group: "primary" },
  { id: "5", cap: 5, enr: 3, wl: 0, group: "primary" },
  { id: "6", cap: 6, enr: 4, wl: 4, group: "middle" },
  { id: "7", cap: 8, enr: 3, wl: 3, group: "middle" },
  { id: "8", cap: 10, enr: 3, wl: 0, group: "middle" },
  { id: "9", cap: 11, enr: 2, wl: 4, group: "middle" },
  { id: "11-Science", cap: 15, enr: 3, wl: 3, group: "senior" },
  { id: "11-Commerce", cap: 10, enr: 1, wl: 0, group: "senior" },
];
const groupOf = (g: string) => GRADES.find((x) => x.id === g)!.group;
const PENDING_OFFER_GRADES = ["LKG", "1", "1", "2", "6", "6", "7", "11-Science"];

// ---------- application plan ----------
type Plan = { status: string; grade: string };
const plan: Plan[] = [];
for (const g of GRADES) for (let i = 0; i < g.enr; i++) plan.push({ status: "enrolled", grade: g.id });
for (const g of PENDING_OFFER_GRADES) plan.push({ status: "offered", grade: g });
for (const g of GRADES) for (let i = 0; i < g.wl; i++) plan.push({ status: "waitlisted", grade: g.id });
const GW = ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "11-Science", "11-Commerce"];
const rest = [["withdrawn", 4], ["lapsed", 4], ["submitted", 10], ["docs_pending", 28], ["verified", 15], ["test_scheduled", 9], ["tested", 5], ["shortlisted", 4]] as const;
for (const [s, n] of rest) for (let i = 0; i < n; i++) plan.push({ status: s, grade: pick(GW) });

const dayBase: Record<string, [number, number]> = {
  enrolled: [0, 35], offered: [30, 55], waitlisted: [25, 60], withdrawn: [10, 40], lapsed: [10, 40],
  tested: [50, 75], shortlisted: [50, 75], test_scheduled: [60, 85], verified: [65, 90], docs_pending: [70, 95], submitted: [85, 99],
};
const FIRST_DAY = "2026-07-12";

const slotFor = (status: string, grade: string) => {
  if (status === "test_scheduled") return "adm_slot_4";
  const g = groupOf(grade);
  return g === "pre" || g === "primary" ? "adm_slot_1" : g === "middle" ? "adm_slot_2" : "adm_slot_3";
};

type App = Record<string, unknown> & { id: string };
const apps: App[] = [];
plan.forEach((p, i) => {
  const female = R() < 0.48;
  const first = female ? pick(GIRLS) : pick(BOYS);
  const last = pick(LAST);
  const parentFirst = R() < 0.55 ? pick(FATHERS) : pick(MOTHERS);
  const [lo, hi] = dayBase[p.status]!;
  const submittedAt = addDays(FIRST_DAY, int(lo, hi));
  const tagR = R();
  const tag = tagR < 0.62 ? "general" : tagR < 0.8 ? "rte" : tagR < 0.94 ? "sibling" : "staff";
  const docs = { birth: "verified", idProof: "verified", immunisation: "verified", tc: "verified" } as Record<string, string>;
  if (p.status === "submitted") for (const k of Object.keys(docs)) docs[k] = "pending";
  if (p.status === "docs_pending") {
    docs.birth = "verified";
    docs.idProof = pick(["verified", "pending"]); docs.immunisation = pick(["pending", "pending", "verified"]); docs.tc = pick(["pending", "verified"]);
    if (!Object.values(docs).includes("pending")) docs.immunisation = "pending";
  }
  if (["pre", "primary"].includes(groupOf(p.grade)) && (p.grade === "Nursery" || p.grade === "LKG" || p.grade === "UKG" || p.grade === "1")) docs.tc = p.status === "docs_pending" && docs.tc === "pending" ? "pending" : "na";
  const tested = !["submitted", "docs_pending", "verified", "test_scheduled"].includes(p.status);
  const score = tested ? (p.status === "waitlisted" ? int(55, 85) : p.status === "tested" ? int(50, 90) : int(70, 98)) : null;
  let panelStatus: string | null = null;
  if (p.status === "test_scheduled") panelStatus = "hall_ticket";
  else if (p.status === "tested") panelStatus = "in_review";
  else if (p.status === "shortlisted") panelStatus = "scheduled";
  else if (tested) panelStatus = p.status === "waitlisted" ? "waitlisted" : "cleared";
  const paid = !["submitted", "docs_pending"].includes(p.status) || R() < 0.1;
  const dobYear = 2026 - (({ pre: 4, primary: 8, middle: 12, senior: 16 } as Record<string, number>)[groupOf(p.grade)]!) - int(0, 2);
  apps.push({
    id: `adm_app_${pad(i + 1, 3)}`,
    ref: `APP-2026-${pad(i + 1)}`,
    enquiryId: "",
    name: `${first} ${last}`,
    gender: female ? "Female" : "Male",
    dob: `${dobYear}-${pad(int(1, 12), 2)}-${pad(int(1, 28), 2)}`,
    guardian: `${parentFirst} ${last}`,
    phone: `+91 9${int(1000, 9999)} ${int(10000, 99999)}`,
    email: `${parentFirst.toLowerCase()}.${last.toLowerCase()}@example.com`,
    grade: p.grade,
    tag,
    status: p.status,
    submittedAt,
    feePaid: paid,
    feeMode: paid ? pick(["UPI", "UPI", "Card", "NetBanking"]) : "",
    docs,
    testSlotId: tested || p.status === "test_scheduled" ? slotFor(p.status, p.grade) : "",
    interviewSlotId: p.status === "shortlisted" ? "adm_slot_5" : "",
    writtenScore: score,
    panelStatus,
    panelist: tested || p.status === "test_scheduled" ? PANELISTS[i % 3]! : "",
    waitlistNo: 0,
    offerId: "",
    notes: "",
  });
});
// fix waitlist numbering (simple running counter per grade)
{
  const c: Record<string, number> = {};
  for (const a of apps) if (a.status === "waitlisted") { c[a.grade as string] = (c[a.grade as string] ?? 0) + 1; a.waitlistNo = c[a.grade as string]!; }
}
const appsShuffled = shuffle(apps);
// re-number so chronological order matches ref numbers
appsShuffled.sort((a, b) => String(a.submittedAt).localeCompare(String(b.submittedAt)));
appsShuffled.forEach((a, i) => { a.id = `adm_app_${pad(i + 1, 3)}`; a.ref = `APP-2026-${pad(i + 1)}`; });

// ---------- offers ----------
const offers: App[] = [];
let on = 0;
const offerApps = appsShuffled.filter((a) => ["enrolled", "offered", "withdrawn", "lapsed"].includes(a.status as string));
for (const a of offerApps) {
  on++;
  const st = a.status === "enrolled" ? "enrolled" : a.status === "offered" ? "pending" : a.status === "withdrawn" ? "declined" : "lapsed";
  const issuedAt = st === "pending" ? addDays("2026-10-16", int(0, 5)) : addDays(String(a.submittedAt), int(10, 25));
  const o: App = {
    id: `adm_off_${pad(on, 3)}`,
    ref: `OFF-2026-${pad(800 + on)}`,
    applicationId: a.id, name: a.name, guardian: a.guardian, phone: a.phone, grade: a.grade,
    issuedAt, expiresAt: addDays(issuedAt, 7), status: st,
    tokenPaid: st === "enrolled" ? 50000 : 0, tokenPaidAt: st === "enrolled" ? addDays(issuedAt, int(1, 5)) : "",
    studentId: "", reason: st === "declined" ? pick(LOST_REASONS) : "",
  };
  offers.push(o);
  a.offerId = o.id;
}

// ---------- enquiries ----------
const enquiries: App[] = [];
let en = 0;
const mkEnq = (over: Record<string, unknown>) => {
  en++;
  return {
    id: `adm_enq_${pad(en, 3)}`, ref: `ENQ-2026-${pad(en)}`, name: "", grade: "1", dob: "", prevSchool: pick(PRESCHOOLS),
    guardian: "", relation: "Father", phone: "", email: "", area: `${pick(AREAS)} - 5600${int(10, 99)}`,
    source: pick(SOURCES), stage: "new", assignee: pick(STAFF), followUp: "", note: "", sibling: false,
    createdAt: "", applicationId: "", lostReason: "", answers: {}, ...over,
  } as App;
};
// converted enquiries (one per application), older ones first
for (const a of appsShuffled) {
  const stage = a.status === "enrolled" ? "enrolled" : a.status === "offered" ? "offered" : a.status === "withdrawn" || a.status === "lapsed" ? "lost" : "app_issued";
  const e = mkEnq({
    name: a.name, grade: a.grade, dob: a.dob, guardian: a.guardian, phone: a.phone, email: a.email,
    relation: String(a.guardian).startsWith("Meen") ? "Mother" : "Father",
    stage, applicationId: a.id, createdAt: addDays(String(a.submittedAt), -int(1, 6)),
    sibling: a.tag === "sibling",
    lostReason: stage === "lost" ? (a.status === "lapsed" ? "Offer lapsed" : "Offer declined") : "",
  });
  a.enquiryId = e.id;
  enquiries.push(e);
}
// lost enquiries without application (193)
for (let i = 0; i < 193; i++) {
  const female = R() < 0.5;
  const g = pick(GW);
  const ln = pick(LAST);
  enquiries.push(mkEnq({
    name: `${female ? pick(GIRLS) : pick(BOYS)} ${ln}`, grade: g, guardian: `${pick(FATHERS)} ${ln}`,
    phone: `+91 9${int(1000, 9999)} ${int(10000, 99999)}`, email: `${ln.toLowerCase()}${int(1, 99)}@example.com`,
    stage: "lost", createdAt: addDays("2026-06-15", int(0, 100)), lostReason: pick(LOST_REASONS),
  }));
}
// open enquiries (42): 14 new, 17 contacted, 11 campus visit; 14 unassigned
const openPlan: [string, number][] = [["new", 14], ["contacted", 17], ["campus", 11]];
let oi = 0;
const NOTES = ["Father requested fee brochure & transport route #14", "Asked about sibling concession", "Wants campus tour on weekend", "Comparing with two other schools", "Interested in CBSE + activity programme", ""];
for (const [stage, n] of openPlan) {
  for (let i = 0; i < n; i++, oi++) {
    const female = R() < 0.5;
    const g = pick(GW);
    const ln = pick(LAST);
    enquiries.push(mkEnq({
      name: `${female ? pick(GIRLS) : pick(BOYS)} ${ln}`, grade: g, guardian: `${R() < 0.5 ? pick(FATHERS) : pick(MOTHERS)} ${ln}`,
      phone: `+91 9${int(1000, 9999)} ${int(10000, 99999)}`, email: `${ln.toLowerCase()}${int(1, 99)}@example.com`,
      stage, createdAt: addDays("2026-10-01", int(0, 20)), assignee: oi % 3 === 0 ? "" : pick(STAFF),
      followUp: stage === "new" ? "" : addDays("2026-10-20", int(-2, 8)), note: pick(NOTES), sibling: R() < 0.15,
      source: stage === "campus" ? pick(["Walk-In", "Referral"]) : pick(SOURCES),
    }));
  }
}
enquiries.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
enquiries.forEach((e, i) => { e.id = `adm_enq_${pad(i + 1, 3)}`; e.ref = `ENQ-2026-${pad(i + 1)}`; });
const idMap = new Map<string, string>(); // not needed: enquiryId must be re-linked
for (const a of appsShuffled) {
  const e = enquiries.find((x) => x.applicationId === a.id)!;
  a.enquiryId = e.id; idMap.set(a.id, e.id);
}

// ---------- test / interview slots ----------
const slots = [
  { id: "adm_slot_1", batch: "BATCH #01", title: "Pre-Primary & Primary (Nursery–G5)", type: "test", date: "2026-10-05", time: "09:30", venue: "Exam Hall 1", capacity: 90, invigilator: "Dr. Anita Mehra", status: "completed" },
  { id: "adm_slot_2", batch: "BATCH #02", title: "Middle & Secondary (Grades 6–9)", type: "test", date: "2026-10-12", time: "09:30", venue: "Lab A & B", capacity: 80, invigilator: "Prof. M. K. Sen", status: "scores_entered" },
  { id: "adm_slot_3", batch: "BATCH #03", title: "Senior Secondary (Grade 11 Sci & Com)", type: "test", date: "2026-10-14", time: "10:00", venue: "Exam Hall 2", capacity: 30, invigilator: "Dr. Anita Mehra", status: "completed" },
  { id: "adm_slot_4", batch: "BATCH #04", title: "Entrance Assessment — Mixed Cohort", type: "test", date: "2026-10-28", time: "09:30", venue: "Hall 2B (Admin Block)", capacity: 40, invigilator: "Mrs. S. Rao", status: "scheduled" },
  { id: "adm_slot_5", batch: "PANEL A", title: "Principal's Interview Panel A", type: "interview", date: "2026-10-24", time: "11:00", venue: "Principal's Office", capacity: 12, invigilator: "Dr. Rajiv Sharma", status: "scheduled" },
];

// ---------- seat matrix ----------
const seats = GRADES.map((g) => ({
  id: `adm_seat_${g.id.toLowerCase()}`, grade: g.id, group: g.group, capacity: g.cap, rteSeats: Math.max(1, Math.round(g.cap * 0.25)),
  block: g.group === "pre" ? "Block A" : g.group === "primary" ? "Block B" : g.group === "middle" ? "Block C" : "Senior Wing",
}));

// ---------- form schema ----------
const gradeOptions = ["Nursery", "LKG", "UKG", "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 11 (Science)", "Grade 11 (Commerce)"];
const sections = [
  { id: "sec_basic", title: "Candidate Basic Information", description: "Personal identifiers, statutory age eligibility, and identity verification", mandatory: true, fields: [
    { id: "f_name", key: "name", label: "Student Full Name", type: "text", required: true, core: true, placeholder: "As shown on Municipal Birth Certificate" },
    { id: "f_gender", key: "gender", label: "Gender Identity", type: "radio", required: true, options: ["Male", "Female", "Other"] },
    { id: "f_dob", key: "dob", label: "Date of Birth (DOB)", type: "date", required: true, core: true, rule: "Min 3Y 6M on 31-Mar-2026" },
    { id: "f_blood", key: "bloodGroup", label: "Blood Group", type: "select", required: false, options: ["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"] },
    { id: "f_aadhaar", key: "aadhaar", label: "Aadhaar Card (UIDAI 12-Digit Reference)", type: "text", required: false, placeholder: "12-digit Aadhaar number", rule: "Deduplication guard" },
  ] },
  { id: "sec_cohort", title: "Target Cohort & Academics", description: "Desired grade entry, stream selection, and prior scholastic history", mandatory: true, fields: [
    { id: "f_grade", key: "grade", label: "Applying For Grade", type: "select", required: true, core: true, options: gradeOptions },
    { id: "f_prev", key: "prevSchool", label: "Previous School Attended & Board", type: "text", required: false, placeholder: "Search CBSE / ICSE / State Code or Freeform" },
  ] },
  { id: "sec_guardian", title: "Guardian & Contact Details", description: "Emergency notification channels, residential zone, and parent KYC", mandatory: true, fields: [
    { id: "f_guardian", key: "guardian", label: "Father / Mother / Legal Guardian Name", type: "text", required: true, core: true, placeholder: "Full legal name as per government records" },
    { id: "f_phone", key: "phone", label: "WhatsApp Number (For Direct Alerts)", type: "tel", required: true, core: true, placeholder: "+91 Mobile number", rule: "OTP Enforced" },
    { id: "f_email", key: "email", label: "Email Address", type: "email", required: true, placeholder: "name@example.com" },
    { id: "f_area", key: "area", label: "Residential Area & Pincode", type: "text", required: false, placeholder: "Indiranagar, Bangalore - 560038" },
  ] },
];

// ---------- re-enrolment ----------
const WINGS = [
  { wing: "pre-primary", total: 560, conf: 542, pend: 12, exit: 6, grades: ["Nursery", "LKG", "UKG", "1", "2", "3", "4", "5"] },
  { wing: "middle", total: 408, conf: 388, pend: 16, exit: 4, grades: ["6", "7", "8"] },
  { wing: "secondary", total: 230, conf: 215, pend: 11, exit: 4, grades: ["9", "10"] },
  { wing: "senior", total: 82, conf: 61, pend: 19, exit: 2, grades: ["11"] },
];
const STREAMS: Record<string, string[]> = {
  "pre-primary": ["Foundation Stage", "Primary Core", "Primary + Hindi"], middle: ["General Middle School (French)", "General Middle School (Sanskrit)", "General Middle School (Hindi)"],
  secondary: ["Science with AI (PCM)", "Commerce with Math", "Humanities"], senior: ["Science (PCM)", "Science (PCB)", "Commerce", "Arts"],
};
const reen: App[] = [];
let rn = 0;
for (const w of WINGS) {
  const statuses = shuffle([...Array(w.conf).fill("confirmed"), ...Array(w.pend).fill("pending"), ...Array(w.exit).fill("exit")]);
  for (let i = 0; i < w.total; i++) {
    rn++;
    const st = statuses[i] as string;
    const female = R() < 0.5;
    const g = pick(w.grades);
    const ln = pick(LAST);
    const yr = 2026 - (g === "Nursery" ? 1 : g === "LKG" ? 2 : g === "UKG" ? 3 : Number(g) + 3) + int(0, 1);
    reen.push({
      id: `adm_re_${pad(rn)}`,
      admNo: `GIS-${yr}-${pad(int(1, 1999))}`,
      name: `${female ? pick(GIRLS) : pick(BOYS)} ${ln}`,
      grade: g, section: pick(["A", "B", "C"]), wing: w.wing,
      stream: st === "pending" && w.wing === "senior" ? "" : pick(STREAMS[w.wing]!),
      transport: pick(["Bus Route #14", "Bus Route #08", "Bus Route #12", "Self / Walker", "Self / Walker"]),
      status: st,
      fee: st === "confirmed" ? pick(["paid", "paid", "paid", "sibling"]) : st === "exit" ? "caution" : pick(["due", "due", "paid"]),
      guardian: `${pick(FATHERS)} ${ln}`, phone: `+91 9${int(1000, 9999)} ${int(10000, 99999)}`,
      reason: st === "exit" ? pick(["Relocation (Bengaluru)", "Transfer to board school", "Financial", "Moving abroad"]) : "",
      confirmedAt: st === "confirmed" ? addDays("2026-09-01", int(0, 40)) : "",
    });
  }
}

export const admissions: Seed = {
  adm_enquiries: enquiries,
  adm_applications: appsShuffled,
  adm_offers: offers,
  adm_slots: slots,
  adm_seats: seats,
  adm_form: [{
    id: "form", name: "CBSE AY 2026–27 Admission Form", version: 4, status: "published",
    publishedAt: "2026-10-10T14:32:00", publishedBy: "Dr. Rajiv Sharma", sections, published: sections,
    history: [
      { version: 4, at: "2026-10-10T14:32:00", by: "Dr. Rajiv Sharma", note: "Added Aadhaar dedupe guard" },
      { version: 3, at: "2026-09-18T11:05:00", by: "Dr. Rajiv Sharma", note: "TC rule for Grades 2–12" },
      { version: 2, at: "2026-08-30T09:40:00", by: "Admissions Desk", note: "Added blood group" },
    ],
  }],
  adm_config: [{
    id: "config", appFee: 2500, tokenAmount: 50000, offerValidityDays: 7, submissionCap: 500,
    safeguards: { razorpay: true, otp: true, dedupe: true, receipts: true },
    marketingSpend: { "Google Search": 1100000 / 4, "Referral": 0, "Website Form": 257600, "Social Ad": 766000, "Walk-In": 0, "Phone Call": 0, "Edu Fair 2026": 120000 },
    stats: { scansToday: 68, visitors: 1962, begun: 1614, hourly: [8, 6, 5, 14, 22, 18, 12, 26, 19, 13, 16, 22, 28, 31, 24, 17, 20, 14, 9, 6, 7, 5, 4, 3] },
    qrBase: "",
  }],
  adm_campaign: [{
    id: "campaign", name: "AY 2026–27 Re-enrolment Drive", opensAt: "2026-09-01", closesAt: "2026-10-31", reenrolFee: 15000,
    noticesSent: 214, lastReminderAt: "2026-10-15",
  }],
  adm_reenrolment: reen,
  adm_messages: [],
};
