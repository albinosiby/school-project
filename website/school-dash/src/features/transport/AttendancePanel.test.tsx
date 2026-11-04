import { describe, expect, it } from "vitest";
import { AttendancePanel } from "./AttendancePanel";
import { failNextWrite, getRow, renderUI, screen, seed, writes, writesTo } from "@/test/render";

const stops = [{ id: "stp_01", name: "Lajpat Nagar", pickupTime: "06:45", dropTime: "15:40" }, { id: "stp_02", name: "Greater Kailash", pickupTime: "06:58", dropTime: "15:55" }];
const bus14 = { id: "bus_01", number: "14", regNo: "DL-01-AB-4092", capacity: 42, routeName: "Route 4B", stops, pickupStart: "06:45", dropStart: "15:30", status: "Active", studentCount: 3 };
const student = (id: string, name: string, stop: string) => ({ id, name, grn: `GIS-${id.slice(4)}`, grade: "10", section: "B", guardian: "G", phone: "1", status: "Active", attendance: 95, busId: "bus_01", bus: "Bus 14", busStopId: stop });
const kids = [student("stu_101", "Aarav Sharma", "stp_01"), student("stu_102", "Ananya Reddy", "stp_01"), student("stu_103", "Kabir Das", "stp_02"), { ...student("stu_104", "Gone Kid", "stp_02"), deleted: true }];
const DATE = "2026-11-02", ID = `${DATE}_bus_01_pickup`;
const trip = { id: ID, busId: "bus_01", bus: "Bus 14", routeName: "Route 4B", date: DATE, kind: "pickup", status: "active", total: 3, boarded: 1, dropped: 0, absent: 0 };
const att = { id: ID, tripId: ID, busId: "bus_01", bus: "Bus 14", date: DATE, kind: "pickup", total: 3, boarded: 1, dropped: 0, absent: 0,
  marks: { stu_101: { status: "boarded", at: "2026-11-02T01:20:00.000Z", by: "crw_002", byName: "Suresh Yadav", stopId: "stp_01" } } };

const render = () => renderUI(<AttendancePanel init={{ date: DATE, bus: "bus_01", kind: "pickup" }} />);

describe("Student bus attendance correction", () => {
  it("lists the bus's active riders with the crew's marks", () => {
    seed({ tr_buses: [bus14], students: kids, tr_trips: [trip], tr_attendance: [att] });
    render();
    expect(screen.getByText("Suresh Yadav")).toBeInTheDocument();
    expect(screen.queryByText("Gone Kid")).toBeNull();
    expect(screen.getByLabelText("Status for Aarav Sharma")).toHaveValue("boarded");
  });

  it("corrects a mark with by: admin and recounts both the attendance record and the trip", async () => {
    seed({ tr_buses: [bus14], students: kids, tr_trips: [trip], tr_attendance: [att] });
    const { user } = render();
    await user.selectOptions(screen.getByLabelText("Status for Kabir Das"), "absent");
    const a = getRow<Record<string, unknown> & { marks: Record<string, unknown> }>("tr_attendance", ID)!;
    expect(a.marks.stu_103).toMatchObject({ status: "absent", by: "admin", byName: "Admin", stopId: "stp_02" });
    expect(a.marks.stu_101).toMatchObject({ status: "boarded", by: "crw_002" });
    expect(a).toMatchObject({ boarded: 1, dropped: 0, absent: 1, updatedBy: "admin_uid" });
    expect(getRow("tr_trips", ID)).toMatchObject({ boarded: 1, dropped: 0, absent: 1, status: "active" });
    expect(await screen.findByText("Kabir Das: Absent")).toBeInTheDocument();
  });

  it("clears a mark (Not marked deletes the key) and recounts", async () => {
    seed({ tr_buses: [bus14], students: kids, tr_trips: [trip], tr_attendance: [att] });
    const { user } = render();
    await user.selectOptions(screen.getByLabelText("Status for Aarav Sharma"), "none");
    const a = getRow<{ marks: Record<string, unknown>; boarded: number }>("tr_attendance", ID)!;
    expect(a.marks).not.toHaveProperty("stu_101");
    expect(a.boarded).toBe(0);
    expect(getRow("tr_trips", ID)).toMatchObject({ boarded: 0 });
  });

  it("creates the record with the trip id when the crew never marked, without inventing a trip", async () => {
    seed({ tr_buses: [bus14], students: kids });
    const { user } = render();
    expect(screen.getByText(/No pickup trip recorded for Bus 14/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Status for Ananya Reddy"), "boarded");
    expect(getRow("tr_attendance", ID)).toMatchObject({ tripId: ID, busId: "bus_01", bus: "Bus 14", date: DATE, kind: "pickup", total: 3, boarded: 1, dropped: 0, absent: 0,
      marks: { stu_102: { status: "boarded", by: "admin", stopId: "stp_01" } } });
    expect(writesTo("tr_trips")).toHaveLength(0);
  });

  it("writes nothing when the batch is rejected", async () => {
    seed({ tr_buses: [bus14], students: kids, tr_trips: [trip], tr_attendance: [att] });
    const { user } = render();
    failNextWrite();
    await user.selectOptions(screen.getByLabelText("Status for Kabir Das"), "dropped");
    expect(await screen.findByText("Could not save the mark")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });
});
