import { tsOf } from "@/features/dashboard/logic";
import type { Notice, Report } from "./types";

// Standard reports are generated from the school's real records. Nothing is invented: a value the school does not
// record (e.g. blood group) is shown as "Not recorded" instead of a made-up number.
export type Stu = { id: string; name: string; grn: string; grade: string; section: string; guardian: string; phone: string; status: string; attendance: number; classId?: string; busId?: string; [k: string]: unknown };
export type Stf = { id: string; name: string; empId: string; department: string; role: string; status: string; phone: string; [k: string]: unknown };
export type Params = { grade: string; section: string; from: string; to: string };
export type Table = { columns: string[]; rows: (string | number)[][] };

export type AttRec = { id: string; date: string; classId: string; period: number; total?: number; marks?: Record<string, string>; submitted?: boolean; deleted?: boolean; updatedAt?: unknown };
export type PaperRec = { id: string; cycleId?: string; grade: string; subject: string; date?: string; theory?: number; internal?: number; classIds?: string[] };
export type MarkRec = { id: string; paperId: string; candId?: string; studentId?: string; theory?: number | null; internal?: number | null; medical?: boolean };
export type InvoiceRec = { id: string; no?: string; grn?: string; student?: string; grade?: string; section?: string; due?: string; balance?: number; status?: string };
export type PeriodRec = { id: string; teacherId?: string; teacher?: string };
export type SubRec = { id: string; date?: string; substituteTeacherId?: string; status?: string };
export type BusRec = { id: string; number?: string; routeName?: string };
export type TripRec = { id: string; busId: string; date: string; status?: string };
export type TrAttRec = { id: string; busId: string; date: string; boarded?: number; absent?: number; marks?: Record<string, { status?: string }> };

export type Ctx = {
  students: Stu[]; staff: Stf[]; notices: Notice[];
  attendance?: AttRec[]; papers?: PaperRec[]; marks?: MarkRec[]; invoices?: InvoiceRec[]; periods?: PeriodRec[]; subs?: SubRec[];
  buses?: BusRec[]; trips?: TripRec[]; trAttendance?: TrAttRec[];
  /** YYYY-MM-DD; defaults to the local date */
  today?: string;
};

const p2 = (n: number) => String(n).padStart(2, "0");
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const inRange = (d: string | undefined, p: Params) => (!p.from || (!!d && d >= p.from)) && (!p.to || (!!d && d <= p.to));
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 864e5);
const r1 = (n: number) => Math.round(n * 10) / 10;
export const classOf = (s: Pick<Stu, "classId" | "grade" | "section">) => s.classId || `cls_${s.grade}${s.section}`;

/** Per class and date the record that counts (contract 9: newest updatedAt, ties higher period; drafts / deleted ignored). */
export function classDays(att: AttRec[], p: Pick<Params, "from" | "to">) {
  const best = new Map<string, AttRec>();
  for (const r of att) {
    if (r.submitted === false || r.deleted === true || !r.classId || !inRange(r.date, { grade: "", section: "", ...p })) continue;
    const k = `${r.classId}|${r.date}`, c = best.get(k);
    if (!c || tsOf(r.updatedAt) > tsOf(c.updatedAt) || (tsOf(r.updatedAt) === tsOf(c.updatedAt) && (Number(r.period) || 0) > (Number(c.period) || 0))) best.set(k, r);
  }
  const byClass = new Map<string, AttRec[]>();
  best.forEach((r) => byClass.set(r.classId, [...(byClass.get(r.classId) ?? []), r]));
  return byClass;
}
/** A student's days / present / % from the class records ("A" and "E" are not present, "L" is). null when no records. */
export function studentAttendance(s: Stu, byClass: Map<string, AttRec[]>) {
  const recs = byClass.get(classOf(s)) ?? [];
  if (!recs.length) return null;
  const off = recs.filter((r) => { const m = r.marks?.[s.id]; return m === "A" || m === "E"; }).length;
  return { days: recs.length, present: recs.length - off, pct: r1(((recs.length - off) / recs.length) * 100) };
}
/** "Not due" / "0-15d" / "16-30d" / "30d+" for an unpaid invoice */
export const ageingBucket = (overdueDays: number, notDue: boolean) => (notDue ? "Not due" : overdueDays <= 15 ? "0-15d" : overdueDays <= 30 ? "16-30d" : "30d+");

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);
const recorded = (v: unknown) => (v === undefined || v === null || v === "" ? "Not recorded" : String(v));

