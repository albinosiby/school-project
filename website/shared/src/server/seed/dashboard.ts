import type { Seed } from "./index";

const D = (day: string, hm: string) => `${day}T${hm}:00`;

const approvals = [
  { id: "apv_01", requester: "Mrs. Sunita Rao", ref: "PGT Physics · EMP-1049", kind: "leave", dept: "Science", title: "Medical Leave (2 Days)", detail: "16–17 Oct (Dr. cert attached) · Proxy: P. Rawat", remark: "Syllabus covered till Ch 4. Substitute notes provided.", submitted: D("2026-10-14", "08:30"), urgency: "HOD Endorsed", tone: "success" },
  { id: "apv_02", requester: "Vikram Joshi", ref: "TGT Mathematics · EMP-0832", kind: "leave", dept: "Mathematics", title: "Casual Leave", detail: "20 Oct (1 Day) · Proxy: S. Menon", remark: "Family function out of town.", submitted: D("2026-10-13", "17:10"), urgency: "Standard", tone: "neutral" },
  { id: "apv_03", requester: "Neha Kulkarni", ref: "PRT English · EMP-0611", kind: "leave", dept: "English", title: "Maternity Leave Extension", detail: "01–30 Nov (30 Days) · Medical documents attached", remark: "Extension requested per doctor advice.", submitted: D("2026-10-12", "11:05"), urgency: "HOD Endorsed", tone: "success" },
  { id: "apv_04", requester: "Rahul Desai", ref: "PET · EMP-0377", kind: "leave", dept: "Physical Education", title: "Duty Leave", detail: "22 Oct (Inter-district coaching camp)", remark: "Deputation letter from district sports office attached.", submitted: D("2026-10-12", "09:40"), urgency: "Standard", tone: "neutral" },
  { id: "apv_05", requester: "Aarav Mehta", ref: "GRN-8821 · Class 9-B", kind: "fee", dept: "Accounts", title: "Fee Concession", detail: "₹15,000/Term (Sibling policy verified)", remark: "Second sibling enrolled in Gr 6-A. Form verified.", submitted: D("2026-10-13", "16:45"), urgency: "Docs Validated", tone: "success" },
  { id: "apv_06", requester: "Meera Pathak", ref: "GRN-61882 · Class 11-Sci", kind: "fee", dept: "Accounts", title: "Merit Scholarship", detail: "₹22,500 / Term (CBSE Rank #4)", remark: "Board topper certificate attached. Escalates to Trustee Board.", submitted: D("2026-10-13", "12:20"), urgency: "Trustee Board Esc.", tone: "warning" },
  { id: "apv_07", requester: "Examination Cell", ref: "HOD Mathematics", kind: "marks", dept: "Examinations", title: "Unlock Marks Register", detail: "Grade 10-A (Internal Discrepancy #14, #19)", remark: "Re-evaluation discrepancy correction verified by HOD.", submitted: D("2026-10-13", "14:12"), urgency: "48h Window Request", tone: "brand" },
  { id: "apv_08", requester: "Sunita Sen", ref: "PGT Physics · EMP-1049", kind: "marks", dept: "Science", title: "Marks Entry Unlock", detail: "Term 1 Practicals (Class 12-A)", remark: "Practical marks missed for 3 absentee students.", submitted: D("2026-10-12", "15:30"), urgency: "48h Window Request", tone: "brand" },
  { id: "apv_09", requester: "Aryan Kapoor", ref: "GRN-2019 · Class 11-A", kind: "pass", dept: "Security", title: "Emergency Outpass", detail: "Parent verified via OTP · Father waiting at Gate 1", remark: "Visited school infirmary (102°F). Father waiting Gate 1.", submitted: D("2026-10-14", "09:28"), urgency: "Critical · Doctor Cleared", tone: "danger" },
  { id: "apv_10", requester: "Aarav Nair", ref: "GRN-84920 · Class 9-B", kind: "pass", dept: "Security", title: "Emergency Gate Pass", detail: "102°F Acute Pyrexia, Nurse Escort", remark: "Cleared by campus doctor, escort assigned.", submitted: D("2026-10-14", "09:05"), urgency: "Critical · Doctor Cleared", tone: "danger" },
  { id: "apv_11", requester: "Mr. K. Narayanan", ref: "Sr. Lab Lead (Tech)", kind: "po", dept: "Science", title: "Physics Lab Apparatus PO", detail: "₹48,200 (Vendor #L-104)", remark: "CBSE Board Practical consumable stock replenishment.", submitted: D("2026-10-12", "18:20"), urgency: "Budget Verified", tone: "success" },
  { id: "apv_12", requester: "Kavita Nambiar", ref: "EMP-0412 · Chem Lab Head", kind: "po", dept: "Science", title: "Lab Consumables PO", detail: "₹34,500 Sanction (Board Practicals)", remark: "Quotation compared with 3 vendors.", submitted: D("2026-10-11", "10:15"), urgency: "Budget Verified", tone: "success" },
].map((a) => ({ ...a, status: "pending" }));

