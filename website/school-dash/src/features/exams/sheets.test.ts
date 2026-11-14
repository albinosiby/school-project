import { describe, expect, it } from "vitest";
import { classResultActions, legacySubmission, noteError, sheetActions, sheetCounts, sheetId, sheetLockedMessage, type SheetStatus } from "./sheets";

const of = (...statuses: SheetStatus[]) => statuses.map((status) => ({ status }));

describe("sheet helpers", () => {
  it("names the admin actions of each status (contract transitions table)", () => {
    expect(sheetActions("NotStarted")).toEqual(["sheetSubmit"]);
    expect(sheetActions("InProgress")).toEqual(["sheetSubmit"]);
    expect(sheetActions("Returned")).toEqual(["sheetSubmit"]);
    expect(sheetActions("Submitted")).toEqual(["sheetApprove", "sheetReturn"]);
    expect(sheetActions("Approved")).toEqual(["sheetReopen"]);
    expect(sheetActions("Locked")).toEqual(["sheetReopen"]);
  });
  it("counts sheets per status; Approved and Locked both count as approved", () => {
    const counts = sheetCounts(of("NotStarted", "Submitted", "Approved", "Locked", "Locked"));
    expect(counts).toMatchObject({ NotStarted: 1, InProgress: 0, Submitted: 1, Returned: 0, Approved: 1, Locked: 2, total: 5, approved: 3 });
    expect(sheetCounts([])).toMatchObject({ total: 0, approved: 0 });
  });
  it("builds the sheet id and the locked message", () => {
    expect(sheetId("pap_1", "cls_10A")).toBe("pap_1__cls_10A");
    expect(sheetLockedMessage("Submitted")).toBe("Sheet is Submitted. Return or reopen it to edit marks.");
  });
  it("validates return notes and reopen reasons (5–2000 characters)", () => {
    expect(noteError("  ok ")).toBe("Enter at least 5 characters");
    expect(noteError("Please recheck roll 4")).toBe("");
    expect(noteError("x".repeat(2001))).toBe("Keep it under 2000 characters");
  });
});

describe("classResultActions", () => {
  const approvalRequired = { resultRules: { requireApproval: true } } as const;
  const noApproval = { resultRules: { requireApproval: false } } as const;
  const result = (status: "Compiled" | "Approved" | "Published" | "Superseded", stale = false) => ({ status, stale });

  it("offers Compile only when every sheet is Approved or Locked", () => {
    expect(classResultActions(undefined, approvalRequired, [])).toMatchObject({ canCompile: false, reason: "No mark sheets for this class yet" });
    expect(classResultActions(undefined, approvalRequired, of("Approved", "Submitted"))).toMatchObject({ canCompile: false, reason: "1 of 2 sheets approved" });
    expect(classResultActions(undefined, approvalRequired, of("Approved", "Locked"))).toMatchObject({ canCompile: true, canApprove: false, canPublish: false, canWithdraw: false, reason: "" });
  });
  it("walks Compiled → Approve → Publish when approval is required", () => {
    const sheets = of("Locked", "Locked");
    expect(classResultActions(result("Compiled"), approvalRequired, sheets)).toMatchObject({ canApprove: true, canPublish: false, canCompile: true });
    expect(classResultActions(result("Approved"), approvalRequired, sheets)).toMatchObject({ canApprove: false, canPublish: true });
    expect(classResultActions(result("Published"), approvalRequired, sheets)).toMatchObject({ canPublish: false, canWithdraw: true, canCompile: false });
  });
  it("publishes a Compiled result directly when the cycle does not require approval", () => {
    expect(classResultActions(result("Compiled"), noApproval, of("Locked"))).toMatchObject({ canApprove: false, canPublish: true });
    expect(classResultActions(result("Compiled"), {}, of("Locked"))).toMatchObject({ canApprove: true, canPublish: false }); // default: approval required
  });
  it("blocks approve/publish on a stale result and asks for a recompile; a reopened sheet blocks the recompile", () => {
    expect(classResultActions(result("Published", true), approvalRequired, of("Locked", "Locked"))).toMatchObject({ canCompile: true, canPublish: false, canApprove: false, canWithdraw: true });
    expect(classResultActions(result("Approved", true), approvalRequired, of("Locked", "Returned"))).toMatchObject({ canCompile: false, canPublish: false, reason: "1 of 2 sheets approved" });
    expect(classResultActions(result("Approved", true), approvalRequired, of("Locked", "Approved"))).toMatchObject({ canCompile: true, canPublish: false });
  });
});

describe("legacySubmission", () => {
  it("reads the sheet status first", () => {
    expect(legacySubmission({ status: "Submitted" }, { status: "Submitted" })).toMatchObject({ submitted: true, label: "Submitted", source: "sheet" });
    expect(legacySubmission({ status: "InProgress" }, { status: "Submitted" })).toMatchObject({ submitted: false, label: "In progress", source: "sheet" });
    expect(legacySubmission({ status: "Locked" })).toMatchObject({ submitted: true, label: "Locked" });
  });
  it("falls back to att_exam_state when there is no sheet", () => {
    expect(legacySubmission(undefined, { status: "Submitted" })).toMatchObject({ submitted: true, label: "Submitted", source: "legacy" });
    expect(legacySubmission(null, undefined)).toMatchObject({ submitted: false, label: "Not submitted", source: "legacy" });
  });
});
