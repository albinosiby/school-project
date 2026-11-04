// Shared admissions data model. Collections (all `adm_` prefixed):
//  adm_enquiries, adm_applications, adm_offers, adm_slots, adm_seats, adm_form (builder schema),
//  adm_config (fees, safeguards, stats), adm_campaign + adm_reenrolment, adm_messages (simulated sends).
export type Source = "Walk-In" | "Phone Call" | "Referral" | "Website Form" | "Edu Fair 2026" | "Google Search" | "Social Ad";
export const SOURCES: Source[] = ["Walk-In", "Phone Call", "Referral", "Website Form", "Edu Fair 2026", "Google Search", "Social Ad"];
export const STAFF = ["Ananya Sen", "Vikram Das", "Priya Das", "Rahul Menon"];

export type EnqStage = "new" | "contacted" | "campus" | "app_issued" | "offered" | "enrolled" | "lost";
export type Enquiry = {
  id: string; ref: string; name: string; grade: string; dob: string; prevSchool: string; guardian: string; relation: string;
  phone: string; email: string; area: string; source: string; stage: EnqStage; assignee: string; followUp: string; note: string;
  sibling: boolean; createdAt: string; applicationId: string; lostReason: string; answers?: Record<string, string>;
  /** ISO date-time of the submission (public form); createdAt stays the local YYYY-MM-DD */ submittedTs?: string;
};

export type DocState = "verified" | "pending" | "rejected" | "na";
export type DocKey = "birth" | "idProof" | "immunisation" | "tc";
export const DOC_LABEL: Record<DocKey, string> = { birth: "Birth Certificate", idProof: "Aadhaar / Passport ID", immunisation: "Immunisation Record", tc: "Previous TC / Report" };
export type AppStatus = "submitted" | "docs_pending" | "verified" | "test_scheduled" | "tested" | "shortlisted" | "waitlisted" | "offered" | "enrolled" | "rejected" | "withdrawn" | "lapsed";
export const APP_STATUS_LABEL: Record<AppStatus, string> = {
  submitted: "Submitted", docs_pending: "Documents Pending", verified: "Verified", test_scheduled: "Test Scheduled", tested: "Tested",
  shortlisted: "Shortlisted", waitlisted: "Waitlisted", offered: "Offer Issued", enrolled: "Enrolled", rejected: "Rejected", withdrawn: "Declined Offer", lapsed: "Offer Lapsed",
};
export type PanelStatus = "hall_ticket" | "scheduled" | "in_review" | "cleared" | "waitlisted" | "rejected";
export const PANEL_LABEL: Record<PanelStatus, string> = { hall_ticket: "Hall Ticket Issued", scheduled: "Interview Scheduled", in_review: "In Review", cleared: "Cleared", waitlisted: "Waitlisted", rejected: "Not Selected" };
export type Tag = "general" | "rte" | "sibling" | "staff";
export const TAG_LABEL: Record<Tag, string> = { general: "General Merit", rte: "RTE 25% Quota", sibling: "Sibling Priority", staff: "Staff Ward" };
export type Application = {
  id: string; ref: string; enquiryId: string; name: string; gender: string; dob: string; guardian: string; phone: string; email: string;
  grade: string; tag: Tag; status: AppStatus; submittedAt: string; feePaid: boolean; feeMode: string; docs: Record<DocKey, DocState>;
  testSlotId: string; interviewSlotId: string; writtenScore: number | null; panelStatus: PanelStatus | null; panelist: string;
  waitlistNo: number; offerId: string; notes: string;
};

export type OfferStatus = "pending" | "accepted" | "enrolled" | "declined" | "lapsed";
export type Offer = {
  id: string; ref: string; applicationId: string; name: string; guardian: string; phone: string; grade: string;
  issuedAt: string; expiresAt: string; status: OfferStatus; tokenPaid: number; tokenPaidAt: string; studentId: string; reason: string;
};

