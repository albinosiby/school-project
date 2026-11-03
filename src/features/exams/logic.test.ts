import { describe, expect, it } from "vitest";
import {
  candidateChanges, candidatesFor, classIdOf, classLabel, cycleErrors, labelToClassId, markError, markValue, paperCoversClass, paperEnd, publishBlocker,
  rollLabel, rosterOf, slotClashes, staffClashes, studentIdOf, subjectCovers, subjectTeacherId, timesOverlap, withLabel, withoutLabel, type CycleFields, type CycleSlot, type Slot,
} from "./logic";
import { cbseGrade, evaluate, type Eval } from "./types";

describe("grades and totals", () => {
  it("maps percentages to CBSE bands at the edges", () => {
    expect([100, 91, 90.99, 81, 71, 61, 51, 41, 33, 32.99, 0].map(cbseGrade)).toEqual(["A1", "A1", "A2", "A2", "B1", "B2", "C1", "C2", "D", "E", "E"]);
  });
  it("totals theory + internal and grades the percentage", () => {
    expect(evaluate({ theory: 74, internal: 18, medical: false, verified: false }, 80, 20)).toEqual({ state: "passed", total: 92, pct: 92, grade: "A1" });
    expect(evaluate({ theory: 20, internal: 5, medical: false, verified: false }, 80, 20)).toMatchObject({ state: "failed", total: 25, grade: "E" });
    expect(evaluate({ theory: 20, internal: 5, medical: false, verified: true }, 80, 20).state).toBe("verified");
    expect(evaluate({ theory: 0, internal: 0, medical: false, verified: false }, 80, 20)).toMatchObject({ state: "failed", total: 0, pct: 0 });
    expect(evaluate({ theory: 80, internal: 20, medical: false, verified: false }, 80, 20)).toMatchObject({ total: 100, pct: 100, grade: "A1" });
  });
  it("flags marks outside 0..max as invalid", () => {
    expect(evaluate({ theory: 81, internal: 10, medical: false, verified: false }, 80, 20)).toEqual({ state: "invalid", total: 91, pct: null, grade: "ERR" });
    expect(evaluate({ theory: 50, internal: 21, medical: false, verified: false }, 80, 20).state).toBe("invalid");
    expect(evaluate({ theory: -1, internal: null, medical: false, verified: false }, 80, 20).state).toBe("invalid");
  });
  it("is pending until both parts are in", () => {
    expect(evaluate(undefined, 80, 20).state).toBe("pending");
    expect(evaluate({ theory: 60, internal: null, medical: false, verified: false }, 80, 20).state).toBe("pending");
    expect(evaluate({ theory: null, internal: 18, medical: false, verified: false }, 80, 20).state).toBe("pending");
  });
  it("handles medical and absent (admin flag or the teacher app's status)", () => {
    expect(evaluate({ theory: null, internal: 16, medical: true, verified: false }, 80, 20).state).toBe("medical");
    expect(evaluate({ theory: null, internal: null, medical: false, verified: false, status: "Medical Slip" }, 80, 20).state).toBe("medical");
    expect(evaluate({ theory: null, internal: null, medical: false, verified: false, status: "Absent" }, 80, 20)).toEqual({ state: "absent", total: null, pct: null, grade: "AB" });
    expect(evaluate({ theory: null, internal: 10, medical: false, verified: false, status: "Disqualified" }, 80, 20).grade).toBe("DQ");
    // a theory mark wins over a stale flag
    expect(evaluate({ theory: 60, internal: 15, medical: true, verified: false, status: "Absent" }, 80, 20).state).toBe("passed");
    // non-numbers stored by mistake count as no mark
    expect(evaluate({ theory: "70" as unknown as number, internal: 10, medical: false, verified: false }, 80, 20).state).toBe("pending");
  });
});

