import { describe, expect, it } from "vitest";
import { SheetBoard } from "./SheetBoard";
import { callableCalls, dialog, field, renderUI, screen, seed, within } from "@/test/render";
import type { Cycle } from "./types";
import type { Sheet } from "./sheets";

const cycle = { id: "c1", title: "Annual Examination", short: "Annual", status: "Live", start: "2026-11-01", end: "2026-11-10", grades: ["10"] } as Cycle;
const staff = [{ id: "stf_1", name: "Meera Nair" }, { id: "stf_2", name: "Rahul Verma" }];
const sheet = (patch: Partial<Sheet>): Sheet => ({
  id: "p1__cls_10A", cycleId: "c1", paperId: "p1", classId: "cls_10A", classLabel: "10-A", subject: "English", grade: "10",
  components: { mode: "marks", theory: 80, practical: 0, internal: 20, passMarks: 33, gradeOptions: [] },
  ownerId: "stf_1", ownerName: "Meera Nair", reviewerId: "", rosterIds: ["s1", "s2"], status: "NotStarted", version: 1,
  summary: { total: 2, entered: 0, absent: 0, medical: 0, exempt: 0, outOfRange: 0, highest: null, lowest: null, mean: null }, needsRecheck: false, ...patch,
});
const last = () => callableCalls[callableCalls.length - 1]!;

describe("SheetBoard", () => {
  it("offers to open marks entry when the cycle has no sheets and calls openEntry", async () => {
    seed({ exm_cycles: [cycle], staff });
    const { user } = renderUI(<SheetBoard cycle={cycle} />);
    expect(screen.getByText("No mark sheets yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open marks entry" }));
    expect(await screen.findByText(/Marks entry opened for Annual Examination/)).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "openEntry", cycleId: "c1" })]);
  });

  it("lists sheets of this cycle only, with status counts, summary and the owner", () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [
      sheet({ status: "InProgress", summary: { total: 2, entered: 1, absent: 1, medical: 0, exempt: 0, outOfRange: 1, highest: 70, lowest: 70, mean: 70 } }),
      sheet({ id: "p2__cls_10A", paperId: "p2", subject: "Hindi", status: "Submitted", submittedAt: "2026-11-11T09:30:00.000Z" }),
      sheet({ id: "other", cycleId: "c2", subject: "Other cycle" }),
    ] });
    renderUI(<SheetBoard cycle={cycle} />);
    expect(screen.queryByRole("button", { name: "Open marks entry" })).not.toBeInTheDocument();
    expect(screen.getByText("1 in progress")).toBeInTheDocument();
    expect(screen.getByText("1 submitted")).toBeInTheDocument();
    expect(screen.getByText("English · 10-A")).toBeInTheDocument();
    expect(screen.queryByText("Other cycle · 10-A")).not.toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    expect(screen.getByText("2026-11-11 09:30")).toBeInTheDocument();
    expect((screen.getByLabelText("Owner of English · 10-A") as HTMLSelectElement).value).toBe("stf_1");
  });

  it("reassigns the owner through sheetAssign", async () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [sheet({})] });
    const { user } = renderUI(<SheetBoard cycle={cycle} />);
    await user.selectOptions(screen.getByLabelText("Owner of English · 10-A"), "stf_2");
    expect(await screen.findByText("English · 10-A assigned to Rahul Verma")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "sheetAssign", sheetId: "p1__cls_10A", ownerId: "stf_2" })]);
  });

  it("submits on behalf of the owner for an open sheet", async () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [sheet({ status: "Returned", returnNote: "Roll 4 missing" })] });
    const { user } = renderUI(<SheetBoard cycle={cycle} />);
    expect(screen.getByText("Roll 4 missing")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit on behalf" }));
    expect(await screen.findByText("English · 10-A submitted")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "sheetSubmit", sheetId: "p1__cls_10A" })]);
  });

  it("approves a submitted sheet and returns it with a note of at least 5 characters", async () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [sheet({ status: "Submitted" })] });
    const { user } = renderUI(<SheetBoard cycle={cycle} />);
    expect(screen.queryByRole("button", { name: "Submit on behalf" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("English · 10-A approved; owner notified")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "sheetApprove", sheetId: "p1__cls_10A" })]);

    await user.click(screen.getByRole("button", { name: "Return…" }));
    const d = dialog("Return sheet to the owner");
    await user.type(field("Note to the owner", d), "abc");
    expect(within(d).getByRole("button", { name: "Return sheet" })).toBeDisabled();
    expect(within(d).getByText("Enter at least 5 characters")).toBeInTheDocument();
    await user.type(field("Note to the owner", d), " please recheck roll 4");
    await user.click(within(d).getByRole("button", { name: "Return sheet" }));
    expect(await screen.findByText("English · 10-A returned to Meera Nair")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "sheetReturn", sheetId: "p1__cls_10A", note: "abc please recheck roll 4" })]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reopens an approved or locked sheet with a reason; a locked sheet cannot be reassigned", async () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [sheet({ status: "Locked", version: 2 })] });
    const { user } = renderUI(<SheetBoard cycle={cycle} />);
    expect(screen.getByLabelText("Owner of English · 10-A")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Reopen…" }));
    const d = dialog("Reopen approved sheet");
    expect(d).toHaveTextContent("version 3");
    await user.type(field("Reason", d), "Totalling error in theory marks");
    await user.click(within(d).getByRole("button", { name: "Reopen sheet" }));
    expect(await screen.findByText("English · 10-A reopened for correction")).toBeInTheDocument();
    expect(last()).toEqual(["manageExamination", expect.objectContaining({ action: "sheetReopen", sheetId: "p1__cls_10A", reason: "Totalling error in theory marks" })]);
  });

  it("reports a selected row to the parent", async () => {
    seed({ exm_cycles: [cycle], staff, exm_sheets: [sheet({})] });
    const picked: Sheet[] = [];
    const { user } = renderUI(<SheetBoard cycle={cycle} onSelect={(s) => picked.push(s)} />);
    await user.click(screen.getByText("English · 10-A"));
    expect(picked.map((s) => s.id)).toEqual(["p1__cls_10A"]);
  });
});
