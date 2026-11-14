import { describe, expect, it } from "vitest";
import { initialSetup, newAssessment, setupErrors } from "./examSetup";
import { publicationDate } from "./publicationTime";
const classes = [
  { id: "cls_11_course_home_science_A", grade: "11", section: "A", streamId: "course_home_science" },
  { id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" },
];
function setup() {
  return { ...initialSetup(undefined, [], classes, "2026–27"), title: "Term 1", start: "2026-12-01", end: "2026-12-10", classIds: classes.map((row) => row.id), assessments: classes.map((row, index) => ({ ...newAssessment(String(index), "11", [row.id], "English"), date: "2026-12-02" })) };
}
describe("Exam configuration conflicts", () => {
  it("allows separate courses to sit simultaneous papers and blocks shared rooms and invigilators", () => {
    const config = setup();
    expect(setupErrors(config, classes)).toEqual({});
    config.assessments[0].venue = "Hall 1";
    config.assessments[1].venue = "hall 1";
    expect(Object.values(setupErrors(config, classes)).join(" ")).toContain("timetable conflict");
    config.assessments[1].venue = "Hall 2";
    config.assessments.forEach((paper) => { paper.invigilatorId = "t1"; });
    expect(Object.values(setupErrors(config, classes)).join(" ")).toContain("timetable conflict");
  });
  it("blocks duplicate subjects for a division and impossible component pass marks", () => {
    const config = setup();
    config.assessments.push({ ...config.assessments[0], key: "duplicate", date: "2026-12-03" });
    expect(Object.values(setupErrors(config, classes)).join(" ")).toContain("already configured");
    config.assessments.pop();
    config.rules.passCriteria = "components";
    config.assessments[0].theoryPass = 81;
    expect(Object.values(setupErrors(config, classes)).join(" ")).toContain("component pass marks");
  });
  it("resolves publication time in the school timezone and rejects nonexistent DST times", () => {
    expect(publicationDate("2026-11-20T09:00", "Asia/Kolkata").toISOString()).toBe("2026-11-20T03:30:00.000Z");
    expect(Number.isNaN(+publicationDate("2026-03-08T02:30", "America/New_York"))).toBe(true);
  });
});
