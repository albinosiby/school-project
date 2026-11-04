import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { NoticesView } from "./NoticesView";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const roster = {
  students: [
    { id: "stu_1", name: "Asha", grade: "8", section: "A", status: "Active" }, { id: "stu_2", name: "Ravi", grade: "8", section: "B", status: "Active", busId: "bus_01" },
    { id: "stu_3", name: "Meera", grade: "9", section: "A", status: "Active" }, { id: "stu_4", name: "Old", grade: "8", section: "A", status: "Transferred" },
  ],
  staff: [{ id: "stf_1", name: "Mrs. A", status: "Active" }, { id: "stf_2", name: "Mr. B", status: "Left" }],
  me: [{ id: "me", name: "Dr. Rao", title: "Principal" }],
};
async function compose() {
  seed(roster);
  const r = renderUI(<NoticesView />);
  await r.user.click(screen.getByRole("button", { name: /New Notice/ }));
  return { ...r, d: dialog("Compose Notice") };
}

describe("Notice composer validation", () => {
  it("Send Now needs a title and a message; nothing is written", async () => {
    const { user, d } = await compose();
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(fieldError("Title", d)).toBe("Title is required");
    expect(fieldError("Message", d)).toBe("Message body is required");
    expect(writes).toHaveLength(0);
  });

  it("at least one channel", async () => {
    const { user, d } = await compose();
    await user.type(field("Title", d), "PTM");
    await user.type(field("Message", d), "Saturday");
    await user.click(within(d).getByRole("checkbox", { name: "Mobile App" }));
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(within(d).getByText("Select at least one channel")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("Parents by Grade needs at least one grade", async () => {
    const { user, d } = await compose();
    await user.type(field("Title", d), "Grade 8 trip");
    await user.type(field("Message", d), "Consent forms by Friday");
    await user.selectOptions(field("Audience", d), "Parents by Grade");
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(within(d).getByText("Select at least one grade")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("scheduling needs a future date and time", async () => {
    const { user, d } = await compose();
    await user.type(field("Title", d), "Holiday");
    await user.type(field("Message", d), "Closed Monday");
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(fieldError("Schedule for (only when scheduling)", d)).toBe("Pick a future date and time");
    fireEvent.change(field("Schedule for (only when scheduling)", d), { target: { value: "2020-01-01T09:00" } });
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(fieldError("Schedule for (only when scheduling)", d)).toBe("Pick a future date and time");
    expect(writes).toHaveLength(0);
  });
});

describe("Notice composer writes (contract 10 / 13.6)", () => {
  it("Send Now to a grade: status Published, grades labels, live recipient count, no parentVisible, a Sent log", async () => {
    const { user, d } = await compose();
    await user.type(field("Title", d), "  Grade 8 trip ");
    await user.type(field("Message", d), "Consent forms by Friday");
    await user.selectOptions(field("Audience", d), "Parents by Grade");
    await user.click(within(d).getByRole("checkbox", { name: "Grade 8" }));
    expect(within(d).getByText("2 recipients · Shown in: Parent app")).toBeInTheDocument();
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(await screen.findByText("Notice sent to 2 recipients (simulated)")).toBeInTheDocument();
    const [n] = rowsOf<Record<string, unknown>>("com_notices");
    expect(n).toMatchObject({ title: "Grade 8 trip", audience: "Parents by Grade", grades: ["Grade 8"], status: "Published", recipients: 2, delivered: 2, acked: 0, read: 0,
      channels: ["Mobile App"], author: "Dr. Rao (Principal)", body: "Consent forms by Friday", urgent: false });
    expect(n).not.toHaveProperty("parentVisible");
    expect(writesTo("com_log")[0]!.data).toMatchObject({ noticeId: n!.id, action: "Sent", audience: "Parents by Grade", recipients: 2 });
  });

  it("All School counts active students and staff; other audiences store no grades", async () => {
    const { user, d } = await compose();
    expect(within(d).getByText("4 recipients · Shown in: Parent app · Teacher app · Driver app")).toBeInTheDocument();
    await user.type(field("Title", d), "Fog timings");
    await user.type(field("Message", d), "School starts 9am");
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(await screen.findByText("Notice sent to 4 recipients (simulated)")).toBeInTheDocument();
    expect(rowsOf("com_notices")[0]).toMatchObject({ audience: "All School", grades: [], recipients: 4 });
  });

  it("Schedule stores status Scheduled and the chosen time; a draft needs only a title", async () => {
    const { user, d } = await compose();
    await user.type(field("Title", d), "Exam timetable");
    await user.type(field("Message", d), "Attached");
    fireEvent.change(field("Schedule for (only when scheduling)", d), { target: { value: "2099-01-05T09:30" } });
    await user.click(within(d).getByRole("button", { name: "Schedule" }));
    expect(await screen.findByText("Notice scheduled")).toBeInTheDocument();
    expect(rowsOf("com_notices")[0]).toMatchObject({ status: "Scheduled", sentAt: new Date("2099-01-05T09:30").toISOString(), delivered: 0 });
    expect(writesTo("com_log")).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: /New Notice/ }));
    const d2 = dialog("Compose Notice");
    await user.type(field("Title", d2), "Idea");
    await user.click(within(d2).getByRole("button", { name: "Save Draft" }));
    expect(await screen.findByText("Draft saved")).toBeInTheDocument();
    expect(rowsOf("com_notices")[0]).toMatchObject({ title: "Idea", status: "Draft" });
  });

  it("editing a published notice keeps the parents' ack / read counters and its sent time", async () => {
    seed({ com_notices: [{ id: "ntc_1", title: "Fog", category: "General", audience: "All School", recipients: 4, sentAt: "2026-11-01T08:00:00.000Z", status: "Published", pinned: false,
      urgent: false, author: "Dr. Rao", channels: ["Mobile App"], delivered: 4, acked: 3, read: 3, body: "Old", parentVisible: true }] });
    const { user } = renderUI(<NoticesView />);
    await user.click(screen.getByRole("button", { name: "Edit Notice" }));
    const d = dialog("Edit Notice");
    await user.clear(field("Message", d));
    await user.type(field("Message", d), "New text");
    await user.click(within(d).getByRole("button", { name: "Send Now" }));
    expect(await screen.findByText("Notice updated")).toBeInTheDocument();
    const w = writesTo("com_notices")[0]!;
    expect(w.op).toBe("update");
    expect(w.data).not.toHaveProperty("acked");
    expect(w.data).not.toHaveProperty("read");
    expect(w.data).not.toHaveProperty("parentVisible");
    expect(getRow("com_notices", "ntc_1")).toMatchObject({ body: "New text", acked: 3, read: 3, sentAt: "2026-11-01T08:00:00.000Z", status: "Published" });
    expect(writesTo("com_log")).toHaveLength(0);
  });
});

describe("Scheduled notices", () => {
  it("are published once their time has passed", async () => {
    seed({ com_notices: [
      { id: "due", title: "Due", category: "General", audience: "Staff & Teachers", recipients: 5, sentAt: "2026-01-01T08:00:00.000Z", status: "Scheduled", pinned: false, urgent: false, author: "A", channels: ["Mobile App"], delivered: 0, acked: 0, read: 0, body: "x" },
      { id: "later", title: "Later", category: "General", audience: "All School", recipients: 5, sentAt: "2099-01-01T08:00:00.000Z", status: "Scheduled", pinned: false, urgent: false, author: "A", channels: ["Mobile App"], delivered: 0, acked: 0, read: 0, body: "x" },
    ] });
    renderUI(<NoticesView />);
    await screen.findByText("Due");
    await expect.poll(() => getRow("com_notices", "due")).toMatchObject({ status: "Published", delivered: 5 });
    expect(getRow("com_notices", "later")).toMatchObject({ status: "Scheduled" });
    await expect.poll(() => writesTo("com_log").map((w) => w.data?.action)).toEqual(["Sent (scheduled)"]);
  });
});
