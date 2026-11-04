import { describe, expect, it } from "vitest";
import { fireEvent } from "@testing-library/react";
import { CalendarView } from "./CalendarView";
import { TODAY } from "./data";
import { dialog, field, fieldError, getRow, renderUI, rowsOf, screen, seed, within, writes, writesTo } from "@/test/render";

const ADD = "Add Academic Milestone / Statutory Event";
async function openAdd() {
  const r = renderUI(<CalendarView />);
  await r.user.click(screen.getByRole("button", { name: "Add Event" }));
  return { ...r, d: dialog(ADD) };
}
const setDate = (label: string, v: string, root: HTMLElement) => fireEvent.change(field(label, root), { target: { value: v } });

describe("Calendar event form validation", () => {
  it("requires a title and writes nothing", async () => {
    const { user, d } = await openAdd();
    await user.click(within(d).getByRole("button", { name: "Publish to Master Calendar" }));
    expect(fieldError("Official Event Title", d)).toBe("Event title is required");
    expect(screen.getByText("Please fix the highlighted fields")).toBeInTheDocument();
    expect(writes).toHaveLength(0);
  });

  it("rejects an end date before the start date", async () => {
    const { user, d } = await openAdd();
    await user.type(field("Official Event Title", d), "Science Fair");
    setDate("Start date", "2026-11-12", d);
    setDate("End date", "2026-11-10", d);
    await user.click(within(d).getByRole("button", { name: "Save as Unapproved Draft" }));
    expect(fieldError("End date", d)).toBe("End date must be on or after start date");
    expect(writes).toHaveLength(0);
  });

  it("on a single day the end time must be after the start time; times are required", async () => {
    const { user, d } = await openAdd();
    await user.type(field("Official Event Title", d), "PTM");
    fireEvent.change(field("Daily end time", d), { target: { value: "08:00" } });
    await user.click(within(d).getByRole("button", { name: "Publish to Master Calendar" }));
    expect(fieldError("Daily end time", d)).toBe("End time must be after start time");
    fireEvent.change(field("Daily start time", d), { target: { value: "" } });
    await user.click(within(d).getByRole("button", { name: "Publish to Master Calendar" }));
    expect(fieldError("Daily start time", d)).toBe("Start time is required");
    expect(writes).toHaveLength(0);
  });
});

describe("Calendar event writes (contract 3 / 10)", () => {
  it("publishing writes status 'published' + notifyApp, never parentVisible, and posts one bell row", async () => {
    const { user, d } = await openAdd();
    await user.type(field("Official Event Title", d), "  Annual Sports Day ");
    await user.click(within(d).getByRole("radio", { name: /Sports & Gala/ }));
    setDate("Start date", "2026-11-20", d);
    setDate("End date", "2026-11-21", d);
    await user.click(within(d).getByRole("button", { name: "Publish to Master Calendar" }));
    expect(await screen.findByText("Event published to master calendar")).toBeInTheDocument();
    const [ev] = rowsOf<Record<string, unknown>>("calendar_events");
    expect(ev).toMatchObject({ title: "Annual Sports Day", category: "sports", status: "published", notifyApp: true, start: "2026-11-20", end: "2026-11-21",
      term: "Term 2", allDay: false, startTime: "08:30", endTime: "14:30", instructional: true });
    expect(ev).not.toHaveProperty("parentVisible");
    expect(writesTo("notifications")).toHaveLength(1);
    expect(writesTo("notifications")[0]!.data).toMatchObject({ category: "statutory", href: "/calendar", read: false });
    expect(screen.queryByRole("dialog", { name: ADD })).not.toBeInTheDocument();
  });

  it("an all-day draft stores empty times and sends no bell row", async () => {
    const { user, d } = await openAdd();
    await user.type(field("Official Event Title", d), "Diwali Break");
    await user.click(within(d).getByRole("radio", { name: /Gazetted Holidays/ }));
    await user.click(within(d).getByRole("switch", { name: "All-day event" }));
    expect(within(d).queryByText("Daily start time")).not.toBeInTheDocument();
    setDate("Start date", "2026-10-29", d);
    setDate("End date", "2026-11-03", d);
    await user.click(within(d).getByRole("button", { name: "Save as Unapproved Draft" }));
    expect(await screen.findByText("Saved as unapproved draft")).toBeInTheDocument();
    expect(rowsOf("calendar_events")[0]).toMatchObject({ status: "draft", allDay: true, startTime: "", endTime: "", category: "holiday", term: "Term 1" });
    expect(writesTo("notifications")).toHaveLength(0);
  });

  it("edits an existing event in place without a second bell row", async () => {
    seed({ calendar_events: [{ id: "ev_1", title: "Science Fair", category: "exam", start: TODAY, end: TODAY, startTime: "09:00", endTime: "12:00", venue: "Main Campus", term: "Term 2",
      status: "published", instructional: false, grades: ["8"], notifyApp: true, notifyWhatsapp: false, lead: "", desc: "Old", parentVisible: true }] });
    const { user } = renderUI(<CalendarView />);
    await user.click(screen.getAllByTitle("Science Fair")[0]!);
    await user.click(within(dialog("Science Fair")).getByRole("button", { name: /Edit/ }));
    const d = dialog("Edit Academic Event");
    expect(field("Official Event Title", d)).toHaveValue("Science Fair");
    expect(field("Daily start time", d)).toHaveValue("09:00");
    await user.clear(field("Official Event Title", d));
    await user.type(field("Official Event Title", d), "Science & Maths Fair");
    await user.click(within(d).getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Event updated on the master calendar")).toBeInTheDocument();
    expect(writesTo("calendar_events")).toEqual([expect.objectContaining({ op: "update", id: "ev_1" })]);
    expect(writesTo("calendar_events")[0]!.data).not.toHaveProperty("parentVisible");
    expect(getRow("calendar_events", "ev_1")).toMatchObject({ title: "Science & Maths Fair", status: "published", grades: ["8"], startTime: "09:00", parentVisible: true });
    expect(writesTo("notifications")).toHaveLength(0);
  });

  it("publishing a draft from the event dialog sets status 'published'", async () => {
    seed({ calendar_events: [{ id: "ev_2", title: "Draft PTM", category: "ptm", start: TODAY, end: TODAY, startTime: "09:00", endTime: "12:00", venue: "Main Campus", term: "Term 2",
      status: "draft", instructional: true, grades: [], notifyApp: true, notifyWhatsapp: false, lead: "", desc: "" }] });
    const { user } = renderUI(<CalendarView />);
    await user.click(screen.getAllByTitle("Draft PTM")[0]!);
    await user.click(within(dialog("Draft PTM")).getByRole("button", { name: "Publish" }));
    expect(await screen.findByText("Event published to master calendar")).toBeInTheDocument();
    expect(writesTo("calendar_events")[0]).toMatchObject({ op: "update", id: "ev_2", data: expect.objectContaining({ status: "published" }) });
  });
});
