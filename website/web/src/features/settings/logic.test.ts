import { describe, expect, it } from "vitest";
import { bandsError, schoolPatch, termDays, termError } from "./logic";

const t1 = { id: "term_1", name: "Term 1", start: "2026-04-01", end: "2026-09-30", status: "Closed" };
const t2 = { id: "term_2", name: "Term 2", start: "2026-10-01", end: "2027-03-31", status: "In Progress" };

describe("termDays", () => {
  it("counts calendar days inclusive", () => {
    expect(termDays("2026-04-01", "2026-04-01")).toBe(1);
    expect(termDays("2026-04-01", "2026-09-30")).toBe(183);
    expect(termDays("2026-10-01", "2026-09-30")).toBe(0);
    expect(termDays("", "2026-09-30")).toBe(0);
  });
});

describe("termError", () => {
  const all = [t1, t2];
  it("accepts a valid new term after the others", () => {
    expect(termError({ id: "", name: "Term 3", start: "2027-04-01", end: "2027-06-30", status: "Scheduled" }, all)).toBe("");
  });
  it("lets a term be saved unchanged", () => { expect(termError(t2, all)).toBe(""); });
  it("requires a name and an end after the start", () => {
    expect(termError({ ...t2, id: "", name: " " }, all)).toBe("Term name is required");
    expect(termError({ ...t2, id: "", name: "T", end: t2.start }, all)).toBe("Pick a start and an end date after it");
    expect(termError({ ...t2, id: "", name: "T", start: "" }, all)).toBe("Pick a start and an end date after it");
  });
  it("refuses duplicate names, overlapping dates and a second In Progress term", () => {
    expect(termError({ id: "", name: "term 1", start: "2027-04-01", end: "2027-06-30", status: "Scheduled" }, all)).toBe("Another term already has this name");
    expect(termError({ id: "", name: "Summer", start: "2027-03-01", end: "2027-04-30", status: "Scheduled" }, all)).toBe("Dates overlap Term 2");
    expect(termError({ id: "", name: "Term 3", start: "2027-04-01", end: "2027-06-30", status: "In Progress" }, all)).toBe("Only one term can be In Progress. Close the current term first");
  });
});

describe("bandsError", () => {
  const bands = [{ id: "a", grade: "A1", min: 91, point: 10 }, { id: "b", grade: "A2", min: 81, point: 9 }, { id: "e", grade: "E", min: 0, point: 0 }];
  it("accepts strictly descending minimums", () => { expect(bandsError(bands)).toBe(""); });
  it("refuses out-of-range or fractional values", () => {
    expect(bandsError([{ ...bands[0]!, min: 101 }])).toBe("Minimum percentages must be whole numbers from 0 to 100");
    expect(bandsError([{ ...bands[0]!, min: 90.5 }])).toBe("Minimum percentages must be whole numbers from 0 to 100");
  });
  it("refuses a lower grade with an equal or higher minimum", () => {
    expect(bandsError([bands[0]!, { ...bands[1]!, min: 91 }, bands[2]!])).toBe("A1 must need a higher percentage than A2");
  });
});

describe("schoolPatch", () => {
  it("returns only changed, non-empty fields", () => {
    expect(schoolPatch({ name: "Greenfield", affiliation: "#1" }, { name: " Greenfield ", affiliation: "#2" })).toEqual({ affiliation: "#2" });
    expect(schoolPatch({ name: "Greenfield" }, { name: "", term: "Term 2" })).toEqual({ term: "Term 2" });
    expect(schoolPatch({ name: "Greenfield" }, { name: "Greenfield" })).toBeNull();
    expect(schoolPatch(undefined, { name: "New School" })).toEqual({ name: "New School" });
  });
});
