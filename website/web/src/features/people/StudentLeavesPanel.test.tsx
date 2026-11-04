import { describe, expect, it } from "vitest";
import { StudentLeavesPanel } from "./StudentLeavesPanel";
import { ADMIN_UID, dialog, failNextWrite, field, fieldError, getRow, renderUI, screen, seed, within, writes } from "@/test/render";

const students = [{ id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B" }];
// shape written by the parent app (FirebaseLeaveRepository.apply)
const leave = { id: "lv1", studentId: "stu_101", classId: "cls_10B", name: "Aarav Sharma", from: "2026-11-05", to: "2026-11-06", days: 2, reason: "Family function",
  status: "Pending", parentUid: "uid_p1", type: "Personal Leave", cat: "leave", by: "Mr. Rahul Sharma (Father)" };

describe("Student leave decision (admin, when the class teacher is unavailable)", () => {
  it("approves with the decision fields only", async () => {
    seed({ student_leaves: [leave], classes: [{ id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_025" }], staff: [{ id: "stf_025", name: "Mrs. Anita Sharma", status: "On leave" }] });
    const { user } = renderUI(<StudentLeavesPanel students={students} />);
    expect(screen.getByText("2 days")).toBeInTheDocument();
    expect(screen.getByText("Mrs. Anita Sharma")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(writes).toHaveLength(1);
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["decidedAt", "decidedBy", "decisionNote", "status", "updatedAt", "updatedBy"]);
    expect(getRow("student_leaves", "lv1")).toMatchObject({ status: "Approved", decisionNote: "", decidedBy: ADMIN_UID, parentUid: "uid_p1", reason: "Family function" });
    expect(await screen.findByText("Leave approved")).toBeInTheDocument();
  });

  it("rejecting needs a note of at least 5 characters", async () => {
    seed({ student_leaves: [leave] });
    const { user } = renderUI(<StudentLeavesPanel students={students} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const d = dialog("Reject leave request");
    await user.type(field("Note to the parent", d), "No");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(fieldError("Note to the parent", d)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
    await user.type(field("Note to the parent", d), "t enough notice");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(getRow("student_leaves", "lv1")).toMatchObject({ status: "Rejected", decisionNote: "Not enough notice", decidedBy: ADMIN_UID });
  });

  it("keeps the request pending and tells the admin when the write fails", async () => {
    seed({ student_leaves: [leave] });
    const { user } = renderUI(<StudentLeavesPanel students={students} />);
    failNextWrite();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Could not save the decision")).toBeInTheDocument();
    expect(getRow("student_leaves", "lv1")).toMatchObject({ status: "Pending" });
  });

  it("reads lower-case statuses, hides soft-deleted requests and falls back to the stored day count", async () => {
    seed({ student_leaves: [{ ...leave, id: "lv2", status: "approved", decidedBy: "stf_025" }, { ...leave, id: "lv3", deleted: true }, { ...leave, id: "lv4", from: "bad", to: "", days: 3 }] });
    const { user } = renderUI(<StudentLeavesPanel students={students} />);
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("1");
    expect(screen.getByText("3 days")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Approved/ }));
    expect(screen.getByText(/^by Teacher/)).toBeInTheDocument(); // decidedBy = staff id (teacher app)
    await user.click(screen.getByRole("tab", { name: /All/ }));
    expect(screen.getAllByText("Aarav Sharma")).toHaveLength(2);
  });
});
