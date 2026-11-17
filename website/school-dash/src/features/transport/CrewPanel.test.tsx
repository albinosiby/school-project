import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import * as staffProfiles from "@/features/people/staffProfiles";
import { CrewPanel } from "./CrewPanel";
import { authAccounts, authState, callableCalls, dialog, field, fieldError, getRow, renderUI, router, screen, seed, sentInvites, within, writes } from "@/test/render";

const bus14 = { id: "bus_01", number: "14", regNo: "DL-01-AB-4092", capacity: 42, routeName: "Route 4B", driverId: "crw_001", driver: "Ramesh Kumar", attendantId: "crw_002", attendant: "Suresh Yadav",
  stops: [], pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 0 };
const bus15 = { id: "bus_02", number: "15", regNo: "DL-01-AB-5000", capacity: 40, routeName: "Route 5", stops: [], pickupStart: "06:40", dropStart: "15:30", status: "Active", studentCount: 0 };
const ramesh = { id: "crw_001", name: "Ramesh Kumar", role: "driver", empId: "TR-1001", phone: "+91 98100 00011", email: "driver@e2e.test", authUid: "uid_drv", status: "Active",
  busId: "bus_01", bus: "Bus 14", licenseNo: "DL-0420110012345", licenseExpiry: "2029-03-31" };
