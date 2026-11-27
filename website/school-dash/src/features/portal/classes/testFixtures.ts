// Seed data shared by the class pages' component tests (not shipped in any page).
import { authState } from "@/test/render";

/** Anita (stf_1): class teacher of 10-B (teaches Mathematics there), teaches English in 9-A */
export const signInTeacher = (staffId = "stf_1", name = "Anita") => {
  authState.user = { id: `uid_${staffId}`, email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId, staffRole: "teacher", name };
};

const per = (classId: string, day: string, period: number, subject: string, teacherId: string, teacher: string) =>
  ({ id: `per_${classId}_${day}_${period}`, classId, grade: classId.slice(4, -1), section: classId.slice(-1), day, period, subject, teacher, teacherId, room: "" });
const reg = (date: string, classId: string, period: number, total: number, marks: Record<string, string>, teacherId = "stf_1") =>
  ({ id: `${date}_${classId}_${period}`, date, classId, period, total, marks, submitted: true, teacherId, updatedAt: `${date}T0${period}:00:00.000Z` });
export const leave = (id: string, studentId: string, classId: string, extra: Record<string, unknown> = {}) => ({
  id, studentId, classId, roll: 1, from: "2026-11-25", to: "2026-11-26", days: 2, reason: "Family function", type: "Family Event", cat: "leave",
  by: "Mr Mehta (Father)", status: "Pending", parentUid: "uid_parent", appliedOn: "2026-11-20", createdAt: "2026-11-20T05:00:00.000Z", updatedAt: "2026-11-20T05:00:00.000Z", updatedBy: "uid_parent", ...extra,
});

export const base = () => ({
  staff: [{ id: "stf_1", name: "Anita" }, { id: "stf_2", name: "Ravi" }, { id: "stf_3", name: "Meena" }],
  classes: [
    { id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_1", room: "12" }, { id: "cls_9A", grade: "9", section: "A", classTeacherId: "stf_2" },
    { id: "cls_7C", grade: "7", section: "C", classTeacherId: "stf_2" }, { id: "cls_6A", grade: "6", section: "A", classTeacherId: "stf_1", deleted: true },
  ],
  assignments: [{ id: "asg_1", classId: "cls_9A", subject: "English", teacherId: "stf_1" }, { id: "asg_2", classId: "cls_7C", subject: "Hindi", teacherId: "stf_2" }],
  ops_periods: [
    per("cls_10B", "Mon", 1, "Mathematics", "stf_1", "Anita"), per("cls_10B", "Mon", 2, "English", "stf_2", "Ravi"), per("cls_10B", "Mon", 3, "Mathematics", "stf_1", "Anita"),
    per("cls_10B", "Tue", 1, "Science", "stf_3", "Meena"), per("cls_9A", "Mon", 4, "English", "stf_1", "Anita"),
  ],
  students: [
    { id: "stu_1", name: "Aarav Mehta", grn: "GRN-1", classId: "cls_10B", roll: 2, guardian: "Mr Mehta", phone: "9876500001", status: "Active" },
    { id: "stu_2", name: "Bina Rao", grn: "GRN-2", classId: "cls_10B", roll: 1, guardian: "Mrs Rao", phone: "9876500002" },
    { id: "stu_3", name: "Left Student", grn: "GRN-3", classId: "cls_10B", roll: 3, status: "Alumni" },
    { id: "stu_9", name: "Nine A", grn: "GRN-9", classId: "cls_9A", roll: 1 },
  ],
  ops_attendance: [
    reg("2026-11-23", "cls_10B", 1, 2, { stu_1: "A" }), reg("2026-11-23", "cls_10B", 2, 2, { stu_1: "L" }, "stf_2"), reg("2026-11-24", "cls_10B", 1, 2, {}, "stf_3"),
    reg("2026-11-23", "cls_9A", 4, 1, {}),
  ],
  student_leaves: [
    leave("lv_1", "stu_1", "cls_10B", { name: "Aarav Mehta" }), leave("lv_2", "stu_9", "cls_9A", { name: "Nine A" }),
    leave("lv_3", "stu_2", "cls_10B", { name: "Bina Rao", status: "Approved", decidedBy: "stf_1", decidedAt: "2026-11-21T05:00:00.000Z", decisionNote: "Enjoy" }),
  ],
  ops_homework: [
    { id: "hw_1", classId: "cls_9A", title: "Essay", subject: "English", due: "2026-11-30", assigned: "2026-11-20", status: "open", teacherId: "stf_1", submissions: { stu_9: { status: "submitted" } } },
    { id: "hw_2", classId: "cls_10B", title: "Algebra sheet", subject: "Mathematics", due: "2026-11-28", assigned: "2026-11-20", status: "open", maxMarks: 20, teacherId: "stf_1",
      submissions: { stu_1: { status: "graded", marks: 18 }, stu_2: { status: "pending" } } },
    { id: "hw_3", classId: "cls_10B", title: "Lab notes", subject: "Science", due: "2026-11-29", assigned: "2026-11-20", status: "open", teacherId: "stf_3", submissions: { stu_1: { status: "pending" } } },
  ],
  exm_cycles: [{ id: "c_ut1", title: "Unit Test 1", short: "UT1" }, { id: "c_hy", title: "Half Yearly" }],
  exm_papers: [
    { id: "p_m1", cycleId: "c_ut1", subject: "Mathematics", date: "2026-07-10", theory: 50 }, { id: "p_s1", cycleId: "c_ut1", subject: "Science", date: "2026-07-11", theory: 50 },
    { id: "p_m2", cycleId: "c_hy", subject: "Mathematics", date: "2026-09-20", theory: 100 },
  ],
  exm_marks: [
    { id: "p_m1__cand_stu_1", paperId: "p_m1", studentId: "stu_1", classId: "cls_10B", theory: 40, status: "Present" },
    { id: "p_s1__cand_stu_1", paperId: "p_s1", studentId: "stu_1", classId: "cls_10B", theory: 25, status: "Present" },
    { id: "p_m2__cand_stu_1", paperId: "p_m2", studentId: "stu_1", classId: "cls_10B", theory: 30, status: "Present" },
    { id: "p_m1__cand_stu_2", paperId: "p_m1", studentId: "stu_2", classId: "cls_10B", theory: 45, status: "Present" },
  ],
});
