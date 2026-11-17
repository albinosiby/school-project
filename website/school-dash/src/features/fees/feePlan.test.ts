import { describe, expect, it } from "vitest";
import { annualFee, batchFeeItems, feePlanError, gradeFeeRecord, initialFeePlan, normalizedFeePlan, recurringTotal, type FeeItem, type FeePlan } from "./feePlan";

const tuition: FeeItem = { id: "tuition", name: "Tuition", amount: 2000, grades: ["5", "6"], frequency: "Monthly", dueDate: "2026-11-10", mandatory: true, newStudentsOnly: false };
const plan: FeePlan = { schemaVersion: 2, academicYear: "2026-27", termsPerYear: 2, grades: ["5", "6"], items: [tuition], late: 0, upi: true, card: true };
const defaults = { grades: ["5", "6"], academicYear: "2026-27", termsPerYear: 2 };
const legacy = { grade: "5", tuition: 24000, lab: 1000, activity: 0, library: 0, transport: 900 };

describe("fee plans", () => {
  it("starts without invented charges and accepts offline collection preferences", () => {
    expect(initialFeePlan(undefined, [], defaults).items).toEqual([]);
    expect(feePlanError({ ...plan, upi: false, card: false })).toBe("");
  });

  it("migrates saved annual band amounts without changing their values or inventing due dates", () => {
    const migrated = initialFeePlan({ fees: { pri: { tuition: 24000, lab: 0, activity: 2500, library: 0 } } }, [], defaults);
    expect(migrated.items).toEqual([
      expect.objectContaining({ name: "Tuition", amount: 24000, grades: ["5"], frequency: "Annual", dueDate: "" }),
      expect.objectContaining({ name: "Activities", amount: 2500, grades: ["5"], frequency: "Annual" }),
    ]);
  });

  it("migrates general per-term fees without copying a grade-level transport charge", () => {
    const migrated = initialFeePlan(undefined, [legacy, { ...legacy, grade: "6" }], defaults);
    expect(migrated.items).toHaveLength(2);
    expect(migrated.items[0]).toMatchObject({ name: "Tuition", amount: 24000, frequency: "Term-wise", grades: ["5", "6"] });
    expect(migrated.items.some((item) => item.name === "Transport")).toBe(false);
  });

  it("restores structured plans and per-grade records without mutating saved data", () => {
    const restored = initialFeePlan(plan, [], defaults);
    restored.items[0]!.grades.push("7");
    expect(plan.items[0]!.grades).toEqual(["5", "6"]);
    const rows = [gradeFeeRecord(plan, "5"), gradeFeeRecord(plan, "6")].map((row) => ({ ...legacy, ...row }));
    expect(initialFeePlan(undefined, rows, defaults).items).toEqual([expect.objectContaining({ ...tuition, id: "fee_1" })]);
  });

  it("stores different fees by class and stream and expands older class-wide fees for review", () => {
    const grades = ["10", "11:science", "11:commerce", "12:science"];
    const streamPlan = { ...plan, grades, items: [
      { ...tuition, id: "science", amount: 3000, grades: ["11:science"] },
      { ...tuition, id: "commerce", amount: 2200, grades: ["11:commerce"] },
      { ...tuition, id: "twelve", amount: 3500, grades: ["12:science"] },
    ] };
    expect(feePlanError(streamPlan)).toBe("");
    expect(gradeFeeRecord(streamPlan, "11:science")).toMatchObject({ grade: "11", streamId: "science", stream: "Science", items: [expect.objectContaining({ amount: 3000, grades: ["11:science"] })] });
    expect(gradeFeeRecord(streamPlan, "11:commerce").items[0]?.amount).toBe(2200);
    expect(gradeFeeRecord(streamPlan, "12:science").items[0]?.amount).toBe(3500);
    expect(gradeFeeRecord(streamPlan, "10").items).toEqual([]);
    const restored = initialFeePlan(undefined, grades.map((scope) => ({ ...legacy, ...gradeFeeRecord(streamPlan, scope) })), { ...defaults, grades });
    expect(restored.items.map((item) => [item.amount, item.grades])).toEqual([[3000, ["11:science"]], [2200, ["11:commerce"]], [3500, ["12:science"]]]);
    const migrated = initialFeePlan({ ...plan, items: [{ ...tuition, grades: ["11"] }] }, [], { ...defaults, grades });
    expect(migrated.items[0]?.grades).toEqual(["11:science", "11:commerce"]);
    expect(feePlanError({ ...streamPlan, grades: ["11"] })).toContain("configured stream");
  });

  it("uses integer paise for totals and separates recurring charges from opt-in and admission fees", () => {
    const items: FeeItem[] = [tuition,
      { ...tuition, id: "annual", name: "Annual fee", amount: 3000, frequency: "Annual" },
      { ...tuition, id: "transport", name: "Transport", amount: 1200, mandatory: true },
      { ...tuition, id: "admission", name: "Admission", amount: 5000, frequency: "One-time", newStudentsOnly: true },
    ];
    expect(recurringTotal(items, 2)).toBe(27000);
    expect(annualFee({ ...tuition, amount: 0.1, frequency: "Term-wise" }, 3)).toBe(0.3);
    expect(batchFeeItems({ ...legacy, items }, "Monthly")).toEqual([tuition]);
    expect(batchFeeItems({ ...legacy, items }, "Annual")).toHaveLength(1);
  });

  it("validates money, class eligibility, real calendar dates and duplicate fee names", () => {
    const withItem = (patch: Partial<FeeItem>) => ({ ...plan, items: [{ ...tuition, ...patch }] });
    expect(feePlanError(plan)).toBe("");
    expect(feePlanError({ ...plan, items: [] })).toBe("Add at least one fee item.");
    expect(feePlanError(withItem({ name: " " }))).toContain("enter a name");
    expect(feePlanError(withItem({ name: "Bus fee" }))).toBe("Set transport amounts in student details → Transport, and choose the collection frequency under Payments.");
    for (const amount of [0, -1, NaN, Infinity, 0.001, 10000001]) expect(feePlanError(withItem({ amount }))).toContain("enter an amount");
    expect(feePlanError(withItem({ grades: [] }))).toContain("applicable class");
    expect(feePlanError(withItem({ grades: ["7"] }))).toContain("applicable class");
    expect(feePlanError(withItem({ dueDate: "2026-02-30" }))).toContain("valid first due date");
    expect(feePlanError(withItem({ dueDate: "" }))).toBe("");
    expect(feePlanError({ ...plan, items: [tuition, { ...tuition, id: "duplicate", name: " tuition " }] })).toContain("already covers the same class");
    expect(feePlanError({ ...plan, items: [{ ...tuition, grades: ["5"] }, { ...tuition, id: "other", grades: ["6"], amount: 3000 }] })).toBe("");
    expect(feePlanError({ ...plan, academicYear: "2026-28" })).toContain("academic year");
    expect(feePlanError({ ...plan, termsPerYear: 0 })).toContain("terms per year");
    expect(feePlanError({ ...plan, late: NaN })).toContain("Late fee");
  });

  it("trims names, saves applicable classes, and leaves other grades uncharged", () => {
    const normalized = normalizedFeePlan({ ...plan, items: [{ ...tuition, name: " Tuition " }] });
    expect(normalized.items[0]?.name).toBe("Tuition");
    expect(gradeFeeRecord(normalized, "5").items[0]?.grades).toEqual(["5"]);
    expect(gradeFeeRecord(normalized, "7").items).toEqual([]);
  });

  it("removes older transport items from general setup and keeps them out of whole-class billing", () => {
    const transport = { ...tuition, id: "bus", name: "Transportation fee", amount: 1500 };
    const saved = { ...plan, items: [tuition, transport] };
    expect(initialFeePlan(saved, [], defaults).items).toEqual([tuition]);
    expect(gradeFeeRecord(saved, "5").items).toHaveLength(1);
    expect(batchFeeItems({ ...legacy, items: saved.items }, "Monthly")).toEqual([tuition]);
  });
});


it("stores the transport collection frequency separately from student amounts and general class charges", () => {
  const restored = initialFeePlan({ ...plan, transportFrequency: "Term-wise" }, [], defaults);
  expect(restored.transportFrequency).toBe("Term-wise");
  expect(normalizedFeePlan(restored).transportFrequency).toBe("Term-wise");
  expect(feePlanError({ ...restored, items: [] })).toBe("");
  expect(recurringTotal(restored.items, restored.termsPerYear)).toBe(24000);
});
