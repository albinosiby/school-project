import { describe, expect, it } from "vitest";
import { assessmentsFromScheme, classGroups, examTypeError, examTypeId, newExamType, newScheme, newSchemeSubject, schemeError, schemeId, termWeightTotals } from "./assessmentScheme";

const classes = [
  { id: "cls_9A", grade: "9", section: "A" },
  { id: "cls_9B", grade: "9", section: "B" },
  { id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" },
];
const scheme = () => ({
  ...newScheme("9:"),
  subjects: [
    { ...newSchemeSubject("Mathematics"), code: "041", theory: 80, internal: 20, passMarks: 33 },
    { ...newSchemeSubject("Work Education"), mode: "grade" as const, gradeOptions: ["A", "B", "C"] },
  ],
});
const assignments = [{ classId: "cls_9A", subject: "Mathematics", teacherId: "t_math" }];

describe("Assessment scheme", () => {
  it("keys schemes by class group and lists groups lowest grade first", () => {
    expect(schemeId("9:")).toBe("scheme_9");
    expect(schemeId("11:science")).toBe("scheme_11_science");
    expect(classGroups(classes).map((group) => [group.key, group.title, group.classIds])).toEqual([
      ["9:", "Grade 9", ["cls_9A", "cls_9B"]],
      ["11:science", "Grade 11 · Science", ["cls_11_science_A"]],
    ]);
  });
  it("pre-fills a full-pattern exam with the scheme's components and the subject teacher", () => {
    let n = 0;
    const papers = assessmentsFromScheme(scheme(), { pattern: "scheme", singleMax: 80 }, { key: "9:", grade: "9", classIds: ["cls_9A", "cls_9B"] }, assignments, () => "k" + n++);
    expect(papers.map((paper) => paper.key)).toEqual(["k0", "k1"]);
    expect(papers[0]).toMatchObject({ subject: "Mathematics", code: "041", groupKey: "9:", classIds: ["cls_9A", "cls_9B"], theory: 80, internal: 20, practical: 0, passMarks: 33, duration: 3, evaluatorIds: { cls_9A: "t_math", cls_9B: "" } });
    expect(papers[1]).toMatchObject({ subject: "Work Education", mode: "grade", gradeOptions: ["A", "B", "C"] });
  });
  it("turns a single-paper exam type into one theory paper of its maximum, leaving grade-only subjects alone", () => {
    const papers = assessmentsFromScheme(scheme(), { pattern: "single", singleMax: 20 }, { key: "9:", grade: "9", classIds: ["cls_9A"] }, []);
    expect(papers[0]).toMatchObject({ theory: 20, internal: 0, practical: 0, passMarks: 7, theoryPass: 0, duration: 1 });
    expect(papers[1]).toMatchObject({ mode: "grade", gradeOptions: ["A", "B", "C"] });
  });
  it("validates exam types and sums active weights per term", () => {
    const all = [{ ...newExamType(1), id: "ext_pt1", name: "Periodic Test 1", short: "PT1", termId: "t1", weight: 10 }];
    expect(examTypeError({ ...newExamType(2), name: "periodic test 1", short: "X" }, all)).toContain("already");
    expect(examTypeError({ ...newExamType(2), name: "Half-Yearly", short: "HY", weight: 101 }, all)).toContain("Weight");
    expect(examTypeError({ ...newExamType(2), name: "Half-Yearly", short: "HY", weight: 80, pattern: "single", singleMax: 0 }, all)).toContain("maximum marks");
    expect(examTypeError({ ...newExamType(2), name: "Half-Yearly", short: "HY", weight: 80 }, all)).toBe("");
    expect(examTypeId("Half-Yearly Examination")).toBe("ext_half_yearly_examination");
    expect(termWeightTotals([...all, { ...newExamType(2), id: "ext_hy", name: "Half-Yearly", short: "HY", termId: "t1", weight: 80 }, { ...newExamType(3), id: "ext_old", name: "Old", short: "O", termId: "t1", weight: 50, active: false }])).toEqual({ t1: 90 });
  });
  it("rejects duplicate subjects, impossible pass marks and single-grade descriptors", () => {
    const draft = scheme();
    expect(schemeError(draft)).toBe("");
    draft.subjects.push({ ...newSchemeSubject("mathematics") });
    expect(schemeError(draft)).toContain("twice");
    draft.subjects.pop();
    draft.subjects[0].passMarks = 101;
    expect(schemeError(draft)).toContain("pass marks");
    draft.subjects[0].passMarks = 33;
    draft.subjects[1].gradeOptions = ["A"];
    expect(schemeError(draft)).toContain("two distinct");
  });
});

describe("Grade order", () => {
  it("lists LKG and UKG before numbered grades and never sorts 10 before 2", () => {
    const rows = ["10", "1", "UKG", "2", "LKG", "12", "9"].map((grade) => ({ id: "cls_" + grade + "A", grade, section: "A" }));
    expect(classGroups(rows).map((group) => group.grade)).toEqual(["LKG", "UKG", "1", "2", "9", "10", "12"]);
  });
});
