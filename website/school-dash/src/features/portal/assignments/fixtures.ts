// Seed data shared by the assignments component tests (Mon 23 Nov 2026).
import { authState } from "@/test/render";

export const teacher = () => { authState.user = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher", staffId: "stf_1", staffRole: "teacher", name: "Anita" }; };

const students = [
  { id: "stu_1", name: "Aarav Mehta", grn: "GRN-1", classId: "cls_10B", roll: 1, status: "Active" },
  { id: "stu_2", name: "Bina Rao", grn: "GRN-2", classId: "cls_10B", roll: 2 },
  { id: "stu_3", name: "Chen Li", grn: "GRN-3", classId: "cls_10B", roll: 3 },
  { id: "stu_4", name: "Left Student", grn: "GRN-4", classId: "cls_10B", roll: 4, status: "Alumni" },
  { id: "stu_9", name: "Dev Nair", grn: "GRN-9", classId: "cls_9A", roll: 1 },
];
export const handin = { files: [{ name: "page1.jpg", url: "https://files.test/hw/a/stu_1/page1.jpg", path: "schools/sch_test/homework/a/stu_1/page1.jpg", type: "image/jpeg", size: 2048 }], note: "Done in class notebook", submittedAt: "2026-11-23T05:00:00.000Z", uid: "par_1", late: false };
export const hw = (id: string, extra: Record<string, unknown> = {}) => ({
  id, classId: "cls_10B", grade: "10", section: "B", title: `Homework ${id}`, subject: "Mathematics", due: "2026-11-23", maxMarks: 20, description: "Ex 4.1", status: "open",
  createdAt: "2026-11-20T08:00:00.000Z", assigned: "2026-11-20", teacher: "Anita", teacherId: "stf_1", allowLate: true, attachments: [],
  submissions: { stu_1: { status: "pending", feedback: "" }, stu_2: { status: "submitted", feedback: "" }, stu_3: { status: "graded", feedback: "Good", marks: 18, gradedAt: "2026-11-22T08:00:00.000Z" } },
  submitted: 2, total: 3, updatedAt: "2026-11-20T08:00:00.000Z", updatedBy: "uid_t", ...extra,
});

export const base = {
  staff: [{ id: "stf_1", name: "Anita" }], classes: [{ id: "cls_10B", grade: "10", section: "B" }, { id: "cls_9A", grade: "9", section: "A" }], students,
  assignments: [{ id: "asg_1", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_1" }, { id: "asg_2", classId: "cls_9A", subject: "Science", teacherId: "stf_1" }],
  ops_periods: [{ id: "per_10B_Mon_1", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 1, subject: "Physics", teacher: "Anita", teacherId: "stf_1", room: "" }],
  ops_homework: [
    // due today, one parent upload, one on paper, one graded; a worksheet attached
    hw("a", { handins: { stu_1: handin }, attachments: [{ name: "worksheet.pdf", size: "", kind: "file", url: "https://files.test/m/worksheet.pdf", path: "schools/sch_test/homework-materials/uid_t/mat_1", contentType: "application/pdf", bytes: 4096 }] }),
    // overdue, one late upload
    hw("b", { due: "2026-11-20", submissions: { stu_1: { status: "graded", feedback: "", marks: 15 }, stu_2: { status: "pending", feedback: "" }, stu_3: { status: "pending", feedback: "" } },
      handins: { stu_2: { ...handin, late: true } } }),
    hw("c", { classId: "cls_9A", grade: "9", section: "A", subject: "Science", status: "scheduled", publishAt: "2026-11-25T02:30:00.000Z", due: "2026-11-28", submissions: { stu_9: { status: "pending", feedback: "" } } }),
    hw("d", { status: "closed", due: "2026-11-10", maxMarks: 0 }),
    // admin-created ("Published", no submissions yet), due later
    hw("e", { status: "Published", due: "2026-12-15", submissions: {} }),
    hw("gone", { deleted: true }), hw("other", { teacherId: "stf_2" }),
  ],
};
