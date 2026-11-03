import { describe, expect, it } from "vitest";
import {
  avg, ayOf, dataExceptions, dayAttendance, dayName, deriveAlerts, eventClashes, filterNotifs, fmtHrs, groupNotifs, isIngestionPhase, isOverdue,
  latestDayRecords, leaveDecisionPatch, notifAt, notifGroup, pendingOnly, sortNotifs, spanDays, staffOnLeave, termOf, timeRange, tsOf, turnaround,
  unreadCount, validateEvent, workingDaysIn, type AttRec, type EventForm,
} from "./logic";
import type { Approval, CalEvent, Notif } from "./data";

const rec = (o: Partial<AttRec>): AttRec => ({ id: "r", date: "2026-11-03", classId: "cls_10B", period: 1, total: 40, marks: {}, ...o });

describe("tsOf", () => {
  it("reads ISO strings, epoch ms and Firestore timestamps; 0 for anything else", () => {
    expect(tsOf("2026-11-03T08:00:00.000Z")).toBe(Date.parse("2026-11-03T08:00:00.000Z"));
    expect(tsOf(1234)).toBe(1234);
    expect(tsOf({ toMillis: () => 99 })).toBe(99);
    expect(tsOf({ seconds: 2 })).toBe(2000);
    expect(tsOf(undefined)).toBe(0);
    expect(tsOf("not a date")).toBe(0);
  });
  it("dayName gives the ops_periods day", () => {
    expect(dayName("2026-11-03")).toBe("Tue");
    expect(dayName("2026-11-08")).toBe("Sun");
  });
});

describe("latestDayRecords / dayAttendance (contract 9)", () => {
  it("keeps, per class, the newest updatedAt record of the day; ties go to the higher period", () => {
    const m = latestDayRecords([
      rec({ id: "p1", period: 1, updatedAt: "2026-11-03T03:00:00Z" }),
      rec({ id: "p3", period: 3, updatedAt: "2026-11-03T05:00:00Z" }),
      rec({ id: "p2", period: 2, updatedAt: "2026-11-03T04:00:00Z" }),
      rec({ id: "a1", classId: "cls_8A", period: 1, updatedAt: "2026-11-03T05:00:00Z" }),
      rec({ id: "a2", classId: "cls_8A", period: 2, updatedAt: "2026-11-03T05:00:00Z" }),
    ], "2026-11-03");
    expect(m.get("cls_10B")?.id).toBe("p3");
    expect(m.get("cls_8A")?.id).toBe("a2");
  });
  it("an admin day record (period 0) edited later wins over the teacher's periods", () => {
    const m = latestDayRecords([rec({ id: "p4", period: 4, updatedAt: 100 }), rec({ id: "day", period: 0, updatedAt: 200 })], "2026-11-03");
    expect(m.get("cls_10B")?.id).toBe("day");
  });
  it("ignores drafts, deleted records and other days", () => {
    const m = latestDayRecords([
      rec({ id: "draft", submitted: false, updatedAt: 999 }), rec({ id: "del", deleted: true, updatedAt: 998 }),
      rec({ id: "old", date: "2026-11-02", updatedAt: 997 }), rec({ id: "ok", updatedAt: 1 }),
    ], "2026-11-03");
    expect([...m.values()].map((r) => r.id)).toEqual(["ok"]);
  });
  it("counts A as absent, A + E as not in, L as present", () => {
    const a = dayAttendance([rec({ total: 40, marks: { s1: "A", s2: "E", s3: "L" } }), rec({ classId: "cls_8A", total: 10, marks: { s9: "A" } })], "2026-11-03");
    expect(a).toMatchObject({ total: 50, absent: 2, notIn: 3, classes: 2 });
    expect(a.pct).toBeCloseTo(94);
  });
  it("pct is null when nothing is marked", () => {
    expect(dayAttendance([], "2026-11-03").pct).toBeNull();
    expect(dayAttendance([rec({ total: 0 })], "2026-11-03").pct).toBeNull();
  });
});

