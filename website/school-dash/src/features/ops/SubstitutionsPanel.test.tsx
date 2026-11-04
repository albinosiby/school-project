import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { SubstitutionsPanel } from "./SubstitutionsPanel";
import type { Period } from "./logic";
import { ADMIN_UID, dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const staff = [
  { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" },
  { id: "stf_003", name: "Ravi Kumar", department: "Science" },
  { id: "stf_010", name: "Neha Gupta", department: "English" },
  { id: "stf_011", name: "Karan Shah", department: "Hindi" },
  { id: "stf_012", name: "Zoya Khan", department: "Science" },
  { id: "stf_100", name: "Office Clerk", department: "Administration" },
];
const periods: Period[] = [
  { id: "per_10B_Mon_2", classId: "cls_10B", grade: "10", section: "B", day: "Mon", period: 2, subject: "Mathematics", teacher: "Mrs. Anita Sharma", teacherId: "stf_025", room: "R-10B" },
  { id: "per_8A_Mon_2", classId: "cls_8A", grade: "8", section: "A", day: "Mon", period: 2, subject: "Physics", teacher: "Ravi Kumar", teacherId: "stf_003", room: "R-8A" },
];
const classes = [{ id: "cls_10B", grade: "10", section: "B" }, { id: "cls_8A", grade: "8", section: "A" }];
const leaves = [{ id: "lv1", staffId: "stf_011", from: "2026-11-09", to: "2026-11-10", status: "Approved" }];
const SUB_ID = "sub_2026-11-09_cls_10B_2";
const accepted = { id: SUB_ID, date: "2026-11-09", day: "Mon", period: 2, classId: "cls_10B", subject: "Mathematics", absentTeacherId: "stf_025", substituteTeacherId: "stf_010", status: "Accepted", note: "Chapter 4" };

const PERIOD = "Period (teacher who is absent)";
function setup(subs: Record<string, unknown>[] = []) {
  seed({ staff, classes, staff_leaves: leaves, ops_substitutions: subs });
  return renderUI(<SubstitutionsPanel staff={staff} periods={periods} />);
}
async function openNew(user: ReturnType<typeof setup>["user"], date = "2026-11-09") {
  await user.click(screen.getByRole("button", { name: "Assign substitute" }));
  const dlg = dialog("Assign substitute");
  fireEvent.change(field("Date", dlg), { target: { value: date } });
  await user.selectOptions(field("Class", dlg), "cls_10B");
  await user.selectOptions(field(PERIOD, dlg), "2");
  return dlg;
}
const optionTexts = (el: HTMLElement) => [...el.querySelectorAll("option")].map((o) => ({ text: o.textContent, disabled: o.disabled }));

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 3, 9, 0)); });
afterEach(() => vi.useRealTimers());

