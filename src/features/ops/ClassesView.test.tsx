import { describe, expect, it } from "vitest";
import { ClassesView } from "./ClassesView";
import { ADMIN_UID, dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const staff = [
  { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" },
  { id: "stf_003", name: "Ravi Kumar", department: "Science" },
  { id: "stf_100", name: "Office Clerk", department: "Administration" },
];
const classes = [
  { id: "cls_10B", grade: "10", section: "B", classTeacherId: "stf_025", classTeacher: "Mrs. Anita Sharma", room: "R-204", wing: "North" },
  { id: "cls_9A", grade: "9", section: "A", classTeacherId: "", room: "", wing: "" },
];
const assignments = [{ id: "asg_001", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025" }];

function setup() {
  seed({ staff, classes, assignments });
  return renderUI(<ClassesView />);
}
const rowOf = (classId: string) => screen.getByText(classId).closest("tr") as HTMLElement;

describe("Add class", () => {
  async function openAdd() {
    const r = setup();
    await r.user.click(screen.getByRole("button", { name: "Add class" }));
    return { ...r, dlg: dialog("Add class") };
  }
  const submit = async (user: ReturnType<typeof setup>["user"], dlg: HTMLElement) => user.click(within(dlg).getByRole("button", { name: "Add class" }));

  it("rejects a class id that already exists and writes nothing", async () => {
    const { user, dlg } = await openAdd();
    await user.selectOptions(field("Grade", dlg), "10");
    await user.selectOptions(field("Section", dlg), "B");
    await submit(user, dlg);
    expect(fieldError("Section", dlg)).toBe("This class already exists");
    expect(writes).toHaveLength(0);
  });

  it("rejects a class teacher who already has a class and a room another class uses", async () => {
    const { user, dlg } = await openAdd();
    await user.selectOptions(field("Class teacher", dlg), "stf_025");
    await user.type(field("Room", dlg), " r-204 ");
    await submit(user, dlg);
    expect(fieldError("Class teacher", dlg)).toBe("Mrs. Anita Sharma is already class teacher of Grade 10-B");
    expect(fieldError("Room", dlg)).toBe("Room r-204 is already used by Grade 10-B");
    expect(writes).toHaveLength(0);
  });

  it("only offers grades 1–12, sections A–D and teaching staff", async () => {
    const { dlg } = await openAdd();
    expect([...field("Section", dlg).querySelectorAll("option")].map((o) => o.textContent)).toEqual(["A", "B", "C", "D"]);
    expect(field("Grade", dlg).querySelectorAll("option")).toHaveLength(12);
    expect([...field("Class teacher", dlg).querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Not assigned", "Mrs. Anita Sharma", "Ravi Kumar"]);
  });

  it("writes classes/cls_8A with the class teacher id and name, trimmed room and wing", async () => {
    const { user, dlg } = await openAdd();
    await user.selectOptions(field("Grade", dlg), "8");
    await user.selectOptions(field("Section", dlg), "A");
    await user.selectOptions(field("Class teacher", dlg), "stf_003");
    await user.type(field("Room", dlg), "  R-101 ");
    await user.type(field("Wing", dlg), " South ");
    await submit(user, dlg);
    expect(writesTo("classes")).toHaveLength(1);
    expect(getRow("classes", "cls_8A")).toMatchObject({ id: "cls_8A", grade: "8", section: "A", classTeacherId: "stf_003", classTeacher: "Ravi Kumar", room: "R-101", wing: "South", updatedBy: ADMIN_UID });
    expect(await screen.findByText("Class added")).toBeInTheDocument();
  });
});

describe("Class teacher (table)", () => {
  it("refuses a teacher who is already class teacher elsewhere", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText("Class teacher for Grade 9-A"), "stf_025");
    expect(await screen.findByText("Mrs. Anita Sharma is already class teacher of Grade 10-B")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
  it("sets classTeacherId and the denormalized classTeacher name", async () => {
    const { user } = setup();
    await user.selectOptions(screen.getByLabelText("Class teacher for Grade 9-A"), "stf_003");
    expect(writes).toEqual([expect.objectContaining({ op: "update", coll: "classes", id: "cls_9A", data: expect.objectContaining({ classTeacherId: "stf_003", classTeacher: "Ravi Kumar" }) })]);
    await user.selectOptions(screen.getByLabelText("Class teacher for Grade 9-A"), "");
    expect(getRow("classes", "cls_9A")).toMatchObject({ classTeacherId: "", classTeacher: "" });
  });
});

describe("Assignments and room (class panel)", () => {
  async function openPanel(classId = "cls_9A") {
    const r = setup();
    await r.user.click(within(rowOf(classId)).getByRole("button", { name: "Assign teachers" }));
    return { ...r, dlg: dialog(/· teachers/) };
  }

  it("requires a teacher and writes nothing", async () => {
    const { user, dlg } = await openPanel();
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(fieldError("Teacher", dlg)).toBe("Pick a teacher");
    expect(writes).toHaveLength(0);
  });

  it("rejects periods per week outside 0–48", async () => {
    const { user, dlg } = await openPanel();
    await user.selectOptions(field("Teacher", dlg), "stf_003");
    await user.type(field("Periods per week", dlg), "49");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(fieldError("Periods per week", dlg)).toBe("Whole number, 0–48");
    expect(writes).toHaveLength(0);
  });

  it("does not offer a subject that is already assigned in the class", async () => {
    const { dlg } = await openPanel("cls_10B");
    expect([...field("Subject", dlg).querySelectorAll("option")].map((o) => o.textContent)).not.toContain("Mathematics");
  });

  it("creates assignments/asg_002 with class, subject, teacher and periods per week", async () => {
    const { user, dlg } = await openPanel();
    await user.selectOptions(field("Subject", dlg), "English");
    await user.selectOptions(field("Teacher", dlg), "stf_003");
    await user.type(field("Periods per week", dlg), "6");
    await user.click(within(dlg).getByRole("button", { name: "Assign" }));
    expect(writesTo("assignments")).toHaveLength(1);
    expect(getRow("assignments", "asg_002")).toMatchObject({ id: "asg_002", classId: "cls_9A", subject: "English", teacherId: "stf_003", periodsPerWeek: 6 });
    expect(await screen.findByText("Assignment added")).toBeInTheDocument();
  });

  it("edits the room, refusing one another class uses", async () => {
    const { user, dlg } = await openPanel();
    await user.type(field("Room", dlg), "R-204");
    await user.click(within(dlg).getByRole("button", { name: "Save room" }));
    expect(fieldError("Room", dlg)).toBe("Room R-204 is already used by Grade 10-B");
    expect(writes).toHaveLength(0);
    await user.clear(field("Room", dlg));
    await user.type(field("Room", dlg), " R-109 ");
    await user.type(field("Wing", dlg), "East");
    await user.click(within(dlg).getByRole("button", { name: "Save room" }));
    expect(getRow("classes", "cls_9A")).toMatchObject({ room: "R-109", wing: "East" });
  });

  it("the panel's class teacher select shows the conflict under the field", async () => {
    const { user, dlg } = await openPanel();
    await user.selectOptions(field("Class teacher", dlg), "stf_025");
    expect(fieldError("Class teacher", dlg)).toBe("Mrs. Anita Sharma is already class teacher of Grade 10-B");
    expect(writes).toHaveLength(0);
  });
});

describe("Classes from the roster", () => {
  it("offers only classes of active students that have no class record", async () => {
    seed({ students: [
      { id: "stu_101", name: "A", grade: "8", section: "C", classId: "cls_8C", status: "Active" },
      { id: "stu_102", name: "B", grade: "7", section: "A", classId: "cls_7A", status: "Alumni" },
      { id: "stu_103", name: "C", grade: "9", section: "A", classId: "cls_9A", status: "Active" },
    ] });
    const { user } = setup();
    expect(screen.getByText(/1 class-section in the student roster has no class record/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create them" }));
    expect(writesTo("classes").map((w) => w.id)).toEqual(["cls_8C"]);
    expect(getRow("classes", "cls_8C")).toMatchObject({ grade: "8", section: "C", classTeacherId: "" });
  });
});
