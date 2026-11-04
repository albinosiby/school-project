import { describe, expect, it } from "vitest";
import { ApprovalsView } from "./ApprovalsView";
import { ADMIN_UID, dialog, failNextWrite, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const leave = { id: "lv1", staffId: "stf_025", type: "Casual Leave", from: "2026-11-10", to: "2026-11-11", days: 2, reason: "Family function", status: "Pending" };
// the mirror row (contract 9): id lv_{leaveId}, kind leave, source staff_leaves, status pending
const mirror = { id: "lv_lv1", requester: "Mrs. Anita Sharma", ref: "LV-LV1", kind: "leave", dept: "Mathematics", title: "Casual Leave", detail: "2 days · 2026-11-10 to 2026-11-11",
  remark: "Family function", submitted: "2026-11-02T09:00:00", urgency: "Standard", tone: "neutral", status: "pending", source: "staff_leaves", sourceId: "lv1" };
const fee = { id: "ap_fee", requester: "Accounts", ref: "FC-1", kind: "fee", dept: "Accounts", title: "Fee concession", detail: "Sibling waiver", remark: "—",
  submitted: "2026-11-02T09:00:00", urgency: "High", tone: "warning", status: "pending" };

function setup(extra: Record<string, Record<string, unknown>[]> = {}) {
  seed({ staff: [{ id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics", status: "Active" }], staff_leaves: [leave], approvals: [mirror, fee], ...extra });
  return renderUI(<ApprovalsView />);
}
const rowOf = (text: string) => screen.getAllByText(text).map((e) => e.closest("tr")).find(Boolean) as HTMLElement;

describe("Approvals: deciding a staff leave mirror", () => {
  it("Authorize updates the leave (Approved, decidedBy, decidedAt) and then the mirror row", async () => {
    const { user } = setup();
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Authorize" }));
    expect(await screen.findByText("Request approved")).toBeInTheDocument();
    const l = getRow<Record<string, unknown>>("staff_leaves", "lv1")!;
    expect(l).toMatchObject({ status: "Approved", decidedBy: ADMIN_UID, decisionNote: "", updatedBy: ADMIN_UID });
    expect(String(l.decidedAt)).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(getRow("approvals", "lv_lv1")).toMatchObject({ status: "approved", reason: "" });
    // source first, then the mirror
    expect(writes.map((w) => `${w.coll}/${w.id}`)).toEqual(["staff_leaves/lv1", "approvals/lv_lv1"]);
  });

  it("Reject needs a reason of at least 5 characters and writes nothing until then", async () => {
    const { user } = setup();
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Reject" }));
    const d = dialog("Reject request");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(fieldError("Reason for rejection", d)).toBe("Please enter at least 5 characters.");
    await user.type(field("Reason for rejection", d), "  no ");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(fieldError("Reason for rejection", d)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
  });

  it("a valid rejection stores the reason on the leave (decisionNote) and on the mirror", async () => {
    const { user } = setup();
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Reject" }));
    const d = dialog("Reject request");
    await user.type(field("Reason for rejection", d), "  Exam week, please reschedule  ");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("Request rejected")).toBeInTheDocument();
    expect(getRow("staff_leaves", "lv1")).toMatchObject({ status: "Rejected", decisionNote: "Exam week, please reschedule", decidedBy: ADMIN_UID });
    expect(getRow("approvals", "lv_lv1")).toMatchObject({ status: "rejected", reason: "Exam week, please reschedule" });
    expect(screen.queryByRole("dialog", { name: "Reject request" })).not.toBeInTheDocument();
  });

  it("a refused leave write leaves the approval pending and keeps the reject dialog open", async () => {
    const { user } = setup();
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Reject" }));
    const d = dialog("Reject request");
    await user.type(field("Reason for rejection", d), "Not this week");
    failNextWrite(new Error("Firebase: Missing or insufficient permissions."));
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("1 request could not be rejected: Missing or insufficient permissions.")).toBeInTheDocument();
    expect(getRow("staff_leaves", "lv1")).toMatchObject({ status: "Pending" });
    expect(getRow("approvals", "lv_lv1")).toMatchObject({ status: "pending" });
    expect(writes).toHaveLength(0);
    expect(dialog("Reject request")).toBeInTheDocument();
  });

  it("a leave the teacher already withdrew is not recreated; only the approval is decided", async () => {
    seed({ staff: [], approvals: [mirror] });
    const { user } = renderUI(<ApprovalsView />);
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Authorize" }));
    expect(await screen.findByText("Request approved")).toBeInTheDocument();
    expect(writesTo("staff_leaves")).toHaveLength(0);
    expect(getRow("approvals", "lv_lv1")).toMatchObject({ status: "approved" });
  });

  it("a non-mirror approval only updates itself; Reopen moves a decided leave back to Pending", async () => {
    const { user } = setup();
    await user.click(within(rowOf("Accounts")).getByRole("button", { name: "Authorize" }));
    expect(await screen.findByText("Request approved")).toBeInTheDocument();
    expect(writes.map((w) => w.coll)).toEqual(["approvals"]);
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Authorize" }));
    await user.selectOptions(screen.getByLabelText("Status"), "approved");
    await user.click(within(rowOf("Mrs. Anita Sharma")).getByRole("button", { name: "Reopen" }));
    expect(await screen.findByText("Request moved back to pending")).toBeInTheDocument();
    expect(getRow("staff_leaves", "lv1")).toMatchObject({ status: "Pending", decidedBy: "", decidedAt: "", decisionNote: "" });
    expect(getRow("approvals", "lv_lv1")).toMatchObject({ status: "pending", reason: "", decidedAt: "" });
  });
});

describe("Approvals: batch, clarification and routing policies", () => {
  it("batch reject applies the same reason to every selected row", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("checkbox", { name: /select all/i }));
    await user.click(screen.getByRole("button", { name: /Batch Reject/ }));
    const d = dialog("Batch reject requests");
    await user.type(field("Reason for rejection", d), "Budget freeze");
    await user.click(within(d).getByRole("button", { name: "Reject" }));
    expect(await screen.findByText("2 requests rejected")).toBeInTheDocument();
    expect(getRow("approvals", "ap_fee")).toMatchObject({ status: "rejected", reason: "Budget freeze" });
    expect(getRow("staff_leaves", "lv1")).toMatchObject({ status: "Rejected", decisionNote: "Budget freeze" });
  });

  it("clarification needs 5 characters before it can be sent", async () => {
    const { user } = setup();
    await user.click(screen.getByRole("checkbox", { name: /select all/i }));
    await user.click(screen.getByRole("button", { name: /Request Clarification/ }));
    const d = dialog("Request clarification");
    const send = within(d).getByRole("button", { name: "Send request" });
    expect(send).toBeDisabled();
    await user.type(field("Message to requester(s)", d), "abc");
    expect(send).toBeDisabled();
    await user.type(field("Message to requester(s)", d), "de");
    await user.click(send);
    expect(await screen.findByText("Clarification request sent")).toBeInTheDocument();
    expect(getRow("approvals", "ap_fee")).toMatchObject({ clarification: "abcde", status: "pending" });
    expect(writesTo("notifications")[0]?.data).toMatchObject({ category: "approvals", href: "/approvals", read: false });
  });

  it("toggling a routing policy writes only `enabled`", async () => {
    const { user } = setup({ approval_policies: [{ id: "pol_1", title: "Marks edit endorsement", body: "HOD first", enabled: true }] });
    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("switch", { name: "Toggle Marks edit endorsement" }));
    expect(await screen.findByText("Policy disabled")).toBeInTheDocument();
    expect(writesTo("approval_policies")).toEqual([expect.objectContaining({ op: "update", id: "pol_1", data: expect.objectContaining({ enabled: false }) })]);
  });
});
