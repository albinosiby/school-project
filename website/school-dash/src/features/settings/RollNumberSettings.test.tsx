import { expect, it } from "vitest";
import { RollNumberSettings } from "./RollNumberSettings";
import { alphabeticalPlan } from "./rollNumbers";
import { dialog, getRow, renderUI, screen, seed, within } from "@/test/render";

const classes = [{ id: "cls_10B", grade: "10", section: "B", rollRevision: 1 }, { id: "cls_9A", grade: "9", section: "A" }];
const students = [
  { id: "s_c", name: "Chetan Das", classId: "cls_10B", roll: 0 },
  { id: "s_a", name: "aarav Mehta", classId: "cls_10B", roll: 0 },
  { id: "s_b", name: "Bina Rao", classId: "cls_10B", roll: 2, rollAcademicYear: "2025-26" },
  { id: "s_old", name: "Alumni", classId: "cls_10B", roll: 9, status: "Graduated" },
  { id: "s_z", name: "Zoya", classId: "cls_9A", roll: 1, rollAcademicYear: "2026-27" },
];

it("plans every division 1..n by name, treating last year's numbers as unassigned", () => {
  const plan = alphabeticalPlan(students, classes, "2026-27");
  expect(plan.map((p) => [p.label, p.rows.map((r) => `${r.roll}:${r.name}:${r.previous}`), p.changed])).toEqual([
    ["9-A", ["1:Zoya:1"], 0],
    ["10-B", ["1:aarav Mehta:0", "2:Bina Rao:0", "3:Chetan Das:0"], 3],
  ]);
});

it("numbers all classes alphabetically and saves the automatic-assignment switch", async () => {
  seed({ classes, students, set_config: [] });
  const { user } = renderUI(<RollNumberSettings academicYear="2026-27" />);
  expect(screen.getByText("3 without a roll number")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Number all classes alphabetically" }));
  const dlg = dialog("Number all classes alphabetically");
  expect(within(dlg).getByText("10-B")).toBeInTheDocument();
  await user.click(within(dlg).getByRole("button", { name: "Assign 3 roll numbers" }));
  expect(getRow("students", "s_a")).toMatchObject({ roll: 1, rollAcademicYear: "2026-27" });
  expect(getRow("students", "s_b")).toMatchObject({ roll: 2, rollAcademicYear: "2026-27" });
  expect(getRow("students", "s_c")).toMatchObject({ roll: 3, rollAcademicYear: "2026-27" });
  expect(getRow("students", "s_z")).toMatchObject({ roll: 1 });
  expect(getRow("students", "s_old")).toMatchObject({ roll: 9 });
  expect(getRow("classes", "cls_10B")).toMatchObject({ rollRevision: 2 });
  expect(getRow("classes", "cls_9A")?.rollRevision).toBeUndefined();
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.getByText(/every student has a roll number/)).toBeInTheDocument();

  const toggle = screen.getByRole("switch", { name: "Assign roll numbers automatically" });
  expect(toggle).toHaveAttribute("aria-checked", "true");
  await user.click(toggle);
  expect(getRow("set_config", "rolls")).toMatchObject({ auto: false });
  expect(toggle).toHaveAttribute("aria-checked", "false");
});
