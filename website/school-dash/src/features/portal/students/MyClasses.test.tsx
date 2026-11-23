import { describe, expect, it } from "vitest";
import { ADMIN_UID, authState, dialog, field, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { MyClasses } from "./MyClasses";
import { decisionPatch, myClasses, pendingLeaves } from "./logic";

const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };
const classes = [
  { id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_2", room: "9" },
  { id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_1", room: "12" },
  { id: "cls_7C", grade: "7", section: "C", classTeacherId: "stf_2" },
  { id: "cls_6A", grade: "6", section: "A", classTeacherId: "stf_1", deleted: true },
];
const assignments = [{ id: "asg_1", classId: "cls_9A", subject: "English", teacherId: "stf_1" }, { id: "asg_2", classId: "cls_7C", subject: "Hindi", teacherId: "stf_2" }];
const periods = [{ id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Mathematics", teacher: "Anita", teacherId: "stf_1", room: "" }];
const students = [
  { id: "stu_1", name: "Aarav Mehta", grn: "GRN-1", classId: "cls_10B", roll: 2, guardian: "Mr Mehta", phone: "9876500001", status: "Active" },
  { id: "stu_2", name: "Bina Rao", grn: "GRN-2", classId: "cls_10B", roll: 1, guardian: "Mrs Rao", phone: "9876500002" },
  { id: "stu_3", name: "Left Student", grn: "GRN-3", classId: "cls_10B", roll: 3, status: "Alumni" },
  { id: "stu_9", name: "Nine A", grn: "GRN-9", classId: "cls_9A", roll: 1 },
];
const leave = (id: string, studentId: string, classId: string, extra: Record<string, unknown> = {}) => ({
  id, studentId, classId, name: students.find((s) => s.id === studentId)?.name, roll: 1, from: "2026-11-25", to: "2026-11-26", days: 2, reason: "Family function",
  type: "Family Event", leaveType: "familyEvent", cat: "leave", by: "Mr Mehta (Father)", status: "Pending", parentUid: "uid_parent", appliedOn: "2026-11-20",
  createdAt: "2026-11-20T05:00:00.000Z", updatedAt: "2026-11-20T05:00:00.000Z", updatedBy: "uid_parent", ...extra,
});
const leaves = [
  leave("lv_1", "stu_1", "cls_10B"),
  leave("lv_2", "stu_9", "cls_9A"), // not class teacher of 9-A: not decidable here
  leave("lv_3", "stu_2", "cls_10B", { status: "Approved", decidedBy: "stf_1", decidedAt: "2026-11-21T05:00:00.000Z", decisionNote: "Enjoy" }),
];
const base = { staff: [{ id: "stf_1", name: "Anita" }], classes, assignments, ops_periods: periods, students, student_leaves: leaves };

describe("my classes logic", () => {
  it("collects classes from assignments, periods and class teacher, class-teacher ones first, skipping deleted classes", () => {
    const rows = myClasses("stf_1", { assignments, classes, periods });
    expect(rows.map((c) => `${c.id}:${c.classTeacher}:${c.subjects.join("/")}`)).toEqual(["cls_10B:true:Mathematics", "cls_9A:false:English"]);
  });
  it("lists pending requests of class-teacher classes only and writes only the decision fields", () => {
    expect(pendingLeaves(leaves, ["cls_10B"]).map((l) => l.id)).toEqual(["lv_1"]);
    expect(decisionPatch("Rejected", "  too long  ", "stf_1", "2026-11-23T06:00:00.000Z")).toEqual({ status: "Rejected", decisionNote: "too long", decidedBy: "stf_1", decidedAt: "2026-11-23T06:00:00.000Z" });
  });
});

describe("My classes", () => {
  it("shows the teacher's classes with their active students", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyClasses />);
    expect(screen.getByText("2 classes · class teacher of 10-B")).toBeInTheDocument();
    const tenB = screen.getByRole("region", { name: "Class 10-B" });
    expect(tenB).toHaveTextContent("Class teacher");
    expect(tenB).toHaveTextContent("Mathematics · 2 students");
    expect(screen.getByRole("region", { name: "Class 9-A" })).toHaveTextContent("English · 1 students");
    expect(screen.queryByRole("region", { name: "Class 7-C" })).not.toBeInTheDocument();
    await user.click(within(tenB).getByRole("button", { expanded: false }));
    const table = within(tenB).getByRole("table", { name: "Students of 10-B" });
    const rows = within(table).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell").map((c) => c.textContent));
    expect(rows).toEqual([["1", "Bina Rao", "GRN-2", "Mrs Rao", "9876500002"], ["2", "Aarav Mehta", "GRN-1", "Mr Mehta", "9876500001"]]);
    expect(writes).toHaveLength(0);
  });

  it("approves a parent's leave request writing only status, decisionNote, decidedBy, decidedAt, updatedAt, updatedBy", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyClasses />);
    expect(screen.getByRole("tab", { name: /Pending/ })).toHaveTextContent("(1)");
    expect(screen.queryByText("Nine A")).not.toBeInTheDocument();
    const item = screen.getByText("Aarav Mehta", { selector: "p" }).closest("li")!;
    expect(item).toHaveTextContent("2026-11-25 – 2026-11-26 · Family Event · by Mr Mehta (Father)");
    await user.click(within(item).getByRole("button", { name: "Approve" }));
    await user.type(field("Note to parent", dialog("Approve leave")), "Approved, bring a note");
    await user.click(within(dialog()).getByRole("button", { name: "Approve" }));
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ op: "update", coll: "student_leaves", id: "lv_1" });
    expect(Object.keys(writes[0]!.data!).sort()).toEqual(["decidedAt", "decidedBy", "decisionNote", "status", "updatedAt", "updatedBy"]);
    expect(getRow("student_leaves", "lv_1")).toEqual({
      ...leave("lv_1", "stu_1", "cls_10B"), status: "Approved", decisionNote: "Approved, bring a note", decidedBy: "stf_1", decidedAt: expect.any(String), updatedAt: expect.any(String), updatedBy: ADMIN_UID,
    });
    expect(await screen.findByText("Leave approved for Aarav Mehta")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Decided/ })).toHaveTextContent("(2)");
  });

  it("rejects a request and shows decided ones under their tab", async () => {
    teacher(); seed(base);
    const { user } = renderUI(<MyClasses />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.click(within(dialog("Reject leave")).getByRole("button", { name: "Reject" }));
    expect(getRow("student_leaves", "lv_1")).toMatchObject({ status: "Rejected", decisionNote: "", decidedBy: "stf_1" });
    await user.click(screen.getByRole("tab", { name: /Decided/ }));
    expect(screen.getByText("Bina Rao", { selector: "p" }).closest("li")).toHaveTextContent("Note: Enjoy");
  });

  it("hides leave requests from a teacher who is not a class teacher", () => {
    teacher(); seed({ ...base, classes: classes.map((c) => ({ ...c, classTeacherId: "stf_2" })) });
    renderUI(<MyClasses />);
    expect(screen.queryByText("Student leave requests")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Class 10-B" })).not.toHaveTextContent("Class teacher");
  });

  it("tells a non-teaching staff member the page is for teachers", () => {
    authState.user = { ...authState.user!, role: "staff", staffId: "stf_7" };
    renderUI(<MyClasses />);
    expect(screen.getByText("Only teachers have classes")).toBeInTheDocument();
  });
});
