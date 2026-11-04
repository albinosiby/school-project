import { describe, expect, it } from "vitest";
import { ExamDuties } from "./ExamDuties";
import type { Cycle, Paper } from "./types";
import { dialog, field, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const cycles = [{ id: "cyc_1", title: "Term 2 Pre-Board" }] as Cycle[];
const p = (x: Partial<Paper>): Paper => ({
  id: "pap_1", cycleId: "cyc_1", grade: "8", subject: "Mathematics", code: "MATH-041", date: "2026-11-18", start: "09:00", duration: 2.5, theory: 80, internal: 20,
  internalType: "Internal", venue: "Exam Hall 1", invigilator: "Mrs. Sunita Verma", invigilatorId: "stf_001", status: "Scheduled", marksEntered: false, published: [], classIds: ["cls_8A"], ...x,
});
const math = p({});
// same date, overlapping time, chief: Dr. Manoj Kaushik
const sci = p({ id: "pap_2", grade: "9", subject: "Science", code: "SCI-086", start: "10:00", venue: "Hall 2", invigilator: "Dr. Manoj Kaushik", invigilatorId: "stf_002", classIds: ["cls_9A"] });
const staff = [
  { id: "stf_001", name: "Mrs. Sunita Verma", department: "Mathematics" },
  { id: "stf_002", name: "Dr. Manoj Kaushik", department: "Science" },
  { id: "stf_003", name: "Ms. Ananya Sen", department: "English" },
];
const students = [
  { id: "stu_1", name: "Kabir Nair", grn: "G1", grade: "8", section: "A", roll: 1 },
  { id: "stu_2", name: "Myra Iyer", grn: "G2", grade: "8", section: "A", roll: 2 },
  { id: "stu_3", name: "Other Class", grn: "G3", grade: "8", section: "B", roll: 1 },
];

function open() {
  seed({ staff, students, exm_papers: [math, sci] });
  const r = renderUI(<ExamDuties cycles={cycles} papers={[math, sci]} defaultCycleId="cyc_1" />);
  return r;
}
const addFor = (subject: string) => screen.getByText(`Grade ${subject === "Mathematics" ? "8" : "9"} · ${subject}`).parentElement!.querySelector("button")!;

describe("Exam duty allocation", () => {
  it("shows each paper's chief and the candidates of its classes", () => {
    open();
    expect(screen.getByLabelText("Chief invigilator for Mathematics grade 8")).toHaveValue("stf_001");
    expect(screen.getAllByText("2 candidates").length).toBeGreaterThan(0);
  });

  it("validates the duty form and writes nothing", async () => {
    const { user } = open();
    await user.click(addFor("Mathematics"));
    const d = dialog("Add invigilator");
    await user.click(within(d).getByRole("button", { name: /Assign duty/ }));
    expect(within(d).getByText("Pick a staff member")).toBeInTheDocument();
    await user.selectOptions(field("Staff member", d), "stf_001");
    await user.click(within(d).getByRole("button", { name: /Assign duty/ }));
    expect(within(d).getByText("This staff member already has a duty on this paper")).toBeInTheDocument();
    await user.selectOptions(field("Staff member", d), "stf_003");
    await user.click(within(d).getByRole("button", { name: /Assign duty/ }));
    expect(within(d).getByText("Enter the hall / room")).toBeInTheDocument();
    await user.type(field("Hall / room", d), "Hall 3");
    await user.clear(field("Candidates", d));
    await user.click(within(d).getByRole("button", { name: /Assign duty/ }));
    expect(within(d).getByText("Candidates must be a whole number")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("warns about a clash (same staff, same date, overlapping time)", async () => {
    const { user } = open();
    await user.click(addFor("Mathematics"));
    const d = dialog("Add invigilator");
    await user.selectOptions(field("Staff member", d), "stf_002");
    expect(within(d).getByText(/Overlapping duty on 18 Nov 2026: Grade 9 Science \(10:00–12:30\)\. You can still assign, but the teacher cannot be in two halls\./)).toBeInTheDocument();
  });

  it("writes the exm_duties row the teacher app reads", async () => {
    const { user } = open();
    await user.click(addFor("Mathematics"));
    const d = dialog("Add invigilator");
    await user.selectOptions(field("Staff member", d), "stf_003");
    await user.type(field("Hall / room", d), " Hall 3 ");
    await user.click(within(d).getByRole("button", { name: /Assign duty/ }));
    const row = rowsOf<Record<string, unknown>>("exm_duties")[0];
    expect(String(row.id)).toMatch(/^dut_pap_1_/);
    expect(row).toMatchObject({
      paperId: "pap_1", cycleId: "cyc_1", staffId: "stf_003", role: "Invigilator", hall: "Hall 3", venue: "Exam Hall 1", date: "2026-11-18", start: "09:00", end: "11:30",
      grade: "8", subject: "Mathematics", code: "MATH-041", classIds: ["cls_8A"], candidates: 2, status: "upcoming", reportBy: "08:30", note: "",
    });
    expect(typeof row.createdAt).toBe("string");
    expect(await screen.findByText("Ms. Ananya Sen assigned; teacher notified")).toBeInTheDocument();
  });

  it("changes the chief invigilator on the paper", async () => {
    const { user } = open();
    await user.selectOptions(screen.getByLabelText("Chief invigilator for Mathematics grade 8"), "stf_003");
    expect(getRow("exm_papers", "pap_1")).toMatchObject({ invigilatorId: "stf_003", invigilator: "Ms. Ananya Sen" });
    expect(writesTo("exm_papers")).toHaveLength(1);
  });
});
