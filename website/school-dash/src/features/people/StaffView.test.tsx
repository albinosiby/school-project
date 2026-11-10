import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { useState } from "react";
import { Button, SlideOver } from "@/components/ui";
import { useCollection } from "@/lib/useCollection";
import { AddStaffFields } from "./AddStaffFields";
import { StaffView } from "./StaffView";
import * as staffInvitation from "@/lib/staffInvitation";
import { authState, callableCalls, dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, sentInvites, within, writes, writesTo } from "@/test/render";

const anita = { id: "stf_025", name: "Mrs. Anita Sharma", empId: "EMP-1025", department: "Mathematics", role: "TGT", status: "Active", phone: "+91 98100 00025", email: "anita.sharma@greenfield.edu", authUid: "uid_anita" };

async function openAdd() {
  function LegacyInvite() {
    const [open, setOpen] = useState(false);
    const { rows } = useCollection<typeof anita>("staff");
    return <><Button onClick={() => setOpen(true)}>Add Staff</Button>
      <SlideOver open={open} title="Add Staff" onClose={() => setOpen(false)}>
        <AddStaffFields rows={rows} onAdded={() => setOpen(false)} buttonLabel="Add Staff & Create Login" />
      </SlideOver></>;
  }
  const r = renderUI(<LegacyInvite />);
  await r.user.click(screen.getByRole("button", { name: /Add Staff/ }));
  return r;
}

it("saves a driver profile before generating an optional app password", async () => {
  const { user } = renderUI(<StaffView />);
  await user.click(screen.getByRole("button", { name: "Add Staff" }));
  const add = dialog("Add Staff");
  await user.type(field("First name", add), "Ravi");
  await user.type(field("Last name", add), "Kumar");
  fireEvent.change(field("Date of birth", add), { target: { value: "1990-04-10" } });
  await user.selectOptions(field("Gender", add), "Male");
  await user.selectOptions(field("Nationality", add), "IN");
  await user.type(field("Mobile number", add), "9000000001");
  await user.selectOptions(field("Staff category", add), "Non-Teaching");
  await user.selectOptions(field("Designation", add), "Driver");
  await user.selectOptions(field("Department", add), "Transport");
  fireEvent.change(field("Joining date", add), { target: { value: "2026-01-01" } });
  await user.selectOptions(field("Employment type", add), "Permanent");
  await user.type(field("Driving licence number", add), "TEST-0001");
  await user.type(field("Contact person name", add), "Example Contact");
  await user.type(field("Relationship", add), "Sibling");
  await user.type(field("Emergency mobile number", add), "9000000002");
  await user.click(within(add).getByRole("button", { name: "Save staff profile" }));
  expect(callableCalls).toEqual([["saveStaffProfile", expect.objectContaining({ profile: expect.objectContaining({ contactEmail: "", licenseNumber: "TEST-0001", designation: "Driver" }) })]]);
  await user.type(field("Login email", add), "driver@example.test");
  await user.click(within(add).getByRole("button", { name: "Generate password" }));
  expect(callableCalls.at(-1)).toEqual(["setStaffAppLogin", { staffId: "stf_new_profile", email: "driver@example.test", role: "driver" }]);
  expect(within(add).getByLabelText("Generated password")).toHaveTextContent("ExamplePassword1!");
});

describe("Staff form validation", () => {
  it("requires only name, email and role before provisioning", async () => {
    const { user } = await openAdd();
    const add = dialog("Add Staff");
    expect(add.querySelectorAll("input, select")).toHaveLength(3);
    await user.click(within(add).getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Name", add)).toBe("Enter a name from 2 to 120 characters.");
    expect(fieldError("Email", add)).toBe("Enter a valid email address.");
    expect(fieldError("Role", add)).toBe("Choose a role.");
    expect(callableCalls).toHaveLength(0);
  });

  it("checks for a directory email already in use", async () => {
    seed({ staff: [anita] });
    const { user } = await openAdd();
    await user.type(field("Name"), "Ravi Kumar");
    await user.type(field("Email"), "Anita.Sharma@greenfield.edu");
    await user.selectOptions(field("Role"), "teacher");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(fieldError("Email")).toBe("Another staff member already uses this email.");
    expect(callableCalls).toHaveLength(0);
  });

  it("provisions a Principal and reports the server's invitation result", async () => {
    const { user } = await openAdd();
    await user.type(field("Name"), "  Ravi Kumar ");
    await user.type(field("Email"), "RAVI@greenfield.edu");
    await user.selectOptions(field("Role"), "principal");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(callableCalls).toEqual([["createSchoolStaff", { name: "Ravi Kumar", email: "ravi@greenfield.edu", role: "principal", invitationId: expect.any(String) }]]);
    expect(sentInvites).toEqual([]);
    expect(await screen.findByText("Login created. Password email sent to ravi@greenfield.edu")).toBeInTheDocument();
  });

  it("resends a role-based staff invitation through the server using the staff ID", async () => {
    seed({ staff: [{ ...anita, staffRole: "teacher" }] });
    const { user } = renderUI(<StaffView />);
    await user.click(screen.getByRole("button", { name: "Resend invite" }));
    expect(callableCalls).toEqual([["resendSchoolStaffInvite", { staffId: anita.id }]]);
    expect(sentInvites).toEqual([]);
    expect(await screen.findByText(`Password email sent to ${anita.email}`)).toBeInTheDocument();
  });

  it("completes Add Staff when the account is created without an invitation email", async () => {
    vi.spyOn(staffInvitation, "createStaffInvitation").mockResolvedValueOnce(false);
    const { user } = await openAdd();
    await user.type(field("Name"), "Ravi Kumar");
    await user.type(field("Email"), "ravi@greenfield.edu");
    await user.selectOptions(field("Role"), "principal");
    await user.click(screen.getByRole("button", { name: "Add Staff & Create Login" }));
    expect(await screen.findByText("Staff account created.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Add Staff" })).not.toBeInTheDocument();
  });

  it("does not show Add Staff to the platform owner", () => {
    authState.user = { ...authState.user!, role: "owner" };
    renderUI(<StaffView />);
    expect(screen.queryByRole("button", { name: "Add Staff" })).not.toBeInTheDocument();
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
