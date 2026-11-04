import { describe, expect, it } from "vitest";
import { ageingBucket, classDays, generate, studentAttendance, type AttRec, type Ctx, type Params, type Stu } from "./reportData";
import type { Notice, Report } from "./types";

const P: Params = { grade: "", section: "", from: "", to: "" };
const rep = (kind: string) => ({ id: `rep_${kind}`, kind, title: kind }) as Report;
const stu = (o: Partial<Stu>): Stu => ({ id: "stu_1", name: "Asha", grn: "G-1", grade: "8", section: "A", guardian: "Mr. A", phone: "98100", status: "Active", attendance: 90, ...o });
const base: Ctx = {
  today: "2026-11-03",
  students: [stu({}), stu({ id: "stu_2", name: "Ravi", grn: "G-2", attendance: 60 }), stu({ id: "stu_3", name: "Meera", grn: "G-3", grade: "9", section: "B", busId: "bus_01" })],
  staff: [{ id: "stf_1", name: "Mrs. A", empId: "E1", department: "Maths", role: "TGT", status: "Active", phone: "1" }, { id: "stf_2", name: "Mr. B", empId: "E2", department: "Sci", role: "PGT", status: "Active", phone: "2" }],
  notices: [],
};

describe("attendance from ops_attendance", () => {
  const att: AttRec[] = [
    { id: "1", date: "2026-11-02", classId: "cls_8A", period: 1, marks: { stu_1: "A" }, updatedAt: 1 },
    { id: "2", date: "2026-11-02", classId: "cls_8A", period: 2, marks: {}, updatedAt: 2 }, // newer record of the day wins: stu_1 present
    { id: "3", date: "2026-11-03", classId: "cls_8A", period: 1, marks: { stu_1: "E", stu_2: "L" }, updatedAt: 3 },
    { id: "4", date: "2026-11-03", classId: "cls_8A", period: 2, marks: { stu_1: "A" }, submitted: false, updatedAt: 9 }, // draft ignored
  ];
  it("one record per class and day; E counts as not present, L as present", () => {
    const by = classDays(att, P);
    expect(by.get("cls_8A")!.map((r) => r.id).sort()).toEqual(["2", "3"]);
    expect(studentAttendance(base.students[0]!, by)).toEqual({ days: 2, present: 1, pct: 50 });
    expect(studentAttendance(base.students[1]!, by)).toEqual({ days: 2, present: 2, pct: 100 });
    expect(studentAttendance(base.students[2]!, by)).toBeNull();
  });
  it("the register uses the records and falls back to the stored percentage", () => {
    const t = generate(rep("attendance"), { ...base, attendance: att }, P);
    expect(t.columns).toEqual(["GRN", "Student", "Grade", "Section", "Days", "Present", "Attendance %", "Status"]);
    expect(t.rows).toEqual([
      ["G-1", "Asha", "8", "A", 2, 1, 50, "Below 75%"],
      ["G-2", "Ravi", "8", "A", 2, 2, 100, "OK"],
      ["G-3", "Meera", "9", "B", "—", "—", 90, "OK"],
    ]);
  });
  it("date range and grade / section filters", () => {
    const t = generate(rep("attendance"), { ...base, attendance: att }, { ...P, grade: "8", from: "2026-11-03", to: "2026-11-03" });
    expect(t.rows.map((r) => [r[0], r[4], r[6]])).toEqual([["G-1", 1, 0], ["G-2", 1, 100]]);
    expect(generate(rep("directory"), base, { ...P, section: "B" }).rows).toEqual([["G-3", "Meera", "9", "B", "Mr. A", "98100", "Active"]]);
  });
});

describe("marks", () => {
  it("sums each student's marks over the grade's papers; students without marks show dashes", () => {
    const ctx: Ctx = { ...base,
      papers: [{ id: "p1", grade: "8", subject: "Maths", theory: 80, internal: 20, date: "2026-10-10" }, { id: "p2", grade: "8", subject: "Sci", theory: 80, internal: 20, date: "2026-10-12" }, { id: "p9", grade: "9", subject: "Maths", theory: 80, internal: 20 }],
      marks: [{ id: "m1", paperId: "p1", studentId: "stu_1", theory: 60, internal: 15 }, { id: "m2", paperId: "p2", candId: "cand_stu_1", theory: 70, internal: null }, { id: "m3", paperId: "p1", studentId: "stu_2", theory: null, internal: null, medical: true }] };
    const t = generate(rep("marks"), ctx, P);
    expect(t.rows[0]).toEqual(["G-1", "Asha", "8", "A", 2, 145, 200, 72.5, 90, "Eligible"]);
    expect(t.rows[1]).toEqual(["G-2", "Ravi", "8", "A", 0, "—", "—", "—", 60, "Shortage"]);
    expect(generate(rep("marks"), ctx, { ...P, from: "2026-10-11" }).rows[0]!.slice(4, 8)).toEqual([1, 70, 100, 70]);
  });
});