const ev = (id: string, title: string, category: string, start: string, end: string, extra: Record<string, unknown> = {}) => ({
  id, title, category, start, end, startTime: "08:30", endTime: "14:30", venue: "Main Campus", term: start < "2026-11-01" ? "Term 1" : "Term 2",
  status: "published", instructional: !["holiday"].includes(category), grades: [], notifyApp: true, notifyWhatsapp: false, lead: "", desc: "", ...extra,
});

const events = [
  ev("evt_01", "Staff Briefing", "deadline", "2026-10-01", "2026-10-01", { desc: "Pre-term staff briefing" }),
  ev("evt_02", "Gandhi Jayanti", "holiday", "2026-10-02", "2026-10-02", { desc: "Gazetted national holiday" }),
  ev("evt_03", "100th Instructional Day", "ptm", "2026-10-06", "2026-10-06", { desc: "Assembly celebration" }),
  ev("evt_04", "Marks Lock 17:00", "deadline", "2026-10-08", "2026-10-08", { desc: "Internal marks entry freezes at 17:00" }),
  ev("evt_05", "Exam Halls Set (38)", "deadline", "2026-10-13", "2026-10-13", { desc: "Exam rooms and seating verified" }),
  ev("evt_06", "Admit Cards Issued", "deadline", "2026-10-15", "2026-10-15", { desc: "Digital QR hall tickets issued" }),
  ev("evt_07", "Term 1 Half-Yearly Exams", "exam", "2026-10-18", "2026-10-23", { desc: "Grades 6–12 • Seating Finalized", grades: ["6", "7", "8", "9", "10", "11", "12"], venue: "Examination Wing" }),
  ev("evt_08", "Parent-Teacher Meeting (PTM)", "ptm", "2026-10-24", "2026-10-24", { desc: "Grades 8 & 9 • 08:30–13:00", startTime: "08:30", endTime: "13:00", grades: ["8", "9"], venue: "Main Auditorium" }),
  ev("evt_09", "Diwali Festive Break", "holiday", "2026-10-31", "2026-11-03", { desc: "School closed through 03 Nov" }),
  ev("evt_10", "CBSE Inter-School Athletics Meet", "sports", "2026-11-05", "2026-11-05", { desc: "Thyagaraj Stadium · 18 Schools", startTime: "08:00", endTime: "17:00", venue: "Thyagaraj Stadium", lead: "Kabir Malik (Sports Capt.)" }),
  ev("evt_11", "Children's Day Mega Carnival & Science Pavilion", "sports", "2026-11-14", "2026-11-14", { desc: "Main Field & Amphitheatre · All grades", venue: "Main Field & Amphitheatre", lead: "Student Council" }),
];

const notif = (id: string, category: string, title: string, body: string, createdAt: string, read = false, href = "") => ({ id, category, title, body, createdAt, read, href });