describe("Substitution form", () => {
  it("requires a period and a substitute and writes nothing", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Assign substitute" }));
    const dlg = dialog("Assign substitute");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(fieldError(PERIOD, dlg)).toBe("Pick a period");
    expect(fieldError("Substitute teacher", dlg)).toBe("Pick a substitute teacher");
    expect(writes).toHaveLength(0);
  });

  it("flags Sundays", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Assign substitute" }));
    const dlg = dialog("Assign substitute");
    fireEvent.change(field("Date", dlg), { target: { value: "2026-11-08" } });
    expect(fieldError("Date", dlg)).toBe("No classes on Sunday");
  });

  it("offers everyone but the absent teacher; busy teachers (teaching then, on leave) are disabled", async () => {
    const { user } = setup();
    const dlg = await openNew(user);
    expect(optionTexts(field("Substitute teacher", dlg))).toEqual([
      { text: "Select a free teacher…", disabled: false },
      { text: "Karan Shah (Hindi) · busy: on approved leave", disabled: true },
      { text: "Neha Gupta (English)", disabled: false },
      { text: "Ravi Kumar (Science) · busy: teaching Grade 8-A", disabled: true },
      { text: "Zoya Khan (Science)", disabled: false },
    ]);
  });

  it("a teacher already covering another class in that period is busy", async () => {
    const { user } = setup([{ ...accepted, id: "sub_2026-11-09_cls_8A_2", classId: "cls_8A", absentTeacherId: "stf_003", substituteTeacherId: "stf_012", status: "Assigned" }]);
    const dlg = await openNew(user);
    const zoya = optionTexts(field("Substitute teacher", dlg)).find((o) => o.text?.startsWith("Zoya"));
    expect(zoya).toEqual({ text: "Zoya Khan (Science) · busy: covering Grade 8-A", disabled: true });
  });

  it("refuses a past date", async () => {
    const { user } = setup();
    const dlg = await openNew(user, "2026-11-02");
    await user.selectOptions(field("Substitute teacher", dlg), "stf_010");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(fieldError("Date", dlg)).toBe("Date cannot be in the past");
    expect(writes).toHaveLength(0);
  });

  it("refuses a second substitute for a covered period", async () => {
    const { user } = setup([accepted]);
    const dlg = await openNew(user);
    await user.selectOptions(field("Substitute teacher", dlg), "stf_012");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(fieldError(PERIOD, dlg)).toBe("This period already has a substitute (Neha Gupta). Use Reassign.");
    expect(writes).toHaveLength(0);
  });

  it("creates sub_{date}_{classId}_{period} with status Assigned", async () => {
    const { user } = setup();
    const dlg = await openNew(user);
    await user.selectOptions(field("Substitute teacher", dlg), "stf_010");
    await user.type(field("Topic / plan", dlg), " Quadratics ");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(writesTo("ops_substitutions")).toHaveLength(1);
    const row = getRow<Record<string, unknown>>("ops_substitutions", SUB_ID);
    expect(row).toMatchObject({
      id: SUB_ID, date: "2026-11-09", day: "Mon", period: 2, classId: "cls_10B", subject: "Mathematics", absentTeacherId: "stf_025",
      substituteTeacherId: "stf_010", status: "Assigned", topic: "Quadratics", updatedBy: ADMIN_UID,
    });
    expect(row).not.toHaveProperty("note");
    expect(await screen.findByText("Substitute assigned")).toBeInTheDocument();
  });
});

describe("Reassign and status", () => {
  it("reassigning to another teacher resets the status to Assigned", async () => {
    const { user } = setup([accepted]);
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    const dlg = dialog("Reassign substitute");
    expect(field("Date", dlg)).toBeDisabled();
    await user.selectOptions(field("Substitute teacher", dlg), "stf_012");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(writes).toEqual([expect.objectContaining({ op: "update", coll: "ops_substitutions", id: SUB_ID })]);
    expect(getRow("ops_substitutions", SUB_ID)).toMatchObject({ substituteTeacherId: "stf_012", status: "Assigned", absentTeacherId: "stf_025" });
  });

  it("editing the note of an accepted cover keeps it Accepted", async () => {
    const { user } = setup([accepted]);
    await user.click(screen.getByRole("button", { name: "Reassign" }));
    const dlg = dialog("Reassign substitute");
    await user.clear(field("Note", dlg));
    await user.type(field("Note", dlg), "Chapter 5");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(getRow("ops_substitutions", SUB_ID)).toMatchObject({ substituteTeacherId: "stf_010", status: "Accepted", note: "Chapter 5" });
  });

  it("shows contract status strings, tolerating lower-case ones; upcoming hides past dates", async () => {
    const { user } = setup([
      accepted,
      { ...accepted, id: "sub_2026-11-10_cls_10B_2", date: "2026-11-10", day: "Tue", status: "declined" },
      { ...accepted, id: "sub_2026-11-11_cls_10B_2", date: "2026-11-11", day: "Wed", status: "Assigned" },
      { ...accepted, id: "sub_2026-10-01_cls_10B_2", date: "2026-10-01", day: "Thu", status: "Accepted" },
    ]);
    const rows = () => screen.getAllByRole("row").slice(1);
    expect(rows()).toHaveLength(3);
    expect(rows().map((r) => within(r).getByText(/^(Assigned|Accepted|Declined)$/).textContent)).toEqual(["Accepted", "Declined", "Assigned"]);
    await user.selectOptions(screen.getByLabelText("Show"), "all");
    expect(rows()).toHaveLength(4);
  });
});