export function generate(r: Report, ctx: Ctx, p: Params): Table {
  const today = ctx.today ?? localToday();
  const stu = ctx.students.filter((s) => (!p.grade || s.grade === p.grade) && (!p.section || s.section === p.section));
  const att = () => {
    const byClass = classDays(ctx.attendance ?? [], p);
    return (s: Stu) => {
      const a = studentAttendance(s, byClass);
      const pct = a ? a.pct : num(s.attendance);
      return { days: a ? a.days : "—", present: a ? a.present : "—", pct: pct ?? "—", ok: pct === null ? "No records" : pct >= 75 };
    };
  };
  switch (r.kind) {
    case "marks": {
      const papers = (ctx.papers ?? []).filter((x) => inRange(x.date, p));
      const marks = ctx.marks ?? [];
      const attOf = att();
      return { columns: ["GRN", "Student", "Grade", "Section", "Papers", "Obtained", "Max", "Score %", "Attendance %", "75% Rule"], rows: stu.map((s) => {
        let n = 0, got = 0, max = 0;
        for (const pp of papers) {
          if (String(pp.grade).replace(/^Grade\s+/i, "") !== String(s.grade)) continue;
          if (pp.classIds?.length && !pp.classIds.includes(classOf(s))) continue;
          const m = marks.find((x) => x.paperId === pp.id && (x.studentId === s.id || x.candId === `cand_${s.id}`));
          if (!m || (m.theory == null && m.internal == null)) continue;
          n++; got += (Number(m.theory) || 0) + (Number(m.internal) || 0); max += (Number(pp.theory) || 0) + (Number(pp.internal) || 0);
        }
        const a = attOf(s);
        return [s.grn, s.name, s.grade, s.section, n, n ? got : "—", n ? max : "—", n && max ? r1((got / max) * 100) : "—", a.pct, a.ok === "No records" ? a.ok : a.ok ? "Eligible" : "Shortage"];
      }) };
    }
    case "attendance": {
      const attOf = att();
      return { columns: ["GRN", "Student", "Grade", "Section", "Days", "Present", "Attendance %", "Status"], rows: stu.map((s) => {
        const a = attOf(s); return [s.grn, s.name, s.grade, s.section, a.days, a.present, a.pct, a.ok === "No records" ? a.ok : a.ok ? "OK" : "Below 75%"]; }) };
    }
    case "directory":
      return { columns: ["GRN", "Student", "Grade", "Section", "Guardian", "Phone", "Status"], rows: stu.map((s) => [s.grn, s.name, s.grade, s.section, s.guardian, s.phone, s.status]) };
    case "fees": {
      const inv = (ctx.invoices ?? []).filter((i) => i.status !== "Paid" && (Number(i.balance) || 0) > 0
        && (!p.grade || i.grade === p.grade) && (!p.section || i.section === p.section) && inRange(i.due, p));
      return { columns: ["Invoice", "GRN", "Student", "Grade", "Due Date", "Due (INR)", "Overdue Days", "Ageing Bucket"], rows: inv
        .map((i) => { const notDue = !i.due || i.due >= today; const od = notDue ? 0 : daysBetween(i.due!, today);
          return [i.no ?? i.id, i.grn ?? "", i.student ?? "", `${i.grade ?? ""}${i.section ? `-${i.section}` : ""}`, i.due ?? "—", Number(i.balance) || 0, od, ageingBucket(od, notDue)] as (string | number)[]; })
        .sort((a, b) => (b[6] as number) - (a[6] as number)) };
    }
    case "health":
      return { columns: ["GRN", "Student", "Grade", "Blood Group", "Height (cm)", "Weight (kg)", "BMI", "Allergy"], rows: stu.map((s) => {
        const ht = num(s.height), wt = num(s.weight);
        return [s.grn, s.name, s.grade, recorded(s.bloodGroup), recorded(ht), recorded(wt), ht && wt ? (wt / ((ht / 100) ** 2)).toFixed(1) : "—", recorded(s.allergy ?? s.allergies)]; }) };
    case "workload": {
      const periods = ctx.periods ?? [], subs = (ctx.subs ?? []).filter((x) => x.status !== "Declined" && inRange(x.date, p));
      return { columns: ["Emp ID", "Name", "Department", "Role", "Periods / week", "Proxy duties", "Within 32 periods cap"], rows: ctx.staff.map((s) => {
        const per = periods.filter((x) => x.teacherId === s.id || (!x.teacherId && !!x.teacher && x.teacher === s.name)).length;
        return [s.empId, s.name, s.department, s.role, per, subs.filter((x) => x.substituteTeacherId === s.id).length, per <= 32 ? "Yes" : "No"]; }) };
    }
    case "staffdir":
      return { columns: ["Emp ID", "Name", "Department", "Role", "Phone", "Status"], rows: ctx.staff.map((s) => [s.empId, s.name, s.department, s.role, s.phone, s.status]) };
    case "delivery":
      return { columns: ["Notice", "Audience", "Sent At", "Recipients", "Delivered", "Read", "Delivery %"], rows: ctx.notices.filter((n) => n.status === "Published"
        && inRange((n.sentAt ?? "").slice(0, 10), p)).map((n) => { const rec = Number(n.recipients) || 0, del = Number(n.delivered) || 0;
        return [n.title, n.audience, (n.sentAt ?? "").slice(0, 16).replace("T", " "), rec, del, Number(n.read) || 0, rec ? r1((del / rec) * 100) : 0]; }) };
    case "transport": {
      const trips = (ctx.trips ?? []).filter((t) => inRange(t.date, p)), marks = (ctx.trAttendance ?? []).filter((t) => inRange(t.date, p));
      const count = (a: TrAttRec, st: "boarded" | "absent") => num(a[st]) ?? Object.values(a.marks ?? {}).filter((m) => m?.status === st).length;
      return { columns: ["Route", "Bus", "Students", "Trips", "Completed", "Boarded marks", "Absent marks"], rows: (ctx.buses ?? []).map((b) => {
        const t = trips.filter((x) => x.busId === b.id), m = marks.filter((x) => x.busId === b.id);
        return [b.routeName ?? "—", b.number ? `Bus ${b.number}` : b.id, ctx.students.filter((s) => s.busId === b.id).length, t.length, t.filter((x) => x.status === "completed").length,
          m.reduce((a, x) => a + count(x, "boarded"), 0), m.reduce((a, x) => a + count(x, "absent"), 0)]; }) };
    }
    default:
      return { columns: ["Info"], rows: [["No data"]] };
  }
}
