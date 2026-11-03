import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MeetingsPanel } from "./MeetingsPanel";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const NOW = new Date(2026, 10, 3, 10, 0); // Tue 3 Nov 2026, 10:00 local
const students = [{ id: "stu_101", name: "Aarav Sharma", grn: "GIS-9200" }];
const anita = { id: "stf_025", name: "Mrs. Anita Sharma", department: "Mathematics", status: "Active" };
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime();
const booking = (id: string, startMs: number, p: Record<string, unknown> = {}) => ({ id, slotId: id, teacherId: "stf_025", teacher: "Mrs. Anita Sharma", studentId: "stu_101",
  classId: "cls_10B", studentName: "Aarav Sharma", parentUid: "uid_p1", parentName: "Mr. Rahul Sharma", mode: "In-Person", agenda: "Maths progress",
  start: new Date(startMs).toISOString(), startMs, mins: 15, room: "Room 204", link: "", status: "Scheduled", bookedAt: "2026-11-01T10:00:00Z", ...p });

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(NOW); });
afterEach(() => { vi.useRealTimers(); });

async function openPublish() {
  seed({ staff: [anita, { id: "stf_030", name: "Mr. Old", status: "Inactive" }] });
  const r = renderUI(<MeetingsPanel students={students} />);
  await r.user.click(screen.getByRole("button", { name: /Publish slots/ }));
  const d = dialog("Publish meeting slots");
  return { ...r, d, publish: () => r.user.click(within(d).getByRole("button", { name: "Publish" })) };
}
const alertText = () => screen.getByRole("alert").textContent;

