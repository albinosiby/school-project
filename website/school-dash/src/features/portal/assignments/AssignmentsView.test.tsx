import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authState, renderUI, screen, seed, within, writes } from "@/test/render";
import { redirect } from "next/navigation";
import { AssignmentsView } from "./AssignmentsView";
import HomeworkPage from "../../../app/(portal)/me/homework/page";
import { base, teacher } from "./fixtures";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 23, 12, 0)); });
afterEach(() => vi.useRealTimers());

const card = (title: string) => screen.getByRole("link", { name: `Assignment ${title}` });

describe("Assignments list", () => {
  it("shows the review hero, the figures and the active work grouped by due day", () => {
    teacher(); seed(base);
    renderUI(<AssignmentsView />);
    expect(screen.getByText("3 active • 4 to review")).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: "Overview" });
    expect(hero).toHaveTextContent("4hand-ins to review");
    expect(hero).toHaveTextContent("3Active1Due this week1Late hand-ins");
    expect(within(hero).getByRole("link", { name: /Review/ })).toHaveAttribute("href", "/me/assignments/a?filter=toGrade");
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Active(3)", "To review(3)", "Upcoming(1)", "Closed(1)"]);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Overdue 1", "Due today 1", "Later 1"]);
    expect(within(screen.getByRole("region", { name: "Overdue" })).getByRole("link")).toHaveAccessibleName("Assignment Homework b");
    expect(card("Homework a")).toHaveAttribute("href", "/me/assignments/a");
    expect(card("Homework a")).toHaveTextContent("23Nov");
    expect(card("Homework a")).toHaveTextContent("Class 10-B • Mathematics");
    expect(card("Homework a")).toHaveTextContent("Due today");
    expect(card("Homework a")).toHaveTextContent("3/3 handed in");
    expect(card("Homework a")).toHaveTextContent("2 to review1 gradedOut of 201 file");
    expect(card("Homework b")).toHaveTextContent("Overdue by 3 days");
    expect(card("Homework b")).toHaveTextContent("1 late");
    expect(card("Homework e")).toHaveTextContent("0/3 handed in"); // admin-created: the roster, all pending
    expect(screen.queryByText("Homework gone")).not.toBeInTheDocument();
    expect(screen.queryByText("Homework other")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New assignment" })).toHaveAttribute("href", "/me/assignments/new");
    expect(writes).toHaveLength(0);
  });

  it("switches tabs and filters by class", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<AssignmentsView />);
    await user.click(screen.getByRole("tab", { name: /To review/ }));
    expect(screen.getAllByRole("link", { name: /^Assignment / }).map((l) => l.getAttribute("aria-label"))).toEqual(["Assignment Homework a", "Assignment Homework d", "Assignment Homework b"]);
    await user.click(screen.getByRole("tab", { name: /Upcoming/ }));
    expect(card("Homework c")).toHaveTextContent(/Publishes 25 Nov, \d+:\d\d (AM|PM)/);
    expect(card("Homework c")).not.toHaveTextContent("handed in");
    await user.click(screen.getByRole("tab", { name: /Closed/ }));
    expect(card("Homework d")).toHaveTextContent("Closed2/3 handed in1 to review1 gradedNot graded");

    await user.click(screen.getByRole("button", { name: "Class 9-A" }));
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Active(0)", "To review(0)", "Upcoming(1)", "Closed(0)"]);
    expect(screen.getByText("No closed assignments")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New assignment" })).toHaveAttribute("href", "/me/assignments/new?classId=cls_9A");
    await user.click(screen.getByRole("button", { name: "All classes" }));
    expect(screen.getByRole("tab", { name: /Closed/ })).toHaveTextContent("(1)");
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<AssignmentsView />);
    expect(screen.getByText("Only teachers have assignments")).toBeInTheDocument();
  });

  it("sends the old /me/homework page to /me/assignments", () => {
    HomeworkPage();
    expect(redirect).toHaveBeenCalledWith("/me/assignments");
  });
});
