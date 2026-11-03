import { describe, expect, it, vi } from "vitest";
import { fireEvent } from "@testing-library/react";
import { BusesPanel } from "./BusesPanel";
import { dialog, field, fieldError, getRow, renderUI, screen, seed, within, writes, writesTo } from "@/test/render";

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
  it("shows the required-field errors and writes nothing", async () => {
    const { user, d } = await openAdd();
    await user.clear(field("Capacity (seats)", d));
    await user.click(save(d));
    expect(fieldError("Bus number", d)).toBe("Bus number is required");
    expect(fieldError("Registration no", d)).toBe("Registration number is required");
    expect(fieldError("Capacity (seats)", d)).toBe("Enter the seat count (a whole number, 1 to 120)");
    expect(fieldError("Route name", d)).toBe("Route name is required");
    expect(writes).toHaveLength(0);
  });

  it("rejects a malformed registration, a fractional capacity and duplicates of another bus", async () => {
    seed({ tr_buses: [bus14] });
    const { user, d } = await openAdd();
    await user.type(field("Bus number", d), "14");
    await user.type(field("Registration no", d), "BUS-FOURTEEN");
    await user.clear(field("Capacity (seats)", d)); await user.type(field("Capacity (seats)", d), "40.5");
    await user.type(field("Route name", d), "Route 9");
    await user.click(save(d));
    expect(fieldError("Bus number", d)).toBe("Another bus has this number");
    expect(fieldError("Registration no", d)).toBe("Enter a registration number like DL-01-AB-4092");
    expect(fieldError("Capacity (seats)", d)).toBe("Enter the seat count (a whole number, 1 to 120)");
    await user.clear(field("Registration no", d)); await user.type(field("Registration no", d), "dl 01 ab 4092");
    await user.click(save(d));
    expect(fieldError("Registration no", d)).toBe("Another bus has this registration number");
    expect(writes).toHaveLength(0);
  });

  it("checks stop names and that times run in route order", async () => {
    const { user, d } = await openAdd();
    await user.type(field("Bus number", d), "16");
    await user.type(field("Registration no", d), "DL-01-AB-7000");
    await user.type(field("Route name", d), "Route 7");
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("Every stop needs a name");
    const names = within(d).getAllByLabelText("Stop name");
    await user.type(names[0]!, "Saket");
    await user.type(names[1]!, " saket");
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent('Two stops are named "saket"');
    await user.clear(names[1]!); await user.type(names[1]!, "Malviya Nagar");
    const pick = within(d).getAllByLabelText("Pickup time");
    setVal(pick[0]!, "07:00"); setVal(pick[1]!, "06:55");
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("Stop 2 (Malviya Nagar): pickup time is earlier than the stop before it");
    setVal(pick[0]!, "06:30");
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("Stop 1 (Saket): pickup time is before the pickup start (06:45)");
    setVal(pick[0]!, "06:50"); setVal(pick[1]!, "07:05");
    const drop = within(d).getAllByLabelText("Drop time");
    setVal(drop[1]!, "");
    await user.click(save(d));
    expect(within(d).getByRole("alert")).toHaveTextContent("Stop 2 (Malviya Nagar) needs pickup and drop times (HH:mm)");
    expect(writes).toHaveLength(0);
  });

  it("writes the contract bus doc with ordered stops when valid", async () => {
    seed({ tr_buses: [bus14] });
    const { user, d } = await openAdd();
    await user.type(field("Bus number", d), " 16 ");
    await user.type(field("Registration no", d), "dl 01 ab 7000");
    await user.clear(field("Capacity (seats)", d)); await user.type(field("Capacity (seats)", d), "32");
    await user.type(field("Route name", d), "Route 7");
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    await user.click(within(d).getByRole("button", { name: "Add stop" }));
    const names = within(d).getAllByLabelText("Stop name");
    await user.type(names[0]!, "Saket"); await user.type(names[1]!, "Malviya Nagar");
    const pick = within(d).getAllByLabelText("Pickup time"), drop = within(d).getAllByLabelText("Drop time");
    setVal(pick[0]!, "06:50"); setVal(pick[1]!, "07:02"); setVal(drop[0]!, "15:40"); setVal(drop[1]!, "15:52");
    // reorder and back: route order is the array order
    await user.click(within(d).getAllByRole("button", { name: "Move down" })[0]!);
    await user.click(within(d).getAllByRole("button", { name: "Move down" })[0]!);
    await user.click(save(d));
    expect(writesTo("tr_buses")).toHaveLength(1);
    expect(getRow("tr_buses", "bus_02")).toMatchObject({
      number: "16", regNo: "DL-01-AB-7000", capacity: 32, routeName: "Route 7", pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 0,
      stops: [{ id: "stp_01", name: "Saket", pickupTime: "06:50", dropTime: "15:40" }, { id: "stp_02", name: "Malviya Nagar", pickupTime: "07:02", dropTime: "15:52" }],
      updatedBy: "admin_uid",
    });
    expect(await screen.findByText("Bus added")).toBeInTheDocument();
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