describe("Publish meeting slots", () => {
  it("requires a teacher, a date and a future start; inactive staff are not offered", async () => {
    const { user, d, publish } = await openPublish();
    expect(within(field("Teacher", d)).queryByText(/Mr. Old/)).toBeNull();
    await publish();
    expect(alertText()).toBe("Choose a teacher.");
    await user.selectOptions(field("Teacher", d), "stf_025");
    await publish();
    expect(alertText()).toBe("Choose a date and a start time.");
    await user.type(field("Date", d), "2026-11-03");
    await user.clear(field("First slot at", d)); await user.type(field("First slot at", d), "09:30");
    await publish();
    expect(alertText()).toBe("The first slot must be in the future.");
    expect(writes).toHaveLength(0);
  });

  it("checks the count / minutes / gap bounds, modes, room and link", async () => {
    const { user, d, publish } = await openPublish();
    await user.selectOptions(field("Teacher", d), "stf_025");
    await user.type(field("Date", d), "2026-11-10");
    const setNum = async (label: string, v: string) => { await user.clear(field(label, d)); if (v) await user.type(field(label, d), v); };
    const bounds = "Use 1–20 slots of 5–120 minutes, with a 0–60 minute gap.";
    for (const [label, v] of [["Number of slots", "21"], ["Number of slots", "0"], ["Minutes each", "4"], ["Minutes each", "121"], ["Gap between slots (min)", "61"]] as const) {
      await setNum(label, v); await publish(); expect(alertText()).toBe(bounds);
      await setNum("Number of slots", "4"); await setNum("Minutes each", "15"); await setNum("Gap between slots (min)", "5");
    }
    await user.click(screen.getByLabelText("In person"));
    await publish();
    expect(alertText()).toBe("Offer at least one mode.");
    await user.click(screen.getByLabelText("In person"));
    await publish();
    expect(alertText()).toBe("Enter the room for in-person meetings.");
    await user.type(field("Room", d), "Room 204");
    await user.click(screen.getByLabelText("Virtual"));
    await user.type(field("Google Meet link", d), "meet.google.com/abc");
    await publish();
    expect(alertText()).toBe("Enter a valid meeting link starting with https://.");
    expect(writes).toHaveLength(0);
  });

  it("refuses slots that overlap the teacher's existing slots", async () => {
    seed({ ptm_slots: [{ id: "pts_stf_025_202611101530", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", start: new Date(at(10, 15, 30)).toISOString(), startMs: at(10, 15, 30), mins: 15, modes: ["In-Person"], room: "R1", booked: true }] });
    const { user, d, publish } = await openPublish();
    await user.selectOptions(field("Teacher", d), "stf_025");
    await user.type(field("Date", d), "2026-11-10");
    await user.type(field("Room", d), "Room 204");
    await publish();
    expect(alertText()).toMatch(/^Mrs\. Anita Sharma already has a slot around /);
    expect(writes).toHaveLength(0);
  });

  it("writes one ptm_slots doc per slot with the contract id and fields", async () => {
    const { user, d, publish } = await openPublish();
    await user.selectOptions(field("Teacher", d), "stf_025");
    await user.type(field("Date", d), "2026-11-10");
    await user.clear(field("Number of slots", d)); await user.type(field("Number of slots", d), "2");
    await user.clear(field("Minutes each", d)); await user.type(field("Minutes each", d), "20");
    await user.type(field("Room", d), " Room 204 ");
    await user.click(screen.getByLabelText("Virtual"));
    await user.type(field("Google Meet link", d), "https://meet.google.com/abc-defg-hij");
    await publish();
    expect(writesTo("ptm_slots").map((w) => w.id)).toEqual(["pts_stf_025_202611101500", "pts_stf_025_202611101525"]);
    expect(getRow("ptm_slots", "pts_stf_025_202611101525")).toMatchObject({ teacherId: "stf_025", teacher: "Mrs. Anita Sharma", start: new Date(at(10, 15, 25)).toISOString(),
      startMs: at(10, 15, 25), mins: 20, modes: ["In-Person", "Virtual"], room: "Room 204", link: "https://meet.google.com/abc-defg-hij", booked: false });
    expect(await screen.findByText("2 slots published")).toBeInTheDocument();
  });
});

describe("Booking actions", () => {
  it("cancel by the school needs a reason and records cancelledBy school", async () => {
    seed({ ptm_bookings: [booking("pts_stf_025_202611101500", at(10, 15))] });
    const { user } = renderUI(<MeetingsPanel students={students} />);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    const d = dialog("Cancel meeting");
    await user.type(field("Note to the parent", d), "ill");
    await user.click(within(d).getByRole("button", { name: "Cancel meeting" }));
    expect(fieldError("Note to the parent", d)).toBe("Please enter at least 5 characters.");
    expect(writes).toHaveLength(0);
    await user.type(field("Note to the parent", d), " teacher, sorry");
    await user.click(within(d).getByRole("button", { name: "Cancel meeting" }));
    expect(getRow("ptm_bookings", "pts_stf_025_202611101500")).toMatchObject({ status: "Cancelled", cancelledBy: "school", cancelReason: "ill teacher, sorry", cancelledAt: NOW.toISOString() });
  });

  it("marks a finished meeting attended or missed", async () => {
    seed({ ptm_bookings: [booking("b1", at(2, 15)), booking("b2", at(1, 15), { studentName: "Kabir Das" })] });
    const { user } = renderUI(<MeetingsPanel students={students} />);
    await user.click(screen.getByRole("tab", { name: /Past/ }));
    await user.click(screen.getAllByRole("button", { name: "Attended" })[0]!); // newest first: b1
    expect(getRow("ptm_bookings", "b1")).toMatchObject({ status: "Attended" });
    await user.click(screen.getByRole("button", { name: "Missed" }));
    expect(getRow("ptm_bookings", "b2")).toMatchObject({ status: "Missed" });
    expect(writes.map((w) => Object.keys(w.data!).sort())).toEqual([["status", "updatedAt", "updatedBy"], ["status", "updatedAt", "updatedBy"]]);
  });

  it("notes: empty is refused, text is saved as minutes", async () => {
    seed({ ptm_bookings: [booking("b1", at(2, 15), { status: "Attended" })] });
    const { user } = renderUI(<MeetingsPanel students={students} />);
    await user.click(screen.getByRole("tab", { name: /Past/ }));
    await user.click(screen.getByRole("button", { name: "Add notes" }));
    const d = dialog("Meeting notes");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(fieldError("Notes shared with the parent", d)).toBe("Write the notes to share with the parent.");
    expect(writes).toHaveLength(0);
    await user.type(field("Notes shared with the parent", d), "  Practise fractions daily ");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("ptm_bookings", "b1")).toMatchObject({ minutes: "Practise fractions daily" });
  });

  it("Meet link of a virtual booking: invalid refused, valid saved, also once the meeting has started", async () => {
    seed({ ptm_bookings: [booking("b1", at(3, 9, 55), { mode: "Virtual", room: "" })] }); // started 5 min ago, ends 10:10
    const { user } = renderUI(<MeetingsPanel students={students} />);
    await user.click(screen.getByRole("button", { name: "Add link" }));
    const d = dialog("Google Meet link");
    await user.type(field("Link", d), "http://meet.google.com/x");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(fieldError("Link", d)).toBe("Enter a valid meeting link starting with https://.");
    expect(writes).toHaveLength(0);
    await user.clear(field("Link", d)); await user.type(field("Link", d), "https://meet.google.com/abc-defg-hij");
    await user.click(within(d).getByRole("button", { name: "Save" }));
    expect(getRow("ptm_bookings", "b1")).toMatchObject({ link: "https://meet.google.com/abc-defg-hij" });
    expect(getRow("ptm_bookings", "b1")).not.toHaveProperty("minutes");
  });

  it("withdraws an open slot and tolerates slots without modes", async () => {
    seed({ ptm_slots: [{ id: "s1", teacherId: "stf_025", teacher: "Mrs. Anita Sharma", start: new Date(at(10, 15)).toISOString(), startMs: at(10, 15), mins: 15, booked: false }] });
    const { user } = renderUI(<MeetingsPanel students={students} />);
    await user.click(screen.getByRole("tab", { name: /Open slots/ }));
    await user.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(rowsOf("ptm_slots")).toHaveLength(0);
    expect(writes[0]).toMatchObject({ op: "delete", coll: "ptm_slots", id: "s1" });
  });
});
