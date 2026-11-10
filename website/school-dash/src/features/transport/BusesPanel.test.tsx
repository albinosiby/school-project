import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { BusesPanel } from "./BusesPanel";
import { ADMIN_UID, dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

const stops = [
  { id: "stp_01", name: "Lajpat Nagar", pickupTime: "06:45", dropTime: "15:40", landmark: "Metro gate 2" },
  { id: "stp_02", name: "Greater Kailash", pickupTime: "06:58", dropTime: "15:55" },
];
const bus14 = { id: "bus_01", number: "14", regNo: "DL-01-AB-4092", capacity: 3, model: "42-seater AC", routeName: "Route 4B", driverId: "crw_001", driver: "Ramesh Kumar",
  attendantId: "crw_002", attendant: "Suresh Yadav", stops, pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 2, note: "" };
const bus15 = { id: "bus_02", number: "15", regNo: "DL-01-AB-5000", capacity: 40, routeName: "Route 5", driverId: "crw_003", driver: "Vijay Singh", stops: [], pickupStart: "06:40", dropStart: "15:30", status: "Active", studentCount: 1 };
const crew = [
  { id: "crw_001", name: "Ramesh Kumar", role: "driver", empId: "TR-1001", phone: "+91 98100 00011", email: "driver@e2e.test", status: "Active", busId: "bus_01", bus: "Bus 14" },
  { id: "crw_002", name: "Suresh Yadav", role: "attendant", empId: "TR-1002", phone: "+91 98100 00012", email: "attendant@e2e.test", status: "Active", busId: "bus_01", bus: "Bus 14" },
  { id: "crw_003", name: "Vijay Singh", role: "driver", empId: "TR-1003", phone: "+91 98100 00013", email: "vijay@e2e.test", status: "Active", busId: "bus_02", bus: "Bus 15" },
];
const student = (id: string, name: string, extra: Record<string, unknown> = {}) => ({ id, name, grn: `GIS-${id.slice(4)}`, grade: "10", section: "B", guardian: "Guardian", phone: "+91 98100 00001", status: "Active", attendance: 95, ...extra });
const kids = [
  student("stu_101", "Aarav Sharma", { busId: "bus_01", bus: "Bus 14", busStopId: "stp_01", busStop: "Lajpat Nagar" }),
  student("stu_102", "Ananya Reddy", { busId: "bus_01", bus: "Bus 14", busStopId: "stp_02", busStop: "Greater Kailash" }),
  student("stu_103", "Kabir Das", { busId: "bus_02", bus: "Bus 15" }),
  student("stu_201", "Meera Sharma"),
  student("stu_202", "Rohan Gupta"),
  student("stu_203", "Old Pupil", { deleted: true, busId: "bus_01" }),
];

const setVal = (el: HTMLElement, v: string) => fireEvent.change(el, { target: { value: v } });

async function openAdd() {
  const r = renderUI(<BusesPanel openBusId={null} onOpenBus={vi.fn()} />);
  await r.user.click(screen.getByRole("button", { name: /Add Bus/ }));
  return { ...r, d: dialog("Add Bus") };
}
const save = (d: HTMLElement) => within(d).getByRole("button", { name: /^(Add Bus|Save Changes)$/ });

describe("Add / edit bus validation", () => {
  it("sets each bus's own monthly fee without creating class-wide charges or copying rates to students", async () => {
    seed({ tr_buses: [{ ...bus14, monthlyFee: 1200 }, { ...bus15, monthlyFee: 1800 }], students: kids });
    const { user } = renderUI(<BusesPanel openBusId={null} onOpenBus={vi.fn()} />);
    expect(screen.getByText("₹1,200")).toBeInTheDocument();
    expect(screen.getByText("₹1,800")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit Bus 14" }));
    const d = dialog("Edit Bus 14");
    const input = field("Monthly transport fee (₹)", d);
    expect(input).toHaveValue(1200);
    await user.clear(input); await user.type(input, "-1");
    await user.click(save(d));
    expect(fieldError("Monthly transport fee (₹)", d)).toContain("Enter an amount from ₹0");
    expect(writes).toHaveLength(0);
    await user.clear(input); await user.type(input, "1500.50");
    await user.click(save(d));
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ monthlyFee: 1500.5 });
    expect(getRow("tr_buses", "bus_02")).toMatchObject({ monthlyFee: 1800 });
    expect(getRow("students", "stu_101")).not.toHaveProperty("monthlyFee");
    expect(writesTo("fee_structure")).toHaveLength(0);
    expect(writesTo("fee_invoices")).toHaveLength(0);
  });
  it("requires vehicle details and a single route end point", async () => {
    const { user, d } = await openAdd();
    await user.click(save(d));
    expect(fieldError("Bus number / Fleet number", d)).toBe("Bus number is required");
    expect(fieldError("Registration number", d)).toBe("Registration number is required");
    expect(fieldError("Student seating capacity", d)).toBe("Enter the seat count (a whole number, 1 to 120)");
    expect(fieldError("End-point location", d)).toBe("End-point location is required");
    expect(fieldError("Vehicle type", d)).toBe("Choose a vehicle type");
    expect(fieldError("Fuel type", d)).toBe("Choose a fuel type");
    expect(within(d).queryByLabelText("Route name")).not.toBeInTheDocument();
    expect(within(d).queryByLabelText("Pickup starts")).not.toBeInTheDocument();
    expect(within(d).queryByRole("button", { name: "Add stop" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("rejects malformed and duplicate registrations and fractional seating", async () => {
    seed({ tr_buses: [bus14] });
    const { user, d } = await openAdd();
    await user.type(field("Bus number / Fleet number", d), "14");
    await user.type(field("Registration number", d), "BUS-FOURTEEN");
    await user.type(field("Student seating capacity", d), "40.5");
    await user.click(save(d));
    expect(fieldError("Bus number / Fleet number", d)).toBe("Another bus has this number");
    expect(fieldError("Registration number", d)).toBe("Enter a registration number like DL-01-AB-4092");
    expect(fieldError("Student seating capacity", d)).toBe("Enter the seat count (a whole number, 1 to 120)");
    await user.clear(field("Registration number", d));
    await user.type(field("Registration number", d), "dl 01 ab 4092");
    await user.click(save(d));
    expect(fieldError("Registration number", d)).toBe("Another bus has this registration number");
    expect(writes).toHaveLength(0);
  });

  it("creates a bus with the next ID, usable student capacity and compliance dates without route setup", async () => {
    seed({ tr_buses: [bus14] });
    const { user, d } = await openAdd();
    expect(field("Bus ID", d)).toHaveValue("Generated when saved");
    for (const [label, value] of [
      ["Bus number / Fleet number", "16"], ["Registration number", "kl 07 ab 7000"], ["Model", "Starbus"],
      ["Manufacturing year", "2024"], ["Chassis number", "CHASSIS16"], ["Engine number", "ENGINE16"],
      ["End-point location", "Edappally Junction"], ["Total seating capacity", "35"], ["Student seating capacity", "36"],
    ]) await user.type(field(label!, d), value!);
    await user.selectOptions(field("Vehicle type", d), "School Bus");
    await user.selectOptions(field("Fuel type", d), "Diesel");
    await user.selectOptions(field("First aid kit", d), "yes");
    setVal(field("Insurance expiry date", d), "2027-02-02");
    await user.click(save(d));
    expect(fieldError("Student seating capacity", d)).toBe("Student seating cannot exceed total seating");
    expect(writes).toHaveLength(0);
    await user.clear(field("Student seating capacity", d));
    await user.type(field("Student seating capacity", d), "32");
    await user.click(save(d));
    expect(await screen.findByText("Bus added")).toBeInTheDocument();
    expect(getRow("tr_buses", "bus_02")).toMatchObject({
      id: "bus_02", number: "16", regNo: "KL-07-AB-7000", vehicleType: "School Bus", fuelType: "Diesel",
      manufacturingYear: 2024, chassisNumber: "CHASSIS16", engineNumber: "ENGINE16",
      totalSeats: 35, capacity: 32, firstAidKit: true, gpsInstalled: false,
      insuranceExpiryDate: "2027-02-02", endPoint: "Edappally Junction", routeName: "Edappally Junction",
      stops: [], pickupStart: "", dropStart: "", status: "Active", studentCount: 0, updatedBy: ADMIN_UID,
    });
  });

  it("still validates and saves ordered stops separately after adding a bus", async () => {
    seed({ tr_buses: [{ ...bus14, endPoint: "Edappally", stops: [], pickupStart: "", dropStart: "" }] });
    const { user } = renderUI(<BusesPanel openBusId={null} onOpenBus={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit Bus 14" }));
    const d = dialog("Edit Bus 14");
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("Every stop needs a name");
    const names = within(d).getAllByLabelText("Stop name");
    await user.type(names[0]!, "Saket");
    await user.type(names[1]!, "Malviya Nagar");
    const pick = within(d).getAllByLabelText("Pickup time");
    setVal(pick[0]!, "07:00"); setVal(pick[1]!, "06:55");
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("pickup time is earlier than the stop before it");
    setVal(pick[1]!, "07:05");
    await user.click(save(d));
    expect(getRow("tr_buses", "bus_01")).toMatchObject({
      endPoint: "Edappally", pickupStart: "06:45", dropStart: "15:30",
      stops: [{ name: "Saket", pickupTime: "07:00" }, { name: "Malviya Nagar", pickupTime: "07:05" }],
    });
  });

  it("can designate an existing administrator for expiry reminders", async () => {
    seed({ users: [
      { id: ADMIN_UID, schoolId: "sch_test", role: "admin", name: "Transport Lead" },
      { id: "staff_01", schoolId: "sch_test", role: "staff", name: "Office Staff" },
    ] });
    const { user } = renderUI(<BusesPanel openBusId={null} onOpenBus={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Expiry reminders" }));
    const d = dialog("Bus expiry reminders");
    expect(within(d).queryByRole("option", { name: "Office Staff" })).not.toBeInTheDocument();
    await user.selectOptions(field("Transport administrator", d), ADMIN_UID);
    await user.click(within(d).getByRole("button", { name: "Save settings" }));
    expect(getRow("tr_settings", "expiry_notifications")).toMatchObject({ recipientUid: ADMIN_UID });
  });

  it("on edit, blocks a capacity below the riders, then syncs riders' and crew's names in one batch", async () => {
    seed({ tr_buses: [bus14, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId={null} onOpenBus={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Edit Bus 14" }));
    const d = dialog("Edit Bus 14");
    await user.clear(field("Capacity (seats)", d)); await user.type(field("Capacity (seats)", d), "1");
    await user.click(save(d));
    expect(fieldError("Capacity (seats)", d)).toBe("2 students are on this bus; capacity cannot be lower");
    expect(writes).toHaveLength(0);
    await user.clear(field("Capacity (seats)", d)); await user.type(field("Capacity (seats)", d), "42");
    await user.clear(field("Bus number", d)); await user.type(field("Bus number", d), "41");
    const names = within(d).getAllByLabelText("Stop name");
    await user.clear(names[0]!); await user.type(names[0]!, "Lajpat Nagar II");
    await user.click(within(d).getAllByRole("button", { name: "Remove stop" })[1]!);
    await user.click(save(d));
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ number: "41", capacity: 42, studentCount: 2, driverId: "crw_001", attendantId: "crw_002" });
    expect(getRow("students", "stu_101")).toMatchObject({ bus: "Bus 41", busStopId: "stp_01", busStop: "Lajpat Nagar II" });
    expect(getRow("students", "stu_102")).toMatchObject({ bus: "Bus 41" });
    expect(getRow("students", "stu_102")).not.toHaveProperty("busStopId");
    expect(getRow("tr_crew", "crw_001")).toMatchObject({ bus: "Bus 41" });
    expect(getRow("tr_crew", "crw_003")).toMatchObject({ bus: "Bus 15" });
    expect(await screen.findByText("Bus updated")).toBeInTheDocument();
  });
});

describe("Bus detail: students and crew", () => {
  it("refuses to add more students than the seats left and writes nothing", async () => {
    seed({ tr_buses: [bus14, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId="bus_01" onOpenBus={vi.fn()} />);
    const d = dialog("Bus 14");
    await user.click(within(d).getByRole("tab", { name: /^Students/ }));
    await user.click(within(d).getByLabelText("Select Meera Sharma"));
    await user.click(within(d).getByLabelText("Select Rohan Gupta"));
    expect(within(d).getByText("Over capacity")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: /Add 2 students/ }));
    expect(within(d).getByRole("alert")).toHaveTextContent("Bus 14 has 1 seat left; 2 students selected.");
    expect(writes).toHaveLength(0);
  });

  it("assigns students to the bus and stop and recomputes studentCount on every touched bus", async () => {
    seed({ tr_buses: [{ ...bus14, capacity: 40 }, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId="bus_01" onOpenBus={vi.fn()} />);
    const d = dialog("Bus 14");
    await user.click(within(d).getByRole("tab", { name: /^Students/ }));
    await user.click(within(d).getByLabelText("Select Meera Sharma"));
    await user.click(within(d).getByLabelText("Select Kabir Das")); // moves off Bus 15
    await user.selectOptions(field("Stop for the selected students", d), "stp_02");
    await user.click(within(d).getByRole("button", { name: /Add 2 students/ }));
    expect(getRow("students", "stu_201")).toMatchObject({ busId: "bus_01", bus: "Bus 14", busStopId: "stp_02", busStop: "Greater Kailash", updatedBy: "admin_uid" });
    expect(getRow("students", "stu_103")).toMatchObject({ busId: "bus_01", busStopId: "stp_02" });
    // the soft-deleted pupil on bus_01 does not count
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ studentCount: 4 });
    expect(getRow("tr_buses", "bus_02")).toMatchObject({ studentCount: 0 });
    expect(await screen.findByText("2 students added to Bus 14")).toBeInTheDocument();
  });

  it("changes a rider's stop and takes a rider off the bus", async () => {
    seed({ tr_buses: [bus14, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId="bus_01" onOpenBus={vi.fn()} />);
    const d = dialog("Bus 14");
    await user.click(within(d).getByRole("tab", { name: /^Students/ }));
    await user.selectOptions(within(d).getByLabelText("Stop for Aarav Sharma"), "stp_02");
    expect(getRow("students", "stu_101")).toMatchObject({ busStopId: "stp_02", busStop: "Greater Kailash" });
    await user.selectOptions(within(d).getByLabelText("Stop for Aarav Sharma"), "");
    expect(getRow("students", "stu_101")).not.toHaveProperty("busStopId");
    await user.click(within(d).getByRole("button", { name: "Remove Ananya Reddy" }));
    const s = getRow<Record<string, unknown>>("students", "stu_102")!;
    for (const k of ["busId", "bus", "busStopId", "busStop"]) expect(s).not.toHaveProperty(k);
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ studentCount: 1 });
  });

  it("allots a driver from another bus in one batch: both buses and the displaced driver stay in sync", async () => {
    seed({ tr_buses: [bus14, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId="bus_01" onOpenBus={vi.fn()} />);
    const d = dialog("Bus 14");
    await user.selectOptions(field("Driver", d), "crw_003");
    expect(getRow("tr_buses", "bus_01")).toMatchObject({ driverId: "crw_003", driver: "Vijay Singh", attendantId: "crw_002" });
    expect(getRow("tr_buses", "bus_02")).not.toHaveProperty("driverId");
    expect(getRow("tr_crew", "crw_003")).toMatchObject({ busId: "bus_01", bus: "Bus 14" });
    expect(getRow("tr_crew", "crw_001")).not.toHaveProperty("busId");
    expect(new Set(writes.map((w) => `${w.coll}/${w.id}`))).toEqual(new Set(["tr_buses/bus_01", "tr_buses/bus_02", "tr_crew/crw_003", "tr_crew/crw_001"]));
    expect(await screen.findByText("Vijay Singh allotted to Bus 14")).toBeInTheDocument();
  });

  it("unallots the attendant, and re-picking the current driver writes nothing", async () => {
    seed({ tr_buses: [bus14, bus15], tr_crew: crew, students: kids });
    const { user } = renderUI(<BusesPanel openBusId="bus_01" onOpenBus={vi.fn()} />);
    const d = dialog("Bus 14");
    await user.selectOptions(field("Driver", d), "crw_001");
    expect(writes).toHaveLength(0);
    await user.selectOptions(field("Attendant (bus staff)", d), "");
    expect(getRow("tr_buses", "bus_01")).not.toHaveProperty("attendantId");
    expect(getRow("tr_crew", "crw_002")).not.toHaveProperty("busId");
    expect(await screen.findByText("Suresh Yadav removed from Bus 14")).toBeInTheDocument();
  });
});
