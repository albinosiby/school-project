import { expect, it } from "vitest";
import { departmentChoices } from "./departmentChoices";

const departments = [
  { id: "old_science", name: "Science" },
  { id: "home", name: "HomoScience" },
  { id: "old_computing", name: "Computer Science" },
  { id: "science", name: "Science" },
  { id: "course_computer_science", name: "  computer   science  " },
  { id: "science", name: "science" },
];

it("combines repeated names and identifiers and selects current setup identifiers for new staff", () => {
  expect(departmentChoices(departments)).toEqual([
    { label: "Science", value: "science" },
    { label: "HomoScience", value: "home" },
    { label: "Computer Science", value: "course_computer_science" },
  ]);
});

it("preserves a selected legacy identifier while still showing the department once", () => {
  expect(departmentChoices(departments, "old_science")).toEqual([
    { label: "Science", value: "old_science" },
    { label: "HomoScience", value: "home" },
    { label: "Computer Science", value: "course_computer_science" },
  ]);
});
