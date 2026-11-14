import { describe, expect, it } from "vitest";
import { StudentTransportCard } from "./StudentTransportCard";
import type { Student } from "./StudentsView";
import { dialog, field, getRow, renderUI, screen, seed, within, writesTo } from "@/test/render";

const student: Student = {
  id: "stu_001", name: "Riya", grn: "GIS-1", grade: "5", section: "A", guardian: "Parent",
  phone: "9000000000", attendance: 100, status: "Active",
};
const bus = {
  id: "bus_01", number: "14", regNo: "KL-07-AB-1234", status: "Active", capacity: 1,
  studentCount: 0, endPoint: "Edappally", stops: [{ id: "stop_01", name: "Junction" }],
};

describe("Student profile transport", () => {
  it("assigns a bus and optional stop directly from the transport card", async () => {
    seed({ students: [student], tr_buses: [bus, { ...bus, id: "inactive", number: "99", status: "Inactive" }] });
    const { user } = renderUI(<StudentTransportCard student={student} students={[student]} />);
    await user.click(screen.getByRole("button", { name: "Assign Bus" }));
    const form = dialog("Assign Bus");
    expect(within(form).queryByRole("option", { name: /Bus 99/ })).not.toBeInTheDocument();
    await user.selectOptions(field("Bus", form), bus.id);
    await user.selectOptions(field("Bus stop", form), "stop_01");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).toMatchObject({ busId: bus.id, bus: "Bus 14", busStopId: "stop_01", busStop: "Junction" });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 1 });
  });

  it("shows a capacity error and keeps the student on the old bus when the selected bus is full", async () => {
    const assigned = { ...student, busId: "old_bus", bus: "Bus 12" };
    const other = { ...student, id: "other", busId: bus.id };
    const oldBus = { ...bus, id: "old_bus", number: "12", studentCount: 1 };
    seed({ students: [assigned, other], tr_buses: [{ ...bus, studentCount: 1 }, oldBus] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned, other]} />);
    await user.click(screen.getByRole("button", { name: "Change Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(await within(form).findByRole("alert")).toHaveTextContent("0 seats left");
    expect(writesTo("students")).toHaveLength(0);
    expect(getRow("students", student.id)).toMatchObject({ busId: "old_bus" });
  });

  it("moves the student and clears the previous stop when the new bus has no stops", async () => {
    const assigned = { ...student, busId: "old_bus", bus: "Bus 12", busStopId: "old_stop", busStop: "Old stop" };
    const oldBus = { ...bus, id: "old_bus", number: "12", studentCount: 1 };
    seed({ students: [assigned], tr_buses: [{ ...bus, stops: [] }, oldBus] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned]} />);
    await user.click(screen.getByRole("button", { name: "Change Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), bus.id);
    expect(within(form).queryByLabelText("Bus stop")).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    const saved = getRow("students", student.id);
    expect(saved).toMatchObject({ busId: bus.id });
    expect(saved).not.toHaveProperty("busStopId");
    expect(saved).not.toHaveProperty("busStop");
    expect(getRow("tr_buses", "old_bus")).toMatchObject({ studentCount: 0 });
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 1 });
  });

  it("removes the bus assignment and releases its seat", async () => {
    const assigned = { ...student, busId: bus.id, bus: "Bus 14", busStopId: "stop_01", busStop: "Junction" };
    seed({ students: [assigned], tr_buses: [{ ...bus, studentCount: 1 }] });
    const { user } = renderUI(<StudentTransportCard student={assigned} students={[assigned]} />);
    await user.click(screen.getByRole("button", { name: "Change Bus" }));
    const form = dialog("Assign Bus");
    await user.selectOptions(field("Bus", form), "");
    await user.click(within(form).getByRole("button", { name: "Save assignment" }));
    expect(getRow("students", student.id)).not.toHaveProperty("busId");
    expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 0 });
  });
});
