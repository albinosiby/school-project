import { describe, expect, it, vi } from "vitest";
import { act, fireEvent } from "@testing-library/react";
import { authState, dialog, failNextWrite, field, getRow, renderUI, router, screen, seed, setUrl, within, writes, writesTo } from "@/test/render";
import * as time from "@/lib/useNow";
import * as staffProfiles from "@/features/people/staffProfiles";
import { ClassDetailsView } from "./ClassDetailsView";
import type { ClassRow } from "./logic";

const cls = { id: "cls_10B", grade: "10", section: "B", classTeacherId: "anita", room: "204", wing: "North", capacity: 40 };
const students = [
  { id: "boy", name: "Aarav", grn: "GRN-1", grade: "10", section: "B", gender: "Male", admissionDate: "2026-06-01", guardian: "Parent One", roll: 1 },
  { id: "girl", name: "Ananya", grn: "GRN-2", grade: "10", section: "B", gender: "Female", admissionDate: "2026-06-01", guardian: "Parent Two", roll: 2 },
  { id: "other", name: "Other class student", classId: "cls_10A", grade: "10", section: "A", gender: "Male" },
  { id: "deleted", name: "Deleted student", classId: cls.id, grade: "10", section: "B", deleted: true },
];
function setup(classOverrides: Partial<ClassRow> = {}) {
  vi.spyOn(time, "useNow").mockReturnValue(Date.parse("2026-11-11T09:55:00+05:30"));
  seed({ classes: [{ ...cls, ...classOverrides }], students, staff: [
    { id: "anita", name: "Anita Sharma", phone: "9000000001", category: "Teaching" },
    { id: "ravi", name: "Ravi Kumar", phone: "9000000002", category: "Teaching" },
  ], assignments: [{ id: "a1", classId: cls.id, subject: "Mathematics", teacherId: "ravi" }, { id: "a2", classId: cls.id, subject: "English", teacherId: "anita" }],
  set_config: [{ id: "bell", start: "09:00", end: "13:00", periodCount: 4, periodLength: 40, breaks: [{ name: "Morning break", start: "10:20", duration: 20 }] }, { id: "regional", timezone: "Asia/Kolkata" }],
  ops_periods: [{ id: "math", classId: cls.id, grade: "10", section: "B", day: "Wed", period: 2, subject: "Mathematics", teacher: "Old teacher name", teacherId: "ravi", room: "204" }],
  ops_attendance: [
    { id: "p2", classId: cls.id, date: "2026-11-11", period: 2, total: 2, marks: { girl: "A" }, submitted: true },
    { id: "history", classId: cls.id, date: "2026-11-10", period: 1, total: 2, marks: { girl: "L" }, studentIds: ["boy", "girl"], submitted: true },
  ] });
  return renderUI(<ClassDetailsView classId={cls.id} />);
}
const stat = (label: string) => screen.getByText(label, { exact: true }).parentElement!.parentElement!;

