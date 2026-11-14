import { describe, expect, it } from "vitest";
import { classRowsFor, compareSectionRows, gradeOfLabel, gradeSetupError, groupKeyOf, newSectionRow, sectionDocId, stageGroups } from "./gradeSetup";

describe("Grade setup", () => {
  it("builds section rows and class records the onboarding and exam modules already understand", () => {
    expect(sectionDocId("8")).toBe("sec_grade8");
    expect(sectionDocId("11", "science")).toBe("sec_grade11_science");
    expect(sectionDocId("LKG")).toBe("sec_lkg");
    expect(newSectionRow("8", "", ["A", "B"], { A: 40, B: 30 })).toEqual({ id: "sec_grade8", grade: "Grade 8", stream: "Middle", sections: ["8-A", "8-B"], roster: 0, cap: 70 });
    expect(newSectionRow("11", "science", ["A"], { A: 30 })).toMatchObject({ id: "sec_grade11_science", grade: "Grade 11", stream: "Science", streamId: "science", sections: ["11-Science-A"], cap: 30 });
    expect(classRowsFor("8", "", ["A"], { A: 35 })).toEqual([{ id: "cls_8A", grade: "8", section: "A", capacity: 35, classTeacherId: "", classTeacher: "", room: "", wing: "" }]);
    expect(classRowsFor("11", "commerce", ["B"])[0]).toMatchObject({ id: "cls_11_commerce_B", streamId: "commerce", stream: "Commerce" });
    expect(groupKeyOf({ grade: "Grade 11", streamId: "science" })).toBe("11:science");
    expect(gradeOfLabel("Grade 10")).toBe("10");
  });
  it("orders rows LKG, UKG, 1..12 and streams alphabetically", () => {
    const rows = [{ grade: "Grade 10", stream: "" }, { grade: "Grade 11", stream: "Science" }, { grade: "Grade 2", stream: "" }, { grade: "LKG", stream: "" }, { grade: "Grade 11", stream: "Commerce" }];
    expect([...rows].sort(compareSectionRows).map((row) => row.grade + row.stream)).toEqual(["LKG", "Grade 2", "Grade 10", "Grade 11Commerce", "Grade 11Science"]);
  });
  it("rejects an incomplete or duplicate grade draft", () => {
    const base = { grade: "9", streamId: "", letters: ["A"], caps: { A: 40 }, subjects: [] };
    expect(gradeSetupError({ ...base, grade: "" }, [])).toBe("Choose a grade");
    expect(gradeSetupError({ ...base, grade: "11" }, [])).toContain("stream");
    expect(gradeSetupError({ ...base, letters: [] }, [])).toContain("section");
    expect(gradeSetupError({ ...base, caps: { A: 0 } }, [])).toContain("Capacity of section A");
    expect(gradeSetupError(base, [{ id: "sec_grade9" }])).toContain("already configured");
    expect(gradeSetupError(base, [])).toBe("");
  });
  it("groups rows by stage with every senior stream under Senior Secondary", () => {
    const rows = [
      { grade: "Grade 11", stream: "Science", streamId: "science" }, { grade: "Grade 7", stream: "Middle" }, { grade: "LKG", stream: "Pre-Primary" },
      { grade: "Grade 10", stream: "Secondary" }, { grade: "Grade 12", stream: "Home Science", streamId: "course_home_science" }, { grade: "Grade 3", stream: "Primary" },
    ];
    expect(stageGroups(rows).map((group) => [group.stage, group.rows.map((row) => row.grade + (row.streamId ? ":" + row.streamId : ""))])).toEqual([
      ["Pre-Primary", ["LKG"]], ["Primary", ["Grade 3"]], ["Middle", ["Grade 7"]], ["Secondary", ["Grade 10"]],
      ["Senior Secondary", ["Grade 11:science", "Grade 12:course_home_science"]],
    ]);
  });
});
