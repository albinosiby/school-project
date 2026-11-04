import { describe, expect, it } from "vitest";
import { TimetableView } from "./TimetableView";
import { ADMIN_UID, dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const staff = [
  { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" },
  { id: "stf_003", name: "Ravi Kumar", department: "Science" },
  { id: "stf_100", name: "Office Clerk", department: "Administration" },
];
const p = (id: string, classId: string, day: string, period: number, subject: string, teacherId: string, teacher: string) => {
  const [, grade, section] = /^cls_(\d+)([A-D])$/.exec(classId)!;
  return { id, classId, grade, section, day, period, subject, teacherId, teacher, room: `R-${grade}${section}` };
};
const periods = [
  p("per_10A_Mon_2", "cls_10A", "Mon", 2, "Mathematics", "stf_025", "Mrs. Anita Sharma"),
  p("per_10B_Wed_4", "cls_10B", "Wed", 4, "English", "stf_003", "Ravi Kumar"),
];
function setup(extra: Record<string, unknown>[] = []) {
  seed({ staff, ops_periods: [...periods, ...extra] });
  return renderUI(<TimetableView />);
}
const slot = (name: string) => screen.getByRole("button", { name });

describe("Timetable grid", () => {
  it("shows Mon–Sat × periods 1–8 with the shared bell times", () => {
    setup();
    expect(screen.getAllByRole("button", { name: /^(Mon|Tue|Wed|Thu|Fri|Sat) period [1-8] / })).toHaveLength(48);
    expect(screen.queryByRole("button", { name: /^Sun / })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /period 9/ })).not.toBeInTheDocument();
    expect(screen.getByText("08:30")).toBeInTheDocument();
    expect(screen.getByText("14:45")).toBeInTheDocument();
    expect(slot("Wed period 4 English")).toBeInTheDocument();
  });
});

describe("Period add / edit", () => {
  it("requires a subject and a teacher and writes nothing", async () => {
    const { user } = setup();
    await user.click(slot("Mon period 1 empty"));
    const dlg = dialog("Add period");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(fieldError("Subject", dlg)).toBe("Pick a subject");
    expect(fieldError("Teacher", dlg)).toBe("Pick a teacher");
    expect(writes).toHaveLength(0);
  });

  it("only lists teaching staff", async () => {
    const { user } = setup();
    await user.click(slot("Mon period 1 empty"));
    const opts = [...field("Teacher", dialog("Add period")).querySelectorAll("option")].map((o) => o.textContent);
    expect(opts).toEqual(["Select a teacher…", "Mrs. Anita Sharma (Mathematics)", "Ravi Kumar (Science)"]);
  });

  it("creates per_10B_Tue_3 with class, day, period, subject, teacher id + name and room", async () => {
    const { user } = setup();
    await user.click(slot("Tue period 3 empty"));
    const dlg = dialog("Add period");
    await user.selectOptions(field("Subject", dlg), "Physics");
    await user.selectOptions(field("Teacher", dlg), "stf_003");
    expect(within(dlg).getByText("No clash")).toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(writesTo("ops_periods")).toHaveLength(1);
    expect(getRow("ops_periods", "per_10B_Tue_3")).toEqual(expect.objectContaining({
      id: "per_10B_Tue_3", classId: "cls_10B", grade: "10", section: "B", day: "Tue", period: 3, subject: "Physics", teacher: "Ravi Kumar", teacherId: "stf_003", room: "R-10B", updatedBy: ADMIN_UID,
    }));
    expect(await screen.findByText("Period saved")).toBeInTheDocument();
  });

  it("warns when the teacher is double-booked in another class; saving needs the explicit 'Save anyway'", async () => {
    const { user } = setup();
    await user.click(slot("Mon period 2 empty"));
    const dlg = dialog("Add period");
    await user.selectOptions(field("Subject", dlg), "Mathematics");
    await user.selectOptions(field("Teacher", dlg), "stf_025");
    expect(within(dlg).getByRole("alert")).toHaveTextContent("Mrs. Anita Sharma is already teaching Mathematics in Grade 10-A at this time. Saving creates a double-booking.");
    expect(within(dlg).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
    await user.click(within(dlg).getByRole("button", { name: "Save anyway" }));
    expect(getRow("ops_periods", "per_10B_Mon_2")).toMatchObject({ teacherId: "stf_025", subject: "Mathematics" });
    expect(await screen.findByText(/1 period in this class have a teacher double-booked/)).toBeInTheDocument();
  });

  it("edits a period in place", async () => {
    const { user } = setup();
    await user.click(slot("Wed period 4 English"));
    const dlg = dialog("Edit period");
    expect(field("Teacher", dlg)).toHaveValue("stf_003");
    await user.selectOptions(field("Teacher", dlg), "stf_025");
    await user.click(within(dlg).getByRole("button", { name: "Save" }));
    expect(writes).toEqual([expect.objectContaining({ op: "update", coll: "ops_periods", id: "per_10B_Wed_4", data: expect.objectContaining({ teacherId: "stf_025", teacher: "Mrs. Anita Sharma", classId: "cls_10B" }) })]);
  });

  it("matches a legacy row (no classId / teacherId) by grade-section and teacher name", async () => {
    const { user } = setup([{ id: "legacy_1", grade: "10", section: "B", day: "Fri", period: 6, subject: "Hindi", teacher: "Ravi Kumar", room: "" }]);
    await user.click(slot("Fri period 6 Hindi"));
    expect(field("Teacher", dialog("Edit period"))).toHaveValue("stf_003");
  });

  it("clears a period", async () => {
    const { user } = setup();
    await user.click(slot("Wed period 4 English"));
    await user.click(within(dialog("Edit period")).getByRole("button", { name: "Clear period" }));
    expect(writes).toEqual([expect.objectContaining({ op: "delete", coll: "ops_periods", id: "per_10B_Wed_4" })]);
    expect(await screen.findByText("Period cleared")).toBeInTheDocument();
  });
});