describe("fees", () => {
  it("unpaid invoices with ageing from the due date, most overdue first", () => {
    const ctx: Ctx = { ...base, invoices: [
      { id: "i1", no: "INV-1", grn: "G-1", student: "Asha", grade: "8", section: "A", due: "2026-10-29", balance: 3000, status: "Partial" },
      { id: "i2", no: "INV-2", grn: "G-2", student: "Ravi", grade: "8", section: "A", due: "2026-09-01", balance: 5000, status: "Overdue" },
      { id: "i3", no: "INV-3", grade: "9", due: "2026-11-20", balance: 100, status: "Pending" },
      { id: "i4", no: "INV-4", grade: "8", due: "2026-09-01", balance: 0, status: "Paid" },
    ] };
    const t = generate(rep("fees"), ctx, P);
    expect(t.rows).toEqual([
      ["INV-2", "G-2", "Ravi", "8-A", "2026-09-01", 5000, 63, "30d+"],
      ["INV-1", "G-1", "Asha", "8-A", "2026-10-29", 3000, 5, "0-15d"],
      ["INV-3", "", "", "9", "2026-11-20", 100, 0, "Not due"],
    ]);
    expect(ageingBucket(16, false)).toBe("16-30d");
    expect(ageingBucket(30, false)).toBe("16-30d");
    expect(ageingBucket(31, false)).toBe("30d+");
  });
});

describe("health, workload, transport, delivery", () => {
  it("health shows recorded values only (no invented numbers)", () => {
    const t = generate(rep("health"), { ...base, students: [stu({ bloodGroup: "O+", height: 150, weight: 45 }), stu({ id: "x" })] }, P);
    expect(t.rows).toEqual([["G-1", "Asha", "8", "O+", "150", "45", "20.0", "Not recorded"], ["G-1", "Asha", "8", "Not recorded", "Not recorded", "Not recorded", "—", "Not recorded"]]);
  });
  it("workload counts timetable periods and non-declined substitutions", () => {
    const ctx: Ctx = { ...base, periods: [...Array(33)].map((_, i) => ({ id: `p${i}`, teacherId: "stf_2" })).concat([{ id: "n1", teacherId: undefined as unknown as string, teacher: "Mrs. A" } as never]),
      subs: [{ id: "s1", substituteTeacherId: "stf_1", status: "Accepted", date: "2026-11-01" }, { id: "s2", substituteTeacherId: "stf_1", status: "Declined", date: "2026-11-01" }] };
    expect(generate(rep("workload"), ctx, P).rows).toEqual([["E1", "Mrs. A", "Maths", "TGT", 1, 1, "Yes"], ["E2", "Mr. B", "Sci", "PGT", 33, 0, "No"]]);
  });
  it("transport per bus from tr_trips / tr_attendance", () => {
    const ctx: Ctx = { ...base, buses: [{ id: "bus_01", number: "14", routeName: "Route 4B" }],
      trips: [{ id: "t1", busId: "bus_01", date: "2026-11-02", status: "completed" }, { id: "t2", busId: "bus_01", date: "2026-11-03", status: "active" }],
      trAttendance: [{ id: "a1", busId: "bus_01", date: "2026-11-02", boarded: 1, absent: 0 }, { id: "a2", busId: "bus_01", date: "2026-11-03", marks: { stu_3: { status: "absent" } } }] };
    expect(generate(rep("transport"), ctx, P).rows).toEqual([["Route 4B", "Bus 14", 1, 2, 1, 1, 1]]);
  });
  it("delivery lists published notices in the date range", () => {
    const n = (o: Partial<Notice>) => ({ id: "n", title: "T", audience: "All School", status: "Published", sentAt: "2026-11-02T08:00:00.000Z", recipients: 10, delivered: 10, read: 4, ...o }) as Notice;
    const t = generate(rep("delivery"), { ...base, notices: [n({}), n({ title: "Draft", status: "Draft" }), n({ title: "Old", sentAt: "2026-10-01T08:00:00Z" }), n({ title: "Zero", recipients: 0, delivered: 0 })] }, { ...P, from: "2026-11-01" });
    expect(t.rows).toEqual([["T", "All School", "2026-11-02 08:00", 10, 10, 4, 100], ["Zero", "All School", "2026-11-02 08:00", 0, 0, 4, 0]]);
  });
  it("unknown kinds give a placeholder table", () => {
    expect(generate(rep("nope"), base, P)).toEqual({ columns: ["Info"], rows: [["No data"]] });
  });
});
