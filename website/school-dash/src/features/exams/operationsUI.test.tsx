import { describe, expect, it } from "vitest";
import { ExamDetailPage } from "./ExamDetailPage";
import { ScheduleManager } from "./ScheduleManager";
import { ReportCards } from "./ReportCards";
import { markFingerprint } from "../../../../functions/examAssessment";
import { callableCalls, dialog, field, renderUI, screen, seed, setUrl, within } from "@/test/render";
import type { Candidate, Cycle, Mark, Paper } from "./types";

const cycle = { id: "c1", title: "Annual Examination", academicYear: "2026-27", start: "2026-12-01", end: "2026-12-10", status: "Scheduled", publicationState: "published", resultRules: { requireApproval: true } } as Cycle;
const paper = { id: "p1", cycleId: "c1", subject: "English", code: "ENG", internalType: "Internal", invigilator: "", marksEntered: false, grade: "10", classIds: ["cls_10A"], studentIds: ["s1"], date: "2026-12-02", start: "09:00", duration: 2, theory: 80, internal: 20, venue: "Hall 1", status: "Scheduled", published: [], setupVersion: 1, setupPublished: true } as Paper;
const candidate = { id: "cand_s1", studentId: "s1", name: "Student One", grn: "ADM1", grade: "10", section: "A", cls: "10-A", classId: "cls_10A", roll: "1" } as Candidate;
function base() { seed({ exm_cycles: [cycle], exm_papers: [paper], exm_candidates: [candidate], classes: [{ id: "cls_10A", grade: "10", section: "A" }] }); }

describe("Examination operations", () => {
  it("opens the dedicated cycle workspace with all ten operational tabs", () => {
    base(); setUrl("/exams/c1", { id: "c1" }); renderUI(<ExamDetailPage />);
    expect(screen.getByRole("heading", { name: "Annual Examination" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(10);
    expect(screen.getByRole("tab", { name: "Reports" })).toBeInTheDocument();
    expect(screen.getByRole("tabpanel", { name: "Overview" })).toBeInTheDocument();
  });
  it("shows the workflow stage from exm_cycles.stage and offers Open marks entry after the last paper date", async () => {
    seed({ exm_cycles: [{ ...cycle, end: "2026-01-10", start: "2026-01-01", stage: "scheduled" }], exm_papers: [paper], exm_candidates: [candidate] });
    setUrl("/exams/c1", { id: "c1" }); const { user } = renderUI(<ExamDetailPage />);
    expect(screen.getByText("Scheduled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open marks entry" }));
    expect(await screen.findByText(/Marks entry opened for Annual Examination/)).toBeInTheDocument();
    expect(callableCalls[0]).toEqual(["manageExamination", expect.objectContaining({ action: "openEntry", cycleId: "c1" })]);
  });
  it("hides the shortcut once sheets exist and reads Teacher submission from the sheet, not att_exam_state", () => {
    const sheet = { id: "p1__cls_10A", cycleId: "c1", paperId: "p1", classId: "cls_10A", classLabel: "10-A", subject: "English", grade: "10", ownerId: "stf_9", ownerName: "Sheet Owner", status: "Returned", version: 1, rosterIds: ["s1"],
      summary: { total: 1, entered: 0, absent: 0, medical: 0, exempt: 0, outOfRange: 0, highest: null, lowest: null, mean: null } };
    seed({ exm_cycles: [{ ...cycle, end: "2026-01-10", start: "2026-01-01", stage: "entry" }], exm_papers: [paper], exm_candidates: [candidate], exm_sheets: [sheet], att_exam_state: [{ id: "p1@cls_10A", status: "Submitted" }] });
    setUrl("/exams/c1", { id: "c1" }); renderUI(<ExamDetailPage />);
    expect(screen.getByText("Marks entry open")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open marks entry" })).not.toBeInTheDocument();
    expect(screen.getByText("Returned")).toBeInTheDocument();
    expect(screen.queryByText("Submitted")).not.toBeInTheDocument();
    expect(screen.getByText("Sheet Owner")).toBeInTheDocument();
  });
  it("shows only included participants in the cycle participant tab", () => {
    base(); seed({ exm_candidates: [{ ...candidate, id: "cand_excluded", studentId: "excluded", name: "Excluded Student" }] });
    setUrl("/exams/c1?tab=participants", { id: "c1" }); renderUI(<ExamDetailPage />);
    expect(screen.getByText("Student One")).toBeInTheDocument(); expect(screen.queryByText("Excluded Student")).not.toBeInTheDocument();
  });
  it("requires a reason, then sends a revision-checked postponement to the server", async () => {
    base(); const { user } = renderUI(<ScheduleManager cycle={cycle} papers={[paper]} allPapers={[paper]} />);
    await user.click(screen.getByRole("button", { name: "Change schedule" }));
    const d = dialog("Change paper schedule");
    await user.selectOptions(field("Action", d), "Postponed");
    await user.click(within(d).getByRole("button", { name: "Confirm change" }));
    expect(within(d).getByRole("alert")).toHaveTextContent("reason"); expect(callableCalls).toHaveLength(0);
    await user.type(field("Reason", d), "School closed due to flooding");
    await user.click(within(d).getByRole("button", { name: "Confirm change" }));
    expect(await screen.findByText("Examination postponed; history saved")).toBeInTheDocument();
    expect(callableCalls[0]).toEqual(["manageExamination", expect.objectContaining({ action: "schedule", cycleId: "c1", changes: [expect.objectContaining({ paperId: "p1", revision: 0, scheduleStatus: "Postponed" })] })]);
  });
  it("disables consolidated preview until the source marks are verified", () => {
    base(); renderUI(<ReportCards cycle={cycle} papers={[paper]} candidates={[candidate]} marks={[]} />);
    expect(screen.getByRole("button", { name: "Generate result preview" })).toBeDisabled();
    expect(screen.getByText("0 / 1 students ready")).toBeInTheDocument();
  });
  it("enables a preview for complete verified marks without publishing subject results", async () => {
    base(); const mark = { id: "m1", paperId: "p1", candId: "cand_s1", theory: 60, internal: 15, verified: true, medical: false } as Mark;
    mark.verificationFingerprint = markFingerprint(mark, paper);
    const { user } = renderUI(<ReportCards cycle={cycle} papers={[paper]} candidates={[candidate]} marks={[mark]} />);
    await user.click(screen.getByRole("button", { name: "Generate result preview" }));
    expect(await screen.findByText("Report workflow updated")).toBeInTheDocument();
    expect(callableCalls[0]).toEqual(["manageExamination", expect.objectContaining({ action: "prepare", classId: "cls_10A" })]);
  });
});
