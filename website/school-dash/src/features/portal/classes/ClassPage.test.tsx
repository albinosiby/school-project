import { describe, expect, it } from "vitest";
import { renderUI, screen, seed, within, writes } from "@/test/render";
import { ClassPage } from "./ClassPage";
import { base, signInTeacher } from "./testFixtures";

describe("Class subject page", () => {
  it("shows the class's figures, the roster linking to each profile and the teacher's own assignments", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<ClassPage classId="cls_10B" />);
    expect(screen.getByRole("heading", { name: "Class 10-B" })).toBeInTheDocument();
    expect(screen.getByText("You teach Mathematics · you are the class teacher")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Manage class/ })).toHaveAttribute("href", "/me/classes/cls_10B/manage");
    const roster = screen.getByRole("list", { name: "Students of 10-B" });
    const rows = within(roster).getAllByRole("link");
    // roll order; Aarav: 2 of 3 periods attended (absent P1 on 23 Nov, late P2 counts)
    expect(rows.map((a) => [a.getAttribute("aria-label"), a.getAttribute("href")])).toEqual([
      ["Bina Rao", "/me/classes/cls_10B/students/stu_2"], ["Aarav Mehta", "/me/classes/cls_10B/students/stu_1"],
    ]);
    expect(rows[1]).toHaveTextContent("Roll 02 · Adm GRN-1");
    expect(rows[1]).toHaveTextContent("67%");
    expect(rows[0]).toHaveTextContent("100%");
    const hw = screen.getByRole("list", { name: "Assignments" });
    expect(hw).toHaveTextContent("Algebra sheet");
    expect(hw).toHaveTextContent("1/2 turned in");
    expect(hw).not.toHaveTextContent("Lab notes");

    await user.selectOptions(screen.getByRole("combobox", { name: "Sort students" }), "Attendance (low first)");
    expect(within(roster).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual(["Aarav Mehta", "Bina Rao"]);
    await user.type(screen.getByPlaceholderText("Search name, roll or admission no."), "bina");
    expect(within(roster).getAllByRole("link").map((a) => a.getAttribute("aria-label"))).toEqual(["Bina Rao"]);
    expect(writes).toHaveLength(0);
  });

  it("is the subject view only for a teacher who is not the class teacher", () => {
    signInTeacher(); seed(base());
    renderUI(<ClassPage classId="cls_9A" />);
    expect(screen.getByText("You teach English")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Manage class/ })).not.toBeInTheDocument();
  });

  it("refuses a class the teacher neither teaches nor runs", () => {
    signInTeacher(); seed(base());
    renderUI(<ClassPage classId="cls_7C" />);
    expect(screen.getByText("This class is not one of yours")).toBeInTheDocument();
    expect(screen.queryByText("Nine A")).not.toBeInTheDocument();
  });
});