const suresh = { id: "crw_002", name: "Suresh Yadav", role: "attendant", empId: "TR-1002", phone: "+91 98100 00012", email: "attendant@e2e.test", authUid: "uid_att", status: "Active", busId: "bus_01", bus: "Bus 14" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const setDate = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

it.each(["driver", "attendant"] as const)("opens the %s staff details from the name and row while keeping edit actions separate", async (role) => {
  const member = role === "driver" ? ramesh : suresh;
  seed({ tr_crew: [ramesh, suresh], tr_buses: [bus14] });
  const { user } = renderUI(<CrewPanel role={role} />);
  const link = screen.getByRole("link", { name: member.name });
  expect(link).toHaveAttribute("href", `/staff/transport/${member.id}`);
  await user.click(link.closest("tr")!);
  expect(router.push).toHaveBeenCalledWith(`/staff/transport/${member.id}`);
  router.push.mockClear();
  await user.click(screen.getByRole("button", { name: `Edit ${member.name}` }));
  expect(router.push).not.toHaveBeenCalled();
  expect(dialog(role === "driver" ? "Edit Driver" : "Edit Bus staff")).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it("does not offer private staff profile navigation to a non-admin account", () => {
  seed({ tr_crew: [ramesh] });
  authState.user = { ...authState.user!, role: "staff" };
  renderUI(<CrewPanel role="driver" />);
  expect(screen.queryByRole("link", { name: ramesh.name })).not.toBeInTheDocument();
});
async function openAdd(role: "driver" | "attendant") {
  const r = renderUI(<CrewPanel role={role} />);
  const label = role === "driver" ? "Driver" : "Bus staff";
  await r.user.click(screen.getByRole("button", { name: `Add ${label}` }));
  const d = dialog(`Add ${label}`);
  return { ...r, d, submit: () => r.user.click(within(d).getByRole("button", { name: "Save profile and enable app access" })) };
}

describe("Add driver / bus staff validation", () => {
  it.each(["driver", "attendant"] as const)("uses the shared staff form for %s and cancels without creating records", async (role) => {
    const { user, d } = await openAdd(role);
    expect(field("Staff category", d)).toHaveValue("Non-Teaching");
    expect(field("Designation", d)).toHaveValue(role === "driver" ? "Driver" : "Bus Attendant");
    expect(within(d).getByRole("switch", { name: "Enable app access" })).toBeChecked();
    expect(field("First name", d)).toBeInTheDocument();
    expect(within(d).queryByRole("textbox", { name: "Driving licence number" }) !== null).toBe(role === "driver");
    expect(within(d).queryByLabelText("Email (driver-app login)")).not.toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Cancel" }));
    expect(callableCalls).toHaveLength(0);
    expect(writes).toHaveLength(0);
    expect(authAccounts.size).toBe(0);
  });

  it.each(["driver", "attendant"] as const)("retains the %s draft on server validation errors without creating a login", async (role) => {
    vi.spyOn(staffProfiles, "saveStaffProfile").mockRejectedValueOnce(Object.assign(new Error("Check the staff profile fields."), {
      details: { fields: { phone: "Enter a valid mobile number.", licenseExpiry: "Enter a valid date." } },
    }));
    const { user, d, submit } = await openAdd(role);
    await user.type(field("First name", d), "Vijay");
    await user.type(field("Login email", d), "vijay@school.test");
    await user.click(within(d).getByRole("button", { name: "Generate password" }));
    await submit();
    expect(fieldError("Mobile number", d)).toBe("Enter a valid mobile number.");
    if (role === "driver") expect(fieldError("Licence expiry date", d)).toBe("Enter a valid date.");
    expect(field("First name", d)).toHaveValue("Vijay");
    expect(callableCalls.filter(([name]) => name === "setStaffAppLogin")).toHaveLength(0);
    expect(writes).toHaveLength(0);
  });

  it.each(["driver", "attendant"] as const)("saves a staff profile and enables the linked %s login through the shared workflow", async (role) => {
    seed({ staff: [{ id: "existing", name: "Existing", empId: "FC-0028" }], set_config: [
      { id: "staff_numbering", template: "FC-{SEQ:4}", start: 10, next: 28 },
    ] });
    const { user, d, submit } = await openAdd(role);
    expect(field("Employee ID", d)).toHaveValue("FC-0029");
    await user.type(field("First name", d), "Vijay");
    await user.type(field("Last name", d), "Singh");
    setDate(field("Date of birth", d), "1990-04-10");
    await user.selectOptions(field("Gender", d), "Male");
    await user.selectOptions(field("Nationality", d), "IN");
    await user.type(field("Mobile number", d), "9000000031");
    setDate(field("Joining date", d), "2026-01-01");
    await user.selectOptions(field("Employment type", d), "Permanent");
    if (role === "driver") {
      await user.type(field("Driving licence number", d), "TEST-0001");
      setDate(field("Licence expiry date", d), "2030-01-01");
    }
    await user.type(field("Login email", d), "vijay@school.test");
    await user.click(within(d).getByRole("button", { name: "Generate password" }));
    const password = field("Password", d).value;
    expect(password).toMatch(/^\d{6}$/);
    await submit();
    expect(callableCalls[0]).toEqual(["saveStaffProfile", expect.objectContaining({ profile: expect.objectContaining({
      firstName: "Vijay", lastName: "Singh", category: "Non-Teaching", designation: role === "driver" ? "Driver" : "Bus Attendant",
      empId: "", licenseNumber: role === "driver" ? "TEST-0001" : "", licenseExpiry: role === "driver" ? "2030-01-01" : "",
    }) })]);
    // The staff role is helper; the existing callable maps it to attendant app/crew access.
    expect(callableCalls.at(-1)).toEqual(["setStaffAppLogin", { staffId: "stf_new_profile", email: "vijay@school.test", role: role === "driver" ? "driver" : "helper", password }]);
    expect(within(d).getByLabelText("App password")).toHaveTextContent(password);
    expect(authAccounts.size).toBe(0);
    expect(sentInvites).toHaveLength(0);
    await user.click(within(d).getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog", { name: role === "driver" ? "Add Driver" : "Add Bus staff" })).not.toBeInTheDocument();
  });

  it("retries attendant app access without saving another staff profile", async () => {
    const login = vi.spyOn(staffProfiles, "setStaffAppLogin").mockRejectedValueOnce(new Error("This email is already linked."));
    const { user, d, submit } = await openAdd("attendant");
    await user.type(field("First name", d), "Anil");
    await user.type(field("Login email", d), "taken@school.test");
    await submit();
    expect(await within(d).findByText("Staff profile saved. This email is already linked.")).toBeInTheDocument();
    expect(field("Login email", d)).toHaveValue("taken@school.test");
    await user.clear(field("Login email", d));
    await user.type(field("Login email", d), "anil@school.test");
    await user.click(within(d).getByRole("button", { name: "Save app login" }));
    expect(login).toHaveBeenLastCalledWith("stf_new_profile", { email: "anil@school.test", role: "helper" });
    expect(callableCalls.filter(([name]) => name === "saveStaffProfile")).toHaveLength(1);
    expect(within(d).getByLabelText("App password")).toHaveTextContent("024681");
    expect(authAccounts.size).toBe(0);
    expect(sentInvites).toHaveLength(0);
  });
});

describe("Edit driver", () => {
  it("locks the login email, blocks saving an expired license, then moves the driver to another bus in one batch", async () => {
    seed({ tr_crew: [{ ...ramesh, licenseExpiry: "2026-10-01" }, suresh], tr_buses: [bus14, bus15] });
    const { user } = renderUI(<CrewPanel role="driver" />);
    expect(screen.getByText(/Expired/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Ramesh Kumar" }));
    const d = dialog("Edit Driver");
    expect(field("Email (driver-app login)", d)).toBeDisabled();
    await user.selectOptions(field("Bus", d), "bus_02");
    await user.click(within(d).getByRole("button", { name: "Save Changes" }));
    expect(fieldError("License expiry", d)).toBe("The license has expired; enter the renewed expiry date");
    expect(writes).toHaveLength(0);
    setDate(field("License expiry", d), "2031-10-01");
    await user.click(within(d).getByRole("button", { name: "Save Changes" }));
    expect(getRow("tr_crew", "crw_001")).toMatchObject({ busId: "bus_02", bus: "Bus 15", licenseExpiry: "2031-10-01" });
    expect(getRow("tr_buses", "bus_02")).toMatchObject({ driverId: "crw_001", driver: "Ramesh Kumar" });
    expect(getRow("tr_buses", "bus_01")).not.toHaveProperty("driverId");
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ attendantId: "crw_002" });
    expect(await screen.findByText("Driver updated")).toBeInTheDocument();
  });

  it("shows the expiring-soon warning within 30 days", () => {
    seed({ tr_crew: [{ ...ramesh, licenseExpiry: "2026-11-20" }] });
    renderUI(<CrewPanel role="driver" />);
    expect(screen.getByText(/^Expires/)).toBeInTheDocument();
  });
});
