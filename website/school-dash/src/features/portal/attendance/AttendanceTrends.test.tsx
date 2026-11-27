import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authState, dialog, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";
import { AttendanceTrends } from "./AttendanceTrends";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const students = [
  { id: "stu_1", name: "Aarav Mehta", classId: "cls_10B", roll: 1, guardian: "Mr Mehta", phone: "+91 98765 43210", guardianUids: ["par_1"] },
  { id: "stu_2", name: "Bina Rao", classId: "cls_10B", roll: 2, guardian: "Mrs Rao", phone: "" },
  { id: "stu_3", name: "Chetan Das", classId: "cls_10B", roll: 3 },
];
const rec = (date: string, marks: Record<string, string>) => ({ id: `${date}_cls_10B_1`, date, classId: "cls_10B", grade: "10", section: "B", period: 1, total: 3, marks, submitted: true, teacherId: "stf_1", updatedAt: `${date}T05:00:00.000Z` });
const base = {
  staff: [{ id: "stf_1", name: "Anita" }],
  classes: [{ id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_1" }],
  students,
  ops_periods: [{ id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "" }],
  ops_attendance: [
    rec("2026-11-02", { stu_1: "A" }), rec("2026-11-09", { stu_1: "A", stu_2: "L" }), rec("2026-11-16", { stu_1: "A" }), rec("2026-11-23", {}),
    rec("2026-10-26", { stu_1: "A", stu_2: "A" }), // the month before
  ],
};

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

describe("Attendance trends", () => {
  it("shows the class average against the month before, the split, the daily chart and the weekday card", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AttendanceTrends />);
    expect(screen.getByRole("heading", { name: "Attendance trends" })).toBeInTheDocument();
    expect(screen.getByText("Class 10-B · 3 students")).toBeInTheDocument();
    // November: 66.7 + 66.7 + 66.7 + 100 = 75.0; the month before (9 – 31 Oct): 33.3
    expect(screen.getByTestId("trend-average")).toHaveTextContent("75.0%");
    expect(screen.getByTestId("trend-delta")).toHaveTextContent("+41.7 pts");
    expect(screen.getByText("vs the month before")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Student-days" })).toHaveTextContent("Present 8Late 1Absent 3Excused 0");
    const chart = screen.getByRole("region", { name: "Daily attendance chart" });
    expect(within(chart).getAllByRole("button")).toHaveLength(4); // recorded days
    expect(within(chart).getByRole("img", { name: "Tue, 3 Nov, no register" })).toBeInTheDocument(); // every school day is listed
    expect(screen.getByTestId("trend-day")).toHaveTextContent("Mon, 23 Nov");
    await user.click(within(chart).getByRole("button", { name: "Mon, 9 Nov, 67% present" }));
    expect(screen.getByTestId("trend-day")).toHaveTextContent("Late 1");
    expect(writes).toHaveLength(0);
  });

  it("switches the range and says when there is nothing to compare", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AttendanceTrends />);
    await user.click(screen.getByRole("tab", { name: "This week" }));
    expect(screen.getByTestId("trend-average")).toHaveTextContent("100.0%");
    expect(screen.getByText("Nothing recorded last week to compare")).toBeInTheDocument(); // Monday: the window before is Sunday
    await user.click(screen.getByRole("tab", { name: "This year" }));
    expect(screen.getByTestId("trend-average")).toHaveTextContent("66.7%"); // the last 365 days without a published year
  });

  it("lists students lowest first with the at-risk filter selected", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AttendanceTrends />);
    expect(screen.getByRole("tab", { name: "Below 75%(1)" })).toHaveAttribute("aria-selected", "true");
    const list = () => screen.getByRole("list", { name: "Students by attendance" });
    expect(within(list()).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(["Aarav Mehta"]);
    await user.click(screen.getByRole("tab", { name: "All(3)" }));
    expect(within(list()).getAllByRole("listitem").map((li) => li.querySelector("p")?.textContent)).toEqual(["Aarav Mehta", "Bina Rao", "Chetan Das"]);
    expect(screen.getByText("Roll 1 · 3 absent · 4 days")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Call parent of Aarav Mehta" })).toHaveAttribute("href", "tel:+919876543210");
    expect(screen.queryByRole("link", { name: "Call parent of Bina Rao" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View log of Aarav Mehta" }));
    expect(within(dialog("Aarav Mehta")).getAllByText("Absent")).toHaveLength(3);
  });

  it("notifies the parent in the app and the chat with the teacher app's notice", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AttendanceTrends />);
    await user.click(screen.getByRole("button", { name: "Notify parent of Aarav Mehta" }));
    const d = dialog("Notify parent / guardian");
    // all three absences fell on Mondays: the Monday preset is picked
    expect(within(d).getByText("3 Monday absences recently")).toBeInTheDocument();
    expect(within(d).getByRole("radio", { name: "Monday absences" })).toHaveAttribute("aria-checked", "true");
    expect(within(d).getByLabelText("Message to the parent")).toHaveValue(
      "Dear Mr Mehta, Aarav Mehta (Roll #1, Class 10-B) has missed 3 Monday classes recently. Regular attendance matters for progress — please let us know if anything is affecting Mondays.");
    await user.click(within(d).getByRole("radio", { name: "Low attendance" }));
    expect(within(d).getByLabelText("Message to the parent")).toHaveValue(
      "Dear Mr Mehta, Aarav Mehta (Roll #1, Class 10-B) has attendance below the required 75% with 3 absences. Regular attendance is important for progress — please make sure they attend every day.");
    await user.click(within(d).getByRole("radio", { name: "Welfare check" }));
    expect(within(d).getByLabelText("Message to the parent")).toHaveValue("Dear Mr Mehta, Aarav Mehta (Roll #1, Class 10-B) has been absent for the last few school days. Please let us know if everything is fine.");
    await user.click(within(d).getByRole("switch", { name: "Also send in chat" }));
    await user.click(within(d).getByRole("button", { name: "Send notification now" }));
    expect(await screen.findByText("Sent to the parent app and chat")).toBeInTheDocument();

    const [notice] = rowsOf<Record<string, unknown>>("att_notices");
    expect(notice).toEqual({
      id: expect.stringMatching(/^att_/), studentId: "stu_1", classId: "cls_10B", channels: ["App", "Chat"],
      message: "Dear Mr Mehta, Aarav Mehta (Roll #1, Class 10-B) has been absent for the last few school days. Please let us know if everything is fine.",
      template: "Welfare check", auto: false, ack: false, ackRequested: false, at: new Date(2026, 10, 23, 12, 0).toISOString(), ord: expect.any(Number), teacherId: "stf_1",
      updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    expect(getRow("msg_threads", "thr_stu_1_stf_1")).toMatchObject({ studentId: "stu_1", classId: "cls_10B", parentUids: ["par_1"], teacherId: "stf_1", role: "Class Teacher" });
    expect(rowsOf("msg_messages")).toEqual([expect.objectContaining({ threadId: "thr_stu_1_stf_1", studentId: "stu_1", teacherId: "stf_1", parentUids: ["par_1"], from: "teacher", text: expect.stringContaining("absent for the last few") })]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the chat off for a guardian without a parent login and logs a call", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AttendanceTrends />);
    await user.click(screen.getByRole("tab", { name: "All(3)" }));
    await user.click(screen.getByRole("button", { name: "Notify parent of Bina Rao" }));
    const d = dialog("Notify parent / guardian");
    expect(within(d).getByText("No parent app login yet — chat not available")).toBeInTheDocument();
    expect(within(d).queryByRole("switch")).not.toBeInTheDocument();
    expect(within(d).getByRole("button", { name: /No phone on file/ })).toBeDisabled();
    await user.clear(within(d).getByLabelText("Message to the parent"));
    await user.click(within(d).getByRole("button", { name: "Send notification now" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Write a message");
    expect(writes).toHaveLength(0);
    await user.click(within(d).getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("link", { name: "Call parent of Aarav Mehta" }));
    expect(writesTo("att_notices")).toHaveLength(1);
    expect(rowsOf("att_notices")[0]).toMatchObject({ studentId: "stu_1", channels: ["Call"], message: "Phone call placed to Mr Mehta (+919876543210)", teacherId: "stf_1" });
    expect(rowsOf("att_notices")[0]).not.toHaveProperty("template");
  });

  it("says when nothing was recorded", () => {
    teacher(); seed({ ...base, ops_attendance: [] });
    renderUI(<AttendanceTrends />);
    expect(screen.getByText("No attendance yet")).toBeInTheDocument();
  });
});
