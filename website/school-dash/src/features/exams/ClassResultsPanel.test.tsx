import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { ClassResultsPanel } from "./ClassResultsPanel";
import { callableCalls, dialog, field, renderUI, screen, seed, within } from "@/test/render";
import type { Candidate, Cycle, Paper } from "./types";
import type { ClassResult, Sheet, StudentResult } from "./sheets";

const cycle = { id: "c1", title: "Annual Examination", short: "Annual", status: "Live", start: "2026-11-01", end: "2026-11-10", grades: ["10"], resultRules: { requireApproval: true }, publicationTimezone: "Asia/Kolkata" } as Cycle;
const paper = { id: "p1", cycleId: "c1", subject: "English", code: "ENG", internalType: "Internal", invigilator: "", marksEntered: false, grade: "10", classIds: ["cls_10A"], date: "2026-11-02", start: "09:00", duration: 2, theory: 80, internal: 20, venue: "Hall 1", status: "Scheduled", published: [] } as Paper;
const candidate = { id: "cand_s1", studentId: "s1", name: "Student One", grn: "ADM1", grade: "10", section: "A", cls: "10-A", classId: "cls_10A", roll: "#10A-01" } as Candidate;
const sheet = (patch: Partial<Sheet>): Sheet => ({
  id: "p1__cls_10A", cycleId: "c1", paperId: "p1", classId: "cls_10A", classLabel: "10-A", subject: "English", grade: "10",
  components: { mode: "marks", theory: 80, practical: 0, internal: 20, passMarks: 33, gradeOptions: [] },
  ownerId: "stf_1", ownerName: "Meera Nair", reviewerId: "", rosterIds: ["s1"], status: "Approved", version: 1,
  summary: { total: 1, entered: 1, absent: 0, medical: 0, exempt: 0, outOfRange: 0, highest: 70, lowest: 70, mean: 70 }, needsRecheck: false, ...patch,
});
const classResult = (patch: Partial<ClassResult>): ClassResult => ({
  id: "c1__cls_10A", cycleId: "c1", classId: "cls_10A", classLabel: "10-A", status: "Compiled", version: 1, stale: false,
  students: 1, passed: 1, failed: 0, incomplete: 0, passPct: 100, compiledAt: "2026-11-12T08:00:00.000Z", sourceHash: "h", ...patch,
});
const mark = { id: "p1__cand_s1", paperId: "p1", candId: "cand_s1", studentId: "s1", classId: "cls_10A", theory: 60, internal: 15, medical: false, verified: true };
const last = () => callableCalls[callableCalls.length - 1]!;
const render = (c: Cycle = cycle) => renderUI(<ClassResultsPanel cycle={c} papers={[paper]} candidates={[candidate]} marks={[mark]} />);
const card = () => screen.getByRole("group", { name: "Class 10-A" });
const buttons = () => within(card()).queryAllByRole("button").map((b) => b.textContent);

