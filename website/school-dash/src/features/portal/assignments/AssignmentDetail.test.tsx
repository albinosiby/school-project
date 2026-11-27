import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dialog, getRow, renderUI, router, screen, seed, setUrl, within, writes } from "@/test/render";
import { AssignmentDetail } from "./AssignmentDetail";
import { base, teacher } from "./fixtures";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

const students = () => within(screen.getByRole("group", { name: "Students" })).getAllByRole("button", { name: /^Review / });

describe("Assignment detail", () => {
  it("shows the brief, the hand-in progress and every student's status", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AssignmentDetail id="a" />);
    expect(screen.getByRole("heading", { name: "Homework a" })).toBeInTheDocument();
    const brief = screen.getByRole("group", { name: "Brief" });
    expect(brief).toHaveTextContent("Due todayOpen for hand-insOut of 20Ex 4.1");
    expect(within(brief).getByRole("link", { name: /worksheet\.pdf/ })).toHaveAttribute("href", "https://files.test/m/worksheet.pdf");
    const progress = screen.getByRole("group", { name: "Hand-ins" });
    expect(progress).toHaveTextContent("3 of 3 handed in • 1 in the parent app");
    expect(progress).toHaveTextContent("100%handed in");
    expect(progress).toHaveTextContent("To grade2Graded1Not handed in0");
    expect(progress).toHaveTextContent("Average 18.0 / 20");
    expect(students()[0]).toHaveTextContent(/Aarav MehtaRoll 01 • 1 file • 23 Nov, \d+:\d\d (AM|PM)To grade$/);
    expect(students()[1]).toHaveTextContent("Bina RaoRoll 02 • On paperTo grade");
    expect(students()[2]).toHaveTextContent("Chen LiRoll 03 • On paper18/20");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["All(3)", "To grade(2)", "Graded(1)", "Not handed in(0)", "Late(0)"]);
    await user.click(screen.getByRole("tab", { name: /^Graded/ }));
    expect(students().map((b) => b.getAttribute("aria-label"))).toEqual(["Review Chen Li"]);
    expect(writes).toHaveLength(0);
  });

  it("grades a parent upload with Save & next, never writing the hand-in copy", async () => {
    teacher(); seed(base); setUrl("/me/assignments/a?filter=toGrade");
    const { user } = renderUI(<AssignmentDetail id="a" />);
    expect(students().map((b) => b.getAttribute("aria-label"))).toEqual(["Review Aarav Mehta", "Review Bina Rao"]);
    await user.click(screen.getByRole("button", { name: "Review Aarav Mehta" }));
    let d = dialog("Review: Aarav Mehta");
    expect(within(d).getByRole("region", { name: "Hand-in" })).toHaveTextContent("Handed in through the parent app");
    expect(within(d).getByRole("link", { name: /page1\.jpg/ })).toHaveAttribute("href", "https://files.test/hw/a/stu_1/page1.jpg");
    expect(d).toHaveTextContent("“Done in class notebook”");
    expect(within(d).queryByRole("button", { name: /on paper/ })).not.toBeInTheDocument();
    await user.type(within(d).getByLabelText("Marks"), "25");
    await user.click(within(d).getByRole("button", { name: "Save & next" }));
    expect(d).toHaveTextContent("Enter marks from 0 to 20");
    expect(writes).toHaveLength(0);
    await user.click(within(d).getByRole("button", { name: "Full" }));
    expect(within(d).getByLabelText("Marks")).toHaveValue("20");
    await user.click(within(d).getByRole("button", { name: "One mark less" }));
    await user.click(within(d).getByRole("button", { name: "Excellent work" }));
    await user.click(within(d).getByRole("button", { name: "Show your working" }));
    expect(within(d).getByLabelText("Feedback")).toHaveValue("Excellent work. Show your working");
    await user.click(within(d).getByRole("button", { name: "Save & next" }));

    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "a" });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["submissions", "submitted", "total", "updatedAt", "updatedBy"]);
    expect((writes[0]!.data!.submissions as Record<string, unknown>).stu_1).toEqual({
      status: "graded", feedback: "Excellent work. Show your working", marks: 19, gradedAt: expect.any(String), gradedBy: "Anita",
    });
    expect(getRow("ops_homework", "a")).toMatchObject({ submitted: 3, total: 3, handins: { stu_1: { note: "Done in class notebook" } } });

    // the next paper to grade opens: Bina, handed in on paper
    d = dialog("Review: Bina Rao");
    expect(within(d).getByRole("region", { name: "Hand-in" })).toHaveTextContent("Handed in on paper");
    expect(within(d).queryByRole("button", { name: "Save & next" })).not.toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Undo: not handed in" }));
    expect((writes[1]!.data!.submissions as Record<string, unknown>).stu_2).toEqual({ status: "pending", feedback: "" });
    expect(writes[1]!.data).toMatchObject({ submitted: 2, total: 3 });
    expect(within(d).getByRole("region", { name: "Hand-in" })).toHaveTextContent("Not handed in yet");
    await user.click(within(d).getByRole("button", { name: "Mark handed in on paper" }));
    expect((writes[2]!.data!.submissions as Record<string, unknown>).stu_2).toEqual({ status: "submitted", feedback: "" });
  });

  it("marks a not-graded assignment as done and all students handed in", async () => {
    teacher(); seed({ ...base, ops_homework: [{ ...base.ops_homework[3]!, status: "open" }] });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user } = renderUI(<AssignmentDetail id="d" />);
    expect(screen.getByRole("group", { name: "Brief" })).toHaveTextContent("Not graded");
    expect(screen.getByRole("group", { name: "Hand-ins" })).toHaveTextContent("To check1Checked1Not handed in1");
    await user.click(screen.getByRole("button", { name: "All handed in" }));
    expect((writes[0]!.data!.submissions as Record<string, unknown>).stu_1).toEqual({ status: "submitted", feedback: "" });
    expect(writes[0]!.data).toMatchObject({ submitted: 3, total: 3 });
    await user.click(screen.getByRole("button", { name: "Review Aarav Mehta" }));
    const d = dialog("Review: Aarav Mehta");
    expect(within(d).queryByLabelText("Marks")).not.toBeInTheDocument();
    await user.click(within(d).getAllByRole("button", { name: "Mark as done" })[0]!);
    expect((writes[1]!.data!.submissions as Record<string, unknown>).stu_1).toEqual({ status: "graded", feedback: "", gradedAt: expect.any(String), gradedBy: "Anita" });
    expect(await screen.findByText("Marked as done")).toBeInTheDocument();
  });

  it("closes, reopens, publishes a scheduled one now and soft-deletes", async () => {
    teacher(); seed(base);
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, unmount } = renderUI(<AssignmentDetail id="a" />);
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/me/assignments/a/edit");
    await user.click(screen.getByRole("button", { name: "Close hand-ins" }));
    expect(writes[0]).toMatchObject({ op: "update", coll: "ops_homework", id: "a", data: { status: "closed" } });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["status", "updatedAt", "updatedBy"]);
    expect(await screen.findByText("Closed — parents can no longer hand in")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen hand-ins" }));
    expect(writes[1]!.data).toMatchObject({ status: "open" });
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(writes[2]).toMatchObject({ op: "update", coll: "ops_homework", id: "a", data: { deleted: true } });
    expect(Object.keys(writes[2]!.data!).sort()).toEqual(["deleted", "updatedAt", "updatedBy"]);
    expect(router.push).toHaveBeenCalledWith("/me/assignments");
    unmount();

    renderUI(<AssignmentDetail id="c" />);
    expect(screen.getByRole("group", { name: "Brief" })).toHaveTextContent(/Publishes 25 Nov/);
    await user.click(screen.getByRole("button", { name: "Publish now" }));
    expect(writes[3]).toMatchObject({ id: "c", data: { status: "open" } });
    expect(await screen.findByText("Published — parents are notified")).toBeInTheDocument();
  });

  it("says when the assignment is not there", () => {
    teacher(); seed(base);
    renderUI(<AssignmentDetail id="gone" />);
    expect(screen.getByText("Assignment not found")).toBeInTheDocument();
  });
});