describe("marks entry", () => {
  it("accepts blank or whole numbers 0..max", () => {
    expect(markError("", 80, "Theory")).toBe("");
    expect(markError(" 0 ", 80, "Theory")).toBe("");
    expect(markError("80", 80, "Theory")).toBe("");
    expect(markError("81", 80, "Theory")).toBe("Theory marks must be between 0 and 80");
    expect(markError("21", 20, "Internal")).toBe("Internal marks must be between 0 and 20");
    expect(markError("abc", 80, "Theory")).toBe("Theory marks must be a whole number");
    expect(markError("7.5", 80, "Theory")).toBe("Theory marks must be a whole number");
    expect(markError("-3", 80, "Theory")).toBe("Theory marks must be a whole number");
    expect(markValue("")).toBeNull();
    expect(markValue(" 42 ")).toBe(42);
  });
  it("finds the subject teacher of a class", () => {
    const a = [{ classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025" }, { classId: "cls_9A", subject: "Physics", teacherId: "stf_003" }];
    expect(subjectTeacherId(a, "Mathematics", "cls_10B")).toBe("stf_025");
    expect(subjectTeacherId(a, "Science", "cls_9A")).toBe("stf_003");
    expect(subjectTeacherId(a, "Mathematics", "cls_9A")).toBe("");
    expect(subjectCovers("Social Science", "Physics")).toBe(false);
    expect(subjectCovers("Computer Science", "Physics")).toBe(false);
    expect(subjectCovers("", "Maths")).toBe(false);
  });
});

describe("candidates", () => {
  const students = [
    { id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", roll: 1 },
    { id: "stu_102", name: "Ananya Reddy", grn: "GIS-9201", grade: "10", section: "B", roll: 2 },
    { id: "stu_103", name: "Zoya Khan", grn: "GIS-9202", grade: "10", section: "b" },
    { id: "stu_104", name: "Bilal Ali", grn: "GIS-9203", grade: "10", section: "B", roll: "x" },
    { id: "stu_201", name: "Kabir Nair", grn: "GIS-8100", grade: "8", section: "A", roll: 1 },
    { id: "stu_301", name: "Left School", grn: "GIS-1", grade: "8", section: "A", roll: 2, status: "Alumni" },
    { id: "stu_302", name: "Deleted", grn: "GIS-2", grade: "8", section: "A", roll: 3, deleted: true },
    { id: "stu_303", name: "No Section", grn: "GIS-3", grade: "8", section: "" },
  ];
  it("makes one cand_{studentId} per active student of the rostered classes", () => {
    const c = candidatesFor(students);
    expect(c.map((x) => x.id)).toEqual(["cand_stu_201", "cand_stu_101", "cand_stu_102", "cand_stu_104", "cand_stu_103"]);
    expect(c[0]).toEqual({ id: "cand_stu_201", studentId: "stu_201", name: "Kabir Nair", roll: "#8A-01", grn: "GIS-8100", cls: "8-A", grade: "8", section: "A" });
    // students without an integer roll get the next numbers of their class, in name order
    expect(c.filter((x) => x.cls === "10-B").map((x) => x.roll)).toEqual(["#10B-01", "#10B-02", "#10B-03", "#10B-04"]);
    expect(c.find((x) => x.studentId === "stu_103")?.section).toBe("B");
  });
  it("limits to the cycle's grades", () => {
    expect(candidatesFor(students, ["8"]).map((x) => x.id)).toEqual(["cand_stu_201"]);
    expect(candidatesFor(students, [])).toEqual([]);
  });
  it("writes only missing or changed candidates", () => {
    const want = candidatesFor(students, ["10"]);
    const existing = [want[0], { ...want[1], name: "Old Name" }];
    expect(candidateChanges(existing, want).map((c) => c.id)).toEqual([want[1].id, want[2].id, want[3].id]);
    expect(candidateChanges(want, want)).toEqual([]);
  });
  it("adds generated candidates for students without a row", () => {
    const persisted = [{ id: "cand_stu_101", studentId: "stu_101", name: "Aarav Sharma", roll: "#10B-01", grn: "GIS-9200", cls: "10-B", grade: "10", section: "B" }];
    const r = rosterOf(persisted, students.slice(0, 2));
    expect(r.map((c) => c.id)).toEqual(["cand_stu_101", "cand_stu_102"]);
    expect(r[0]).toBe(persisted[0]);
  });
  it("labels and ids", () => {
    expect(classLabel("10", "B")).toBe("10-B");
    expect(classIdOf("10", "b")).toBe("cls_10B");
    expect(labelToClassId("10-B")).toBe("cls_10B");
    expect(rollLabel("8", "A", 7)).toBe("#8A-07");
    expect(rollLabel("8", "A", 112)).toBe("#8A-112");
    expect(studentIdOf({ id: "cand_stu_7" })).toBe("stu_7");
    expect(studentIdOf({ id: "legacy", studentId: "stu_9" })).toBe("stu_9");
    expect(paperCoversClass({ grade: "10", classIds: ["cls_10A"] }, "10-B")).toBe(false);
    expect(paperCoversClass({ grade: "10", classIds: [] }, "10-B")).toBe(true);
    expect(paperCoversClass({ grade: "10" }, "1-0")).toBe(false);
  });
});

describe("publish", () => {
  const e = (state: Eval["state"]): Eval => ({ state, total: null, pct: null, grade: "" });
  it("blocks on no candidates, invalid or missing marks", () => {
    expect(publishBlocker([])).toBe("No candidates in this class");
    expect(publishBlocker([e("passed"), e("invalid")])).toBe("Resolve 1 invalid mark entry first");
    expect(publishBlocker([e("invalid"), e("invalid"), e("pending")])).toBe("Resolve 2 invalid mark entries first");
    expect(publishBlocker([e("passed"), e("pending")])).toBe("1 candidate still has no marks");
    expect(publishBlocker([e("pending"), e("pending")])).toBe("2 candidates still have no marks");
    expect(publishBlocker([e("passed"), e("failed"), e("verified"), e("medical"), e("absent")])).toBe("");
  });
  it("adds and removes class labels without duplicates", () => {
    expect(withLabel(undefined, "10-B")).toEqual(["10-B"]);
    expect(withLabel(["10-A", "10-B"], "10-B")).toEqual(["10-A", "10-B"]);
    expect(withoutLabel(["10-A", "10-B"], "10-B")).toEqual(["10-A"]);
    expect(withoutLabel(undefined, "10-B")).toEqual([]);
  });
});

describe("clashes", () => {
  it("overlaps half-open time ranges", () => {
    expect(timesOverlap("09:00", "11:30", "11:00", "12:00")).toBe(true);
    expect(timesOverlap("09:00", "11:30", "11:30", "12:00")).toBe(false);
    expect(timesOverlap("10:00", "10:30", "09:00", "12:00")).toBe(true);
    expect(paperEnd({ start: "09:00", duration: 2.5 })).toBe("11:30");
    expect(paperEnd({ start: "23:00", duration: 2 })).toBe("01:00");
  });
  it("finds a staff member's overlapping duties on the same date (other papers only)", () => {
    const slots: Slot[] = [
      { key: "chief_p1", staffId: "stf_1", paperId: "p1", date: "2026-11-18", start: "09:00", end: "11:30", label: "Grade 8 Maths" },
      { key: "d2", staffId: "stf_1", paperId: "p2", date: "2026-11-18", start: "13:00", end: "15:00", label: "Grade 9 Science" },
      { key: "d3", staffId: "stf_2", paperId: "p3", date: "2026-11-18", start: "09:00", end: "11:30", label: "Grade 10 Maths" },
      { key: "d4", staffId: "stf_1", paperId: "p4", date: "2026-11-19", start: "09:00", end: "11:30", label: "Grade 8 Hindi" },
    ];
    const target = { id: "p9", date: "2026-11-18", start: "10:00", end: "12:00" };
    expect(staffClashes(slots, "stf_1", target).map((s) => s.key)).toEqual(["chief_p1"]);
    expect(staffClashes(slots, "stf_1", target, "chief_p1")).toEqual([]);
    expect(staffClashes(slots, "stf_1", { ...target, id: "p1" })).toEqual([]); // the same paper is not a clash
    expect(staffClashes(slots, "stf_1", { ...target, date: "" })).toEqual([]); // no date yet
    expect(staffClashes(slots, "stf_2", { ...target, start: "11:30", end: "13:00" })).toEqual([]);
  });
});

describe("cycle validation", () => {
  const f: CycleFields = { title: "Term 2 Pre-Board", term: "Term 2 (Spring) · AY 2026-27", start: "2026-11-15", end: "2026-12-02", declaration: "2026-12-18", grades: ["8", "10"], theoryMax: 80, internalMax: 20, internalParts: [5, 5, 5, 5] };
  const slot = (p: Partial<CycleSlot> = {}): CycleSlot => ({ key: "k1", subject: "Mathematics", code: "MATH-041", grade: "8", date: "2026-11-18", start: "09:00", duration: 2.5, venue: "Hall 1", invigilator: "Mrs. Sunita Verma", invigilatorId: "stf_1", ...p });
  it("passes a complete cycle", () => expect(cycleErrors(f, [slot()])).toEqual({}));
  it("checks required fields and date order", () => {
    expect(cycleErrors({ ...f, title: " ", start: "", end: "", declaration: "", grades: [] }, [slot()])).toMatchObject({ title: "Title is required", start: "Required", end: "Required", declaration: "Required", grades: "Select at least one grade" });
    expect(cycleErrors({ ...f, end: "2026-11-10" }, [slot()]).end).toBe("End must be after start");
    expect(cycleErrors({ ...f, declaration: "2026-12-01" }, [slot()]).declaration).toBe("Must be on/after end date");
    expect(cycleErrors({ ...f, end: "2026-11-15", declaration: "2026-11-15" }, [slot({ date: "2026-11-15" })])).toEqual({});
  });
  it("checks the weightage", () => {
    expect(cycleErrors({ ...f, theoryMax: 70 }, [slot()]).weight).toBe("Theory + Internal must total 100");
    expect(cycleErrors({ ...f, theoryMax: 0, internalMax: 100, internalParts: [100, 0, 0, 0] }, [slot()]).weight).toBe("Theory max marks must be above 0");
    expect(cycleErrors({ ...f, theoryMax: -10, internalMax: 110 }, [slot()]).weight).toBe("Marks cannot be negative");
    expect(cycleErrors({ ...f, theoryMax: 79.5 }, [slot()]).weight).toBe("Max marks must be whole numbers");
    expect(cycleErrors({ ...f, internalParts: [5, 5, 5, 4] }, [slot()]).parts).toBe("Internal components total 19, expected 20");
    expect(cycleErrors({ ...f, internalParts: [25, -5, 0, 0] }, [slot()]).parts).toBe("Internal components cannot be negative");
  });
  it("checks paper slots", () => {
    expect(cycleErrors(f, []).slots).toBe("Add at least one subject paper slot");
    expect(cycleErrors(f, [slot({ invigilator: "" })]).slots).toBe("Complete all paper slot fields");
    expect(cycleErrors(f, [slot({ duration: 0 })]).slots).toBe("Paper duration must be between 0.5 and 6 hours");
    expect(cycleErrors(f, [slot({ duration: 7 })]).slots).toBe("Paper duration must be between 0.5 and 6 hours");
    expect(cycleErrors(f, [slot({ start: "22:30", duration: 2 })]).slots).toBe("A paper must end before midnight");
    expect(cycleErrors(f, [slot({ date: "2026-12-03" })]).slots).toBe("Paper dates must fall within the cycle window");
    expect(cycleErrors(f, [slot({ grade: "9" })]).slots).toBe("A paper slot targets a grade that is not selected");
    expect(cycleErrors(f, [slot(), slot({ key: "k2", date: "2026-11-19", venue: "Hall 2", invigilator: "B", invigilatorId: "stf_2" })]).slots).toBe("Each grade can have a paper code only once");
  });
  it("finds clashes by grade, venue or invigilator in overlapping time", () => {
    const a = slot();
    const sameGradeLater = slot({ key: "k2", code: "SCI-086", start: "10:00", venue: "Hall 2", invigilator: "B", invigilatorId: "stf_2" });
    expect(slotClashes([a, sameGradeLater]).length).toBe(2);
    expect(cycleErrors(f, [a, sameGradeLater]).slots).toBe("Resolve schedule clashes before saving");
    const otherGradeSameHall = slot({ key: "k3", grade: "10", start: "09:30", venue: " hall 1 ", invigilator: "B", invigilatorId: "stf_2" });
    expect(slotClashes([a, otherGradeSameHall]).length).toBe(2);
    const sameInvigilator = slot({ key: "k4", grade: "10", venue: "Hall 9" });
    expect(slotClashes([a, sameInvigilator]).length).toBe(2);
    const afterwards = slot({ key: "k5", code: "SCI-086", start: "11:30" });
    expect(slotClashes([a, afterwards])).toEqual([]);
    const otherDay = slot({ key: "k6", code: "SCI-086", date: "2026-11-19" });
    expect(slotClashes([a, otherDay])).toEqual([]);
  });
});
