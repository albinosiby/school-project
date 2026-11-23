import { beforeEach, describe, expect, it, vi } from "vitest";
import { LiveView } from "./LiveView";
import { authState, dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes } from "@/test/render";

const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const base = () => seed({
  staff: [{ id: "stf_1", name: "Anita Rao" }],
  classes: [{ id: "cls_10B", grade: "10", section: "B" }, { id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_1" }],
  assignments: [{ id: "a1", teacherId: "stf_1", classId: "cls_10B", subject: "Mathematics" }],
  ops_periods: [{ id: "pr1", teacherId: "stf_1", classId: "cls_10B", subject: "Physics" }],
  live_classes: [
    { id: "lc1", teacherId: "stf_1", title: "Algebra revision", classId: "cls_10B", audience: "Class 10-B", subject: "Mathematics", date: "2099-01-10", time: "16:30", mins: 45, link: "https://meet.google.com/abc-defg-hij", status: "upcoming", joined: 1 },
    { id: "lc2", teacherId: "stf_2", title: "Someone else's class", classId: "cls_10B", subject: "Hindi", date: "2099-01-10", time: "16:30", mins: 45, status: "upcoming" },
    { id: "lc3", teacherId: "stf_1", title: "Cancelled one", classId: "cls_10B", subject: "Mathematics", date: "2099-01-11", time: "16:30", mins: 45, status: "cancelled", deleted: true },
    { id: "lc4", teacherId: "stf_1", title: "Old session", classId: "cls_10B", subject: "Mathematics", date: "2020-01-11", time: "16:30", mins: 45, status: "upcoming" },
  ],
  "live_classes/lc1/joins": [{ id: "uid_p1", at: "2099-01-10T16:25:00.000Z" }, { id: "uid_p2", at: "2099-01-10T16:26:00.000Z" }, { id: "uid_p3" }],
});

describe("LiveView", () => {
  beforeEach(() => { authState.user = teacher; });

  it("shows an empty state for non-teaching staff", () => {
    authState.user = { ...teacher, role: "staff" };
    renderUI(<LiveView />);
    expect(screen.getByText("Only teachers schedule live classes")).toBeInTheDocument();
  });

  it("lists own upcoming sessions with join counts, hides deleted and other teachers' ones, and puts ended ones under Past", async () => {
    base();
    const { user } = renderUI(<LiveView />);
    expect(screen.getByText("Algebra revision")).toBeInTheDocument();
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    expect(screen.getByLabelText("Joined Algebra revision")).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "https://meet.google.com/abc-defg-hij" })).toHaveAttribute("href", "https://meet.google.com/abc-defg-hij");
    expect(screen.queryByText("Someone else's class")).not.toBeInTheDocument();
    expect(screen.queryByText("Cancelled one")).not.toBeInTheDocument();
    expect(screen.queryByText("Old session")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Past" }));
    expect(screen.getByText("Old session")).toBeInTheDocument();
    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("schedules a Google Meet session with the fields the teacher app writes", async () => {
    base();
    const { user } = renderUI(<LiveView />);
    await user.click(screen.getByRole("button", { name: "Schedule live class" }));
    const d = dialog("Schedule live class");
    expect([...(field("Class", d) as unknown as HTMLSelectElement).options].map((o) => o.value)).toEqual(["", "cls_9A", "cls_10B"]);
    await user.selectOptions(field("Class", d), "cls_10B");
    expect([...(field("Subject", d) as unknown as HTMLSelectElement).options].map((o) => o.textContent)).toEqual(["Select subject", "Mathematics", "Physics"]);
    await user.selectOptions(field("Subject", d), "Physics");
    await user.type(field("Title", d), "Optics doubt session");
    await user.clear(field("Date", d));
    await user.type(field("Date", d), "2099-02-01");
    await user.clear(field("Start time", d));
    await user.type(field("Start time", d), "17:00");
    await user.clear(field("Duration (minutes)", d));
    await user.type(field("Duration (minutes)", d), "60");
    await user.type(field("Google Meet link", d), "https://zoom.us/j/1");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(within(d).getByText("Use a Google Meet link like https://meet.google.com/abc-defg-hij")).toBeInTheDocument();
    expect(rowsOf("live_classes")).toHaveLength(4);
    await user.clear(field("Google Meet link", d));
    await user.type(field("Google Meet link", d), "meet.google.com/XYZ-abcd-efg");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(await screen.findByText("Live class scheduled")).toBeInTheDocument();
    const created = rowsOf<{ id: string; title: string }>("live_classes").find((r) => r.title === "Optics doubt session")!;
    expect(created).toEqual({
      id: expect.any(String), title: "Optics doubt session", classId: "cls_10B", audience: "Class 10-B", subject: "Physics", category: "", date: "2099-02-01", time: "17:00", mins: 60,
      room: "", medium: "Google Meet", link: "https://meet.google.com/xyz-abcd-efg", record: true, mute: true, studentShare: false, notify: true, material: null, total: 0, tag: "",
      status: "upcoming", cohost: "", meetSpace: "", calendarEventId: "", calendarLink: "", calendarSync: false, createdAt: expect.any(String), teacherId: "stf_1",
      updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    expect(screen.getByText("Optics doubt session")).toBeInTheDocument();
  });

  it("cancels a session with the app's soft delete", async () => {
    base();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderUI(<LiveView />);
    await user.click(screen.getByRole("button", { name: "Cancel Algebra revision" }));
    expect(await screen.findByText("Live class cancelled")).toBeInTheDocument();
    const last = writes[writes.length - 1]!;
    expect(last).toMatchObject({ op: "update", coll: "live_classes", id: "lc1" });
    expect(last.data).toEqual({ deleted: true, status: "cancelled", updatedAt: expect.any(String), updatedBy: expect.any(String) });
    expect(getRow("live_classes", "lc1")).toMatchObject({ title: "Algebra revision", deleted: true, status: "cancelled" });
    expect(screen.queryByText("Algebra revision")).not.toBeInTheDocument();
  });
});
