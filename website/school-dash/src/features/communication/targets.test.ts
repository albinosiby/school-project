import { describe, expect, it } from "vitest";
import { resolveTargets, suggest, type Roster } from "./targets";

const roster: Roster = {
  classes: [{ id: "cls_8A", grade: 8, section: "A", classTeacherId: "stf_ct", classTeacher: "Mrs. Rao" }, { id: "cls_9B", grade: 9, section: "B" }],
  students: [
    { id: "stu_1", name: "Asha Nair", classId: "cls_8A", status: "Active" }, { id: "stu_2", name: "Ravi K", classId: "cls_8A", status: "Active" },
    { id: "stu_3", name: "Ashwin P", classId: "cls_9B", status: "Active" }, { id: "stu_4", name: "Old Boy", classId: "cls_8A", status: "Transferred" },
  ],
  staff: [{ id: "stf_ct", name: "Meena Rao", designation: "Maths Teacher" }, { id: "stf_m", name: "Ashok Menon", role: "Office Assistant" }, { id: "stf_x", name: "Asha Left", status: "Left" }],
  assignments: [{ classId: "cls_8A", teacherId: "stf_sci" }, { classId: "cls_9B", teacherId: "stf_eng" }],
};

describe("circular targets", () => {
  it("suggests classes by label and people by name, with class / role", () => {
    expect(suggest("8-a", roster).map((t) => [t.type, t.label, t.sub])).toEqual([["class", "Class 8-A", "Class · 2 students · Mrs. Rao"]]);
    expect(suggest("class 9", roster)[0]).toMatchObject({ type: "class", id: "cls_9B" });
    const ash = suggest("ash", roster).map((t) => `${t.type}:${t.label}:${t.sub}`);
    expect(ash).toEqual(["student:Asha Nair:Student · 8-A", "student:Ashwin P:Student · 9-B", "staff:Ashok Menon:Office Assistant"]);
  });

  it("leaves out people already picked and inactive ones", () => {
    const picked = suggest("asha", roster);
    expect(suggest("asha", roster, picked)).toEqual([]);
    expect(suggest("old", roster)).toEqual([]);
  });

  it("a class reaches its active students' parents, the class teacher and its subject teachers", () => {
    const r = resolveTargets([{ type: "class", id: "cls_8A", label: "Class 8-A", sub: "" }, { type: "staff", id: "stf_m", label: "Ashok Menon", sub: "Office Assistant" },
      { type: "student", id: "stu_3", label: "Ashwin P", sub: "Student · 9-B" }], roster);
    expect(r.classIds).toEqual(["cls_8A"]);
    expect(r.studentIds.sort()).toEqual(["stu_1", "stu_2", "stu_3"]);
    expect(r.staffIds.sort()).toEqual(["stf_ct", "stf_m", "stf_sci"]);
    expect(r.count).toBe(6);
    expect(r.summary).toBe("Class 8-A, Ashok Menon, Ashwin P (9-B)");
  });
});
