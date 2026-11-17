import { describe, expect, it } from "vitest";
import { StudentTransportCard } from "./StudentTransportCard";
import type { Student } from "./StudentsView";
import { dialog, failNextWrite, field, getRow, renderUI, screen, seed, within, writesTo } from "@/test/render";

const student: Student = {
  id: "stu_001", name: "Riya", grn: "GIS-1", grade: "5", section: "A", guardian: "Parent",
  phone: "9000000000", attendance: 100, status: "Active",
};
const bus = {
  id: "bus_01", number: "14", regNo: "KL-07-AB-1234", status: "Active", capacity: 1,
  studentCount: 0, endPoint: "Edappally", stops: [{ id: "stop_01", name: "Junction" }],
};

describe("Student profile transport", () => {
  it("assigns a bus and an existing stop selected from typing suggestions", async () => {
    seed({ students: [student], tr_buses: [bus, { ...bus, id: "inactive", number: "99", status: "Inactive" }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    expect(within(form).queryByRole("option", { name: /Bus 99/ })).not.toBeInTheDocument();
    await user.selectOptions(field("Bus", form), bus.id);
    await user.type(field("Bus stop", form), "Junc");
    await user.click(within(form).getByRole("option", { name: "Junction" }));
    await user.type(field("Transport fee amount (₹)", form), "750.50");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).toMatchObject({ busId: bus.id, bus: "Bus 14", busStopId: "stop_01", busStop: "Junction" });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 1 });
    expect(getRow("student_transport_fees", student.id)).toMatchObject({ amount: 750.5, busId: bus.id, busAssignmentRevision: 1 });
  });

  it("shows a capacity error and keeps the student on the old bus when the selected bus is full", async () => {
    const assigned = { ...student, busId: "old_bus", bus: "Bus 12" };
    const other = { ...student, id: "other", busId: bus.id };
    const oldBus = { ...bus, id: "old_bus", number: "12", studentCount: 1 };
    seed({ students: [assigned, other], tr_buses: [{ ...bus, studentCount: 1 }, oldBus] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned, other]} />);
    await user.click(screen.getByRole("button", { name: "Edit transport" }));
    const form = dialog("Edit transport");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.type(field("Bus stop", form), "Junction");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("0 seats left");
    expect(writesTo("students")).toHaveLength(0);
    expect(getRow("students", student.id)).toMatchObject({ busId: "old_bus" });
  });

  it("adds a name-only stop to a bus with no stops while moving the student", async () => {
    const assigned = { ...student, busId: "old_bus", bus: "Bus 12", busStopId: "old_stop", busStop: "Old stop" };
    const oldBus = { ...bus, id: "old_bus", number: "12", studentCount: 1 };
    seed({ students: [assigned], tr_buses: [{ ...bus, stops: [] }, oldBus] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned]} />);
    await user.click(screen.getByRole("button", { name: "Edit transport" }));
    const form = dialog("Edit transport");
    await user.selectOptions(field("Bus", form), bus.id);
    expect(field("Bus stop", form)).toHaveValue("");
    await user.type(field("Bus stop", form), "  Central   Junction  ");
    await user.click(within(form).getByRole("option", { name: /Add.*Central Junction/ }));
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    const saved = getRow("students", student.id);
    expect(saved).toMatchObject({ busId: bus.id, busStopId: "stp_01", busStop: "Central Junction" });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: [{ id: "stp_01", name: "Central Junction", pickupTime: "", dropTime: "" }] });
    expect(getRow("tr_buses", "old_bus")).toMatchObject({ studentCount: 0 });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 1 });
  });

  it("removes the bus assignment and releases its seat", async () => {
    const assigned = { ...student, busId: bus.id, bus: "Bus 14", busStopId: "stop_01", busStop: "Junction" };
    seed({ students: [assigned], tr_buses: [{ ...bus, studentCount: 1 }] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned]} />);
    await user.click(screen.getByRole("button", { name: "Edit transport" }));
    const form = dialog("Edit transport");
    await user.selectOptions(field("Bus", form), "");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).not.toHaveProperty("busId");
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 0 });
  });

  it("requires a stop before assigning a bus and writes nothing while typing or cancelling", async () => {
    seed({ students: [student], tr_buses: [{ ...bus, stops: [] }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(within(form).getByText("Enter a bus stop name.")).toBeInTheDocument();
    await user.type(field("Bus stop", form), "New Junction");
    expect(writesTo("tr_buses")).toHaveLength(0);
    await user.click(within(form).getByRole("button", { name: "Cancel" }));
    expect(writesTo("tr_buses")).toHaveLength(0);
    expect(writesTo("students")).toHaveLength(0);
  });

  it("prioritizes this bus's stops, deduplicates names and supports keyboard selection", async () => {
    seed({ students: [student], tr_buses: [bus, { ...bus, id: "other", number: "15", stops: [
      { id: "same", name: "  JUNCTION " }, { id: "east", name: "East Junction" },
    ] }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.type(field("Bus stop", form), "Junc");
    const options = within(form).getAllByRole("option").filter((option) => option.tagName === "BUTTON");
    expect(options.map((option) => option.textContent)).toEqual(["Junction", "East Junction · Add to this bus", "Add “Junc”"]);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(field("Bus stop", form)).toHaveValue("Junction");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).toMatchObject({ busStopId: "stop_01" });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: bus.stops });
  });

  it("reuses a name from another bus without copying that route's timings", async () => {
    seed({ students: [student], tr_buses: [{ ...bus, stops: [] }, { ...bus, id: "other", number: "15", stops: [
      { id: "other_stop", name: "Market Road", pickupTime: "07:00", dropTime: "16:00" },
    ] }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.type(field("Bus stop", form), "Market");
    await user.click(within(form).getByRole("option", { name: "Market Road · Add to this bus" }));
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).toMatchObject({ busStop: "Market Road", busStopId: "stp_01" });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: [{ name: "Market Road", pickupTime: "", dropTime: "" }] });
    expect(writesTo("tr_buses").map((write) => write.id)).toEqual([bus.id]);
  });

  it("retains a typed stop after a failed save and creates it only on a successful retry", async () => {
    seed({ students: [student], tr_buses: [{ ...bus, stops: [] }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.type(field("Bus stop", form), "Library");
    failNextWrite(new Error("Could not save. Try again."));
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Could not save");
    expect(field("Bus stop", form)).toHaveValue("Library");
    expect(writesTo("students")).toHaveLength(0);
    expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: [] });
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).toMatchObject({ busStop: "Library" });
  });
});


it("edits only the transport amount from student details without changing the bus or its occupancy", async () => {
  const assigned = { ...student, busId: bus.id, bus: "Bus 14", busStopId: "stop_01", busStop: "Junction" };
  seed({ students: [assigned], tr_buses: [{ ...bus, studentCount: 1 }], student_transport_fees: [
    { id: student.id, studentId: student.id, busId: bus.id, monthlyAmount: 900, busAssignmentRevision: 0, revision: 1 },
  ] });
  const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned]} />);
  expect(screen.getByText("₹900")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Edit transport" }));
  const form = dialog("Edit transport");
  expect(field("Transport fee amount (₹)", form)).toHaveValue("900");
  await user.clear(field("Transport fee amount (₹)", form));
  await user.type(field("Transport fee amount (₹)", form), "600");
  await user.click(within(form).getByRole("button", { name: "Save assignment" }));
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ amount: 600, revision: 2 });
  expect(getRow("student_transport_fees", student.id)).not.toHaveProperty("monthlyAmount");
  expect(screen.getByText("₹600")).toBeInTheDocument();
  expect(writesTo("students")).toHaveLength(0);
  expect(writesTo("tr_buses")).toHaveLength(0);
});

it("retains invalid fee drafts without writing and cancels changes to amount and stop", async () => {
  seed({ students: [student], tr_buses: [bus] });
  const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
  await user.click(screen.getByRole("button", { name: "Assign Bus" }));
  const form = dialog("Assign Bus");
  await user.selectOptions(field("Bus", form), bus.id);
  await user.type(field("Bus stop", form), "New stop");
  await user.type(field("Transport fee amount (₹)", form), "-2");
  await user.click(within(form).getByRole("button", { name: "Save assignment" }));
  expect(within(form).getByText(/Enter an amount from ₹0/)).toBeInTheDocument();
  expect(field("Transport fee amount (₹)", form)).toHaveValue("-2");
  await user.click(within(form).getByRole("button", { name: "Cancel" }));
  expect(writesTo("students")).toHaveLength(0);
  expect(writesTo("student_transport_fees")).toHaveLength(0);
});
