import { describe, expect, it } from "vitest";
import { DashboardView } from "./DashboardView";
import { addDays, TODAY } from "./data";
import { dayName } from "./logic";
import { dialog, field, fieldError, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const kpi = (label: string) => screen.getByText(label).closest("a") as HTMLElement;

describe("Dashboard KPIs from live collections", () => {
  it("today's attendance uses each class's latest submitted record (contract 9)", () => {
    seed({ students: [{ id: "s1", status: "Active" }], ops_attendance: [
      { id: `${TODAY}_cls_8A_1`, date: TODAY, classId: "cls_8A", period: 1, total: 40, marks: { a: "A", b: "A", c: "E" }, submitted: true, updatedAt: "2026-01-01T03:00:00Z" },
      { id: `${TODAY}_cls_8A_2`, date: TODAY, classId: "cls_8A", period: 2, total: 40, marks: { a: "A" }, submitted: true, updatedAt: "2026-01-01T04:00:00Z" },
      { id: `${TODAY}_cls_8A_3`, date: TODAY, classId: "cls_8A", period: 3, total: 40, marks: {}, submitted: false, updatedAt: "2026-01-01T05:00:00Z" },
    ] });
    renderUI(<DashboardView />);
    const k = kpi("Today's Attendance");
    expect(within(k).getByText("97.5%")).toBeInTheDocument();
    expect(within(k).getByText("1 Absent")).toBeInTheDocument();
  });

  it("overdue fees include invoices past their due date; staff on leave include approved leaves", () => {
    seed({
      fee_invoices: [{ id: "i1", balance: 5000, status: "Partial", due: addDays(TODAY, -3) }, { id: "i2", balance: 2000, status: "Overdue" }, { id: "i3", balance: 900, status: "Pending", due: addDays(TODAY, 5) }],
      staff: [{ id: "stf_1", name: "Mr. Verma", status: "Active", department: "Science", role: "TGT" }, { id: "stf_2", name: "Ms. Iyer", status: "Active", department: "English", role: "TGT" }],
      staff_leaves: [{ id: "l1", staffId: "stf_1", from: TODAY, to: TODAY, status: "Approved", type: "Casual Leave", days: 1, reason: "x" }],
    });
    renderUI(<DashboardView />);
    expect(within(kpi("Fees Overdue")).getByText("₹7,000")).toBeInTheDocument();
    expect(within(kpi("Fees Overdue")).getByText("2 Accounts")).toBeInTheDocument();
    expect(within(kpi("Staff on Leave")).getByText("1 On duty")).toBeInTheDocument();
  });
});

describe("Urgent operational alerts", () => {
  it("are derived from leaves, the timetable, substitutions, invoices and buses, and link to the fix", () => {
    seed({
      staff: [{ id: "stf_1", name: "Mr. Verma", status: "Active", department: "Science", role: "TGT" }],
      staff_leaves: [{ id: "l1", staffId: "stf_1", from: TODAY, to: TODAY, status: "Approved", type: "Casual Leave", days: 1, reason: "x" }],
      ops_periods: [
        { id: "p1", classId: "cls_8C", grade: "8", section: "C", day: dayName(TODAY), period: 3, subject: "Science", teacher: "Mr. Verma", teacherId: "stf_1", room: "" },
        { id: "p2", classId: "cls_9A", grade: "9", section: "A", day: dayName(TODAY), period: 5, subject: "Physics", teacher: "Mr. Verma", teacherId: "stf_1", room: "" },
      ],
      ops_substitutions: [{ id: `sub_${TODAY}_cls_9A_5`, date: TODAY, day: dayName(TODAY), period: 5, classId: "cls_9A", subject: "Physics", absentTeacherId: "stf_1", substituteTeacherId: "stf_9", status: "Assigned" }],
      fee_invoices: [{ id: "i1", balance: 5000, status: "Overdue" }],
      tr_buses: [{ id: "bus_01", number: "14", routeName: "Route 4B", status: "Maintenance", studentCount: 5 }],
    });
    renderUI(<DashboardView />);
    expect(screen.getByText("SUBSTITUTE REQUIRED")).toBeInTheDocument();
    expect(screen.getByText("P3")).toBeInTheDocument();
    expect(screen.getByText("Mr. Verma is on leave: Gr 8-C Science needs cover.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assign cover/ }).closest("a")).toHaveAttribute("href", "/timetable");
    expect(screen.getByText("₹5,000 is overdue across 1 invoice.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open fees/ }).closest("a")).toHaveAttribute("href", "/fees");
    expect(screen.getByText("Route 4B: 5 students need another bus.")).toBeInTheDocument();
    expect(screen.getByText("3 Actions")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("shows the empty state when nothing needs attention", () => {
    renderUI(<DashboardView />);
    expect(screen.getByText("No operational alerts right now.")).toBeInTheDocument();
  });
});

describe("Quick Notice (header)", () => {
  it("needs a title and a message, then posts one bell row", async () => {
    const { user } = renderUI(<DashboardView />);
    await user.click(screen.getByRole("button", { name: /Quick Notice/ }));
    const d = dialog("Quick Notice");
    await user.type(field("Title", d), "Water supply");
    await user.click(within(d).getByRole("button", { name: "Send Notice" }));
    expect(fieldError("Message", d)).toBe("Title and message are required");
    expect(writes).toHaveLength(0);
    await user.type(field("Message", d), "No water in Block B till noon");
    await user.click(within(d).getByRole("button", { name: "Send Notice" }));
    expect(await screen.findByText(/Notice posted to the notification feed/)).toBeInTheDocument();
    expect(writesTo("notifications")[0]!.data).toMatchObject({ category: "ops", title: "Water supply", body: "No water in Block B till noon", read: false });
  });
});
