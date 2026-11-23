import { beforeEach, describe, expect, it } from "vitest";
import { MarksView } from "./MarksView";
import { authState, getRow, renderUI, screen, seed, writes } from "@/test/render";
import type { Sheet } from "@/features/exams/sheets";

const teacher = { id: "uid_t", email: "t@s.in", organizationName: "", schoolId: "sch_test", role: "teacher" as const, staffId: "stf_1", staffRole: "teacher", name: "Anita" };
const sheet = (patch: Partial<Sheet> = {}): Sheet => ({
  id: "p1__cls_10B", cycleId: "c1", paperId: "p1", classId: "cls_10B", classLabel: "10-B", subject: "Mathematics", grade: "10",
  components: { mode: "marks", theory: 80, practical: 0, internal: 20, passMarks: 33, gradeOptions: [] },
  ownerId: "stf_1", ownerName: "Anita Rao", reviewerId: "", rosterIds: ["s1", "s2"], status: "NotStarted", version: 1,
  summary: { total: 2, entered: 0, absent: 0, medical: 0, exempt: 0, outOfRange: 0, highest: null, lowest: null, mean: null }, needsRecheck: false, ...patch,
});
const base = (patch: Partial<Sheet> = {}) => seed({
  staff: [{ id: "stf_1", name: "Anita Rao" }],
  exm_cycles: [{ id: "c1", title: "Annual Examination", short: "Annual", start: "2026-11-20", end: "2026-11-30", status: "Live" }],
  exm_papers: [
    { id: "p1", cycleId: "c1", grade: "10", subject: "Mathematics", code: "MAT", date: "2026-11-21", theory: 80, internal: 20, classIds: ["cls_10B"], sheetsOpened: true },
    { id: "p2", cycleId: "c1", grade: "10", subject: "Mathematics", code: "MAT", date: "2026-11-22", theory: 80, internal: 20, classIds: ["cls_10A"] },
  ],
  assignments: [{ id: "a1", teacherId: "stf_1", classId: "cls_10B", subject: "Mathematics" }, { id: "a2", teacherId: "stf_1", classId: "cls_10A", subject: "Mathematics" }],
  exm_sheets: [sheet(patch), sheet({ id: "p9__cls_8A", paperId: "p9", classId: "cls_8A", classLabel: "8-A", subject: "Science", ownerId: "stf_2" })],
  exm_candidates: [
    { id: "cand_s1", studentId: "s1", name: "Aarav Sharma", roll: "#10B-01", grn: "GIS-1", cls: "10-B", grade: "10", section: "B", classId: "cls_10B" },
    { id: "cand_s2", studentId: "s2", name: "Bina Das", roll: "#10B-02", grn: "GIS-2", cls: "10-B", grade: "10", section: "B", classId: "cls_10B" },
  ],
});
const markDoc = { id: "p1__cand_s1", paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "cls_10B", theory: 70, practical: null, internal: 15, gradeValue: "", status: "Present", tag: "", note: "", teacherId: "stf_1", enteredAt: "2026-11-21T09:00:00.000Z", updatedAt: "2026-11-21T09:00:00.000Z", updatedBy: "uid_t" };

