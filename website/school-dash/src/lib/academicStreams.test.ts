import { describe, expect, it } from "vitest";
import { classIdOf, feeScopesForClasses, studentStream } from "./academicStreams";
import { classIdOfLabel, classesFor, gradeCapacity, sectionRowsFor, sectionsError, type GradeCfg } from "@/features/onboarding/classSetup";

const cfg: GradeCfg[] = [
  { grade: "10", sections: 1, cap: 30 },
  { grade: "11", sections: 3, cap: 30, streams: [{ id: "science", sections: 2, cap: 30 }, { id: "commerce", sections: 1, cap: 25 }] },
  { grade: "12", sections: 1, cap: 30, streams: [{ id: "humanities", sections: 1, cap: 20 }] },
];
const classes = classesFor(cfg);
describe("stream-aware class identity", () => {
  it("restarts letters per stream and keeps Grade 12 independent", () => {
    expect(classes.map((row) => row.id)).toEqual(["cls_10A", "cls_11_science_A", "cls_11_science_B", "cls_11_commerce_A", "cls_12_humanities_A"]);
    expect(gradeCapacity(cfg[1]!)).toBe(85);
    expect(sectionsError(cfg)).toBe("");
    for (const row of sectionRowsFor(cfg)) for (const label of row.sections) expect(classes.some((item) => item.id === classIdOfLabel(label))).toBe(true);
    expect(feeScopesForClasses([...classes, { id: "cls_11C", grade: "11", section: "C" }])).toEqual(["10", "11:science", "11:commerce", "12:humanities"]);
  });
  it("requires streams for older senior setup and validates capacity within each stream", () => {
    expect(sectionsError([{ grade: "11", sections: 2, cap: 30 }])).toContain("Configure at least one stream");
    expect(sectionsError([{ ...cfg[1]!, streams: [{ id: "science", sections: 1, cap: 5 }] }])).toContain("Seat capacity");
    expect(sectionsError([...cfg, { grade: "5", sections: -1, cap: 30 }])).toContain("between 0 and 8");
    expect(classIdOf("11", "a", "commerce")).not.toBe(classIdOf("11", "a", "science"));
  });
  it("resolves student class links without guessing between streams sharing A", () => {
    const student = { grade: "11", section: "A" };
    expect(studentStream(student, classes)).toBe("");
    expect(studentStream(student, classes.filter((row) => row.id === "cls_11_science_A"))).toBe("");
    expect(studentStream({ ...student, classId: "cls_11_commerce_A", streamId: "science" }, classes)).toBe("commerce");
    expect(studentStream({ ...student, classId: "cls_11_science_A" }, [])).toBe("science");
    expect(studentStream({ ...student, classId: "cls_11A" }, [...classes, { id: "cls_11A", grade: "11", section: "A" }])).toBe("");
  });
});
