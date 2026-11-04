import { describe, expect, it } from "vitest";
import { StaffLeavesPanel } from "./StaffLeavesPanel";
import { dialog, failNextWrite, field, fieldError, getRow, renderUI, screen, seed, waitForWrites, within, writes } from "./staffTestUtils";

const staff = [{ id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" }];
const pending = { id: "lvA1", staffId: "stf_025", type: "Casual Leave", from: "2026-11-02", to: "2026-11-03", days: 2, reason: "Family function", status: "Pending", createdAt: "2026-10-30T09:15:00.000Z" };

describe("Staff leave decisions", () => {
  it("backfills the approvals mirror of a pending leave (contract 9)", async () => {
    seed({ staff, staff_leaves: [pending] });
    renderUI(<StaffLeavesPanel staff={staff} />);
    await waitForWrites(1);
    expect(getRow("approvals", "lv_lvA1")).toMatchObject({ kind: "leave", source: "staff_leaves", sourceId: "lvA1", status: "pending", requester: "Mrs. Anita Sharma" });
  });

  it("Approve updates the leave and its mirror", async () => {
    seed({ staff, staff_leaves: [pending], approvals: [{ id: "lv_lvA1", kind: "leave", source: "staff_leaves", sourceId: "lvA1", status: "pending" }] });
    const { user } = renderUI(<StaffLeavesPanel staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(getRow("staff_leaves", "lvA1")).toMatchObject({ status: "Approved", decidedBy: "admin_uid", decisionNote: "" });
    expect(String(getRow<{ decidedAt: string }>("staff_leaves", "lvA1")?.decidedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(getRow("approvals", "lv_lvA1")).toMatchObject({ status: "approved" });
    expect(await screen.findByText("Leave approved")).toBeInTheDocument();
  });

  it("Reject needs a reason of 5+ characters and writes nothing until then", async () => {
    seed({ staff, staff_leaves: [pending], approvals: [{ id: "lv_lvA1", kind: "leave", source: "staff_leaves", sourceId: "lvA1", status: "pending" }] });
    const { user } = renderUI(<StaffLeavesPanel staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dlg = dialog("Reject leave request");
    await user.type(field("Reason for rejection", dlg), "no");
    await user.click(within(dlg).getByRole("button", { name: "Reject" }));
    expect(fieldError("Reason for rejection", dlg)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
    await user.type(field("Reason for rejection", dlg), "t during exams");
    await user.click(within(dlg).getByRole("button", { name: "Reject" }));
    expect(getRow("staff_leaves", "lvA1")).toMatchObject({ status: "Rejected", decisionNote: "not during exams" });
    expect(getRow("approvals", "lv_lvA1")).toMatchObject({ status: "rejected", reason: "not during exams" });
  });

  it("creates the mirror when deciding a leave that has none", async () => {
    seed({ staff, staff_leaves: [{ ...pending, status: "Approved" }] });
    const { user } = renderUI(<StaffLeavesPanel staff={staff} />);
    await user.click(screen.getByRole("tab", { name: /Approved/ }));
    await user.click(screen.getByRole("button", { name: "Reopen" }));
    expect(getRow("staff_leaves", "lvA1")).toMatchObject({ status: "Pending", decidedBy: "", decidedAt: "" });
    expect(getRow("approvals", "lv_lvA1")).toMatchObject({ status: "pending", source: "staff_leaves" });
  });

  it("shows an error toast when the write is refused", async () => {
    seed({ staff, staff_leaves: [pending], approvals: [{ id: "lv_lvA1", kind: "leave", source: "staff_leaves", sourceId: "lvA1", status: "pending" }] });
    const { user } = renderUI(<StaffLeavesPanel staff={staff} />);
    failNextWrite();
    await user.click(screen.getByRole("button", { name: "Approve" }));
    expect(await screen.findByText("Could not save the decision")).toBeInTheDocument();
    expect(getRow("staff_leaves", "lvA1")).toMatchObject({ status: "Pending" });
  });
});