describe("isOverdue / staffOnLeave", () => {
  it("status Overdue, or a balance past its due date (not Paid)", () => {
    expect(isOverdue({ id: "1", balance: 0, status: "Overdue" }, "2026-11-03")).toBe(true);
    expect(isOverdue({ id: "2", balance: 500, status: "Partial", due: "2026-11-02" }, "2026-11-03")).toBe(true);
    expect(isOverdue({ id: "3", balance: 500, status: "Pending", due: "2026-11-03" }, "2026-11-03")).toBe(false);
    expect(isOverdue({ id: "4", balance: 0, status: "Paid", due: "2026-10-01" }, "2026-11-03")).toBe(false);
    expect(isOverdue({ id: "5", balance: 500, status: "Pending" }, "2026-11-03")).toBe(false);
  });
  it("on leave: status On leave or an Approved leave covering the day (inclusive)", () => {
    const staff = [{ id: "a", name: "A", status: "On leave" }, { id: "b", name: "B", status: "Active" }, { id: "c", name: "C", status: "Active" }, { id: "d", name: "D" }];
    const leaves = [
      { id: "l1", staffId: "b", from: "2026-11-01", to: "2026-11-03", status: "Approved" },
      { id: "l2", staffId: "c", from: "2026-11-03", to: "2026-11-03", status: "Pending" },
      { id: "l3", staffId: "d", from: "2026-11-03", status: "Approved" },
      { id: "l4", staffId: "c", from: "2026-11-01", to: "2026-11-05", status: "Approved", deleted: true },
    ];
    expect([...staffOnLeave(staff, leaves, "2026-11-03")].sort()).toEqual(["a", "b", "d"]);
    expect([...staffOnLeave(staff, leaves, "2026-11-04")].sort()).toEqual(["a"]);
  });
});

describe("deriveAlerts", () => {
  const base = { today: "2026-11-03", staff: [{ id: "stf_1", name: "Mr. Verma", status: "Active" }], leaves: [{ id: "l1", staffId: "stf_1", from: "2026-11-03", to: "2026-11-03", status: "Approved" }],
    periods: [
      { id: "p1", classId: "cls_8C", grade: "8", section: "C", day: "Tue", period: 3, subject: "Science", teacherId: "stf_1" },
      { id: "p2", grade: "9", section: "A", day: "Tue", period: 1, subject: "Physics", teacherId: "stf_1" },
      { id: "p3", classId: "cls_8C", grade: "8", section: "C", day: "Wed", period: 2, subject: "Science", teacherId: "stf_1" },
    ], subs: [], invoices: [], buses: [] };
  it("flags uncovered periods of a teacher on leave today, in period order", () => {
    const [a, ...rest] = deriveAlerts(base);
    expect(rest).toHaveLength(0);
    expect(a).toMatchObject({ id: "sub_stf_1", kind: "substitute", title: "SUBSTITUTE REQUIRED", tag: "P1, P3", href: "/timetable", status: "open", derived: true });
    expect(a!.body).toBe("Mr. Verma is on leave: Gr 9-A Physics, Gr 8-C Science need cover.");
  });
  it("a substitution (not declined) covers the period", () => {
    const a = deriveAlerts({ ...base, subs: [
      { id: "s1", date: "2026-11-03", classId: "cls_9A", period: 1, status: "Accepted", substituteTeacherId: "stf_2" },
      { id: "s2", date: "2026-11-03", classId: "cls_8C", period: 3, status: "Declined", substituteTeacherId: "stf_3" },
    ] });
    expect(a[0]).toMatchObject({ tag: "P3" });
    const none = deriveAlerts({ ...base, subs: [
      { id: "s1", date: "2026-11-03", classId: "cls_9A", period: 1, status: "Assigned", substituteTeacherId: "stf_2" },
      { id: "s3", date: "2026-11-03", classId: "cls_8C", period: 3, status: "Assigned", substituteTeacherId: "stf_2" },
    ] });
    expect(none).toEqual([]);
  });
  it("adds one fee alert for overdue invoices and one per bus in maintenance", () => {
    const a = deriveAlerts({ ...base, leaves: [], invoices: [{ id: "i1", balance: 30000, status: "Partial", due: "2026-10-01" }, { id: "i2", balance: 12000, status: "Overdue" }, { id: "i3", balance: 100, status: "Pending", due: "2026-12-01" }],
      buses: [{ id: "bus_01", number: "14", routeName: "Route 4B", status: "Maintenance", studentCount: 1 }, { id: "bus_02", status: "Active" }] });
    expect(a.map((x) => x.id)).toEqual(["fee_overdue", "bus_bus_01"]);
    expect(a[0]).toMatchObject({ tag: "2 Accounts", body: "₹42,000 is overdue across 2 invoices.", href: "/fees" });
    expect(a[1]).toMatchObject({ kind: "transit", tag: "Bus 14", body: "Route 4B: 1 student needs another bus.", href: "/transport" });
  });
});

