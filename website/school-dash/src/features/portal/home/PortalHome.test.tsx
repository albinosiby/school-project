import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PortalHome, todaySlots } from "./PortalHome";
import { authState, getRow, renderUI, screen, seed, within } from "@/test/render";

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const clerk = { ...teacher, id: "uid_c", email: "c@s.in", role: "staff" as const, staffId: "stf_9", staffRole: "accountant", name: "Ravi" };
const staff = [{ id: "stf_1", name: "Anita Sharma", department: "Mathematics", designation: "Senior Teacher" }, { id: "stf_9", name: "Ravi Menon", department: "Accounts", designation: "Accountant" }];
// 2026-11-23 is a Monday
const periods = [
  { id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Mathematics", teacher: "Anita Sharma", teacherId: "stf_1", room: "R12" },
  { id: "per_9A_Mon_4", classId: "cls_9A", grade: "9", section: "A", day: "Mon", period: 4, subject: "Mathematics", teacher: "Anita Sharma", teacherId: "stf_1", room: "" },
  { id: "per_10B_Tue_1", classId: "cls_10B", grade: "10", section: "B", day: "Tue", period: 1, subject: "Mathematics", teacher: "Anita Sharma", teacherId: "stf_1", room: "R12" },
  { id: "per_8C_Mon_2", classId: "cls_8C", grade: "8", section: "C", day: "Mon", period: 2, subject: "English", teacher: "Someone", teacherId: "stf_2", room: "" },
];
const subs = [
  { id: "sub_2026-11-23_cls_7A_3", date: "2026-11-23", day: "Mon", period: 3, classId: "cls_7A", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Assigned" },
  { id: "sub_2026-11-23_cls_7B_5", date: "2026-11-23", day: "Mon", period: 5, classId: "cls_7B", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Declined" },
  { id: "sub_2026-11-25_cls_7A_1", date: "2026-11-25", day: "Wed", period: 1, classId: "cls_7A", subject: "Science", absentTeacherId: "stf_2", substituteTeacherId: "stf_1", status: "Assigned" },
  { id: "sub_2026-11-23_cls_6A_1", date: "2026-11-23", day: "Mon", period: 1, classId: "cls_6A", subject: "Hindi", absentTeacherId: "stf_2", substituteTeacherId: "stf_3", status: "Assigned" },
];
const notices = [
  { id: "n_new", title: "Staff meeting on Friday", category: "Staff", audience: "All Staff", status: "Published", sentAt: "2026-11-22T08:00:00.000Z", body: "3 pm in the library", author: "Principal", pinned: false, urgent: false },
  { id: "n_old", title: "Diwali holidays", category: "Holiday", audience: "All School", status: "Published", sentAt: "2026-10-20T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
  { id: "n_parents", title: "PTM slots", category: "Academic", audience: "Parents", status: "Published", sentAt: "2026-11-23T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
  { id: "n_draft", title: "Draft circular", category: "Staff", audience: "All Staff", status: "Draft", sentAt: "2026-11-23T08:00:00.000Z", body: "", author: "Office", pinned: false, urgent: false },
];

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 9, 0, 0)); authState.user = teacher; });
afterEach(() => vi.useRealTimers());

describe("todaySlots", () => {
  it("overlays today's non-declined substitutions on the weekday's own periods, in period order", () => {
    const slots = todaySlots(periods.filter((p) => p.teacherId === "stf_1"), subs.filter((s) => s.substituteTeacherId === "stf_1") as never, "2026-11-23");
    expect(slots.map((s) => `${s.period}:${s.classId}${s.cover ? ":cover" : ""}`)).toEqual(["1:cls_10B", "3:cls_7A:cover", "4:cls_9A"]);
    expect(slots[0]!.time).toBe("08:30");
  });
});

describe("PortalHome (teacher)", () => {
  it("greets, shows today's periods with the substitution, pending covers, leave status and notices", () => {
    seed({ staff, ops_periods: periods, ops_substitutions: subs, com_notices: notices,
      staff_leaves: [{ id: "lv1", staffId: "stf_1", type: "Casual Leave", from: "2026-11-27", to: "2026-11-27", days: 1, reason: "Function", status: "Pending", createdAt: "2026-11-20T09:00:00.000Z" }, { id: "lv_other", staffId: "stf_2", type: "Casual Leave", from: "2026-11-24", to: "2026-11-24", days: 1, reason: "x", status: "Approved", createdAt: "2026-11-22T09:00:00.000Z" }],
      att_circulars: [{ id: "n_old", teacherId: "stf_1", read: true }] });
    renderUI(<PortalHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning, Anita Sharma");
    expect(screen.getByText("Senior Teacher")).toBeInTheDocument();
    const items = within(screen.getByRole("list", { name: "Today's periods" })).getAllByRole("listitem").map((li) => li.textContent);
    expect(items).toHaveLength(3);
    expect(items[0]).toContain("P1");
    expect(items[0]).toContain("Grade 10-B · Mathematics · R12");
    expect(items[1]).toContain("Grade 7-A · Science");
    expect(items[1]).toContain("Substitution · to accept");
    expect(items[2]).toContain("Grade 9-A");
    expect(screen.getByText("Pending substitutions").closest("a")).toHaveAttribute("href", "/me/substitutions");
    expect(screen.getByText("Pending substitutions").parentElement!.parentElement).toHaveTextContent("2");
    const leave = screen.getByRole("group", { name: "Leave status" });
    expect(leave).toHaveTextContent("Casual Leave");
    expect(leave).toHaveTextContent("Pending");
    expect(leave).toHaveTextContent("2026-11-27 · 1 day");
    expect(screen.getByText("Staff meeting on Friday")).toBeInTheDocument();
    expect(screen.getByText("Diwali holidays")).toBeInTheDocument();
    expect(screen.queryByText("PTM slots")).not.toBeInTheDocument();
    expect(screen.queryByText("Draft circular")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All notices (1 new)" })).toHaveAttribute("href", "/me/notices");
    screen.getAllByRole("link", { name: "My timetable" }).forEach((a) => expect(a).toHaveAttribute("href", "/me/timetable"));
    expect(screen.getByRole("link", { name: "Marks entry" })).toBeInTheDocument();
  });

  it("Check in writes today's staff_attendance doc (Late after checkInBy) and Check out adds `out`", async () => {
    seed({ staff, set_leave_policy: [{ id: "policy", types: [], checkInBy: "08:15" }] });
    const { user } = renderUI(<PortalHome />);
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(getRow("staff_attendance", "2026-11-23_stf_1")).toEqual({ id: "2026-11-23_stf_1", staffId: "stf_1", date: "2026-11-23", in: "09:00", out: null, status: "Late", note: "", source: "web", teacherId: "stf_1", updatedAt: expect.stringMatching(ISO), updatedBy: "uid_t" });
    expect(screen.getByText("Late")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check out" }));
    expect(await screen.findByText("Checked out")).toBeInTheDocument();
    expect(getRow("staff_attendance", "2026-11-23_stf_1")).toMatchObject({ in: "09:00", out: "09:00", status: "Late", source: "web" });
    expect(screen.getByText("Day complete")).toBeInTheDocument();
  });

  it("is Present when checking in before the school's start time", async () => {
    seed({ staff, set_leave_policy: [{ id: "policy", types: [], checkInBy: "09:30" }] });
    const { user } = renderUI(<PortalHome />);
    await user.click(screen.getByRole("button", { name: "Check in" }));
    expect(await screen.findByText("Checked in")).toBeInTheDocument();
    expect(getRow("staff_attendance", "2026-11-23_stf_1")).toMatchObject({ status: "Present", in: "09:00" });
  });

  it("shows empty states when nothing is on today", () => {
    seed({ staff });
    renderUI(<PortalHome />);
    expect(screen.getByText("No periods today")).toBeInTheDocument();
    expect(screen.getByText("No leave requests yet.")).toBeInTheDocument();
    expect(screen.getByText("No notices yet.")).toBeInTheDocument();
    expect(screen.getByText("Pending substitutions").parentElement!.parentElement).toHaveTextContent("0");
  });
});

describe("PortalHome now card, attention and quick actions", () => {
  const reg = (extra: Record<string, unknown> = {}) => ({ id: "2026-11-23_cls_10B_1", date: "2026-11-23", classId: "cls_10B", grade: "10", section: "B", period: 1, total: 30, marks: { stu_1: "A", stu_2: "L" }, submitted: true, teacherId: "stf_1", ...extra });

  it("offers Mark attendance for the live period while it has no register, and lists the unmarked period", () => {
    seed({ staff, ops_periods: periods, ops_substitutions: subs, ops_attendance: [reg({ submitted: false })], classes: [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_1" }] });
    renderUI(<PortalHome />);
    const now = screen.getByRole("region", { name: "Now" });
    expect(now).toHaveTextContent("NOW · PERIOD 1");
    expect(now).toHaveTextContent("Grade 10-B");
    expect(now).toHaveTextContent("30 of 45 mins (67%)");
    expect(within(now).getByRole("link", { name: "Mark attendance" })).toHaveAttribute("href", "/me/attendance?classId=cls_10B&period=1&date=2026-11-23");
    expect(now).not.toHaveTextContent("Attendance marked");
    expect(now).toHaveTextContent("Next: Period 4 · Grade 9-A");
    const attention = within(screen.getByRole("list", { name: "Needs your attention" })).getAllByRole("link");
    expect(attention.map((a) => a.textContent)).toEqual([
      "Substitution: Grade 7-A ScienceToday · Period 3 · Accept or decline", "Substitution: Grade 7-A Science2026-11-25 · Period 1 · Accept or decline",
      "Mark attendance · Period 1 · Grade 10-BMathematics · 08:30 AM · Not marked", "Mark attendance · Grade 9-AClass teacher · Not marked today",
    ]);
    expect(attention[2]).toHaveAttribute("href", "/me/attendance?classId=cls_10B&period=1&date=2026-11-23");
    expect(attention[0]).toHaveAttribute("href", "/me/substitutions");
    expect(within(screen.getByRole("region", { name: "Needs your attention" })).getByRole("link", { name: "Assignments" })).toHaveAttribute("href", "/me/assignments");
  });

  it("shows Attendance marked · x/y present with View once the period's register is in", () => {
    seed({ staff, ops_periods: periods, ops_attendance: [reg()] });
    renderUI(<PortalHome />);
    const now = screen.getByRole("region", { name: "Now" });
    expect(now).toHaveTextContent("Attendance marked · 29/30 present · 1 absent");
    expect(within(now).queryByRole("link", { name: "Mark attendance" })).not.toBeInTheDocument();
    expect(within(now).getByRole("link", { name: "View attendance of Grade 10-B period 1" })).toHaveAttribute("href", "/me/attendance?classId=cls_10B&period=1&date=2026-11-23");
    expect(screen.getByText("All caught up")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "Today's periods" })).getAllByRole("listitem")[0]).toHaveTextContent("Marked · 29/30");
  });

  it("says the day has not started and names the next class before the first bell", () => {
    vi.setSystemTime(new Date(2026, 10, 23, 7, 45));
    seed({ staff, ops_periods: periods });
    renderUI(<PortalHome />);
    const now = screen.getByRole("region", { name: "Now" });
    expect(now).toHaveTextContent("SCHOOL DAY NOT STARTED");
    expect(now).toHaveTextContent("Your next class starts at 08:30 AM.");
    expect(screen.getByText("All caught up")).toBeInTheDocument();
  });

  it("has four equal-size quick action cards", () => {
    seed({ staff });
    renderUI(<PortalHome />);
    const quick = within(screen.getByRole("navigation", { name: "Quick actions" })).getAllByRole("link");
    expect(quick.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
      ["Attendance", "/me/attendance"], ["Assignments", "/me/assignments"], ["Enter marks", "/me/marks"], ["Resources", "/me/resources"],
    ]);
    expect(new Set(quick.map((a) => a.firstElementChild!.className)).size).toBe(1);
  });
});

describe("PortalHome (non-teaching staff)", () => {
  it("hides the timetable and teaching links, keeps check-in, leave and notices", () => {
    authState.user = clerk;
    seed({ staff, ops_periods: periods, ops_substitutions: subs, com_notices: notices });
    renderUI(<PortalHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Good morning, Ravi Menon");
    expect(screen.getByText("Only teachers have a timetable")).toBeInTheDocument();
    expect(screen.queryByText("Pending substitutions")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Quick actions" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "My timetable" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Marks entry" })).not.toBeInTheDocument();
    screen.getAllByRole("link", { name: "Leave & check-in" }).forEach((a) => expect(a).toHaveAttribute("href", "/me/leave"));
    expect(screen.getByRole("link", { name: "Notices" })).toHaveAttribute("href", "/me/notices");
    expect(screen.getByRole("link", { name: "My profile" })).toHaveAttribute("href", "/me/profile");
    expect(screen.getByRole("button", { name: "Check in" })).toBeInTheDocument();
    expect(screen.getByText("Staff meeting on Friday")).toBeInTheDocument();
  });

  it("gives bus crew a home that points to the driver app and reads no staff data", () => {
    authState.user = { id: "uid_d", email: "d@s.in", organizationName: "", schoolId: "sch_test", role: "driver", crewId: "crew_1", name: "Suresh" };
    seed({ staff, com_notices: notices });
    renderUI(<PortalHome />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Hello, Suresh");
    expect(screen.getByText("Driver")).toBeInTheDocument();
    expect(screen.getByText("Bus crew pages are not on the web yet")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Leave & check-in" })).not.toBeInTheDocument();
  });
});
