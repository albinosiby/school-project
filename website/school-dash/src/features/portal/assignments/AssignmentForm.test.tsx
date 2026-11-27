import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { ADMIN_UID, field, fieldError, getRow, renderUI, router, rowsOf, screen, seed, uploads, within, writes } from "@/test/render";
import { AssignmentForm } from "./AssignmentForm";
import { base, hw, teacher } from "./fixtures";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

const publishButton = () => screen.getAllByRole("button", { name: /^(Publish|Schedule|Save)$/ }).find((b) => !b.hasAttribute("aria-pressed"))!;
const when = () => screen.getByRole("group", { name: "When to publish" });

describe("New assignment", () => {
  it("creates the assignment the way the app writes it, uploading the attachments", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AssignmentForm classId="cls_10B" />);
    expect(screen.getByRole("button", { name: "Class 10-B" })).toHaveAttribute("aria-pressed", "true");
    expect(within(screen.getByRole("group", { name: "Subject" })).getAllByRole("button").map((b) => b.textContent)).toEqual(["Mathematics", "Physics"]);
    expect(screen.getByText("3 students • due tomorrow")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Timeline" })).toHaveTextContent("Published nowParents notifiedNo reminderDue too soon for the 2-day reminderDue");

    await user.type(field("Title"), "Fr");
    await user.click(publishButton());
    expect(fieldError("Title")).toBe("Give the assignment a title (at least 3 characters)");
    expect(writes).toHaveLength(0);

    await user.type(field("Title"), "actions — exercise 4.2");
    await user.type(field("Description"), "Q1-10");
    await user.click(screen.getByRole("button", { name: "Physics" }));
    await user.click(screen.getByRole("button", { name: "In a week" }));
    expect(screen.getByRole("list", { name: "Timeline" })).toHaveTextContent("ReminderSat, 28 Nov, 8 AM • only to those not handed in");
    await user.click(screen.getByRole("button", { name: "25" }));
    await user.click(screen.getByRole("switch", { name: "Accept late hand-ins" }));
    const big = new File(["x"], "huge.pdf", { type: "application/pdf" });
    Object.defineProperty(big, "size", { value: 15 * 1024 * 1024 + 1 });
    await user.upload(screen.getByLabelText("Attach files"), [new File(["%PDF"], "sheet.pdf", { type: "application/pdf" }), big]);
    expect(await screen.findByText("1 file(s) over 15 MB were skipped")).toBeInTheDocument();
    expect(screen.getByText("sheet.pdf")).toBeInTheDocument();
    expect(screen.queryByText("huge.pdf")).not.toBeInTheDocument();

    await user.click(publishButton());
    expect(uploads).toEqual([{ path: expect.stringMatching(/^schools\/sch_test\/homework-materials\/admin_uid\/mat_/), size: 4, type: "application/pdf" }]);
    expect(writes).toHaveLength(1);
    const created = rowsOf<Record<string, unknown>>("ops_homework").find((h) => h.title === "Fractions — exercise 4.2")!;
    expect(created).toEqual({
      id: expect.stringMatching(/^hw_/), classId: "cls_10B", grade: "10", section: "B", title: "Fractions — exercise 4.2", subject: "Physics", due: "2026-11-30", maxMarks: 25,
      description: "Q1-10", status: "open", allowLate: false,
      attachments: [{ name: "sheet.pdf", size: "", kind: "file", url: `https://files.test/${uploads[0]!.path}`, path: uploads[0]!.path, contentType: "application/pdf", bytes: 4 }],
      createdAt: new Date(2026, 10, 23, 12, 0).toISOString(), assigned: "2026-11-23", teacher: "Anita",
      submissions: { stu_1: { status: "pending", feedback: "" }, stu_2: { status: "pending", feedback: "" }, stu_3: { status: "pending", feedback: "" } }, submitted: 0, total: 3, teacherId: "stf_1",
      updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(await screen.findByText("Assignment posted to 3 students — parents are notified")).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith(`/me/assignments/${created.id}`);
  });

  it("schedules for later: the time must be in the future and on or before the due day; not graded is maxMarks 0", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AssignmentForm classId="cls_9A" />);
    expect(screen.queryByRole("group", { name: "Subject" })).not.toBeInTheDocument();
    expect(screen.getByText("Science • Class 9-A")).toBeInTheDocument();
    await user.type(field("Title"), "Plant cells");
    await user.click(within(when()).getByRole("button", { name: "Schedule" }));
    expect(field("Publish at")).toHaveValue("2026-11-24T08:00");
    fireEvent.change(field("Publish at"), { target: { value: "2026-11-23T09:00" } });
    await user.click(publishButton());
    expect(fieldError("Publish at")).toBe("Pick a publish time in the future");
    fireEvent.change(field("Publish at"), { target: { value: "2026-11-26T08:00" } });
    await user.click(publishButton());
    expect(fieldError("Publish at")).toBe("Publish on or before the due day");
    expect(writes).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "In 3 days" }));
    await user.click(screen.getByRole("switch", { name: "Give marks" }));
    expect(screen.queryByRole("group", { name: "Out of" })).not.toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Timeline" })).toHaveTextContent("PublishedThu, 26 Nov, 8:00 AMNo reminder");
    expect(publishButton()).toHaveTextContent("Schedule");
    await user.click(publishButton());
    const created = rowsOf<Record<string, unknown>>("ops_homework").find((h) => h.title === "Plant cells")!;
    expect(created).toMatchObject({ classId: "cls_9A", subject: "Science", status: "scheduled", publishAt: new Date(2026, 10, 26, 8, 0).toISOString(), due: "2026-11-26", maxMarks: 0, allowLate: true,
      submissions: { stu_9: { status: "pending", feedback: "" } }, total: 1 });
    expect(await screen.findByText("Assignment scheduled — parents are notified when it is published")).toBeInTheDocument();
  });

  it("checks the custom out-of value", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AssignmentForm />);
    await user.type(field("Title"), "Revision");
    await user.clear(field("Out of"));
    await user.type(field("Out of"), "1001");
    await user.click(publishButton());
    expect(screen.getAllByText("Enter marks from 1 to 1000").length).toBeGreaterThan(0);
    expect(writes).toHaveLength(0);
  });
});