describe("approval helpers", () => {
  it("turnaround in hours; null when missing or out of order", () => {
    expect(turnaround({ submitted: "2026-11-03T08:00:00", decidedAt: "2026-11-03T10:30:00" })).toBe(2.5);
    expect(turnaround({ submitted: "2026-11-03T10:00:00", decidedAt: "2026-11-03T08:00:00" })).toBeNull();
    expect(turnaround({ submitted: "", decidedAt: "2026-11-03T08:00:00" })).toBeNull();
    expect(fmtHrs(null)).toBe("—");
    expect(fmtHrs(0.25)).toBe("15 min");
    expect(fmtHrs(2.54)).toBe("2.5 hrs");
    expect(avg([])).toBeNull();
    expect(avg([1, 2, 6])).toBe(3);
  });
  it("pendingOnly drops decided and unknown ids", () => {
    const rows = [{ id: "a", status: "pending" }, { id: "b", status: "approved" }] as Approval[];
    expect(pendingOnly(rows, ["a", "b", "zz"])).toEqual(["a"]);
  });
  it("leaveDecisionPatch writes the contract status strings and clears them on reopen", () => {
    expect(leaveDecisionPatch("approved", "u1", "", "T")).toEqual({ status: "Approved", decidedBy: "u1", decidedAt: "T", decisionNote: "" });
    expect(leaveDecisionPatch("rejected", "u1", "Exams week", "T")).toEqual({ status: "Rejected", decidedBy: "u1", decidedAt: "T", decisionNote: "Exams week" });
    expect(leaveDecisionPatch("pending", "u1", "x", "T")).toEqual({ status: "Pending", decidedBy: "", decidedAt: "", decisionNote: "" });
  });
});

describe("notification helpers", () => {
  const n = (id: string, createdAt: string, o: Partial<Notif> = {}) => ({ id, category: "ops", title: id, body: "", createdAt, read: false, ...o });
  const rows = [
    n("old", "2026-10-30T09:00:00", { read: true, category: "approvals", title: "Leave request", body: "Anita applied" }),
    n("today2", "2026-11-03T11:00:00"),
    n("y", "2026-11-02T23:59:59", { category: "approvals" }),
    n("today1", "2026-11-03T08:00:00", { read: true }),
    { ...n("legacy", ""), createdAt: undefined as unknown as string, at: "2026-11-03T07:00:00" },
  ];
  it("groups by day (tolerating `at` on older rows) and counts unread", () => {
    expect(notifAt(rows[4]!)).toBe("2026-11-03T07:00:00");
    expect(notifGroup(rows[2]!, "2026-11-03")).toBe("YESTERDAY");
    expect(groupNotifs(sortNotifs(rows), "2026-11-03").map((g) => [g.g, g.items.map((i) => i.id)])).toEqual([
      ["TODAY", ["today2", "today1", "legacy"]], ["YESTERDAY", ["y"]], ["EARLIER", ["old"]]]);
    expect(unreadCount(rows)).toBe(3);
    expect(groupNotifs([], "2026-11-03")).toEqual([]);
  });
  it("filters by tab and a case-insensitive search over title and body, newest first", () => {
    expect(filterNotifs(rows, "approvals", "").map((r) => r.id)).toEqual(["y", "old"]);
    expect(filterNotifs(rows, "all", "ANITA").map((r) => r.id)).toEqual(["old"]);
    expect(filterNotifs(rows, "finance", "")).toEqual([]);
  });
});

describe("calendar helpers", () => {
  it("academic year runs April to March", () => {
    expect(ayOf("2026-11-03")).toEqual({ y: 2026, start: "2026-04-01", t2: "2026-11-01", end: "2027-03-31" });
    expect(ayOf("2027-02-10").y).toBe(2026);
    expect(ayOf("2026-04-01").y).toBe(2026);
    expect(ayOf("2026-03-31").y).toBe(2025);
  });
  it("working days skip Sundays and holiday ranges", () => {
    // 2026-11-02 Mon .. 2026-11-08 Sun = 6 working days
    expect(workingDaysIn("2026-11-02", "2026-11-08", [])).toBe(6);
    expect(workingDaysIn("2026-11-02", "2026-11-08", [{ start: "2026-11-04", end: "2026-11-05" }])).toBe(4);
    expect(workingDaysIn("2026-11-08", "2026-11-02", [])).toBe(0);
  });
  it("spanDays is inclusive and termOf splits Apr–Oct / Nov–Mar", () => {
    expect(spanDays({ start: "2026-11-03", end: "2026-11-03" })).toBe(1);
    expect(spanDays({ start: "2026-10-30", end: "2026-11-02" })).toBe(4);
    expect(spanDays({ start: "2026-11-03", end: "2026-11-01" })).toBe(1);
    expect(termOf("2026-10-31")).toBe("Term 1");
    expect(termOf("2026-11-01")).toBe("Term 2");
    expect(termOf("2027-03-31")).toBe("Term 2");
    expect(termOf("2026-04-01")).toBe("Term 1");
  });
  it("timeRange shows All day for all-day / timeless events", () => {
    expect(timeRange({ startTime: "08:30", endTime: "14:30" })).toBe("08:30 – 14:30");
    expect(timeRange({ startTime: "", endTime: "", allDay: true })).toBe("All day");
    expect(timeRange({ startTime: "", endTime: "" })).toBe("All day");
  });
  it("eventClashes: published, overlapping, same non-shared venue or same lead; never the event itself", () => {
    const ev = (o: Partial<CalEvent>) => ({ id: "e", title: "E", status: "published", start: "2026-11-10", end: "2026-11-12", venue: "Main Field", lead: "", ...o }) as CalEvent;
    const events = [ev({ id: "venue" }), ev({ id: "draft", status: "draft" }), ev({ id: "campus", venue: "Main Campus" }), ev({ id: "lead", venue: "Hall", lead: "Mrs. A" }), ev({ id: "later", start: "2026-11-13", end: "2026-11-13" })];
    expect(eventClashes(events, { start: "2026-11-12", end: "2026-11-12", venue: "Main Field", lead: "Mrs. A" }).map((e) => e.id)).toEqual(["venue", "lead"]);
    expect(eventClashes(events, { id: "venue", start: "2026-11-12", end: "2026-11-12", venue: "Main Field", lead: "" }).map((e) => e.id)).toEqual([]);
    expect(eventClashes(events, { start: "2026-11-11", end: "2026-11-11", venue: "Main Campus", lead: "" })).toEqual([]);
  });
});

