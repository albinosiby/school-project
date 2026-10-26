import type { Seed } from "./index";

const bands: [string, number, number][] = [["A1", 91, 10], ["A2", 81, 9], ["B1", 71, 8], ["B2", 61, 7], ["C1", 51, 6], ["C2", 41, 5], ["D", 33, 4], ["E", 0, 0]];

export const settings: Seed = {
  set_config: [
    { id: "profile", name: "Greenfield International School", affiliation: "1930281 (Sr. Secondary 10+2)", schoolCode: "DEL-84021 · Center 6092", email: "admin@greenfield.edu.in", phone: "+91 11 2849 5000", address: "Plot 14, Institutional Area, Sector 62, Noida, NCR Delhi 201309", seal: "Greenfield_Crest.png", digitalKey: "Dr. Sharma (Active)" },
    { id: "bell", gates: "07:45 AM", classes: "08:30 – 14:45", periods: "8 Periods × 40 min", recess: "15m (snack) + 30m (lunch)" },
    { id: "regional", language: "English (India) - en_IN", dateFormat: "DD MMM YYYY", timezone: "IST · UTC+05:30 (New Delhi)", currency: "Indian Rupee (₹ INR)", workingWeek: "Mon – Sat (2nd & 4th Saturday Off)" },
    { id: "meta", academicYear: "2026-27", rolledOver: false, rolloverStep: 3 },
  ],
  set_terms: [
    { id: "term_1", name: "Term 1 (Autumn)", start: "2026-04-01", end: "2026-09-30", days: 108, status: "Closed" },
    { id: "term_2", name: "Term 2 (Spring)", start: "2026-10-01", end: "2027-03-31", days: 112, status: "In Progress" },
  ],
  set_sections: [
    { id: "sec_10", grade: "Grade 10", stream: "Secondary Board", sections: ["10-A", "10-B", "10-C", "10-D"], roster: 148, cap: 160 },
    { id: "sec_11", grade: "Grade 11", stream: "Sr. Sec · Science Stream", sections: ["11-Sci-A", "11-Sci-B"], roster: 78, cap: 80 },
    { id: "sec_12", grade: "Grade 12", stream: "Graduating Board", sections: ["12-A", "12-B", "12-C"], roster: 114, cap: 120 },
  ],
  set_roles: [
    { id: "role_admin", name: "Super Admin (Principal)", tone: "brand", perms: ["Full System Root", "Year-End Rollover", "Fee Write-Off", "Compliance Lock"] },
    { id: "role_hod", name: "Academic Coordinator (HOD)", tone: "success", perms: ["Curriculum & Syllabus", "Master Timetable", "Exam Moderation"] },
    { id: "role_teacher", name: "Teacher / PGT Faculty", tone: "neutral", perms: ["Marks & Grades Entry", "Daily Attendance", "Homework Broadcast"] },
    { id: "role_accounts", name: "Accounts & Bursar", tone: "warning", perms: ["Fee Collection POS", "Invoicing & Dues", "Cheque Clearance"] },
  ],
  set_integrations: [
    { id: "int_razorpay", name: "Razorpay Payment Gateway", desc: "Online fee collection, UPI and card payments", enabled: true },
    { id: "int_pinelabs", name: "PineLabs Smart POS", desc: "Front-desk card terminals", enabled: true },
    { id: "int_whatsapp", name: "WhatsApp Business", desc: "Fee reminders and circular broadcasts", enabled: true },
    { id: "int_sms", name: "SMS Gateway", desc: "Transactional SMS to guardians", enabled: false },
    { id: "int_digilocker", name: "DigiLocker", desc: "Publish report cards and certificates", enabled: true },
    { id: "int_cbse", name: "CBSE Sync", desc: "Registration and LOC data exchange", enabled: true },
  ],
  // contract section 12.2: leave entitlement + late threshold (same defaults as the teacher app)
  set_leave_policy: [
    { id: "policy", checkInBy: "08:15", types: [
      { id: "CL", name: "Casual (CL)", type: "Casual Leave", total: 12 },
      { id: "ML", name: "Medical (ML)", type: "Medical Leave", total: 10 },
      { id: "DL", name: "Duty Leave (DL)", type: "Duty Leave", total: 6 },
      { id: "SDL", name: "Special Duty (SDL)", type: "Special Duty Leave", total: 5 },
      { id: "AW", name: "Academic Workshop (AW)", type: "Academic Workshop", total: 6 },
    ] },
  ],
  set_grading: bands.map(([grade, min, point], i) => ({ id: `gr_${i}`, grade, min, point })),
  set_exceptions: [
    ...Array.from({ length: 8 }, (_, i) => ({ id: `exc_m${i}`, kind: "Marks", text: `Grade 11 student #11S-${String(i + 3).padStart(2, "0")}: practical marks missing`, resolved: false })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `exc_c${i}`, kind: "Concession", text: `Fee concession CON-${210 + i} lacks Bursar countersignature`, resolved: false })),
  ],
  set_audit: [
    { id: "aud_1", at: "2026-10-20T10:12:00.000Z", actor: "Dr. Rajiv Sharma", action: "Updated Grading scheme", detail: "CBSE 9-Point scale confirmed" },
    { id: "aud_2", at: "2026-10-18T08:40:00.000Z", actor: "Dr. Rajiv Sharma", action: "Locked Term 1", detail: "Term 1 (Autumn) audited and closed" },
  ],
};