describe("MarksView", () => {
  beforeEach(() => { authState.user = teacher; });

  it("shows an empty state for non-teaching staff", () => {
    authState.user = { ...teacher, role: "staff" };
    renderUI(<MarksView />);
    expect(screen.getByText("Only teachers enter marks")).toBeInTheDocument();
  });

  it("lists own sheets grouped by exam with their status, and papers awaiting a sheet", () => {
    base({ status: "Returned", returnNote: "Roll 2 missing" });
    renderUI(<MarksView />);
    expect(screen.getByText("Annual Examination")).toBeInTheDocument();
    expect(screen.getByText("Mathematics · 10-B")).toBeInTheDocument();
    expect(screen.getByText("Returned")).toBeInTheDocument();
    expect(screen.getByText("Returned: Roll 2 missing")).toBeInTheDocument();
    expect(screen.queryByText("Science · 8-A")).not.toBeInTheDocument();
    expect(screen.getByText("Mathematics · 10-A")).toBeInTheDocument();
    expect(screen.getByText("Marks entry opens when the office opens the sheet")).toBeInTheDocument();
  });

  it("creates the exm_marks document with the teacher app's keys when a component is entered", async () => {
    base();
    const { user } = renderUI(<MarksView />);
    await user.click(screen.getByRole("button", { name: "Open Mathematics · 10-B" }));
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("#10B-01 · GRN GIS-1")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Theory marks for Aarav Sharma"), "72");
    await user.tab();
    expect(getRow("exm_marks", "p1__cand_s1")).toEqual({
      id: "p1__cand_s1", paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "cls_10B", theory: 72, practical: null, internal: null, gradeValue: "",
      status: "Present", tag: "", note: "", teacherId: "stf_1", enteredAt: expect.any(String), updatedAt: expect.any(String), updatedBy: expect.any(String),
    });
    expect(screen.getByText("0 entered · 0 absent · 2 pending of 2")).toBeInTheDocument();
  });

  it("updates an existing mark with only the keys the sheet rule allows", async () => {
    base();
    seed({ exm_marks: [markDoc] });
    const { user } = renderUI(<MarksView />);
    await user.click(screen.getByRole("button", { name: "Open Mathematics · 10-B" }));
    expect(screen.getByText("1 entered · 0 absent · 1 pending of 2")).toBeInTheDocument();
    const internal = screen.getByLabelText("Internal marks for Aarav Sharma") as HTMLInputElement;
    expect(internal.value).toBe("15");
    await user.clear(internal);
    await user.type(internal, "18{Enter}");
    const last = writes[writes.length - 1]!;
    expect(last).toMatchObject({ op: "update", coll: "exm_marks", id: "p1__cand_s1" });
    expect(Object.keys(last.data!).sort()).toEqual(["enteredAt", "gradeValue", "internal", "note", "practical", "status", "tag", "theory", "updatedAt", "updatedBy"]);
    expect(getRow("exm_marks", "p1__cand_s1")).toMatchObject({ theory: 70, internal: 18 });
    expect(getRow("exm_marks", "p1__cand_s1")).not.toHaveProperty("verified");
    await user.selectOptions(screen.getByLabelText("Tag for Aarav Sharma"), "Consistent");
    expect(getRow("exm_marks", "p1__cand_s1")).toMatchObject({ tag: "Consistent" });
  });

  it("clears the components when a student is marked absent and rejects out-of-range marks", async () => {
    base();
    seed({ exm_marks: [markDoc] });
    const { user } = renderUI(<MarksView />);
    await user.click(screen.getByRole("button", { name: "Open Mathematics · 10-B" }));
    await user.selectOptions(screen.getByLabelText("Exam attendance for Aarav Sharma"), "Medical Slip");
    expect(getRow("exm_marks", "p1__cand_s1")).toMatchObject({ status: "Medical Slip", theory: null, internal: null });
    expect(screen.getByLabelText("Theory marks for Aarav Sharma")).toBeDisabled();
    const before = writes.length;
    await user.type(screen.getByLabelText("Theory marks for Bina Das"), "95");
    await user.tab();
    expect(screen.getByText("Theory marks must be between 0 and 80")).toBeInTheDocument();
    expect(writes.length).toBe(before);
    expect(getRow("exm_marks", "p1__cand_s2")).toBeUndefined();
  });

  it("submits the sheet only when every rostered student is entered, writing the transition keys only", async () => {
    base({ status: "InProgress" });
    seed({ exm_marks: [markDoc] });
    const { user } = renderUI(<MarksView />);
    await user.click(screen.getByRole("button", { name: "Open Mathematics · 10-B" }));
    await user.click(screen.getByRole("button", { name: "Submit sheet" }));
    expect(await screen.findByText("1 of 2 students still pending: enter every component or mark them Absent.")).toBeInTheDocument();
    expect(getRow<Sheet>("exm_sheets", "p1__cls_10B")!.status).toBe("InProgress");
    await user.selectOptions(screen.getByLabelText("Exam attendance for Bina Das"), "Absent");
    await user.click(screen.getByRole("button", { name: "Submit sheet" }));
    expect(await screen.findByText("Mathematics · 10-B submitted")).toBeInTheDocument();
    const last = writes[writes.length - 1]!;
    expect(last).toMatchObject({ op: "update", coll: "exm_sheets", id: "p1__cls_10B" });
    expect(last.data).toEqual({ status: "Submitted", submittedAt: expect.any(String), submittedBy: "stf_1", updatedAt: expect.any(String), updatedBy: expect.any(String) });
    expect(screen.getByText("The sheet is read-only until the reviewer returns it to you.")).toBeInTheDocument();
    expect(screen.getByLabelText("Exam attendance for Aarav Sharma")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Submit sheet" })).not.toBeInTheDocument();
  });

  it("renders a grade-only sheet with the sheet's grade options", async () => {
    base({ components: { mode: "grade", theory: 0, practical: 0, internal: 0, passMarks: 0, gradeOptions: ["A", "B", "C"] } });
    const { user } = renderUI(<MarksView />);
    await user.click(screen.getByRole("button", { name: "Open Mathematics · 10-B" }));
    await user.selectOptions(screen.getByLabelText("Grade for Aarav Sharma"), "B");
    expect(getRow("exm_marks", "p1__cand_s1")).toMatchObject({ gradeValue: "B", theory: null, status: "Present" });
    expect(screen.queryByLabelText("Theory marks for Aarav Sharma")).not.toBeInTheDocument();
  });
});
