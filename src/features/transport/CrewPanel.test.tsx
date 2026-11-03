import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { CrewPanel } from "./CrewPanel";
import { authAccounts, dialog, field, fieldError, getRow, renderUI, screen, seed, sentInvites, within, writes } from "@/test/render";

const bus14 = { id: "bus_01", number: "14", regNo: "DL-01-AB-4092", capacity: 42, routeName: "Route 4B", driverId: "crw_001", driver: "Ramesh Kumar", attendantId: "crw_002", attendant: "Suresh Yadav",
  stops: [], pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 0 };
const bus15 = { id: "bus_02", number: "15", regNo: "DL-01-AB-5000", capacity: 40, routeName: "Route 5", stops: [], pickupStart: "06:40", dropStart: "15:30", status: "Active", studentCount: 0 };
const ramesh = { id: "crw_001", name: "Ramesh Kumar", role: "driver", empId: "TR-1001", phone: "+91 98100 00011", email: "driver@e2e.test", authUid: "uid_drv", status: "Active",
  busId: "bus_01", bus: "Bus 14", licenseNo: "DL-0420110012345", licenseExpiry: "2029-03-31" };
const suresh = { id: "crw_002", name: "Suresh Yadav", role: "attendant", empId: "TR-1002", phone: "+91 98100 00012", email: "attendant@e2e.test", authUid: "uid_att", status: "Active", busId: "bus_01", bus: "Bus 14" };

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-11-03T10:00:00")); });
afterEach(() => { vi.useRealTimers(); });

const setDate = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });
async function openAdd(role: "driver" | "attendant") {
  const r = renderUI(<CrewPanel role={role} />);
  const label = role === "driver" ? "Driver" : "Bus staff";
  await r.user.click(screen.getByRole("button", { name: `Add ${label}` }));
  const d = dialog(`Add ${label}`);
  return { ...r, d, submit: () => r.user.click(within(d).getByRole("button", { name: `Add ${label} & Create Login` })) };
}

describe("Add driver / bus staff validation", () => {
  it("shows the required-field errors for a driver (license included) and writes nothing", async () => {
    const { d, submit } = await openAdd("driver");
    await submit();
    expect(fieldError("Full name", d)).toBe("Name is required");
    expect(fieldError("Phone", d)).toBe("Enter a valid phone number");
    expect(fieldError("Email (driver-app login)", d)).toBe("A valid email is required (it is the driver-app login)");
    expect(fieldError("License no", d)).toBe("License number is required for a driver");
    expect(fieldError("License expiry", d)).toBe("License expiry is required for a driver");
    expect(writes).toHaveLength(0);
    expect(authAccounts.size).toBe(0);
  });

  it("does not ask bus staff for a license", async () => {
    const { d, submit } = await openAdd("attendant");
    expect(within(d).queryByText("License no")).toBeNull();
    await submit();
    expect(fieldError("Full name", d)).toBe("Name is required");
    expect(writes).toHaveLength(0);
  });

  it("rejects a malformed phone / email, an expired license, and an email or employee ID already used", async () => {
    seed({ tr_crew: [ramesh, suresh], tr_buses: [bus14] });
    const { user, d, submit } = await openAdd("driver");
    await user.type(field("Full name", d), "Vijay Singh");
    await user.type(field("Phone", d), "98ab");
    await user.type(field("Email (driver-app login)", d), "vijay@school");
    await user.type(field("License no", d), "DL-0420110099999");
    setDate(field("License expiry", d), "2026-11-02");
    await submit();
    expect(fieldError("Phone", d)).toBe("Enter a valid phone number");
    expect(fieldError("Email (driver-app login)", d)).toBe("A valid email is required (it is the driver-app login)");
    expect(fieldError("License expiry", d)).toBe("The license has expired; enter the renewed expiry date");
    await user.clear(field("Email (driver-app login)", d)); await user.type(field("Email (driver-app login)", d), "Attendant@E2E.test");
    await user.type(field("Employee ID", d), "tr-1001");
    await submit();
    expect(fieldError("Email (driver-app login)", d)).toBe("Another crew member already uses this email");
    expect(fieldError("Employee ID", d)).toBe("Another crew member has this employee ID");
    expect(writes).toHaveLength(0);
  });

  it("creates the crew doc, the driver login (users role driver + crewId) and allots the bus in one batch", async () => {
    seed({ tr_crew: [ramesh, suresh], tr_buses: [bus14, bus15] });
    const { user, d, submit } = await openAdd("driver");
    await user.type(field("Full name", d), " Vijay Singh ");
    await user.type(field("Phone", d), "+91 98100 00031");
    await user.type(field("Email (driver-app login)", d), "Vijay@School.test");
    await user.type(field("License no", d), "dl-0420110099999");
    setDate(field("License expiry", d), "2026-11-03");
    await user.selectOptions(field("Bus", d), "bus_01");
    await submit();
    expect(getRow("tr_crew", "crw_003")).toMatchObject({ name: "Vijay Singh", role: "driver", status: "Active", email: "vijay@school.test", phone: "+91 98100 00031",
      licenseNo: "DL-0420110099999", licenseExpiry: "2026-11-03", authUid: "uid_new_1", busId: "bus_01", bus: "Bus 14", updatedBy: "admin_uid" });
    expect((getRow("tr_crew", "crw_003") as { empId: string }).empId).toMatch(/^TR-\d{4}$/);
    expect(getRow("users", "uid_new_1")).toMatchObject({ schoolId: "sch_test", role: "driver", crewId: "crw_003", email: "vijay@school.test", name: "Vijay Singh" });
    // the seat's previous holder is freed; the attendant seat is untouched
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ driverId: "crw_003", driver: "Vijay Singh", attendantId: "crw_002" });
    expect(getRow("tr_crew", "crw_001")).not.toHaveProperty("busId");
    expect(sentInvites).toEqual(["vijay@school.test"]);
    expect(await screen.findByText("Login created. Password email sent to vijay@school.test")).toBeInTheDocument();
  });

  it("creates a bus-staff login with role attendant and no license fields", async () => {
    const { user, d, submit } = await openAdd("attendant");
    await user.type(field("Full name", d), "Anil Verma");
    await user.type(field("Phone", d), "9810000032");
    await user.type(field("Email (driver-app login)", d), "anil@school.test");
    await submit();
    const row = getRow<Record<string, unknown>>("tr_crew", "crw_001")!;
    expect(row).toMatchObject({ name: "Anil Verma", role: "attendant", status: "Active" });
    expect(row).not.toHaveProperty("licenseNo");
    expect(row).not.toHaveProperty("busId");
    expect(getRow("users", "uid_new_1")).toMatchObject({ role: "attendant", crewId: "crw_001" });
  });

  it("reports an email that already has a Firebase login and leaves nothing half-created", async () => {
    authAccounts.set("taken@school.test", "uid_other");
    const { user, d, submit } = await openAdd("attendant");
    await user.type(field("Full name", d), "Anil Verma");
    await user.type(field("Phone", d), "9810000032");
    await user.type(field("Email (driver-app login)", d), "taken@school.test");
    await submit();
    expect(await screen.findByText(/This email already has a login/)).toBeInTheDocument();
    expect(writes).toHaveLength(0);
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
