import { expect, it } from "vitest";
import { failNextWrite, getRow, seed, writes } from "@/test/render";
import type { Student } from "@/features/people/StudentsView";
import { transportFeeVersion } from "./transportFees";
import { assignStudentBuses } from "./studentBusAssignment";
import type { Bus } from "./types";

const student: Student = { id: "one", name: "Riya", grn: "GIS-1", grade: "5", section: "A", guardian: "Parent", phone: "9000000000", attendance: 100, status: "Active" };
const bus: Bus = { id: "bus", number: "14", regNo: "KL-07-AB-1234", status: "Active", capacity: 2,
  studentCount: 0, routeName: "North", stops: [], pickupStart: "", dropStart: "" };

it("creates one stop for multiple students using the same normalized name in one transaction", async () => {
  const second = { ...student, id: "two" };
  seed({ students: [student, second], tr_buses: [bus] });
  await assignStudentBuses([
    { studentId: student.id, busId: bus.id, stopName: "  Central   Junction " },
    { studentId: second.id, busId: bus.id, stopName: "CENTRAL junction" },
  ], [student, second], [bus]);
  expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 2, stops: [{ id: "stp_01", name: "Central Junction", pickupTime: "", dropTime: "" }] });
  for (const id of [student.id, second.id]) expect(getRow("students", id)).toMatchObject({ busStopId: "stp_01", busStop: "Central Junction" });
});

it("reuses a concurrently added stop from the latest bus record and preserves other route entries", async () => {
  const latest = { ...bus, stops: [
    { id: "concurrent", name: "Central Junction", pickupTime: "07:00", dropTime: "16:00", landmark: "Gate" },
    { id: "another", name: "Library", pickupTime: "07:10", dropTime: "16:10" },
  ] };
  seed({ students: [student], tr_buses: [latest] });
  await assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: " central   JUNCTION " }], [student], [bus]);
  expect(getRow("students", student.id)).toMatchObject({ busStopId: "concurrent", busStop: "Central Junction" });
  expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: latest.stops });
});

it("does not create an orphan stop when capacity validation fails", async () => {
  const full = { ...bus, capacity: 1, studentCount: 1 };
  seed({ students: [student], tr_buses: [full] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "Library" }], [student], [full])).rejects.toThrow("0 seats left");
  expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: [] });
  expect(writes).toHaveLength(0);
});

it("rejects a concurrent change to the student's stop even if the bus is unchanged", async () => {
  const assigned = { ...student, busId: bus.id, busStopId: "old", busStop: "Old stop" };
  seed({ students: [{ ...assigned, busStopId: "changed", busStop: "Changed stop" }], tr_buses: [bus] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "Library" }], [assigned], [bus])).rejects.toThrow("assignment changed");
  expect(writes).toHaveLength(0);
});

it.each(["", "   ", "x".repeat(121)])("rejects an invalid new stop name without writing", async (stopName) => {
  seed({ students: [student], tr_buses: [bus] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName }], [student], [bus])).rejects.toThrow();
  expect(writes).toHaveLength(0);
});

it("saves distinct student amounts, new stops and seat counts in the same assignment transaction", async () => {
  const second = { ...student, id: "two" };
  seed({ students: [student, second], tr_buses: [bus], fee_invoices: [{ id: "issued", amount: 500, paid: 100 }] });
  await assignStudentBuses([
    { studentId: student.id, busId: bus.id, stopName: "Library", fee: { input: "750.50", expectedVersion: transportFeeVersion() } },
    { studentId: second.id, busId: bus.id, stopName: "Library", fee: { input: "0", expectedVersion: transportFeeVersion() } },
  ], [student, second], [bus]);
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ amount: 750.5, busId: bus.id, busAssignmentRevision: 1, revision: 1 });
  expect(getRow("student_transport_fees", second.id)).toMatchObject({ amount: 0, busAssignmentRevision: 1 });
  expect(getRow("students", student.id)).not.toHaveProperty("amount");
  expect(getRow("students", student.id)).not.toHaveProperty("transportFee");
  expect(getRow("tr_buses", bus.id)).toMatchObject({ studentCount: 2, stops: [{ name: "Library" }] });
  expect(getRow("fee_invoices", "issued")).toMatchObject({ amount: 500, paid: 100 });
});

it.each(["-5", "1.111", "1e3"])("rejects an invalid amount %s before creating a stop or assignment", async (input) => {
  seed({ students: [student], tr_buses: [bus] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "Library", fee: { input, expectedVersion: transportFeeVersion() } }], [student], [bus])).rejects.toThrow("Enter an amount");
  expect(writes).toHaveLength(0);
});

it("does not save an amount or orphan stop when the assignment commit fails", async () => {
  seed({ students: [student], tr_buses: [bus] });
  failNextWrite();
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "Library", fee: { input: "600", expectedVersion: transportFeeVersion() } }], [student], [bus])).rejects.toThrow();
  expect(getRow("student_transport_fees", student.id)).toBeUndefined();
  expect(getRow("students", student.id)).not.toHaveProperty("busId");
  expect(getRow("tr_buses", bus.id)).toMatchObject({ stops: [], studentCount: 0 });
  expect(writes).toHaveLength(0);
});

it("rejects stale fee and assignment revisions without replacing the current amount", async () => {
  const assigned = { ...student, busId: bus.id, busStopId: "old", busStop: "Old stop", busAssignmentRevision: 1 };
  const fee = { id: student.id, studentId: student.id, busId: bus.id, amount: 500, busAssignmentRevision: 1, revision: 1 };
  seed({ students: [assigned], tr_buses: [bus], student_transport_fees: [{ ...fee, amount: 800, revision: 2 }] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "New stop", fee: { input: "600", expectedVersion: transportFeeVersion(fee) } }], [assigned], [bus])).rejects.toThrow("another window");
  seed({ students: [{ ...assigned, busAssignmentRevision: 3 }] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: bus.id, stopName: "New stop" }], [assigned], [bus])).rejects.toThrow("assignment changed");
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ amount: 800 });
  expect(writes).toHaveLength(0);
});
