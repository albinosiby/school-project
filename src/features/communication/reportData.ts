import type { Notice, Report } from "./types";

export type Stu = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number; [k: string]: unknown };
export type Stf = { id: string; name: string; empId: string; department: string; role: string; status: string; phone: string; [k: string]: unknown };
export type Params = { grade: string; section: string; from: string; to: string };
export type Table = { columns: string[]; rows: (string | number)[][] };

const h = (s: string) => { let x = 0; for (const c of s) x = (x * 31 + c.charCodeAt(0)) >>> 0; return x; };
const BLOOD = ["A+", "B+", "O+", "AB+", "O-", "A-", "B-"];
const ALLERGY = ["None", "None", "None", "Peanuts", "Dust", "Lactose", "None"];
const SUBJ = ["Maths", "Science", "English", "Hindi", "Social Sci"];
const ROUTES = ["R-01 North Loop", "R-02 Civil Lines", "R-03 Sector 12", "R-04 Ring Road", "R-05 Old City", "R-06 Airport Rd", "R-07 Green Park", "R-08 Lake View"];

export function generate(r: Report, ctx: { students: Stu[]; staff: Stf[]; notices: Notice[] }, p: Params): Table {
  const stu = ctx.students.filter((s) => (!p.grade || s.grade === p.grade) && (!p.section || s.section === p.section));
  switch (r.kind) {
    case "marks":
      return { columns: ["GRN", "Student", "Grade", "Section", ...SUBJ, "Total /500", "Attendance %", "75% Rule"], rows: stu.map((s) => {
        const m = SUBJ.map((x) => 55 + (h(s.id + x) % 45)); const tot = m.reduce((a, b) => a + b, 0);
        return [s.grn, s.name, s.grade, s.section, ...m, tot, s.attendance, s.attendance >= 75 ? "Eligible" : "Shortage"]; }) };
    case "attendance":
      return { columns: ["GRN", "Student", "Grade", "Section", "Attendance %", "Status"], rows: stu.map((s) => [s.grn, s.name, s.grade, s.section, s.attendance, s.attendance >= 75 ? "OK" : "Below 75%"]) };
    case "directory":
      return { columns: ["GRN", "Student", "Grade", "Section", "Guardian", "Phone", "Status"], rows: stu.map((s) => [s.grn, s.name, s.grade, s.section, s.guardian, s.phone, s.status]) };
    case "fees":
      return { columns: ["GRN", "Student", "Grade", "Due (INR)", "Overdue Days", "Ageing Bucket"], rows: stu.filter((s) => h(s.id) % 3 === 0).map((s) => {
        const days = h(s.id + "d") % 60; return [s.grn, s.name, s.grade, 4000 + (h(s.id + "a") % 8) * 1500, days, days <= 15 ? "0-15d" : days <= 30 ? "16-30d" : "30d+"]; }) };
    case "health":
      return { columns: ["GRN", "Student", "Grade", "Blood Group", "Height (cm)", "Weight (kg)", "BMI", "Allergy"], rows: stu.map((s) => {
        const ht = 110 + Number(s.grade) * 4 + (h(s.id) % 8), wt = 20 + Number(s.grade) * 3 + (h(s.id + "w") % 8);
        return [s.grn, s.name, s.grade, BLOOD[h(s.id) % BLOOD.length], ht, wt, (wt / ((ht / 100) ** 2)).toFixed(1), ALLERGY[h(s.id + "x") % ALLERGY.length]]; }) };
    case "workload":
      return { columns: ["Emp ID", "Name", "Department", "Role", "Periods / week", "Proxy duties", "Within 32h cap"], rows: ctx.staff.map((s) => {
        const per = 22 + (h(s.id) % 14); return [s.empId, s.name, s.department, s.role, per, h(s.id + "p") % 4, per <= 32 ? "Yes" : "No"]; }) };
    case "staffdir":
      return { columns: ["Emp ID", "Name", "Department", "Role", "Phone", "Status"], rows: ctx.staff.map((s) => [s.empId, s.name, s.department, s.role, s.phone, s.status]) };
    case "delivery":
      return { columns: ["Notice", "Audience", "Sent At", "Recipients", "Delivered", "Read", "Delivery %"], rows: ctx.notices.filter((n) => n.status === "Published"
        && (!p.from || n.sentAt.slice(0, 10) >= p.from) && (!p.to || n.sentAt.slice(0, 10) <= p.to)).map((n) => [n.title, n.audience, n.sentAt.slice(0, 16).replace("T", " "), n.recipients, n.delivered, n.read, n.recipients ? Math.round((n.delivered / n.recipients) * 1000) / 10 : 0]) };
    case "transport":
      return { columns: ["Route", "Trips", "Speed Alerts", "Route Deviations", "RFID Scans", "Escort Verified"], rows: ROUTES.map((x, i) => [x, 2, h(x) % 4, h(x + "d") % 3, 40 + ((i * 17) % 30), "Yes"]) };
    default:
      return { columns: ["Info"], rows: [["No data"]] };
  }
}
