/**
 * Copy and data for the public landing page (/landing). Every feature named here exists in the product: the list is taken
 * from docs/DATA_CONTRACT.md (sections 3–15) and the app READMEs; the numbers from docs/E2E_REPORT.md (3–4 Nov 2026).
 * Keep this file in step with those documents, never ahead of them.
 */
export const PRODUCT = "Edvio";
export const COMPANY = "Tatos Technologies";
/** Where the mailto fallback of the demo form goes. */
export const CONTACT_EMAIL = "info@tatos.tech";

export type AppKey = "admin" | "teacher" | "parent" | "driver";

export interface AppCard {
  key: AppKey;
  name: string;
  platform: string;
  who: string;
  tagline: string;
  does: string[];
}

export const APPS: AppCard[] = [
  {
    key: "admin",
    name: "Admin web",
    platform: "Browser",
    who: "School office, principal, accounts",
    tagline: "Sets the school up and sees everything.",
    does: ["Students, classes, staff and logins", "Timetable, substitutions, exam cycles", "Fees, receipts and bank-transfer verification", "Notices, calendar, approvals, audit log"],
  },
  {
    key: "teacher",
    name: "Teacher app",
    platform: "Android · iOS",
    who: "Class and subject teachers",
    tagline: "The day's periods, one tap each.",
    does: ["Period-wise attendance", "Homework set, collected and graded", "Marks entry until the paper is locked", "Leave, check-in, exam duties, live classes"],
  },
  {
    key: "parent",
    name: "Parent app",
    platform: "Android · iOS",
    who: "Guardians, one login for all siblings",
    tagline: "Only their own children, always current.",
    does: ["Attendance, homework and results per child", "Fees with receipts, pay by bank transfer", "Leave requests, messages, meeting bookings", "Bus status and boarding alerts"],
  },
  {
    key: "driver",
    name: "Driver & bus-staff app",
    platform: "Android",
    who: "Drivers and attendants",
    tagline: "Who is on the bus, right now.",
    does: ["Pre-trip checklist before departure", "Boarded / absent / dropped per pupil", "Call the guardian from the roster", "Crew check-in and leave"],
  },
];

/** The four-step walkthrough in the Understand section (and the sticky How-it-works section). */
export interface Step {
  n: number;
  app: AppKey;
  title: string;
  body: string;
  /** what the screen in the mockup shows */
  screen: string;
}

export const WALKTHROUGH: Step[] = [
  { n: 1, app: "admin", title: "The office sets the school up", body: "Classes, rosters, staff logins, the timetable and the bus routes live in one place. Teachers and parents get an invite email, never a school code.", screen: "Admin · Setup" },
  { n: 2, app: "teacher", title: "A teacher marks period 1", body: "Only the absentees are tapped. The record carries the period, the class and the teacher, so the office never re-enters it.", screen: "Teacher · Attendance" },
  { n: 3, app: "parent", title: "The parent gets the alert", body: "A Cloud Function copies that child's day into the parent's view and sends the push. The parent sees the month, not a class list.", screen: "Parent · Alert" },
  { n: 4, app: "driver", title: "The bus attendant marks boarding", body: "On the afternoon drop, every pupil is marked boarded or absent at the stop; guardians hear about it as it happens.", screen: "Driver · Trip" },
];

export interface Benefit {
  audience: "Office" | "Teachers" | "Parents" | "Transport";
  headline: string;
  items: { title: string; body: string }[];
}

