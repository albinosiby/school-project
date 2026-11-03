import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { CheckinsPanel } from "./CheckinsPanel";
import { dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "./staffTestUtils";

const staff = [
  { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics" },
  { id: "stf_008", name: "Mr. Rahul Verma", department: "Science" },
  { id: "stf_100", name: "Ms. Office Clerk", department: "Administration" },
];
const day = "2026-11-04";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 4, 11)); });
afterEach(() => { vi.useRealTimers(); });

const row = (name: string) => screen.getByRole("cell", { name: new RegExp(name) }).closest("tr")!;

describe("Check-ins day view", () => {
  it("derives Late from the policy time and On leave from an approved leave", () => {
    seed({
      set_leave_policy: [{ id: "policy", types: [], checkInBy: "08:00" }],
      staff_attendance: [{ id: `${day}_stf_025`, staffId: "stf_025", teacherId: "stf_025", date: day, in: "08:05", out: null, status: "Present", source: "app" }],
      staff_leaves: [{ id: "l1", staffId: "stf_008", type: "Casual Leave", from: day, to: day, days: 1, status: "Approved" }],
    });
    renderUI(<CheckinsPanel staff={staff} />);
    expect(within(row("Anita Sharma")).getByText("Late")).toBeInTheDocument();
    expect(within(row("Rahul Verma")).getByText("On leave")).toBeInTheDocument();
    expect(screen.queryByText("Ms. Office Clerk")).not.toBeInTheDocument(); // administration is not on the teaching roll
  });
});

describe("Correct check-in", () => {
  async function open(name = "Rahul Verma") {
    seed({ staff_attendance: [{ id: `${day}_stf_025`, staffId: "stf_025", teacherId: "stf_025", date: day, in: "08:05", out: "15:00", status: "Present", source: "app", extra: "kept" }] });
    const r = renderUI(<CheckinsPanel staff={staff} />);
    await r.user.click(within(row(name)).getByRole("button", { name: /Correct/ }));
    return { ...r, dlg: dialog("Correct check-in") };
  }

  it("requires the check-in time for a Present day", async () => {
    const { user, dlg } = await open();
    await user.click(within(dlg).getByRole("button", { name: "Save correction" }));
    expect(fieldError("Check-in", dlg)).toBe("Enter the check-in time");
    expect(writes).toHaveLength(0);
  });

  it("refuses a check-out that is not after the check-in", async () => {
    const { user, dlg } = await open();
    fireEvent.change(field("Check-in", dlg), { target: { value: "09:00" } });
    fireEvent.change(field("Check-out", dlg), { target: { value: "08:30" } });
    await user.click(within(dlg).getByRole("button", { name: "Save correction" }));
    expect(fieldError("Check-out", dlg)).toBe("Check-out must be after check-in");
    expect(writes).toHaveLength(0);
  });

  it("creates the admin day doc {date}_{staffId} with source admin and a derived Late status", async () => {
    const { user, dlg } = await open();
    fireEvent.change(field("Check-in", dlg), { target: { value: "08:40" } });
    await user.selectOptions(field("Status", dlg), "Present");
    await user.type(field("Note", dlg), "Biometric down");
    await user.click(within(dlg).getByRole("button", { name: "Save correction" }));
    expect(getRow("staff_attendance", `${day}_stf_008`)).toMatchObject({ staffId: "stf_008", teacherId: "stf_008", date: day, in: "08:40", out: null, status: "Late", note: "Biometric down", source: "admin" });
    expect(await screen.findByText("Check-in corrected")).toBeInTheDocument();
  });

  it("updates an existing teacher-app day, keeping the app's other fields", async () => {
    const { user, dlg } = await open("Anita Sharma");
    await user.selectOptions(field("Status", dlg), "Leave");
    await user.click(within(dlg).getByRole("button", { name: "Save correction" }));
    expect(writesTo("staff_attendance")[0]?.op).toBe("update");
    expect(getRow("staff_attendance", `${day}_stf_025`)).toMatchObject({ in: null, out: null, status: "Leave", source: "admin", extra: "kept" });
  });
});

describe("Regularization requests", () => {
  const reg = { id: "reg1", staffId: "stf_025", teacherId: "stf_025", date: "2026-11-03", type: "Check-out", time: "15:40", reason: "Forgot to punch", status: "Pending", at: "2026-11-03T16:00:00" };
  const base = { staff_regularizations: [reg], approvals: [{ id: "rg_reg1", kind: "attendance", source: "staff_regularizations", sourceId: "reg1", status: "pending" }],
    staff_attendance: [{ id: "2026-11-03_stf_025", staffId: "stf_025", teacherId: "stf_025", date: "2026-11-03", in: "08:00", out: null, status: "Present", source: "app" }] };

  it("Reject needs a reason and writes nothing until given", async () => {
    seed(base);
    const { user } = renderUI(<CheckinsPanel staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Reject" }));
    const dlg = dialog("Reject regularization");
    await user.click(within(dlg).getByRole("button", { name: "Reject" }));
    expect(fieldError("Reason for rejection", dlg)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
    await user.type(field("Reason for rejection", dlg), "No proof given");
    await user.click(within(dlg).getByRole("button", { name: "Reject" }));
    expect(getRow("staff_regularizations", "reg1")).toMatchObject({ status: "Rejected", decisionNote: "No proof given", decidedBy: "admin_uid" });
    expect(getRow("approvals", "rg_reg1")).toMatchObject({ status: "rejected" });
    expect(getRow("staff_attendance", "2026-11-03_stf_025")).toMatchObject({ out: null }); // untouched
  });

  it("Approve fixes that day's check-out and marks it Present (contract 12.1)", async () => {
    seed(base);
    const { user } = renderUI(<CheckinsPanel staff={staff} />);
    await user.click(screen.getByRole("button", { name: "Approve" }));
    await user.click(within(dialog("Approve regularization")).getByRole("button", { name: "Approve" }));
    expect(getRow("staff_regularizations", "reg1")).toMatchObject({ status: "Approved" });
    expect(getRow("staff_attendance", "2026-11-03_stf_025")).toMatchObject({ in: "08:00", out: "15:40", status: "Present", source: "admin", note: "Regularized (Check-out: Forgot to punch)" });
    expect(getRow("approvals", "rg_reg1")).toMatchObject({ status: "approved" });
  });
});