describe("validateEvent", () => {
  const ok: EventForm = { title: "Sports Day", category: "sports", start: "2026-11-10", end: "2026-11-10", allDay: false, startTime: "08:30", endTime: "14:30" };
  it("accepts a valid timed event and a valid all-day multi-day event", () => {
    expect(validateEvent(ok)).toEqual({});
    expect(validateEvent({ ...ok, allDay: true, startTime: "", endTime: "", end: "2026-11-12" })).toEqual({});
  });
  it("requires a title, a known classification and both dates", () => {
    expect(validateEvent({ ...ok, title: "   ", category: "", start: "", end: "" })).toEqual({
      title: "Event title is required", category: "Choose a classification", start: "Start date is required", end: "End date is required" });
  });
  it("end date on or after start; end time after start time on a single day only", () => {
    expect(validateEvent({ ...ok, end: "2026-11-09" }).end).toBe("End date must be on or after start date");
    expect(validateEvent({ ...ok, endTime: "08:30" }).endTime).toBe("End time must be after start time");
    expect(validateEvent({ ...ok, end: "2026-11-11", endTime: "08:00" })).toEqual({});
  });
  it("timed events need both times (all-day ones need none)", () => {
    expect(validateEvent({ ...ok, startTime: "", endTime: "25:00" })).toEqual({ startTime: "Start time is required", endTime: "End time is required" });
    expect(validateEvent({ ...ok, allDay: true, startTime: "", endTime: "" })).toEqual({});
  });
});

describe("setup data exceptions", () => {
  const s = (o: Record<string, unknown>) => ({ id: "stu_1", name: "Aarav", grn: "GRN-1", grade: "8", section: "A", classId: "cls_8A", guardian: "Mr. A", phone: "+91 98100 00001", status: "Active", ...o });
  it("a complete active record has no exception", () => {
    expect(dataExceptions([s({})])).toEqual([]);
  });
  it("flags missing / duplicate GRN, no class, no guardian and a short phone, with the fix link", () => {
    const out = dataExceptions([
      s({ id: "a", name: "Asha", grn: "" }),
      s({ id: "b", grn: "grn-7" }), s({ id: "c", grn: "GRN-7" }),
      s({ id: "d", classId: "", section: "", guardian: " ", phone: "98100" }),
      s({ id: "e", phone: "", status: "Transferred", grn: "" }),
    ]);
    expect(out.map((e) => e.id)).toEqual(["dx_grn_a", "dx_grn_b", "dx_grn_c", "dx_class_d", "dx_guardian_d", "dx_contact_d"]);
    expect(out[0]).toMatchObject({ status: "GRN Missing", kind: "grn", href: "/students?q=Asha", resolved: false, derived: true, action: "Fix in Students" });
    expect(out[1]!.issue).toBe("GRN grn-7 is used by 2 active students");
    expect(out[5]).toMatchObject({ status: "Invalid Phone", issue: "Guardian phone has only 5 digits" });
  });
  it("only the ingestion phase is gated", () => {
    expect(isIngestionPhase({ no: 7, title: "Data Sync & Ingestion" })).toBe(true);
    expect(isIngestionPhase({ no: 3, title: "Data Import" })).toBe(true);
    expect(isIngestionPhase({ no: 1, title: "School Profile" })).toBe(false);
  });
});
