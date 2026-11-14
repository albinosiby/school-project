import { describe, expect, it } from "vitest";
import { BusDetailsView } from "./BusDetailsView";
import { BusesPanel } from "./BusesPanel";
import { TransportView } from "./TransportView";
import type { Bus } from "./types";
import { authState, dialog, field, getRow, renderUI, router, screen, seed, setUrl, within, writes } from "@/test/render";

const bus: Bus = {
  id: "bus_01", number: "14", regNo: "KL-07-AB-7000", displayName: "North Campus Bus", vehicleType: "School Bus",
  model: "Starbus", manufacturingYear: 2024, chassisNumber: "CHASSIS14", engineNumber: "ENGINE14", fuelType: "Diesel",
  routeName: "North Route", endPoint: "Edappally Junction", capacity: 5, totalSeats: 7, studentCount: 99,
  pickupStart: "06:45", dropStart: "15:30", status: "Active", monthlyFee: 1200, note: "Use the north gate.",
  driverId: "driver_01", driver: "Old driver name", attendantId: "attendant_01", attendant: "Old attendant name",
  registrationDate: "2024-01-10", registrationValidUntil: "2039-01-09",
  fitnessCertificateNumber: "FIT-014", fitnessExpiryDate: "2027-01-09",
  insurancePolicyNumber: "INS-014", insuranceProvider: "School Vehicle Insurance", insuranceExpiryDate: "2027-02-10",
  permitNumber: "PERMIT-014", permitType: "School transport", permitExpiryDate: "2027-03-10",
  pollutionCertificateNumber: "PUC-014", pucExpiryDate: "2027-04-10", roadTaxValidUntil: "2027-05-10",
  acAvailable: true, gpsInstalled: false, firstAidKit: true, fireExtinguisher: false,
  lastServiceDate: "2026-10-01", nextServiceDate: "2027-01-01", odometerKm: 18000, serviceIntervalKm: 5000,
  lastInspectionDate: "2026-10-15", maintenanceNotes: "Replace the rear tyres at the next service.",
  stops: [{ id: "stop_01", name: "Metro Gate", pickupTime: "06:45", dropTime: "15:45", landmark: "Gate 2" },
    { id: "stop_02", name: "Market Road", pickupTime: "07:00", dropTime: "16:00" }],
};
const crew = [
  { id: "driver_01", staffId: "staff_driver", name: "Ravi Kumar", empId: "EMP-014", role: "driver", status: "Active", phone: "9000000014", email: "driver@example.test", licenseNo: "KL-LIC-014", licenseExpiry: "2029-01-01" },
  { id: "attendant_01", name: "Sita Kumar", empId: "EMP-015", role: "attendant", status: "Active", phone: "9000000015", email: "attendant@example.test" },
];
const students = [
  { id: "student_01", name: "Aarav", grn: "GRN-001", grade: "8", section: "A", guardian: "Parent One", busId: bus.id, busStopId: "stop_01" },
  { id: "student_02", name: "Ananya", grn: "GRN-002", grade: "9", section: "B", guardian: "Parent Two", busId: bus.id, busStopId: "removed_stop" },
  { id: "deleted", name: "Deleted student", grn: "GRN-003", busId: bus.id, deleted: true },
  { id: "other_student", name: "Other bus student", busId: "bus_02" },
];

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("div")!;
const valueOf = (title: string, label: string) => within(card(title)).getByText(label, { selector: "dt" }).nextElementSibling;

