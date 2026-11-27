import { describe, expect, it } from "vitest";
import { authState, renderUI, screen, seed, within, writes } from "@/test/render";
import { todayIso } from "../teaching";
import { MyClasses } from "./MyClasses";
import { base, signInTeacher } from "./testFixtures";

describe("My classes", () => {
  it("shows the class teacher's card with today's register, attendance, leave requests and Manage class", () => {
    signInTeacher();
    const data = base();
    seed({ ...data, ops_attendance: [...data.ops_attendance, { id: `${todayIso()}_cls_10B_2`, date: todayIso(), classId: "cls_10B", period: 2, total: 2, marks: { stu_2: "A" }, submitted: true }] });
    renderUI(<MyClasses />);
    expect(screen.getByText("2 classes · class teacher of 10-B")).toBeInTheDocument();
    const card = screen.getByRole("region", { name: "My class 10-B" });
    expect(card).toHaveTextContent("Class teacher");
    expect(card).toHaveTextContent("2 students · Room 12");
    expect(card).toHaveTextContent("Today1/2");
    // 23 Nov: 1/2 + 2/2 (late counts), 24 Nov 2/2, today 1/2 → 6 of 8
    expect(card).toHaveTextContent("Attendance75.0%");
    expect(card).toHaveTextContent("Leave requests1");
    expect(within(card).getByRole("link", { name: /Manage class/ })).toHaveAttribute("href", "/me/classes/cls_10B/manage");
    expect(writes).toHaveLength(0);
  });

  it("lists the classes the teacher teaches, her own class included when she teaches a subject there", () => {
    signInTeacher(); seed(base());
    renderUI(<MyClasses />);
    const grid = screen.getByRole("region", { name: "Classes you teach" });
    const links = within(grid).getAllByRole("link");
    expect(links.map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")])).toEqual([["Class 10-B", "/me/classes/cls_10B"], ["Class 9-A", "/me/classes/cls_9A"]]);
    expect(links[0]).toHaveTextContent("Mathematics");
    expect(links[0]).toHaveTextContent("Your class");
    expect(links[0]).toHaveTextContent("Algebra sheet · 1/2 turned in");
    expect(links[1]).toHaveTextContent("English");
    expect(links[1]).toHaveTextContent("1 students");
    expect(links[1]).toHaveTextContent("100% attendance");
    expect(screen.queryByRole("link", { name: "Class 7-C" })).not.toBeInTheDocument();
  });

  it("keeps the class teacher's own class out of the teaching grid when she teaches no subject there", () => {
    signInTeacher();
    const data = base();
    seed({ ...data, ops_periods: data.ops_periods.filter((p) => p.classId !== "cls_10B" || p.teacherId !== "stf_1") });
    renderUI(<MyClasses />);
    expect(screen.getByRole("region", { name: "My class 10-B" })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Classes you teach" })).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual(["Class 9-A"]);
  });

  it("shows only the teaching grid to a teacher who is no class teacher", () => {
    signInTeacher("stf_3", "Meena"); seed(base());
    renderUI(<MyClasses />);
    expect(screen.queryByRole("region", { name: /^My class/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Class 10-B" })).toHaveTextContent("Science");
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MyClasses />);
    expect(screen.getByText("Only teachers have classes")).toBeInTheDocument();
  });
});
