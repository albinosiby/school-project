import { describe, expect, it } from "vitest";
import { GRADES, gradeIdFromLabel, gradeLabel, groupOfGrade, studentGrade } from "./types";

describe("grade labels", () => {
  it("gradeLabel maps ids to labels and passes unknown ids through", () => {
    expect(gradeLabel("Nursery")).toBe("Nursery");
    expect(gradeLabel("1")).toBe("Grade 1");
    expect(gradeLabel("11-Science")).toBe("Grade 11 (Science)");
    expect(gradeLabel("12")).toBe("12");
    expect(gradeLabel("")).toBe("");
  });
  it("gradeIdFromLabel accepts the form's option label or the id itself", () => {
    expect(gradeIdFromLabel("Grade 3")).toBe("3");
    expect(gradeIdFromLabel("Grade 11 (Commerce)")).toBe("11-Commerce");
    expect(gradeIdFromLabel("LKG")).toBe("LKG");
    expect(gradeIdFromLabel("7")).toBe("7");
    expect(gradeIdFromLabel("Class X")).toBe("Class X");
  });
  it("round-trips every grade", () => {
    for (const g of GRADES) expect(gradeIdFromLabel(gradeLabel(g.id))).toBe(g.id);
  });
  it("groupOfGrade falls back to primary", () => {
    expect(groupOfGrade("UKG")).toBe("pre");
    expect(groupOfGrade("9")).toBe("middle");
    expect(groupOfGrade("11-Science")).toBe("senior");
    expect(groupOfGrade("?")).toBe("primary");
  });
  it("studentGrade stores both grade-11 streams as grade 11 (students.grade is a plain string)", () => {
    expect(studentGrade("11-Science")).toBe("11");
    expect(studentGrade("11-Commerce")).toBe("11");
    expect(studentGrade("5")).toBe("5");
    expect(studentGrade("LKG")).toBe("LKG");
  });
});
