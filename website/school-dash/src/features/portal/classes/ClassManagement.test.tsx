import { describe, expect, it } from "vitest";
import { ADMIN_UID, dialog, field, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { ClassManagement } from "./ClassManagement";
import { base, leave, signInTeacher } from "./testFixtures";

describe("Class management", () => {
  it("is for the class teacher only", () => {
    signInTeacher(); seed(base());
    renderUI(<ClassManagement classId="cls_9A" />);
    expect(screen.getByText("Only the class teacher manages this class")).toBeInTheDocument();
    expect(screen.getByText(/You teach class 9-A/)).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("shows class performance, attendance by every subject of the timetable, and who needs support", () => {
    signInTeacher(); seed(base());
    renderUI(<ClassManagement classId="cls_10B" />);
    expect(screen.getByRole("tab", { name: /Leaves/ })).toHaveTextContent("(1)");
    // 5 of 6 period-marks present or late; marks 80, 50, 30, 90 → 62.5
    expect(screen.getByText("Class performance").parentElement).toHaveTextContent("Attendance83.3%Marks average62.5%Need support1");
    const bySubject = screen.getByRole("list", { name: "Attendance by subject" });
    expect(within(bySubject).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Mathematics: 50%", "English: 100%", "Science: 100%"]);
    expect(within(bySubject).getAllByRole("listitem")[0]).toHaveTextContent("2/wk · 1 reg.");
    const marks = screen.getByRole("list", { name: "Subject performance" });
    expect(within(marks).getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Mathematics: 67%", "English: No marks yet", "Science: 50%"]);
    expect(screen.getByRole("img", { name: "Students per marks band" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Class attendance by day" })).toBeInTheDocument();
    // Aarav: attendance 67% (under 75)
    const support = screen.getByRole("region", { name: "Needs support" });
    expect(within(support).getByRole("link", { name: "Aarav Mehta" })).toHaveAttribute("href", "/me/classes/cls_10B/students/stu_1");
  });

  it("lists every register of a day with its subject and who was absent", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<ClassManagement classId="cls_10B" />);
    await user.click(screen.getByRole("tab", { name: "Attendance" }));
    const recent = screen.getByRole("list", { name: "Recent registers" });
    const rows = within(recent).getAllByRole("button");
    expect(rows.map((b) => b.textContent)).toEqual(["Tue 24 Nov1 period marked100%0 absent", "Mon 23 Nov2 of 3 periods marked75%1 absent"]);
    await user.click(rows[1]!);
    const d = dialog("Mon 23 Nov");
    expect(d).toHaveTextContent("2 of 3 periods marked");
    const items = within(d).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("P1Mathematics1/2Absent: Aarav Mehta");
    expect(items[1]).toHaveTextContent("P2English2/2No one absent · 1 late");
    expect(screen.getByRole("button", { name: "2026-11-23, 75%" })).toBeInTheDocument();
  });

  it("approves a parent's leave request with a note, writing only the decision fields", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<ClassManagement classId="cls_10B" />);
    await user.click(screen.getByRole("tab", { name: /Leaves/ }));
    expect(screen.queryByText("Nine A")).not.toBeInTheDocument();
    const item = screen.getByRole("listitem", { name: "Leave request of Aarav Mehta" });
    expect(item).toHaveTextContent("2026-11-25 – 2026-11-26 · Family Event · by Mr Mehta (Father)");
    await user.click(within(item).getByRole("button", { name: "Approve" }));
    await user.type(field("Note to parent", dialog("Approve leave")), "Approved, bring a note");
    await user.click(within(dialog()).getByRole("button", { name: "Approve" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "student_leaves", id: "lv_1" });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["decidedAt", "decidedBy", "decisionNote", "status", "updatedAt", "updatedBy"]);
    expect(getRow("student_leaves", "lv_1")).toEqual({
      ...leave("lv_1", "stu_1", "cls_10B", { name: "Aarav Mehta" }), status: "Approved", decisionNote: "Approved, bring a note", decidedBy: "stf_1", decidedAt: expect.any(String), updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(await screen.findByText("Leave approved for Aarav Mehta")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Decided/ })).toHaveTextContent("(2)");
  });

  it("rejects a request without a note and shows decided ones under their tab", async () => {
    signInTeacher(); seed(base());
    const { user } = renderUI(<ClassManagement classId="cls_10B" />);
    await user.click(screen.getByRole("tab", { name: /Leaves/ }));
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(within(dialog("Reject leave")).getByRole("button", { name: "Reject" }));
    expect(getRow("student_leaves", "lv_1")).toMatchObject({ status: "Rejected", decisionNote: "", decidedBy: "stf_1" });
    await user.click(screen.getByRole("tab", { name: /Decided/ }));
    expect(screen.getByRole("listitem", { name: "Leave request of Bina Rao" })).toHaveTextContent("Note: Enjoy");
  });
});
