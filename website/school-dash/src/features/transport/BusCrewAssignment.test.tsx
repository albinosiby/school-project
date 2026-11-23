import { expect, it } from "vitest";
import { authState, failNextWrite, field, getRow, renderUI, screen, seed, within, writes } from "@/test/render";
import { BusDetailsView } from "./BusDetailsView";
import type { Bus, Crew, CrewRole } from "./types";

const bus: Bus = { id: "bus_one", number: "14", regNo: "KL-07-AB-7000", capacity: 30, routeName: "North route",
  stops: [], pickupStart: "06:45", dropStart: "15:30", studentCount: 0, status: "Active",
  driverId: "driver_one", driver: "Ravi Kumar", attendantId: "attendant_one", attendant: "Sita Kumar" };
const crew: Crew[] = [
  { id: "driver_one", name: "Ravi Kumar", empId: "EMP-014", role: "driver", status: "Active", phone: "9000000014", email: "driver@example.test", busId: bus.id, bus: "Bus 14" },
  { id: "attendant_one", name: "Sita Kumar", empId: "EMP-015", role: "attendant", status: "Active", phone: "9000000015", email: "attendant@example.test", busId: bus.id, bus: "Bus 14" },
];

it("keeps assignment controls only in the bottom Crew section and excludes inactive candidates", () => {
  seed({ tr_buses: [bus], tr_crew: [...crew,
    { ...crew[0], id: "inactive", name: "Inactive driver", status: "Inactive" },
    { ...crew[1], id: "on_leave", name: "Leave attendant", status: "On leave" },
  ] });
  renderUI(<BusDetailsView busId={bus.id} />);
  expect(screen.getAllByRole("combobox")).toHaveLength(2);
  for (const [title, name, phone] of [["Assigned driver", "Ravi Kumar", "9000000014"], ["Assigned attendant", "Sita Kumar", "9000000015"]]) {
    const summary = within(screen.getByRole("heading", { name: title }).closest("div")!.parentElement!);
    expect(summary.queryByRole("combobox")).not.toBeInTheDocument();
    expect(summary.getAllByRole("term").map((item) => item.textContent)).toEqual(["Name", "Mobile number"]);
    expect(summary.getByText(name)).toBeInTheDocument();
    expect(summary.getByText(phone)).toBeInTheDocument();
  }
  const drivers = within(field("Driver"));
  const attendants = within(field("Attendant (bus staff)"));
  expect(drivers.getByRole("option", { name: /Ravi Kumar/ })).toBeInTheDocument();
  expect(drivers.queryByRole("option", { name: /Sita Kumar|Inactive driver/ })).not.toBeInTheDocument();
  expect(attendants.queryByRole("option", { name: /Ravi Kumar/ })).not.toBeInTheDocument();
  expect(attendants.getByRole("option", { name: /Leave attendant.*On leave/ })).toBeInTheDocument();
  expect(writes).toHaveLength(0);
});

it.each<CrewRole>(["driver", "attendant"])("assigns and unassigns a %s from the bottom Crew section and synchronizes both buses", async (role) => {
  const idKey = role === "driver" ? "driverId" : "attendantId";
  const previous = crew.find((member) => member.role === role)!;
  const next: Crew = { ...previous, id: "replacement", name: "Replacement crew", busId: "bus_two", bus: "Bus 15" };
  const other: Bus = { ...bus, id: "bus_two", number: "15", [idKey]: next.id, [role]: next.name };
  seed({ tr_buses: [bus, other], tr_crew: [...crew, next] });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  expect(within(field(role === "driver" ? "Driver" : "Attendant (bus staff)")).getByRole("option", { name: /on Bus 15/ })).toBeInTheDocument();
  await user.selectOptions(field(role === "driver" ? "Driver" : "Attendant (bus staff)"), next.id);
  expect(getRow("tr_buses", bus.id)).toMatchObject({ [idKey]: next.id, [role]: next.name, routeName: bus.routeName });
  expect(getRow("tr_buses", other.id)).not.toHaveProperty(idKey);
  expect(getRow("tr_crew", next.id)).toMatchObject({ busId: bus.id, bus: "Bus 14" });
  expect(getRow("tr_crew", previous.id)).not.toHaveProperty("busId");
  const lowerPanel = screen.getByRole("region", { name: "Bus assignments" });
  const label = role === "driver" ? "Driver" : "Attendant (bus staff)";
  expect(field(label, lowerPanel)).toHaveValue(next.id);
  await user.selectOptions(field(role === "driver" ? "Driver" : "Attendant (bus staff)"), "");
  expect(getRow("tr_buses", bus.id)).not.toHaveProperty(idKey);
  expect(getRow("tr_crew", next.id)).not.toHaveProperty("busId");
  expect(field(label, lowerPanel)).toHaveValue("");
});

it.each([
  { kind: "missing crew", driverId: "missing_driver", driver: "Removed driver" },
  { kind: "legacy name", driverId: "", driver: "Legacy driver" },
  { kind: "inactive crew", driverId: "inactive_driver", driver: "Inactive driver" },
])("clears a $kind assignment without changing the attendant", async ({ driverId, driver }) => {
  seed({ tr_buses: [{ ...bus, driverId, driver }], tr_crew: [crew[1],
    { ...crew[0], id: "inactive_driver", name: "Inactive driver", status: "Inactive" },
  ] });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  expect(field("Driver")).toHaveValue(driverId || "__legacy__");
  await user.selectOptions(field("Driver"), "");
  expect(getRow("tr_buses", bus.id)).not.toHaveProperty("driverId");
  expect(getRow("tr_buses", bus.id)).not.toHaveProperty("driver");
  expect(getRow("tr_buses", bus.id)).toMatchObject({ attendantId: bus.attendantId, attendant: bus.attendant });
});

it("clears a stale bus reference without unassigning the driver from their actual bus", async () => {
  const other = { ...bus, id: "bus_two", number: "15" };
  seed({ tr_buses: [bus, other], tr_crew: [{ ...crew[0], busId: other.id, bus: "Bus 15" }, crew[1]] });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  await user.selectOptions(field("Driver"), "");
  expect(getRow("tr_buses", bus.id)).not.toHaveProperty("driverId");
  expect(getRow("tr_buses", other.id)).toMatchObject({ driverId: crew[0].id });
  expect(getRow("tr_crew", crew[0].id)).toMatchObject({ busId: other.id });
});

it("preserves the current assignment on a failed save and allows retry", async () => {
  const next = { ...crew[0], id: "replacement", name: "Replacement driver", busId: "", bus: "" };
  seed({ tr_buses: [bus], tr_crew: [...crew, next] });
  const { user } = renderUI(<BusDetailsView busId={bus.id} />);
  failNextWrite();
  await user.selectOptions(field("Driver"), next.id);
  expect(getRow("tr_buses", bus.id)).toMatchObject({ driverId: crew[0].id });
  expect(field("Driver")).toHaveValue(crew[0].id);
  const card = screen.getByRole("region", { name: "Bus assignments" });
  expect(within(card).getByText("Could not update the driver. Try again.")).toBeInTheDocument();
  expect(writes).toHaveLength(0);
  await user.selectOptions(field("Driver"), next.id);
  expect(getRow("tr_buses", bus.id)).toMatchObject({ driverId: next.id });
});

it("hides assignment controls from unauthorized accounts", () => {
  seed({ tr_buses: [bus], tr_crew: crew });
  authState.user = { ...authState.user!, role: "staff" };
  renderUI(<BusDetailsView busId={bus.id} />);
  expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  expect(writes).toHaveLength(0);
});
