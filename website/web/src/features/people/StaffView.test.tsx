import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { StaffView } from "./StaffView";
import { authAccounts, dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, sentInvites, within, writes, writesTo } from "@/test/render";

const anita = { id: "stf_025", name: "Mrs. Anita Sharma", empId: "EMP-1025", department: "Mathematics", role: "TGT", status: "Active", phone: "+91 98100 00025", email: "anita.sharma@greenfield.edu", authUid: "uid_anita" };

async function openAdd() {
  const r = renderUI(<StaffView />);
  await r.user.click(screen.getByRole("button", { name: /Add Staff/ }));
  return r;
}

describe("Staff form validation", () => {
  it("shows the required-field errors and writes nothing", async () => {
    const { user } = await openAdd();
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Full name")).toBe("Name is required");
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(fieldError("Email (teacher login)")).toBe("A valid email is required (it is the teacher's login)");
    expect(writes).toHaveLength(0);
  });

  it("rejects a malformed phone and email", async () => {
    const { user } = await openAdd();
    await user.type(field("Full name"), "Ravi Kumar");
    await user.type(field("Phone"), "12ab");
    await user.type(field("Email (teacher login)"), "ravi@school");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Phone")).toBe("Enter a valid phone number");
    expect(fieldError("Email (teacher login)")).toBe("A valid email is required (it is the teacher's login)");
    expect(writes).toHaveLength(0);
  });

  it("rejects an email or employee ID another staff member uses (case-insensitive)", async () => {
    seed({ staff: [anita] });
    const { user } = await openAdd();
    await user.type(field("Full name"), "Ravi Kumar");
    await user.type(field("Employee ID"), "emp-1025");
    await user.type(field("Phone"), "+91 98100 00099");
    await user.type(field("Email (teacher login)"), "Anita.Sharma@greenfield.edu");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Email (teacher login)")).toBe("Another staff member already uses this email");
    expect(fieldError("Employee ID")).toBe("Another staff member has this employee ID");
    expect(writes).toHaveLength(0);
  });

  it("creates the staff doc, the teacher login and sends the invite when valid", async () => {
    seed({ staff: [anita] });
    const { user } = await openAdd();
    await user.type(field("Full name"), "  Ravi Kumar ");
    await user.type(field("Phone"), "+91 98100 00099");
    await user.type(field("Email (teacher login)"), "ravi.kumar@greenfield.edu");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    const s = getRow<Record<string, unknown>>("staff", "stf_026");
    expect(s).toMatchObject({ name: "Ravi Kumar", email: "ravi.kumar@greenfield.edu", status: "Active", authUid: "uid_new_1" });
    expect(s?.empId).toMatch(/^EMP-\d{4}$/);
    expect(getRow("users", "uid_new_1")).toMatchObject({ schoolId: "sch_test", role: "teacher", staffId: "stf_026" });
    expect(sentInvites).toEqual(["ravi.kumar@greenfield.edu"]);
    expect(await screen.findByText("Login created. Password email sent to ravi.kumar@greenfield.edu")).toBeInTheDocument();
  });

  it("reports an email that already has a Firebase login and leaves nothing half-created", async () => {
    authAccounts.set("taken@greenfield.edu", "uid_other");
    const { user } = await openAdd();
    await user.type(field("Full name"), "Ravi Kumar");
    await user.type(field("Phone"), "9810000099");
    await user.type(field("Email (teacher login)"), "taken@greenfield.edu");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(await screen.findByText(/This email already has a login/)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    expect(dialog("Add Staff")).toBeInTheDocument();
  });

  it("locks the email of a staff member whose login exists", async () => {
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Edit Mrs. Anita Sharma" }));
    expect(field("Email (teacher login)")).toBeDisabled();
  });
});

describe("Staff edit", () => {
  it("saves trimmed fields on the existing doc and keeps the login email", async () => {
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Edit Mrs. Anita Sharma" }));
    await user.clear(field("Designation"));
    await user.type(field("Designation"), "  Senior Faculty ");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(getRow("staff", "stf_025")).toMatchObject({ designation: "Senior Faculty", email: "anita.sharma@greenfield.edu", authUid: "uid_anita", updatedBy: "admin_uid" });
    expect(writesTo("users")).toHaveLength(0);
    expect(await screen.findByText("Staff updated")).toBeInTheDocument();
  });

  it("refuses a joining date in the future", async () => {
    vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 4, 10));
    seed({ staff: [anita] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Edit Mrs. Anita Sharma" }));
    fireEvent.change(field("Joined"), { target: { value: "2026-12-01" } });
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(fieldError("Joined")).toBe("The joining date cannot be in the future");
    expect(writes).toHaveLength(0);
    vi.useRealTimers();
  });
});

describe("Record leave (office)", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(2026, 10, 4, 10)); }); // Wed 4 Nov 2026
  afterEach(() => { vi.useRealTimers(); });

  async function openLeave() {
    seed({ staff: [anita] });
    const r = renderUI(<StaffView />);
    await r.user.click(screen.getByRole("button", { name: "Leave" }));
    return { ...r, dlg: dialog("Record leave") };
  }

  it("refuses an end date before the start and writes nothing", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-03" } });
    expect(fieldError("To", dlg)).toBe("End date is before start");
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(writes).toHaveLength(0);
  });

  it("refuses a range of only Sundays", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-08" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-08" } });
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(fieldError("To", dlg)).toBe("The selected dates only include Sundays");
    expect(writes).toHaveLength(0);
  });

  it("refuses dates overlapping another leave of the same teacher", async () => {
    seed({ staff_leaves: [{ id: "lv1", staffId: "stf_025", type: "Casual Leave", from: "2026-11-04", to: "2026-11-05", days: 2, reason: "", status: "Pending" }] });
    const { user, dlg } = await openLeave();
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(fieldError("From", dlg)).toBe("This staff member already has leave on these dates");
    expect(writes).toHaveLength(0);
  });

  it("writes an Approved staff_leaves doc and marks the teacher On leave when it includes today", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-06" } });
    await user.selectOptions(field("Leave type", dlg), "Medical Leave");
    await user.type(field("Reason", dlg), "Viral fever");
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(getRow("staff_leaves", "sl_stf_025_2026-11-04")).toMatchObject({ staffId: "stf_025", type: "Medical Leave", from: "2026-11-04", to: "2026-11-06", days: 3, reason: "Viral fever", status: "Approved", decidedBy: "admin_uid", source: "admin" });
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "On leave", leaveFrom: "2026-11-04", leaveTo: "2026-11-06", leaveReason: "Viral fever" });
    expect(await screen.findByText("Mrs. Anita Sharma marked on leave")).toBeInTheDocument();
    expect(rowsOf("approvals")).toHaveLength(0); // already decided: no inbox row
  });

  it("a future leave is recorded without changing today's status", async () => {
    const { user, dlg } = await openLeave();
    fireEvent.change(field("From", dlg), { target: { value: "2026-11-09" } });
    fireEvent.change(field("To", dlg), { target: { value: "2026-11-10" } });
    await user.click(within(dlg).getByRole("button", { name: "Mark on leave" }));
    expect(getRow("staff_leaves", "sl_stf_025_2026-11-09")).toMatchObject({ days: 2, status: "Approved" });
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "Active" });
    expect(await screen.findByText("Leave recorded for Mrs. Anita Sharma")).toBeInTheDocument();
  });

  it("Mark returned clears the office leave", async () => {
    seed({ staff: [{ ...anita, status: "On leave", leaveFrom: "2026-11-03", leaveTo: "2026-11-06", leaveReason: "Training" }] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Mark returned" }));
    expect(getRow("staff", "stf_025")).toMatchObject({ status: "Active", leaveFrom: "", leaveTo: "", leaveReason: "" });
  });
});

describe("Staff delete", () => {
  it("removes the staff doc and revokes the users/{uid} mapping", async () => {
    seed({ staff: [anita], users: [{ id: "uid_anita", schoolId: "sch_test", role: "teacher", staffId: "stf_025" }] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Delete Mrs. Anita Sharma" }));
    await user.click(within(dialog("Delete staff member?")).getByRole("button", { name: "Delete" }));
    expect(getRow("staff", "stf_025")).toBeUndefined();
    expect(getRow("users", "uid_anita")).toBeUndefined();
  });
});