const notifications = [
  notif("ntf_01", "urgent", "Unplanned leave", "Gr 8-C Science teacher Mr. Vikram Rao (Period 3 proxy needed)", D("2026-10-14", "09:30"), false, "/dashboard"),
  notif("ntf_02", "approvals", "Fee Concession", "15% Sibling concession request submitted for Ananya Verma (Gr 6-A)", D("2026-10-14", "08:57"), false, "/approvals"),
  notif("ntf_03", "statutory", "CBSE OASIS", "Annual faculty data verification deadline in 4 days", D("2026-10-14", "07:42"), false, "/calendar"),
  notif("ntf_04", "approvals", "Examinations", "Term 1 Chemistry moderation ready for administrative sign-off", D("2026-10-14", "06:42"), false, "/approvals"),
  notif("ntf_05", "finance", "Fee Billing", "Quarter 3 Fee invoice batch generated for 428 students", D("2026-10-14", "04:42"), false, "/fees"),
  notif("ntf_06", "ops", "Fleet Operations", "Bus Route #4 GPS signal restored near Sector 14", D("2026-10-13", "09:40"), true),
  notif("ntf_07", "ops", "Security & IT", "Database maintenance completed successfully at 02:00 IST", D("2026-10-13", "02:10"), true),
  notif("ntf_08", "urgent", "Medical", "Emergency outpass requested for Aryan Kapoor (Gr 11-A) — doctor cleared", D("2026-10-13", "13:20"), true, "/approvals"),
  notif("ntf_09", "approvals", "Staff Leave", "Medical leave request from Mrs. Sunita Rao awaiting authorization", D("2026-10-12", "10:00"), true, "/approvals"),
  notif("ntf_10", "approvals", "Purchase Order", "Physics Lab Apparatus PO (₹48,200) pending sanction", D("2026-10-12", "18:30"), true, "/approvals"),
  notif("ntf_11", "statutory", "UDISE+", "Teacher-pupil ratio benchmark verified (1 : 24)", D("2026-10-11", "11:00"), true),
  notif("ntf_12", "statutory", "DigiLocker", "APAAR ID coverage at 84.3% — target 95% by Step 8", D("2026-10-11", "09:15"), true, "/setup"),
  notif("ntf_13", "finance", "Fee Overdue", "34 accounts with ₹6,48,000 overdue beyond 15 days", D("2026-10-10", "16:00"), true, "/fees"),
  notif("ntf_14", "finance", "Payment Gateway", "UPI settlement of ₹18.4 L credited to school account", D("2026-10-10", "12:30"), true, "/fees"),
  notif("ntf_15", "finance", "Scholarship", "Merit scholarship disbursal schedule published for Term 2", D("2026-10-09", "15:45"), true),
  notif("ntf_16", "finance", "Vendor Payments", "3 vendor invoices due this week", D("2026-10-09", "10:20"), true),
  notif("ntf_17", "ops", "Admissions", "62 seats confirmed with token for AY 2026–27", D("2026-10-08", "14:10"), true, "/admissions"),
  notif("ntf_18", "ops", "Timetable", "Term 1 exam timetable published to parent portal", D("2026-10-07", "09:00"), true, "/timetable"),
];

const stepData: [string, string][] = [
  ["School Profile", "CBSE Affiliation #1930281 verified 12 Apr 2026."],
  ["Terms & Semesters", "2 Terms configured, 220 statutory working days."],
  ["Classes & Sections", "42 cohorts mapped, capacity locked at 1,480."],
  ["Bell Schedule", "8 periods × 40 mins, 2 recesses, zero conflict."],
  ["Fee Structure", "4 quarter slabs, concessions & UPI gateway set."],
  ["Staff Allocations", "82 teachers assigned; 0 orphaned periods."],
  ["Data Sync & Ingestion", "DigiLocker UID / Aadhaar 85% verified. 1,248 / 1,480."],
  ["Portal & App Gateway", "Parent credentials unlock upon Phase 07 zero-error sign-off."],
];
const shortNames = ["School Profile", "AY & Terms", "Grades", "Timetable", "Grading", "Staff Ready", "Data Import", "Parent Invite"];
const setup_steps = stepData.map(([title, desc], i) => ({ id: `step_${i + 1}`, no: i + 1, title, short: shortNames[i], desc, done: false, doneAt: "" }));

const exc = (id: string, name: string, guardian: string, grade: string, grn: string, status: string, tone: string, kind: string, issue: string, action: string) =>
  ({ id, name, guardian, grade, grn, status, tone, kind, issue, action, resolved: false });