export type SlotStatus = "scheduled" | "completed" | "scores_entered" | "published";
export type Slot = {
  id: string; batch: string; title: string; type: "test" | "interview"; date: string; time: string; venue: string;
  capacity: number; invigilator: string; status: SlotStatus;
};

export type Seat = { id: string; grade: string; group: string; capacity: number; rteSeats: number; block: string };

export type FieldType = "text" | "textarea" | "select" | "radio" | "date" | "tel" | "email" | "number";
export type FormField = { id: string; key: string; label: string; type: FieldType; required: boolean; core?: boolean; placeholder?: string; options?: string[]; rule?: string };
export type FormSection = { id: string; title: string; description: string; mandatory: boolean; fields: FormField[] };
export type FormDoc = {
  id: "form"; name: string; version: number; status: "published" | "draft"; publishedAt: string; publishedBy: string;
  sections: FormSection[]; published: FormSection[]; history: { version: number; at: string; by: string; note: string }[];
};

export type Config = {
  id: "config"; appFee: number; tokenAmount: number; offerValidityDays: number; submissionCap: number;
  safeguards: { razorpay: boolean; otp: boolean; dedupe: boolean; receipts: boolean };
  marketingSpend: Record<string, number>;
  stats: { scansToday: number; visitors: number; begun: number; hourly: number[] };
};

export type Campaign = { id: "campaign"; name: string; opensAt: string; closesAt: string; reenrolFee: number; noticesSent: number; lastReminderAt: string };
export type Reenrol = {
  id: string; admNo: string; name: string; grade: string; section: string; wing: "pre-primary" | "middle" | "secondary" | "senior";
  stream: string; transport: string; status: "confirmed" | "pending" | "exit"; fee: "paid" | "due" | "sibling" | "caution";
  guardian: string; phone: string; reason: string; confirmedAt: string;
};
export type Message = { id: string; kind: string; to: string; text: string; at: string };

// ---------- grades ----------
export const GRADES = [
  { id: "Nursery", label: "Nursery", group: "pre", minAge: 3 },
  { id: "LKG", label: "LKG", group: "pre", minAge: 4 },
  { id: "UKG", label: "UKG", group: "pre", minAge: 5 },
  { id: "1", label: "Grade 1", group: "primary", minAge: 6 },
  { id: "2", label: "Grade 2", group: "primary", minAge: 7 },
  { id: "3", label: "Grade 3", group: "primary", minAge: 8 },
  { id: "4", label: "Grade 4", group: "primary", minAge: 9 },
  { id: "5", label: "Grade 5", group: "primary", minAge: 10 },
  { id: "6", label: "Grade 6", group: "middle", minAge: 11 },
  { id: "7", label: "Grade 7", group: "middle", minAge: 12 },
  { id: "8", label: "Grade 8", group: "middle", minAge: 13 },
  { id: "9", label: "Grade 9", group: "middle", minAge: 14 },
  { id: "11-Science", label: "Grade 11 (Science)", group: "senior", minAge: 16 },
  { id: "11-Commerce", label: "Grade 11 (Commerce)", group: "senior", minAge: 16 },
] as const;
export const GROUPS = [
  { id: "pre", label: "Pre-Primary", sub: "Nursery, LKG & UKG" },
  { id: "primary", label: "Primary", sub: "Grades 1–5 (Elementary)" },
  { id: "middle", label: "Middle & Secondary", sub: "Grades 6–9 (Academic Block)" },
  { id: "senior", label: "Senior Secondary", sub: "Grade 11 – Science & Commerce" },
] as const;
export const gradeLabel = (id: string) => GRADES.find((g) => g.id === id)?.label ?? id;
export const gradeIdFromLabel = (label: string) => GRADES.find((g) => g.label === label || g.id === label)?.id ?? label;
export const groupOfGrade = (id: string) => GRADES.find((g) => g.id === id)?.group ?? "primary";
/** Value stored in the shared `students` collection. */
export const studentGrade = (id: string) => (id.startsWith("11") ? "11" : id);