describe("Edit assignment", () => {
  it("fills the form and writes only its own fields, keeping submissions and hand-ins", async () => {
    teacher(); seed({ ...base, ops_homework: [hw("a", { status: "closed", maxMarks: 25, allowLate: false, handins: { stu_1: { files: [] } } })] });
    const { user } = renderUI(<AssignmentForm editId="a" />);
    expect(screen.getByRole("heading", { name: "Edit assignment" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Class" })).not.toBeInTheDocument();
    expect(field("Title")).toHaveValue("Homework a");
    expect(field("Out of")).toHaveValue("25");
    expect(screen.getByRole("switch", { name: "Accept late hand-ins" })).toHaveAttribute("aria-checked", "false");
    await user.clear(field("Title"));
    await user.type(field("Title"), "Homework A (revised)");
    await user.click(publishButton());
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "a" });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["allowLate", "attachments", "description", "due", "maxMarks", "status", "subject", "title", "updatedAt", "updatedBy"]);
    expect(getRow("ops_homework", "a")).toMatchObject({ title: "Homework A (revised)", status: "closed", due: "2026-11-23", maxMarks: 25, allowLate: false, submitted: 2, handins: { stu_1: { files: [] } } });
    expect(await screen.findByText("Assignment updated")).toBeInTheDocument();
    expect(router.push).toHaveBeenCalledWith("/me/assignments/a");
  });

  it("says when the assignment is not there", () => {
    teacher(); seed(base);
    renderUI(<AssignmentForm editId="nope" />);
    expect(screen.getByText("Assignment not found")).toBeInTheDocument();
  });
});