const setup_exceptions = [
  exc("exc_1", "Aarav M. Khurana", "Rajesh Khurana", "IX-A", "GRN-8921", "UID Mismatch", "danger", "uid", "Aadhaar DOB (14/05/11) != Certificate (12/05/11)", "Resolve UID"),
  exc("exc_2", "Diya Sneha Patel", "Sneha K. Patel", "VI-C", "GRN-9102", "Sibling Conflict", "warning", "sibling", "Linked sibling GRN-7231 marked Alumni in 2025", "Link Sibling"),
  exc("exc_3", "Tanvi R. Sengupta", "Dr. Rohit Sengupta", "IV-B", "GRN-9442", "Route Drift", "info", "address", "Address shifted south (Gurugram Sec 42); Bus #14 invalid", "Verify Zone"),
  exc("exc_4", "Kabeer N. Joshi", "Nitin Joshi", "XI-Sci", "GRN-8420", "Missing UID", "danger", "uid", "CBSE 041 Math prerequisite check unverified (X Board)", "Review Marks"),
  exc("exc_5", "Ananya V. Deshmukh", "Vikram Deshmukh", "II-A", "GRN-9811", "Missing UID", "danger", "uid", "Secondary emergency contact: 9 digits supplied", "Override Contact"),
  exc("exc_6", "Reyansh G. Chawla", "Gurpreet Chawla", "VIII-B", "GRN-8745", "PEN Pending", "warning", "uid", "UDISE+ PEN number missing from transferred TC record", "Resolve UID"),
  exc("exc_7", "Ishita B. Menon", "Balan Menon", "VII-A", "GRN-9230", "Sibling Conflict", "warning", "sibling", "Sibling record duplicated across two guardians", "Link Sibling"),
  exc("exc_8", "Rohan P. Iyer", "Prakash Iyer", "III-C", "GRN-9577", "Route Drift", "info", "address", "Pick-up point outside Route #9 service zone", "Verify Zone"),
];

export const dashboard: Seed = {
  // fresh school: onboarding wizard must be completed before the console unlocks
  onboarding: [{ id: "state", complete: false }],
  onb_data: [],
  notifications,
  approvals,
  calendar_events: events,
  setup_steps,
  setup_exceptions,
  dash_prefs: [{ id: "main", bannerDismissed: false }],
  dash_stats: [{
    id: "main", enquiries: 420, exam: 185, interview: 78, enrolled: 62, yoy: 14, feesToday: 18400000, healthVisits: 2, healthFlags: 0, compliance: 100,
    deadlineDays: 18, termStart: "2026-06-01", pipelineVelocity: 87, totalCapacity: 1480,
    capacity: [
      { label: "Pre-Primary & KG (LKG, UKG)", enrolled: 28, cap: 30 },
      { label: "Primary (Grades 1 to 5)", enrolled: 18, cap: 30 },
      { label: "Middle & Secondary (Grades 6 to 9)", enrolled: 12, cap: 35 },
      { label: "Senior Secondary (Grade 11 - Science & Commerce)", enrolled: 4, cap: 25 },
    ],
  }],
  dash_alerts: [
    { id: "alt_1", kind: "substitute", title: "SUBSTITUTE REQUIRED", tag: "P3 (10:15)", body: "Gr 8-C Science: Unplanned leave of Mr. Verma.", status: "open", substitute: "" },
    { id: "alt_2", kind: "fee", title: "FEE OVERDUE", tag: "34 Accounts", body: "₹6,48,000 overdue exceeds 15 days.", status: "open", substitute: "" },
    { id: "alt_3", kind: "transit", title: "TRANSIT DELAY", tag: "Route #7", body: "Bus #7 delayed ~18 mins (Outer Ring Rd). Parents notified.", status: "open", substitute: "" },
  ],
  approval_policies: [
    { id: "pol_1", title: "CBSE Marks Edit Endorsement", body: "Requires HOD Physics endorsement prior to Principal digital seal.", enabled: true },
    { id: "pol_2", title: "Financial Concession > ₹15,000", body: "Auto-escalates to Trustee Board after Principal concurrence.", enabled: true },
    { id: "pol_3", title: "Medical Gate Pass Threshold", body: "Escalates via SMS notification if pending > 15 mins during school hours.", enabled: true },
  ],
  me_prefs: [{
    id: "me", emergencySub: true, auditTrail: true, weeklyDigest: false, term: "AY 2026–27 (Current Active Term)", timezone: "Asia/Kolkata (IST, UTC+5:30) · DD MMM YYYY",
    signature: "R.Sharma", mfaDevice: "YubiKey 5C NFC",
  }],
};