describe("ClassResultsPanel", () => {
  it("shows Compile only once every sheet of the class is approved", async () => {
    seed({ exm_sheets: [sheet({}), sheet({ id: "p2__cls_10A", paperId: "p2", subject: "Hindi", status: "Submitted" })] });
    const { unmount } = render();
    expect(within(card()).getByText("1 / 2")).toBeInTheDocument();
    expect(within(card()).getByText("Not compiled")).toBeInTheDocument();
    expect(buttons()).toEqual(["10-A"]);
    expect(within(card()).getByText("1 of 2 sheets approved")).toBeInTheDocument();
    unmount();

    seed({ exm_sheets: [sheet({ id: "p2__cls_10A", paperId: "p2", subject: "Hindi", status: "Locked" })] });
    const { user } = render();
    await user.click(screen.getByRole("button", { name: "Compile" }));
    expect(await screen.findByText("10-A compiled; sheets locked")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "compile", cycleId: "c1", classId: "cls_10A" })]);
  });

  it("approves a compiled class (signOff) when the cycle requires approval, then publishes it", async () => {
    seed({ exm_sheets: [sheet({ status: "Locked" })], exm_class_results: [classResult({})] });
    const { user } = render();
    expect(within(card()).getByText("Compiled")).toBeInTheDocument();
    expect(within(card()).getByText("v1")).toBeInTheDocument();
    expect(buttons()).toEqual(["10-A", "Recompile", "Approve"]);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("10-A results approved")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "signOff", classId: "cls_10A" })]);
  });

  it("publishes an approved class immediately (no publishAt) or at a scheduled time (publishAt ISO in the cycle timezone)", async () => {
    seed({ exm_sheets: [sheet({ status: "Locked" })], exm_class_results: [classResult({ status: "Approved", approvedAt: "2026-11-12T09:00:00.000Z" })] });
    const { user } = render();
    expect(buttons()).toEqual(["10-A", "Recompile", "Publish…"]);
    await user.click(screen.getByRole("button", { name: "Publish…" }));
    let d = dialog("Publish 10-A results");
    await user.click(within(d).getByRole("button", { name: "Publish now" }));
    expect(await screen.findByText("10-A results published to parents")).toBeInTheDocument();
    expect(last()[1]).toEqual(expect.objectContaining({ action: "publishResults", classIds: ["cls_10A"] }));
    expect(last()[1]).not.toHaveProperty("publishAt");

    await user.click(screen.getByRole("button", { name: "Publish…" }));
    d = dialog("Publish 10-A results");
    fireEvent.change(field("Publish at", d), { target: { value: "2099-01-01T09:00" } });
    await user.click(within(d).getByRole("button", { name: "Schedule publication" }));
    expect(await screen.findByText(/10-A results scheduled for 2099-01-01 09:00/)).toBeInTheDocument();
    expect(last()[1]).toEqual(expect.objectContaining({ action: "publishResults", classIds: ["cls_10A"], publishAt: "2099-01-01T03:30:00.000Z" }));
  });

  it("publishes a compiled class directly when approval is not required, and never a stale one", () => {
    seed({ exm_sheets: [sheet({ status: "Locked" })], exm_class_results: [classResult({})] });
    const { unmount } = render({ ...cycle, resultRules: { ...cycle.resultRules!, requireApproval: false } });
    expect(buttons()).toEqual(["10-A", "Recompile", "Publish…"]);
    unmount();
    seed({ exm_class_results: [classResult({ status: "Approved", stale: true })] });
    render({ ...cycle, resultRules: { ...cycle.resultRules!, requireApproval: false } });
    expect(within(card()).getByText("Stale")).toBeInTheDocument();
    expect(buttons()).toEqual(["10-A", "Recompile"]);
  });

  it("withdraws a published class with a reason", async () => {
    seed({ exm_sheets: [sheet({ status: "Locked" })], exm_class_results: [classResult({ status: "Published", version: 2, publishedAt: "2026-11-12T10:00:00.000Z" })] });
    const { user } = render();
    expect(within(card()).getAllByText("Published")).toHaveLength(2); // status badge + "Published" timestamp label
    expect(within(card()).getByText("2026-11-12 10:00 UTC")).toBeInTheDocument();
    expect(within(card()).getByText("v2")).toBeInTheDocument();
    expect(buttons()).toEqual(["10-A", "Withdraw…"]);
    await user.click(screen.getByRole("button", { name: "Withdraw…" }));
    const d = dialog("Withdraw 10-A results");
    expect(within(d).getByRole("button", { name: "Withdraw results" })).toBeDisabled();
    await user.type(field("Reason", d), "Correction to Hindi marks pending");
    await user.click(within(d).getByRole("button", { name: "Withdraw results" }));
    expect(await screen.findByText("10-A results withdrawn")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "withdrawResults", classId: "cls_10A", reason: "Correction to Hindi marks pending" })]);
  });

  it("shows the selected class in the results grid with a Term so far column from exm_results.term.pct", () => {
    const result = { id: "c1__s1", cycleId: "c1", studentId: "s1", classId: "cls_10A", classLabel: "10-A", name: "Student One", grn: "ADM1", roll: "#10A-01", termId: "t1", examTypeId: "et1",
      subjects: [], total: 75, maximum: 100, pct: 75, grade: "B1", passed: true, complete: true, rank: null, status: "Compiled", version: 1, stale: false, compiledAt: "", compiledBy: "", sourceHash: "h",
      term: { termId: "t1", contributions: [{ cycleId: "c1", examTypeId: "et1", short: "Annual", weight: 60, pct: 75 }], pct: 72.5 } } as StudentResult;
    seed({ exm_sheets: [sheet({ status: "Locked" })], exm_class_results: [classResult({})], exm_results: [result] });
    render();
    expect(screen.getByText("Term so far")).toBeInTheDocument();
    expect(screen.getByText("72.5%")).toBeInTheDocument();
    expect((screen.getByLabelText("Result division") as HTMLSelectElement).value).toBe("10-A");
    expect(screen.getByText("Student One")).toBeInTheDocument();
  });

  it("explains that nothing can be compiled before marks entry is opened", () => {
    seed({});
    render();
    expect(screen.getByText("No classes to compile yet")).toBeInTheDocument();
  });
});
