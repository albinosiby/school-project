import { expect, it } from "vitest";
import { failNextWrite, getRow, seed, writes, writesTo } from "@/test/render";
import { assignStudentBuses } from "./studentBusAssignment";
import { saveStudentTransportFee } from "./studentTransportFee";
import { parseTransportFee, studentTransportFee, studentsWithTransportFees, transportFeeSummary, type StudentTransportFee, type TransportFeeStudent } from "./transportFees";
import type { Bus } from "./types";

const bus: Bus = { id: "bus_a", number: "14", regNo: "KL-01-AB-1234", capacity: 40, routeName: "North", stops: [],
  pickupStart: "", dropStart: "", status: "Active", studentCount: 1, monthlyFee: 1200 };
const student: TransportFeeStudent = { id: "student_a", name: "Aarav", grn: "GRN-1", grade: "5", section: "A", guardian: "Parent", phone: "9000000000", status: "Active", attendance: 100, busId: bus.id };
const fee = (monthlyAmount: number | null, extra: Partial<StudentTransportFee> = {}): StudentTransportFee => ({ id: student.id, studentId: student.id,
  busId: bus.id, monthlyAmount, revision: 1, busAssignmentRevision: 0, ...extra });

it.each(["-1", "NaN", "Infinity", "12.345", "1e3", "10000000.01", "abc"])("rejects invalid transport amount %s", (value) => {
  expect(parseTransportFee(value).error).toBeTruthy();
});

it("distinguishes unset, free and decimal amounts and sums configured student fees in paise", () => {
  expect(parseTransportFee(" ")).toEqual({ amount: null });
  expect(parseTransportFee("0")).toEqual({ amount: 0 });
  expect(parseTransportFee(" 1200.50 ")).toEqual({ amount: 1200.5 });
  expect(studentTransportFee({ ...student, transportFee: fee(500, { busId: "other" }) })).toBeNull();
  expect(studentTransportFee({ ...student, busAssignmentRevision: 1, transportFee: fee(500) })).toBeNull();
  expect(transportFeeSummary([
    { ...student, transportFee: fee(1000.1) }, { ...student, id: "two", transportFee: fee(0.2) },
    { ...student, id: "free", transportFee: fee(0) }, { ...student, id: "unset" },
    { ...student, id: "deleted", deleted: true, transportFee: fee(5000) }, { ...student, id: "other", busId: "another" },
  ], bus.id)).toEqual({ total: 1000.3, configured: 3, missing: 1 });
});

it("saves each student's agreed amount separately without updating invoices, students or a bus-wide rate", async () => {
  const other = { ...student, id: "second", name: "Second pupil" };
  seed({ students: [student, other], tr_buses: [bus], fee_invoices: [{ id: "issued", amount: 1200, paid: 500 }] });
  await saveStudentTransportFee(student, bus.id, "900.50");
  await saveStudentTransportFee(other, bus.id, "600");
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ studentId: student.id, busId: bus.id, amount: 900.5, revision: 1, updatedBy: "admin_uid" });
  expect(getRow("student_transport_fees", other.id)).toMatchObject({ amount: 600 });
  expect(writesTo("students")).toHaveLength(0);
  expect(writesTo("tr_buses")).toHaveLength(0);
  expect(writesTo("fee_invoices")).toHaveLength(0);
  expect(getRow("fee_invoices", "issued")).toMatchObject({ amount: 1200, paid: 500 });
});

it("saves free transport and clears an agreed rate to not configured", async () => {
  seed({ students: [student], tr_buses: [bus] });
  await saveStudentTransportFee(student, bus.id, "0");
  const saved = getRow<StudentTransportFee>("student_transport_fees", student.id)!;
  expect(saved.amount).toBe(0);
  await saveStudentTransportFee({ ...student, transportFee: saved }, bus.id, "");
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ amount: null, revision: 2 });
});

