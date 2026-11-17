import { fireEvent } from "@testing-library/react";
import { saveBusEdit } from "./busRecords";
import { describe, expect, it } from "vitest";
import { BusDetailsView } from "./BusDetailsView";
import { BusesPanel } from "./BusesPanel";
import { TransportView } from "./TransportView";
import type { Bus } from "./types";
import { ADMIN_UID, failNextWrite, rowsOf, authState, dialog, field, getRow, renderUI, router, screen, seed, setUrl, within, writes } from "@/test/render";

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

const card = (title: string) => screen.getByRole("heading", { name: title }).closest("div")!.parentElement!;
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
    expect(screen.queryByText("Pickup starts")).not.toBeInTheDocument();
    expect(screen.queryByText("Drop starts")).not.toBeInTheDocument();
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
    expect(valueOf("Assigned driver", "Mobile number")).toHaveTextContent("9000000014");
    expect(valueOf("Assigned attendant", "Mobile number")).toHaveTextContent("9000000015");
    expect(screen.queryByRole("link", { name: "View staff profile" })).not.toBeInTheDocument();

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
    expect(screen.queryByText("Expected monthly fees")).not.toBeInTheDocument();
    expect(valueOf("Maintenance", "Current odometer reading (km)")).toHaveTextContent("0");
    expect(valueOf("Safety and equipment", "GPS installed")).toHaveTextContent("Not recorded");
    expect(within(card("Assigned driver")).getByText("Not assigned.")).toBeInTheDocument();
  });

  it("searches the roster and keeps student selection in a cancellable drawer across filters", async () => {
    seed({ tr_buses: [bus], tr_crew: crew, students: [...students,
      { id: "new_student", name: "New pupil", grn: "GRN-010", grade: "LKG", section: "A" },
    ] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    const assignments = screen.getByRole("region", { name: "Bus assignments" });
    await user.click(within(assignments).getByRole("tab", { name: /^Students/ }));
    expect(within(assignments).queryByRole("checkbox")).not.toBeInTheDocument();
    await user.type(within(assignments).getByPlaceholderText("Search assigned students or stops…"), "Metro");
    expect(within(assignments).getByRole("link", { name: "Aarav" })).toBeInTheDocument();
    expect(within(assignments).queryByRole("link", { name: "Ananya" })).not.toBeInTheDocument();
    await user.click(within(assignments).getByRole("button", { name: "Add students" }));
    const panel = dialog("Add students");
    await user.selectOptions(within(panel).getByLabelText("Grade"), "LKG");
    expect(within(panel).queryByLabelText("Select Other bus student")).not.toBeInTheDocument();
    await user.click(within(panel).getByLabelText("Select New pupil"));
    await user.type(within(panel).getByPlaceholderText("Search name, GRN, guardian…"), "no match");
    expect(within(panel).getByRole("button", { name: "Add 1 student" })).toBeEnabled();
    await user.clear(within(panel).getByPlaceholderText("Search name, GRN, guardian…"));
    expect(within(panel).getByLabelText("Select New pupil")).toBeChecked();
    await user.click(within(panel).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog", { name: "Add students" })).not.toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("opens the stop editor from the route tab without changing saved stops on cancel", async () => {
    seed({ tr_buses: [bus], tr_crew: crew, students });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    const assignments = screen.getByRole("region", { name: "Bus assignments" });
    await user.click(within(assignments).getByRole("tab", { name: /^Stops/ }));
    await user.click(within(assignments).getByRole("button", { name: "Edit stops" }));
    const editor = dialog("Edit Bus 14");
    expect(within(editor).getAllByLabelText("Stop name")[0]).toHaveValue("Metro Gate");
    await user.click(within(editor).getByRole("button", { name: "Cancel" }));
    expect(writes).toHaveLength(0);
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

  it("edits a single final stop name without requiring bus start times or changing route stops", async () => {
    seed({ tr_buses: [{ ...bus, routeName: bus.endPoint, pickupStart: "", dropStart: "" }], tr_crew: crew, students });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Edit bus" }));
    const editor = dialog("Edit Bus 14");
    expect(within(editor).queryByLabelText("Pickup starts")).not.toBeInTheDocument();
    expect(within(editor).queryByLabelText("Drop starts")).not.toBeInTheDocument();
    expect(within(editor).queryByLabelText("Route name")).not.toBeInTheDocument();
    const finalStop = field("Final stop name", editor);
    expect(finalStop).toHaveValue(bus.endPoint);
    await user.clear(finalStop);
    await user.click(within(editor).getByRole("button", { name: "Save Changes" }));
    expect(within(editor).getByText("Final stop name is required")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
    await user.type(finalStop, "  Town Junction  ");
    await user.click(within(editor).getByRole("button", { name: "Save Changes" }));
    expect(getRow("tr_buses", bus.id)).toMatchObject({ endPoint: "Town Junction", routeName: "Town Junction",
      pickupStart: "", dropStart: "", stops: bus.stops, driverId: bus.driverId, attendantId: bus.attendantId });
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

  it("edits legacy name-only stops without timing fields or pending warnings", async () => {
    const pending = { id: "stp_03", name: "Library", pickupTime: "", dropTime: "", timingPending: true };
    seed({ tr_buses: [{ ...bus, stops: [pending] }], tr_crew: crew, students });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("tab", { name: /Stops/ }));
    const table = screen.getByRole("table", { name: "Route stops" });
    expect(within(table).getAllByRole("columnheader").map((h) => h.textContent)).toEqual(["Order", "Stop", "Students"]);
    expect(screen.queryByText("Timings pending")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit stops" }));
    const form = dialog("Edit Bus 14");
    expect(within(form).queryByText(/Timings not configured/)).not.toBeInTheDocument();
    expect(within(form).queryByLabelText("Pickup time")).not.toBeInTheDocument();
    expect(within(form).queryByLabelText("Drop time")).not.toBeInTheDocument();
    await user.type(within(form).getByLabelText("Landmark"), "Main gate");
    await user.click(within(form).getByRole("button", { name: "Save Changes" }));
    const saved = getRow<Bus>("tr_buses", bus.id)!;
    expect(saved.stops).toEqual([{ id: "stp_03", name: "Library", pickupTime: "", dropTime: "", landmark: "Main gate" }]);
    expect(saved.pickupStart).toBe(bus.pickupStart);
    expect(saved.dropStart).toBe(bus.dropStart);
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


describe("Bus compliance updates", () => {
  it("updates only compliance fields and shows the recorded previous and new values", async () => {
    seed({ tr_buses: [bus], tr_bus_compliance_history: [{ id: "other", busId: "bus_02", updatedAt: "2099-01-01", changes: [{ field: "insurancePolicyNumber", before: "OTHER-OLD", after: "OTHER-NEW" }] }] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const form = dialog("Update registration and compliance");
    expect(within(form).queryByLabelText("Model")).not.toBeInTheDocument();
    await user.clear(field("Insurance policy number", form));
    await user.type(field("Insurance policy number", form), "INS-RENEWED");
    fireEvent.change(field("Insurance expiry date", form), { target: { value: "2028-02-10" } });
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(getRow("tr_buses", bus.id)).toMatchObject({ insurancePolicyNumber: "INS-RENEWED", insuranceExpiryDate: "2028-02-10", model: bus.model, stops: bus.stops });
    const entry = rowsOf("tr_bus_compliance_history").find((row) => row.busId === bus.id)!;
    expect(entry).toMatchObject({ busId: bus.id, updatedBy: ADMIN_UID, changes: [
      { field: "insurancePolicyNumber", before: "INS-014", after: "INS-RENEWED" },
      { field: "insuranceExpiryDate", before: "2027-02-10", after: "2028-02-10" },
    ] });
    expect(entry.updatedAt).toEqual(expect.any(String));
    await user.click(screen.getByRole("button", { name: "History" }));
    const history = screen.getByRole("region", { name: "Compliance history" });
    expect(history).toHaveTextContent("INS-014 → INS-RENEWED");
    expect(history).not.toHaveTextContent("OTHER-NEW");
  });

  it("validates dates, and cancelling creates no update or history entry", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Update" }));
    const form = dialog("Update registration and compliance");
    fireEvent.change(field("Registration valid until", form), { target: { value: "2020-01-01" } });
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(within(form).getByText("Registration expiry cannot precede the registration date")).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(writes).toHaveLength(0);
  });

  it("also records changes made through the existing vehicle editor", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Edit vehicle details" }));
    const form = dialog("Vehicle details · Bus 14");
    await user.clear(field("Fitness certificate number", form));
    await user.type(field("Fitness certificate number", form), "FIT-RENEWED");
    await user.click(within(form).getByRole("button", { name: "Save vehicle details" }));
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(1);
    expect(rowsOf("tr_bus_compliance_history")[0]).toMatchObject({ changes: [{ field: "fitnessCertificateNumber", before: "FIT-014", after: "FIT-RENEWED" }] });
  });

  it("rejects stale edits, preserves concurrent renewals on vehicle-only edits, and does not log failed or unchanged saves", async () => {
    seed({ tr_buses: [{ ...bus, insurancePolicyNumber: "NEWER" }] });
    await expect(saveBusEdit(bus, { insurancePolicyNumber: "STALE" }, [], [])).rejects.toThrow("changed in another window");
    expect(writes).toHaveLength(0);
    await saveBusEdit(bus, { insurancePolicyNumber: bus.insurancePolicyNumber, model: "New model" }, [], []);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ insurancePolicyNumber: "NEWER", model: "New model" });
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
    failNextWrite(new Error("Could not save"));
    const current = getRow<Bus>("tr_buses", bus.id)!;
    await expect(saveBusEdit(current, { insurancePolicyNumber: "FAILED" }, [], [])).rejects.toThrow("Could not save");
    expect(getRow("tr_buses", bus.id)?.insurancePolicyNumber).toBe("NEWER");
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
  });
});


describe("Compliance save integrity", () => {
  it("rejects a stale renewal and never creates history for failed or unchanged updates", async () => {
    seed({ tr_buses: [bus] });
    await saveBusEdit(bus, { insurancePolicyNumber: bus.insurancePolicyNumber }, [], []);
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
    const original = getRow<Bus>("tr_buses", bus.id)!;
    failNextWrite(new Error("Save failed"));
    await expect(saveBusEdit(original, { insurancePolicyNumber: "FAILED" }, [], [])).rejects.toThrow("Save failed");
    expect(getRow("tr_buses", bus.id)).toMatchObject({ insurancePolicyNumber: "INS-014" });
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
    seed({ tr_buses: [{ ...original, insurancePolicyNumber: "SAVED-ELSEWHERE" }] });
    await expect(saveBusEdit(original, { insurancePolicyNumber: "STALE" }, [], [])).rejects.toThrow("another window");
    expect(getRow("tr_buses", bus.id)).toMatchObject({ insurancePolicyNumber: "SAVED-ELSEWHERE" });
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
    // Untouched form values must not overwrite a concurrent compliance renewal.
    await saveBusEdit(original, { model: "Updated model", insurancePolicyNumber: original.insurancePolicyNumber }, [], []);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ model: "Updated model", insurancePolicyNumber: "SAVED-ELSEWHERE" });
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
  });
});

describe("Bus maintenance updates", () => {
  it("updates maintenance fields and shows old and new values, editor and saved time", async () => {
    seed({ tr_buses: [{ ...bus, odometerKm: 0 }], tr_bus_maintenance_history: [
      { id: "other_bus", busId: "bus_other", updatedAt: "2099-01-01", changes: [{ field: "maintenanceNotes", before: "OTHER", after: "OTHER-CHANGED" }] },
    ] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Update maintenance" }));
    const form = dialog("Update maintenance");
    expect(within(form).queryByLabelText("Insurance policy number")).not.toBeInTheDocument();
    await user.clear(field("Current odometer reading (km)", form));
    await user.type(field("Current odometer reading (km)", form), "20000");
    fireEvent.change(field("Next service date", form), { target: { value: "2027-03-01" } });
    await user.clear(field("Maintenance notes", form));
    await user.type(field("Maintenance notes", form), "Tyres replaced");
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(getRow("tr_buses", bus.id)).toMatchObject({ odometerKm: 20000, nextServiceDate: "2027-03-01", maintenanceNotes: "Tyres replaced", insurancePolicyNumber: bus.insurancePolicyNumber, stops: bus.stops });
    const history = rowsOf("tr_bus_maintenance_history").find((entry) => entry.busId === bus.id)!;
    expect(history).toMatchObject({ updatedBy: ADMIN_UID, updatedAt: expect.any(String), changes: expect.arrayContaining([
      { field: "odometerKm", before: 0, after: 20000 },
      { field: "nextServiceDate", before: bus.nextServiceDate, after: "2027-03-01" },
      { field: "maintenanceNotes", before: bus.maintenanceNotes, after: "Tyres replaced" },
    ]) });
    expect(history.editor).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Maintenance history" }));
    const panel = screen.getByRole("region", { name: "Maintenance history" });
    expect(panel).toHaveTextContent("0 → 20000");
    expect(panel).toHaveTextContent(String(history.editor));
    expect(panel).not.toHaveTextContent("OTHER-CHANGED");
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
  });

  it("validates service dates and whole-number readings; cancelling writes nothing", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Update maintenance" }));
    const form = dialog("Update maintenance");
    fireEvent.change(field("Next service date", form), { target: { value: "2020-01-01" } });
    fireEvent.change(field("Current odometer reading (km)", form), { target: { value: "2.5" } });
    fireEvent.change(field("Service interval (km)", form), { target: { value: "0" } });
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(within(form).getByText("Next service cannot precede the last service")).toBeInTheDocument();
    expect(within(form).getByText("Enter a nonnegative whole number")).toBeInTheDocument();
    expect(within(form).getByText("Enter a positive whole number")).toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(writes).toHaveLength(0);
  });

  it("keeps a failed draft for retry and creates only one history entry after a successful save", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Update maintenance" }));
    const form = dialog("Update maintenance");
    await user.clear(field("Maintenance notes", form));
    await user.type(field("Maintenance notes", form), "Service completed");
    failNextWrite(new Error("Could not save maintenance"));
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Could not save maintenance");
    expect(field("Maintenance notes", form)).toHaveValue("Service completed");
    expect(rowsOf("tr_bus_maintenance_history")).toHaveLength(0);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ maintenanceNotes: bus.maintenanceNotes });
    await user.click(within(form).getByRole("button", { name: "Save update" }));
    expect(rowsOf("tr_bus_maintenance_history")).toHaveLength(1);
  });

  it("records maintenance edits made through Edit vehicle details", async () => {
    seed({ tr_buses: [bus] });
    const { user } = renderUI(<BusDetailsView busId={bus.id} />);
    await user.click(screen.getByRole("button", { name: "Edit vehicle details" }));
    const form = dialog("Vehicle details · Bus 14");
    await user.clear(field("Maintenance notes", form));
    await user.type(field("Maintenance notes", form), "Vehicle inspection completed");
    await user.click(within(form).getByRole("button", { name: "Save vehicle details" }));
    expect(rowsOf("tr_bus_maintenance_history")).toEqual([expect.objectContaining({ busId: bus.id, changes: [
      { field: "maintenanceNotes", before: bus.maintenanceNotes, after: "Vehicle inspection completed" },
    ] })]);
  });

  it("rejects stale maintenance edits, preserves concurrent values in unrelated vehicle edits, and skips unchanged history", async () => {
    seed({ tr_buses: [{ ...bus, maintenanceNotes: "Updated elsewhere" }] });
    await expect(saveBusEdit(bus, { maintenanceNotes: "Stale draft" }, [], [])).rejects.toThrow("Maintenance details changed in another window");
    expect(writes).toHaveLength(0);
    await saveBusEdit(bus, { model: "New model", maintenanceNotes: bus.maintenanceNotes, odometerKm: bus.odometerKm }, [], []);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ model: "New model", maintenanceNotes: "Updated elsewhere" });
    expect(rowsOf("tr_bus_maintenance_history")).toHaveLength(0);
  });

  it("saves cleared numeric fields and keeps maintenance and compliance history atomic on failure", async () => {
    seed({ tr_buses: [bus] });
    failNextWrite();
    await expect(saveBusEdit(bus, { odometerKm: null, insurancePolicyNumber: "INS-NEW" }, [], [])).rejects.toThrow();
    expect(rowsOf("tr_bus_maintenance_history")).toHaveLength(0);
    expect(rowsOf("tr_bus_compliance_history")).toHaveLength(0);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ odometerKm: bus.odometerKm, insurancePolicyNumber: bus.insurancePolicyNumber });
    await saveBusEdit(bus, { odometerKm: null }, [], []);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ odometerKm: null });
    expect(rowsOf("tr_bus_maintenance_history")[0]).toMatchObject({ changes: [{ field: "odometerKm", before: bus.odometerKm, after: null }] });
  });
});
