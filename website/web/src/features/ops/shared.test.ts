import { afterEach, describe, expect, it, vi } from "vitest";
import { activeStudent, classIdOf, clsLabel, dayOfIso, nextId, studentClassId, teachingStaff, todayIso } from "./shared";

describe("nextId", () => {
  it("starts at 001 when there are no ids", () => expect(nextId("asg", [])).toBe("asg_001"));
  it("continues after the highest numeric suffix, not the count", () => expect(nextId("asg", ["asg_003", "asg_001", "asg_010"])).toBe("asg_011"));
  it("ignores ids of other prefixes and shapes", () => expect(nextId("asg", ["stf_099", "asg_x", "asg_12a", "xasg_050", "asg_002"])).toBe("asg_003"));
  it("reads unpadded fixture ids (sub_1..3)", () => expect(nextId("sub", ["sub_1", "sub_3"])).toBe("sub_004"));
  it("grows past 999 without truncating", () => expect(nextId("stu", ["stu_999"])).toBe("stu_1000"));
  it("treats regex characters in the prefix literally", () => {
    expect(nextId("a.b", ["axb_005"])).toBe("a.b_001");
    expect(nextId("a.b", ["a.b_005"])).toBe("a.b_006");
  });
});

describe("classIdOf / clsLabel / studentClassId", () => {
  it("builds the contract id cls_{grade}{SECTION}", () => {
    expect(classIdOf("10", "B")).toBe("cls_10B");
    expect(classIdOf("8", "a")).toBe("cls_8A");
    expect(classIdOf(" 9 ", " c ")).toBe("cls_9C");
  });
  it("labels class ids for display", () => {
    expect(clsLabel("cls_10B")).toBe("Grade 10-B");
    expect(clsLabel("other")).toBe("other");
  });
  it("prefers a student's classId, else grade + section", () => {
    expect(studentClassId({ classId: "cls_9A", grade: "10", section: "B" })).toBe("cls_9A");
    expect(studentClassId({ grade: "10", section: "B" })).toBe("cls_10B");
    expect(studentClassId({ classId: "", grade: "7", section: "D" })).toBe("cls_7D");
  });
});

describe("activeStudent", () => {
  it("counts Active (any case) and status-less students", () => {
    expect(activeStudent({ status: "Active" })).toBe(true);
    expect(activeStudent({ status: "active" })).toBe(true);
    expect(activeStudent({})).toBe(true);
  });
  it("drops soft-deleted, inactive and missing rows", () => {
    expect(activeStudent({ status: "Active", deleted: true })).toBe(false);
    expect(activeStudent({ status: "Alumni" })).toBe(false);
    expect(activeStudent({ status: "Transferred" })).toBe(false);
    expect(activeStudent(null)).toBe(false);
  });
});

describe("dates and staff", () => {
  afterEach(() => vi.useRealTimers());
  it("names the weekday of an ISO date", () => {
    expect(dayOfIso("2026-11-02")).toBe("Mon");
    expect(dayOfIso("2026-11-07")).toBe("Sat");
    expect(dayOfIso("2026-11-08")).toBe("Sun");
    expect(dayOfIso("not a date")).toBe("");
  });
  it("todayIso is the local calendar day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 10, 3, 23, 30));
    expect(todayIso()).toBe("2026-11-03");
  });
  it("teachingStaff drops Administration and sorts by name", () => {
    const s = teachingStaff([{ id: "1", name: "Zara", department: "Science" }, { id: "2", name: "Office", department: "Administration" }, { id: "3", name: "Anil", department: "Maths" }]);
    expect(s.map((x) => x.id)).toEqual(["3", "1"]);
  });
});