export const BENEFITS: Benefit[] = [
  {
    audience: "Office",
    headline: "Fewer registers, one audit trail",
    items: [
      { title: "Fees with receipts", body: "Invoices per student, receipts at the counter, and bank-transfer claims verified against the statement before a receipt is issued." },
      { title: "Approvals queue", body: "Staff leave, regularisation requests and crew leave arrive in one queue; a decision updates the request and tells the teacher." },
      { title: "Exams end to end", body: "Cycles, papers, invigilation duties with clash checks, marks locked per paper, results published per class." },
      { title: "Notices and calendar", body: "Publish now or schedule for later; the right audience gets it, acknowledgements are counted." },
      { title: "Certificates", body: "Bonafide, character and transfer certificates issued from a parent's request, numbered, with the signed PDF attached." },
      { title: "Audit log", body: "Who linked a parent, who changed a student record, who verified a payment: traceable in Settings." },
    ],
  },
  {
    audience: "Teachers",
    headline: "The whole day from the phone",
    items: [
      { title: "Attendance per period", body: "Tap the absentees, submit. Admin and parents see it at once." },
      { title: "Homework and grading", body: "Set it for a class, collect submissions, mark and leave feedback; the parent copy updates itself." },
      { title: "Marks entry", body: "Theory marks per paper until the exam cell locks it; internal and medical marks stay with the office." },
      { title: "Leave and check-in", body: "Punch in, apply for leave against the policy quota, request a regularisation when a punch is missed." },
      { title: "Substitutions and duties", body: "A substitution or exam duty arrives as a push; accept it from the timetable." },
      { title: "Live classes", body: "Schedule a Google Meet class; students and parents join from their app." },
    ],
  },
  {
    audience: "Parents",
    headline: "Their child, nothing else",
    items: [
      { title: "Attendance and results", body: "A month view per child and results as soon as the class is published." },
      { title: "Homework", body: "What was set, when it is due, the marks and the teacher's feedback." },
      { title: "Fees", body: "Invoices, receipts and reminders; pay into the school account and report the transfer in the app." },
      { title: "Leave requests", body: "Apply for a day off; the class teacher approves and the parent sees the decision." },
      { title: "Meetings and messages", body: "Book a parent-teacher slot the office published; message the teacher, unread counts on both sides." },
      { title: "Bus and boarding", body: "Bus, stop, pickup time, the crew's numbers, and a push when the child boards or gets off." },
    ],
  },
  {
    audience: "Transport",
    headline: "Every child accounted for",
    items: [
      { title: "Checklist before departure", body: "Brakes, lights, tyres, fuel, first-aid, cleanliness: a pickup cannot start until all six are ticked." },
      { title: "Boarding marks", body: "Boarded, absent or dropped per pupil, by either crew member, at the same time, without conflicts." },
      { title: "Guardian alerts", body: "“Aarav boarded Bus 14 at 06:52”, “got off at school”, “was not at the bus stop”: sent as it happens." },
      { title: "Crew attendance and leave", body: "Check-in with a late threshold the office sets; leave requests go to the transport office." },
      { title: "Office view", body: "Trips, marks with time and who marked, per-student history, corrections with an audit mark." },
      { title: "One roster", body: "The bus's pupils with class, stop and guardian phone; drivers never see another bus." },
    ],
  },
];

/** Verified counts from docs/E2E_REPORT.md. Update them when the report changes. */
export const PROOF = [
  { value: 4, label: "apps on one backend", suffix: "" },
  { value: 357, label: "Firestore rules tests", suffix: "" },
  { value: 103, label: "cross-app sync checks", suffix: "" },
  { value: 1673, label: "automated tests across the four apps", suffix: "" }, // 770 + 311 + 469 + 123
];

export const SECURITY = [
  { title: "One school, one namespace", body: "Every record lives under the school's own id. The rules let a login reach only the school its account points at; several schools share one backend without seeing each other." },
  { title: "Rules per role", body: "Admin, teacher, parent, driver and attendant each get exactly the collections their role needs. A teacher writes only their own records; a parent reads only their own children." },
  { title: "Parents never read class lists", body: "Attendance, homework and marks hold every pupil of a class, so Cloud Functions copy each child's slice into a view only that child's guardians can open." },
  { title: "Verified end to end", body: "The rules suite, the cross-app sync suite with five signed-in roles and a four-app phone chain run against the local Firebase emulators before anything is deployed." },
];

/* PLACEHOLDER testimonials. These are illustrative quotes, not from real schools or people. Replace them with signed-off
   customer quotes before this page goes live, or hide the block. */
export const TESTIMONIALS = [
  { quote: "The office stopped keeping a paper attendance register in the first week. Parents ask fewer questions because the app already answered them.", who: "Principal", org: "Placeholder: a CBSE school, 1,200 students" },
  { quote: "Fee verification against the bank statement used to take an afternoon. Now the claim, the receipt and the parent's alert happen in one click.", who: "Accounts officer", org: "Placeholder: an ICSE school, 800 students" },
  { quote: "Bus parents are the calmest they have been. They see the boarding alert before they would have called us.", who: "Transport in-charge", org: "Placeholder: a day school with 14 buses" },
];

export const FAQ = [
  { q: "What does a school need to start?", a: "A list of classes, students and staff with email addresses. The office signs up on the admin web, enters or imports them, and every teacher and parent receives a password-set invite by email. There is no school code to type." },
  { q: "Which devices are supported?", a: "The admin console runs in any modern browser. The teacher, parent and driver apps are Flutter apps for Android and iOS; the driver app is used on Android today." },
  { q: "Is there a payment gateway?", a: "No. Parents pay into the school's own bank account by UPI, NEFT, IMPS, RTGS, cheque or cash deposit and report it in the app. The office verifies the claim against the bank statement and the receipt is issued from that verification." },
  { q: "Is bus tracking GPS-based?", a: "The parent sees the bus's route, their child's stop and times, the trip's status (scheduled, running, completed) and boarding alerts, all from the crew's marks. There is no GPS feed today." },
  { q: "Where is the data stored?", a: "In Google Cloud Firestore in the asia-south1 (Mumbai) region, one namespace per school, with security rules per role and an audit log of sensitive changes." },
  { q: "Can we run it for several schools?", a: "Yes. The backend is multi-tenant: each school is its own namespace and a login belongs to exactly one school." },
  { q: "How do we get a demo?", a: "Use the form below or write to us. We set up a demo school with your class structure and walk your office, a teacher and a parent through a school day." },
];
