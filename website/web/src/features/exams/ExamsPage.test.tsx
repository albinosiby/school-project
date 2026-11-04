import { describe, expect, it } from "vitest";
import { ExamsPage } from "./ExamsPage";
import { getRow, renderUI, screen, seed, writes, writesTo } from "@/test/render";

const cycle = { id: "cyc_1", title: "Term 2 Pre-Board Examinations 2026-27", short: "Term 2 Pre-Board", status: "Live", grades: ["10"], theoryMax: 80, internalMax: 20 };
const paper = {
  id: "pap_m10", cycleId: "cyc_1", grade: "10", subject: "Mathematics", code: "MATH-041", date: "2026-11-18", start: "09:00", duration: 2.5, theory: 80, internal: 20,
  internalType: "Internal", venue: "Hall 1", invigilator: "", status: "Scheduled", marksEntered: false, published: [] as string[], classIds: ["cls_10B"],
};
const students = [
  { id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200", grade: "10", section: "B", classId: "cls_10B", roll: 1, status: "Active" },
  { id: "stu_102", name: "Ananya Reddy", grn: "GIS-9201", grade: "10", section: "B", classId: "cls_10B", roll: 2, status: "Active" },
];
const assignments = [{ id: "asg_1", classId: "cls_10B", subject: "Mathematics", teacherId: "stf_025" }];
const base = (extra: Record<string, Record<string, unknown>[]> = {}) => seed({ exm_cycles: [cycle], exm_papers: [paper], students, assignments, ...extra });

const theory = (name: string) => screen.getByLabelText(`Theory marks for ${name}`) as HTMLInputElement;
const internal = (name: string) => screen.getByLabelText(`Internal marks for ${name}`) as HTMLInputElement;

describe("Marks entry", () => {
  it("lists generated candidates (cand_{studentId}, #10B-01) when the school has no exm_candidates yet", async () => {
    base();
    renderUI(<ExamsPage />);
    expect(screen.getByText("Aarav Sharma")).toBeInTheDocument();
    expect(screen.getByText("#10B-01 · GRN GIS-9200")).toBeInTheDocument();
    expect(screen.getByText("#10B-02 · GRN GIS-9201")).toBeInTheDocument();
  });

  it("rejects marks above the max and non-numbers, and writes nothing", async () => {
    base();
    const { user } = renderUI(<ExamsPage />);
    await user.type(theory("Aarav Sharma"), "81");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Theory marks must be between 0 and 80");
    await user.clear(internal("Ananya Reddy"));
    await user.type(internal("Ananya Reddy"), "7.5");
    await user.tab();
    expect(screen.getByText("Internal marks must be a whole number")).toBeInTheDocument();
    await user.clear(internal("Ananya Reddy"));
    await user.type(internal("Ananya Reddy"), "abc");
    await user.tab();
    expect(screen.getByText("Internal marks must be a whole number")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("does not write when a blank cell is left blank", async () => {
    base();
    const { user } = renderUI(<ExamsPage />);
    await user.click(theory("Aarav Sharma"));
    await user.tab();
    expect(writes).toHaveLength(0);
  });

  it("saves a valid mark in the shared shape: id {paperId}__cand_{studentId}, studentId, classId, subject teacher", async () => {
    base();
    const { user } = renderUI(<ExamsPage />);
    await user.type(theory("Aarav Sharma"), "74{Enter}");
    expect(getRow("exm_marks", "pap_m10__cand_stu_101")).toMatchObject({
      paperId: "pap_m10", candId: "cand_stu_101", studentId: "stu_101", classId: "cls_10B", teacherId: "stf_025", theory: 74, internal: null, medical: false, verified: false,
    });
    await user.type(internal("Aarav Sharma"), "18");
    await user.tab();
    expect(getRow("exm_marks", "pap_m10__cand_stu_101")).toMatchObject({ theory: 74, internal: 18 });
    expect(screen.getByText("92/100")).toBeInTheDocument();
    expect(writesTo("exm_marks")).toHaveLength(2);
  });

  it("backfills studentId / classId on a legacy mark without touching teacherId or theory", async () => {
    base({ exm_marks: [{ id: "pap_m10__cand_stu_101", paperId: "pap_m10", candId: "cand_stu_101", theory: 60, internal: null, medical: false, verified: false, teacherId: "stf_099" }] });
    const { user } = renderUI(<ExamsPage />);
    await user.type(internal("Aarav Sharma"), "15");
    await user.tab();
    const w = writesTo("exm_marks")[0];
    expect(w.op).toBe("update");
    expect(w.data).toMatchObject({ internal: 15, studentId: "stu_101", classId: "cls_10B" });
    expect(w.data).not.toHaveProperty("teacherId");
    expect(w.data).not.toHaveProperty("theory");
  });

  it("makes a locked paper read-only and refuses CSV imports", async () => {
    base({ exm_papers: [{ ...paper, locked: true }] });
    renderUI(<ExamsPage />);
    expect(theory("Aarav Sharma")).toBeDisabled();
    expect(internal("Ananya Reddy")).toBeDisabled();
    expect(screen.getByText("Marks entry is locked for this paper. Reopen it to edit marks.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reopen Marks Entry/ })).toBeInTheDocument();
  });

  it("locks the marks window (teachers are notified by the paper's locked flag)", async () => {
    base();
    const { user } = renderUI(<ExamsPage />);
    await user.click(screen.getByRole("button", { name: /Lock Marks Entry/ }));
    expect(getRow("exm_papers", "pap_m10")).toMatchObject({ locked: true });
    expect(await screen.findByText("Marks entry locked for Mathematics; teachers notified")).toBeInTheDocument();
  });
});

describe("Publish", () => {
  const mark = (sid: string, p: Record<string, unknown>) => ({ id: `pap_m10__cand_${sid}`, paperId: "pap_m10", candId: `cand_${sid}`, studentId: sid, theory: null, internal: null, medical: false, verified: false, ...p });

  it("refuses while a candidate has no marks", async () => {
    base({ exm_marks: [mark("stu_101", { theory: 70, internal: 18 })] });
    const { user } = renderUI(<ExamsPage />);
    await user.click(screen.getByRole("button", { name: /Save & Publish Report Cards/ }));
    expect(await screen.findByText("1 candidate still has no marks")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("refuses while a stored mark is out of range", async () => {
    base({ exm_marks: [mark("stu_101", { theory: 95, internal: 18 }), mark("stu_102", { theory: 50, internal: 10 })] });
    const { user } = renderUI(<ExamsPage />);
    await user.click(screen.getByRole("button", { name: /Save & Publish Report Cards/ }));
    expect(await screen.findByText("Resolve 1 invalid mark entry first")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("verifies the marks and adds the class label \"10-B\" (an absent candidate does not block)", async () => {
    base({ exm_marks: [mark("stu_101", { theory: 70, internal: 18 }), mark("stu_102", { theory: null, status: "Absent", teacherId: "stf_025" })] });
    const { user } = renderUI(<ExamsPage />);
    expect(screen.getByText("Absent")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Save & Publish Report Cards/ }));
    expect(await screen.findByText("Report cards published for Grade 10-B · Mathematics")).toBeInTheDocument();
    expect(getRow("exm_papers", "pap_m10")).toMatchObject({ published: ["10-B"], marksEntered: true, status: "Completed" });
    expect(getRow("exm_marks", "pap_m10__cand_stu_101")).toMatchObject({ verified: true });
    expect(getRow("exm_marks", "pap_m10__cand_stu_102")).toMatchObject({ verified: false, status: "Absent" });
    expect(screen.getByRole("button", { name: /Published/ })).toBeDisabled();
  });

  it("editing a mark of a published class unpublishes that class only", async () => {
    base({ exm_papers: [{ ...paper, published: ["10-A", "10-B"] }], exm_marks: [mark("stu_101", { theory: 70, internal: 18, verified: true })] });
    const { user } = renderUI(<ExamsPage />);
    await user.clear(theory("Aarav Sharma"));
    await user.type(theory("Aarav Sharma"), "72");
    await user.tab();
    expect(getRow("exm_papers", "pap_m10")).toMatchObject({ published: ["10-A"] });
  });
});