it("rejects a stale fee edit, moved/deleted student, removed bus and failed writes without changing the agreed amount", async () => {
  seed({ students: [student], tr_buses: [bus], student_transport_fees: [fee(1000)] });
  await expect(saveStudentTransportFee({ ...student, transportFee: fee(900) }, bus.id, "1100")).rejects.toThrow("another window");
  seed({ students: [{ ...student, busAssignmentRevision: 2 }] });
  await expect(saveStudentTransportFee({ ...student, transportFee: fee(1000) }, bus.id, "1100")).rejects.toThrow("assignment changed");
  seed({ students: [{ ...student, busId: "other" }] });
  await expect(saveStudentTransportFee(student, bus.id, "1100")).rejects.toThrow("assignment changed");
  seed({ students: [{ ...student, deleted: true }] });
  await expect(saveStudentTransportFee(student, bus.id, "1100")).rejects.toThrow("assignment changed");
  seed({ students: [student] });
  await expect(saveStudentTransportFee({ ...student, busId: "removed" }, "removed", "1100")).rejects.toThrow("assignment changed");
  failNextWrite();
  await expect(saveStudentTransportFee({ ...student, transportFee: fee(1000) }, bus.id, "1100")).rejects.toThrow();
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ monthlyAmount: 1000 });
  expect(writes).toHaveLength(0);
});

it("clears the fee when moving/removing a bus, preserves it for stop changes and rejects an old edit after a round trip", async () => {
  const next = { ...bus, id: "bus_b", number: "15", studentCount: 0 };
  const assignedBus = { ...bus, stops: [{ id: "s1", name: "Library", pickupTime: "", dropTime: "", timingPending: true }] };
  seed({ students: [student], tr_buses: [assignedBus, next], student_transport_fees: [fee(1000)] });
  await assignStudentBuses([{ studentId: student.id, busId: bus.id, stopId: "s1" }], [student], [assignedBus, next]);
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ monthlyAmount: 1000 });
  const move = async (busId: string | null) => assignStudentBuses([{ studentId: student.id, busId }],
    [getRow<TransportFeeStudent>("students", student.id)!], [getRow<Bus>("tr_buses", bus.id)!, getRow<Bus>("tr_buses", next.id)!]);
  await move(next.id);
  expect(getRow("student_transport_fees", student.id)).toBeUndefined();
  await move(bus.id);
  await expect(saveStudentTransportFee(student, bus.id, "1000")).rejects.toThrow("assignment changed");
  const current = getRow<TransportFeeStudent>("students", student.id)!;
  await saveStudentTransportFee(current, bus.id, "1100");
  await move(null);
  expect(getRow("student_transport_fees", student.id)).toBeUndefined();
  expect(getRow("students", student.id)).not.toHaveProperty("busId");
});

it("joins fees by the student document ID", () => {
  expect(studentsWithTransportFees([student], [fee(450)])[0].transportFee?.monthlyAmount).toBe(450);
});

it("keeps the original agreed fee when a bus transfer fails its capacity check", async () => {
  const full = { ...bus, id: "full_bus", number: "15", capacity: 0, studentCount: 0 };
  seed({ students: [student], tr_buses: [bus, full], student_transport_fees: [fee(1000)] });
  await expect(assignStudentBuses([{ studentId: student.id, busId: full.id }], [student], [bus, full])).rejects.toThrow("0 seats left");
  expect(getRow("students", student.id)).toMatchObject({ busId: bus.id });
  expect(getRow("student_transport_fees", student.id)).toMatchObject({ monthlyAmount: 1000, busId: bus.id });
  expect(writes).toHaveLength(0);
});


it("reads legacy amounts while giving explicit new amounts, including zero and null, precedence", () => {
  expect(studentTransportFee({ ...student, transportFee: fee(900) })).toBe(900);
  expect(studentTransportFee({ ...student, transportFee: fee(900, { amount: 0 }) })).toBe(0);
  expect(studentTransportFee({ ...student, transportFee: fee(900, { amount: null }) })).toBeNull();
  expect(studentTransportFee({ ...student, transportFee: fee(900, { amount: 600 }) })).toBe(600);
});
