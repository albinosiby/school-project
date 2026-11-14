import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui";
import * as time from "@/lib/useNow";
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
const cardOf = (classId: string) => {
  const row = classes.find((entry) => entry.id === classId)!;
  return screen.getByRole("article", { name: `Grade ${row.grade}-${row.section}` });
};
const bell = { id: "bell", gates: "08:00", start: "09:00", end: "13:00", periodCount: 4, periodLength: 40,
  breaks: [{ name: "Morning break", start: "10:20", duration: 20 }] };
function currentPeriodSetup() {
  const clock = vi.spyOn(time, "useNow").mockReturnValue(Date.parse("2026-11-11T09:55:00+05:30"));
  seed({ set_config: [bell, { id: "regional", timezone: "Asia/Kolkata", workingWeek: "Mon – Sat" }],
    ops_periods: [{ id: "period_math", classId: "cls_10B", grade: "10", section: "B", day: "Wed", period: 2, subject: "Mathematics", teacherId: "stf_003", teacher: "Old name" }] });
  return clock;
}

describe("Class cards", () => {
  it("shows the class teacher, room, live student count and assigned subjects on each card", () => {
    seed({ students: [
      { id: "active", grade: "10", section: "B", classId: "cls_10B", status: "Active" },
      { id: "legacy", grade: "10", section: "B" },
      { id: "deleted", grade: "10", section: "B", deleted: true },
      { id: "transferred", grade: "10", section: "B", status: "Transferred" },
      { id: "other", grade: "9", section: "A", status: "Active" },
    ] });
    setup();
    const card = cardOf("cls_10B");
    expect(within(card).getByRole("heading", { name: "Grade 10" })).toBeInTheDocument();
    expect(within(card).getByText("Section B")).toBeInTheDocument();
    expect(within(card).getByText("Class teacher", { selector: "dt" }).nextElementSibling).toHaveTextContent("Mrs. Anita Sharma");
    expect(within(card).queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Manage assignments/i })).not.toBeInTheDocument();
    expect(within(card).getByRole("link", { name: "View Grade 10-B details" })).toHaveAttribute("href", "/classes/cls_10B");
    expect(within(card).getByText("Students", { selector: "dt" }).nextElementSibling).toHaveTextContent("2");
    expect(within(card).getByText("Subjects assigned", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(within(card).getByText("Room R-204 · North")).toBeInTheDocument();
    expect(within(cardOf("cls_9A")).getByText("Students", { selector: "dt" }).nextElementSibling).toHaveTextContent("1");
    expect(within(cardOf("cls_9A")).getByText("Room not assigned")).toBeInTheDocument();
  });

  it("combines search and grade filtering, then restores the cards when cleared", async () => {
    const { user } = setup();
    const search = screen.getByRole("searchbox", { name: "Search classes" });
    const grade = screen.getByRole("combobox", { name: "Filter by grade" });
    await user.type(search, "  aNiTa  ");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(cardOf("cls_10B")).toBeInTheDocument();
    await user.selectOptions(grade, "9");
    expect(screen.getByText("No classes match")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(search).toHaveValue("");
    expect(grade).toHaveValue("");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    await user.selectOptions(grade, "10");
    await user.type(search, "r-204");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(cardOf("cls_10B")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("paginates the card grid and resets to the first page when searching", async () => {
    const many = Array.from({ length: 14 }, (_, index) => {
      const grade = String(Math.floor(index / 2) + 1), section = index % 2 ? "B" : "A";
      return { id: `cls_${grade}${section}`, grade, section };
    });
    seed({ classes: many });
    const { user } = renderUI(<ClassesView />);
    expect(screen.getAllByRole("article")).toHaveLength(12);
    expect(screen.getByText("Showing 1–12 of 14 classes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Grade 7-B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    await user.type(screen.getByRole("searchbox", { name: "Search classes" }), "Grade 1");
    expect(screen.getAllByRole("article")).toHaveLength(2);
    expect(screen.getByRole("article", { name: "Grade 1-A" })).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Grade 7-B" })).not.toBeInTheDocument();
  });

  it("keeps senior streams distinct and links to the selected class", async () => {
    seed({ classes: [
      { id: "custom_science", grade: "11", section: "A", stream: "Science", subjects: ["Chemistry"] },
      { id: "custom_computer", grade: "11", section: "A", stream: "Computer Science", subjects: ["Computing"] },
    ] });
    const { user } = renderUI(<ClassesView />);
    expect(screen.getByRole("article", { name: "Grade 11 · Science · A" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search classes" }), "Computer Science");
    const card = screen.getByRole("article", { name: "Grade 11 · Computer Science · A" });
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(within(card).getByRole("link", { name: "View Grade 11 · Computer Science · A details" }))
      .toHaveAttribute("href", "/classes/custom_computer");
    expect(screen.queryByRole("button", { name: /Manage assignments/i })).not.toBeInTheDocument();
  });

  it("shows the scheduled teacher separately from the class teacher and only this period's attendance", () => {
    currentPeriodSetup();
    seed({ ops_attendance: [
      { id: "current", date: "2026-11-11", classId: "cls_10B", period: 2, total: 4, marks: { absent: "A", late: "L" }, submitted: true },
      { id: "old_period", date: "2026-11-11", classId: "cls_9A", period: 1, total: 30, marks: {}, submitted: true },
    ] });
    setup();
    const card = cardOf("cls_10B");
    const period = within(card).getByRole("region", { name: "Current period" });
    expect(within(period).getByText(/Period 2/)).toBeInTheDocument();
    expect(within(period).getByText("Mathematics")).toBeInTheDocument();
    expect(within(period).getByText("Scheduled teacher", { selector: "dt" }).nextElementSibling).toHaveTextContent("Ravi Kumar");
    expect(within(card).getByText("Class teacher", { selector: "dt" }).nextElementSibling).toHaveTextContent("Mrs. Anita Sharma");
    expect(within(card).getByText("Present", { selector: "dt" }).nextElementSibling).toHaveTextContent("3 / 4");
    expect(within(cardOf("cls_9A")).getByText("Present", { selector: "dt" }).nextElementSibling).toHaveTextContent("Not marked");
    expect(writes).toHaveLength(0);
  });

  it("updates the current lesson at a break and shows assigned substitute cover", () => {
    const clock = currentPeriodSetup();
    seed({ ops_substitutions: [{ id: "cover", date: "2026-11-11", classId: "cls_10B", day: "Wed", period: 2,
      subject: "Mathematics", absentTeacherId: "stf_003", substituteTeacherId: "stf_025", status: "Assigned" }] });
    const view = setup();
    const period = within(cardOf("cls_10B")).getByRole("region", { name: "Current period" });
    expect(within(period).getByText("Substitute teacher", { selector: "dt" }).nextElementSibling).toHaveTextContent("Mrs. Anita Sharma");
    clock.mockReturnValue(Date.parse("2026-11-11T10:25:00+05:30"));
    view.rerender(<ToastProvider><ClassesView /></ToastProvider>);
    expect(within(cardOf("cls_10B")).getByText("Morning break")).toBeInTheDocument();
    expect(within(cardOf("cls_10B")).queryByText("Mathematics")).not.toBeInTheDocument();
    expect(within(cardOf("cls_10B")).getByText("Present", { selector: "dt" }).nextElementSibling).toHaveTextContent("—");
  });
});

describe("Add class", () => {
  it("requires a senior stream and creates Commerce A independently from Science A", async () => {
    seed({ classes: [{ id: "cls_11_science_A", grade: "11", section: "A", streamId: "science" }] });
    const { user } = renderUI(<ClassesView />);
    await user.click(screen.getByRole("button", { name: "Add class" }));
    const dlg = dialog("Add class");
    await user.selectOptions(field("Grade", dlg), "11");
    await user.click(within(dlg).getByRole("button", { name: "Add class" }));
    expect(fieldError("Stream", dlg)).toBe("Choose a stream");
    await user.selectOptions(field("Stream", dlg), "commerce");
    await user.click(within(dlg).getByRole("button", { name: "Add class" }));
    expect(getRow("classes", "cls_11_commerce_A")).toMatchObject({ grade: "11", section: "A", streamId: "commerce", stream: "Commerce" });
    expect(getRow("classes", "cls_11_science_A")).toBeDefined();
  });

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

  it("hides assigned class teachers and rejects a room another class uses", async () => {
    const { user, dlg } = await openAdd();
    expect(within(field("Class teacher", dlg)).queryByRole("option", { name: "Mrs. Anita Sharma" })).not.toBeInTheDocument();
    await user.type(field("Room", dlg), " r-204 ");
    await submit(user, dlg);
    expect(fieldError("Room", dlg)).toBe("Room r-204 is already used by Grade 10-B");
    expect(writes).toHaveLength(0);
  });

  it("offers LKG, UKG and grades 1–12, sections A–D and teaching staff", async () => {
    const { dlg } = await openAdd();
    expect([...field("Section", dlg).querySelectorAll("option")].map((o) => o.textContent)).toEqual(["A", "B", "C", "D"]);
    expect([...field("Grade", dlg).querySelectorAll("option")].map((option) => option.value)).toEqual(["LKG", "UKG", ...Array.from({ length: 12 }, (_, index) => String(index + 1))]);
    expect([...field("Class teacher", dlg).querySelectorAll("option")].map((o) => o.textContent)).toEqual(["Not assigned", "Ravi Kumar"]);
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