describe("Bus details page", () => {
  it("opens the full page from a bus row and preserves a normal link", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusesPanel />);
    const link = screen.getByRole("link", { name: "Bus 14" });
    expect(link).toHaveAttribute("href", "/transport/buses/bus_01");
    await user.click(link.closest("tr")!);
    expect(router.push).toHaveBeenCalledWith("/transport/buses/bus_01");
  });

  it("shows the selected bus's complete saved record with live occupancy and crew details", async () => {
    seed({ tr_buses: [bus, { ...bus, id: "bus_02", number: "15", chassisNumber: "OTHER-CHASSIS" }], tr_crew: crew, students });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    expect(screen.getByRole("heading", { name: "Bus 14", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to buses" })).toHaveAttribute("href", "/transport");
    for (const [label, value] of [["Bus ID", bus.id], ["Vehicle type", "School Bus"], ["Chassis number", "CHASSIS14"],
      ["Engine number", "ENGINE14"], ["Manufacturing year", "2024"], ["Fuel type", "Diesel"]]) {
      expect(valueOf("Vehicle details", label!)).toHaveTextContent(value!);
    }
    expect(screen.queryByText("OTHER-CHASSIS")).not.toBeInTheDocument();
    expect(valueOf("Route and seating", "Assigned students")).toHaveTextContent("2");
    expect(valueOf("Route and seating", "Available student seats")).toHaveTextContent("3");
    expect(valueOf("Route and seating", "Total seating capacity")).toHaveTextContent("7");
    expect(valueOf("Route and seating", "Pickup starts")).toHaveTextContent("06:45 AM");
    expect(valueOf("Route and seating", "Drop starts")).toHaveTextContent("03:30 PM");
    expect(valueOf("Route and seating", "Note")).toHaveTextContent("Use the north gate.");
    for (const [label, value] of [["Fitness certificate number", "FIT-014"], ["Insurance policy number", "INS-014"],
      ["Insurance provider", "School Vehicle Insurance"], ["Permit number", "PERMIT-014"],
      ["Pollution certificate number", "PUC-014"], ["Road tax valid until", "10 May 2027"]]) {
      expect(valueOf("Registration and compliance", label!)).toHaveTextContent(value!);
    }
    expect(valueOf("Maintenance", "Current odometer reading (km)")).toHaveTextContent("18000");
    expect(valueOf("Maintenance", "Maintenance notes")).toHaveTextContent(bus.maintenanceNotes!);
    expect(valueOf("Safety and equipment", "AC available")).toHaveTextContent("Yes");
    expect(valueOf("Safety and equipment", "GPS installed")).toHaveTextContent("No");
    expect(valueOf("Safety and equipment", "CCTV installed")).toHaveTextContent("Not recorded");
    expect(valueOf("Assigned driver", "Name")).toHaveTextContent("Ravi Kumar");
    expect(valueOf("Assigned driver", "Driving licence number")).toHaveTextContent("KL-LIC-014");
    expect(valueOf("Assigned attendant", "Mobile number")).toHaveTextContent("9000000015");
    expect(screen.getByRole("link", { name: "View staff profile" })).toHaveAttribute("href", "/staff/staff_driver");

    const assignments = screen.getByRole("region", { name: "Bus assignments" });
    await user.click(within(assignments).getByRole("tab", { name: /^Students/ }));
    expect(within(assignments).getByRole("link", { name: "Aarav" })).toHaveAttribute("href", "/students/student_01");
    expect(within(assignments).queryByText("Deleted student")).not.toBeInTheDocument();
    await user.click(within(assignments).getByRole("tab", { name: /^Stops/ }));
    const stops = within(assignments).getByRole("table", { name: "Route stops" });
    expect(within(stops).getAllByRole("row")[1]).toHaveTextContent("Metro Gate");
    expect(within(stops).getAllByRole("row")[2]).toHaveTextContent("Market Road");
    expect(within(stops).getByText("Gate 2")).toBeInTheDocument();
    expect(within(stops).getByText("No stop set").closest("tr")).toHaveTextContent("1");
    expect(writes).toHaveLength(0);
  });

  it("handles legacy records, zero values and missing fields without invented details", () => {
    seed({ tr_buses: [{ id: bus.id, number: "14", regNo: bus.regNo, capacity: 2, status: "Active", monthlyFee: 0, odometerKm: 0 }] });
    renderUI(<BusDetailsView busId={bus.id} />);
    expect(valueOf("Vehicle details", "Chassis number")).toHaveTextContent("Not recorded");
    expect(valueOf("Route and seating", "Total seating capacity")).toHaveTextContent("Not recorded");
    expect(valueOf("Route and seating", "Monthly fee per student")).toHaveTextContent("₹0");
    expect(valueOf("Maintenance", "Current odometer reading (km)")).toHaveTextContent("0");
    expect(valueOf("Safety and equipment", "GPS installed")).toHaveTextContent("Not recorded");
    expect(within(card("Assigned driver")).getByText("Not assigned.")).toBeInTheDocument();
  });

  it("saves vehicle edits while retaining route stops and assignments", async () => {
    seed({ tr_buses: [bus], tr_crew: crew, students });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Edit vehicle details" }));
    const editor = dialog("Vehicle details · Bus 14");
    await user.clear(field("Model", editor));
    await user.type(field("Model", editor), "Starbus Ultra");
    await user.click(within(editor).getByRole("button", { name: "Save vehicle details" }));
    expect(getRow("tr_buses", bus.id)).toMatchObject({ model: "Starbus Ultra", routeName: "North Route", stops: bus.stops, driverId: "driver_01", studentCount: 2 });
    expect(valueOf("Vehicle details", "Model")).toHaveTextContent("Starbus Ultra");
  });

  it("shows an unavailable state for missing buses or unauthorized accounts", () => {
    const missing = renderUI(<BusDetailsView busId="missing_bus" />);
    expect(screen.getByText("Bus record unavailable")).toBeInTheDocument();
    missing.unmount();
    seed({ tr_buses: [bus] });
    authState.user = { ...authState.user!, role: "staff" };
    renderUI(<BusDetailsView busId={bus.id} />);
    expect(screen.getByText("Bus record unavailable")).toBeInTheDocument();
    expect(screen.queryByText("CHASSIS14")).not.toBeInTheDocument();
  });

  it("redirects older bus links and keeps attendance links on their own screen", () => {
    setUrl("/transport?bus=bus_01");
    const oldLink = renderUI(<TransportView />);
    expect(router.replace).toHaveBeenCalledWith("/transport/buses/bus_01");
    oldLink.unmount();
    router.replace.mockClear();
    setUrl("/transport?tab=attendance&bus=bus_01");
    renderUI(<TransportView />);
    expect(router.replace).not.toHaveBeenCalled();
  });
});