describe("Class details", () => {
  it("loads the protected class-teacher phone and includes them in Teachers before any lessons are configured", async () => {
    const load = vi.spyOn(staffProfiles, "loadStaffProfile").mockResolvedValue({ profile: { phone: "9000000999" }, photo: null });
    seed({ classes: [{ ...cls, classTeacher: "Old teacher name" }], staff: [{ id: "anita", name: "Anita Sharma", category: "Teaching", profileVersion: 1 }] });
    const { user } = renderUI(<ClassDetailsView classId={cls.id} />);
    const card = screen.getByRole("region", { name: "Class teacher" });
    expect(await within(card).findByRole("link", { name: "9000000999" })).toHaveAttribute("href", "tel:9000000999");
    expect(load).toHaveBeenCalledWith("anita");
    await user.click(screen.getByRole("tab", { name: /^Teachers\(1\)/ }));
    const panel = screen.getByRole("tabpanel", { name: "Teachers" });
    expect(within(panel).getByRole("link", { name: "Anita Sharma" })).toHaveAttribute("href", "/staff/anita");
    expect(within(panel).getByText("Class teacher")).toBeInTheDocument();
    expect(within(panel).getByText("No subject assigned in this class")).toBeInTheDocument();
    expect(await within(panel).findByRole("link", { name: "9000000999" })).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.click(within(card).getByRole("button", { name: "Change class teacher" }));
    const form = dialog("Set class teacher");
    await user.selectOptions(field("Class teacher", form), "");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.getByRole("tab", { name: /^Teachers\(0\)/ })).toBeInTheDocument();
    expect(within(panel).queryByRole("link", { name: "Anita Sharma" })).not.toBeInTheDocument();
  });
  it("sets and unassigns a class teacher and updates their profile link and phone", async () => {
    const { user } = setup({ classTeacherId: "" });
    const card = screen.getByRole("region", { name: "Class teacher" });
    await user.click(within(card).getByRole("button", { name: "Set class teacher" }));
    let form = dialog("Set class teacher");
    expect(field("Class teacher", form)).toHaveValue("");
    await user.selectOptions(field("Class teacher", form), "ravi");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "ravi", classTeacher: "Ravi Kumar", room: "204" });
    expect(within(card).getByRole("link", { name: "Ravi Kumar" })).toHaveAttribute("href", "/staff/ravi");
    expect(within(card).getByRole("link", { name: "9000000002" })).toHaveAttribute("href", "tel:9000000002");
    await user.click(within(card).getByRole("button", { name: "Change class teacher" }));
    form = dialog("Set class teacher");
    expect(field("Class teacher", form)).toHaveValue("ravi");
    await user.selectOptions(field("Class teacher", form), "");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "", classTeacher: "" });
    expect(within(card).getByText("Not assigned")).toBeInTheDocument();
    expect(writesTo("classes")).toHaveLength(2);
    expect(writesTo("assignments")).toHaveLength(0);
  });
  it("keeps the current teacher preselected, excludes other classes' teachers and non-teaching staff, and cancels without saving", async () => {
    seed({ classes: [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "ravi" }],
      staff: [{ id: "office", name: "Office staff", category: "Non-Teaching" }, { id: "free", name: "Available Teacher", category: "Teaching" }] });
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Change class teacher" }));
    const form = dialog("Set class teacher");
    const select = field("Class teacher", form);
    expect(select).toHaveValue("anita");
    expect(within(select).getByRole("option", { name: "Anita Sharma" })).toBeInTheDocument();
    expect(within(select).getByRole("option", { name: "Available Teacher" })).toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Ravi Kumar" })).not.toBeInTheDocument();
    expect(within(select).queryByRole("option", { name: "Office staff" })).not.toBeInTheDocument();
    await user.selectOptions(select, "free");
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("rechecks assignments before saving when another class claims the selected teacher", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Change class teacher" }));
    const form = dialog("Set class teacher");
    await user.selectOptions(field("Class teacher", form), "ravi");
    act(() => seed({ classes: [{ id: "cls_9A", grade: "9", section: "A", classTeacherId: "ravi" }] }));
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Ravi Kumar is already class teacher of Grade 9 · Section A");
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "anita" });
    expect(writes).toHaveLength(0);
  });
  it("preserves the existing assignment on save failure and allows retry", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Change class teacher" }));
    const form = dialog("Set class teacher");
    await user.selectOptions(field("Class teacher", form), "ravi");
    failNextWrite();
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Could not save the class teacher. Try again.");
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "anita" });
    expect(writes).toHaveLength(0);
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "ravi", classTeacher: "Ravi Kumar" });
  });
  it("retains a legacy teacher who is no longer in the staff picker until explicitly replaced", async () => {
    const { user } = setup({ classTeacherId: "former", classTeacher: "Former Teacher" });
    await user.click(screen.getByRole("button", { name: "Change class teacher" }));
    const form = dialog("Set class teacher");
    expect(field("Class teacher", form)).toHaveValue("former");
    expect(within(form).getByRole("option", { name: "Former Teacher" })).toBeInTheDocument();
    expect(within(form).getByRole("button", { name: "Save" })).toBeDisabled();
    await user.selectOptions(field("Class teacher", form), "anita");
    await user.click(within(form).getByRole("button", { name: "Save" }));
    expect(getRow("classes", cls.id)).toMatchObject({ classTeacherId: "anita", classTeacher: "Anita Sharma" });
  });
  it("switches lessons, teachers, cover and attendance to the selected weekday and exact date", async () => {
    seed({ ops_periods: [
      { id: "mon", classId: cls.id, grade: "10", section: "B", day: "Mon", period: 1, subject: "Monday English", teacherId: "anita", teacher: "Anita Sharma" },
      { id: "tue", classId: cls.id, grade: "10", section: "B", day: "Tue", period: 1, subject: "Tuesday Science", teacherId: "ravi", teacher: "Ravi Kumar" },
      { id: "other_class", classId: "cls_10A", grade: "10", section: "A", day: "Tue", period: 1, subject: "Other class English", teacherId: "anita", teacher: "Anita Sharma" },
    ], ops_substitutions: [{ id: "mon_cover", date: "2026-11-09", day: "Mon", classId: cls.id, period: 1, subject: "Monday English", absentTeacherId: "anita", substituteTeacherId: "ravi", status: "Accepted" }],
    ops_attendance: [{ id: "mon_roll", classId: cls.id, date: "2026-11-09", period: 1, total: 2, marks: { girl: "A" }, submitted: true }] });
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Timetable" }));
    const daily = () => screen.getByRole("table", { name: "Daily periods" });
    fireEvent.change(field("Timetable date"), { target: { value: "2026-11-09" } });
    expect(daily()).toHaveTextContent("Monday English");
    expect(daily()).not.toHaveTextContent("Tuesday Science");
    expect(daily()).toHaveTextContent("1 / 2");
    expect(within(daily()).getByText("Substitute")).toBeInTheDocument();
    fireEvent.change(field("Timetable date"), { target: { value: "2026-11-10" } });
    expect(daily()).toHaveTextContent("Tuesday Science");
    expect(daily()).not.toHaveTextContent("Monday English");
    expect(daily()).not.toHaveTextContent("Other class English");
    expect(daily()).toHaveTextContent("2 / 2");
    expect(within(daily()).queryByText("Substitute")).not.toBeInTheDocument();
    expect(screen.getByText("Tuesday, 10 November 2026")).toBeInTheDocument();
    fireEvent.change(field("Timetable date"), { target: { value: "2026-11-11" } });
    expect(daily()).toHaveTextContent("Mathematics");
    expect(daily()).not.toHaveTextContent("Tuesday Science");
    expect(writes).toHaveLength(0);
  });
  it("explains an unconfigured weekday and provides a link to configure the correct class", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Timetable" }));
    fireEvent.change(field("Timetable date"), { target: { value: "2026-11-12" } });
    expect(screen.getByText("Thursday, 12 November 2026")).toBeInTheDocument();
    expect(screen.getByText("No timetable configured for Thursday")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Configure weekly timetable" })).toHaveAttribute("href", "/settings?section=timetable&grade=10&division=B");
    expect(screen.queryByRole("table", { name: "Daily periods" })).not.toBeInTheDocument();
  });
  it("shows the selected class, correct gender totals, class-teacher contact and current scheduled lesson", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Grade 10 · Section B", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to classes" })).toHaveAttribute("href", "/classes");
    expect(stat("Total students")).toHaveTextContent("2");
    expect(stat("Boys")).toHaveTextContent("1");
    expect(stat("Girls")).toHaveTextContent("1");
    expect(stat("Present this period")).toHaveTextContent("1 / 2");
    const teacher = screen.getByRole("region", { name: "Class teacher" });
    expect(within(teacher).getByRole("link", { name: "Anita Sharma" })).toHaveAttribute("href", "/staff/anita");
    expect(within(teacher).getByRole("link", { name: "9000000001" })).toHaveAttribute("href", "tel:9000000001");
    const current = screen.getByRole("region", { name: "Current lesson" });
    expect(current).toHaveTextContent("Mathematics");
    expect(current).toHaveTextContent("Scheduled teacher:");
    expect(within(current).getByRole("link", { name: "Ravi Kumar" })).toHaveAttribute("href", "/staff/ravi");
    expect(screen.getByRole("table", { name: "Daily periods" })).toHaveTextContent("09:40–10:20");
    expect(writes).toHaveLength(0);
  });
  it("opens each tab independently and links students and teachers to their profile pages", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: /^Students/ }));
    const studentPanel = screen.getByRole("tabpanel", { name: "Students" });
    const studentLink = within(studentPanel).getByRole("link", { name: "Aarav" });
    expect(studentLink).toHaveAttribute("href", "/students/boy");
    expect(within(studentPanel).queryByText("Other class student")).not.toBeInTheDocument();
    expect(within(studentPanel).queryByText("Deleted student")).not.toBeInTheDocument();
    await user.click(studentLink.closest("tr")!);
    expect(router.push).toHaveBeenCalledWith("/students/boy");
    await user.click(screen.getByRole("tab", { name: /^Teachers/ }));
    const teacherPanel = screen.getByRole("tabpanel", { name: "Teachers" });
    const teacherLink = within(teacherPanel).getByRole("link", { name: "Ravi Kumar" });
    expect(teacherLink).toHaveAttribute("href", "/staff/ravi");
    expect(teacherLink.closest("tr")).toHaveTextContent("Mathematics");
    await user.click(teacherLink.closest("tr")!);
    expect(router.push).toHaveBeenCalledWith("/staff/ravi");
    expect(screen.queryByRole("table", { name: "Daily periods" })).not.toBeInTheDocument();
  });
  it("shows hourly student marks and opens a historical day's periods", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Attendance" }));
    const matrix = screen.getByRole("region", { name: "Student period attendance" });
    expect(within(matrix).getByLabelText("Aarav, period 2: Present")).toBeInTheDocument();
    expect(within(matrix).getByLabelText("Ananya, period 2: Absent")).toBeInTheDocument();
    expect(within(matrix).getByLabelText("Aarav, period 1: Not marked")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View attendance for 2026-11-10" }));
    expect(field("Attendance date")).toHaveValue("2026-11-10");
    expect(within(matrix).getByLabelText("Ananya, period 1: Late")).toBeInTheDocument();
    expect(within(matrix).getByLabelText("Aarav, period 1: Present")).toBeInTheDocument();
    fireEvent.change(field("History month"), { target: { value: "2026-10" } });
    expect(screen.getByText("No period attendance recorded for this month.")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("shows the daily and weekly timetable with teacher links", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Timetable" }));
    const table = screen.getByRole("table", { name: "Weekly timetable" });
    expect(table).toHaveTextContent("Mathematics");
    expect(within(table).getByRole("link", { name: "Ravi Kumar" })).toHaveAttribute("href", "/staff/ravi");
    expect(screen.getByRole("table", { name: "Daily periods" })).toBeInTheDocument();
  });
  it("assigns cover to the selected class, date and hour and updates that day's teacher", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Timetable" }));
    await user.click(screen.getByRole("button", { name: "Assign substitute for period 2" }));
    const form = dialog("Assign substitute");
    expect(field("Class", form)).toBeDisabled();
    expect(field("Class", form)).toHaveValue(cls.id);
    expect(field("Date", form)).toBeDisabled();
    expect(field("Date", form)).toHaveValue("2026-11-11");
    expect(field("Period (teacher who is absent)", form)).toHaveValue("2");
    expect(within(field("Substitute teacher", form)).queryByRole("option", { name: /Ravi Kumar/ })).not.toBeInTheDocument();
    await user.selectOptions(field("Substitute teacher", form), "anita");
    await user.click(within(form).getByRole("button", { name: "Assign" }));
    expect(getRow("ops_substitutions", "sub_2026-11-11_cls_10B_2")).toMatchObject({ classId: cls.id, date: "2026-11-11", day: "Wed", period: 2,
      absentTeacherId: "ravi", substituteTeacherId: "anita", subject: "Mathematics", status: "Assigned" });
    const row = within(screen.getByRole("table", { name: "Daily periods" })).getByText("Period 2").closest("tr")!;
    expect(within(row).getByRole("link", { name: "Anita Sharma" })).toHaveAttribute("href", "/staff/anita");
    expect(within(row).getByText("Substitute")).toBeInTheDocument();
    expect(writesTo("ops_periods")).toHaveLength(0);
  });
  it("uses the selected future date, blocks missing slots and filters cover to this class and day", async () => {
    seed({ ops_substitutions: [
      { id: "other", classId: "cls_10A", date: "2026-11-11", day: "Wed", period: 2, subject: "Other subject", absentTeacherId: "ravi", substituteTeacherId: "anita", status: "Assigned" },
      { id: "older", classId: cls.id, date: "2026-11-10", day: "Tue", period: 1, subject: "Older subject", absentTeacherId: "ravi", substituteTeacherId: "anita", status: "Accepted" },
    ] });
    const { user } = setup();
    await user.click(screen.getByRole("tab", { name: "Timetable" }));
    expect(screen.queryByText("Other subject")).not.toBeInTheDocument();
    expect(screen.queryByText("Older subject")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Assign substitute for period 1" })).toBeDisabled();
    fireEvent.change(field("Timetable date"), { target: { value: "2026-11-18" } });
    await user.click(screen.getByRole("button", { name: "Assign substitute for period 2" }));
    const form = dialog("Assign substitute");
    expect(field("Date", form)).toHaveValue("2026-11-18");
    await user.selectOptions(field("Substitute teacher", form), "anita");
    await user.click(within(form).getByRole("button", { name: "Assign" }));
    expect(getRow("ops_substitutions", "sub_2026-11-18_cls_10B_2")).toMatchObject({ classId: cls.id, date: "2026-11-18", period: 2 });
    expect(writes).toHaveLength(1);
  });
  it("opens a class timetable deep link for the supplied date", () => {
    setUrl("/classes/cls_10B?tab=timetable&date=2026-11-18");
    setup();
    expect(screen.getByRole("tab", { name: "Timetable" })).toHaveAttribute("aria-selected", "true");
    expect(field("Timetable date")).toHaveValue("2026-11-18");
  });
  it("shows published class results and uses complete students for its pass percentage", async () => {
    seed({ exm_cycles: [{ id: "exam", title: "Term One", declaration: "2026-10-20", status: "Completed", passRule: "Min 33% aggregate" }],
      exm_papers: [{ id: "paper", cycleId: "exam", grade: "10", subject: "Mathematics", theory: 80, internal: 20, classIds: [cls.id], published: ["10-B"] }],
      exm_marks: [{ id: "m1", paperId: "paper", candId: "cand_boy", studentId: "boy", classId: cls.id, theory: 60, internal: 20 },
        { id: "m2", paperId: "paper", candId: "cand_girl", studentId: "girl", classId: cls.id, theory: 10, internal: 5 }] });
    const { user } = setup();
    expect(stat("Pass percentage")).toHaveTextContent("50%");
    await user.click(screen.getByRole("tab", { name: "Results" }));
    const panel = screen.getByRole("tabpanel", { name: "Results" });
    expect(within(panel).getByRole("combobox", { name: "Exam" })).toHaveValue("exam");
    expect(within(panel).getByRole("link", { name: "Aarav" }).closest("tr")).toHaveTextContent("Passed");
    expect(within(panel).getByRole("link", { name: "Ananya" }).closest("tr")).toHaveTextContent("Failed");
  });
  it("leaves absent data unrated and handles missing classes or unauthorized sessions", async () => {
    const empty = renderUI(<ClassDetailsView classId="missing" />);
    expect(screen.getByText("Class record unavailable")).toBeInTheDocument();
    empty.unmount();
    const { user, unmount } = setup();
    expect(stat("Pass percentage")).toHaveTextContent("Not available");
    await user.click(screen.getByRole("tab", { name: "Results" }));
    expect(screen.getByText("No published results")).toBeInTheDocument();
    unmount();
    authState.user = { ...authState.user!, role: "staff" };
    renderUI(<ClassDetailsView classId={cls.id} />);
    expect(screen.getByText("Class record unavailable")).toBeInTheDocument();
    expect(screen.queryByText("9000000001")).not.toBeInTheDocument();
  });
});
