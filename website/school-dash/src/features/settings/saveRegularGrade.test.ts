import { describe, expect, it } from "vitest";
import { failNextWrite, getRow, rowsOf, seed, writes } from "@/test/render";
import type { Seat, Offer } from "@/features/admissions/types";
import { newScheme, newSchemeSubject } from "@/features/exams/assessmentScheme";
import { newSectionRow, type GradeDraft, type SectionRow } from "./gradeSetup";
import { saveRegularGrade, type GradeCapacityData } from "./saveRegularGrade";

const draft = (patch: Partial<GradeDraft> = {}): GradeDraft => ({ grade: "9", streamId: "", letters: ["A"], caps: { A: 40 }, subjects: [], ...patch });
const data = (patch: Partial<GradeCapacityData> = {}): GradeCapacityData => ({ students: [], applications: [], offers: [], seats: [], ...patch });
const existing = (): SectionRow => newSectionRow("9", "", ["A", "B"], { A: 40, B: 40 });
const admissionSeat = (patch: Partial<Seat> = {}): Seat => ({ id: "legacy_seat_9", grade: "9", group: "middle", capacity: 80, rteSeats: 2, block: "Academic", reservationRevision: 3, ...patch });

describe("Regular grade capacity saves", () => {
  it("rejects duplicate section rooms and rooms used by other classes before creating any records", async () => {
    const next = draft({ letters: ["A", "B"], caps: { A: 20, B: 20 }, rooms: { A: "Science Lab", B: " science   lab " } });
    await expect(saveRegularGrade(next, data())).rejects.toThrow("more than one section");
    await expect(saveRegularGrade({ ...next, rooms: { A: "204", B: "205" } }, data({ classes: [{ id: "cls_10A", room: " 204 " }] })))
      .rejects.toThrow("already assigned to another class");
    expect(writes).toHaveLength(0);
  });
  it("refuses section capacities that differ from the declared total without writing", async () => {
    await expect(saveRegularGrade(draft({ totalSeats: 60, caps: { A: 40 } }), data())).rejects.toThrow("add up to 40, not the 60 total seats");
    expect(writes).toHaveLength(0);
  });
  it.each([["LKG", "pre"], ["UKG", "pre"], ["2", "primary"], ["7", "middle"], ["10", "middle"]])("creates %s with admissions capacity matching its sections", async (grade, group) => {
    await saveRegularGrade(draft({ grade, letters: ["A", "B"], caps: { A: 25, B: 20 } }), data());
    expect(rowsOf("set_sections")[0]).toMatchObject({ cap: 45 });
    expect(getRow("classes", `cls_${grade}A`)).toMatchObject({ capacity: 25 });
    expect(getRow("classes", `cls_${grade}B`)).toMatchObject({ capacity: 20 });
    expect(getRow("adm_seats", `adm_seat_${grade.toLowerCase()}`)).toMatchObject({ grade, group, capacity: 45, rteSeats: 0, block: "" });
  });

  it("reuses existing admission and class records without resetting reservation or teacher details", async () => {
    const current = existing(), seat = admissionSeat();
    seed({ set_sections: [current], adm_seats: [seat], classes: [{ id: "cls_9A", grade: "9", section: "A", capacity: 40, classTeacherId: "teacher_1", classTeacher: "Anita", room: "R1", subjects: ["Maths"] }] });
    await saveRegularGrade(draft({ letters: ["A", "B"], caps: { A: 50, B: 30 } }), data({ seats: [seat] }), current);
    expect(rowsOf("adm_seats")).toHaveLength(1);
    expect(getRow("adm_seats", seat.id)).toMatchObject({ ...seat, capacity: 80 });
    expect(getRow("classes", "cls_9A")).toMatchObject({ capacity: 50, classTeacherId: "teacher_1", classTeacher: "Anita", room: "R1", subjects: ["Maths"] });
  });

  it("removes only the empty section's class, assignments and current/legacy weekly periods", async () => {
    const current = existing();
    const assignments = [{ id: "a", classId: "cls_9A" }, { id: "b", classId: "cls_9B" }, { id: "other", classId: "cls_10A" }];
    const periods = [{ id: "pA", classId: "cls_9A" }, { id: "pB", classId: "cls_9B" }, { id: "legacyB", grade: "9", section: "B" }, { id: "other", classId: "cls_10A" }];
    seed({ set_sections: [current], classes: [{ id: "cls_9A" }, { id: "cls_9B" }, { id: "cls_10A" }], assignments, ops_periods: periods,
      students: [{ id: "old", grade: "9", section: "B", status: "Transferred" }], ops_attendance: [{ id: "history", classId: "cls_9B" }], exm_marks: [{ id: "marks", classId: "cls_9B" }] });
    await saveRegularGrade(draft(), data({ assignments, periods }), current);
    expect(getRow("classes", "cls_9B")).toBeUndefined();
    expect(getRow("classes", "cls_10A")).toBeDefined();
    expect(rowsOf("assignments").map((row) => row.id)).toEqual(["a", "other"]);
    expect(rowsOf("ops_periods").map((row) => row.id)).toEqual(["pA", "other"]);
    expect(getRow("adm_seats", "adm_seat_9")).toMatchObject({ capacity: 40 });
    expect(getRow("students", "old")).toBeDefined();
    expect(getRow("ops_attendance", "history")).toBeDefined();
    expect(getRow("exm_marks", "marks")).toBeDefined();
  });

  it("refuses capacity below enrollment, including students without a classId", async () => {
    const students = [1, 2].map((id) => ({ id: String(id), name: "Student", grade: "9", section: "A", status: "Active" }));
    await expect(saveRegularGrade(draft({ caps: { A: 1 } }), data({ students }))).rejects.toThrow("section A cannot be below its 2 enrolled students");
    expect(writes).toHaveLength(0);
  });

  it("refuses removing an occupied section and ignores transferred/deleted students for capacity", async () => {
    const current = existing();
    seed({ set_sections: [current] });
    const students = [{ id: "s", name: "Student", grade: "9", section: "B" }];
    await expect(saveRegularGrade(draft(), data({ students }), current)).rejects.toThrow("Move them before removing");
    expect(writes).toHaveLength(0);
    await saveRegularGrade(draft({ caps: { A: 1 } }), data({ students: [{ ...students[0]!, status: "Transferred" }, { ...students[0]!, id: "deleted", deleted: true }] }), current);
    expect(getRow("adm_seats", "adm_seat_9")).toMatchObject({ capacity: 1 });
  });

  it.each(["pending", "accepted"] as const)("counts %s offers even when the admissions capacity row is missing", async (status) => {
    const students = [{ id: "s", name: "Student", grade: "9", section: "A" }];
    const offers = [{ id: "offer", grade: "9", status, applicationId: "a" } as Offer];
    await expect(saveRegularGrade(draft({ caps: { A: 1 } }), data({ students, offers }))).rejects.toThrow("2 occupied or reserved seats");
    expect(writes).toHaveLength(0);
  });

  it("preserves RTE reservations and rejects a grade total below them", async () => {
    const current = existing(), seat = admissionSeat({ rteSeats: 45 });
    seed({ set_sections: [current], adm_seats: [seat] });
    await expect(saveRegularGrade(draft(), data({ seats: [seat] }), current)).rejects.toThrow("45 occupied or reserved seats");
    expect(writes).toHaveLength(0);
  });

  it("rejects a stale admissions revision without saving any grade changes", async () => {
    const current = existing(), seat = admissionSeat();
    seed({ set_sections: [current], adm_seats: [{ ...seat, reservationRevision: 4 }] });
    await expect(saveRegularGrade(draft(), data({ seats: [seat] }), current)).rejects.toThrow("Seat availability changed");
    expect(writes).toHaveLength(0);
  });

  it("rejects an editor opened before another section change", async () => {
    const current = existing();
    seed({ set_sections: [{ ...current, sections: ["9-A", "9-B", "9-C"] }] });
    await expect(saveRegularGrade(draft(), data(), current)).rejects.toThrow("grade changed in another window");
    expect(writes).toHaveLength(0);
  });

  it("checks server-maintained class enrollment before deleting a section", async () => {
    const current = existing();
    seed({ set_sections: [current], classes: [{ id: "cls_9B", studentCount: 1 }] });
    await expect(saveRegularGrade(draft(), data(), current)).rejects.toThrow("still has students");
    expect(writes).toHaveLength(0);
  });

  it("does not delete an assignment that has since moved to another class", async () => {
    const current = existing();
    seed({ set_sections: [current], assignments: [{ id: "a", classId: "cls_10A" }] });
    await expect(saveRegularGrade(draft(), data({ assignments: [{ id: "a", classId: "cls_9B" }] }), current)).rejects.toThrow("assignment or timetable changed");
    expect(writes).toHaveLength(0);
  });

  it("leaves sections, classes, timetable and admissions unchanged on a failed save", async () => {
    const current = existing(), seat = admissionSeat();
    const assignments = [{ id: "a", classId: "cls_9B" }];
    seed({ set_sections: [current], adm_seats: [seat], classes: [{ id: "cls_9A", capacity: 40 }, { id: "cls_9B", capacity: 40 }], assignments });
    failNextWrite(new Error("permission-denied"));
    await expect(saveRegularGrade(draft(), data({ seats: [seat], assignments }), current)).rejects.toThrow("permission-denied");
    expect(writes).toHaveLength(0);
    expect(getRow("set_sections", current.id)).toEqual(current);
    expect(getRow("adm_seats", seat.id)).toEqual(seat);
    expect(getRow("classes", "cls_9B")).toBeDefined();
    expect(getRow("assignments", "a")).toBeDefined();
  });

  it("preserves existing marks splits when creating a grade and adding subjects", async () => {
    const scheme = { ...newScheme("9:"), subjects: [{ ...newSchemeSubject("Maths"), theory: 50, internal: 50 }] };
    seed({ set_subject_schemes: [scheme] });
    await saveRegularGrade(draft({ subjects: ["Maths", "English"] }), data());
    expect(getRow("set_subject_schemes", "scheme_9")).toMatchObject({ subjects: [expect.objectContaining({ subject: "Maths", theory: 50, internal: 50 }), expect.objectContaining({ subject: "English" })] });
  });
});
